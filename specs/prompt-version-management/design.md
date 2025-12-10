# Prompt 版本管理系统 - 技术设计文档

## 1. 系统架构概览

### 1.1 技术栈选型
- **存储方案**：Supabase PostgreSQL（而非 localStorage）
  - 理由：需要持久化、支持关系查询、与现有架构一致
  - RLS 策略：复用现有的公开访问策略

- **状态管理**：React useState + Server Actions
  - 理由：轻量级、与现有代码风格一致
  - 版本数据从 API 加载，通过 state 管理

- **UI 模式**：内嵌版本选择器 + 版本标签
  - 位置：Prompt 编辑区域上方
  - 样式：下拉选择 + 时间戳 + 预览

---

## 2. 数据库设计

### 2.1 Schema Design

#### 2.1.1 新增表：`prompt_versions`

```sql
CREATE TABLE prompt_versions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key
  session_id UUID NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,

  -- Version Info
  version_number INTEGER NOT NULL,  -- 1, 2, 3, ...

  -- Prompt Content
  prompt TEXT NOT NULL,
  prompt_chinese TEXT,  -- 中文翻译（可选）

  -- Generation Parameters (snapshot at this version)
  product_state VARCHAR(20) NOT NULL CHECK (product_state IN ('FOLDED', 'UNFOLDED')),
  reference_image_url TEXT,

  -- Metadata
  created_from VARCHAR(50) DEFAULT 'manual',  -- 'initial', 'refinement', 'product_state_change'
  refinement_instruction TEXT,  -- 如果是通过微调生成的，记录用户的指令

  -- Status
  is_active BOOLEAN DEFAULT false,  -- 当前激活版本

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(session_id, version_number)
);

-- Indexes
CREATE INDEX idx_prompt_versions_session_id ON prompt_versions(session_id);
CREATE INDEX idx_prompt_versions_session_active ON prompt_versions(session_id, is_active) WHERE is_active = true;
```

#### 2.1.2 修改表：`generated_images_v2`

```sql
-- Add foreign key to prompt_versions
ALTER TABLE generated_images_v2
ADD COLUMN prompt_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL;

-- Index for filtering images by version
CREATE INDEX idx_generated_images_v2_prompt_version ON generated_images_v2(prompt_version_id);
```

### 2.2 数据关系图

```
generation_sessions (1) ──< (N) prompt_versions
                                      │
                                      │
                                      │ (1)
                                      │
                                      ▼
generated_images_v2 (N) ──> (1) prompt_versions
```

### 2.3 RLS Policies

```sql
-- Enable RLS
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Public access policy (consistent with existing tables)
CREATE POLICY "Allow public access to prompt_versions"
  ON prompt_versions
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

## 3. TypeScript 类型定义

### 3.1 Core Types (`lib/types/prompt-version.ts`)

```typescript
/**
 * Prompt Version - Immutable snapshot of a prompt
 */
export interface PromptVersion {
  id: string;
  session_id: string;

  // Version Info
  version_number: number;  // 1, 2, 3, ...

  // Prompt Content
  prompt: string;
  prompt_chinese?: string;

  // Generation Parameters
  product_state: 'FOLDED' | 'UNFOLDED';
  reference_image_url: string;

  // Metadata
  created_from: 'initial' | 'refinement' | 'product_state_change';
  refinement_instruction?: string;

  // Status
  is_active: boolean;

  // Timestamps
  created_at: string;
}

/**
 * Create Prompt Version Request
 */
export interface CreatePromptVersionRequest {
  session_id: string;
  prompt: string;
  prompt_chinese?: string;
  product_state: 'FOLDED' | 'UNFOLDED';
  reference_image_url: string;
  created_from: 'initial' | 'refinement' | 'product_state_change';
  refinement_instruction?: string;
}

/**
 * Prompt Version Summary (for UI dropdown)
 */
export interface PromptVersionSummary {
  id: string;
  version_number: number;
  prompt_preview: string;  // First 30 chars
  created_at: string;
  is_active: boolean;
  image_count: number;  // Number of images generated with this version
}

