# 数据持久化功能验证报告

## 执行摘要

**验证时间**: 2025-12-12
**验证人**: Product Manager
**验证范围**: Prompt版本管理、中文翻译、Video Prompt、图片数据的云端同步与恢复

---

## 一、用户场景验证结果

### ✅ 场景1：首次生成 Image Prompt
**期望行为**: 用户输入主题 → 生成 Image Prompt → 自动翻译中文 → 保存到云端

**代码验证**:
```typescript
// 文件: app/page.tsx (Line 1003-1058)
handleGeneratePrompt() {
  1. 调用 API 生成英文 Prompt ✅
  2. 创建本地 V1 版本 (line 1034-1045) ✅
  3. 触发后台翻译 translatePromptInBackground(generatedPrompt, 1) (line 1048) ✅
}

translatePromptInBackground(promptText, versionNumber) {
  1. 调用 /api/translate-prompt 获取中文翻译 ✅
  2. 更新本地状态 updateVersionChinesePrompt(versionNumber, translatedText) ✅
  3. 如果 currentSessionId 存在，调用 updateCloudVersionChinese() ✅ (line 908)
}
```

**发现的问题**:
- ❌ **首次生成时不会立即同步到云端**
  - V1 创建时 (line 1034-1045) 没有调用 `syncVersionToCloud()`
  - 只有在 **首次点击"Generate Images"** 后才会同步 V1 (line 1105-1136)
  - 这意味着：如果用户只生成 Prompt 但未生成图片就刷新页面，数据会丢失

**风险等级**: 🟡 中等 - 影响用户体验，但有 localStorage 兜底

---

### ❌ 场景2：生成 Video Prompt
**期望行为**: 用户点击 "Generate Video Prompt" 按钮 → Video Prompt 保存到云端

**代码验证**:
```typescript
// 文件: app/page.tsx (Line 849-887)
handleGenerateVideoPrompt() {
  1. 调用 API 生成 Video Prompt ✅
  2. 更新本地状态 updateVersionVideoPrompt(currentVersionNumber, generatedVideoPrompt) ✅
  3. 如果 currentSessionId 存在，调用 updateCloudVersionVideoPrompt() ✅ (line 876)
}
```

**发现的问题**:
- ❌ **如果用户在"Prompt Preview"阶段（未生成图片）生成 Video Prompt**
  - `currentSessionId` 为 `null` (session 只在首次点击 Generate Images 时创建)
  - 导致 line 875-877 的条件判断失败，**不会同步到云端**
  - Video Prompt 仅存储在 localStorage，刷新后依赖 localStorage 恢复

**风险等级**: 🔴 高 - 跨设备访问时数据会丢失

---

### ✅ 场景3：版本迭代（微调 Prompt）
**期望行为**: 用户微调 Prompt → 生成 V2 → 自动翻译 → 生成图片 → 所有数据保存到云端

**代码验证**:
```typescript
// 文件: app/page.tsx (Line 919-990)
handleRefinePrompt() {
  1. 创建新版本 createPromptVersion(refinedPrompt) → 返回 newVersionNumber ✅
  2. 触发后台翻译 translatePromptInBackground(refinedPrompt, newVersionNumber) ✅
  3. 如果 currentSessionId 存在，调用 syncVersionToCloud() (line 954-980) ✅
     - 携带 prompt, product_state, reference_image_url, created_from, refinement_instruction
     - 等待云端返回 cloudId，更新本地 promptVersions 的 cloudId 字段 (line 709-714)
  4. 翻译完成后，调用 updateCloudVersionChinese() 更新中文翻译 (line 908) ✅
}

// 生成图片时
handleGenerateBatch() {
  1. 确保当前版本已同步 ensureVersionCloudId(activeSessionId, currentVersion) ✅ (line 1143-1151)
  2. 使用 versionCloudId 关联图片 (line 1188) ✅
}
```

**状态**: ✅ **完全符合预期**
- V2-V4 版本会正确同步到云端
- 图片会正确关联到 prompt_version_id
- 中文翻译通过 PATCH API 异步更新 (带重试机制)

