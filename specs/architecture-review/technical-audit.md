# Rolloy Creative OS - 技术架构全面审查报告

**审查日期**: 2025-12-08
**审查人**: Chief System Architect
**技术栈**: Next.js 14 + React + TypeScript + Supabase + Google Gemini API

---

## 执行摘要

Rolloy Creative OS 是一个 AI 驱动的创意资产生成系统，采用 Serverless First 架构。经过全面审查，系统整体设计合理，但存在以下**关键架构问题**需要优化：

### 严重问题 (Critical)
1. **数据流断裂**：Product State 切换后不会重新生成 Prompt，导致状态与内容不匹配
2. **Action 映射不完整**："beside" 等新动作未在 UNFOLDED/FOLDED 列表中定义
3. **状态管理混乱**：page.tsx 中 20+ useState，性能和维护性差

### 高优先级 (High)
4. **API 职责过重**：/api/generate-single 处理图片生成、存储、数据库更新等多项职责
5. **数据库字段冗余**：generated_images_v2 缺少关键性能追踪字段

### 中优先级 (Medium)
6. **INP 性能问题**：大量同步状态更新和非必要重渲染

---

## 1. 数据流架构分析

### 1.1 当前数据流

```
用户选择 ABCD
  ↓
determineProductState(B) → FOLDED/UNFOLDED
  ↓
generatePrompt() → 生成 Prompt (包含 Product State)
  ↓
用户手动切换 Product State (Line 776-803, page.tsx)
  ↓
❌ Prompt 不会重新生成，但 Reference Image 变化
  ↓
generateImage() → 使用旧 Prompt + 新 Reference Image
```

### 1.2 问题分析

**问题根源** (page.tsx Line 773-805):
```tsx
<button onClick={() => {
  setProductState("UNFOLDED");
  setReferenceImageUrl(process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || "");
}}>
  UNFOLDED（打开）
</button>
```

- **症状**：用户切换 FOLDED ↔ UNFOLDED 时，只更新了 `referenceImageUrl`，但 `editedPrompt` 保持不变
- **影响**：
  - 如果原始是 FOLDED 状态（"66cm tall, compact, one-hand lift"），切换到 UNFOLDED 后，Prompt 仍然描述折叠状态
  - Reference Image 变成打开状态，但 Prompt 描述的是折叠状态
  - 生成的图片会出现语义冲突

### 1.3 架构改进方案

**方案 A：禁止手动切换 Product State（推荐）**

**理由**：Product State 应该是 Action (B) 的**派生状态**，不应该允许用户独立修改

```typescript
// gemini-service.ts (Line 96-112)
const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold'];
```

实施步骤：
1. **移除** page.tsx 中的 Product State 切换按钮 (Line 773-805, 906-937)
2. **显示为只读**：在 Prompt 预览卡片中展示 Product State，但不允许修改
3. **添加提示**："Product State is automatically determined by your Action (B) selection"

**方案 B：重新生成 Prompt（备选）**

如果业务需求必须允许手动切换，则需要：

```tsx
const handleProductStateChange = async (newState: ProductState) => {
  setProductState(newState);
  setReferenceImageUrl(getReferenceImageUrl(newState));

  // 重新生成 Prompt
  setIsGeneratingPrompt(true);
  try {
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
        forceProductState: newState, // 强制覆盖自动判断
      }),
    });

    const data = await response.json();
    if (data.success) {
      setPrompt(data.data.prompt);
      setEditedPrompt(data.data.prompt);
    }
  } finally {
    setIsGeneratingPrompt(false);
  }
};
```

**推荐选择**：方案 A，因为：
- Product State 是 Action 的**逻辑派生**，不应该独立变化
- 避免用户混淆："为什么我选了 Walk，却能切换到 FOLDED？"
- 简化 UI 和状态管理

---

## 2. 状态管理架构

### 2.1 当前状态（page.tsx）

