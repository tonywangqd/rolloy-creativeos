# Rolloy Creative OS - 测试快速开始指南

## 概览

本指南帮助开发者快速上手 Rolloy Creative OS 的测试框架。

---

## 1. 环境准备

### 1.1 安装依赖

```bash
cd /Users/tony/rolloy-creativeos
npm install
```

### 1.2 验证安装

```bash
# 检查 Jest 版本
npx jest --version

# 检查 TypeScript 版本
npx tsc --version

# 检查 Playwright 版本
npx playwright --version
```

---

## 2. 运行测试

### 2.1 单元测试

```bash
# 运行所有单元测试
npm run test:unit

# 运行特定测试文件
npm test -- __tests__/naming-service.test.ts

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

**示例输出**:
```
PASS  __tests__/naming-service.test.ts
  NamingService - 命名生成服务
    generateName - 标准命名生成
      ✓ 应生成标准格式的命名 (3 ms)
      ✓ 应在未提供日期时使用当前日期 (2 ms)
      ✓ 应自动移除参数中的空格 (1 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Coverage:    95.2% Statements | 92.8% Branches | 94.1% Functions | 95.2% Lines
```

### 2.2 集成测试

```bash
# 运行集成测试（需要 Supabase 连接）
npm run test:integration
```

### 2.3 端到端测试

```bash
# 安装 Playwright 浏览器
npx playwright install

# 运行 E2E 测试
npm run test:e2e

# 运行特定浏览器
npx playwright test --project=chromium
```

---

## 3. 测试文件结构

```
rolloy-creativeos/
├── __tests__/                    # 单元测试
│   ├── naming-service.test.ts
│   ├── state-router.test.ts
│   └── csv-parser.test.ts
├── tests/
│   ├── integration/              # 集成测试
│   │   ├── api.test.ts
│   │   └── database.test.ts
│   └── e2e/                      # 端到端测试
│       ├── user-flow.spec.ts
│       └── creative-generation.spec.ts
├── jest.config.js                # Jest 配置
├── jest.setup.js                 # Jest 全局设置
└── playwright.config.ts          # Playwright 配置
```

---

## 4. 编写测试示例

### 4.1 单元测试示例

```typescript
// __tests__/example.test.ts
import { describe, test, expect } from '@jest/globals';

describe('示例测试套件', () => {
  test('应通过简单断言', () => {
    expect(1 + 1).toBe(2);
  });

  test('应验证字符串包含', () => {
    const name = '20251205_Product_Unboxing_Walk_Indoor_D001';
    expect(name).toContain('Product');
  });
});
```

**运行**:
```bash
npm test -- __tests__/example.test.ts
```

### 4.2 React 组件测试示例

```typescript
// __tests__/components/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button 组件', () => {
  test('应渲染按钮文本', () => {
    render(<Button>点击我</Button>);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });

  test('应响应点击事件', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>点击我</Button>);

    fireEvent.click(screen.getByText('点击我'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 4.3 API 路由测试示例

```typescript
// __tests__/api/generate.test.ts
import { POST } from '@/app/api/generate/route';

describe('POST /api/generate', () => {
  test('应验证必需参数', async () => {
    const req = new Request('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({}), // 缺少参数
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  test('应返回生成结果', async () => {
    const req = new Request('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        A1: 'Product',
        A2: 'Unboxing',
        B: 'Walk',
        C: 'Indoor',
        D: 'D001',
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
  });
});
```

---

## 5. 测试最佳实践

### 5.1 命名规范

```typescript
// ✅ 好的测试名称
test('应在用户未登录时返回 401', () => {});
test('应正确解析标准格式的 Ad Name', () => {});

// ❌ 差的测试名称
test('测试1', () => {});
test('works', () => {});
```

### 5.2 AAA 模式（Arrange-Act-Assert）

```typescript
test('应生成标准命名', () => {
  // Arrange: 准备测试数据
  const params = {
    date: '2025-12-05',
    A1: 'Product',
    A2: 'Unboxing',
    B: 'Walk',
    C: 'Indoor',
    D: 'D001',
  };

  // Act: 执行测试操作
  const result = namingService.generateName(params);

  // Assert: 验证结果
  expect(result).toBe('20251205_Product_Unboxing_Walk_Indoor_D001');
});
```

### 5.3 测试隔离

```typescript
// ✅ 好的做法：每个测试独立
describe('NamingService', () => {
  let service: NamingService;

  beforeEach(() => {
    service = new NamingService(); // 每次测试前重新创建
  });

  test('测试1', () => {
    // 使用独立的 service 实例
  });

  test('测试2', () => {
    // 使用独立的 service 实例
  });
});
```

### 5.4 模拟外部依赖

```typescript
// 模拟 Supabase 客户端
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: mockData, error: null })),
        })),
      })),
    })),
  })),
}));
```

---

## 6. 调试测试

### 6.1 运行单个测试

```bash
# 使用 test.only
test.only('仅运行这个测试', () => {
  // ...
});

# 或命令行指定
npm test -- -t "仅运行这个测试"
```

### 6.2 查看详细输出

```bash
# 显示每个测试的输出
npm test -- --verbose

# 显示控制台日志
npm test -- --silent=false
```

### 6.3 使用调试器

```typescript
test('调试示例', () => {
  debugger; // 在此处设置断点

  const result = someFunction();
  console.log('Result:', result);

  expect(result).toBe(expected);
});
```

**运行**:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## 7. 持续集成

### 7.1 GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

### 7.2 本地 Git Hooks

```bash
# 安装 husky
npm install --save-dev husky

# 初始化
npx husky install

# 添加 pre-commit hook
npx husky add .husky/pre-commit "npm run test:unit"
```

---

## 8. 覆盖率报告

### 8.1 生成报告

```bash
npm run test:coverage
```

### 8.2 查看报告

```bash
# 在浏览器中打开
open coverage/lcov-report/index.html

# 或
npm run coverage:open
```

### 8.3 覆盖率目标

| 指标 | 目标 | 当前 |
|------|------|------|
| Statements | 80% | - |
| Branches | 80% | - |
| Functions | 80% | - |
| Lines | 80% | - |

---

## 9. 常见问题

### Q1: 测试运行很慢怎么办？

```bash
# 使用 --maxWorkers 限制并发
npm test -- --maxWorkers=50%

# 仅运行变更的测试
npm test -- --onlyChanged
```

### Q2: 模块导入失败

检查 `jest.config.js` 中的 `moduleNameMapper`:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

### Q3: 异步测试超时

```typescript
// 增加超时时间
test('异步测试', async () => {
  // ...
}, 10000); // 10 秒超时
```

---

## 10. 资源链接

- [Jest 官方文档](https://jestjs.io/)
- [Testing Library 文档](https://testing-library.com/)
- [Playwright 文档](https://playwright.dev/)
- [测试计划完整文档](./TEST_PLAN.md)
- [安全审计清单](./SECURITY_AUDIT_CHECKLIST.md)

---

## 11. 快速命令参考

```bash
# 开发时常用命令
npm run test:watch              # 监听模式
npm test -- --coverage          # 带覆盖率
npm test -- -t "测试名称"       # 运行特定测试
npm run test:unit              # 单元测试
npm run test:integration       # 集成测试
npm run test:e2e               # E2E 测试

# CI/CD 命令
npm run test:coverage          # 生成覆盖率报告
npm run security:audit         # 安全审计
npm run lint                   # 代码检查
npm run type-check             # 类型检查
```

---

**最后更新**: 2025-12-05
**维护者**: Rolloy QA Team