---

### ⚠️ 场景4：刷新页面
**期望行为**: 刷新浏览器后，所有版本的 prompt、中文翻译、video prompt、图片都能恢复

**代码验证**:
```typescript
// 文件: app/page.tsx (Line 138-206)
useEffect(() => {
  1. 从 localStorage 加载 promptVersions, images, sessionData ✅
  2. 恢复 selection, productState, creativeName 等状态 ✅
  3. 如果有版本历史，切换到当前版本 (line 182-193) ✅
})
```

**依赖关系分析**:
```
刷新页面 → localStorage 恢复 (本地数据)
         ↓
     如果有 currentSessionId → 不会重新从云端加载
```

**发现的问题**:
- ⚠️ **刷新页面后不会从云端重新加载数据**
  - 只依赖 localStorage，没有调用 `loadVersionsFromCloud()`
  - 如果 localStorage 被清除或切换浏览器，数据无法恢复

**正确的加载流程应该是** (已存在但未被调用):
```typescript
// 文件: app/page.tsx (Line 364-456)
handleSessionSelect(session) {
  1. 先从云端加载版本 loadVersionsFromCloud(session.id) ✅
  2. 映射图片的 promptVersion 字段 ✅
  3. 恢复所有状态 ✅
}
```

**风险等级**: 🟡 中等 - 换设备/清除缓存后数据会丢失

---

### ❌ 场景5：换设备访问
**期望行为**: 用户在另一台电脑打开相同 Session → 看到完整的数据

**代码验证**:
- ❌ **当前没有自动加载 Session 的机制**
  - 用户必须手动从侧边栏的 SessionList 中点击 Session
  - 点击后会触发 `handleSessionSelect()` → 调用 `loadVersionsFromCloud()` ✅

**用户体验问题**:
1. 用户刷新页面后，currentSessionId 会丢失 (localStorage 不存储 sessionId)
2. 用户需要重新从列表选择 Session 才能恢复数据

**建议改进**:
- 在 localStorage 中存储 `lastActiveSessionId`
- 页面加载时自动恢复上次的 Session

---

## 二、数据流完整性分析

### 2.1 新版本创建流程

| 操作 | 本地状态更新 | 云端同步时机 | 同步API | 状态 |
|------|-------------|-------------|---------|------|
| 首次生成 Prompt (V1) | ✅ 立即创建 | ❌ **延迟到首次生成图片** | `POST /api/sessions/{id}/versions` | 🟡 有风险 |
| 微调 Prompt (V2+) | ✅ 立即创建 | ✅ 立即同步 | `POST /api/sessions/{id}/versions` | ✅ 正常 |
| 切换 Product State | ⚠️ 重新生成 Prompt | ❌ **不会创建新版本** | - | 🔴 **数据覆盖风险** |

**严重问题发现**:
```typescript
// 文件: app/page.tsx (Line 585-632)
handleProductStateChange(newState) {
  1. 调用 API 重新生成 Prompt ✅
  2. setPrompt(data.data.prompt) ❌ **直接覆盖当前 prompt**
  3. setEditedPrompt(data.data.prompt) ❌ **直接覆盖当前 editedPrompt**
  4. ❌ **没有调用 createPromptVersion()**
  5. ❌ **没有调用 syncVersionToCloud()**
}
```

**后果**:
- 用户切换 Product State 后，**旧的 Prompt 会丢失**
- 没有版本记录，无法回退
- 如果用户此时刷新页面，数据会混乱

---

### 2.2 翻译同步流程

```
英文 Prompt 生成 → translatePromptInBackground()
                          ↓
                   1. 调用翻译 API ✅
                          ↓
                   2. updateVersionChinesePrompt(versionNumber, translatedText) ✅
                          ↓
                   3. if (currentSessionId) → updateCloudVersionChinese() ✅
                          ↓
                   4. 如果 cloudId 未就绪 → 重试 5 次 (1秒间隔) ✅
```

**状态**: ✅ **逻辑完善，有重试机制**

---

### 2.3 Video Prompt 同步流程

