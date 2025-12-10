# Prompt微调功能 - 技术方案总结

## 项目概览

**功能名称:** Prompt Refinement (Prompt微调)

**优先级:** P1 (High)

**状态:** Design Phase - Ready for Implementation

**文档版本:** 1.0

**日期:** 2025-12-10

---

## 快速导航

- [产品需求文档 (PRD)](./requirements.md) - 业务目标、用户故事、验收标准
- [技术设计文档 (Design)](./design.md) - API设计、数据流、实现细节

---

## 功能简介

允许用户在已生成Prompt后，通过输入自然语言的调整意图（如"让这个woman是她自己在做美甲"），让AI对Prompt进行局部修改，同时保持原有ABCD选择、产品状态等配置不变。

### 用户价值

- **减少迭代时间60-80%** - 无需重新选择ABCD或手动编辑复杂Prompt
- **保持Prompt质量** - AI确保结构完整性和专业术语
- **降低使用门槛** - 用自然语言而非专业Prompt工程技能

### 技术价值

- **无数据库变更** - 完全基于现有架构
- **模块化设计** - 新增API端点和服务函数，不侵入现有代码
- **一致性** - 复用现有Gemini服务和System Prompt配置

---

## 核心设计决策

### 1. 架构设计

| 层级 | 实现方式 | 理由 |
|------|---------|------|
| **前端** | 在Generate Step的Prompt Panel中添加Refinement输入框 | 用户在看到Prompt后立即可微调 |
| **API** | 新增 `/api/refine-prompt` 端点 | 职责单一，便于测试和维护 |
| **服务** | 在 `gemini-service.ts` 中添加 `refinePrompt()` 函数 | 复用现有AI调用逻辑 |
| **数据** | 不持久化微调历史 | 微调是短期会话操作，最终Prompt已保存在Session中 |

### 2. AI提示词策略

**System Prompt核心原则:**
```
1. 只修改用户明确指定的部分
2. 保持Prompt结构完整（9个部分）
3. 绝不修改产品描述和必需声明
4. 保持150-200词长度
5. 返回完整Prompt + 变更摘要
```

**输出格式:**
```
[完整的refined prompt]

---CHANGES---
[1-2句话描述修改内容]
```

### 3. 数据流

```
User Input → Frontend Handler → POST /api/refine-prompt
                                           ↓
                                  gemini-service.refinePrompt()
                                           ↓
                                  Gemini API (text model)
                                           ↓
                        Response {refinedPrompt, changes}
                                           ↓
                        Frontend Update editedPrompt
```

---

## 实现清单

### Phase 1: 核心功能 (2-3天)

- [ ] **API层** - `/app/api/refine-prompt/route.ts`
  - [x] 类型定义 (RefinePromptRequest/Response)
  - [ ] POST handler实现
  - [ ] 输入验证
  - [ ] 错误处理

- [ ] **服务层** - `/lib/services/gemini-service.ts`
  - [ ] 添加PromptRefinementRequest/Response类型
  - [ ] 实现refinePrompt()函数
  - [ ] 定义REFINEMENT_SYSTEM_PROMPT
  - [ ] 实现buildRefinementUserPrompt()

- [ ] **前端层** - `/app/page.tsx`
  - [ ] 添加状态: refinementInput, isRefining, lastRefinementChanges
  - [ ] UI组件: Refinement输入框 + 按钮 + 变更显示
  - [ ] 实现handleRefinePrompt()
  - [ ] 集成到Generate Step的Prompt Panel

- [ ] **类型定义** - `/lib/types/prompt.ts` (新建)
  - [ ] PromptRefinementRequest
  - [ ] PromptRefinementResponse

### Phase 2: 测试 (1天)

- [ ] **单元测试**
  - [ ] refinePrompt()函数测试（各种微调场景）
  - [ ] 验证产品描述保持不变
  - [ ] 验证结构完整性

- [ ] **集成测试**
  - [ ] API端点测试（正常流程、错误处理）
  - [ ] 前端交互测试

- [ ] **手动测试**
  - [ ] 10+真实场景测试（见下文"测试场景"）

### Phase 3: 优化与文档 (1天)

- [ ] 性能优化（确保响应时间<5秒）
- [ ] 错误提示优化
- [ ] 用户文档（如何使用微调功能）

---

## 关键代码位置

### 新增文件

```
/app/api/refine-prompt/route.ts          # API端点
/lib/types/prompt.ts                     # 类型定义
/specs/prompt-refinement/design.md       # 技术设计文档
/specs/prompt-refinement/requirements.md # 产品需求文档
```

### 修改文件

```
/app/page.tsx                            # 添加UI和状态管理
/lib/services/gemini-service.ts          # 添加refinePrompt()函数
```

---

## 测试场景

### 必测场景

| 场景ID | 用户输入 | 预期结果 | 验证点 |
|--------|---------|---------|--------|
| TC-1 | "让这个woman更年轻，50岁左右" | 年龄从70s改为50s，发色可能从silver改为其他 | 年龄变化，其他不变 |
| TC-2 | "她自己在做美甲，不是在salon" | 移除salon chair和manicurist，添加nail polish和mirror | 场景变化，产品不变 |
| TC-3 | "把场景改成公园" | 室内环境改为户外公园 | 环境变化，人物和产品不变 |
| TC-4 | "让光线更温暖" | 光线描述从soft morning改为warm golden-hour | 光线变化，其他不变 |
| TC-5 | "把人物改成男性" | 性别从woman改为man，服装和发型调整 | 性别变化，产品状态保持 |

