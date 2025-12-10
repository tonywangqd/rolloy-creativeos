# Prompt 版本管理系统 - 架构图

本文档提供系统架构的可视化图表，帮助快速理解系统设计。

---

## 1. 整体系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Browser (Client)                               │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    React Components                               │   │
│  │                                                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ page.tsx     │  │ Version      │  │ Image Card   │           │   │
│  │  │              │  │ Selector     │  │ (with Badge) │           │   │
│  │  │ - Prompt UI  │  │              │  │              │           │   │
│  │  │ - Gallery    │  │ - Dropdown   │  │ - V{N} tag   │           │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘           │   │
│  │         │                 │                                       │   │
│  │         └─────────────────┴──────────────────────┐               │   │
│  │                                                   │               │   │
│  │  ┌────────────────────────────────────────────────▼────────────┐ │   │
│  │  │              React State Management                         │ │   │
│  │  │  - promptVersions: PromptVersionSummary[]                   │ │   │
│  │  │  - activeVersionId: string                                  │ │   │
│  │  │  - editedPrompt: string                                     │ │   │
│  │  └────────────────────────────────────────────────┬────────────┘ │   │
│  └────────────────────────────────────────────────────┼──────────────┘   │
│                                                       │                  │
└───────────────────────────────────────────────────────┼──────────────────┘
                                                        │
                                         HTTP API Calls │
                                                        │
┌───────────────────────────────────────────────────────▼──────────────────┐
│                        Vercel Edge (Server)                               │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Next.js API Routes                           │   │
│  │                                                                    │   │
│  │  GET  /api/sessions/{id}/versions                                │   │
│  │  POST /api/sessions/{id}/versions                                │   │
│  │  POST /api/sessions/{id}/versions/{versionId}/activate           │   │
│  │  POST /api/refine-prompt  (modified to create version)           │   │
│  │  POST /api/generate-single (modified to link version)            │   │
│  │                                                                    │   │
│  └────────────────────────────────┬──────────────────────────────────┘   │
│                                   │                                      │
│  ┌────────────────────────────────▼──────────────────────────────────┐   │
│  │                    Service Layer                                  │   │
│  │                                                                    │   │
│  │  - prompt-version-service.ts                                      │   │
│  │    • createPromptVersion()                                        │   │
│  │    • listPromptVersions()                                         │   │
│  │    • activateVersion()                                            │   │
│  │    • getVersionImages()                                           │   │
│  │                                                                    │   │
│  │  - session-service.ts (modified)                                  │   │
│  │    • createSession() → auto create V1                             │   │
│  │                                                                    │   │
│  └────────────────────────────────┬──────────────────────────────────┘   │
│                                   │                                      │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
                       Supabase JS Client
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│                      Supabase (PostgreSQL)                                │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Database Tables                              │   │
│  │                                                                    │   │
│  │  ┌─────────────────────┐                                         │   │
│  │  │ generation_sessions │                                         │   │
│  │  │ - id                │                                         │   │
│  │  │ - creative_name     │                                         │   │
│  │  │ - prompt            │                                         │   │
│  │  │ - product_state     │                                         │   │
│  │  └──────────┬──────────┘                                         │   │
│  │             │ 1:N                                                 │   │
│  │             ▼                                                     │   │
│  │  ┌─────────────────────┐       ┌──────────────────────┐         │   │
│  │  │ prompt_versions     │       │ generated_images_v2  │         │   │
│  │  │ - id (PK)           │  1:N  │ - id (PK)            │         │   │
│  │  │ - session_id (FK)   │◀──────│ - prompt_version_id  │         │   │
│  │  │ - version_number    │       │ - session_id         │         │   │
│  │  │ - prompt            │       │ - storage_url        │         │   │
│  │  │ - product_state     │       │ - status             │         │   │
│  │  │ - is_active         │       │ - rating             │         │   │
│  │  │ - created_from      │       └──────────────────────┘         │   │
│  │  │ - created_at        │                                         │   │
│  │  └─────────────────────┘                                         │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Views & Triggers                             │   │
│  │                                                                    │   │
│  │  View: v_prompt_version_summary                                  │   │
│  │   - Aggregates version info with image counts                    │   │
│  │                                                                    │   │
│  │  Trigger: ensure_single_active_version                           │   │
│  │   - Ensures only one active version per session                  │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 版本创建流程（微调 Prompt）

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. 输入微调指令: "让woman更专业"
     │
     ▼
