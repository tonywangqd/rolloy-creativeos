# Rolloy Creative OS - 安全审计清单与验收标准

## 文档元数据
- **项目**: Rolloy Creative OS
- **版本**: 1.0.0
- **安全等级**: HIGH
- **审计日期**: 2025-12-05
- **状态**: ACTIVE

---

## 1. 安全审计清单 (OWASP Top 10:2021)

### 1.1 A01:2021 - 访问控制失效 (Broken Access Control)

#### 检查项 SEC-A01-001: NextAuth 认证配置
**优先级**: CRITICAL (P0)

- [ ] **JWT 密钥强度**
  ```bash
  # 验证命令
  grep "JWT_SECRET" .env.local
  # 要求: >= 32 字符随机字符串
  # 生成命令: openssl rand -base64 32
  ```

- [ ] **Session Cookie 安全属性**
  ```javascript
  // next-auth 配置检查
  // pages/api/auth/[...nextauth].ts
  {
    cookies: {
      sessionToken: {
        name: '__Secure-next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true // 生产环境必须为 true
        }
      }
    }
  }
  ```

- [ ] **CSRF 保护**
  ```bash
  # 验证 CSRF Token 机制
  curl -X POST https://app.rolloy.com/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}' \
    -v | grep "csrf"
  ```

- [ ] **密码策略**
  - 最小长度: 12 字符
  - 包含: 大写字母 + 小写字母 + 数字 + 特殊字符
  - 禁止常见密码（使用 zxcvbn 库）

- [ ] **登录失败限流**
  ```typescript
  // 实现示例
  import { Ratelimit } from '@upstash/ratelimit';

  const loginRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 次/15 分钟
  });
  ```

- [ ] **会话超时**
  - 无活动超时: 7 天
  - 绝对超时: 30 天
  - 登出时完全清除 session

**验证方法**:
```bash
# 自动化测试脚本
npm run test:security:auth
```

---

#### 检查项 SEC-A01-002: Supabase RLS 策略
**优先级**: CRITICAL (P0)

- [ ] **所有表启用 RLS**
  ```sql
  -- 检查脚本
  SELECT
    schemaname,
    tablename,
    rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  AND rowsecurity = false;

  -- 应返回 0 行
  ```

- [ ] **SELECT 策略: 团队隔离**
  ```sql
  -- creatives 表策略示例
  CREATE POLICY "用户只能查看同团队素材"
  ON creatives FOR SELECT
  USING (
    team_id = (
      SELECT team_id FROM profiles
      WHERE id = auth.uid()
    )
  );
  ```

- [ ] **INSERT 策略: 自动填充所有者**
  ```sql
  CREATE POLICY "用户可创建素材"
  ON creatives FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
  );
  ```

- [ ] **UPDATE/DELETE 策略: 仅自己创建的记录**
  ```sql
  CREATE POLICY "用户只能更新自己的素材"
  ON creatives FOR UPDATE
  USING (user_id = auth.uid());

  CREATE POLICY "用户只能删除自己的素材"
  ON creatives FOR DELETE
  USING (user_id = auth.uid());
  ```

- [ ] **管理员策略: 分离的 Service Role**
  ```typescript
  // NEVER expose service_role_key to frontend
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // 仅服务端
    { auth: { persistSession: false } }
  );
  ```

**测试脚本**:
```sql
-- 跨用户访问测试
BEGIN;
SET request.jwt.claims.sub = 'user-a-id';
SELECT * FROM creatives WHERE user_id = 'user-b-id';
-- 应返回 0 行
ROLLBACK;
```

---

#### 检查项 SEC-A01-003: API 路由保护
**优先级**: CRITICAL (P0)

- [ ] **所有 API 路由验证认证**
  ```typescript
  // app/api/generate/route.ts
  import { getServerSession } from 'next-auth';

  export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    // ... 业务逻辑
  }
  ```

- [ ] **基于角色的访问控制 (RBAC)**
  ```typescript
  enum Role {
    ADMIN = 'admin',
    EDITOR = 'editor',
    VIEWER = 'viewer'
  }

  function requireRole(allowedRoles: Role[]) {
    return async (req: Request) => {
      const session = await getServerSession();
      if (!allowedRoles.includes(session.user.role)) {
        return new Response('Forbidden', { status: 403 });
      }
    };
  }
  ```

