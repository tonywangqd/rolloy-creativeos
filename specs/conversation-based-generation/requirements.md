# 产品需求文档（PRD）：对话式图像生成历史系统

**版本**: 1.0
**日期**: 2025-12-06
**产品负责人**: Product Director
**目标模块**: Creative Workbench - 图像生成核心流程

---

## 1. 背景与目标 (Context & Goals)

### 1.1 业务背景

当前图像生成工作流程存在以下痛点：
- **数据孤岛问题**：用户选择ABCD参数后生成20张图像，完成后无法回溯历史会话
- **资源浪费**：已生成的图像虽然自动保存到Supabase Storage，但用户无法便捷访问
- **工作流断裂**：无法暂停/恢复生成任务，一旦关闭页面，进度丢失
- **效率损失**：无法在已有会话基础上继续生成更多图像，必须重新配置ABCD参数

### 1.2 产品目标

**主目标**: 将一次性生成会话转变为可持久化、可检索、可继续的"对话式历史系统"

**核心价值**:
1. **历史追溯**: 用户可查看所有历史生成会话及其配置
2. **工作连续性**: 支持暂停/恢复/继续生成，提升工作效率
3. **资产管理**: 集中管理所有生成的创意资产
4. **决策支持**: 基于历史数据优化ABCD参数选择

### 1.3 成功指标 (Success Metrics)

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 会话复用率 | >30% | (继续生成的会话数 / 总会话数) |
| 用户留存率 | +15% | 7日留存率对比 |
| 平均会话图像数 | >25张/会话 | 平均每会话生成图像总数 |
| 暂停恢复成功率 | >95% | 成功恢复的会话数 / 暂停会话总数 |

---

## 2. 用户故事 (User Stories)

### 2.1 核心用户旅程

**主角**: 营销专员 Lisa（DTC品牌创意负责人）

#### 场景1: 初次生成
```
As a 营销专员,
I want to 查看我所有历史生成会话的列表,
So that 我可以快速找到之前配置过的ABCD参数和生成的图像
```

**验收标准**:
- Given 用户已登录系统
- When 用户进入 Creative Workbench
- Then 系统应在左侧展示"历史会话列表"（按时间倒序排列）
- And 每个会话卡片应显示：
  - 会话名称（自动生成或用户自定义）
  - ABCD配置摘要（图标化展示）
  - 生成时间
  - 图像数量统计（成功/失败/总数）
  - 会话状态徽章（进行中/已暂停/已完成）

---

#### 场景2: 继续生成
```
As a 营销专员,
I want to 在一个已完成的会话中继续生成更多图像,
So that 我可以基于相同的ABCD配置扩展我的创意资产库
```

**验收标准**:
- Given 用户点击一个状态为"已完成"的历史会话
- When 系统加载该会话详情
- Then 应展示该会话的所有已生成图像（画廊视图）
- And 显示"继续生成"操作按钮
- When 用户点击"继续生成"
- Then 系统应：
  - 保持原ABCD配置不变
  - 允许用户编辑Prompt（可选）
  - 允许用户设置新一批的生成数量（默认20张）
  - 在原会话中追加新生成的图像

---

#### 场景3: 暂停/恢复
```
As a 营销专员,
I want to 在图像生成过程中暂停任务并稍后恢复,
So that 我可以灵活管理我的工作流程和API配额
```

**验收标准**:
- Given 用户正在生成图像（当前进度：8/20）
- When 用户点击"暂停"按钮
- Then 系统应：
  - 停止发送新的生成请求
  - 等待当前正在生成的图像完成
  - 保存当前会话状态（已生成8张，待生成12张）
  - 更新会话状态为"已暂停"
- When 用户稍后重新打开该会话并点击"恢复生成"
- Then 系统应：
  - 加载已生成的8张图像
  - 从第9张开始继续生成剩余12张

---

#### 场景4: 会话管理
```
As a 营销专员,
I want to 重命名、删除和筛选我的历史会话,
So that 我可以保持工作空间的整洁和高效
```

**验收标准**:
- Given 用户在会话列表页面
- When 用户右键点击某个会话卡片
- Then 应展示操作菜单：
  - "重命名"：打开内联编辑框
  - "删除"：显示确认对话框（警告：将删除所有关联图像）
  - "复制配置"：创建新会话并复用ABCD参数
- And 列表顶部应提供筛选器：
  - 状态筛选（全部/进行中/已暂停/已完成/失败）
  - 日期范围筛选
  - ABCD参数筛选（支持多选）

---

#### 场景5: 快速对比
```
As a 营销专员,
I want to 并排对比两个不同会话的生成结果,
So that 我可以评估不同ABCD参数的创意效果
```