```
用户点击 "Generate Video Prompt"
                ↓
         调用 API 生成 ✅
                ↓
         updateVersionVideoPrompt() ✅
                ↓
         if (currentSessionId) → updateCloudVersionVideoPrompt() ⚠️
                ↓
         [问题] 如果在 Prompt Preview 阶段（无 session），不会同步 ❌
```

**风险**:
- Video Prompt 仅存储在 localStorage
- 刷新页面后如果 localStorage 丢失，Video Prompt 会消失

---

### 2.4 图片版本关联流程

```
handleGenerateBatch() → 创建 Session (如需要)
                              ↓
                       ensureVersionCloudId() ✅ (关键步骤)
                              ↓
                       生成图片时携带 promptVersionId ✅
                              ↓
                       API: POST /api/generate-single
                              ↓
                       存储到 generated_images_v2.prompt_version_id ✅
```

**验证**:
```typescript
// Line 1143-1151: 确保版本已同步到云端
const currentVersion = promptVersions.find(v => v.version === currentVersionNumber);
let versionCloudId = await ensureVersionCloudId(activeSessionId, currentVersion);

// Line 1188: 传递 versionCloudId
body: JSON.stringify({
  promptVersionId: versionCloudId, // ✅ 正确关联
  ...
})
```

**状态**: ✅ **正确实现**

---

## 三、关键缺陷总结

### 🔴 严重缺陷

1. **V1 版本不会立即同步到云端**
   - 位置: `app/page.tsx` Line 1034-1045
   - 后果: 用户生成 Prompt 后刷新页面 → 数据丢失
   - 修复方案: 在 `handleGeneratePrompt()` 中立即调用 `syncVersionToCloud()`

2. **切换 Product State 会覆盖当前 Prompt**
   - 位置: `app/page.tsx` Line 585-632
   - 后果: 旧 Prompt 丢失，无法回退
   - 修复方案: 创建新版本而非覆盖

3. **Video Prompt 在 Prompt Preview 阶段不会同步**
   - 位置: `app/page.tsx` Line 875-877
   - 后果: 跨设备访问时 Video Prompt 丢失
   - 修复方案: 延迟 Video Prompt 生成到首次创建 Session 后

---

### 🟡 中等风险

4. **刷新页面不会从云端重新加载**
   - 位置: `app/page.tsx` Line 138-206 (useEffect)
   - 后果: 依赖 localStorage，换设备/清缓存后数据丢失
   - 修复方案: 存储 `lastActiveSessionId` 并自动恢复

5. **中文翻译的云端更新依赖 Session 存在**
   - 位置: `app/page.tsx` Line 907-909
   - 后果: V1 的中文翻译在首次生成图片前不会同步
   - 修复方案: 配合缺陷 #1 一起修复

---

## 四、数据持久化架构评估

### 4.1 当前架构

```
┌─────────────────────────────────────────────────────┐
│              Frontend (app/page.tsx)                │
├─────────────────────────────────────────────────────┤
│  Local State Management                             │
│  - promptVersions: PromptVersion[]                  │
│  - currentVersionNumber: number                     │
│  - images: GeneratedImage[]                         │
│                                                     │
│  Persistence Layers:                                │
│  1. localStorage (临时缓存)                          │
│     - STORAGE_KEY_PROMPT_VERSIONS                   │
│     - STORAGE_KEY_IMAGES                            │
│     - STORAGE_KEY_SESSION_DATA                      │
│                                                     │
│  2. Cloud Sync (永久存储)                            │
│     - syncVersionToCloud() → Supabase               │
│     - updateCloudVersionChinese() → PATCH API       │
│     - updateCloudVersionVideoPrompt() → PATCH API   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│          Backend API (Next.js Route Handlers)       │
├─────────────────────────────────────────────────────┤
│  POST /api/sessions → 创建 Session                   │
│  POST /api/sessions/{id}/versions → 创建版本         │
│  PATCH /api/sessions/{id}/versions/{versionId}      │
│       → 更新中文翻译/Video Prompt                     │
│  GET /api/sessions/{id}/versions → 加载版本列表       │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              Database (Supabase)                    │
├─────────────────────────────────────────────────────┤
│  generation_sessions                                │
│  ├─ id, creative_name, prompt, abcd_selection       │
│                                                     │
│  prompt_versions                                    │
│  ├─ id, session_id, version_number                  │
│  ├─ prompt, prompt_chinese, video_prompt            │
│  ├─ product_state, reference_image_url              │
│  ├─ created_from, refinement_instruction            │
│                                                     │
│  generated_images_v2                                │
│  ├─ id, session_id, prompt_version_id               │
│  ├─ storage_url, rating, aspect_ratio               │
└─────────────────────────────────────────────────────┘
```

