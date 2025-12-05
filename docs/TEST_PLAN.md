# Rolloy Creative OS - 测试计划 & 安全审计方案

## 文档元数据
- **项目**: Rolloy Creative OS
- **版本**: 1.0.0
- **QA 负责人**: Director of Quality Assurance
- **创建日期**: 2025-12-05
- **状态**: ACTIVE

---

## 1. 项目概述

### 1.1 系统简介
Rolloy Creative OS 是一个内部 Web 应用，用于 DTC 助行器品牌的广告素材生产流程管理。

### 1.2 技术栈审计
| 组件 | 技术 | 版本要求 | 安全级别 |
|------|------|----------|----------|
| 前端框架 | Next.js | 14+ | HIGH |
| 数据库 | Supabase | Cloud | HIGH |
| 认证 | NextAuth.js | 4+ | CRITICAL |
| AI 提示词 | Gemini API | 1.5 Pro | MEDIUM |
| 图片生成 | Flux/Nano Banana API | Latest | MEDIUM |
| 测试框架 | Jest + React Testing Library | - | - |

### 1.3 核心功能模块
1. ABCD 参数选择器（二级联动）
2. 命名生成服务
3. 状态路由逻辑
4. AI 图片生成集成
5. CSV 解析引擎
6. 分析仪表盘

---

## 2. 功能测试用例

### 2.1 ABCD 参数选择器

#### 测试用例 TC-001: A1 选择器加载
**优先级**: P0 (Blocker)
```
前置条件: 用户已登录
步骤:
1. 访问素材创建页面
2. 观察 A1 选择器状态
预期结果:
- A1 选择器显示所有可用选项（Product, Scene, Audience）
- 选择器默认无选中状态
- UI 响应时间 < 100ms
```

#### 测试用例 TC-002: A1-A2 级联联动
**优先级**: P0
```
前置条件: A1 选择器已加载
步骤:
1. 选择 A1 = "Product"
2. 观察 A2 选择器变化
3. 选择 A2 = "Unboxing"
4. 修改 A1 = "Scene"
预期结果:
- A2 选项根据 A1 动态更新
- A2 在 A1 变化时重置为空
- 联动延迟 < 50ms
边界情况:
- A1 = null 时 A2 禁用
- 快速切换 A1 时无竞态条件
```

#### 测试用例 TC-003: B 动作选择 - 状态路由
**优先级**: P0
```
前置条件: A1, A2 已选择
步骤:
1. 选择 B = "Walk"
2. 验证展开/折叠状态 = UNFOLDED
3. 选择 B = "Lift"
4. 验证展开/折叠状态 = FOLDED
测试数据:
UNFOLDED 组: ["Walk", "Sit", "Turn", "Stand", "Rest"]
FOLDED 组: ["Lift", "Pack", "Carry", "Trunk"]
预期结果:
- 状态自动路由正确
- 参考图选择器显示对应类型图片
- 状态变化无闪烁
```

#### 测试用例 TC-004: C 场景和 D 编码选择
**优先级**: P1
```
步骤:
1. 选择 C = "Indoor"
2. 选择 D = "D001"
3. 验证所有参数完整性
预期结果:
- C 选项包含: Indoor, Outdoor, Studio, Lifestyle
- D 编码格式: D[0-9]{3}
- 提交按钮在所有参数完整时启用
```

### 2.2 命名生成服务

#### 测试用例 TC-010: 标准命名格式生成
**优先级**: P0
```
输入:
{
  date: "2025-12-05",
  A1: "Product",
  A2: "Unboxing",
  B: "Walk",
  C: "Indoor",
  D: "D001"
}
预期输出:
"20251205_Product_Unboxing_Walk_Indoor_D001"

边界情况:
- date 为 null -> 使用当前日期
- 参数包含空格 -> 自动移除
- 参数包含特殊字符 -> 替换为下划线
```

#### 测试用例 TC-011: 批量命名生成
**优先级**: P1
```
输入: 20 个参数组合
预期:
- 生成 20 个唯一名称
- 处理时间 < 500ms
- 无重复命名
```

### 2.3 状态路由逻辑