**验收标准**:
- Given 用户已选择2个会话（通过复选框）
- When 用户点击"对比视图"按钮
- Then 系统应：
  - 在分屏视图中并排展示两个会话
  - 顶部对比ABCD参数差异（高亮不同项）
  - 中间对比关键指标（生成成功率、平均生成时长）
  - 底部并排展示画廊（可同步滚动）

---

## 3. 功能规格 (Feature Specifications)

### 3.1 会话列表页面 (Session List View)

#### 3.1.1 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  Creative Workbench                      [+ 新建会话]        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  筛选器: [状态▼] [日期范围▼] [ABCD参数▼]     [搜索框]        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 会话列表 (按创建时间倒序)                             │    │
│  │                                                       │    │
│  │  ┌────────────────────────────────────────────┐      │    │
│  │  │ [ICON] 20251206_O_PAR_USI_CON_CU           │      │    │
│  │  │ 🏞️ Outdoor - Park | 👤 Using | 💪 Confidence│      │    │
│  │  │ 📸 18/20 成功 | ⏸️ 已暂停                    │      │    │
│  │  │ 2025-12-06 14:30                           │      │    │
│  │  └────────────────────────────────────────────┘      │    │
│  │                                                       │    │
│  │  ┌────────────────────────────────────────────┐      │    │
│  │  │ [ICON] Kitchen Scene - Joy Campaign        │      │    │
│  │  │ 🏠 Indoor - Kitchen | 🎬 Display | 😊 Joy   │      │    │
│  │  │ 📸 20/20 成功 | ✅ 已完成                    │      │    │
│  │  │ 2025-12-05 09:15                           │      │    │
│  │  └────────────────────────────────────────────┘      │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                               │
│  [加载更多] (无限滚动)                                         │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.2 会话卡片数据结构

每个会话卡片必须展示的最小信息集：

| 字段 | 数据类型 | 业务规则 |
|------|----------|----------|
| 会话名称 | String | 默认自动生成（`generated_name`），支持用户编辑 |
| ABCD配置摘要 | Object | `{scene, action, driver, format}` 图标化展示 |
| 图像统计 | Object | `{total, success, failed, pending}` |
| 会话状态 | Enum | `in_progress / paused / completed / failed` |
| 创建时间 | DateTime | ISO 8601格式，展示时相对时间 |
| 最后更新时间 | DateTime | 用于判断是否为"近期活动" |
| 缩略图 | URL | 首张成功生成的图像（无则用占位符） |

---

### 3.2 会话详情页面 (Session Detail View)

#### 3.2.1 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回列表    [会话名称]                       [⚙️ 操作]     │
├─────────────────────────────────────────────────────────────┤
│  左侧: ABCD配置面板 (只读 + 可复制)                            │
│  ┌────────────────────┐                                      │
│  │ Scene:  🏞️ Park     │                                      │
│  │ Action: 👤 Using    │                                      │
│  │ Driver: 💪 Confidence│                                      │
│  │ Format: 📷 CU       │                                      │
│  │                    │                                      │
│  │ [📋 复制配置]      │                                      │
│  │ [🔄 基于此创建新会话] │                                      │
│  └────────────────────┘                                      │
│                                                               │
│  右侧: 生成控制 + 画廊                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 当前Prompt: [可编辑文本框]                               │  │
│  │ 生成状态: ⏸️ 已暂停 (18/20)                              │  │
│  │                                                          │  │
│  │ [▶️ 恢复生成] [➕ 继续生成更多] [🗑️ 删除会话]              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  画廊视图 (4x5网格)                                            │
│  ┌──┬──┬──┬──┐                                              │
│  │✓ │✓ │✓ │✓ │ ... (已生成的图像，可选择/下载)               │
│  ├──┼──┼──┼──┤                                              │
│  │⏳│⏳│  │  │ ... (生成中/待生成)                           │
│  └──┴──┴──┴──┘                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2.2 继续生成流程

**触发条件**:
- 会话状态为 `completed` 或 `paused`
- 用户点击"继续生成更多"按钮

**执行逻辑**:
1. **参数复用**: 自动填充原ABCD配置和Prompt
2. **用户确认**:
   - 编辑Prompt（可选）
   - 设置新一批数量（默认20张，范围1-50）
3. **状态更新**: 会话状态 → `in_progress`
4. **追加生成**: 新图像追加到现有画廊末尾
5. **计数更新**: `total_images` += 新增数量

---

### 3.3 暂停/恢复机制 (Pause/Resume Logic)

#### 3.3.1 业务规则矩阵

