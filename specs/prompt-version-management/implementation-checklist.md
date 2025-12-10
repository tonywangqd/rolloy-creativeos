# Prompt 版本管理系统 - 实施清单

## 概述
本文档提供了完整的实施步骤清单，确保 Prompt 版本管理系统能够顺利集成到现有的 Rolloy Creative OS 中。

---

## Phase 1: 数据库层（Day 1）

### 1.1 运行 Migration
- [ ] 连接到 Supabase Dashboard
- [ ] 进入 SQL Editor
- [ ] 执行 `/supabase/migrations/20251210_prompt_versions.sql`
- [ ] 验证所有表和索引创建成功
- [ ] 检查 Migration 的验证输出（应显示成功消息）

**验证 SQL:**
```sql
-- 1. 检查 prompt_versions 表是否存在
SELECT COUNT(*) FROM prompt_versions;

-- 2. 检查现有 Session 是否都有 V1
SELECT
  s.id,
  s.creative_name,
  COUNT(pv.id) as version_count
FROM generation_sessions s
LEFT JOIN prompt_versions pv ON pv.session_id = s.id
GROUP BY s.id, s.creative_name
HAVING COUNT(pv.id) = 0;  -- 应该返回 0 行

-- 3. 检查每个 Session 是否恰好有一个激活版本
SELECT
  session_id,
  COUNT(*) as active_count
FROM prompt_versions
WHERE is_active = true
GROUP BY session_id
HAVING COUNT(*) > 1;  -- 应该返回 0 行

-- 4. 检查现有图片是否都关联到版本
SELECT COUNT(*)
FROM generated_images_v2
WHERE prompt_version_id IS NULL;  -- 应该返回 0
```

### 1.2 添加类型定义
- [ ] 确认 `/lib/types/prompt-version.ts` 已创建
- [ ] 在 `/lib/types/index.ts` 中导出新类型：
```typescript
// Add to /lib/types/index.ts
export * from './prompt-version';
```

### 1.3 创建 Service Layer
- [ ] 确认 `/lib/services/prompt-version-service.ts` 已创建
- [ ] 运行类型检查：`npm run type-check`
- [ ] 确保没有 TypeScript 错误

---

## Phase 2: API 层（Day 2）

### 2.1 创建版本管理 API
- [ ] 创建 `/app/api/sessions/[id]/versions/route.ts`（已提供）
- [ ] 创建 `/app/api/sessions/[id]/versions/[versionId]/activate/route.ts`（已提供）
- [ ] 测试 API 端点是否可访问

**测试 API:**
```bash
# 1. 列出某个 Session 的版本
curl http://localhost:3000/api/sessions/{session-id}/versions

# 2. 创建新版本
curl -X POST http://localhost:3000/api/sessions/{session-id}/versions \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test prompt",
    "product_state": "UNFOLDED",
    "reference_image_url": "https://example.com/image.jpg",
    "created_from": "refinement",
    "refinement_instruction": "Make it more professional"
  }'

# 3. 切换版本
curl -X POST http://localhost:3000/api/sessions/{session-id}/versions/{version-id}/activate
```

### 2.2 修改 Sessions API - 创建 V1
修改 `/lib/services/session-service.ts` 的 `createSession` 函数：

```typescript
// 在 createSession 函数末尾添加
import { createPromptVersion } from './prompt-version-service';

export async function createSession(data: CreateSessionRequest) {
  // ... existing code ...

  // Create initial prompt version (V1)
  try {
    await createPromptVersion({
      session_id: newSession.id,
      prompt: data.prompt,
      product_state: data.product_state,
      reference_image_url: data.reference_image_url,
      created_from: 'initial',
    });
  } catch (error) {
    console.error('Failed to create initial version:', error);
    // Note: Session is already created, so we don't rollback
  }

  return { session: newSession, images: newImages };
}
```

- [ ] 修改 `/lib/services/session-service.ts`
- [ ] 测试创建新 Session 是否自动创建 V1

### 2.3 修改 Refine Prompt API - 创建新版本
修改 `/app/api/refine-prompt/route.ts`：