/**
 * Switch Version Request
 */
export interface SwitchVersionRequest {
  session_id: string;
  version_id: string;
}
```

### 3.2 Extended Session Types

```typescript
// Extend SessionDetail to include versions
export interface SessionDetailWithVersions extends SessionDetail {
  prompt_versions: PromptVersion[];
  active_version?: PromptVersion;
}
```

---

## 4. API 设计

### 4.1 REST API Endpoints

#### 4.1.1 创建版本
```
POST /api/sessions/{sessionId}/versions

Request Body:
{
  "prompt": "A woman sitting on...",
  "prompt_chinese": "一位女士坐在...",
  "product_state": "UNFOLDED",
  "reference_image_url": "https://...",
  "created_from": "refinement",
  "refinement_instruction": "我希望这个woman是她自己在做美甲"
}

Response:
{
  "success": true,
  "data": {
    "version": { /* PromptVersion */ },
    "version_number": 2
  }
}
```

#### 4.1.2 列出版本
```
GET /api/sessions/{sessionId}/versions

Response:
{
  "success": true,
  "data": {
    "versions": [ /* PromptVersion[] */ ],
    "active_version_id": "uuid-xxx"
  }
}
```

#### 4.1.3 切换版本
```
POST /api/sessions/{sessionId}/versions/{versionId}/activate

Response:
{
  "success": true,
  "data": {
    "version": { /* PromptVersion */ },
    "previous_version_id": "uuid-yyy"
  }
}
```

#### 4.1.4 获取版本详情
```
GET /api/sessions/{sessionId}/versions/{versionId}

Response:
{
  "success": true,
  "data": {
    "version": { /* PromptVersion */ },
    "images": [ /* GeneratedImage[] */ ]  // Images generated with this version
  }
}
```

### 4.2 修改现有 API

#### 4.2.1 创建 Session API
```typescript
// POST /api/sessions
// 修改：创建 Session 时自动创建 V1

const session = await createSession(body);

// Create initial version (V1)
const v1 = await createPromptVersion({
  session_id: session.id,
  prompt: body.prompt,
  product_state: body.product_state,
  reference_image_url: body.reference_image_url,
  created_from: 'initial',
});
```

#### 4.2.2 Refine Prompt API
```typescript
// POST /api/refine-prompt
// 修改：微调成功后创建新版本

const refinedPrompt = await geminiRefinePrompt(body);

// Create new version
const newVersion = await createPromptVersion({
  session_id: body.session_id,
  prompt: refinedPrompt,
  product_state: body.product_state,
  reference_image_url: body.reference_image_url,
  created_from: 'refinement',
  refinement_instruction: body.refinement_instruction,
});
```

#### 4.2.3 Generate Single Image API
```typescript
// POST /api/generate-single
// 修改：生成图片时记录当前 active_version_id

const image = await createImageRecord({
  session_id: body.session_id,
  prompt_version_id: body.active_version_id,  // NEW
  // ...
});
```

---

## 5. 前端 UI 设计

### 5.1 Version Selector Component

#### 5.1.1 位置
- **Prompt Step**: Prompt 编辑区域正上方
- **Generate Step**: 折叠的 Prompt Panel 内部（顶部）

#### 5.1.2 组件设计

```typescript
// components/creative/version-selector.tsx

interface VersionSelectorProps {
  sessionId: string;
  versions: PromptVersionSummary[];
  activeVersionId: string;
  onVersionChange: (versionId: string) => void;
  className?: string;
}