#### 测试用例 TC-020: 展开/折叠状态判定
**优先级**: P0
```javascript
// 测试矩阵
const testCases = [
  { B: "Walk", expectedState: "UNFOLDED" },
  { B: "Sit", expectedState: "UNFOLDED" },
  { B: "Turn", expectedState: "UNFOLDED" },
  { B: "Stand", expectedState: "UNFOLDED" },
  { B: "Rest", expectedState: "UNFOLDED" },
  { B: "Lift", expectedState: "FOLDED" },
  { B: "Pack", expectedState: "FOLDED" },
  { B: "Carry", expectedState: "FOLDED" },
  { B: "Trunk", expectedState: "FOLDED" },
];

验证:
- 每个 B 值对应状态正确
- 未知 B 值抛出错误（新增动作类型未配置）
```

#### 测试用例 TC-021: 参考图过滤
**优先级**: P0
```
前置条件: 状态 = UNFOLDED
步骤:
1. 加载参考图库
2. 验证仅显示展开状态的图片
预期:
- 图片标签包含 "unfolded" 或 "expanded"
- 折叠状态图片不可见
- 图片数量 > 0
```

### 2.4 AI 图片生成集成

#### 测试用例 TC-030: Gemini API 提示词生成
**优先级**: P0
```
输入:
{
  A1: "Scene",
  A2: "Lifestyle",
  B: "Walk",
  C: "Outdoor",
  D: "D002",
  referenceImage: "ref_001.jpg"
}

预期输出示例:
"Create a lifestyle scene showing a senior using a walker
in an outdoor setting. Action: walking. Style: natural
lighting, realistic photography. Reference: [attached]"

验证:
- 提示词包含所有 ABCD 参数
- 提示词长度 < 2000 字符
- 无敏感词（暴力、政治等）
```

#### 测试用例 TC-031: Flux API 错误处理
**优先级**: P0
```
模拟场景:
1. API 超时（30s）
2. API 返回 429 (Rate Limit)
3. API 返回 500 (Server Error)
4. 网络断开

预期行为:
- 超时: 显示重试提示，最多重试 3 次
- 429: 等待 60s 后自动重试
- 500: 记录错误日志，提示用户联系支持
- 网络断开: 显示离线提示，队列保存本地
```

#### 测试用例 TC-032: 批量生成（20张）
**优先级**: P1
```
步骤:
1. 提交 20 个生成任务
2. 监控进度条
3. 验证完成状态

验证:
- 并发请求数 <= 5（避免 API 限流）
- 单个任务失败不影响其他任务
- 总耗时 < 5 分钟
- 生成图片分辨率: 1024x1024
- 文件大小: 200KB - 2MB
```

### 2.5 CSV 解析引擎

#### 测试用例 TC-040: Ad Name 标签提取
**优先级**: P0
```
输入 CSV:
Ad Name: "20251205_Product_Unboxing_Walk_Indoor_D001"
Spend: 1500
CPA: 25.50
ROAS: 3.2

预期解析结果:
{
  date: "2025-12-05",
  A1: "Product",
  A2: "Unboxing",
  B: "Walk",
  C: "Indoor",
  D: "D001",
  metrics: { spend: 1500, cpa: 25.5, roas: 3.2 }
}

边界情况:
- 命名格式不标准 -> 标记为 "PARSE_ERROR"
- 缺少下划线分隔符 -> 尝试智能分割
- 包含特殊字符 -> 清理后解析
```

#### 测试用例 TC-041: 批量 CSV 导入
**优先级**: P1
```
输入: 1000 行 CSV 文件
验证:
- 解析成功率 > 95%
- 处理时间 < 3s
- 重复记录自动去重
- 数据类型验证（数字字段不包含文本）
```

### 2.6 分析仪表盘

#### 测试用例 TC-050: CPA/ROAS 聚合计算
**优先级**: P0
```
输入数据:
[
  { A1: "Product", spend: 1000, conversions: 50 },
  { A1: "Product", spend: 2000, conversions: 100 },
  { A1: "Scene", spend: 1500, conversions: 60 }
]

预期聚合:
{
  "Product": { totalSpend: 3000, totalConversions: 150, avgCPA: 20 },
  "Scene": { totalSpend: 1500, totalConversions: 60, avgCPA: 25 }
}

验证:
- 计算精度: 小数点后 2 位
- 除零错误处理
- 空数据集显示 "无数据"
```

#### 测试用例 TC-051: 实时数据刷新
**优先级**: P1
```
步骤:
1. 加载仪表盘
2. 在 30s 内添加新记录
3. 点击刷新按钮
预期:
- 新数据显示在图表中
- 刷新无页面重载
- 加载动画显示
```

---

## 3. 集成测试方案

### 3.1 API 集成测试