- [ ] **资源所有权验证**
  ```typescript
  // 验证用户是否拥有该素材
  const creative = await supabase
    .from('creatives')
    .select()
    .eq('id', creativeId)
    .eq('user_id', session.user.id)
    .single();

  if (!creative) {
    return new Response('Not Found', { status: 404 });
  }
  ```

---

### 1.2 A02:2021 - 加密失效 (Cryptographic Failures)

#### 检查项 SEC-A02-001: 数据传输加密
**优先级**: HIGH (P1)

- [ ] **强制 HTTPS**
  ```javascript
  // next.config.js
  module.exports = {
    async redirects() {
      return [
        {
          source: '/:path*',
          has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
          destination: 'https://app.rolloy.com/:path*',
          permanent: true,
        },
      ];
    },
  };
  ```

- [ ] **HSTS 头部**
  ```javascript
  // next.config.js
  module.exports = {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload'
            },
          ],
        },
      ];
    },
  };
  ```

- [ ] **外部 API 调用使用 HTTPS**
  ```typescript
  // 验证所有 API 端点
  const apiEndpoints = {
    gemini: 'https://generativelanguage.googleapis.com',
    flux: 'https://api.nanobana.com',
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL, // 必须是 https://
  };
  ```

---

#### 检查项 SEC-A02-002: 敏感数据保护
**优先级**: HIGH (P1)

- [ ] **环境变量管理**
  ```bash
  # .env.local 必须在 .gitignore 中
  grep ".env.local" .gitignore

  # 扫描历史泄露
  git log -p | grep -i "api_key\|secret\|password"
  ```

- [ ] **密钥轮换策略**
  | 密钥类型 | 轮换频率 | 负责人 |
  |---------|---------|--------|
  | JWT_SECRET | 90 天 | DevOps |
  | Gemini API Key | 180 天 | Tech Lead |
  | Flux API Key | 180 天 | Tech Lead |
  | Supabase Keys | 365 天 | CTO |

- [ ] **日志脱敏**
  ```typescript
  // 日志工具配置
  import pino from 'pino';

  const logger = pino({
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'apiKey',
        'password',
        '*.secret',
      ],
      remove: true,
    },
  });
  ```

- [ ] **生成图片 URL 短期令牌**
  ```typescript
  // 生成 24 小时过期的签名 URL
  const { data, error } = await supabase
    .storage
    .from('generated-images')
    .createSignedUrl('image.jpg', 86400); // 24 小时
  ```

---

### 1.3 A03:2021 - 注入攻击 (Injection)

#### 检查项 SEC-A03-001: SQL 注入防护
**优先级**: CRITICAL (P0)

- [ ] **使用参数化查询**
  ```typescript
  // ✅ 正确: 参数化查询
  const { data } = await supabase
    .from('creatives')
    .select()
    .eq('name', userInput); // Supabase 自动参数化

  // ❌ 错误: 字符串拼接
  const query = `SELECT * FROM creatives WHERE name = '${userInput}'`;
  ```

- [ ] **输入验证白名单**
  ```typescript
  import { z } from 'zod';

  const CreativeSchema = z.object({
    A1: z.enum(['Product', 'Scene', 'Audience']),
    A2: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/),
    B: z.enum(['Walk', 'Sit', 'Turn', 'Stand', 'Rest', 'Lift', 'Pack', 'Carry', 'Trunk']),
    C: z.string().min(1).max(50),
    D: z.string().regex(/^D\d{3}$/),
  });
  ```

- [ ] **测试恶意输入**
  ```typescript
  test('应防御 SQL 注入', async () => {
    const maliciousInputs = [
      "'; DROP TABLE creatives; --",
      "' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
    ];

    for (const input of maliciousInputs) {
      const { error } = await supabase
        .from('creatives')
        .select()
        .eq('name', input);

      expect(error).toBeNull(); // 应正常返回空结果
    }
  });
  ```

---

#### 检查项 SEC-A03-002: XSS 防护
**优先级**: HIGH (P1)

- [ ] **React 自动转义**
  ```typescript
  // ✅ 安全: React 自动转义
  const CreativeName = ({ name }: { name: string }) => {
    return <div>{name}</div>; // 自动转义 HTML
  };

  // ❌ 危险: 使用 dangerouslySetInnerHTML
  const UnsafeComponent = ({ html }: { html: string }) => {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };
  ```