┌────────────────────────────────┐
│  Frontend (page.tsx)           │
│  handleRefinePrompt()          │
└────┬───────────────────────────┘
     │ 2. POST /api/refine-prompt
     │    Body: {
     │      originalPrompt: "...",
     │      refinementInstruction: "让woman更专业",
     │      session_id: "uuid-123"
     │    }
     ▼
┌────────────────────────────────┐
│  API: /api/refine-prompt       │
└────┬───────────────────────────┘
     │ 3. Call Gemini API
     │
     ▼
┌────────────────────────────────┐
│  Gemini AI                     │
│  生成 refined prompt            │
└────┬───────────────────────────┘
     │ 4. Return refined prompt
     │
     ▼
┌────────────────────────────────┐
│  API: /api/refine-prompt       │
│  createPromptVersion()         │
└────┬───────────────────────────┘
     │ 5. Create new version in DB
     │    INSERT INTO prompt_versions
     │    SET version_number = 2
     │        is_active = true
     │
     ▼
┌────────────────────────────────┐
│  Database Trigger              │
│  ensure_single_active_version  │
└────┬───────────────────────────┘
     │ 6. Auto deactivate V1
     │    UPDATE prompt_versions
     │    SET is_active = false
     │    WHERE session_id = uuid-123
     │      AND id != new_version_id
     │
     ▼
┌────────────────────────────────┐
│  API Response                  │
│  { version: {...}, number: 2 } │
└────┬───────────────────────────┘
     │ 7. Return to frontend
     │
     ▼
┌────────────────────────────────┐
│  Frontend (page.tsx)           │
│  - Update editedPrompt         │
│  - Reload promptVersions       │
│  - Set activeVersionId = V2    │
└────┬───────────────────────────┘
     │ 8. Re-render UI
     │
     ▼
┌─────────┐
│  User   │
│  看到:   │
│  - V2 在下拉菜单中显示       │
│  - Prompt 编辑框显示新内容   │
└─────────┘
```

---

## 3. 版本切换流程

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. 从下拉菜单选择 V1
     │
     ▼
┌────────────────────────────────┐
│  Frontend (VersionSelector)    │
│  onVersionChange(v1_id)        │
└────┬───────────────────────────┘
     │ 2. POST /api/sessions/{sid}/versions/{v1_id}/activate
     │
     ▼
┌────────────────────────────────┐
│  API: activate version         │
│  activateVersion(sid, v1_id)   │
└────┬───────────────────────────┘
     │ 3. Database operations
     │
     ▼
┌────────────────────────────────┐
│  Step 1: Deactivate all        │
│  UPDATE prompt_versions        │
│  SET is_active = false         │
│  WHERE session_id = sid        │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Step 2: Activate target       │
│  UPDATE prompt_versions        │
│  SET is_active = true          │
│  WHERE id = v1_id              │
└────┬───────────────────────────┘
     │ 4. Return version data
     │    { version: {...} }
     ▼
┌────────────────────────────────┐
│  Frontend (page.tsx)           │
│  handleVersionSwitch()         │
└────┬───────────────────────────┘
     │ 5. Update all related state
     │    - editedPrompt
     │    - productState
     │    - referenceImageUrl
     │    - activeVersionId
     │
     ▼
┌────────────────────────────────┐
│  UI Components                 │
│  - Prompt editor updates       │
│  - Product state updates       │
│  - Version selector highlights │
└────┬───────────────────────────┘
     │ 6. Re-render
     │
     ▼
┌─────────┐
│  User   │
│  看到:   │
│  - V1 高亮显示               │
│  - Prompt 显示 V1 的内容     │
│  - Product State 切换        │
└─────────┘
```

---