export function VersionSelector({
  sessionId,
  versions,
  activeVersionId,
  onVersionChange,
}: VersionSelectorProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <label className="text-sm font-medium text-muted-foreground">
        Prompt Version:
      </label>

      <select
        value={activeVersionId}
        onChange={(e) => onVersionChange(e.target.value)}
        className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            V{v.version_number} - {formatDate(v.created_at)} - {v.prompt_preview}...
          </option>
        ))}
      </select>

      <div className="text-xs text-muted-foreground">
        {versions.find(v => v.id === activeVersionId)?.image_count || 0} images
      </div>
    </div>
  );
}
```

### 5.2 Image Version Badge

#### 5.2.1 位置
图片卡片左上角（已有的 selection indicator 旁边）

#### 5.2.2 样式
```tsx
{/* Version badge - top left */}
<div className="absolute top-2 left-2 bg-blue-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
  V{image.promptVersionNumber}
</div>
```

### 5.3 Workflow Integration

#### 5.3.1 Prompt Step (page.tsx 修改)
```typescript
// 1. Load versions when session is loaded
const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

// 2. Fetch versions
const loadPromptVersions = async (sessionId: string) => {
  const response = await fetch(`/api/sessions/${sessionId}/versions`);
  const data = await response.json();
  if (data.success) {
    setPromptVersions(data.data.versions);
    setActiveVersionId(data.data.active_version_id);
  }
};