- [ ] **审计 dangerouslySetInnerHTML 使用**
  ```bash
  # 扫描代码库
  rg "dangerouslySetInnerHTML" --type tsx --type jsx
  # 每个使用必须有 XSS 清理
  ```

- [ ] **CSV 解析输出清理**
  ```typescript
  import DOMPurify from 'isomorphic-dompurify';

  function sanitizeCSVData(data: string): string {
    return DOMPurify.sanitize(data, {
      ALLOWED_TAGS: [], // 移除所有 HTML 标签
      ALLOWED_ATTR: [],
    });
  }
  ```

- [ ] **Content Security Policy (CSP)**
  ```javascript
  // next.config.js
  module.exports = {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js 需要
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self'",
                "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
                "frame-ancestors 'none'",
              ].join('; '),
            },
          ],
        },
      ];
    },
  };
  ```

- [ ] **XSS 测试用例**
  ```typescript
  test('应防御 XSS 攻击', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror="alert(1)">',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<iframe src="javascript:alert(1)">',
    ];

    xssPayloads.forEach((payload) => {
      render(<CreativeName name={payload} />);
      expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
    });
  });
  ```

---

#### 检查项 SEC-A03-003: 命令注入防护
**优先级**: MEDIUM (P2)

- [ ] **避免直接调用 shell**
  ```typescript
  // ❌ 危险: 调用 shell
  import { exec } from 'child_process';
  exec(`convert ${userInput}.jpg output.png`); // 命令注入风险

  // ✅ 安全: 使用库
  import sharp from 'sharp';
  await sharp(imagePath).resize(800, 600).toFile('output.png');
  ```

- [ ] **文件上传路径白名单**
  ```typescript
  import path from 'path';

  function validateUploadPath(filename: string): boolean {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(filename).toLowerCase();

    // 检查扩展名
    if (!allowedExtensions.includes(ext)) {
      return false;
    }

    // 防止路径遍历
    if (filename.includes('..') || filename.includes('/')) {
      return false;
    }

    return true;
  }
  ```

---

### 1.4 A04:2021 - 不安全设计 (Insecure Design)

#### 检查项 SEC-A04-001: 速率限制
**优先级**: HIGH (P1)

- [ ] **API 全局限流**
  ```typescript
  // middleware.ts
  import { Ratelimit } from '@upstash/ratelimit';

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
  });

  export async function middleware(req: NextRequest) {
    const ip = req.ip ?? 'anonymous';
    const { success, remaining } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Too Many Requests', retryAfter: 60 },
        { status: 429 }
      );
    }

    return NextResponse.next();
  }
  ```

- [ ] **图片生成限流**
  ```typescript
  // 每用户限制
  const imageGenerationLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 批次/小时
  });
  ```

- [ ] **登录限流**
  ```typescript
  const loginLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 次/15 分钟
  });
  ```

---

#### 检查项 SEC-A04-002: 输入验证
**优先级**: HIGH (P1)

- [ ] **文件上传限制**
  ```typescript
  const fileUploadConfig = {
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxCSVSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedCSVTypes: ['text/csv', 'application/vnd.ms-excel'],
  };

  function validateFileUpload(file: File): { valid: boolean; error?: string } {
    // 检查文件大小
    if (file.type.startsWith('image/') && file.size > fileUploadConfig.maxImageSize) {
      return { valid: false, error: '图片大小超过 10MB' };
    }

    // 检查 MIME 类型
    if (file.type.startsWith('image/') && !fileUploadConfig.allowedImageTypes.includes(file.type)) {
      return { valid: false, error: '不支持的图片格式' };
    }

    return { valid: true };
  }
  ```

- [ ] **所有 API 端点使用 Zod 验证**
  ```typescript
  // app/api/generate/route.ts
  import { z } from 'zod';

  const GenerateRequestSchema = z.object({
    A1: z.enum(['Product', 'Scene', 'Audience']),
    A2: z.string().min(1).max(50),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().regex(/^D\d{3}$/),
    batchSize: z.number().int().min(1).max(20),
  });

  export async function POST(req: Request) {
    const body = await req.json();

    // 验证输入
    const result = GenerateRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    // ... 业务逻辑
  }
  ```

---

### 1.5 A05:2021 - 安全配置错误 (Security Misconfiguration)

#### 检查项 SEC-A05-001: 安全头部
**优先级**: HIGH (P1)