```tsx
// 会话状态 (3个)
const [sessions, setSessions] = useState<SessionSummary[]>([]);
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
const [isLoadingSessions, setIsLoadingSessions] = useState(true);

// 选择状态 (1个复杂对象)
const [selection, setSelection] = useState<ABCDSelection>({...});

// 工作流状态 (5个)
const [step, setStep] = useState<WorkflowStep>("select");
const [prompt, setPrompt] = useState("");
const [editedPrompt, setEditedPrompt] = useState("");
const [productState, setProductState] = useState("");
const [referenceImageUrl, setReferenceImageUrl] = useState("");
const [creativeName, setCreativeName] = useState("");

// 图片设置 (2个)
const [aspectRatio, setAspectRatio] = useState("1:1");
const [resolution, setResolution] = useState("1K");

// 生成状态 (7个)
const [images, setImages] = useState<GeneratedImage[]>([]);
const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
const [isGeneratingImages, setIsGeneratingImages] = useState(false);
const [currentImageIndex, setCurrentImageIndex] = useState(0);
const [error, setError] = useState("");
const [copied, setCopied] = useState(false);

// 灯箱状态 (2个)
const [lightboxOpen, setLightboxOpen] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);

// UI 状态 (1个)
const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(true);
```

**总计**：21 个独立的 useState

### 2.2 问题分析

1. **状态碎片化**：相关状态分散在多个 useState 中
2. **状态同步困难**：例如 `productState` 应该由 `selection.action` 派生，但却是独立状态
3. **性能影响**：每次状态更新都可能触发重渲染
4. **维护困难**：难以追踪状态变化的逻辑

### 2.3 架构改进方案

**方案 A：使用 useReducer（推荐用于复杂状态）**

```typescript
// lib/reducers/generation-reducer.ts

type GenerationState = {
  // Session
  sessions: SessionSummary[];
  currentSessionId: string | null;
  isLoadingSessions: boolean;

  // Selection & Workflow
  selection: ABCDSelection;
  step: WorkflowStep;

  // Prompt (derived from selection)
  prompt: string;
  editedPrompt: string;
  creativeName: string; // derived

  // Image Settings
  aspectRatio: string;
  resolution: string;

  // Generation
  images: GeneratedImage[];
  isGeneratingPrompt: boolean;
  isGeneratingImages: boolean;
  currentImageIndex: number;
  error: string;

  // UI
  isPromptPanelOpen: boolean;
  lightboxOpen: boolean;
  lightboxIndex: number;
  copied: boolean;
};

type GenerationAction =
  | { type: 'SET_SELECTION'; payload: ABCDSelection }
  | { type: 'SET_STEP'; payload: WorkflowStep }
  | { type: 'SET_PROMPT'; payload: string }
  | { type: 'START_GENERATING_PROMPT' }
  | { type: 'FINISH_GENERATING_PROMPT'; payload: { prompt: string } }
  | { type: 'ADD_IMAGES'; payload: GeneratedImage[] }
  | { type: 'UPDATE_IMAGE'; payload: { index: number; updates: Partial<GeneratedImage> } }
  | { type: 'LOAD_SESSION'; payload: SessionDetail }
  | { type: 'RESET' };

function generationReducer(state: GenerationState, action: GenerationAction): GenerationState {
  switch (action.type) {
    case 'SET_SELECTION':
      return {
        ...state,
        selection: action.payload,
        // 自动派生 creativeName
        creativeName: generateCreativeName(action.payload),
      };

    case 'START_GENERATING_PROMPT':
      return {
        ...state,
        isGeneratingPrompt: true,
        error: '',
      };

    case 'FINISH_GENERATING_PROMPT':
      return {
        ...state,
        isGeneratingPrompt: false,
        prompt: action.payload.prompt,
        editedPrompt: action.payload.prompt,
        step: 'prompt',
      };

    case 'LOAD_SESSION':
      return {
        ...state,
        selection: action.payload.abcd_selection,
        prompt: action.payload.prompt,
        editedPrompt: action.payload.prompt,
        images: action.payload.images,
        step: action.payload.status === 'draft' ? 'prompt' : 'generate',
      };

    case 'RESET':
      return getInitialState();

    default:
      return state;
  }
}

// Usage in page.tsx
const [state, dispatch] = useReducer(generationReducer, getInitialState());
```

**优势**：
- 集中管理所有状态
- 强制状态变化通过 actions
- 易于添加 middleware（如日志、持久化）
- 派生状态（creativeName, productState）自动计算

**方案 B：使用 Zustand（推荐用于全局状态）**

