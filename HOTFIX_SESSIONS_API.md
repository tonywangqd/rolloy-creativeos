# Sessions API Walker 兼容性紧急修复

**优先级:** P0 - CRITICAL BLOCKER
**预计修复时间:** 2 小时
**影响范围:** Walker 创意工作台无法使用云端功能

---

## 问题描述

Sessions API 硬编码了 Rollator 的产品状态验证 (FOLDED/UNFOLDED)，导致 Walker 的状态 (IN_USE/STORED) 被拒绝。

**错误消息:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid product_state: must be FOLDED or UNFOLDED"
  }
}
```

---

## 修复方案

### 方案 A: 添加产品类型支持 (推荐)

**优点:**
- 数据结构清晰
- 支持未来扩展 (如其他产品类型)
- 类型安全

**缺点:**
- 需要修改数据库模式
- 需要更新现有记录

**实现步骤:**

#### 1. 修改 TypeScript 类型定义

**文件:** `/lib/types/session.ts`

```typescript
// 修改前
export interface GenerationSession {
  // ...
  product_state: 'FOLDED' | 'UNFOLDED';
  // ...
}

export interface CreateSessionRequest {
  // ...
  product_state: 'FOLDED' | 'UNFOLDED';
  // ...
}

// 修改后
export type ProductType = 'rollator' | 'walker';
export type ProductState = 'FOLDED' | 'UNFOLDED' | 'IN_USE' | 'STORED';

export interface GenerationSession {
  // ...
  product_type: ProductType;
  product_state: ProductState;
  // ...
}

export interface CreateSessionRequest {
  // ...
  product_type?: ProductType;  // 可选，默认 'rollator'
  product_state: ProductState;
  // ...
}
```

#### 2. 修改 API 验证逻辑

**文件:** `/app/api/sessions/route.ts`

```typescript
// 修改前 (第 64-75 行)
if (product_state !== 'FOLDED' && product_state !== 'UNFOLDED') {
  return NextResponse.json<APIResponse>(
    {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid product_state: must be FOLDED or UNFOLDED',
      },
    },
    { status: 400 }
  );
}

// 修改后
const { product_type = 'rollator' } = body;  // 默认为 rollator

// 定义每种产品类型的有效状态
const validStates: Record<string, string[]> = {
  rollator: ['FOLDED', 'UNFOLDED'],
  walker: ['IN_USE', 'STORED'],
};

// 验证产品类型
if (!validStates[product_type]) {
  return NextResponse.json<APIResponse>(
    {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: `Invalid product_type: must be one of ${Object.keys(validStates).join(', ')}`,
      },
    },
    { status: 400 }
  );
}

// 验证产品状态
if (!validStates[product_type].includes(product_state)) {
  return NextResponse.json<APIResponse>(
    {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: `Invalid product_state for ${product_type}: must be one of ${validStates[product_type].join(', ')}`,
      },
    },
    { status: 400 }
  );
}
```

#### 3. 更新数据库模式

**文件:** 创建新的 migration SQL 文件

```sql
-- 文件: supabase/migrations/20251223_add_product_type.sql

-- 添加 product_type 字段
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'rollator';

-- 更新现有记录 (所有现有记录都是 rollator)
UPDATE sessions SET product_type = 'rollator' WHERE product_type IS NULL;

-- 将 product_type 设置为非空
ALTER TABLE sessions
ALTER COLUMN product_type SET NOT NULL;

-- 移除旧的约束 (如果存在)
ALTER TABLE sessions
DROP CONSTRAINT IF EXISTS sessions_product_state_check;

-- 添加新的联合约束
ALTER TABLE sessions
ADD CONSTRAINT sessions_product_state_check
CHECK (
  (product_type = 'rollator' AND product_state IN ('FOLDED', 'UNFOLDED')) OR
  (product_type = 'walker' AND product_state IN ('IN_USE', 'STORED'))
);

-- 添加索引以支持按产品类型查询
CREATE INDEX IF NOT EXISTS idx_sessions_product_type ON sessions(product_type);

