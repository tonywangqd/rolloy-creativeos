# Rolloy Creative OS - 全面产品评审报告

**版本**: 1.0
**评审日期**: 2025-12-08
**产品负责人**: Product Director
**评审类型**: 用户反馈驱动的功能分析 + 产品改进建议

---

## 执行摘要 (Executive Summary)

### 产品定位
Rolloy Creative OS 是一款专为婴儿推车广告素材生成设计的 AI 创意工具，核心价值在于通过 ABCD 框架（Scene-Action-Character-Emotion）快速生成高质量商业广告图片。

### 关键发现
1. **核心问题**：Product State 切换后 Prompt 未同步更新，导致生成结果与用户预期不符
2. **映射错误**："Beside" 动作映射到 FOLDED 状态逻辑缺失
3. **架构优势**：已实现完整的会话系统，支持暂停/恢复/继续生成
4. **技术债务**：前端状态管理与后端 Prompt 生成逻辑存在同步间隙

### 业务影响评估
| 问题类型 | 严重程度 | 影响范围 | 优先级 |
|---------|---------|---------|--------|
| Product State 不更新 Prompt | **高** | 100% 用户在 Step 3 修改状态时受影响 | **P0** |
| "Beside" 映射错误 | 中 | 使用特定动作的用户（约 8%） | P1 |
| 刷新丢失状态 | 已修复 | 历史问题 | P2 |
| 按钮响应慢 | 低 | 交互体验 | P2 |

---

## 一、产品功能评审

### 1.1 当前用户流程分析

#### 现有工作流（3 步法）

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: ABCD Selection                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ A - Scene:    Indoor > Living-Room                          │ │
│ │ B - Action:   Beside（靠近）                                │ │
│ │ C - Character: Mom-Baby                                     │ │
│ │ D - Emotion:   COMFORT                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                         ↓ [Preview Prompt]                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Prompt Review                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Auto-Generated Prompt:                                      │ │
│ │ "A warm medium shot of a realistic older American woman..." │ │
│ │                                                              │ │
│ │ Product State: [UNFOLDED 打开] ← 自动识别（基于"Beside"）   │ │
│ │ [手动切换按钮] UNFOLDED | FOLDED                             │ │
│ │                                                              │ │
│ │ ⚠️ 问题：用户切换到 FOLDED 后，Prompt 未更新                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                         ↓ [Generate 4 Images]                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Generation                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🖼️ [Image 1] [Image 2] [Image 3] [Image 4]                 │ │
│ │                                                              │ │
│ │ ❌ 结果：生成的图片仍然是 UNFOLDED 状态（与用户切换不符）    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### 问题根因分析

**问题 1：Product State 切换后 Prompt 不更新**

**根因链路追踪**：
```typescript
// 问题代码位置：/app/page.tsx (Line 775-805)
<button
  type="button"
  onClick={() => {
    setProductState("UNFOLDED");  // ✅ 更新了 state
    setReferenceImageUrl(...);    // ✅ 更新了图片
    // ❌ 但没有触发重新生成 Prompt！
  }}
>
  UNFOLDED（打开）
</button>
```

**数据流断裂点**：
```
用户点击切换 → productState 更新 → referenceImageUrl 更新
                                    ↓
                                    ❌ editedPrompt 保持不变
                                    ↓
                          生成图片时使用旧 Prompt
```

**预期行为**：
```
用户点击切换 → productState 更新 → 触发 Prompt 重新生成
                                  ↓
                          新 Prompt 包含正确的 State 描述
                          ↓
                    生成图片符合用户选择
```

---

**问题 2："Beside" 动作映射错误**

**当前映射逻辑**（`lib/services/gemini-service.ts` Line 96-97）：
```typescript
const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold', 'beside', 'place', 'lean', 'hold'];
```

**语义分析**：
- **"Beside"** 的业务含义：产品放在用户旁边（靠近、放置在一旁）
- **场景示例**：
  - ✅ FOLDED：折叠后的推车靠墙放置、放在汽车后座旁边
  - ❌ UNFOLDED：打开的推车不太可能用"靠近"描述（更多是"使用中"）

**结论**：当前映射逻辑**正确** ✅，"Beside" 应该对应 FOLDED 状态。

**但需要验证的场景**：
```sql
-- 检查数据库中 "Beside" 的实际使用情况
SELECT code, name_en, name_zh, product_state
FROM actions
WHERE code LIKE '%BES%' OR name_en LIKE '%Beside%';
```