```typescript
// lib/stores/generation-store.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface GenerationStore {
  // State
  selection: ABCDSelection;
  prompt: string;
  editedPrompt: string;
  images: GeneratedImage[];

  // Derived getters
  productState: () => ProductState;
  creativeName: () => string;

  // Actions
  setSelection: (selection: ABCDSelection) => void;
  generatePrompt: () => Promise<void>;
  addImages: (images: GeneratedImage[]) => void;
  updateImage: (index: number, updates: Partial<GeneratedImage>) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationStore>()(
  devtools(
    persist(
      (set, get) => ({
        selection: { A1: '', A2: '', B: '', C: '', D: '' },
        prompt: '',
        editedPrompt: '',
        images: [],

        productState: () => determineProductState(get().selection.B),
        creativeName: () => generateCreativeName(get().selection),

        setSelection: (selection) => set({ selection }),

        generatePrompt: async () => {
          const { selection } = get();
          const productState = get().productState();

          const response = await fetch('/api/generate-prompt', {
            method: 'POST',
            body: JSON.stringify({ selection, productState }),
          });

          const data = await response.json();
          set({ prompt: data.prompt, editedPrompt: data.prompt });
        },

        reset: () => set({
          selection: { A1: '', A2: '', B: '', C: '', D: '' },
          prompt: '',
          editedPrompt: '',
          images: [],
        }),
      }),
      { name: 'generation-store' }
    )
  )
);

// Usage in page.tsx
const selection = useGenerationStore((state) => state.selection);
const setSelection = useGenerationStore((state) => state.setSelection);
const productState = useGenerationStore((state) => state.productState());
```

**优势**：
- 零样板代码
- 自动 TypeScript 支持
- DevTools 集成
- 本地持久化（自动保存用户进度）
- 性能优化（细粒度订阅）

**推荐选择**：
- **小型项目**：useReducer + Context
- **中大型项目**（Rolloy 当前情况）：**Zustand**
  - 已有 21 个 useState，复杂度高
  - 需要跨组件共享状态（Sessions, Images）
  - 需要持久化用户进度

---

## 3. API 设计分析

### 3.1 /api/generate-single 职责分析

**当前职责**（Line 175-367）：

```typescript
POST /api/generate-single {
  1. 接收请求参数 (prompt, referenceImageUrl, aspectRatio, etc.)
  2. 验证参数
  3. 构建 Scale Instruction
  4. Fetch Reference Image as Base64
  5. 初始化 Gemini Model
  6. 生成图片
  7. 上传到 Supabase Storage (uploadToStorage)
  8. 更新数据库记录 (updateImageRecord)
  9. 返回响应
}
```

**问题**：
- **单一职责原则违反**：API Route 应该只负责路由和响应格式化
- **难以测试**：图片生成、存储、数据库逻辑耦合在一起
- **难以复用**：如果需要批量生成，无法复用核心逻辑

### 3.2 架构改进方案

**推荐架构**：Service Layer Pattern

```
/api/generate-single (Route Handler - 薄层)
  ↓
ImageGenerationService (Business Logic)
  ↓
├── GeminiService.generateImage()
├── StorageService.uploadImage()
└── DatabaseService.updateImageRecord()
```

**实现**：