| 当前状态 | 允许操作 | 禁止操作 | 状态转换 |
|---------|---------|---------|---------|
| `in_progress` | 暂停、停止 | 恢复、继续生成 | → `paused` / `completed` |
| `paused` | 恢复、删除、编辑Prompt | 暂停 | → `in_progress` |
| `completed` | 继续生成、删除 | 暂停、恢复 | → `in_progress` (新批次) |
| `failed` | 重试、删除 | 暂停、恢复 | → `in_progress` |

#### 3.3.2 暂停逻辑 (Technical Specification)

**前端行为**:
```typescript
async function pauseGeneration(sessionId: string) {
  // 1. 设置停止标志
  setShouldStop(true);

  // 2. 等待当前正在生成的图像完成
  await waitForCurrentImageCompletion();

  // 3. 更新会话状态到数据库
  await updateSessionStatus(sessionId, 'paused', {
    pausedAt: new Date().toISOString(),
    completedImages: currentImageIndex,
    pendingImages: totalImages - currentImageIndex
  });

  // 4. 显示确认通知
  showNotification('会话已暂停，可随时恢复');
}
```

**数据持久化需求**:
- 暂停时间戳: `paused_at`
- 已完成图像索引: `completed_images`
- 待生成图像索引: `pending_images`

#### 3.3.3 恢复逻辑

**前端行为**:
```typescript
async function resumeGeneration(sessionId: string) {
  // 1. 加载会话数据
  const session = await loadSession(sessionId);

  // 2. 加载已生成的图像
  const existingImages = await loadGeneratedImages(sessionId);
  setImages(existingImages);

  // 3. 计算恢复起点
  const startIndex = session.completed_images;
  const remainingCount = session.pending_images;

  // 4. 继续生成循环
  await generateImages(startIndex, remainingCount, session.prompt);

  // 5. 更新状态
  await updateSessionStatus(sessionId, 'in_progress', {
    resumedAt: new Date().toISOString()
  });
}
```

---

### 3.4 会话操作能力 (Session Operations)

#### 3.4.1 操作权限矩阵

| 操作 | 业务规则 | 需要确认 | 不可逆操作 |
|------|---------|---------|-----------|
| 重命名 | 任何状态均可 | 否 | 否 |
| 删除 | 任何状态均可 | 是（二次确认） | **是** |
| 复制配置 | 任何状态均可 | 否 | 否 |
| 导出图像 | 仅限已有图像的会话 | 否 | 否 |
| 编辑Prompt | 仅限 `paused` 状态 | 否 | 否 |

#### 3.4.2 删除会话业务规则

**删除确认对话框文案**:
```
⚠️ 确认删除会话？

会话名称: [Kitchen Scene - Joy Campaign]
包含图像: 20张

此操作将：
✓ 从列表中移除该会话
✓ 删除所有关联的生成图像（Supabase Storage）
✓ 删除会话配置和元数据

此操作不可撤销！

[取消]  [确认删除]
```

**后端执行逻辑**:
1. 删除 `generated_images` 表中的所有记录（CASCADE）
2. 删除 Supabase Storage 中的图像文件（批量删除）
3. 删除 `creative_projects` 表中的会话记录
4. 记录审计日志

---

## 4. UI/UX要求 (UI/UX Requirements)

### 4.1 信息架构 (Information Architecture)

**导航层级**:
```
Creative Workbench (主页)
├── 会话列表 (默认视图)
│   ├── 筛选器
│   ├── 搜索框
│   └── 会话卡片 (可点击)
│       └── → 会话详情
│           ├── ABCD配置面板
│           ├── 生成控制区
│           └── 画廊视图
└── + 新建会话
    └── → ABCD选择器 (现有流程)
```

### 4.2 交互设计规范

#### 4.2.1 会话列表交互

| 触发事件 | 交互反馈 | 业务逻辑 |
|---------|---------|---------|
| 悬停会话卡片 | 显示操作按钮（编辑、删除、复制） | 无 |
| 单击会话卡片 | 导航到会话详情页 | 加载会话数据 |
| 右键会话卡片 | 显示上下文菜单 | 无 |
| 长按会话卡片 (移动端) | 进入多选模式 | 批量操作 |

#### 4.2.2 会话详情交互

**画廊视图交互规则**:
- **单击图像**: 选中/取消选中（用于批量下载）
- **双击图像**: 全屏预览（支持左右箭头切换）
- **右键图像**: 显示操作菜单（下载、删除、设为封面）
- **拖拽图像**: 批量选择（框选）

**状态指示器规则**:
```
⏳ 生成中    - 黄色边框 + 旋转动画
✅ 成功      - 绿色角标
❌ 失败      - 红色边框 + 错误提示
⏸️ 已暂停    - 灰色蒙版 + "已暂停"文字
```