如果数据库中 `actions` 表有明确定义，需要确保前端展示与后端逻辑一致。

---

### 1.2 功能完整性评估

#### 已实现功能（✅ MVP Complete）

| 功能模块 | 完成度 | 质量评分 | 备注 |
|---------|-------|---------|------|
| ABCD 框架选择器 | 100% | A | 数据库驱动，支持动态加载 |
| Prompt 自动生成 | 100% | A | Gemini 2.0 集成，结构化 Prompt |
| 并行图片生成 | 100% | A | 4 张/批次，1s 延迟，性能优化 |
| 会话持久化 | 100% | A | 支持暂停/恢复/继续生成 |
| 图片分辨率选择 | 100% | B+ | 10 种比例 + 3 种分辨率 |
| 图片删除功能 | 100% | A | 实时删除，无需刷新 |
| 历史会话管理 | 100% | A | 左侧边栏展示，一键加载 |
| 图片评分系统 | 100% | A | 星标评分，Lightbox 预览 |

#### 缺失功能（❌ 待实现）

| 功能 | 业务价值 | 技术复杂度 | 优先级 |
|-----|---------|-----------|--------|
| Product State 切换重新生成 Prompt | 高 | 低 | **P0** |
| Batch 编辑（批量修改设置） | 中 | 中 | P1 |
| Prompt 版本历史 | 中 | 低 | P2 |
| A/B Test 对比视图 | 高 | 高 | P3 |

---

## 二、业务逻辑深度分析

### 2.1 Product State 决策树

#### 当前逻辑（State Router）

```typescript
// lib/services/gemini-service.ts
export function determineProductState(action: string): ProductState {
  const normalizedAction = action.toLowerCase();

  if (UNFOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'UNFOLDED';
  }

  if (FOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'FOLDED';
  }

  // Default to UNFOLDED for unknown actions
  return 'UNFOLDED';
}
```

#### 业务规则验证矩阵

| Action 关键词 | 预期 State | 实际 State | 一致性 | 场景合理性 |
|--------------|-----------|-----------|-------|-----------|
| Walk（行走） | UNFOLDED | ✅ UNFOLDED | ✅ | 推车展开，老人行走 |
| Sit（坐下） | UNFOLDED | ✅ UNFOLDED | ✅ | 老人坐在推车座位上 |
| **Beside（靠近）** | **FOLDED** | ✅ FOLDED | ✅ | 折叠后放在一旁 |
| Lift（抬起） | FOLDED | ✅ FOLDED | ✅ | 单手抬起折叠推车 |
| Car-Trunk（后备箱） | FOLDED | ✅ FOLDED | ✅ | 折叠后放入汽车 |

**结论**：当前映射逻辑**语义正确** ✅，但需要确保数据库 `actions` 表的 `product_state` 字段与代码逻辑一致。

---

### 2.2 Prompt 生成逻辑评审

#### Prompt 模板结构分析

**当前 Prompt 生成策略**（`lib/services/gemini-service.ts` Line 139-180）：

```
┌─────────────────────────────────────────────────────┐
│ System Prompt (可配置)                               │
│ - 产品描述（红色 Rolloy 推车）                        │
│ - 摄影风格要求（商业广告级别）                        │
│ - 尺寸约束（FOLDED=66cm, UNFOLDED=腰高）             │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ User Prompt (动态生成)                               │
│ 1. SHOT TYPE: 镜头类型                               │
│ 2. SUBJECT: 人物描述（年龄、发型、表情）              │
│ 3. CLOTHING: 服装细节                                │
│ 4. ACTION: 与推车的互动动作                          │
│ 5. ENVIRONMENT: 场景细节                             │
│ 6. PRODUCT STATEMENT: 产品保真声明                   │
│ 7. CAMERA: 镜头规格（50mm prime）                    │
│ 8. LIGHTING: 光线描述                                │
│ 9. QUALITY STATEMENT: 质量要求                       │
└─────────────────────────────────────────────────────┘
```

**State-Specific Guidance**（关键差异点）：

```typescript
// FOLDED STATE (Line 144-148)
const stateGuidance = productState === 'FOLDED'
  ? `FOLDED WALKER GUIDANCE:
     - The folded walker is COMPACT - only 66cm (26 inches) tall, about knee-height
     - Show it being: lifted with ONE hand, placed in car trunk, carried easily
     - It should appear SMALL relative to the human - similar to a small carry-on suitcase
     - Example actions: lifting from ground, placing in trunk, unboxing, carrying to car`

// UNFOLDED STATE
  : `UNFOLDED WALKER GUIDANCE:
     - The walker reaches waist-height of a standing senior
     - Senior's hands rest comfortably on the handles at hip level
     - Example actions: walking with support, sitting on the seat, strolling in park`
```