## 4. 图片生成与版本关联流程

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. 点击 "Generate 4 Images"
     │    (当前激活版本: V2)
     │
     ▼
┌────────────────────────────────┐
│  Frontend (page.tsx)           │
│  handleGenerateBatch()         │
└────┬───────────────────────────┘
     │ 2. For each image (1-4):
     │
     ├──▶ POST /api/generate-single
     │    Body: {
     │      prompt: "...",
     │      sessionId: "uuid-123",
     │      active_version_id: "v2-uuid",  ◀── KEY: 关联版本
     │      imageIndex: 0
     │    }
     │
     ▼
┌────────────────────────────────┐
│  API: /api/generate-single     │
└────┬───────────────────────────┘
     │ 3. Create image record
     │    INSERT INTO generated_images_v2
     │    SET prompt_version_id = v2-uuid  ◀── 存储版本关联
     │        session_id = uuid-123
     │        image_index = 0
     │        status = 'generating'
     │
     ▼
┌────────────────────────────────┐
│  Gemini Image Generation       │
└────┬───────────────────────────┘
     │ 4. Generate image
     │
     ▼
┌────────────────────────────────┐
│  Supabase Storage              │
│  Upload image                  │
└────┬───────────────────────────┘
     │ 5. Get storage_url
     │
     ▼
┌────────────────────────────────┐
│  Database Update               │
│  UPDATE generated_images_v2    │
│  SET storage_url = "...",      │
│      status = 'success'        │
│  WHERE id = image_id           │
└────┬───────────────────────────┘
     │ 6. Return to frontend
     │
     ▼
┌────────────────────────────────┐
│  Frontend (page.tsx)           │
│  Update images state           │
│  - Add to images array         │
│  - Set promptVersionId = V2    │
│  - Set promptVersionNumber = 2 │
└────┬───────────────────────────┘
     │ 7. Render image card
     │
     ▼
┌────────────────────────────────┐
│  Image Card Component          │
│  - Display image               │
│  - Show VersionBadge: "V2"     │
└────┬───────────────────────────┘
     │
     ▼
┌─────────┐
│  User   │
│  看到:   │
│  - 图片显示 V2 标签           │
│  - 可以追溯到生成它的版本     │
└─────────┘
```

---

## 5. 数据库关系图（详细）

```
┌─────────────────────────────────────────────────────────────┐
│ generation_sessions                                         │
├─────────────────────────────────────────────────────────────┤
│ id                    UUID (PK)                             │
│ creative_name         VARCHAR(255)                          │
│ abcd_selection        JSONB                                 │
│ prompt                TEXT    ◀──────────┐                  │
│ product_state         VARCHAR(20)        │ Snapshot in      │
│ reference_image_url   TEXT               │ prompt_versions  │
│ total_images          INTEGER            │                  │
│ status                VARCHAR(20)        │                  │
│ created_at            TIMESTAMP          │                  │
│ updated_at            TIMESTAMP          │                  │
└─────────┬───────────────────────────────────────────────────┘
          │
          │ 1:N (One session has many versions)
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ prompt_versions                                             │
├─────────────────────────────────────────────────────────────┤
│ id                    UUID (PK)                             │
│ session_id            UUID (FK → generation_sessions.id)    │
│ version_number        INTEGER   ◀── Auto-increment per session
│ prompt                TEXT                                  │
│ prompt_chinese        TEXT                                  │
│ product_state         VARCHAR(20)  ◀── FOLDED | UNFOLDED   │
│ reference_image_url   TEXT                                  │
│ created_from          VARCHAR(50)  ◀── initial | refinement | product_state_change
│ refinement_instruction TEXT                                 │
│ is_active             BOOLEAN   ◀── Only ONE per session   │
│ created_at            TIMESTAMP                             │
│                                                              │
│ UNIQUE(session_id, version_number)                          │
│ INDEX: (session_id, is_active) WHERE is_active = true       │
└─────────┬───────────────────────────────────────────────────┘
          │
          │ 1:N (One version has many images)
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ generated_images_v2                                         │
├─────────────────────────────────────────────────────────────┤
│ id                    UUID (PK)                             │
│ session_id            UUID (FK → generation_sessions.id)    │
│ prompt_version_id     UUID (FK → prompt_versions.id) ◀── NEW│
│ image_index           INTEGER                               │
│ storage_url           TEXT                                  │
│ storage_path          TEXT                                  │
│ status                VARCHAR(20)                           │
│ rating                INTEGER                               │
│ aspect_ratio          VARCHAR(10)                           │
│ resolution            VARCHAR(10)                           │
│ created_at            TIMESTAMP                             │
│ generated_at          TIMESTAMP                             │
│                                                              │
│ INDEX: (session_id)                                         │
│ INDEX: (prompt_version_id)  ◀── NEW                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 状态管理流程（Frontend）