### 4.3 响应式设计要求

| 屏幕尺寸 | 会话列表布局 | 画廊网格 | 操作按钮 |
|---------|------------|---------|---------|
| 桌面 (>1280px) | 2列卡片 | 5x4 (20张/页) | 全展开 |
| 平板 (768-1280px) | 单列卡片 | 4x5 (20张/页) | 图标+文字 |
| 移动 (<768px) | 单列卡片 | 2x10 (20张/页) | 仅图标 |

### 4.4 视觉规范 (Visual Design Specs)

**会话状态色彩规范**:
```
in_progress  → 蓝色 (#3B82F6)  [Primary]
paused       → 橙色 (#F59E0B)  [Warning]
completed    → 绿色 (#10B981)  [Success]
failed       → 红色 (#EF4444)  [Destructive]
```

**会话卡片阴影规范** (基于 Shadcn):
```css
/* 默认状态 */
box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);

/* 悬停状态 */
box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1),
            0 2px 4px -2px rgb(0 0 0 / 0.1);

/* 选中状态 */
border: 2px solid hsl(var(--primary));
box-shadow: 0 0 0 3px hsl(var(--primary) / 0.2);
```

---

## 5. 数据需求 (Data Requirements)

### 5.1 数据库Schema扩展

#### 5.1.1 会话表扩展 (creative_projects)

**新增字段**:
```sql
ALTER TABLE creative_projects ADD COLUMN IF NOT EXISTS
  -- 会话状态管理
  session_status generation_status DEFAULT 'pending',

  -- 暂停/恢复元数据
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_images INTEGER DEFAULT 0,
  pending_images INTEGER DEFAULT 0,

  -- 用户自定义
  custom_name TEXT,  -- 用户重命名的会话名称
  is_favorite BOOLEAN DEFAULT false,  -- 收藏标记

  -- 生成批次追踪
  generation_batches JSONB DEFAULT '[]'::jsonb,  -- 记录每次生成的批次信息

  -- 统计数据
  total_generation_time INTEGER,  -- 总生成时长（秒）
  average_image_time DECIMAL(10,2)  -- 平均单张生成时长
;
```

**generation_batches JSON结构**:
```json
[
  {
    "batchId": "batch_001",
    "startedAt": "2025-12-06T14:30:00Z",
    "completedAt": "2025-12-06T14:45:00Z",
    "targetCount": 20,
    "successCount": 18,
    "failedCount": 2,
    "imageIds": ["img_uuid_1", "img_uuid_2", ...]
  },
  {
    "batchId": "batch_002",
    "startedAt": "2025-12-06T15:00:00Z",
    "completedAt": null,  // 未完成
    "targetCount": 10,
    "successCount": 5,
    "failedCount": 0,
    "imageIds": ["img_uuid_21", ...]
  }
]
```

#### 5.1.2 生成图像表扩展 (generated_images)

**新增字段**:
```sql
ALTER TABLE generated_images ADD COLUMN IF NOT EXISTS
  -- 批次追踪
  batch_id TEXT,  -- 对应 generation_batches 中的 batchId
  batch_index INTEGER,  -- 在批次中的索引（0-based）

  -- 用户交互
  is_selected BOOLEAN DEFAULT false,  -- 用户是否选中
  is_cover_image BOOLEAN DEFAULT false,  -- 是否为会话封面图

  -- 生成性能
  generation_start_time TIMESTAMPTZ,
  generation_end_time TIMESTAMPTZ,
  generation_duration_ms INTEGER  -- 生成耗时（毫秒）
;
```

#### 5.1.3 新增索引

```sql
-- 会话列表查询优化
CREATE INDEX idx_sessions_user_status_updated
ON creative_projects(created_by, session_status, updated_at DESC);

-- 会话详情查询优化
CREATE INDEX idx_images_session_batch
ON generated_images(project_id, batch_id, batch_index);

-- 收藏会话查询
CREATE INDEX idx_sessions_favorites
ON creative_projects(created_by, is_favorite)
WHERE is_favorite = true;
```

### 5.2 会话状态机 (Session State Machine)

```
[创建会话]
    ↓
[pending] ──[开始生成]──→ [in_progress]
    ↓                         ↓
    │                    [暂停] → [paused]
    │                         ↓         ↓
    │                    [恢复] ←────┘
    │                         ↓
    │                    [全部完成]
    ↓                         ↓
[completed] ←────────────────┘
    ↓
[继续生成] ──→ [in_progress] (新批次)
```

**状态转换规则表**:

| 当前状态 | 触发事件 | 目标状态 | 前置条件 |
|---------|---------|---------|---------|
| pending | 开始生成 | in_progress | ABCD配置完整 + Prompt已生成 |
| in_progress | 暂停 | paused | 至少完成1张图像 |
| in_progress | 全部完成 | completed | completed_images == total_images |
| in_progress | 生成失败 | failed | failed_images > threshold |
| paused | 恢复 | in_progress | 无 |
| paused | 删除 | (删除记录) | 用户确认 |
| completed | 继续生成 | in_progress | 创建新批次 |
| failed | 重试 | in_progress | 重置失败图像 |

---

## 6. 业务规则 (Business Rules)

### 6.1 会话生命周期管理

#### 6.1.1 会话保留策略

| 会话状态 | 自动清理规则 | 用户手动删除 | 备注 |
|---------|------------|------------|------|
| pending | 30天后自动删除 | 允许 | 未开始生成的草稿会话 |
| in_progress | 不自动删除 | 提示确认 | 生成中的会话 |
| paused | 90天后提示用户确认删除 | 允许 | 长期暂停的会话 |
| completed | 不自动删除 | 允许 | 已完成的会话永久保留 |
| failed | 7天后自动删除 | 允许 | 失败会话短期保留用于排查 |

#### 6.1.2 会话配额限制

**免费用户**:
- 最多保留 10 个会话
- 每个会话最多 50 张图像
- 总存储空间: 500 MB

**付费用户**:
- 最多保留 100 个会话
- 每个会话最多 200 张图像
- 总存储空间: 10 GB

**超限处理逻辑**:
```
IF 用户会话数 >= 配额限制 THEN
  SHOW 提示框: "已达会话数量上限，请删除旧会话或升级套餐"
  DISABLE "新建会话"按钮
END IF
```

---

### 6.2 会话命名规则

#### 6.2.1 自动命名逻辑 (Auto-generated Name)

**沿用现有逻辑**: `YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]`

示例: `20251206_O_PAR_USI_CON_CU`

#### 6.2.2 用户自定义命名

**验证规则**:
- 长度: 1-100个字符
- 允许字符: 中文、英文、数字、空格、下划线、连字符
- 禁止字符: `/`, `\`, `<`, `>`, `|`, `:`, `*`, `?`, `"`
- 唯一性: 同一用户下不可重名

**展示优先级**:
```
IF custom_name IS NOT NULL THEN
  显示: custom_name
  副标题: generated_name (灰色小字)
ELSE
  显示: generated_name
END IF
```

---

### 6.3 并发控制规则

**同一会话的并发限制**:
- **禁止多设备同时生成**: 如果会话状态为 `in_progress`，其他设备打开该会话应显示"正在其他设备生成中"提示
- **允许多设备查看**: 已完成或暂停的会话可以多设备同时查看

**实现机制**:
```sql
-- 在 creative_projects 表中添加锁定字段
ALTER TABLE creative_projects ADD COLUMN
  locked_by_session TEXT,  -- WebSocket session ID
  locked_at TIMESTAMPTZ;

-- 生成开始时加锁
UPDATE creative_projects
SET locked_by_session = 'ws_session_xyz',
    locked_at = NOW()
WHERE id = 'project_id'
  AND (locked_by_session IS NULL OR locked_at < NOW() - INTERVAL '10 minutes');

-- 生成完成/暂停时解锁
UPDATE creative_projects
SET locked_by_session = NULL,
    locked_at = NULL
WHERE id = 'project_id';
```

---

### 6.4 图像选择与导出

**批量选择规则**:
- 单次最多选择: 50张图像
- 跨批次选择: 允许
- 选择状态持久化: 保存到 `generated_images.is_selected`

**导出格式**:
- **单张下载**: 原始分辨率 PNG/JPG
- **批量下载**: ZIP压缩包（命名规则: `{session_name}_{timestamp}.zip`）
- **导出元数据**: 可选包含 CSV（图像文件名、ABCD参数、生成时间）

---

## 7. 非功能性需求 (Non-Functional Requirements)

### 7.1 性能要求

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 会话列表加载时间 | < 1秒 (50个会话) | 首屏渲染时间 |
| 会话详情加载时间 | < 1.5秒 (包含20张缩略图) | LCP (Largest Contentful Paint) |
| 图像缩略图加载 | < 500ms/张 | 使用Supabase Storage CDN |
| 暂停响应时间 | < 200ms (UI反馈) | 用户点击到状态更新 |
| 恢复生成准备时间 | < 2秒 | 从点击到开始生成第一张 |

**优化策略**:
- 会话列表: 虚拟滚动（仅渲染可视区域）
- 缩略图: 使用 Supabase Transform API 生成 200x200 低分辨率
- 大图预览: 懒加载 + Progressive JPEG