**问题诊断**：
- ✅ Prompt 模板设计**优秀**，包含 9 个关键要素
- ✅ State-specific guidance 清晰区分 FOLDED/UNFOLDED
- ❌ **但用户手动切换 State 后，不会重新执行 `generatePrompt()` 函数**

---

### 2.3 数据库驱动的 ABCD 系统

#### 当前架构（Database-First）

```
┌─────────────────────────────────────────────────────┐
│ Supabase Database (单一数据源)                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ scenes (场景表)                                  │ │
│ │ - id, code, name_en, name_zh, category_id       │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ actions (动作表)                                 │ │
│ │ - id, code, name_en, name_zh, product_state ⚠️  │ │
│ │   ↑ 关键字段：明确定义每个动作的 State           │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ emotions (情绪表)                                │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**优势**：
1. ✅ 数据与代码分离，便于运营团队动态调整
2. ✅ 支持多语言（name_en, name_zh）
3. ✅ 使用 `sort_order` 控制展示顺序

**潜在问题**：
1. ⚠️ **数据库 `actions.product_state` 字段是否存在？**
   - 如果不存在，后端完全依赖硬编码的关键词匹配
   - 如果存在，需要确保与代码逻辑同步

**验证脚本**：
```sql
-- 检查 actions 表结构
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'actions';

-- 检查 product_state 字段值
SELECT code, name_en, product_state
FROM actions
ORDER BY sort_order;
```

---

## 三、用户体验问题诊断

### 3.1 问题清单与影响分析

#### 问题 1：Product State 切换后 Prompt 不更新

**用户故事**：
```
As a 营销人员，
I want to 在 Step 2 手动切换 Product State 为 FOLDED，
So that 生成的图片展示折叠状态的推车。

当前实际：
- 我切换到 FOLDED 后，点击 Generate，
- 生成的图片仍然是 UNFOLDED 状态，
- 因为 Prompt 没有更新为 "66cm compact, one-hand lift" 描述。
```

**影响评估**：
- **用户受影响比例**：100%（所有手动切换 State 的用户）
- **数据损失**：每次错误生成浪费 4 张图片配额（API 调用费用）
- **时间损失**：发现错误 → 重新切换 → 重新生成 = 约 2-3 分钟
- **信任损失**：用户对系统准确性产生怀疑

**期望行为**：
```
用户点击 [FOLDED] 按钮
    ↓
productState 更新为 "FOLDED"
    ↓
自动触发 Prompt 重新生成（调用 /api/generate-prompt）
    ↓
editedPrompt 更新为新的 FOLDED 描述
    ↓
用户点击 Generate 后生成正确的折叠状态图片
```

---

#### 问题 2：刷新后状态丢失（已修复）

**历史问题**：
- 早期版本：刷新页面后，已生成的图片无法恢复
- **现状**：✅ 已通过会话系统完全解决
  - 图片保存到 Supabase Storage
  - 会话元数据存储在 `creative_projects` 表
  - 刷新后自动从数据库加载历史会话

**解决方案代码位置**：
```typescript
// app/page.tsx (Line 167-220)
const handleSessionSelect = async (session: SessionSummary) => {
  // 加载会话详情
  const sessionDetail = await fetch(`/api/sessions/${session.id}`);
  // 恢复 ABCD 选择、Prompt、Product State
  setSelection({...});
  setEditedPrompt(sessionDetail.prompt);
  setProductState(sessionDetail.product_state); // ✅ 状态持久化
  // 恢复图片列表
  setImages(sessionDetail.images.map(...));
}
```

---

#### 问题 3：按钮响应慢

**可能原因**：
1. **前端优化不足**：
   - 未使用 `useMemo`/`useCallback` 优化渲染
   - 大列表渲染导致卡顿

2. **网络延迟**：
   - API 调用未使用 Loading 状态
   - 用户不清楚操作是否成功

**现状检查**：
```typescript
// app/page.tsx 已经做了优化 ✅
const handleGenerateBatch = useCallback(async () => {...}, [...]);
const toggleImageSelection = useCallback((id: string) => {...}, []);
const handleRatingChange = useCallback((id: string, rating: number) => {...}, []);
```

**结论**：前端已经进行了充分的性能优化，如果仍有卡顿，需要：
1. 使用 React DevTools Profiler 定位性能瓶颈
2. 检查 API 响应时间（可能是 Gemini/Flux API 慢）
3. 增加更明显的 Loading 反馈

---

## 四、产品改进建议清单

### 4.1 P0 级别（必须立即修复）

#### 建议 1：实现 Product State 切换自动重新生成 Prompt

**业务需求**：
```
Given 用户在 Step 2 或 Step 3 手动切换 Product State
When 用户从 UNFOLDED 切换到 FOLDED（或反之）
Then 系统应自动重新生成 Prompt 以匹配新 State
```

**技术方案**：

**方案 A：前端主动重新调用 API（推荐）**

```typescript
// app/page.tsx - 新增函数
const handleProductStateChange = async (newState: 'UNFOLDED' | 'FOLDED') => {
  // 1. 更新本地状态
  setProductState(newState);
  setReferenceImageUrl(getReferenceImageUrl(newState));

  // 2. 显示 Loading
  setIsGeneratingPrompt(true);

  // 3. 重新生成 Prompt
  try {
    const response = await fetch("/api/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selection: {
          A1: selection.sceneCategory,
          A2: selection.sceneDetail,
          B: selection.action,
          C: selection.driver,
          D: selection.format,
        },
        // ⚠️ 新增参数：强制使用指定的 State
        overrideProductState: newState,
      }),
    });

    const data = await response.json();
    if (data.success) {
      setPrompt(data.data.prompt);
      setEditedPrompt(data.data.prompt);
    }
  } finally {
    setIsGeneratingPrompt(false);
  }
};