- [ ] **所有安全头部已配置**
  ```javascript
  // next.config.js
  module.exports = {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-XSS-Protection', value: '1; mode=block' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          ],
        },
      ];
    },
  };
  ```

- [ ] **验证头部配置**
  ```bash
  # 使用 SecurityHeaders.com 测试
  curl -I https://app.rolloy.com | grep -E "X-Frame-Options|X-Content-Type-Options"

  # 或使用在线工具
  # https://securityheaders.com/?q=app.rolloy.com
  ```

---

#### 检查项 SEC-A05-002: 错误处理
**优先级**: MEDIUM (P2)

- [ ] **生产环境禁用详细错误**
  ```typescript
  // app/api/error-handler.ts
  export function handleError(error: unknown): Response {
    console.error(error); // 记录完整错误到日志

    if (process.env.NODE_ENV === 'production') {
      // 生产环境返回通用错误
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    } else {
      // 开发环境返回详细错误
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
  ```

- [ ] **404 页面不泄露信息**
  ```typescript
  // app/not-found.tsx
  export default function NotFound() {
    return (
      <div>
        <h1>404 - Page Not Found</h1>
        {/* 不要显示: 文件路径、内部 ID、技术细节 */}
      </div>
    );
  }
  ```

---

### 1.6 A06:2021 - 易受攻击和过时的组件

#### 检查项 SEC-A06-001: 依赖漏洞扫描
**优先级**: HIGH (P1)

- [ ] **每周运行 npm audit**
  ```bash
  # package.json scripts
  {
    "scripts": {
      "security:audit": "npm audit --audit-level=high",
      "security:fix": "npm audit fix",
      "security:check": "npx snyk test"
    }
  }
  ```

- [ ] **配置 Dependabot**
  ```yaml
  # .github/dependabot.yml
  version: 2
  updates:
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
      open-pull-requests-limit: 10
      versioning-strategy: increase
  ```

- [ ] **关键依赖版本锁定**
  ```json
  // package.json
  {
    "dependencies": {
      "next": "14.0.4", // 锁定版本
      "next-auth": "^4.24.0", // 允许补丁更新
      "@supabase/supabase-js": "^2.38.0"
    }
  }
  ```

---

### 1.7 A07:2021 - 身份识别和认证失败

#### 检查项 SEC-A07-001: 多因素认证 (MFA)
**优先级**: MEDIUM (P2)

- [ ] **启用 Supabase MFA**
  ```sql
  -- 数据库配置
  ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

  -- MFA 策略
  CREATE POLICY "MFA required for admin"
  ON auth.users
  USING (
    role = 'admin' AND
    (SELECT count(*) FROM auth.mfa_factors WHERE user_id = id) > 0
  );
  ```

- [ ] **MFA UI 实现**
  ```typescript
  // 使用 @supabase/auth-ui-react
  import { Auth } from '@supabase/auth-ui-react';

  <Auth
    supabaseClient={supabase}
    appearance={{ theme: ThemeSupa }}
    providers={['google']}
    mfaAppearance={{
      showLinks: true,
    }}
  />
  ```

---

### 1.8 A08:2021 - 软件和数据完整性失败

#### 检查项 SEC-A08-001: 子资源完整性 (SRI)
**优先级**: LOW (P3)

- [ ] **CDN 资源使用 SRI**
  ```html
  <script
    src="https://cdn.example.com/library.js"
    integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
    crossorigin="anonymous"
  ></script>
  ```

---

### 1.9 A09:2021 - 安全日志和监控失败

#### 检查项 SEC-A09-001: 日志记录
**优先级**: HIGH (P1)

- [ ] **关键操作审计日志**
  ```typescript
  // lib/audit-log.ts
  interface AuditEvent {
    userId: string;
    action: string;
    resource: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }

  async function logAuditEvent(event: AuditEvent) {
    await supabase.from('audit_logs').insert({
      user_id: event.userId,
      action: event.action,
      resource: event.resource,
      timestamp: event.timestamp,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
    });
  }

  // 记录关键操作
  await logAuditEvent({
    userId: session.user.id,
    action: 'GENERATE_IMAGE',
    resource: `creative/${creativeId}`,
    timestamp: new Date(),
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
  });
  ```