```typescript
// 在成功生成 refined prompt 后
import { createPromptVersion } from '@/lib/services/prompt-version-service';

// After gemini refinement succeeds
const refinedPrompt = data.refinedPrompt;

// Create new version if session_id is provided
if (body.session_id) {
  try {
    await createPromptVersion({
      session_id: body.session_id,
      prompt: refinedPrompt,
      prompt_chinese: body.prompt_chinese,  // If available
      product_state: body.product_state,
      reference_image_url: body.reference_image_url,
      created_from: 'refinement',
      refinement_instruction: body.refinement_instruction,
    });
  } catch (error) {
    console.error('Failed to create version:', error);
    // Continue even if version creation fails
  }
}
```

- [ ] 修改 `/app/api/refine-prompt/route.ts`
- [ ] 测试微调 Prompt 是否创建新版本

### 2.4 修改 Generate Single API - 关联版本
修改 `/app/api/generate-single/route.ts`：

```typescript
// Add to request body type
interface GenerateSingleRequest {
  // ... existing fields ...
  active_version_id?: string;  // NEW
}

// When creating image record
const imageData = {
  session_id: body.sessionId,
  prompt_version_id: body.active_version_id,  // NEW
  // ... existing fields ...
};
```

- [ ] 修改 `/app/api/generate-single/route.ts`
- [ ] 测试图片生成是否关联到正确的版本

---

## Phase 3: UI 组件（Day 3）

### 3.1 创建 Version Selector 组件
- [ ] 确认 `/components/creative/version-selector.tsx` 已创建
- [ ] 测试组件在 Storybook 或单独页面中渲染正常

### 3.2 集成到 Prompt Step
修改 `/app/page.tsx` - Prompt Step 部分：

```typescript
// Add state for versions
const [promptVersions, setPromptVersions] = useState<PromptVersionSummary[]>([]);
const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

// Load versions when session is loaded
const loadPromptVersions = async (sessionId: string) => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/versions`);
    const data = await response.json();
    if (data.success) {
      setPromptVersions(data.data.versions);
      setActiveVersionId(data.data.active_version_id);
    }
  } catch (error) {
    console.error('Failed to load versions:', error);
  }
};

// Call loadPromptVersions in handleSessionSelect
const handleSessionSelect = async (session: SessionSummary) => {
  // ... existing code ...

  // Load versions
  await loadPromptVersions(session.id);
};

// Handle version switch
const handleVersionSwitch = async (versionId: string) => {
  if (!currentSessionId) return;

  try {
    const response = await fetch(
      `/api/sessions/${currentSessionId}/versions/${versionId}/activate`,
      { method: 'POST' }
    );

    if (!response.ok) throw new Error('Failed to activate version');

    const data = await response.json();
    const version = data.data.version;

    // Update UI state
    setEditedPrompt(version.prompt);
    setChinesePrompt(version.prompt_chinese || '');
    setProductState(version.product_state);
    setReferenceImageUrl(version.reference_image_url);
    setActiveVersionId(versionId);

    // Optionally: reload images to show only this version's images
    // ... implementation depends on requirements ...
  } catch (error) {
    console.error('Failed to switch version:', error);
    setError('Failed to switch version');
  }
};

// Update handleRefinePrompt to reload versions
const handleRefinePrompt = async () => {
  // ... existing code ...

  if (data.success) {
    // ... existing code ...

    // Reload versions
    if (currentSessionId) {
      await loadPromptVersions(currentSessionId);
    }
  }
};
```

**在 JSX 中添加 Version Selector:**
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

      {/* Existing content... */}
    </CardContent>
  </Card>
)}
```

- [ ] 修改 `/app/page.tsx`
- [ ] 测试版本选择器是否显示
- [ ] 测试切换版本是否更新 Prompt 内容

### 3.3 集成到 Generate Step
在 Generate Step 的 Prompt Panel 中添加 Compact Version Selector：

```tsx
{step === "generate" && isPromptPanelOpen && (
  <CardContent className="space-y-4">
    {/* NEW: Compact Version Selector */}
    {currentSessionId && promptVersions.length > 0 && (
      <CompactVersionSelector
        versions={promptVersions}
        activeVersionId={activeVersionId}
        onVersionChange={handleVersionSwitch}
      />
    )}

    {/* Existing content... */}
  </CardContent>
)}
```

