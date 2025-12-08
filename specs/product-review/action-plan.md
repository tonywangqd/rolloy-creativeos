# Rolloy Creative OS - 紧急修复行动计划

**日期**: 2025-12-08
**目标**: 解决用户反馈的核心问题

---

## 问题诊断摘要

### 问题 1: Product State 切换后 Prompt 不更新 (P0 - 紧急)

**现象**:
用户在 Step 2/Step 3 手动切换 UNFOLDED/FOLDED 后，Prompt 保持不变，导致生成的图片与预期状态不符。

**根因**:
```typescript
// 问题代码：app/page.tsx Line 775-805
<button onClick={() => {
  setProductState("FOLDED");          // ✅ 状态更新
  setReferenceImageUrl(...);          // ✅ 图片更新
  // ❌ 缺失：没有重新生成 Prompt
}}>
```

**影响**:
- 用户浪费 API 配额（每次 4 张图片）
- 用户信任度下降
- 需要手动重新操作（2-3 分钟）

---

### 问题 2: "Beside" 动作映射验证 (P1 - 重要)

**现状**:
代码中 "beside" 已映射到 FOLDED，需验证：
1. 数据库 `actions` 表是否有 `product_state` 字段
2. 该字段值是否与代码逻辑一致

**验证 SQL**:
```sql
SELECT code, name_en, product_state
FROM actions
WHERE name_en LIKE '%Beside%' OR code LIKE '%BES%';
```

---

## 修复方案

### 方案 1: 前端自动重新生成 Prompt (推荐)

#### 实现步骤

**Step 1: 创建新函数**

```typescript
// app/page.tsx - 新增函数
const handleProductStateChange = async (newState: 'UNFOLDED' | 'FOLDED') => {
  // 1. 更新本地状态
  setProductState(newState);
  const newImageUrl = newState === 'UNFOLDED'
    ? process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || ""
    : process.env.NEXT_PUBLIC_FOLDED_IMAGE_URL || "";
  setReferenceImageUrl(newImageUrl);

  // 2. 显示 Loading
  setIsGeneratingPrompt(true);

  try {
    // 3. 重新生成 Prompt
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
        overrideProductState: newState,  // 强制使用新 State
      }),
    });

    const data = await response.json();

    if (data.success) {
      setPrompt(data.data.prompt);
      setEditedPrompt(data.data.prompt);

      // 4. 显示成功提示（可选）
      console.log(`Prompt updated for ${newState} state`);
    } else {
      setError(data.error?.message || "Failed to regenerate prompt");
    }
  } catch (err) {
    setError("Network error. Please try again.");
    console.error(err);
  } finally {
    setIsGeneratingPrompt(false);
  }
};
```

**Step 2: 修改按钮 onClick**

```typescript
// Step 2 的按钮 (Line 775-805)
<button
  type="button"
  onClick={() => handleProductStateChange("UNFOLDED")}
  disabled={isGeneratingPrompt}
  className={cn(
    "flex-1 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
    productState === "UNFOLDED"
      ? "border-primary bg-primary/10 text-primary"
      : "border-border hover:border-muted-foreground",
    isGeneratingPrompt && "opacity-50 cursor-not-allowed"
  )}
>
  {isGeneratingPrompt && productState === "UNFOLDED" ? (
    <Loader2 className="h-3 w-3 animate-spin mr-2" />
  ) : null}
  UNFOLDED（打开）
</button>

<button
  type="button"
  onClick={() => handleProductStateChange("FOLDED")}
  disabled={isGeneratingPrompt}
  className={cn(
    "flex-1 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
    productState === "FOLDED"
      ? "border-primary bg-primary/10 text-primary"
      : "border-border hover:border-muted-foreground",
    isGeneratingPrompt && "opacity-50 cursor-not-allowed"
  )}
>
  {isGeneratingPrompt && productState === "FOLDED" ? (
    <Loader2 className="h-3 w-3 animate-spin mr-2" />
  ) : null}
  FOLDED（折叠）
</button>
```

**Step 3: 同样修改 Step 3 的按钮 (Line 909-937)**

复用相同的 `handleProductStateChange` 函数。

---

#### 后端 API 修改

```typescript
// app/api/generate-prompt/route.ts
interface GeneratePromptRequest {
  selection: ABCDSelection;
  overrideProductState?: 'UNFOLDED' | 'FOLDED';  // 新增参数
}

export async function POST(request: NextRequest) {
  const body: GeneratePromptRequest = await request.json();
  const { selection, overrideProductState } = body;

  // 验证 selection
  if (!selection || !selection.A1 || !selection.A2 || !selection.B || !selection.C || !selection.D) {
    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INVALID_SELECTION',
          message: 'Invalid ABCD selection',
          details: 'All fields (A1, A2, B, C, D) are required',
        },
      },
      { status: 400 }
    );
  }

  // 如果有强制指定的 State，使用它；否则根据 Action 自动判断
  const productState = overrideProductState || determineProductState(selection.B);
  const referenceImageUrl = getReferenceImageUrl(productState);
  const creativeName = generateCreativeName(selection);

  console.log('Generating prompt for:', creativeName);
  console.log('Product State:', productState, overrideProductState ? '(overridden)' : '(auto-detected)');

  // ...后续逻辑不变
}
```