#### 测试套件: Gemini API Integration
```typescript
describe('Gemini API Integration', () => {
  test('应成功生成提示词', async () => {
    const response = await geminiService.generatePrompt({
      A1: 'Product', A2: 'Unboxing', B: 'Walk', C: 'Indoor', D: 'D001'
    });
    expect(response).toContain('walker');
    expect(response).toContain('Unboxing');
  });

  test('应处理 API 错误', async () => {
    mockGeminiAPI.mockRejectedValue(new Error('Timeout'));
    await expect(geminiService.generatePrompt({}))
      .rejects.toThrow('Gemini API 请求失败');
  });

  test('应实现重试机制', async () => {
    mockGeminiAPI
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce('Success');
    const result = await geminiService.generatePrompt({});
    expect(mockGeminiAPI).toHaveBeenCalledTimes(2);
  });
});
```

#### 测试套件: Flux API Integration
```typescript
describe('Flux API Integration', () => {
  test('应成功生成单张图片', async () => {
    const result = await fluxService.generateImage({
      prompt: 'Test prompt',
      referenceImage: 'base64...'
    });
    expect(result.imageUrl).toMatch(/^https:\/\//);
    expect(result.status).toBe('success');
  });

  test('应处理速率限制', async () => {
    mockFluxAPI.mockRejectedValue({ status: 429 });
    const result = await fluxService.generateImage({});
    expect(result.status).toBe('rate_limited');
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test('批量生成应控制并发', async () => {
    const tasks = Array(20).fill({ prompt: 'Test' });
    const startTime = Date.now();
    await fluxService.batchGenerate(tasks);
    const duration = Date.now() - startTime;

    // 20 个任务，最大并发 5，每个任务 2s
    // 预期: 4 批次 * 2s = 8s (允许 ±2s 误差)
    expect(duration).toBeGreaterThan(6000);
    expect(duration).toBeLessThan(10000);
  });
});
```

### 3.2 端到端测试（E2E）

#### E2E-001: 完整素材创建流程
```typescript
// 使用 Playwright/Cypress
test('用户应能完成完整素材创建', async ({ page }) => {
  // 1. 登录
  await page.goto('/login');
  await page.fill('[name=email]', 'test@rolloy.com');
  await page.fill('[name=password]', 'test123');
  await page.click('button[type=submit]');

  // 2. 创建素材
  await page.goto('/creative/new');
  await page.selectOption('[name=A1]', 'Product');
  await page.selectOption('[name=A2]', 'Unboxing');
  await page.selectOption('[name=B]', 'Walk');

  // 3. 验证命名预览
  const namePreview = await page.textContent('.name-preview');
  expect(namePreview).toMatch(/^\d{8}_Product_Unboxing_Walk/);

  // 4. 提交生成
  await page.click('button[text=生成素材]');
  await page.waitForSelector('.generation-progress');

  // 5. 验证结果
  await page.waitForSelector('.generation-complete', { timeout: 60000 });
  const images = await page.$$('.generated-image');
  expect(images.length).toBe(20);
});
```

### 3.3 数据库集成测试

#### 测试套件: Supabase RLS Policies
```typescript
describe('Supabase RLS Policies', () => {
  test('用户只能查看自己团队的数据', async () => {
    const { data: userA } = await supabase
      .from('creatives')
      .select()
      .eq('user_id', 'user-a-id');

    expect(userA.every(r => r.team_id === 'team-a')).toBe(true);
  });

  test('未认证用户无法访问数据', async () => {
    const anonClient = createClient(url, anonKey);
    const { error } = await anonClient.from('creatives').select();
    expect(error.message).toContain('authentication required');
  });

  test('管理员可以访问所有数据', async () => {
    const adminClient = createClient(url, serviceRoleKey);
    const { data } = await adminClient.from('creatives').select();
    expect(data.length).toBeGreaterThan(0);
  });
});
```

---

## 4. 安全审计清单

### 4.1 认证 & 授权 (OWASP A01:2021)

#### 检查项 SEC-001: NextAuth 配置安全
- [ ] JWT_SECRET 使用强随机密钥（>=32字符）
- [ ] SESSION_COOKIE 设置 httpOnly=true, secure=true
- [ ] CSRF 保护已启用
- [ ] 密码策略: 最小长度 12, 包含大小写+数字+特殊字符
- [ ] 登录失败限流: 5次/15分钟
- [ ] 会话超时: 7天无活动自动登出

