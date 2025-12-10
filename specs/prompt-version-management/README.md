# Prompt 版本管理系统 - 技术方案总览

## 项目背景

当前 Rolloy Creative OS 的创意工作台在用户使用"AI Prompt 微调"功能时，会覆盖原有 Prompt，导致用户无法追溯历史版本。本方案设计了一套完整的 Prompt 版本管理系统，实现版本追溯、切换和对比功能。

---

## 核心特性

1. **自动版本创建**
   - Session 创建时自动生成 V1
   - 每次微调生成新版本（V2, V3, ...）
   - 切换 Product State 时可选创建新版本

2. **版本切换**
   - 在版本间自由切换
   - 自动更新 Prompt、Product State、Reference Image
   - 切换版本时可筛选对应图片

3. **版本追溯**
   - 每张图片标记所属版本
   - 查看每个版本生成的图片数量
   - 版本创建时间和来源（初始/微调/状态变更）

4. **数据持久化**
   - 所有版本存储在 Supabase PostgreSQL
   - 页面刷新后状态完整恢复
   - 级联删除：删除 Session 自动删除所有版本

---

## 文档结构

```
specs/prompt-version-management/
├── README.md                      # 本文件 - 总览
├── requirements.md                # 产品需求文档 (PRD)
├── design.md                      # 技术设计文档（完整）
└── implementation-checklist.md    # 实施清单（分阶段）
```

---

## 快速开始

### 1. 阅读顺序（推荐）

1. **requirements.md** - 理解业务需求和用户场景
2. **design.md** - 掌握技术架构和实施细节
3. **implementation-checklist.md** - 按步骤实施

### 2. 关键文件清单

#### 数据库 Schema
- `supabase/migrations/20251210_prompt_versions.sql`
  - 创建 `prompt_versions` 表
  - 修改 `generated_images_v2` 表
  - 创建视图和触发器
  - 自动 Backfill 现有数据

#### TypeScript 类型
- `lib/types/prompt-version.ts`
  - `PromptVersion` - 版本实体
  - `PromptVersionSummary` - 版本摘要（用于 UI）
  - API Request/Response 类型

#### Service Layer
- `lib/services/prompt-version-service.ts`
  - `createPromptVersion()` - 创建版本
  - `listPromptVersions()` - 列出版本
  - `activateVersion()` - 激活版本
  - `getVersionImages()` - 获取版本图片

#### API Routes
- `app/api/sessions/[id]/versions/route.ts`
  - GET: 列出版本
  - POST: 创建版本
- `app/api/sessions/[id]/versions/[versionId]/activate/route.ts`
  - POST: 激活版本

#### UI Components
- `components/creative/version-selector.tsx`
  - `VersionSelector` - 完整版本选择器
  - `CompactVersionSelector` - 紧凑版（Generate Step）
  - `VersionBadge` - 图片版本标签
  - `VersionList` - 版本列表（未来对比功能）

---

## 技术架构

### 数据流示意图

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Action                             │
│                   (微调 Prompt / 切换版本)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React State)                        │
│  - promptVersions: PromptVersionSummary[]                        │
│  - activeVersionId: string                                       │
│  - editedPrompt: string                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js)                          │
│  POST /api/sessions/{id}/versions                                │
│  POST /api/sessions/{id}/versions/{versionId}/activate          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Service Layer (Business Logic)                   │
│  - createPromptVersion()                                         │
│  - activateVersion()                                             │
│  - listPromptVersions()                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Database (Supabase PostgreSQL)                 │
│  Tables: prompt_versions, generated_images_v2                    │
│  Views: v_prompt_version_summary                                 │
│  Triggers: ensure_single_active_version                          │
└─────────────────────────────────────────────────────────────────┘
```

### 数据库 ER 图

```
generation_sessions
┌──────────────────────┐
│ id (PK)              │
│ creative_name        │
│ prompt               │◀────┐
│ product_state        │     │
│ ...                  │     │
└──────────────────────┘     │
                             │ (1:N)
                             │
prompt_versions              │
┌──────────────────────┐     │
│ id (PK)              │     │
│ session_id (FK)      │─────┘
│ version_number       │
│ prompt               │
│ product_state        │
│ is_active            │──────┐
│ created_from         │      │
│ created_at           │      │ (1:N)
└──────────────────────┘      │
                              │