- [ ] 修改 Generate Step 部分
- [ ] 测试 Compact Version Selector 显示

### 3.4 添加图片版本标签
修改图片卡片部分，添加版本标签：

```typescript
// Extend GeneratedImage interface
interface GeneratedImage {
  // ... existing fields ...
  promptVersionId?: string;
  promptVersionNumber?: number;
}

// When loading session images, fetch version numbers
const handleSessionSelect = async (session: SessionSummary) => {
  // ... existing code ...

  // Load versions first
  await loadPromptVersions(session.id);

  // Map images with version numbers
  const restoredImages: GeneratedImage[] = sessionDetail.images.map((img: any) => {
    const version = promptVersions.find(v => v.id === img.prompt_version_id);
    return {
      id: img.id,
      url: img.storage_url || "",
      // ... existing fields ...
      promptVersionId: img.prompt_version_id,
      promptVersionNumber: version?.version_number,
    };
  });
  setImages(restoredImages);
};
```

**在图片卡片 JSX 中添加标签:**
```tsx
{/* Version badge - top left */}
{image.promptVersionNumber && (
  <VersionBadge
    versionNumber={image.promptVersionNumber}
    isActive={image.promptVersionId === activeVersionId}
    className="absolute top-2 left-2 z-10"
  />
)}
```

- [ ] 修改图片卡片渲染逻辑
- [ ] 测试图片是否显示版本标签

### 3.5 传递 active_version_id 到图片生成
修改 `handleGenerateBatch` 函数：

```typescript
const handleGenerateBatch = useCallback(async () => {
  // ... existing code ...

  const response = await fetch("/api/generate-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: editedPrompt,
      referenceImageUrl,
      imageIndex: globalIndex,
      totalImages: endIndex,
      creativeName,
      sessionId: activeSessionId,
      aspectRatio,
      resolution,
      productState,
      active_version_id: activeVersionId,  // NEW
    }),
  });

  // ... existing code ...
}, [
  editedPrompt,
  referenceImageUrl,
  creativeName,
  currentSessionId,
  images.length,
  aspectRatio,
  resolution,
  activeVersionId,  // NEW
]);
```

- [ ] 修改 `handleGenerateBatch`
- [ ] 测试新生成的图片是否关联到正确的版本

---

## Phase 4: 测试与优化（Day 4）

### 4.1 单元测试
- [ ] 测试 `createPromptVersion` 自动递增版本号
- [ ] 测试 `activateVersion` 正确切换激活状态
- [ ] 测试 `getVersionImages` 正确返回图片列表

### 4.2 集成测试
创建测试文件 `__tests__/prompt-version.test.ts`:

```typescript
describe('Prompt Version Management', () => {
  test('Create session automatically creates V1', async () => {
    // Test implementation
  });

  test('Refine prompt creates new version', async () => {
    // Test implementation
  });

  test('Switch version updates UI state', async () => {
    // Test implementation
  });

  test('Images are linked to correct version', async () => {
    // Test implementation
  });
});
```

- [ ] 编写集成测试
- [ ] 运行测试：`npm test`

### 4.3 E2E 测试
使用 Playwright 编写 E2E 测试：

```typescript
test('User can refine prompt and switch versions', async ({ page }) => {
  // 1. Create new session
  await page.goto('/');
  // ... complete ABCD selection ...
  await page.click('button:has-text("Preview Prompt")');

  // 2. Verify V1 is created
  await expect(page.locator('[data-testid="version-selector"]')).toContainText('V1');

  // 3. Refine prompt
  await page.fill('[data-testid="refinement-input"]', 'Make it more professional');
  await page.click('button:has-text("微调")');

  // 4. Verify V2 is created and active
  await expect(page.locator('[data-testid="version-selector"]')).toContainText('V2');

  // 5. Generate image
  await page.click('button:has-text("Generate 4 Images")');

  // 6. Verify image has V2 badge
  await expect(page.locator('[data-testid="image-version-badge"]').first()).toContainText('V2');

  // 7. Switch back to V1
  await page.selectOption('[data-testid="version-selector"]', { label: /V1/ });

  // 8. Verify prompt content changed
  // ... assertions ...
});
```