-- 创建视图以便分别查询 Rollator 和 Walker Sessions
CREATE OR REPLACE VIEW rollator_sessions AS
SELECT * FROM sessions WHERE product_type = 'rollator';

CREATE OR REPLACE VIEW walker_sessions AS
SELECT * FROM sessions WHERE product_type = 'walker';

-- 添加注释
COMMENT ON COLUMN sessions.product_type IS 'Product type: rollator (4-wheel) or walker (2-wheel)';
COMMENT ON CONSTRAINT sessions_product_state_check ON sessions IS 'Validate product_state based on product_type';
```

#### 4. 更新 Session Service

**文件:** `/lib/services/session-service.ts`

```typescript
// 添加 product_type 到插入逻辑
export async function createSession(data: CreateSessionRequest): Promise<CreateSessionResponse> {
  const supabase = createClient();

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      creative_name: data.creative_name,
      description: data.description,
      abcd_selection: data.abcd_selection,
      prompt: data.prompt,
      product_type: data.product_type || 'rollator',  // 新增
      product_state: data.product_state,
      reference_image_url: data.reference_image_url,
      total_images: data.total_images || 20,
      strength: data.strength || 0.75,
      seed: data.seed,
      status: 'draft',
      // ...
    })
    .select()
    .single();

  // ...
}
```

#### 5. 更新 Walker 页面调用

**文件:** `/app/walker/page.tsx`

```typescript
// 修改 createSession 调用 (如果 Walker 实现了此功能)
const response = await fetch("/api/sessions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    creative_name: sessionName,
    product_type: "walker",  // 新增
    abcd_selection: { ... },
    prompt: sessionPrompt,
    product_state: walkerState,  // IN_USE 或 STORED
    reference_image_url: referenceImageUrl,
    total_images: totalImages,
  }),
});
```

---

### 方案 B: 移除状态验证 (快速修复)

**优点:**
- 实现简单，立即生效
- 无需修改数据库

**缺点:**
- 无类型安全
- 允许任意字符串 (可能导致数据污染)

**实现步骤:**

#### 1. 修改 API 验证逻辑

**文件:** `/app/api/sessions/route.ts`

```typescript
// 修改前 (第 64-75 行)
if (product_state !== 'FOLDED' && product_state !== 'UNFOLDED') {
  return NextResponse.json<APIResponse>(
    {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid product_state: must be FOLDED or UNFOLDED',
      },
    },
    { status: 400 }
  );
}

// 修改后 (简化验证)
if (!product_state || typeof product_state !== 'string' || product_state.trim() === '') {
  return NextResponse.json<APIResponse>(
    {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid product_state: must be a non-empty string',
      },
    },
    { status: 400 }
  );
}

// 可选: 添加日志以监控异常状态值
const knownStates = ['FOLDED', 'UNFOLDED', 'IN_USE', 'STORED'];
if (!knownStates.includes(product_state)) {
  console.warn(`[Sessions API] Unknown product_state: ${product_state}`);
}
```

#### 2. 修改 TypeScript 类型定义

**文件:** `/lib/types/session.ts`

```typescript
// 修改前
export interface GenerationSession {
  // ...
  product_state: 'FOLDED' | 'UNFOLDED';
  // ...
}

// 修改后 (使用泛型字符串)
export interface GenerationSession {
  // ...
  product_state: string;  // 'FOLDED' | 'UNFOLDED' | 'IN_USE' | 'STORED' | ...
  // ...
}
```

---

## 测试验证

### 1. 运行自动化测试脚本

```bash
# 确保开发服务器运行在 localhost:3000
npm run dev

# 在新终端运行测试
./test-walker-api-compatibility.sh
```

**预期结果:**
- 测试 1 (IN_USE): ✅ PASS
- 测试 2 (STORED): ✅ PASS
- 测试 3 (FOLDED): ✅ PASS
- 测试 4 (Walker Prompt API): ✅ PASS

---

### 2. 手动测试

#### 测试 Walker Session 创建

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Walker Test",
    "product_type": "walker",
    "abcd_selection": {
      "A1": "outdoor",
      "A2": "park",
      "B": "walking",
      "C": "independence",
      "D": "carousel"
    },
    "prompt": "A senior man with a walker",
    "product_state": "IN_USE",
    "reference_image_url": "https://example.com/walker.jpg",
    "total_images": 20
  }'
```