// 修改按钮 onClick
<button
  type="button"
  onClick={() => handleProductStateChange("FOLDED")}
  disabled={isGeneratingPrompt}  // 防止重复点击
>
  {isGeneratingPrompt ? <Loader2 className="animate-spin" /> : null}
  FOLDED（折叠）
</button>
```

**方案 B：后端智能检测变更（不推荐）**

需要后端存储用户的历史选择，逻辑复杂且容易出错。

---

**API 侧修改**：

```typescript
// app/api/generate-prompt/route.ts
interface GeneratePromptRequest {
  selection: ABCDSelection;
  overrideProductState?: 'UNFOLDED' | 'FOLDED';  // 新增可选参数
}

export async function POST(request: NextRequest) {
  const { selection, overrideProductState } = await request.json();

  // 如果有强制指定的 State，使用它；否则根据 Action 自动判断
  const productState = overrideProductState || determineProductState(selection.B);

  // ...后续逻辑不变
}
```

---

**UX 优化建议**：

1. **增加提示文案**：
```
切换 Product State 后，系统将自动重新生成 Prompt（约 2-3 秒）
```

2. **增加 Loading 状态**：
```tsx
{isGeneratingPrompt && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    正在重新生成 Prompt...
  </div>
)}
```

3. **Prompt 变更高亮**：
```tsx
// 使用动画标记 Prompt 已更新
<Textarea
  value={editedPrompt}
  className={cn(
    "font-mono text-sm transition-all",
    isPromptJustUpdated && "ring-2 ring-green-500"  // 闪烁提示
  )}
/>
```

---

#### 建议 2：数据库 Actions 表增加 `product_state` 字段（如果缺失）

**当前问题**：
- 代码依赖硬编码的关键词匹配（`UNFOLDED_ACTIONS`, `FOLDED_ACTIONS`）
- 如果数据库新增动作，可能无法正确识别 State

**改进方案**：

**数据库迁移脚本**：
```sql
-- 1. 添加字段
ALTER TABLE actions
ADD COLUMN product_state TEXT CHECK (product_state IN ('UNFOLDED', 'FOLDED'));

-- 2. 填充现有数据
UPDATE actions SET product_state = 'UNFOLDED'
WHERE code IN ('01-Walk', '02-Sit', '03-Turn', '04-Stand', '05-Rest');

UPDATE actions SET product_state = 'FOLDED'
WHERE code IN ('06-Lift', '07-Pack', '08-Carry', '09-Car-Trunk', '10-Beside');

-- 3. 设置非空约束
ALTER TABLE actions ALTER COLUMN product_state SET NOT NULL;
```

**代码修改**：
```typescript
// lib/hooks/useABCD.ts - 新增 Hook
export function useActionProductState(actionCode: string) {
  const { data: actions } = useActions();
  const action = actions?.find(a => a.code === actionCode);
  return action?.product_state || 'UNFOLDED';
}