generated_images_v2           │
┌──────────────────────┐      │
│ id (PK)              │      │
│ session_id (FK)      │      │
│ prompt_version_id    │◀─────┘
│ image_index          │
│ storage_url          │
│ status               │
│ rating               │
└──────────────────────┘
```

---

## 实施计划

### 总体时间：4-5 天

| 阶段 | 任务 | 时间 | 负责人 |
|------|------|------|--------|
| Phase 1 | 数据库 Migration + 类型定义 | 1 天 | 后端工程师 |
| Phase 2 | API 层开发 | 1 天 | 后端工程师 |
| Phase 3 | UI 组件集成 | 1 天 | 前端工程师 |
| Phase 4 | 测试与优化 | 1 天 | QA + 工程师 |
| Phase 5 | 文档与部署 | 0.5 天 | 全员 |

详细步骤见 `implementation-checklist.md`

---

## 关键决策

### 1. 为什么选择 Supabase 而非 localStorage？

| 方面 | Supabase | localStorage |
|------|----------|--------------|
| 持久化 | ✅ 永久存储 | ❌ 清除缓存丢失 |
| 跨设备 | ✅ 云端同步 | ❌ 仅本地 |
| 查询能力 | ✅ SQL 查询 | ❌ 简单 key-value |
| 关联数据 | ✅ 外键约束 | ❌ 需要手动维护 |
| 并发控制 | ✅ 数据库事务 | ❌ 无锁机制 |

**结论**：Supabase 更适合需要持久化、关联查询和并发控制的场景。

### 2. 为什么使用 `is_active` 标记而非单独的 `active_version_id` 字段？

**优点**：
- 数据库触发器自动保证唯一性
- 查询更直观：`WHERE is_active = true`
- 避免数据不一致（orphan active_version_id）

**缺点**：
- 更新时需要两次写操作（deactivate + activate）

**权衡**：一致性 > 性能，选择 `is_active` 方案。

### 3. 为什么不支持删除单个版本？

**原因**：
- 删除版本会导致图片成为"孤儿"（prompt_version_id = NULL）
- 用户可能需要追溯历史版本
- 版本数据占用空间小（主要是文本）

**替代方案**：
- 仅支持删除整个 Session（级联删除所有版本和图片）
- 未来可以添加"归档版本"功能（标记为不可见但不删除）

---

## 扩展路线图

### Phase 2: 版本对比功能
- 并排显示两个版本的 Prompt
- Diff 高亮显示差异
- 对比每个版本生成的图片统计

### Phase 3: 智能推荐
- 基于图片评分推荐最佳版本
- 自动标记"优秀版本"
- 版本性能分析（生成速度、成功率）

### Phase 4: 版本分支
- 从某个版本创建分支（如 V2.1, V2.2）
- 树状版本结构
- 合并版本（Merge）

---

## 常见问题

### Q: 如果 Migration 失败怎么办？
**A**: 见 `implementation-checklist.md` 中的"常见问题排查"章节。

### Q: 如何在生产环境安全地运行 Migration？
**A**:
1. 先在 Staging 环境测试
2. 备份生产数据库（Supabase Dashboard）
3. 在低峰期执行 Migration
4. 监控错误日志和性能指标

### Q: 版本数量有上限吗？
**A**: 技术上无上限，但建议：
- 单个 Session 不超过 50 个版本（UI 性能考虑）
- 超过 20 个版本时使用虚拟滚动优化下拉菜单

### Q: 可以手动修改版本号吗？
**A**: 不建议。版本号由数据库自动递增，手动修改可能导致冲突。

---

## 技术支持

**文档维护者**: Chief System Architect
**创建日期**: 2025-12-10
**最后更新**: 2025-12-10
**版本**: v1.0

**反馈渠道**:
- GitHub Issues: [项目 Issues](https://github.com/your-org/rolloy-creativeos/issues)
- 技术文档: 本目录下的所有 `.md` 文件
- 实施问题: 参考 `implementation-checklist.md`

---

## 下一步行动

1. **阅读完整设计文档**: `design.md`
2. **准备开发环境**:
   ```bash
   # 安装依赖
   npm install

   # 运行类型检查
   npm run type-check

   # 启动开发服务器
   npm run dev
   ```
3. **执行 Migration**: 见 `implementation-checklist.md` Phase 1
4. **逐步实施**: 按照 Checklist 完成 Phase 2-5

---

**祝实施顺利！** 如有任何问题，请参考相关文档或提交 Issue。