```typescript
// lib/services/image-generation-service.ts

export class ImageGenerationService {
  private geminiService: GeminiService;
  private storageService: StorageService;
  private databaseService: DatabaseService;

  async generateSingleImage(request: GenerateSingleImageRequest): Promise<GeneratedImage> {
    // 1. Validate request
    this.validateRequest(request);

    // 2. Build prompt with scale instruction
    const fullPrompt = this.buildFullPrompt(request);

    // 3. Generate image using Gemini
    const imageData = await this.geminiService.generateImage({
      prompt: fullPrompt,
      referenceImageUrl: request.referenceImageUrl,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
    });

    // 4. Upload to storage (parallel)
    const [storageResult] = await Promise.all([
      this.storageService.uploadImage({
        imageData,
        creativeName: request.creativeName,
        imageIndex: request.imageIndex,
      }),
      // 可以并行执行其他任务
    ]);

    // 5. Update database record
    if (request.sessionId) {
      await this.databaseService.updateImageRecord({
        sessionId: request.sessionId,
        imageIndex: request.imageIndex,
        storageUrl: storageResult.publicUrl,
        aspectRatio: request.aspectRatio,
        resolution: request.resolution,
      });
    }

    // 6. Return result
    return {
      id: `img-${request.imageIndex}`,
      url: imageData.dataUrl,
      storageUrl: storageResult.publicUrl,
      status: 'success',
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
    };
  }

  private buildFullPrompt(request: GenerateSingleImageRequest): string {
    const scaleInstruction = this.getScaleInstruction(request.productState);
    return `${request.prompt}\n\n${scaleInstruction}\n\n...`;
  }

  private getScaleInstruction(productState: ProductState): string {
    return productState === 'FOLDED'
      ? 'CRITICAL SCALE REFERENCE: The folded walker is COMPACT...'
      : 'SCALE REFERENCE: The unfolded walker reaches about waist-height...';
  }
}

// app/api/generate-single/route.ts (简化后)

import { ImageGenerationService } from '@/lib/services/image-generation-service';

const imageGenService = new ImageGenerationService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Service 层处理所有业务逻辑
    const result = await imageGenService.generateSingleImage(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleError(error);
  }
}
```

**优势**：
1. **单一职责**：API Route 只负责 HTTP 层面的事情
2. **可测试**：Service 层可以独立进行单元测试
3. **可复用**：`ImageGenerationService` 可以在其他地方复用（CLI、批量生成）
4. **可扩展**：轻松添加新功能（重试、缓存、队列）

---

## 4. 数据库设计分析

### 4.1 generated_images_v2 表结构

**当前字段**（20251206_session_tables.sql）：

```sql
CREATE TABLE generated_images_v2 (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  image_index INTEGER NOT NULL,
  status VARCHAR(20),
  storage_url TEXT,
  storage_path TEXT,
  mime_type VARCHAR(50),
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  provider VARCHAR(50),
  model VARCHAR(100),
  generation_time_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER,
  rating INTEGER,
  metadata JSONB,
  created_at TIMESTAMP,
  generated_at TIMESTAMP,
  aspect_ratio VARCHAR(10),  -- 新增 (20251208)
  resolution VARCHAR(10)      -- 新增 (20251208)
);
```

### 4.2 缺失字段分析

**问题 1：无法追踪性能指标**

当前缺少的关键字段：
- `impressions` - 展示次数
- `clicks` - 点击次数
- `conversions` - 转化次数
- `spend` - 花费
- `revenue` - 收入
- `cpa` - 单次获客成本（计算字段）
- `roas` - 广告支出回报率（计算字段）

**影响**：
- 无法在图片级别追踪广告效果
- 无法实现 "Best Performing Images" 功能
- Analytics Dashboard 无法关联到具体图片

**问题 2：无法关联 ABCD 标签**

当前 `generated_images_v2` 需要通过 `session_id → generation_sessions → abcd_selection` 两次 JOIN 才能获取 ABCD 标签。

**影响**：
- 查询效率低
- 无法快速筛选 "所有 Action=Walk 的图片"

### 4.3 架构改进方案

**方案 A：添加性能追踪字段（推荐）**

```sql
-- Migration: 20251209_add_performance_fields.sql

ALTER TABLE generated_images_v2
  -- Performance Metrics (Nullable - will be populated later via CSV import or API)
  ADD COLUMN impressions INTEGER,
  ADD COLUMN clicks INTEGER,
  ADD COLUMN conversions INTEGER,
  ADD COLUMN spend DECIMAL(10, 2),
  ADD COLUMN revenue DECIMAL(10, 2),

  -- Calculated Metrics (Generated Columns)
  ADD COLUMN cpa DECIMAL(10, 2) GENERATED ALWAYS AS (
    CASE
      WHEN conversions > 0 THEN spend / conversions
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN roas DECIMAL(10, 2) GENERATED ALWAYS AS (
    CASE
      WHEN spend > 0 THEN revenue / spend
      ELSE NULL
    END
  ) STORED,

  -- ABCD Tags (Denormalized for faster queries)
  ADD COLUMN a1_tag VARCHAR(50),
  ADD COLUMN a2_tag VARCHAR(50),
  ADD COLUMN b_tag VARCHAR(50),
  ADD COLUMN c_tag VARCHAR(50),
  ADD COLUMN d_tag VARCHAR(50);

-- Create indexes for analytics queries
CREATE INDEX idx_images_performance ON generated_images_v2(cpa, roas) WHERE status = 'success';
CREATE INDEX idx_images_abcd ON generated_images_v2(a1_tag, a2_tag, b_tag, c_tag, d_tag);
```