**测试方法**:
```bash
# 验证环境变量
grep -r "JWT_SECRET" .env.local
# 应为: JWT_SECRET=<random-32-char-string>

# 验证 Cookie 设置
curl -I https://app.rolloy.com/api/auth/session
# 应包含: Set-Cookie: __Secure-next-auth.session-token; HttpOnly; Secure; SameSite=Lax
```

#### 检查项 SEC-002: API 密钥保护
- [ ] 所有 API 密钥存储在环境变量
- [ ] .env.local 在 .gitignore 中
- [ ] 前端代码不包含密钥（扫描 bundle.js）
- [ ] API 密钥定期轮换（90天）
- [ ] Vercel/生产环境使用加密环境变量

**验证脚本**:
```bash
# 扫描硬编码密钥
rg "GEMINI_API_KEY|FLUX_API_KEY" --type js --type ts ./app ./components
# 应返回 0 个结果

# 检查 Git 历史泄露
git log -p | grep -i "api_key\|secret"
```

#### 检查项 SEC-003: Supabase RLS 策略
- [ ] 所有表启用 RLS
- [ ] SELECT 策略: 用户只能查看同 team_id 数据
- [ ] INSERT 策略: 自动填充 user_id 和 team_id
- [ ] UPDATE/DELETE 策略: 只能修改自己创建的记录
- [ ] Service Role Key 仅在服务端使用

**SQL 验证**:
```sql
-- 检查 RLS 启用状态
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- 所有表的 rowsecurity 应为 true

-- 测试跨用户访问
SET request.jwt.claims.sub = 'user-a-id';
SELECT * FROM creatives WHERE user_id = 'user-b-id';
-- 应返回 0 行
```

### 4.2 注入攻击防御 (OWASP A03:2021)

#### 检查项 SEC-010: SQL 注入防护
- [ ] 所有数据库查询使用参数化查询（Supabase 自动处理）
- [ ] 用户输入不拼接到 SQL 字符串
- [ ] CSV 解析使用白名单验证

**测试用例**:
```typescript
// 恶意输入测试
test('应防御 SQL 注入', async () => {
  const maliciousInput = "'; DROP TABLE creatives; --";
  const { error } = await supabase
    .from('creatives')
    .select()
    .eq('name', maliciousInput);

  // 应正常返回空结果，而非执行 DROP TABLE
  expect(error).toBeNull();
});
```

#### 检查项 SEC-011: XSS 防护
- [ ] React 自动转义用户输入
- [ ] 使用 dangerouslySetInnerHTML 的地方已审计
- [ ] CSV 解析结果在渲染前清理 HTML 标签
- [ ] API 响应设置 Content-Type: application/json

**测试**:
```typescript
test('应防御 XSS 攻击', () => {
  const maliciousName = '<script>alert("XSS")</script>';
  render(<CreativeName name={maliciousName} />);

  // 应显示纯文本，而非执行脚本
  expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalled();
});
```

#### 检查项 SEC-012: 命令注入防护
- [ ] 不直接调用 shell 命令
- [ ] 文件上传路径使用白名单验证
- [ ] 图片处理使用安全库（Sharp.js）

### 4.3 API 安全

#### 检查项 SEC-020: 速率限制
- [ ] API 路由实现速率限制（100 req/min/user）
- [ ] 图片生成限制（10 批次/hour/user）
- [ ] 使用 Upstash Rate Limit 或类似工具

**实现示例**:
```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

export async function middleware(req: NextRequest) {
  const ip = req.ip ?? 'anonymous';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  return NextResponse.next();
}
```

#### 检查项 SEC-021: 输入验证
- [ ] 所有 API 端点使用 Zod 验证输入
- [ ] 文件上传限制: 图片 <= 10MB, CSV <= 5MB
- [ ] 文件类型白名单: image/jpeg, image/png, text/csv

**验证 Schema**:
```typescript
import { z } from 'zod';

const CreativeInputSchema = z.object({
  A1: z.enum(['Product', 'Scene', 'Audience']),
  A2: z.string().min(1).max(50),
  B: z.enum(['Walk', 'Sit', 'Turn', 'Stand', 'Rest', 'Lift', 'Pack', 'Carry', 'Trunk']),
  C: z.string().min(1),
  D: z.string().regex(/^D\d{3}$/),
});
```

#### 检查项 SEC-022: CORS 配置
- [ ] CORS 仅允许已知域名
- [ ] 生产环境禁用 * 通配符
- [ ] API 密钥不在跨域请求中暴露