### 4.2 架构优点

✅ **数据模型设计合理**
- `prompt_versions` 表支持版本历史追踪
- `generated_images_v2.prompt_version_id` 外键关联正确
- 支持 refinement_instruction 存储用户意图

✅ **云端同步 API 设计规范**
- RESTful 接口设计清晰
- 支持部分更新 (PATCH)
- 返回标准化的 APIResponse 格式

✅ **本地状态管理有序**
- 使用 TypeScript 强类型约束
- PromptVersion 接口包含 cloudId 字段用于映射

---

### 4.3 架构缺陷

❌ **双层存储缺乏一致性保证**
- localStorage 和 Cloud Storage 可能不同步
- 没有"Source of Truth"的明确定义
- 刷新页面时优先使用 localStorage，可能与云端数据冲突

❌ **Session 创建时机过晚**
- Session 在"首次点击 Generate Images"时才创建
- 导致 V1、Video Prompt 等数据无法及时同步
- 建议: 在"Preview Prompt"步骤就创建 Session (status: draft)

❌ **缺少离线支持策略**
- 如果网络断开，云端同步失败但无错误提示
- localStorage 数据可能与云端不一致
- 建议: 添加 synced 状态标记 + 重试队列

---

## 五、推荐修复方案

### 方案 A: 最小化修复（推荐优先执行）

**目标**: 修复数据丢失的关键缺陷，不改变现有架构

#### 修复项 1: V1 立即同步到云端
```typescript
// app/page.tsx Line 1048 后添加
if (currentSessionId) {
  syncVersionToCloud(currentSessionId, {
    prompt: generatedPrompt,
    prompt_chinese: "", // 翻译中，稍后更新
    video_prompt: "",
    product_state: productState,
    reference_image_url: referenceImageUrl,
    created_from: "initial",
  }, 1); // 传递 versionNumber = 1
}
```

#### 修复项 2: 提前创建 Session
```typescript
// app/page.tsx - 修改 handleGeneratePrompt()
const handleGeneratePrompt = async () => {
  // ... 生成 Prompt 逻辑 ...

  // 立即创建 Draft Session
  if (!currentSessionId) {
    const newSessionId = await createSession(0); // total_images = 0 表示 draft
    // 然后同步 V1 (参考修复项 1)
  }
}
```

#### 修复项 3: Product State 变化创建新版本
```typescript
// app/page.tsx Line 620 后添加
if (data.success) {
  const regeneratedPrompt = data.data.prompt;
  setPrompt(regeneratedPrompt);
  setEditedPrompt(regeneratedPrompt);

  // 创建新版本而非覆盖
  const newVersionNumber = createPromptVersion(regeneratedPrompt);
  translatePromptInBackground(regeneratedPrompt, newVersionNumber);

  // 同步到云端
  if (currentSessionId) {
    syncVersionToCloud(currentSessionId, {
      prompt: regeneratedPrompt,
      product_state: newState,
      reference_image_url: referenceImageUrl,
      created_from: "product_state_change",
    }, newVersionNumber);
  }
}
```

---

### 方案 B: 架构优化（长期改进）

**目标**: 建立可靠的数据一致性保证

#### 改进项 1: 使用云端作为 Source of Truth
```typescript
// 刷新页面时优先从云端加载
useEffect(() => {
  const lastSessionId = localStorage.getItem('lastActiveSessionId');
  if (lastSessionId) {
    handleSessionSelect({ id: lastSessionId }); // 触发云端加载
  } else {
    // 降级到 localStorage
  }
}, []);
```