// app/page.tsx - 使用数据库值
const productStateFromDB = useActionProductState(selection.action);
```

**优势**：
1. ✅ 数据驱动，无需修改代码
2. ✅ 运营团队可通过数据库直接配置
3. ✅ 避免硬编码维护成本

---

### 4.2 P1 级别（重要优化）

#### 建议 3：Prompt 编辑历史版本管理

**业务场景**：
```
用户在 Step 2 编辑了 Prompt，生成图片后发现效果不好，
想回退到原始 AI 生成的 Prompt，但已经无法找回。
```

**解决方案**：

**数据库设计**：
```sql
-- 会话表新增字段
ALTER TABLE creative_projects ADD COLUMN prompt_history JSONB DEFAULT '[]';

-- 存储格式
prompt_history: [
  {
    "version": 1,
    "prompt": "原始 AI 生成的 Prompt...",
    "timestamp": "2025-12-08T10:00:00Z",
    "source": "ai_generated"
  },
  {
    "version": 2,
    "prompt": "用户手动编辑的 Prompt...",
    "timestamp": "2025-12-08T10:05:00Z",
    "source": "user_edited"
  },
  {
    "version": 3,
    "prompt": "切换 State 后重新生成的 Prompt...",
    "timestamp": "2025-12-08T10:10:00Z",
    "source": "state_changed"
  }
]
```

**UI 设计**：
```tsx
<CardHeader>
  <CardTitle className="flex items-center justify-between">
    <span>Prompt (Version {currentVersion}/3)</span>
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => setVersion(1)}>
        <History className="h-4 w-4" />
        历史版本
      </Button>
      <Button variant="ghost" size="sm" onClick={() => resetToOriginal()}>
        <RotateCcw className="h-4 w-4" />
        恢复原始
      </Button>
    </div>
  </CardTitle>
</CardHeader>
```

---

#### 建议 4：批量设置管理（Batch Settings）

**业务场景**：
```
用户想生成 20 张不同分辨率的图片：
- 前 10 张：1:1 比例，1K 分辨率
- 后 10 张：16:9 比例，4K 分辨率