---

### 7.2 可靠性要求

**数据一致性保证**:
- 会话状态更新: 使用数据库事务（ACID）
- 图像文件与数据库记录: 最终一致性（异步同步，重试机制）
- 暂停时的状态快照: 原子性更新（确保不丢失已生成图像）

**容错机制**:
```
IF 生成单张图像失败 THEN
  记录错误到 generated_images.error_message
  状态设为 'failed'
  继续生成下一张（不中断整个会话）
END IF

IF 连续失败超过5张 THEN
  暂停生成
  通知用户: "检测到多次失败，已自动暂停。请检查网络或API配额。"
  会话状态 → 'paused'
END IF
```

---

### 7.3 安全性要求

**访问控制**:
- 会话数据: 仅创建者可见（RLS策略）
- 图像文件: 通过签名URL访问（有效期24小时）
- 删除操作: 需要二次确认 + CSRF Token

**数据加密**:
- 传输加密: HTTPS (TLS 1.3)
- 存储加密: Supabase Storage默认加密

---

### 7.4 可扩展性设计

**分页与缓存**:
```typescript
// 会话列表分页
const SESSIONS_PER_PAGE = 20;

async function loadSessions(page: number, filters: Filters) {
  const { data, count } = await supabase
    .from('creative_projects')
    .select('*, generated_images(count)', { count: 'exact' })
    .eq('created_by', userId)
    .match(filters)
    .order('updated_at', { ascending: false })
    .range(page * SESSIONS_PER_PAGE, (page + 1) * SESSIONS_PER_PAGE - 1);

  return { sessions: data, totalCount: count };
}
```

**未来扩展点**:
- 会话标签系统（Tags）
- 会话模板（Templates）
- 协作会话（Team Workspaces）
- 版本历史（Prompt变更追踪）

---

## 8. 验收标准 (Acceptance Criteria)

### 8.1 核心流程测试用例

#### 测试用例1: 创建首个会话并暂停

**前置条件**:
- 用户已登录
- 无历史会话

**测试步骤**:
1. 进入 Creative Workbench，点击"新建会话"
2. 完成ABCD选择：Outdoor - Park / Using / Confidence / CU
3. 生成Prompt并点击"确认并生成20张图像"
4. 当生成进度达到 8/20 时，点击"暂停"
5. 验证会话列表中出现该会话，状态为"已暂停"
6. 刷新页面，重新进入该会话
7. 点击"恢复生成"

**预期结果**:
- ✅ 暂停后，已生成8张图像正常展示
- ✅ 刷新页面后，会话状态和图像数据未丢失
- ✅ 恢复生成后，从第9张开始继续
- ✅ 所有20张生成完成后，状态自动变更为"已完成"

---

#### 测试用例2: 继续生成更多图像

**前置条件**:
- 已有1个状态为"已完成"的会话（包含20张图像）

**测试步骤**:
1. 进入该会话详情页
2. 点击"继续生成更多"按钮
3. 保持Prompt不变，设置新批次数量为10张
4. 点击"开始生成"
5. 等待生成完成

**预期结果**:
- ✅ 新生成的10张图像追加到画廊末尾（索引21-30）
- ✅ 会话统计更新为"30张成功"
- ✅ `generation_batches` JSONB字段中新增第二个批次记录
- ✅ 会话 `updated_at` 时间戳更新

---

#### 测试用例3: 删除会话

**前置条件**:
- 已有1个包含20张图像的会话

**测试步骤**:
1. 在会话列表中，右键该会话卡片
2. 点击"删除"
3. 在确认对话框中点击"确认删除"
4. 等待删除完成

**预期结果**:
- ✅ 会话从列表中移除
- ✅ 数据库 `creative_projects` 表中该记录被删除
- ✅ `generated_images` 表中关联的20条记录被级联删除
- ✅ Supabase Storage中的20个图像文件被删除
- ✅ 显示成功通知："会话已删除"

---

### 8.2 边界条件测试

| 测试场景 | 输入 | 预期输出 |
|---------|------|----------|
| 达到会话数量上限 | 已有10个会话（免费用户），尝试创建第11个 | 显示提示："已达会话数量上限" + 禁用"新建会话"按钮 |
| 会话名称重复 | 重命名会话A为已存在的会话B的名称 | 显示错误："会话名称已存在，请使用其他名称" |
| 空会话删除 | 删除一个未生成任何图像的会话 | 直接删除，无需二次确认 |
| 网络中断后恢复 | 生成中断开网络，重新连接后恢复 | 显示提示："检测到网络中断，已自动暂停" + 支持手动恢复 |

---

## 9. 实施优先级与里程碑 (Implementation Roadmap)