#### 改进项 2: 添加同步状态标记
```typescript
interface PromptVersion {
  // ...
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  lastSyncAt?: string;
  syncError?: string;
}

// UI 显示同步状态
{version.syncStatus === 'syncing' && <Loader2 className="animate-spin" />}
{version.syncStatus === 'failed' && <AlertCircle className="text-red-500" />}
```

#### 改进项 3: 实现自动重试队列
```typescript
// 监听网络恢复后重新同步
window.addEventListener('online', () => {
  retryFailedSyncs();
});
```

---

## 六、验证结论

### 6.1 功能可用性评估

| 场景 | 当前状态 | 评分 | 备注 |
|------|---------|------|------|
| 场景1: 首次生成 | ⚠️ 部分可用 | 6/10 | V1 不会立即同步 |
| 场景2: Video Prompt | ❌ 有缺陷 | 4/10 | Prompt Preview 阶段不同步 |
| 场景3: 版本迭代 | ✅ 正常工作 | 9/10 | 逻辑完善 |
| 场景4: 刷新页面 | ⚠️ 依赖本地 | 5/10 | 不从云端重新加载 |
| 场景5: 换设备访问 | ⚠️ 需手动操作 | 6/10 | 需手动选择 Session |

**综合评分**: 6/10 (及格但有明显缺陷)

---

### 6.2 数据丢失风险矩阵

| 操作 | 风险场景 | 丢失数据 | 概率 | 影响 |
|------|---------|---------|------|------|
| 生成 V1 后刷新 | Session 未创建 | V1 Prompt + 中文翻译 | 高 | 中 |
| 生成 Video Prompt | Prompt Preview 阶段 | Video Prompt | 中 | 低 |
| 切换 Product State | 未创建版本 | 旧 Prompt | 高 | 高 |
| 清除浏览器缓存 | 依赖 localStorage | 所有未同步数据 | 低 | 高 |
| 换设备访问 | 未从云端加载 | 需手动恢复 | 中 | 中 |

---

### 6.3 推荐行动计划

**阶段 1: 紧急修复 (本周内)**
优先级: 🔴 高
- [ ] 修复缺陷 #1: V1 立即同步
- [ ] 修复缺陷 #2: Product State 变化创建新版本
- [ ] 修复缺陷 #3: Video Prompt 同步逻辑

**阶段 2: 稳定性增强 (下周)**
优先级: 🟡 中
- [ ] 实现 lastActiveSessionId 自动恢复
- [ ] 添加同步状态 UI 反馈
- [ ] 添加错误处理和用户提示

**阶段 3: 架构优化 (下个迭代)**
优先级: 🟢 低
- [ ] 实现离线支持
- [ ] 添加自动重试队列
- [ ] 性能优化: 减少不必要的云端同步

---

## 七、附录：关键代码路径

### A. 版本同步流程
- **创建版本**: `app/page.tsx:635-653` (createPromptVersion)
- **同步到云端**: `app/page.tsx:681-724` (syncVersionToCloud)
- **更新中文**: `app/page.tsx:754-794` (updateCloudVersionChinese)
- **更新 Video**: `app/page.tsx:797-837` (updateCloudVersionVideoPrompt)

### B. Session 管理
- **创建 Session**: `app/page.tsx:281-347` (createSession)
- **加载 Session**: `app/page.tsx:364-456` (handleSessionSelect)
- **从云端加载版本**: `app/page.tsx:727-751` (loadVersionsFromCloud)

### C. API 接口
- **版本列表**: `app/api/sessions/[id]/versions/route.ts:24-81` (GET)
- **创建版本**: `app/api/sessions/[id]/versions/route.ts:87-194` (POST)
- **更新版本**: `app/api/sessions/[id]/versions/[versionId]/route.ts:14-108` (PATCH)

---

**报告结束**

如需进一步分析或修复实施，请提供具体需求。