**优势**：
- 支持图片级别的性能分析
- 计算字段自动更新
- 索引优化查询性能

**方案 B：创建 Materialized View（备选）**

如果不想修改表结构，可以创建视图：

```sql
CREATE MATERIALIZED VIEW mv_image_analytics AS
SELECT
  img.id,
  img.session_id,
  img.image_index,
  img.storage_url,
  img.rating,
  sess.abcd_selection->>'A1' as a1_tag,
  sess.abcd_selection->>'B' as b_tag,
  -- Join with analytics_data table for performance metrics
  analytics.impressions,
  analytics.clicks,
  analytics.conversions,
  analytics.spend,
  analytics.revenue,
  CASE
    WHEN analytics.conversions > 0
    THEN analytics.spend / analytics.conversions
  END as cpa,
  CASE
    WHEN analytics.spend > 0
    THEN analytics.revenue / analytics.spend
  END as roas
FROM generated_images_v2 img
JOIN generation_sessions sess ON img.session_id = sess.id
LEFT JOIN analytics_data analytics ON img.id = analytics.image_id;

-- Refresh daily or on-demand
CREATE UNIQUE INDEX ON mv_image_analytics(id);
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_image_analytics;
```

**推荐选择**：方案 A（直接添加字段）
- 更简单直接
- 实时更新
- 避免 VIEW 刷新开销

---

## 5. 性能架构分析（INP 问题）

### 5.1 INP 问题根本原因

**INP (Interaction to Next Paint)** 衡量用户交互到页面响应的延迟。

**当前问题点**：

1. **同步状态更新过多** (page.tsx)
   ```tsx
   // Line 534-537: 每次点击都更新整个 images 数组
   const toggleImageSelection = useCallback((id: string) => {
     startTransition(() => {
       setImages(prev => prev.map(img =>
         img.id === id ? { ...img, selected: !img.selected } : img
       ));
     });
   }, []);
   ```

   **问题**：即使只改变一张图片的选中状态，也会创建新的整个数组，导致所有图片组件重新渲染。

2. **非必要的计算** (page.tsx Line 580-602)
   ```tsx
   // 每次渲染都重新计算（即使 images 未变化）
   const { successCount, failedCount, selectedCount, savedCount } = useMemo(() => ({
     successCount: images.filter(img => img.status === "success").length,
     failedCount: images.filter(img => img.status === "failed").length,
     selectedCount: images.filter(img => img.selected).length,
     savedCount: images.filter(img => img.storageUrl).length,
   }), [images]);
   ```

   **问题**：虽然使用了 `useMemo`，但依赖项 `images` 在每次状态更新时都会变化。

3. **图片组件未优化** (page.tsx Line 1023-1142)
   ```tsx
   {images.map((image, index) => (
     <div key={image.id}>
       {/* 复杂的 DOM 结构 */}
     </div>
   ))}
   ```

   **问题**：没有使用 `React.memo`，父组件重新渲染时所有图片都会重新渲染。

### 5.2 架构改进方案

**优化 1：使用 Map 替代 Array（核心优化）**

```typescript
// 将 images 从 Array 改为 Map
const [images, setImages] = useState<Map<string, GeneratedImage>>(new Map());

// 更新单个图片（O(1) 时间复杂度）
const toggleImageSelection = useCallback((id: string) => {
  setImages(prev => {
    const next = new Map(prev);
    const img = next.get(id);
    if (img) {
      next.set(id, { ...img, selected: !img.selected });
    }
    return next;
  });
}, []);

// 渲染时转换为数组
const imageArray = useMemo(() => Array.from(images.values()), [images]);
```

**优势**：
- 更新单个图片时，不需要遍历整个数组
- 减少不必要的对象创建
- 更快的查找和更新操作

**优化 2：提取 ImageCard 组件并 memo**