### 9.1 MVP（最小可行产品）- Phase 1

**目标**: 实现核心会话历史功能

**包含功能**:
- ✅ 会话自动保存到数据库
- ✅ 会话列表页面（基础版：仅展示会话卡片，无筛选）
- ✅ 会话详情页面（只读，展示ABCD配置和已生成图像）
- ✅ 暂停/恢复生成
- ✅ 删除会话（含二次确认）

**不包含功能**:
- ❌ 会话重命名
- ❌ 筛选器和搜索
- ❌ 继续生成更多图像
- ❌ 批量操作

**预计工期**: 2周

---

### 9.2 Phase 2 - 增强功能

**包含功能**:
- ✅ 继续生成更多图像（新批次追加）
- ✅ 会话重命名
- ✅ 会话状态筛选器（全部/进行中/已暂停/已完成）
- ✅ 图像批量选择和下载
- ✅ 设置会话封面图

**预计工期**: 1.5周

---

### 9.3 Phase 3 - 高级功能

**包含功能**:
- ✅ 高级筛选（日期范围、ABCD参数）
- ✅ 搜索功能（会话名称全文搜索）
- ✅ 会话收藏功能
- ✅ 会话对比视图（2个会话并排对比）
- ✅ 性能优化（虚拟滚动、缩略图懒加载）

**预计工期**: 2周

---

## 10. 数据可视化需求 (Data Visualization Requirements)

### 10.1 会话统计仪表板

**位置**: 会话列表页面顶部

**指标卡片**:
```
┌────────────────────────────────────────────────────────┐
│  总会话数         活跃会话        已完成会话      总图像数  │
│    18           (3进行中+2暂停)      13           360    │
│  ────────────────────────────────────────────────────  │
│  本月新增: +5   │ 本月生成: 120张  │ 成功率: 94%       │
└────────────────────────────────────────────────────────┘
```

**图表需求**:
- **生成趋势图**: 横轴=日期（最近30天），纵轴=生成图像数量，折线图
- **ABCD分布图**: 饼图展示最常用的Scene/Action/Driver/Format
- **会话状态分布**: 甜甜圈图展示各状态会话占比

---

### 10.2 会话详情统计

**位置**: 会话详情页面右上角

**指标展示**:
```
生成批次: 2次
总图像: 30张 (成功28 | 失败2)
总耗时: 15分钟
平均生成时长: 30秒/张
最后更新: 2小时前
```

---

## 11. 错误处理与边界情况 (Error Handling)

### 11.1 用户友好的错误提示

| 错误场景 | 错误代码 | 用户提示文案 | 恢复操作 |
|---------|---------|------------|---------|
| API配额耗尽 | QUOTA_EXCEEDED | "您的API配额已用完，请稍后再试或联系管理员" | 显示配额使用情况 + 升级链接 |
| 网络超时 | NETWORK_TIMEOUT | "网络连接超时，已自动暂停生成" | 提供"重试"按钮 |
| 存储空间不足 | STORAGE_FULL | "存储空间已满，请删除旧会话或升级套餐" | 跳转到存储管理页面 |
| 会话被锁定 | SESSION_LOCKED | "该会话正在其他设备生成中，请稍后再试" | 显示锁定时间 + "强制解锁"选项（管理员） |
| 图像生成失败 | IMAGE_GENERATION_FAILED | "图像生成失败：{具体原因}" | 显示错误详情 + "重试"按钮 |

### 11.2 降级策略

**当Supabase Storage不可用时**:
- 会话列表: 仅展示会话元数据，缩略图显示占位符
- 会话详情: 显示提示"图像加载失败，请稍后刷新"
- 继续生成: 禁用功能，显示"存储服务暂时不可用"

---

## 12. 成功指标与分析埋点 (Analytics Events)

### 12.1 关键事件追踪

| 事件名称 | 触发时机 | 参数 | 业务价值 |
|---------|---------|------|---------|
| `session_created` | 用户创建新会话 | `{abcd_config, user_id}` | 追踪用户活跃度 |
| `session_paused` | 用户暂停生成 | `{session_id, completed_images}` | 分析暂停原因 |
| `session_resumed` | 用户恢复生成 | `{session_id, pause_duration}` | 评估恢复率 |
| `session_continued` | 用户继续生成更多图像 | `{session_id, new_batch_count}` | 核心复用率指标 |
| `session_deleted` | 用户删除会话 | `{session_id, image_count, session_age}` | 分析删除模式 |
| `images_batch_downloaded` | 用户批量下载图像 | `{session_id, image_count}` | 评估内容价值 |
| `session_renamed` | 用户重命名会话 | `{session_id}` | 用户个性化需求 |