---

#### UX 增强（可选）

**增加提示文案**:

```tsx
// Step 2 - Product State Selector 下方
<div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
  {/* 现有的 Reference Image */}
  <div className="flex-1 space-y-2">
    <div className="flex items-center justify-between">
      <p className="font-medium">Product State</p>
      <span className="text-xs text-muted-foreground">
        切换状态将自动重新生成 Prompt（约 2-3 秒）
      </span>
    </div>
    {/* 现有的按钮 */}
  </div>
</div>

{/* Loading 提示 */}
{isGeneratingPrompt && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    正在为 {productState} 状态重新生成 Prompt...
  </div>
)}
```

---

### 方案 2: 数据库驱动的 Product State (长期优化)

如果数据库 `actions` 表缺少 `product_state` 字段，建议添加：

```sql
-- 1. 添加字段
ALTER TABLE actions
ADD COLUMN product_state TEXT CHECK (product_state IN ('UNFOLDED', 'FOLDED'));

-- 2. 填充数据（根据实际 actions 表内容调整）
UPDATE actions SET product_state = 'UNFOLDED'
WHERE code IN ('01-Walk', '02-Sit', '03-Turn', '04-Stand', '05-Rest');

UPDATE actions SET product_state = 'FOLDED'
WHERE code IN ('06-Lift', '07-Pack', '08-Carry', '09-Car-Trunk', '10-Beside');

-- 3. 设置非空约束
ALTER TABLE actions ALTER COLUMN product_state SET NOT NULL;
```

---

## 测试计划

### 单元测试

```typescript
// __tests__/product-state-switch.test.ts
describe('Product State Switch', () => {
  it('should regenerate prompt when switching to FOLDED', async () => {
    const { result } = renderHook(() => useProductState());

    await act(async () => {
      await result.current.handleProductStateChange('FOLDED');
    });

    expect(result.current.prompt).toContain('66cm');
    expect(result.current.prompt).toContain('compact');
  });

  it('should regenerate prompt when switching to UNFOLDED', async () => {
    const { result } = renderHook(() => useProductState());

    await act(async () => {
      await result.current.handleProductStateChange('UNFOLDED');
    });

    expect(result.current.prompt).toContain('waist-height');
  });
});
```

### 手动测试用例

| 测试场景 | 步骤 | 预期结果 |
|---------|------|----------|
| 切换 FOLDED | 1. 选择 ABCD<br>2. Preview Prompt<br>3. 切换到 FOLDED<br>4. 等待 2-3 秒 | Prompt 包含 "66cm", "compact", "knee-height" |
| 切换 UNFOLDED | 1. 在上一步基础上<br>2. 切换回 UNFOLDED | Prompt 包含 "waist-height", "senior's hands" |
| 禁用状态 | 1. 点击切换按钮<br>2. 在 Loading 期间再次点击 | 按钮禁用，无重复请求 |
| 错误处理 | 1. 断开网络<br>2. 切换 State | 显示错误提示，State 已更新但 Prompt 保持不变 |

---

## 部署检查清单

- [ ] 前端代码修改完成（app/page.tsx）
- [ ] 后端 API 修改完成（app/api/generate-prompt/route.ts）
- [ ] 验证数据库 actions.product_state 字段
- [ ] 单元测试通过
- [ ] 手动测试所有场景通过
- [ ] 性能测试（Prompt 重新生成不超过 3 秒）
- [ ] 错误处理完善（网络异常、API 失败）
- [ ] 更新用户文档

---

## 回滚计划

如果新功能导致问题，回滚步骤：

1. **前端回滚**:
```bash
git revert <commit-hash>
git push origin main
```

2. **API 回滚**:
移除 `overrideProductState` 参数，恢复原逻辑。

3. **数据库回滚**（如有修改）:
```sql
ALTER TABLE actions DROP COLUMN IF EXISTS product_state;
```

---

## 时间估算

| 任务 | 工作量 | 负责人 |
|-----|-------|--------|
| 前端修改 | 3 小时 | 前端工程师 |
| 后端 API 修改 | 1 小时 | 后端工程师 |
| 测试编写 | 2 小时 | QA |
| 手动测试 | 2 小时 | QA + 产品 |
| 代码审查 | 1 小时 | Tech Lead |
| 部署 | 0.5 小时 | DevOps |
| **总计** | **9.5 小时 ≈ 1.5 个工作日** | - |

---

## 成功标准

1. ✅ 用户切换 Product State 后，Prompt 自动更新
2. ✅ 新 Prompt 包含正确的 State-specific 描述
3. ✅ Loading 状态清晰，不超过 3 秒
4. ✅ 错误处理完善，不影响现有功能
5. ✅ 所有现有测试通过

---

## 下一步

完成此修复后，进入 Phase 2（功能增强）：
1. Prompt 历史版本管理
2. Batch Settings 批量设置
3. 实时 Prompt 差异对比

---

**文档版本**: 1.0
**创建日期**: 2025-12-08
**预计完成**: 2025-12-10