```typescript
// components/creative/image-card.tsx

import { memo } from 'react';

interface ImageCardProps {
  image: GeneratedImage;
  index: number;
  onToggleSelection: (id: string) => void;
  onRatingChange: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
  onZoom: (index: number) => void;
}

export const ImageCard = memo(function ImageCard({
  image,
  index,
  onToggleSelection,
  onRatingChange,
  onDelete,
  onZoom,
}: ImageCardProps) {
  // 将 page.tsx Line 1023-1142 的代码移到这里

  return (
    <div className={cn(/* ... */)}>
      {/* 图片渲染逻辑 */}
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较逻辑：只有当前图片变化时才重新渲染
  return (
    prevProps.image.id === nextProps.image.id &&
    prevProps.image.status === nextProps.image.status &&
    prevProps.image.selected === nextProps.image.selected &&
    prevProps.image.rating === nextProps.image.rating &&
    prevProps.image.url === nextProps.image.url
  );
});

// page.tsx 中使用
{imageArray.map((image, index) => (
  <ImageCard
    key={image.id}
    image={image}
    index={index}
    onToggleSelection={toggleImageSelection}
    onRatingChange={handleRatingChange}
    onDelete={handleDeleteImage}
    onZoom={openLightbox}
  />
))}
```

**优势**：
- 只有变化的图片会重新渲染
- 减少 Virtual DOM diff 的开销
- 提升交互响应速度

**优化 3：使用虚拟滚动（超过 20 张图片时）**

```typescript
// 使用 react-window 或 react-virtualized

import { FixedSizeGrid as Grid } from 'react-window';

<Grid
  columnCount={4}
  columnWidth={200}
  height={600}
  rowCount={Math.ceil(imageArray.length / 4)}
  rowHeight={200}
  width={800}
>
  {({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * 4 + columnIndex;
    const image = imageArray[index];
    if (!image) return null;

    return (
      <div style={style}>
        <ImageCard image={image} {...} />
      </div>
    );
  }}
</Grid>
```

**优势**：
- 只渲染可见区域的图片
- 支持数千张图片无性能问题
- 减少 DOM 节点数量

**优化 4：图片懒加载**

```tsx
<img
  src={image.url}
  loading="lazy"  // 原生懒加载
  decoding="async"  // 异步解码
  alt={`Generated ${index + 1}`}
/>
```

---

## 6. Action 到 Product State 映射

### 6.1 当前映射逻辑

**gemini-service.ts (Line 96-112)**:

```typescript
const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold'];

export function determineProductState(action: string): ProductState {
  const normalizedAction = action.toLowerCase();

  if (UNFOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'UNFOLDED';
  }

  if (FOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'FOLDED';
  }

  // Default to UNFOLDED for unknown actions
  return 'UNFOLDED';
}
```

**abcd-matrix.ts (Line 48-61)** - B Options 定义:

```typescript
const B_OPTIONS: ABCDOption[] = [
  { id: 'b_walk', label: 'Walk', category: 'B' },
  { id: 'b_sit', label: 'Sit', category: 'B' },
  { id: 'b_turn', label: 'Turn', category: 'B' },
  { id: 'b_stand', label: 'Stand', category: 'B' },
  { id: 'b_rest', label: 'Rest', category: 'B' },
  { id: 'b_lift', label: 'Lift', category: 'B' },
  { id: 'b_pack', label: 'Pack', category: 'B' },
  { id: 'b_carry', label: 'Carry', category: 'B' },
  { id: 'b_car_trunk', label: 'Car-Trunk', category: 'B' },
];
```

### 6.2 问题："beside" 动作未定义

**问题**：用户提到 "beside" 动作，但该动作未在：
1. `abcd-matrix.ts` 的 `B_OPTIONS` 中定义
2. `gemini-service.ts` 的 `UNFOLDED_ACTIONS` 或 `FOLDED_ACTIONS` 中映射

**影响**：
- 如果前端添加了 "beside" 选项，会触发 `determineProductState` 的 default 逻辑（返回 UNFOLDED）
- 可能不符合业务预期

### 6.3 架构改进方案

**步骤 1：明确 "beside" 的业务含义**

需要产品团队确认：
- **"beside"** 是指什么场景？
  - 选项 A："产品放在旁边"（类似 Stand，应该是 UNFOLDED）
  - 选项 B："携带在身边"（类似 Carry，应该是 FOLDED）