### 12.2 漏斗分析

**会话完成漏斗**:
```
创建会话 (100%)
    ↓
开始生成 (90%)
    ↓
完成首批20张 (75%)
    ↓
继续生成更多 (30%)  ← 核心指标
    ↓
下载图像 (50%)
```

---

## 13. 依赖与风险 (Dependencies & Risks)

### 13.1 技术依赖

| 依赖项 | 版本要求 | 风险等级 | 缓解措施 |
|-------|---------|---------|---------|
| Supabase Realtime | >= 2.x | 低 | 使用轮询作为降级方案 |
| Supabase Storage | >= 1.x | 中 | 实现本地缓存机制 |
| Flux/Nano Banana API | Stable | 高 | 增加重试机制 + 错误处理 |
| Next.js App Router | >= 14.x | 低 | 无 |

### 13.2 已知风险

**风险1: 并发生成冲突**
- **描述**: 用户在多个设备同时恢复同一会话
- **影响**: 数据不一致，重复生成
- **缓解**: 实现会话锁定机制（详见6.3节）

**风险2: 大量历史会话导致性能下降**
- **描述**: 用户累积100+会话后列表加载缓慢
- **影响**: 用户体验下降
- **缓解**: 虚拟滚动 + 分页加载 + 建立索引

---

## 14. 交付物清单 (Deliverables)

### 14.1 产品文档
- ✅ 本PRD文档
- ⏳ 高保真原型（Figma/设计稿）
- ⏳ 用户操作手册

### 14.2 技术文档
- ⏳ 数据库迁移脚本（SQL）
- ⏳ API接口文档（Swagger/OpenAPI）
- ⏳ 前端组件库文档（Storybook）

### 14.3 测试文档
- ⏳ 测试用例清单（Excel/Notion）
- ⏳ 自动化测试脚本（Jest/Playwright）

---

## 15. 审批与版本记录

**文档版本**: 1.0
**创建日期**: 2025-12-06
**创建人**: Product Director

**变更记录**:
| 版本 | 日期 | 变更内容 | 修改人 |
|------|------|---------|--------|
| 1.0 | 2025-12-06 | 初始版本 | Product Director |

**待审批人员**:
- [ ] CTO / 技术负责人
- [ ] UX设计师
- [ ] 前端工程师
- [ ] 后端工程师

---

## 附录A: 术语表 (Glossary)

| 术语 | 定义 |
|------|------|
| 会话 (Session) | 一次完整的图像生成流程，包含ABCD配置、Prompt和所有生成的图像 |
| 批次 (Batch) | 在一次会话中，一次性生成的N张图像集合 |
| 恢复 (Resume) | 继续执行被暂停的生成任务 |
| 继续生成 (Continue) | 在已完成的会话中追加新的生成批次 |
| 会话状态 (Session Status) | 描述会话当前阶段的枚举值（pending/in_progress/paused/completed/failed） |

---

## 附录B: ABCD参数映射表

**当前系统的ABCD结构**:
```typescript
interface ABCDSelection {
  sceneCategory: string;    // A1 - Scene Category (indoor/outdoor/lifestyle/product_focus)
  sceneDetail: string;      // A2 - Scene Detail (Park/Kitchen/Beach...)
  action: string;           // B - Action (Using/Displaying/Comparing...)
  driver: string;           // C - Driver (Confidence/Joy/Relief...)
  format: string;           // D - Format (CU/MS/FS/OTS/POV)
}
```

**数据库存储映射**:
```sql
-- 会话保存时的关联关系
creative_projects.scene_id    → scenes.id (WHERE name = sceneDetail)
creative_projects.action_id   → actions.id (WHERE name = action)
creative_projects.driver_id   → drivers.id (WHERE emotion = driver)
creative_projects.format_id   → formats.id (WHERE code = format)
```

---

**文档结束**

---

## 下一步行动 (Next Steps)

1. **架构师审查**: 评估数据库Schema变更的可行性，确认技术债务
2. **设计师设计**: 基于本PRD创建高保真原型，重点关注会话列表和详情页
3. **前端评估**: 拆分开发任务，估算工时，确定技术栈选型（状态管理、虚拟滚动库）
4. **后端评估**: 设计API接口规范，确认并发控制和锁定机制的实现方案
5. **产品验证**: 与核心用户进行需求验证，收集反馈并迭代PRD

**关键决策点**:
- ⚠️ 是否在MVP阶段实现"继续生成"功能？（建议Phase 2）
- ⚠️ 会话删除是否支持"软删除"（回收站功能）？（建议Phase 3）
- ⚠️ 是否需要实时同步功能（WebSocket）还是轮询即可？（建议先用轮询）