```
┌───────────────────────────────────────────────────────────────┐
│                      React State Tree                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Session State                                          │  │
│  │ - currentSessionId: string | null                      │  │
│  │ - sessions: SessionSummary[]                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Version State (NEW)                                    │  │
│  │ - promptVersions: PromptVersionSummary[]               │  │
│  │ - activeVersionId: string | null                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                           ▲                                   │
│                           │ Controls                          │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Prompt State                                           │  │
│  │ - prompt: string                                       │  │
│  │ - editedPrompt: string                                 │  │
│  │ - chinesePrompt: string                                │  │
│  │ - productState: 'FOLDED' | 'UNFOLDED'                  │  │
│  │ - referenceImageUrl: string                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Image State                                            │  │
│  │ - images: GeneratedImage[]                             │  │
│  │   └─ Each image has:                                   │  │
│  │      - promptVersionId: string                         │  │
│  │      - promptVersionNumber: number                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘

State Update Triggers:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Load Session → loadPromptVersions()
   - Fetch all versions for session
   - Set activeVersionId

2. Refine Prompt → handleRefinePrompt()
   - Create new version via API
   - Reload versions
   - Update editedPrompt

3. Switch Version → handleVersionSwitch()
   - Activate version via API
   - Update editedPrompt, productState, referenceImageUrl
   - Update activeVersionId

4. Generate Image → handleGenerateBatch()
   - Pass activeVersionId to API
   - Store promptVersionId in image

5. Load Images → handleSessionSelect()
   - Map promptVersionId to version_number
   - Display VersionBadge on image cards
```

---

## 7. UI 组件层次结构

```
page.tsx (Main Page)
│
├── SessionList
│   └── SessionItem (multiple)
│       └── Delete button
│
├── ABCDSelector
│   └── Dropdown menus
│
├── NamingCard
│   └── Display creative name
│
└── Main Content Area
    │
    ├── [Step: "prompt"]
    │   └── Card: "Generated Prompt"
    │       ├── VersionSelector  ◀────────────── NEW
    │       │   ├── Version dropdown
    │       │   ├── Timestamp display
    │       │   └── Image count
    │       ├── Product State Selector
    │       ├── Prompt Editor (English + Chinese)
    │       ├── Refinement Input  ◀── Triggers version creation
    │       └── Image Settings (Aspect Ratio, Resolution)
    │
    └── [Step: "generate"]
        ├── Card: "Prompt Panel" (Collapsible)
        │   ├── CompactVersionSelector  ◀────────── NEW (compact)
        │   ├── Prompt Editor
        │   └── Image Settings
        │
        └── Card: "Generated Images"
            └── Image Grid
                └── Image Card (multiple)
                    ├── Image
                    ├── VersionBadge  ◀────────── NEW (shows V{N})
                    ├── Selection indicator
                    ├── Star rating
                    ├── Action buttons (Zoom, Delete)
                    └── Bottom info (Index, Ratio, Resolution)
```

---

## 8. API 调用序列图（完整流程）