**预期响应 (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid-here",
      "creative_name": "Walker Test",
      "product_type": "walker",
      "product_state": "IN_USE",
      "status": "draft",
      ...
    },
    "images": [...]
  }
}
```

---

#### 测试 Rollator Session 仍然有效

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "creative_name": "Rollator Test",
    "product_type": "rollator",
    "abcd_selection": {
      "A1": "indoor",
      "A2": "home",
      "B": "standing_still",
      "C": "convenience",
      "D": "single_image"
    },
    "prompt": "A folded rollator",
    "product_state": "FOLDED",
    "reference_image_url": "https://example.com/rollator.jpg",
    "total_images": 20
  }'
```

**预期响应 (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid-here",
      "creative_name": "Rollator Test",
      "product_type": "rollator",
      "product_state": "FOLDED",
      "status": "draft",
      ...
    },
    "images": [...]
  }
}
```

---

## 部署步骤

### 1. 方案 A (推荐)

```bash
# 1. 创建并运行数据库迁移
supabase db push

# 或者手动执行 SQL
psql $DATABASE_URL -f supabase/migrations/20251223_add_product_type.sql

# 2. 提交代码
git add .
git commit -m "fix: 添加 product_type 支持 Walker 状态 (v3.41.0)"

# 3. 推送到 GitHub
git push origin main

# 4. 部署到 Vercel (自动触发)
# 或手动触发: vercel --prod
```

---

### 2. 方案 B (快速修复)

```bash
# 1. 提交代码 (无需数据库迁移)
git add app/api/sessions/route.ts lib/types/session.ts
git commit -m "fix: 移除 product_state 硬编码验证，支持 Walker (v3.41.0)"

# 2. 推送到 GitHub
git push origin main

# 3. 部署到 Vercel
```

---

## 回滚方案

如果修复导致问题，可以快速回滚：

### 方案 A 回滚

```sql
-- 1. 移除 product_type 字段
ALTER TABLE sessions DROP COLUMN IF EXISTS product_type;

-- 2. 恢复旧约束
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_product_state_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_product_state_check
CHECK (product_state IN ('FOLDED', 'UNFOLDED'));
```

```bash
# 3. 回滚代码
git revert HEAD
git push origin main
```

---

### 方案 B 回滚

```bash
# 直接回滚代码
git revert HEAD
git push origin main
```

---

## 影响评估

### 修复后可用功能

- ✅ Walker 可以创建 Session
- ✅ Walker 可以保存 Prompt 版本到云端
- ✅ Walker 可以加载历史 Session
- ✅ Rollator 功能不受影响

### 仍然缺失的功能

- ❌ Walker 图片生成 (需单独实现)
- ❌ Walker Session 列表 UI (需单独实现)
- ❌ Walker 版本历史 UI (需单独实现)

---

## 下一步工作

修复此问题后，按以下优先级继续开发：

1. **Walker Session 管理 UI** (3-5 天)
   - 实现 Session 列表
   - 实现 Session 加载
   - 实现 Session 删除

2. **Walker Prompt 版本云同步** (2-3 天)
   - 实现 syncVersionToCloud
   - 实现 loadVersionsFromCloud
   - 实现版本切换 UI

3. **Walker 图片生成** (1-2 周)
   - 复用 Rollator 图片生成逻辑
   - 实现图片管理 UI
   - 实现图片云存储上传

---

## 相关文档

- `/Users/tony/rolloy-creativeos/QA_EXECUTIVE_SUMMARY.md` - 总体 QA 报告
- `/Users/tony/rolloy-creativeos/QA_WALKER_FEATURE_COMPARISON.md` - 功能对比详情
- `/Users/tony/rolloy-creativeos/QA_SECURITY_AND_EDGE_CASES.md` - 安全性测试
- `/Users/tony/rolloy-creativeos/test-walker-api-compatibility.sh` - 测试脚本

---

**作者:** Claude (QA Engineer)
**日期:** 2025-12-23
**状态:** 待实施