- [ ] **错误监控集成**
  ```typescript
  // app/providers.tsx
  import * as Sentry from '@sentry/nextjs';

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    beforeSend(event, hint) {
      // 过滤敏感信息
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },
  });
  ```

- [ ] **实时告警**
  ```typescript
  // 配置告警规则
  const alertRules = {
    highErrorRate: { threshold: 10, window: '5m' },
    slowResponse: { threshold: 3000, percentile: 95 },
    authFailures: { threshold: 50, window: '10m' },
  };
  ```

---

### 1.10 A10:2021 - 服务器端请求伪造 (SSRF)

#### 检查项 SEC-A10-001: URL 验证
**优先级**: MEDIUM (P2)

- [ ] **外部 URL 白名单**
  ```typescript
  const allowedHosts = [
    'generativelanguage.googleapis.com',
    'api.nanobana.com',
    'supabase.co',
  ];

  function validateExternalURL(url: string): boolean {
    try {
      const parsed = new URL(url);

      // 检查协议
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return false;
      }

      // 检查主机白名单
      return allowedHosts.some(host => parsed.hostname.endsWith(host));
    } catch {
      return false;
    }
  }
  ```

---

## 2. MVP 验收标准

### 2.1 功能完整性检查清单

#### 核心功能 (BLOCKER)
- [ ] **ABCD 参数选择器**
  - [ ] A1-A2 二级联动正常
  - [ ] B 动作选择触发状态路由
  - [ ] C 场景和 D 编码可选择
  - [ ] 所有选择器响应时间 < 100ms

- [ ] **命名生成服务**
  - [ ] 生成格式符合规范: YYYYMMDD_A1_A2_B_C_D
  - [ ] 批量生成 20 个命名 < 500ms
  - [ ] 无重复命名
  - [ ] 特殊字符正确处理

- [ ] **状态路由逻辑**
  - [ ] Walk/Sit/Turn/Stand/Rest -> UNFOLDED
  - [ ] Lift/Pack/Carry/Trunk -> FOLDED
  - [ ] 参考图正确过滤
  - [ ] 状态切换无延迟 (< 50ms)

- [ ] **AI 图片生成**
  - [ ] Gemini 提示词生成成功
  - [ ] Flux API 集成正常
  - [ ] 批量生成 20 张 < 5 分钟
  - [ ] 错误重试机制工作

- [ ] **CSV 解析**
  - [ ] Ad Name 解析准确率 > 95%
  - [ ] 指标数据正确提取
  - [ ] 1000 行处理 < 3s
  - [ ] 重复数据去重

- [ ] **分析仪表盘**
  - [ ] CPA/ROAS 聚合计算正确
  - [ ] 图表数据实时更新
  - [ ] 空数据状态显示

#### 用户体验 (HIGH)
- [ ] 所有页面首屏加载 < 3s
- [ ] 移动端响应式适配 (768px, 375px)
- [ ] 错误提示用户友好
- [ ] 加载状态显示 (进度条/骨架屏)
- [ ] 无 Console 错误

### 2.2 安全合规检查清单

#### 必须通过 (BLOCKER)
- [ ] **A01 - 访问控制**
  - [ ] NextAuth 配置安全
  - [ ] RLS 策略测试通过
  - [ ] API 路由全部保护

- [ ] **A02 - 加密**
  - [ ] 强制 HTTPS
  - [ ] 环境变量无泄露
  - [ ] 敏感数据脱敏

- [ ] **A03 - 注入**
  - [ ] SQL 注入测试通过
  - [ ] XSS 防护有效
  - [ ] 输入验证完整

- [ ] **A04 - 不安全设计**
  - [ ] API 限流启用
  - [ ] 文件上传验证

- [ ] **A05 - 配置错误**
  - [ ] 安全头部配置
  - [ ] 错误处理规范

- [ ] **A06 - 过时组件**
  - [ ] npm audit 无 HIGH/CRITICAL 漏洞

- [ ] **A09 - 日志监控**
  - [ ] 审计日志启用
  - [ ] Sentry 集成

#### 数据保护 (HIGH)
- [ ] 用户数据可导出
- [ ] 用户数据可删除 (GDPR)
- [ ] 数据备份策略实施

### 2.3 性能达标检查清单

#### 性能指标 (HIGH)
- [ ] **Core Web Vitals**
  - [ ] LCP < 2.5s
  - [ ] FID < 100ms
  - [ ] CLS < 0.1