- [ ] 编写 E2E 测试
- [ ] 运行测试：`npm run test:e2e`

### 4.4 性能优化
- [ ] 使用 React DevTools Profiler 测量版本切换性能（目标 < 100ms）
- [ ] 优化大量版本时的下拉菜单渲染（虚拟滚动？）
- [ ] 检查数据库查询性能（EXPLAIN ANALYZE）

### 4.5 用户验收测试
- [ ] 邀请用户测试完整流程
- [ ] 收集反馈并记录问题
- [ ] 根据反馈调整 UI/UX

---

## Phase 5: 文档与部署（Day 5）

### 5.1 更新文档
- [ ] 更新 README.md 添加版本管理功能说明
- [ ] 创建用户手册（如何使用版本管理）
- [ ] 更新 API 文档（Swagger/OpenAPI）

### 5.2 部署前检查
- [ ] 运行完整测试套件
- [ ] 检查生产环境数据库连接
- [ ] 备份生产数据库
- [ ] 确认 Migration 可以在生产环境运行

### 5.3 部署到 Staging
- [ ] 部署到 Staging 环境
- [ ] 运行 Migration：
```sql
-- In Supabase Dashboard (Production Project)
-- Run: /supabase/migrations/20251210_prompt_versions.sql
```
- [ ] 验证所有功能正常
- [ ] 检查现有 Session 是否都有 V1

### 5.4 部署到 Production
- [ ] 部署代码到 Vercel
- [ ] 监控错误日志（Vercel Dashboard）
- [ ] 验证关键功能（创建 Session、微调 Prompt、切换版本）

### 5.5 监控与回滚计划
- [ ] 设置 Sentry 错误监控
- [ ] 准备回滚脚本（如需要）
- [ ] 监控数据库性能（Supabase Dashboard）

---

## 常见问题排查

### Q1: Migration 失败怎么办？
**A:** 检查以下几点：
1. 确认 Supabase 项目有足够权限
2. 检查是否有表名冲突
3. 逐段执行 SQL，找到失败的语句
4. 查看 Supabase Logs 获取详细错误信息

### Q2: 旧 Session 没有自动创建 V1？
**A:** 手动运行 Backfill SQL：
```sql
INSERT INTO prompt_versions (session_id, version_number, prompt, product_state, reference_image_url, created_from, is_active)
SELECT id, 1, prompt, product_state, reference_image_url, 'initial', true
FROM generation_sessions
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_versions WHERE prompt_versions.session_id = generation_sessions.id
);
```

### Q3: 版本切换后 UI 没有更新？
**A:** 检查：
1. `activeVersionId` state 是否正确更新
2. API 是否返回正确的版本数据
3. 浏览器控制台是否有错误
4. React DevTools 检查组件 props

### Q4: 图片没有关联到版本？
**A:** 检查：
1. `generate-single` API 是否传递了 `active_version_id`
2. 数据库中 `generated_images_v2.prompt_version_id` 是否为空
3. 手动更新：
```sql
UPDATE generated_images_v2 img
SET prompt_version_id = (
  SELECT id FROM prompt_versions
  WHERE session_id = img.session_id AND version_number = 1
  LIMIT 1
)
WHERE prompt_version_id IS NULL;
```

---

## 完成标准

所有以下条件满足，视为实施完成：
- [ ] 所有数据库表和索引创建成功
- [ ] 所有 API 端点正常工作
- [ ] UI 组件正确显示和交互
- [ ] 新创建的 Session 自动有 V1
- [ ] 微调 Prompt 自动创建新版本
- [ ] 切换版本正确更新 Prompt 内容
- [ ] 图片显示正确的版本标签
- [ ] 所有测试通过（单元测试、集成测试、E2E 测试）
- [ ] 生产环境部署成功且稳定运行 24 小时无错误

---

**预计总工时**: 4-5 天（1 人全职）
**建议团队配置**:
- 1x 全栈工程师（负责 Backend + Frontend）
- 1x QA 工程师（负责测试）

**关键里程碑**:
- Day 1 EOD: 数据库 Migration 完成
- Day 2 EOD: 所有 API 可用
- Day 3 EOD: UI 集成完成
- Day 4 EOD: 测试全部通过
- Day 5 EOD: 生产环境上线