**步骤 2：更新 ABCD Matrix**

假设 "beside" 是 "Stand beside"（放在旁边），应该归类为 UNFOLDED：

```typescript
// abcd-matrix.ts

const B_OPTIONS: ABCDOption[] = [
  // UNFOLDED actions
  { id: 'b_walk', label: 'Walk', category: 'B', description: 'Walking with stroller' },
  { id: 'b_sit', label: 'Sit', category: 'B', description: 'Baby sitting in stroller' },
  { id: 'b_turn', label: 'Turn', category: 'B', description: 'Turning/maneuvering' },
  { id: 'b_stand', label: 'Stand', category: 'B', description: 'Stationary/parked' },
  { id: 'b_rest', label: 'Rest', category: 'B', description: 'Resting/napping' },
  { id: 'b_beside', label: 'Beside', category: 'B', description: 'Product beside user' }, // 新增

  // FOLDED actions
  { id: 'b_lift', label: 'Lift', category: 'B', description: 'Lifting the stroller' },
  { id: 'b_pack', label: 'Pack', category: 'B', description: 'Packing/storing' },
  { id: 'b_carry', label: 'Carry', category: 'B', description: 'Carrying folded' },
  { id: 'b_car_trunk', label: 'Car-Trunk', category: 'B', description: 'Placing in car trunk' },
];

export const UNFOLDED_ACTIONS = ['Walk', 'Sit', 'Turn', 'Stand', 'Rest', 'Beside'] as const;
export const FOLDED_ACTIONS = ['Lift', 'Pack', 'Carry', 'Car-Trunk'] as const;
```

**步骤 3：更新 Service 层映射**

```typescript
// gemini-service.ts

const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll', 'beside'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold'];
```

**步骤 4：添加单元测试**

```typescript
// __tests__/state-router.test.ts

describe('determineProductState', () => {
  it('should map "beside" to UNFOLDED', () => {
    expect(determineProductState('beside')).toBe('UNFOLDED');
    expect(determineProductState('Beside')).toBe('UNFOLDED');
    expect(determineProductState('BESIDE')).toBe('UNFOLDED');
  });

  it('should handle unknown actions with default UNFOLDED', () => {
    expect(determineProductState('unknown-action')).toBe('UNFOLDED');
  });
});
```

**推荐**：
1. **明确定义所有可能的 Actions**：避免依赖 default 逻辑
2. **单一数据源**：`B_OPTIONS` 应该是唯一的 Actions 定义源
3. **类型安全**：使用 TypeScript 的 `as const` 确保类型检查

---

## 7. 改进实施路线图

### Phase 1: 核心架构修复（Critical - 1 周）

#### 任务 1.1：修复 Product State 数据流
- [ ] 移除 page.tsx 中的手动 Product State 切换按钮
- [ ] 将 Product State 显示为只读的派生状态
- [ ] 添加用户提示："Product State is auto-determined by Action (B)"

#### 任务 1.2：完善 Action 映射
- [ ] 在 `abcd-matrix.ts` 中添加 "beside" 到 B_OPTIONS
- [ ] 更新 `gemini-service.ts` 中的 UNFOLDED_ACTIONS
- [ ] 添加单元测试覆盖所有 Actions

#### 任务 1.3：重构 API 架构
- [ ] 创建 `ImageGenerationService` 类
- [ ] 将 `/api/generate-single` 的业务逻辑迁移到 Service 层
- [ ] 添加单元测试

### Phase 2: 状态管理优化（High - 1 周）

#### 任务 2.1：引入 Zustand
- [ ] 安装 `npm install zustand`
- [ ] 创建 `lib/stores/generation-store.ts`
- [ ] 迁移 page.tsx 中的状态到 Zustand
- [ ] 添加持久化配置

#### 任务 2.2：性能优化
- [ ] 提取 `ImageCard` 组件并使用 `memo`
- [ ] 将 images Array 改为 Map 结构
- [ ] 添加图片懒加载

### Phase 3: 数据库增强（Medium - 3 天）

#### 任务 3.1：添加性能追踪字段
- [ ] 创建 Migration `20251209_add_performance_fields.sql`
- [ ] 添加 impressions, clicks, conversions, spend, revenue 字段
- [ ] 创建计算列 cpa, roas
- [ ] 添加索引优化查询