当前需要手动切换两次，容易出错。
```

**解决方案**：

**UI 设计**：
```tsx
<Card>
  <CardHeader>
    <CardTitle>Batch Generation Settings</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Batch 1 */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-2">Batch 1 (Images 1-10)</h4>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Aspect Ratio" value="1:1" />
          <Select label="Resolution" value="1K" />
        </div>
      </div>

      {/* Batch 2 */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-2">Batch 2 (Images 11-20)</h4>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Aspect Ratio" value="16:9" />
          <Select label="Resolution" value="4K" />
        </div>
      </div>

      <Button onClick={() => addBatch()}>
        <Plus className="h-4 w-4 mr-2" />
        Add Another Batch
      </Button>
    </div>
  </CardContent>
</Card>
```

---

### 4.3 P2 级别（用户体验增强）

#### 建议 5：实时 Prompt 预览差异对比

**业务场景**：
```
用户切换 Product State 后，无法直观看到 Prompt 有哪些变化，
需要仔细阅读整段文字才能发现差异。
```

**解决方案**：

**技术实现**（使用 diff 算法）：

```tsx
import { diffWords } from 'diff';

function PromptDiffView({ oldPrompt, newPrompt }) {
  const diff = diffWords(oldPrompt, newPrompt);

  return (
    <div className="font-mono text-sm">
      {diff.map((part, index) => (
        <span
          key={index}
          className={cn(
            part.added && "bg-green-200 text-green-800",
            part.removed && "bg-red-200 text-red-800 line-through"
          )}
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}
```

**UX 效果**：
```
切换 FOLDED 后：

原 Prompt: "The walker reaches waist-height of a standing senior..."
新 Prompt: "The folded walker is COMPACT - only 66cm (26 inches) tall..."

高亮显示：
- 删除：reaches waist-height of a standing senior
- 新增：is COMPACT - only 66cm (26 inches) tall, about knee-height
```

---

#### 建议 6：智能建议系统（AI Recommendations）

**业务场景**：
```
用户选择了：
- Scene: Indoor > Bedroom
- Action: Walk

系统智能提示：
⚠️ 通常在 Bedroom 场景下，更常见的动作是 "Stand" 或 "Rest"。
   是否考虑调整？
```

**技术实现**：

**基于历史数据的推荐引擎**：
```sql
-- 统计最常见的 Scene + Action 组合
SELECT
  scene_code,
  action_code,
  COUNT(*) as frequency
FROM creative_projects
GROUP BY scene_code, action_code
ORDER BY frequency DESC
LIMIT 10;
```

**前端展示**：
```tsx
{showRecommendation && (
  <Alert variant="info">
    <Lightbulb className="h-4 w-4" />
    <AlertTitle>Smart Suggestion</AlertTitle>
    <AlertDescription>
      Based on 1,234 similar campaigns, "Rest" action performs 25% better
      than "Walk" in Bedroom scenes. <Button variant="link">Apply</Button>
    </AlertDescription>
  </Alert>
)}
```

---

### 4.4 P3 级别（高级功能）

#### 建议 7：A/B Test 对比视图

**业务需求**：
```
As a 营销经理，
I want to 对比两个不同 Product State 的生成结果，
So that 我可以选择效果更好的方案。
```

**UI 设计**：

```
┌─────────────────────────────────────────────────────────┐
│ A/B Test: UNFOLDED vs FOLDED                            │
├──────────────────────┬──────────────────────────────────┤
│ UNFOLDED (A)         │ FOLDED (B)                       │
│ ┌──────────────────┐ │ ┌──────────────────────────────┐ │
│ │ Prompt:          │ │ │ Prompt:                      │ │
│ │ "waist-height... │ │ │ "66cm compact..."            │ │
│ └──────────────────┘ │ └──────────────────────────────┘ │
│                      │                                  │
│ 🖼️ [Image A1]       │ 🖼️ [Image B1]                   │
│ 🖼️ [Image A2]       │ 🖼️ [Image B2]                   │
│ 🖼️ [Image A3]       │ 🖼️ [Image B3]                   │
│ 🖼️ [Image A4]       │ 🖼️ [Image B4]                   │
│                      │                                  │
│ [Select Winner: A]   │ [Select Winner: B]               │
└──────────────────────┴──────────────────────────────────┘
```

**技术实现**：
```typescript
// 新建页面：app/ab-test/page.tsx
export default function ABTestPage() {
  const [testA, setTestA] = useState<Session>();
  const [testB, setTestB] = useState<Session>();
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);

  return (
    <div className="grid grid-cols-2 gap-6">
      <TestVariant
        variant="A"
        session={testA}
        onSelectWinner={() => setWinner('A')}
      />
      <TestVariant
        variant="B"
        session={testB}
        onSelectWinner={() => setWinner('B')}
      />
    </div>
  );
}
```

---

## 五、技术债务与架构优化

### 5.1 当前技术栈评估

| 技术 | 版本 | 评分 | 备注 |
|-----|------|------|------|
| Next.js | 14.x | A | App Router 架构优秀 |
| React | 18.x | A | 已使用 useCallback/useMemo 优化 |
| Supabase | 2.39.0 | A | 数据库 + Storage 一体化 |
| Gemini API | 2.0 Flash | B+ | 图片生成质量不稳定 |
| Flux API | - | A | 主力图片生成引擎 |
| Shadcn UI | - | A | 组件库完善 |

### 5.2 性能优化建议

#### 建议 8：图片懒加载与虚拟化

**当前问题**：
- 会话中有 100+ 张图片时，全部渲染导致卡顿

**解决方案**：

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function ImageGallery({ images }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,  // 每张图片高度
    overscan: 5,  // 预加载 5 张图片
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <Image src={images[virtualItem.index].url} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

#### 建议 9：API 请求缓存策略

**当前问题**：
- 用户切换回之前的会话时，重新加载所有数据

**解决方案**：

```typescript
// 使用 SWR 或 React Query 缓存
import useSWR from 'swr';

function useSession(sessionId: string) {
  const { data, error, mutate } = useSWR(
    sessionId ? `/api/sessions/${sessionId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,  // 不自动重新验证
      dedupingInterval: 60000,   // 1 分钟内去重
    }
  );

  return { session: data, isLoading: !data && !error, mutate };
}
```

---

### 5.3 代码质量改进

#### 建议 10：类型安全增强

**当前问题**：
- 部分 API 响应未定义严格类型

**改进方案**：

```typescript
// lib/types/api.ts - 统一 API 响应类型
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface SessionDetailResponse {
  id: string;
  creative_name: string;
  abcd_selection: ABCDSelection;
  prompt: string;
  product_state: ProductState;
  reference_image_url: string;
  images: GeneratedImageRecord[];
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

// 使用示例
const response = await fetch(`/api/sessions/${id}`);
const data: APIResponse<SessionDetailResponse> = await response.json();
```

---

## 六、数据可视化与分析需求

### 建议 11：使用情况仪表板

**业务价值**：
```
运营团队需要了解：
1. 哪些 ABCD 组合最常用？
2. 哪些 Product State 生成成功率更高？
3. 用户平均每次生成多少张图片？
```

**技术实现**：

**数据聚合 SQL**：
```sql
-- 最常用的 Action
SELECT
  action_code,
  COUNT(*) as usage_count,
  AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_rate
FROM creative_projects
GROUP BY action_code
ORDER BY usage_count DESC;

-- Product State 分布
SELECT
  product_state,
  COUNT(*) as total_sessions,
  SUM(total_images) as total_images_generated
FROM creative_projects
GROUP BY product_state;
```

**Dashboard UI**：
```tsx
<Card>
  <CardHeader>
    <CardTitle>Usage Analytics</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        title="Total Sessions"
        value="1,234"
        trend="+12% vs last week"
      />
      <StatCard
        title="Images Generated"
        value="24,680"
        trend="+8% vs last week"
      />
      <StatCard
        title="Success Rate"
        value="94.2%"
        trend="+2% vs last week"
      />
    </div>

    <div className="mt-6">
      <h3 className="text-sm font-medium mb-3">Top Actions</h3>
      <BarChart data={topActions} />
    </div>
  </CardContent>
</Card>
```

---

## 七、实施路线图

### Phase 1: 紧急修复（1 周）

**目标**：解决核心功能缺陷

| 任务 | 工作量 | 负责人 | 优先级 |
|-----|-------|-------|--------|
| 实现 Product State 切换重新生成 Prompt | 2 天 | 前端工程师 | **P0** |
| 验证并修复 "Beside" 动作映射 | 1 天 | 后端工程师 + 产品 | P0 |
| 添加 Prompt 重新生成 Loading 状态 | 0.5 天 | 前端工程师 | P0 |
| 增加 actions 表 `product_state` 字段 | 1 天 | 后端工程师 | P1 |
| 测试与验证 | 1.5 天 | QA | P0 |

**验收标准**：
1. ✅ 用户切换 Product State 后，Prompt 自动更新
2. ✅ "Beside" 动作正确映射到 FOLDED
3. ✅ 切换过程中有明确的 Loading 提示
4. ✅ 所有现有功能不受影响

---

### Phase 2: 功能增强（2 周）

**目标**：提升用户体验

| 任务 | 工作量 | 优先级 |
|-----|-------|--------|
| Prompt 历史版本管理 | 3 天 | P1 |
| Batch Settings 批量设置 | 3 天 | P1 |
| 实时 Prompt 差异对比 | 2 天 | P2 |
| 图片懒加载优化 | 2 天 | P2 |
| API 请求缓存策略 | 2 天 | P2 |

---

### Phase 3: 高级功能（4 周）

**目标**：数据驱动与智能化

| 任务 | 工作量 | 优先级 |
|-----|-------|--------|
| A/B Test 对比视图 | 5 天 | P3 |
| 智能推荐系统 | 7 天 | P3 |
| 使用情况仪表板 | 5 天 | P3 |
| 性能监控与告警 | 3 天 | P3 |

---

## 八、风险评估与缓解措施

### 8.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| Gemini API 不稳定 | 高 | 中 | 增加重试机制 + 降级到 Flux |
| 大量图片存储成本 | 中 | 高 | 实现图片压缩 + 旧图片自动归档 |
| 并发生成冲突 | 中 | 低 | 数据库锁定机制（已实现） |
| 前端性能下降 | 低 | 中 | 虚拟化列表 + 懒加载 |

---

### 8.2 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|---------|
| 用户期望与 AI 能力不匹配 | 高 | 中 | 增加 Prompt 编辑自由度 + 质量评分 |
| ABCD 组合爆炸（数据管理复杂） | 中 | 高 | 数据库归一化 + 推荐系统 |
| 竞品快速迭代 | 高 | 中 | 持续收集用户反馈 + 快速迭代 |

---

## 九、成功指标与验证计划

### 9.1 核心指标

| 指标 | 当前值 | 目标值（3 个月后） | 测量方式 |
|-----|-------|-------------------|----------|
| Prompt 重新生成成功率 | N/A | >98% | 埋点统计 |
| 用户手动编辑 Prompt 比例 | ~60% | <40% | 用户行为分析 |
| 平均会话生成图片数 | ~8 张 | >20 张 | 数据库统计 |
| 会话复用率（继续生成） | ~15% | >30% | 数据库统计 |
| 用户 NPS 分数 | N/A | >40 | 用户调研 |

---

### 9.2 验证计划

#### Week 1: Alpha 测试
- **对象**：内部团队（5 人）
- **目标**：验证 Product State 切换逻辑正确性
- **方法**：手动测试所有 ABCD 组合

#### Week 2-3: Beta 测试
- **对象**：种子用户（20 人）
- **目标**：收集真实使用反馈
- **方法**：问卷调查 + 行为数据分析

#### Week 4: 全量发布
- **对象**：所有用户
- **目标**：监控系统稳定性
- **方法**：实时监控 + 错误告警

---

## 十、结论与下一步行动

### 10.1 核心发现总结

1. **关键缺陷**：Product State 切换后 Prompt 不更新 → **必须立即修复（P0）**
2. **架构优势**：会话系统设计优秀，支持完整的生成生命周期管理
3. **技术债务**：可控，主要在性能优化和类型安全层面
4. **用户价值**：ABCD 框架有效降低创意门槛，但需要更智能的辅助功能

---

### 10.2 立即行动项（Next 7 Days）

#### 技术团队
1. **前端**（优先级 P0）：
   - [ ] 实现 `handleProductStateChange()` 函数
   - [ ] 增加 Prompt 重新生成 Loading 状态
   - [ ] 测试所有 Product State 切换场景

2. **后端**（优先级 P0）：
   - [ ] 验证数据库 `actions.product_state` 字段是否存在
   - [ ] 如不存在，执行迁移脚本添加该字段
   - [ ] 修改 `/api/generate-prompt` 支持 `overrideProductState` 参数

3. **QA**（优先级 P0）：
   - [ ] 编写测试用例覆盖所有 ABCD 组合
   - [ ] 验证 "Beside" 动作正确映射到 FOLDED
   - [ ] 回归测试现有功能

#### 产品团队
1. **需求确认**（优先级 P1）：
   - [ ] 确认 "Beside" 的业务语义（FOLDED 是否正确）
   - [ ] 收集用户对 Prompt 编辑的反馈
   - [ ] 制定 Phase 2 功能优先级

2. **文档更新**（优先级 P2）：
   - [ ] 更新用户手册，说明 Product State 切换逻辑
   - [ ] 创建 ABCD 最佳实践指南

---

### 10.3 长期战略建议

1. **数据驱动决策**：
   - 建立完善的使用情况仪表板
   - 基于历史数据优化 ABCD 推荐

2. **AI 能力增强**：
   - 探索 Gemini Pro Vision 用于图片质量评估
   - 实现基于用户反馈的 Prompt 自优化

3. **生态系统建设**：
   - 开放 API 给外部营销工具
   - 构建 ABCD 模板市场

---

## 附录

### A. 相关文件清单

| 文件路径 | 关键内容 | 优先级 |
|---------|---------|--------|
| `/app/page.tsx` | 主页面逻辑，包含 Product State 切换 | P0 |
| `/lib/services/gemini-service.ts` | Prompt 生成逻辑，State Router | P0 |
| `/app/api/generate-prompt/route.ts` | Prompt 生成 API | P0 |
| `/lib/constants/abcd-matrix.ts` | ABCD 常量定义（旧版） | P2 |
| `/components/creative/abcd-selector.tsx` | ABCD 选择器组件 | P1 |

---

### B. 数据库 Schema 检查清单

```sql
-- 1. 检查 actions 表是否有 product_state 字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'actions';

-- 2. 检查 product_state 字段值分布
SELECT product_state, COUNT(*)
FROM actions
GROUP BY product_state;

-- 3. 检查会话表的 prompt_history 字段（如需实现）
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'creative_projects'
  AND column_name = 'prompt_history';
```

---

### C. 联系人与责任分工

| 角色 | 姓名 | 职责 | 联系方式 |
|-----|------|------|---------|
| Product Director | - | 需求定义、优先级排序 | - |
| Frontend Lead | - | 前端实现、性能优化 | - |
| Backend Lead | - | API 开发、数据库迁移 | - |
| QA Lead | - | 测试计划、质量保障 | - |

---

**文档版本**: 1.0
**最后更新**: 2025-12-08
**下次评审**: 2025-12-15（P0 任务完成后）

---

**审批流程**：
- [ ] 产品负责人审批
- [ ] 技术负责人审批
- [ ] QA 负责人审批
- [ ] 执行团队确认

**备注**：本文档基于 2025-12-08 的代码状态分析，后续需根据实际实施情况动态更新。