```
User        Frontend       API              Service           Database
 │             │             │                 │                 │
 │ Create      │             │                 │                 │
 │ Session     │             │                 │                 │
 ├────────────▶│             │                 │                 │
 │             │ POST /sessions               │                 │
 │             ├────────────▶│                 │                 │
 │             │             │ createSession() │                 │
 │             │             ├────────────────▶│                 │
 │             │             │                 │ INSERT session  │
 │             │             │                 ├────────────────▶│
 │             │             │                 │◀────────────────┤
 │             │             │                 │                 │
 │             │             │                 │ createPromptVersion(V1)
 │             │             │                 ├────────────────▶│
 │             │             │                 │ INSERT version  │
 │             │             │                 │ (number=1,      │
 │             │             │                 │  is_active=true)│
 │             │             │                 │◀────────────────┤
 │             │             │◀────────────────┤                 │
 │             │◀────────────┤                 │                 │
 │◀────────────┤             │                 │                 │
 │             │             │                 │                 │
 │ Refine      │             │                 │                 │
 │ Prompt      │             │                 │                 │
 ├────────────▶│             │                 │                 │
 │             │ POST /refine-prompt          │                 │
 │             ├────────────▶│                 │                 │
 │             │             │ (Call Gemini AI)│                 │
 │             │             │                 │                 │
 │             │             │ createPromptVersion(V2)           │
 │             │             ├────────────────▶│                 │
 │             │             │                 │ UPDATE versions │
 │             │             │                 │ SET is_active=false
 │             │             │                 ├────────────────▶│
 │             │             │                 │                 │
 │             │             │                 │ INSERT version  │
 │             │             │                 │ (number=2,      │
 │             │             │                 │  is_active=true)│
 │             │             │                 ├────────────────▶│
 │             │             │                 │◀────────────────┤
 │             │             │◀────────────────┤                 │
 │             │◀────────────┤                 │                 │
 │◀────────────┤             │                 │                 │
 │             │             │                 │                 │
 │ Switch to   │             │                 │                 │
 │ V1          │             │                 │                 │
 ├────────────▶│             │                 │                 │
 │             │ POST /sessions/{id}/versions/{v1}/activate     │
 │             ├────────────▶│                 │                 │
 │             │             │ activateVersion()                 │
 │             │             ├────────────────▶│                 │
 │             │             │                 │ UPDATE versions │
 │             │             │                 │ SET is_active=false
 │             │             │                 ├────────────────▶│
 │             │             │                 │                 │
 │             │             │                 │ UPDATE version  │
 │             │             │                 │ SET is_active=true
 │             │             │                 │ WHERE id=v1     │
 │             │             │                 ├────────────────▶│
 │             │             │                 │◀────────────────┤
 │             │             │◀────────────────┤                 │
 │             │◀────────────┤                 │                 │
 │◀────────────┤             │                 │                 │
 │ (UI updates │             │                 │                 │
 │  to V1 prompt)            │                 │                 │
 │             │             │                 │                 │
 │ Generate    │             │                 │                 │
 │ Images      │             │                 │                 │
 ├────────────▶│             │                 │                 │
 │             │ POST /generate-single (x4)   │                 │
 │             ├────────────▶│                 │                 │
 │             │             │                 │ INSERT image    │
 │             │             │                 │ (prompt_version_id=v1)
 │             │             │                 ├────────────────▶│
 │             │             │                 │◀────────────────┤
 │             │             │ (Generate via Gemini)             │
 │             │             │                 │ UPDATE image    │
 │             │             │                 │ (storage_url,   │
 │             │             │                 │  status=success)│
 │             │             │                 ├────────────────▶│
 │             │             │◀────────────────┤                 │
 │             │◀────────────┤                 │                 │
 │◀────────────┤             │                 │                 │
 │ (Display    │             │                 │                 │
 │  image with │             │                 │                 │
 │  V1 badge)  │             │                 │                 │
```

---

## 总结

以上架构图涵盖了：
1. **整体系统分层**：Browser → Vercel → Supabase
2. **核心业务流程**：版本创建、切换、图片关联
3. **数据库设计**：表结构、关系、索引
4. **状态管理**：React State 组织
5. **UI 组件树**：层次结构
6. **API 调用序列**：完整的请求/响应流程

这些图表可以帮助开发团队快速理解系统设计，并作为实施过程中的参考文档。