- [ ] **API 响应时间**
  - [ ] P50 < 500ms
  - [ ] P95 < 1s
  - [ ] P99 < 3s

- [ ] **批量操作**
  - [ ] 20 张图片生成稳定
  - [ ] 1000 行 CSV 解析 < 3s
  - [ ] 无内存泄漏

### 2.4 测试覆盖检查清单

#### 代码覆盖率 (HIGH)
- [ ] 单元测试覆盖率 > 80%
- [ ] 关键路径覆盖率 = 100%
- [ ] 所有 API 端点有集成测试
- [ ] E2E 测试覆盖核心流程

**运行测试**:
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

### 2.5 文档完整性检查清单

#### 必备文档 (MEDIUM)
- [ ] README.md (快速开始)
- [ ] API 文档 (Swagger/OpenAPI)
- [ ] 环境变量配置说明
- [ ] 部署文档
- [ ] 故障排查手册

### 2.6 部署就绪检查清单

#### 生产环境 (BLOCKER)
- [ ] Vercel 环境变量配置
- [ ] Supabase 数据库迁移
- [ ] Sentry 监控启用
- [ ] 备份策略实施
- [ ] 域名 DNS 配置
- [ ] SSL 证书有效

#### 回滚计划 (HIGH)
- [ ] Git Tag 创建 (v1.0.0)
- [ ] 回滚脚本准备
- [ ] 数据库回滚策略
- [ ] 回滚演练完成

---

## 3. 安全测试自动化脚本

### 3.1 快速安全检查
```bash
#!/bin/bash
# scripts/security-check.sh

echo "🔍 Rolloy Creative OS - 快速安全检查"

# 1. 依赖漏洞扫描
echo "检查依赖漏洞..."
npm audit --audit-level=high
if [ $? -ne 0 ]; then
  echo "❌ 发现高危漏洞"
  exit 1
fi

# 2. 环境变量检查
echo "检查环境变量..."
if grep -r "API_KEY\|SECRET" --include="*.ts" --include="*.tsx" app/ components/ lib/; then
  echo "❌ 代码中发现硬编码密钥"
  exit 1
fi

# 3. Git 历史泄露检查
echo "检查 Git 历史..."
if git log -p | grep -i "api_key\|secret\|password" | grep -v "EXAMPLE"; then
  echo "⚠️  Git 历史中可能存在密钥泄露"
fi

# 4. RLS 策略检查
echo "检查 Supabase RLS..."
# 需要 Supabase CLI
supabase db remote commit
supabase test db

# 5. 安全头部检查
echo "检查安全头部..."
curl -s -I https://app.rolloy.com | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"

echo "✅ 安全检查完成"
```

### 3.2 CI/CD 集成
```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1' # 每周一

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./

      - name: Run security tests
        run: npm run test:security
```

---

## 4. 发布前最终检查

### 4.1 Pre-Launch Checklist
```markdown
## MVP 发布前最终检查 (2025-12-05)

### 功能测试
- [ ] 所有 P0 测试用例通过
- [ ] 核心用户流程 E2E 测试通过
- [ ] 移动端适配测试通过

### 安全审计
- [ ] OWASP Top 10 检查清单完成
- [ ] 无 P0/P1 安全漏洞
- [ ] 渗透测试报告审核

### 性能验证
- [ ] Lighthouse CI 得分 > 90
- [ ] 负载测试通过 (100 并发用户)
- [ ] 监控告警配置

### 部署准备
- [ ] 生产环境变量配置
- [ ] 数据库备份完成
- [ ] 回滚脚本测试
- [ ] 域名 SSL 证书验证

### 文档完整
- [ ] README.md 更新
- [ ] API 文档发布
- [ ] 运维手册准备

### 团队就绪
- [ ] 上线计划沟通
- [ ] On-call 排班确认
- [ ] 监控仪表盘访问权限

**批准人**:
- CTO: ________________  日期: ________
- 安全负责人: ________________  日期: ________
- QA Lead: ________________  日期: ________
```

---

## 5. 联系方式

### 安全问题上报
- **Email**: security@rolloy.com
- **PGP Key**: https://rolloy.com/security.asc
- **Bug Bounty**: https://hackerone.com/rolloy

### 紧急联系
- **On-call**: +1-xxx-xxx-xxxx
- **Slack**: #security-alerts

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-05
**下次审计**: 2026-03-05