### 4.4 数据保护

#### 检查项 SEC-030: 敏感数据处理
- [ ] 不记录 API 密钥到日志
- [ ] 用户密码使用 bcrypt 哈希（NextAuth 自动处理）
- [ ] 生成的图片 URL 包含短期令牌（24小时过期）

#### 检查项 SEC-031: HTTPS 强制
- [ ] 生产环境强制 HTTPS
- [ ] HSTS 头已设置
- [ ] 外部 API 调用使用 HTTPS

**Next.js 配置**:
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};
```

### 4.5 依赖安全

#### 检查项 SEC-040: 依赖漏洞扫描
- [ ] 每周运行 `npm audit`
- [ ] 自动更新补丁版本
- [ ] 使用 Snyk 或 Dependabot 监控

**自动化脚本**:
```bash
# package.json scripts
{
  "security:audit": "npm audit --audit-level=high",
  "security:fix": "npm audit fix",
  "security:check": "npx snyk test"
}
```

---

## 5. 性能测试计划

### 5.1 负载测试

#### 场景 PERF-001: 批量图片生成
**目标**: 验证系统在高并发下的稳定性

**测试配置**:
- 并发用户: 10
- 每用户任务: 生成 20 张图片
- 总任务数: 200
- 测试时长: 10 分钟

**性能指标**:
| 指标 | 目标值 | 可接受值 | 不可接受 |
|------|--------|----------|----------|
| 平均响应时间 | < 3s | < 5s | > 5s |
| P95 响应时间 | < 5s | < 8s | > 8s |
| 错误率 | < 1% | < 3% | > 3% |
| CPU 使用率 | < 70% | < 85% | > 85% |
| 内存使用 | < 512MB | < 1GB | > 1GB |

**工具**: Apache JMeter 或 k6

**测试脚本**:
```javascript
// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '10m',
};