#### 任务 3.2：测试数据导入
- [ ] 从 CSV 导入性能数据的脚本
- [ ] 验证计算列自动更新

### Phase 4: 高级优化（Optional - 1 周）

#### 任务 4.1：虚拟滚动
- [ ] 安装 `npm install react-window`
- [ ] 实现虚拟滚动的图片网格
- [ ] 性能测试（1000+ 图片）

#### 任务 4.2：Analytics Dashboard
- [ ] 创建图片级别的性能分析页面
- [ ] Top Performing Images 视图
- [ ] ABCD 交叉分析

---

## 8. 架构决策记录（ADR）

### ADR-001: Product State 为派生状态，不允许手动覆盖

**日期**: 2025-12-08
**状态**: 建议采纳
**背景**: 用户可以手动切换 FOLDED/UNFOLDED，导致与 Action (B) 不一致
**决策**: Product State 应该始终由 `determineProductState(B)` 自动计算
**后果**:
- ✅ 保证数据一致性
- ✅ 简化 UI 逻辑
- ❌ 用户失去手动覆盖的灵活性（但这是正确的限制）

### ADR-002: 使用 Zustand 替代 useState 进行状态管理

**日期**: 2025-12-08
**状态**: 建议采纳
**背景**: page.tsx 有 21 个独立 useState，难以维护
**决策**: 迁移到 Zustand 进行集中式状态管理
**后果**:
- ✅ 更好的组织和维护性
- ✅ 自动持久化用户进度
- ✅ DevTools 支持
- ❌ 学习曲线（但 Zustand 非常简单）

### ADR-003: API Route 采用 Service Layer Pattern

**日期**: 2025-12-08
**状态**: 建议采纳
**背景**: `/api/generate-single` 职责过重，难以测试
**决策**: 提取业务逻辑到独立的 Service 类
**后果**:
- ✅ 单一职责
- ✅ 易于测试和复用
- ✅ 更好的错误处理
- ❌ 增加文件数量（但提升代码质量）

### ADR-004: 数据库添加性能追踪字段

**日期**: 2025-12-08
**状态**: 建议采纳
**背景**: 当前无法追踪图片级别的广告效果
**决策**: 在 `generated_images_v2` 表中添加性能字段
**后果**:
- ✅ 支持图片级别的性能分析
- ✅ 计算列自动更新 CPA/ROAS
- ❌ 表结构变更（需要 Migration）

---

## 9. 总结与建议

### 当前架构优势

1. ✅ **技术栈选择合理**：Next.js 14 + Supabase 是成熟的 BaaS 方案
2. ✅ **数据库设计良好**：Session 和 Images 分表，支持增量生成
3. ✅ **RLS 安全性**：Supabase RLS 保证数据访问控制
4. ✅ **类型安全**：全面的 TypeScript 覆盖

### 关键问题与优先级

| 问题 | 严重性 | 优先级 | 预计工时 |
|------|--------|--------|----------|
| Product State 数据流断裂 | Critical | P0 | 4h |
| Action 映射不完整 | Critical | P0 | 2h |
| API 职责过重 | High | P1 | 8h |
| 状态管理混乱 | High | P1 | 16h |
| 数据库字段缺失 | Medium | P2 | 4h |
| INP 性能问题 | Medium | P2 | 8h |

**总预计工时**：42 小时（约 1 周）

### 架构改进核心原则

1. **Single Source of Truth**：Product State 应该由 Action (B) 唯一决定
2. **Separation of Concerns**：API 层、Service 层、数据层职责分离
3. **Performance First**：使用 memo、虚拟化、懒加载优化 INP
4. **Type Safety**：利用 TypeScript 防止运行时错误

### 下一步行动

**立即执行**（本周）：
1. 修复 Product State 数据流（移除手动切换）
2. 补全 Action 映射（添加 "beside"）
3. 引入 Zustand 状态管理

**后续规划**（下周）：
4. 重构 API 为 Service Layer
5. 添加数据库性能字段
6. 性能优化（memo + 虚拟滚动）

---

**审查完成日期**: 2025-12-08
**下次审查计划**: 2025-12-15（实施 Phase 1 后）