### 边界测试

| 场景ID | 用户输入 | 预期结果 |
|--------|---------|---------|
| TC-E1 | 空输入 | 按钮禁用，无法提交 |
| TC-E2 | "把walker改成蓝色" | AI忽略产品颜色修改，保持red |
| TC-E3 | 超长输入（>500字符） | 前端或后端拒绝 |
| TC-E4 | API超时 | 显示"Request timeout"错误 |
| TC-E5 | 无效指令（如"asdfgh"） | AI返回原Prompt + "No changes needed" |

---

## API接口文档

### POST /api/refine-prompt

**Request Body:**
```typescript
{
  originalPrompt: string;           // 当前Prompt全文
  refinementInstruction: string;    // 用户微调指令
  selection: {                      // ABCD上下文
    A1: string;
    A2: string;
    B: string;
    C: string;
    D: string;
  };
  productState: "FOLDED" | "UNFOLDED";
  sessionId?: string;               // 可选，用于日志
}
```

**Response:**
```typescript
{
  success: boolean;
  data?: {
    refinedPrompt: string;          // 新的Prompt
    changes: string;                 // 变更摘要
    metadata: {
      model: string;
      timestamp: string;
      tokensUsed?: number;
    };
  };
  error?: {
    code: string;                    // "INVALID_REQUEST" | "EMPTY_INSTRUCTION" | "GEMINI_API_ERROR" | "INTERNAL_ERROR"
    message: string;
    details?: string;
  };
}
```

**Status Codes:**
- `200` - 成功
- `400` - 请求参数错误
- `500` - 服务器内部错误

---

## 性能指标

### 目标

- **响应时间:** P95 < 5秒
- **成功率:** > 95% (Gemini API可用时)
- **Token使用:** 每次微调 < 1000 tokens
- **成本:** 约$0.0001/次微调

### 监控

建议添加以下日志：
```typescript
console.log('Refining prompt:', {
  instructionLength: refinementInstruction.length,
  originalPromptLength: originalPrompt.length,
  productState,
});
```

---

## 安全考虑

1. **输入验证:**
   - 前端: 限制输入长度 ≤ 500字符
   - 后端: 验证所有必需字段存在

2. **权限控制:**
   - 只能微调自己Session的Prompt（通过sessionId验证）

3. **Rate Limiting:**
   - 依赖Gemini API自带的rate limit
   - 未来可添加：每session每分钟最多10次微调

4. **日志脱敏:**
   - 服务器日志不记录完整用户输入
   - 只记录长度和关键统计信息

---

## 未来增强（Out of Scope）

以下功能不在v1.0范围内，但可在后续版本考虑：

1. **Undo/Redo功能** - 需要维护Prompt版本历史
2. **微调建议** - AI主动建议可能的改进
3. **微调模板** - 预设常用微调指令（如"Make younger", "Add warmth"）
4. **批量微调** - 对多个Prompt应用相同指令
5. **可视化Diff** - 显示修改前后的对比
6. **微调历史持久化** - 保存到数据库供分析

---

## 依赖项

### 外部依赖
- Google Gemini API (text model: gemini-2.0-flash-exp)

### 内部依赖
- `/lib/services/gemini-service.ts` - AI服务
- `/lib/services/abcd-context-service.ts` - ABCD上下文获取
- `/lib/config/prompts.ts` - System Prompt配置

### 环境变量
```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_TEXT_MODEL=gemini-2.0-flash-exp  # 可选，默认值
```

---

## 发布计划

### Week 1: 开发
- Day 1-2: 实现API和服务层
- Day 3: 实现前端UI
- Day 4: 单元测试和集成测试

### Week 2: 测试
- Day 1-2: 内部测试（50+场景）
- Day 3-5: Beta测试（10个power users）

### Week 3: 发布
- Day 1: 部署到生产环境
- Day 2-5: 监控指标，收集反馈
- Day 6-7: 优化和迭代

---

## 联系方式

**功能负责人:** Product Director

**技术负责人:** TBD

**文档维护:** Chief System Architect

**最后更新:** 2025-12-10

---

## 附录：示例微调指令

### 人物相关
```
"让这个woman更年轻，看起来50岁左右"
"把人物改成男性"
"让表情更开心"
"把头发改成黑色短发"
"让衣服更正式，穿西装"
```

### 场景相关
```
"把场景改成公园"
"在客厅里，背景有书架和植物"
"改成户外阳台"
"背景加一只宠物狗"
```

### 动作相关
```
"她自己在做美甲，不是在salon"
"她正在和家人视频通话"
"她在看书"
"她刚从超市回来，手里拎着购物袋"
```

### 光线相关
```
"让光线更温暖"
"改成傍晚的金色阳光"
"室内柔和的灯光"
"明亮的正午阳光"
```

### 组合指令
```
"让人物更年轻，场景改成公园，光线更明亮"
"把这个男性改成女性，在厨房做饭"
```

---

**END OF DOCUMENT**