export default function () {
  const payload = JSON.stringify({
    A1: 'Product',
    A2: 'Unboxing',
    B: 'Walk',
    C: 'Indoor',
    D: 'D001',
    batchSize: 20,
  });

  const res = http.post('https://app.rolloy.com/api/generate', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
```

### 5.2 压力测试

#### 场景 PERF-010: API 限流验证
**目标**: 确认速率限制正确工作

**步骤**:
1. 单用户在 1 分钟内发送 150 个请求
2. 验证第 101-150 个请求返回 429 状态码
3. 等待 1 分钟后验证恢复正常

### 5.3 前端性能

#### 指标 PERF-020: Core Web Vitals
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

**测试工具**: Lighthouse CI

**自动化**:
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://app.rolloy.com
            https://app.rolloy.com/creative/new
          uploadArtifacts: true
```

---

## 6. 验收标准 (MVP Release Checklist)

### 6.1 功能完整性

#### 核心功能 (Blocker)
- [x] ABCD 参数选择器可用
- [x] 命名生成服务正确
- [x] 状态路由逻辑无误
- [x] AI 图片生成集成成功
- [x] CSV 解析准确率 > 95%
- [x] 分析仪表盘数据正确

#### 用户体验 (High)
- [ ] 所有页面响应时间 < 3s
- [ ] 移动端适配（响应式设计）
- [ ] 错误提示清晰易懂
- [ ] 加载状态显示（进度条/骨架屏）

### 6.2 安全合规

#### 必须通过项 (Blocker)
- [ ] 所有安全审计清单项通过
- [ ] 无 P0/P1 级别安全漏洞
- [ ] RLS 策略测试通过
- [ ] API 密钥无泄露

#### 数据保护 (High)
- [ ] GDPR 合规（如适用）
- [ ] 用户数据可导出/删除
- [ ] 审计日志已启用

### 6.3 性能达标

#### 性能指标 (High)
- [ ] 所有性能测试通过目标值
- [ ] 无内存泄漏
- [ ] 批量生成稳定（200 任务无崩溃）

### 6.4 测试覆盖

#### 代码覆盖率 (High)
- [ ] 单元测试覆盖率 > 80%
- [ ] 关键路径覆盖率 = 100%
- [ ] 集成测试覆盖所有 API 端点

**覆盖率报告**:
```bash
npm run test:coverage
# 应生成 coverage/lcov-report/index.html
```

### 6.5 文档完整性

#### 必备文档 (Medium)
- [ ] README.md 包含快速开始指南
- [ ] API 文档（Swagger/OpenAPI）
- [ ] 环境变量配置说明
- [ ] 故障排查手册

### 6.6 部署就绪

#### 生产环境 (Blocker)
- [ ] 环境变量已配置（Vercel）
- [ ] 数据库迁移脚本已测试
- [ ] 监控告警已设置（Sentry/LogRocket）
- [ ] 备份策略已实施

#### 回滚计划 (High)
- [ ] 版本标签已创建（Git Tag）
- [ ] 回滚脚本已准备
- [ ] 数据库回滚策略已制定

---

## 7. 测试执行计划

### 7.1 测试阶段

| 阶段 | 时间 | 负责人 | 交付物 |
|------|------|--------|--------|
| 单元测试 | Week 1 | Dev Team | 测试覆盖率报告 |
| 集成测试 | Week 2 | QA Team | API 测试报告 |
| 安全审计 | Week 2-3 | Security Team | 漏洞扫描报告 |
| 性能测试 | Week 3 | QA Team | 性能测试报告 |
| UAT | Week 4 | Product Team | 验收报告 |

### 7.2 缺陷管理

#### 优先级定义
- **P0 (Blocker)**: 系统崩溃/数据丢失/安全漏洞 -> 24小时内修复
- **P1 (Critical)**: 核心功能不可用 -> 3天内修复
- **P2 (High)**: 功能异常但有替代方案 -> 1周内修复
- **P3 (Medium)**: UI/UX 问题 -> 2周内修复
- **P4 (Low)**: 优化建议 -> 下版本考虑

#### 缺陷追踪
**工具**: GitHub Issues + Project Board

**模板**:
```markdown
## Bug 描述
[清晰描述问题]

## 复现步骤
1. ...
2. ...

## 预期行为
[应该发生什么]

## 实际行为
[实际发生了什么]

## 环境
- OS: macOS 14.0
- Browser: Chrome 120
- Version: 1.0.0

## 优先级
P0 / P1 / P2 / P3 / P4

## 附件
[截图/日志]
```

### 7.3 回归测试

#### 触发条件
- 修复 P0/P1 缺陷后
- 发布新版本前
- 重大代码重构后

#### 回归测试套件
- 所有 P0 测试用例
- 受影响模块的集成测试
- 核心用户路径 E2E 测试

---

## 8. 持续改进

### 8.1 测试自动化

#### CI/CD 集成
```yaml
# .github/workflows/test.yml
name: Test Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}

      - name: Run security scan
        run: npm audit --audit-level=high

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### 8.2 监控指标

#### 生产环境监控
- **错误率**: < 0.1%
- **API 响应时间**: P95 < 1s
- **可用性**: > 99.9%

**工具**: Sentry + Vercel Analytics

### 8.3 定期审计

#### 安全审计
- **频率**: 每季度
- **范围**: 依赖漏洞 + RLS 策略 + API 密钥轮换

#### 性能审计
- **频率**: 每月
- **范围**: Lighthouse CI + 负载测试

---

## 9. 联系方式

### 测试团队
- **QA Lead**: qa@rolloy.com
- **Security Team**: security@rolloy.com
- **On-call**: +1-xxx-xxx-xxxx

### 缺陷上报
- **GitHub Issues**: https://github.com/rolloy/creativeos/issues
- **Slack**: #creativeos-qa

---

## 10. 附录

### A. 测试数据集
```typescript
// test-fixtures.ts
export const mockCreativeData = {
  valid: {
    A1: 'Product',
    A2: 'Unboxing',
    B: 'Walk',
    C: 'Indoor',
    D: 'D001',
  },
  invalidB: {
    A1: 'Product',
    A2: 'Unboxing',
    B: 'InvalidAction', // 应触发错误
    C: 'Indoor',
    D: 'D001',
  },
};
```

### B. 安全扫描工具
- **SAST**: SonarQube / ESLint Security Plugin
- **DAST**: OWASP ZAP
- **依赖扫描**: Snyk / npm audit
- **Secret 扫描**: GitGuardian / TruffleHog

### C. 性能基准
| 页面 | 目标 FCP | 目标 LCP | 目标 TTI |
|------|----------|----------|----------|
| 首页 | < 1s | < 2s | < 3s |
| 创建页 | < 1.5s | < 2.5s | < 4s |
| 仪表盘 | < 2s | < 3s | < 5s |

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-05
**批准人**: Director of Quality Assurance