// 3. Handle refinement - create new version
const handleRefinePrompt = async () => {
  // ... existing refinement logic ...

  // Create new version
  const response = await fetch(`/api/sessions/${currentSessionId}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: refinedPrompt,
      product_state: productState,
      reference_image_url: referenceImageUrl,
      created_from: 'refinement',
      refinement_instruction: refinementInput,
    }),
  });

  // Reload versions
  await loadPromptVersions(currentSessionId);
};

// 4. Handle version switch
const handleVersionSwitch = async (versionId: string) => {
  const response = await fetch(
    `/api/sessions/${currentSessionId}/versions/${versionId}/activate`,
    { method: 'POST' }
  );

  if (response.ok) {
    const data = await response.json();
    const version = data.data.version;

    // Update UI state
    setEditedPrompt(version.prompt);
    setChinesePrompt(version.prompt_chinese || '');
    setProductState(version.product_state);
    setReferenceImageUrl(version.reference_image_url);
    setActiveVersionId(versionId);
  }
};
```

#### 5.3.2 UI Layout (Prompt Step)
```tsx
{step === "prompt" && (
  <Card>
    <CardHeader>
      <CardTitle>Generated Prompt</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* NEW: Version Selector */}
      {currentSessionId && promptVersions.length > 0 && (
        <VersionSelector
          sessionId={currentSessionId}
          versions={promptVersions}
          activeVersionId={activeVersionId}
          onVersionChange={handleVersionSwitch}
        />
      )}

      {/* Existing: Product State Selector */}
      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        {/* ... existing code ... */}
      </div>

      {/* Existing: Prompt Editor */}
      <div className="grid grid-cols-2 gap-4">
        {/* ... existing code ... */}
      </div>

      {/* Existing: Refinement Input */}
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
        {/* ... existing code ... */}
      </div>
    </CardContent>
  </Card>
)}
```

---

## 6. 数据流设计

### 6.1 创建版本流程

```
User Action: 点击"微调"按钮
    ↓
Frontend: handleRefinePrompt()
    ↓
API: POST /api/refine-prompt
    ↓
Gemini: 生成 refined prompt
    ↓
Database: INSERT INTO prompt_versions
    ↓
API Response: { version: {...}, version_number: 2 }
    ↓
Frontend: 更新 promptVersions state
    ↓
UI Update: 版本选择器显示 V2
```

### 6.2 切换版本流程

```
User Action: 选择版本 V1
    ↓
Frontend: handleVersionSwitch(v1_id)
    ↓
API: POST /api/sessions/{sid}/versions/{v1_id}/activate
    ↓
Database: UPDATE prompt_versions SET is_active = false WHERE session_id = ?
          UPDATE prompt_versions SET is_active = true WHERE id = v1_id
    ↓
API Response: { version: {...} }
    ↓
Frontend: 更新所有 Prompt 相关 state
    ↓
UI Update: Prompt 编辑框、Product State、Reference Image 全部更新
```

### 6.3 生成图片流程

```
User Action: 点击"Generate 4 Images"
    ↓
Frontend: handleGenerateBatch()
    ↓
For each image:
    ↓
    API: POST /api/generate-single
    ↓
    Body: {
      prompt: editedPrompt,
      active_version_id: activeVersionId  // NEW
    }
    ↓
    Database: INSERT INTO generated_images_v2
              SET prompt_version_id = active_version_id
    ↓
    Gemini: 生成图片
    ↓
    Storage: 上传到 Supabase Storage
    ↓
    Response: { imageUrl, storageUrl }
    ↓
Frontend: 更新 images state
    ↓
UI: 显示图片 + 版本标签 "V2"
```

---

## 7. Service Layer 设计

### 7.1 Prompt Version Service (`lib/services/prompt-version-service.ts`)

```typescript
/**
 * Create a new prompt version
 */
export async function createPromptVersion(
  data: CreatePromptVersionRequest
): Promise<PromptVersion> {
  // 1. Get current max version number
  const { data: maxVersion } = await supabase
    .from('prompt_versions')
    .select('version_number')
    .eq('session_id', data.session_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  const nextVersionNumber = (maxVersion?.version_number || 0) + 1;

  // 2. Deactivate all existing versions
  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('session_id', data.session_id);

  // 3. Create new version
  const { data: newVersion, error } = await supabase
    .from('prompt_versions')
    .insert({
      session_id: data.session_id,
      version_number: nextVersionNumber,
      prompt: data.prompt,
      prompt_chinese: data.prompt_chinese,
      product_state: data.product_state,
      reference_image_url: data.reference_image_url,
      created_from: data.created_from,
      refinement_instruction: data.refinement_instruction,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

/**
 * List all versions for a session
 */
export async function listPromptVersions(
  sessionId: string
): Promise<PromptVersion[]> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('session_id', sessionId)
    .order('version_number', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get active version for a session
 */
export async function getActiveVersion(
  sessionId: string
): Promise<PromptVersion | null> {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;  // No active version
    throw error;
  }
  return data;
}

/**
 * Activate a specific version
 */
export async function activateVersion(
  sessionId: string,
  versionId: string
): Promise<PromptVersion> {
  // 1. Deactivate all versions
  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('session_id', sessionId);

  // 2. Activate target version
  const { data, error } = await supabase
    .from('prompt_versions')
    .update({ is_active: true })
    .eq('id', versionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get images for a specific version
 */
export async function getVersionImages(
  versionId: string
): Promise<GeneratedImage[]> {
  const { data, error } = await supabase
    .from('generated_images_v2')
    .select('*')
    .eq('prompt_version_id', versionId)
    .order('image_index', { ascending: true });

  if (error) throw error;
  return data;
}
```

---

## 8. Migration 策略

### 8.1 数据库 Migration

```sql
-- File: supabase/migrations/20251210_prompt_versions.sql

-- 1. Create prompt_versions table
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES generation_sessions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  prompt_chinese TEXT,
  product_state VARCHAR(20) NOT NULL CHECK (product_state IN ('FOLDED', 'UNFOLDED')),
  reference_image_url TEXT,
  created_from VARCHAR(50) DEFAULT 'manual',
  refinement_instruction TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, version_number)
);

CREATE INDEX idx_prompt_versions_session_id ON prompt_versions(session_id);
CREATE INDEX idx_prompt_versions_session_active ON prompt_versions(session_id, is_active) WHERE is_active = true;

-- 2. Add RLS
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to prompt_versions" ON prompt_versions
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Alter generated_images_v2
ALTER TABLE generated_images_v2
ADD COLUMN prompt_version_id UUID REFERENCES prompt_versions(id) ON DELETE SET NULL;

CREATE INDEX idx_generated_images_v2_prompt_version ON generated_images_v2(prompt_version_id);

-- 4. Backfill existing sessions (create V1 for all existing sessions)
INSERT INTO prompt_versions (session_id, version_number, prompt, product_state, reference_image_url, created_from, is_active)
SELECT
  id as session_id,
  1 as version_number,
  prompt,
  product_state,
  reference_image_url,
  'initial' as created_from,
  true as is_active
FROM generation_sessions
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_versions WHERE prompt_versions.session_id = generation_sessions.id
);

-- 5. Update existing images to link to V1
UPDATE generated_images_v2 img
SET prompt_version_id = (
  SELECT id FROM prompt_versions
  WHERE prompt_versions.session_id = img.session_id
  AND prompt_versions.version_number = 1
  LIMIT 1
)
WHERE img.prompt_version_id IS NULL;
```

### 8.2 向后兼容

- **旧 Session 处理**：Migration 自动为所有现有 Session 创建 V1
- **旧 Image 处理**：Migration 自动将所有现有 Image 关联到 V1
- **前端兼容**：如果 `promptVersions` 为空，隐藏版本选择器

---

## 9. 测试策略

### 9.1 单元测试
- `prompt-version-service.ts` 的所有方法
- 版本创建逻辑（版本号自增）
- 版本激活逻辑（唯一激活状态）

### 9.2 集成测试
- API `/api/sessions/{sid}/versions` CRUD 操作
- 创建 Session → 自动创建 V1
- 微调 Prompt → 自动创建 V2
- 切换版本 → UI 状态更新

### 9.3 E2E 测试
```
Scenario: 用户微调 Prompt 并切换版本
  Given 用户创建了一个新 Session
  When 用户点击"微调"并成功生成新 Prompt
  Then 版本选择器显示 V1 和 V2
  When 用户生成图片
  Then 图片标签显示 "V2"
  When 用户切换回 V1
  Then Prompt 编辑框显示 V1 的内容
  And 图片列表可以筛选显示 V1 的图片
```

---

## 10. 性能优化

### 10.1 数据库优化
- 索引：`session_id`, `(session_id, is_active)`
- 查询优化：使用单次查询获取版本列表 + 图片数量

### 10.2 前端优化
- 版本数据缓存在 React state
- 版本切换时避免重新加载整个 Session
- 懒加载图片列表（按需加载不同版本的图片）

---

## 11. 未来扩展

### 11.1 版本对比功能
- 并排显示两个版本的 Prompt
- Diff 高亮显示差异
- 对比每个版本生成的图片统计

### 11.2 版本分支
- 允许从某个版本创建分支（如 V2.1, V2.2）
- 支持树状版本结构

### 11.3 版本评分
- 用户可以为每个版本打分（1-5 星）
- 根据生成图片的平均评分自动推荐版本

---

## 12. 实施计划

### Phase 1: 数据库 & 类型定义（Day 1）
- [ ] 编写并运行 Migration SQL
- [ ] 定义 TypeScript 类型
- [ ] 创建 Service Layer

### Phase 2: API 层（Day 2）
- [ ] 实现 `/api/sessions/{sid}/versions` CRUD
- [ ] 修改 `/api/sessions` 创建 V1
- [ ] 修改 `/api/refine-prompt` 创建新版本
- [ ] 修改 `/api/generate-single` 关联版本

### Phase 3: UI 组件（Day 3）
- [ ] 实现 VersionSelector 组件
- [ ] 集成到 Prompt Step
- [ ] 集成到 Generate Step
- [ ] 添加图片版本标签

### Phase 4: 测试 & 优化（Day 4）
- [ ] 单元测试
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能优化

---

## 附录 A: 完整示例代码

见以下文件：
- `/lib/types/prompt-version.ts`
- `/lib/services/prompt-version-service.ts`
- `/app/api/sessions/[id]/versions/route.ts`
- `/components/creative/version-selector.tsx`
- `/supabase/migrations/20251210_prompt_versions.sql`

---

## 附录 B: API 完整规范

见 OpenAPI 文档（待补充）

---

**文档版本**: v1.0
**创建日期**: 2025-12-10
**作者**: Chief System Architect
**状态**: Ready for Implementation
