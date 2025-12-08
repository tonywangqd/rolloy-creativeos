# Rolloy Creative OS - 问题汇总与解答

**评审日期**: 2025-12-08

---

## 用户反馈的问题分析

### 1. Product State 变更后 Prompt 不更新

#### 问题描述
当用户在 Step 3 手动切换 FOLDED/UNFOLDED 时，当前的 Prompt 是基于原来状态生成的，没有更新。

#### 问题严重性
**P0 - 关键缺陷**

#### 根因分析

**数据流断裂点**:
```
用户点击切换按钮
    ↓
productState 更新 ✅
referenceImageUrl 更新 ✅
    ↓
❌ editedPrompt 保持不变（问题所在）
    ↓
生成图片时使用旧 Prompt
    ↓
生成结果与用户预期不符
```

**问题代码位置**:
- 文件: `/Users/tony/rolloy-creativeos/app/page.tsx`
- 行号: Line 775-805 (Step 2) 和 Line 909-937 (Step 3)

**当前逻辑**:
```typescript
<button onClick={() => {
  setProductState("FOLDED");       // ✅ 更新状态
  setReferenceImageUrl(...);       // ✅ 更新图片
  // ❌ 缺失：没有重新生成 Prompt
}}>
```

#### 解决方案

**推荐方案**: 前端自动触发 Prompt 重新生成

**实现要点**:
1. 创建 `handleProductStateChange` 函数
2. 调用 `/api/generate-prompt` API 并传递 `overrideProductState` 参数
3. 更新 `editedPrompt` 为新生成的 Prompt
4. 增加 Loading 状态反馈

**预计工作量**: 3 小时（前端） + 1 小时（后端）

**详细方案**: 参见 `/Users/tony/rolloy-creativeos/specs/product-review/action-plan.md`

---

### 2. Action 关键词映射问题

#### 问题描述
用户反馈："Beside" 这个动作应该对应 FOLDED（折叠）状态，但目前可能映射错误。

#### 问题严重性
**P1 - 重要** （经验证，当前映射逻辑正确）

#### 验证结果

**当前映射逻辑** (`lib/services/gemini-service.ts` Line 97):
```typescript
const FOLDED_ACTIONS = [
  'lift', 'pack', 'carry', 'trunk', 'car-trunk',
  'store', 'transport', 'fold',
  'beside',  // ✅ 已包含
  'place', 'lean', 'hold'
];
```

**语义分析**:
- "Beside" 的业务含义: 产品放在用户旁边（靠近、放置在一旁）
- 典型场景:
  - ✅ FOLDED: 折叠后的推车靠墙放置、放在汽车后座旁边
  - ❌ UNFOLDED: 打开的推车不太可能用"靠近"描述（更多是"使用中"）

**结论**: 当前映射 **正确** ✅

#### 待验证事项

需要检查数据库 `actions` 表是否有明确的 `product_state` 字段：

```sql
-- 验证 SQL
SELECT code, name_en, name_zh, product_state
FROM actions
WHERE name_en LIKE '%Beside%' OR code LIKE '%BES%';
```

**如果字段缺失**, 建议添加该字段以实现数据驱动的映射逻辑（详见行动计划）。

---

### 3. 刷新后图片状态丢失

#### 问题描述
早期版本中，刷新页面后图片状态丢失。

#### 问题严重性
**P2 - 已修复** ✅

#### 解决方案

**当前实现**: 通过会话系统完全解决
- 图片保存到 Supabase Storage（`/Users/tony/rolloy-creativeos/lib/supabase/client.ts`）
- 会话元数据存储在数据库 `creative_projects` 表
- 刷新后自动从数据库加载历史会话

**代码位置**:
```typescript
// app/page.tsx (Line 167-220)
const handleSessionSelect = async (session: SessionSummary) => {
  const sessionDetail = await fetch(`/api/sessions/${session.id}`);
  setEditedPrompt(sessionDetail.prompt);
  setProductState(sessionDetail.product_state); // ✅ 状态持久化
  setImages(sessionDetail.images.map(...));     // ✅ 图片恢复
}
```

**验证结果**: ✅ 已通过测试，刷新后数据完整恢复

---

### 4. 某些按钮响应慢

#### 问题描述
用户反馈某些按钮点击后响应慢。

#### 问题严重性
**P2 - 体验优化**

#### 分析结果

**前端优化状态**: ✅ 已实施
```typescript
// app/page.tsx 已使用性能优化
const handleGenerateBatch = useCallback(async () => {...}, [...]);
const toggleImageSelection = useCallback((id: string) => {...}, []);
const handleRatingChange = useCallback((id: string, rating: number) => {...}, []);
```

**可能原因**:
1. **API 调用延迟**: Gemini/Flux API 响应时间不稳定
2. **大列表渲染**: 图片数量 > 100 时可能卡顿
3. **Loading 反馈不明显**: 用户不清楚操作是否成功

#### 建议优化

1. **增加更明显的 Loading 状态**:
```tsx
{isGeneratingImages && (
  <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-3 rounded-lg shadow-lg">
    <Loader2 className="animate-spin mr-2" />
    生成中... ({currentImageIndex + 1}/{images.length})
  </div>
)}
```

2. **虚拟化列表**（图片 > 50 张时）:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
// 详见完整评审报告
```

3. **API 响应时间监控**:
```typescript
const startTime = Date.now();
await fetch('/api/generate-prompt');
const duration = Date.now() - startTime;
if (duration > 3000) {
  console.warn('Slow API response:', duration);
}
```

---

## 产品流程评估

### 当前用户流程是否合理？

**总体评价**: ✅ 合理，但需优化

#### 优势
1. ✅ **三步法清晰**: Select → Review → Generate
2. ✅ **会话系统完善**: 支持暂停/恢复/继续生成
3. ✅ **ABCD 框架降低门槛**: 非专业用户也能快速上手
4. ✅ **并行生成高效**: 4 张/批次，1 秒延迟，性能优秀

#### 可优化点
1. ⚠️ **State 切换后需手动操作**: 用户需要重新点击生成
2. ⚠️ **Prompt 编辑自由度有限**: 缺少版本历史和模板
3. ⚠️ **批量设置不支持**: 无法为不同批次设置不同分辨率

---

### Product State 切换后应该如何处理 Prompt？

**推荐策略**: **自动重新生成 + 用户确认**

#### 方案 A: 自动重新生成（推荐）
```
用户点击 [FOLDED] 按钮
    ↓
系统自动调用 /api/generate-prompt
    ↓
显示 Loading（2-3 秒）
    ↓
Prompt 更新为新的 FOLDED 描述
    ↓
用户可编辑或直接生成
```

**优势**:
- ✅ 符合用户预期
- ✅ 减少操作步骤
- ✅ 避免错误生成

#### 方案 B: 手动重新生成（不推荐）
```
用户点击 [FOLDED] 按钮
    ↓
显示提示："状态已切换，请点击 '重新生成 Prompt' 按钮"
    ↓
用户手动点击按钮
    ↓
Prompt 更新
```

**劣势**:
- ❌ 增加操作步骤
- ❌ 用户容易忘记
- ❌ 体验不流畅

---

### ABCD 到 Product State 的映射逻辑是否需要调整？

**结论**: ✅ 当前逻辑合理，但需数据库增强

#### 当前映射规则

| Action 类型 | Product State | 关键词 |
|------------|--------------|--------|
| 使用中动作 | UNFOLDED | walk, sit, turn, stand, rest |
| 存储动作 | FOLDED | lift, pack, carry, car-trunk, beside |

#### 语义验证结果

| Action | 当前 State | 合理性 | 典型场景 |
|--------|-----------|-------|---------|
| Walk | UNFOLDED | ✅ | 老人推着推车行走 |
| Sit | UNFOLDED | ✅ | 老人坐在推车座位上 |
| **Beside** | **FOLDED** | ✅ | 折叠后靠墙放置 |
| Lift | FOLDED | ✅ | 单手抬起折叠推车 |
| Car-Trunk | FOLDED | ✅ | 放入汽车后备箱 |

#### 建议调整

**短期**: 保持现有硬编码逻辑 ✅

**长期**: 迁移到数据库驱动
```sql
ALTER TABLE actions ADD COLUMN product_state TEXT;
-- 运营团队可直接在数据库管理映射关系
```

---

## 功能改进建议优先级

### P0 级别（必须立即修复）

1. **Product State 切换自动重新生成 Prompt**
   - 工作量: 4 小时
   - 业务价值: 避免用户生成错误图片
   - 实施时间: 本周内

---

### P1 级别（重要优化）

2. **数据库 Actions 表增加 `product_state` 字段**
   - 工作量: 2 小时
   - 业务价值: 数据驱动，便于运营调整
   - 实施时间: 下周

3. **Prompt 版本历史管理**
   - 工作量: 3 天
   - 业务价值: 用户可回退到原始 Prompt
   - 实施时间: Sprint 2

---

### P2 级别（体验增强）

4. **批量设置管理（Batch Settings）**
   - 工作量: 3 天
   - 业务价值: 支持不同批次不同分辨率
   - 实施时间: Sprint 2

5. **实时 Prompt 差异对比**
   - 工作量: 2 天
   - 业务价值: 直观看到 State 切换带来的变化
   - 实施时间: Sprint 3

---

### P3 级别（高级功能）

6. **A/B Test 对比视图**
   - 工作量: 5 天
   - 业务价值: 评估不同 State 的效果
   - 实施时间: Sprint 4

7. **智能推荐系统**
   - 工作量: 7 天
   - 业务价值: 基于历史数据推荐最佳 ABCD 组合
   - 实施时间: Sprint 5

---

## 下一步行动

### 本周任务（2025-12-09 ~ 2025-12-13）

#### 前端团队
- [ ] 实现 `handleProductStateChange` 函数
- [ ] 增加 Prompt 重新生成 Loading 状态
- [ ] 修改 Step 2 和 Step 3 的按钮点击逻辑
- [ ] 编写单元测试

#### 后端团队
- [ ] 修改 `/api/generate-prompt` 支持 `overrideProductState` 参数
- [ ] 验证数据库 `actions.product_state` 字段
- [ ] 如缺失，编写数据库迁移脚本

#### QA 团队
- [ ] 编写测试用例
- [ ] 执行手动测试（所有 ABCD 组合）
- [ ] 验证 "Beside" 动作映射正确性
- [ ] 回归测试现有功能

#### 产品团队
- [ ] 确认 "Beside" 的业务语义
- [ ] 更新用户手册
- [ ] 准备 Phase 2 功能需求

---

## 相关文档

1. **完整评审报告**: `/Users/tony/rolloy-creativeos/specs/product-review/comprehensive-review.md`
2. **行动计划**: `/Users/tony/rolloy-creativeos/specs/product-review/action-plan.md`
3. **代码位置**:
   - 主页面: `/Users/tony/rolloy-creativeos/app/page.tsx`
   - Gemini 服务: `/Users/tony/rolloy-creativeos/lib/services/gemini-service.ts`
   - Prompt API: `/Users/tony/rolloy-creativeos/app/api/generate-prompt/route.ts`

---

**文档版本**: 1.0
**创建日期**: 2025-12-08
