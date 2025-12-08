# Rolloy Creative OS - 架构改进实施方案

**版本**: 1.0
**创建日期**: 2025-12-08
**负责人**: 开发团队

---

## 实施概览

基于技术架构审查，本文档提供具体的代码级别实施方案，包括：
- 具体代码修改位置
- 迁移步骤
- 测试检查清单
- 回滚方案

---

## Phase 1: 核心数据流修复（Critical - 4-6 小时）

### 任务 1.1：修复 Product State 数据流

#### 问题
Product State 手动切换导致与 Prompt 不匹配

#### 解决方案
将 Product State 改为只读的派生状态

#### 代码修改

**1. 删除手动切换按钮**

文件：`/Users/tony/rolloy-creativeos/app/page.tsx`

删除以下代码段：

```tsx
// Line 756-805 - Prompt Step 中的切换按钮
<div className="flex gap-2">
  <button type="button" onClick={() => {
    setProductState("UNFOLDED");
    setReferenceImageUrl(process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || "");
  }}>
    UNFOLDED（打开）
  </button>
  <button type="button" onClick={() => {
    setProductState("FOLDED");
    setReferenceImageUrl(process.env.NEXT_PUBLIC_FOLDED_IMAGE_URL || "");
  }}>
    FOLDED（折叠）
  </button>
</div>

// Line 906-937 - Generate Step 中的切换按钮
<div className="flex gap-1">
  <button onClick={() => { /* ... */ }}>打开</button>
  <button onClick={() => { /* ... */ }}>折叠</button>
</div>
```

**2. 替换为只读显示**

```tsx
{/* Product State Display (Read-only) */}
<div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
  {referenceImageUrl && (
    <img
      src={referenceImageUrl}
      alt="Product Reference"
      className="w-24 h-24 object-cover rounded-lg border"
    />
  )}
  <div className="flex-1 space-y-2">
    <div className="flex items-center justify-between">
      <p className="font-medium">Product State</p>
      <span className="text-xs text-muted-foreground">
        Auto-determined by your Action (B) selection
      </span>
    </div>
    <div className={cn(
      "inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2",
      productState === "UNFOLDED"
        ? "border-green-500 bg-green-50 text-green-700"
        : "border-blue-500 bg-blue-50 text-blue-700"
    )}>
      <span className="font-semibold">
        {productState === "UNFOLDED" ? "UNFOLDED (Open)" : "FOLDED (Compact)"}
      </span>
    </div>
    <p className="text-xs text-muted-foreground">
      {productState === "UNFOLDED"
        ? "Product is in use, fully open and functional"
        : "Product is compact, portable, folded for storage/transport"}
    </p>
  </div>
</div>
```

**3. 确保 Product State 自动更新**

在 `handleGeneratePrompt` 函数中验证逻辑（已正确实现，无需修改）：

```tsx
// Line 343-386
const handleGeneratePrompt = async () => {
  // ...
  const response = await fetch("/api/generate-prompt", {
    method: "POST",
    body: JSON.stringify({ selection }),
  });

  const data = await response.json();
  if (data.success) {
    setPrompt(data.data.prompt);
    setEditedPrompt(data.data.prompt);
    setProductState(data.data.productState);  // ✅ 自动设置
    setReferenceImageUrl(data.data.referenceImageUrl);  // ✅ 自动设置
    setCreativeName(data.data.creativeName);
    setStep("prompt");
  }
};
```

#### 测试清单

- [ ] 选择 Action = "Walk" → Product State 显示为 "UNFOLDED"
- [ ] 选择 Action = "Carry" → Product State 显示为 "FOLDED"
- [ ] Product State 区域显示为灰色（禁用状态）
- [ ] 提示文字 "Auto-determined by your Action (B) selection" 可见
- [ ] 切换不同的 Action (B)，Product State 自动更新

---

### 任务 1.2：完善 Action 映射

#### 问题
"beside" 动作未在映射列表中定义

#### 解决方案
添加 "beside" 到 ABCD Matrix 和映射逻辑

#### 代码修改

**1. 更新 ABCD Matrix**

文件：`/Users/tony/rolloy-creativeos/lib/constants/abcd-matrix.ts`

```tsx
// Line 48-61 - B_OPTIONS
const B_OPTIONS: ABCDOption[] = [
  // UNFOLDED actions (product in use, open state)
  { id: 'b_walk', label: 'Walk', category: 'B', description: 'Walking with stroller' },
  { id: 'b_sit', label: 'Sit', category: 'B', description: 'Baby sitting in stroller' },
  { id: 'b_turn', label: 'Turn', category: 'B', description: 'Turning/maneuvering' },
  { id: 'b_stand', label: 'Stand', category: 'B', description: 'Stationary/parked' },
  { id: 'b_rest', label: 'Rest', category: 'B', description: 'Resting/napping' },
  { id: 'b_beside', label: 'Beside', category: 'B', description: 'Product beside user' },  // 新增

  // FOLDED actions (product compact, storage state)
  { id: 'b_lift', label: 'Lift', category: 'B', description: 'Lifting the stroller' },
  { id: 'b_pack', label: 'Pack', category: 'B', description: 'Packing/storing' },
  { id: 'b_carry', label: 'Carry', category: 'B', description: 'Carrying folded' },
  { id: 'b_car_trunk', label: 'Car-Trunk', category: 'B', description: 'Placing in car trunk' },
];

// Line 226-227 - 更新常量
export const UNFOLDED_ACTIONS = ['Walk', 'Sit', 'Turn', 'Stand', 'Rest', 'Beside'] as const;
export const FOLDED_ACTIONS = ['Lift', 'Pack', 'Carry', 'Car-Trunk'] as const;
```

**2. 更新 Gemini Service 映射**

文件：`/Users/tony/rolloy-creativeos/lib/services/gemini-service.ts`

```tsx
// Line 96-97
const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll', 'beside'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold'];
```

**3. 添加单元测试**

文件：`/Users/tony/rolloy-creativeos/__tests__/state-router.test.ts`

```typescript
import { determineProductState } from '@/lib/services/gemini-service';

describe('Product State Routing', () => {
  describe('UNFOLDED actions', () => {
    const unfoldedActions = ['walk', 'sit', 'turn', 'stand', 'rest', 'beside', 'using', 'stroll', 'push', 'roll'];

    test.each(unfoldedActions)('"%s" should map to UNFOLDED', (action) => {
      expect(determineProductState(action)).toBe('UNFOLDED');
    });

    test('should be case-insensitive', () => {
      expect(determineProductState('BESIDE')).toBe('UNFOLDED');
      expect(determineProductState('Beside')).toBe('UNFOLDED');
      expect(determineProductState('bEsIdE')).toBe('UNFOLDED');
    });
  });

  describe('FOLDED actions', () => {
    const foldedActions = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold'];

    test.each(foldedActions)('"%s" should map to FOLDED', (action) => {
      expect(determineProductState(action)).toBe('FOLDED');
    });
  });

  describe('Unknown actions', () => {
    test('should default to UNFOLDED', () => {
      expect(determineProductState('unknown')).toBe('UNFOLDED');
      expect(determineProductState('random-action')).toBe('UNFOLDED');
      expect(determineProductState('')).toBe('UNFOLDED');
    });
  });
});
```

#### 测试清单

- [ ] 运行 `npm test -- state-router.test.ts`，所有测试通过
- [ ] 在 UI 中选择 "Beside" → Product State 显示 "UNFOLDED"
- [ ] 生成的 Prompt 包含 UNFOLDED 相关描述（"waist-height", "in-use"）

---

### 任务 1.3：添加数据库 Migration

#### 问题
需要将新的 Action "Beside" 同步到数据库

#### 解决方案
创建数据库 Migration，更新 ABCD 种子数据

#### 代码修改

**创建新 Migration 文件**

文件：`/Users/tony/rolloy-creativeos/supabase/migrations/20251209_add_beside_action.sql`

```sql
-- Rolloy Creative OS - Add "Beside" Action to ABCD Matrix
-- Run this in Supabase SQL Editor

-- Insert new B action into abcd_options table (if it exists)
INSERT INTO abcd_options (dimension, value, label, description, sort_order)
VALUES ('B', 'beside', 'Beside', 'Product beside user', 6)
ON CONFLICT (dimension, value) DO NOTHING;

-- Update product_state_mapping if it exists
INSERT INTO product_state_mapping (action, product_state)
VALUES ('beside', 'UNFOLDED')
ON CONFLICT (action) DO UPDATE SET product_state = 'UNFOLDED';

-- Log update
DO $$
BEGIN
  RAISE NOTICE 'Added "Beside" action to B dimension (UNFOLDED state)';
END
$$;
```

**运行 Migration**

```bash
cd /Users/tony/rolloy-creativeos
npx supabase db push
```

---

## Phase 2: 状态管理重构（High - 8-16 小时）

### 任务 2.1：引入 Zustand

#### 安装依赖

```bash
npm install zustand
```

#### 创建 Store

文件：`/Users/tony/rolloy-creativeos/lib/stores/generation-store.ts`

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ABCDSelection } from '@/lib/types';
import { determineProductState, getReferenceImageUrl } from '@/lib/services/gemini-service';

// ============================================================================
// Types
// ============================================================================

interface GeneratedImage {
  id: string;
  url: string;
  storageUrl: string | null;
  selected: boolean;
  rating: number;
  status: "pending" | "generating" | "success" | "failed";
  aspectRatio?: string;
  resolution?: string;
}

type WorkflowStep = "select" | "prompt" | "generate";

interface GenerationState {
  // Selection & Workflow
  selection: ABCDSelection;
  step: WorkflowStep;

  // Prompt
  prompt: string;
  editedPrompt: string;
  creativeName: string;

  // Image Settings
  aspectRatio: string;
  resolution: string;

  // Generation State
  images: Map<string, GeneratedImage>;
  isGeneratingPrompt: boolean;
  isGeneratingImages: boolean;
  currentImageIndex: number;
  error: string;

  // UI State
  isPromptPanelOpen: boolean;
  lightboxOpen: boolean;
  lightboxIndex: number;
  copied: boolean;
}

interface GenerationActions {
  // Selection Actions
  setSelection: (selection: ABCDSelection) => void;

  // Workflow Actions
  setStep: (step: WorkflowStep) => void;

  // Prompt Actions
  generatePrompt: () => Promise<void>;
  setEditedPrompt: (prompt: string) => void;

  // Image Actions
  addImages: (images: GeneratedImage[]) => void;
  updateImage: (id: string, updates: Partial<GeneratedImage>) => void;
  deleteImage: (id: string) => void;
  toggleImageSelection: (id: string) => void;
  updateImageRating: (id: string, rating: number) => void;

  // Generation Actions
  startGeneratingPrompt: () => void;
  finishGeneratingPrompt: (prompt: string) => void;
  startGeneratingImages: () => void;
  stopGeneratingImages: () => void;

  // UI Actions
  togglePromptPanel: () => void;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  setCopied: (copied: boolean) => void;

  // Settings Actions
  setAspectRatio: (ratio: string) => void;
  setResolution: (resolution: string) => void;

  // Utility Actions
  reset: () => void;

  // Derived Getters
  getProductState: () => "FOLDED" | "UNFOLDED";
  getReferenceImageUrl: () => string;
  getImageArray: () => GeneratedImage[];
  getStats: () => {
    successCount: number;
    failedCount: number;
    selectedCount: number;
    savedCount: number;
  };
}

type GenerationStore = GenerationState & GenerationActions;

// ============================================================================
// Initial State
// ============================================================================

const getInitialState = (): GenerationState => ({
  selection: {
    sceneCategory: "",
    sceneDetail: "",
    action: "",
    driver: "",
    format: "",
  },
  step: "select",
  prompt: "",
  editedPrompt: "",
  creativeName: "",
  aspectRatio: "1:1",
  resolution: "1K",
  images: new Map(),
  isGeneratingPrompt: false,
  isGeneratingImages: false,
  currentImageIndex: 0,
  error: "",
  isPromptPanelOpen: true,
  lightboxOpen: false,
  lightboxIndex: 0,
  copied: false,
});

// ============================================================================
// Store
// ============================================================================

export const useGenerationStore = create<GenerationStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...getInitialState(),

        // Selection Actions
        setSelection: (selection) => {
          const creativeName = generateCreativeName(selection);
          set({ selection, creativeName });
        },

        // Workflow Actions
        setStep: (step) => set({ step }),

        // Prompt Actions
        generatePrompt: async () => {
          const { selection } = get();

          set({ isGeneratingPrompt: true, error: "" });

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
              }),
            });

            const data = await response.json();

            if (data.success) {
              set({
                prompt: data.data.prompt,
                editedPrompt: data.data.prompt,
                creativeName: data.data.creativeName,
                step: "prompt",
                isGeneratingPrompt: false,
              });
            } else {
              set({
                error: data.error?.message || "Failed to generate prompt",
                isGeneratingPrompt: false,
              });
            }
          } catch (error) {
            set({
              error: "Network error. Please try again.",
              isGeneratingPrompt: false,
            });
          }
        },

        setEditedPrompt: (editedPrompt) => set({ editedPrompt }),

        // Image Actions
        addImages: (images) => {
          const imageMap = get().images;
          images.forEach((img) => imageMap.set(img.id, img));
          set({ images: new Map(imageMap) });
        },

        updateImage: (id, updates) => {
          const imageMap = get().images;
          const image = imageMap.get(id);
          if (image) {
            imageMap.set(id, { ...image, ...updates });
            set({ images: new Map(imageMap) });
          }
        },

        deleteImage: (id) => {
          const imageMap = get().images;
          imageMap.delete(id);
          set({ images: new Map(imageMap) });
        },

        toggleImageSelection: (id) => {
          const imageMap = get().images;
          const image = imageMap.get(id);
          if (image) {
            imageMap.set(id, { ...image, selected: !image.selected });
            set({ images: new Map(imageMap) });
          }
        },

        updateImageRating: (id, rating) => {
          const imageMap = get().images;
          const image = imageMap.get(id);
          if (image) {
            imageMap.set(id, { ...image, rating });
            set({ images: new Map(imageMap) });
          }
        },

        // Generation Actions
        startGeneratingPrompt: () => set({ isGeneratingPrompt: true, error: "" }),
        finishGeneratingPrompt: (prompt) => set({
          prompt,
          editedPrompt: prompt,
          isGeneratingPrompt: false,
          step: "prompt",
        }),
        startGeneratingImages: () => set({ isGeneratingImages: true, error: "" }),
        stopGeneratingImages: () => set({ isGeneratingImages: false }),

        // UI Actions
        togglePromptPanel: () => set((state) => ({ isPromptPanelOpen: !state.isPromptPanelOpen })),
        openLightbox: (lightboxIndex) => set({ lightboxOpen: true, lightboxIndex }),
        closeLightbox: () => set({ lightboxOpen: false }),
        setCopied: (copied) => set({ copied }),

        // Settings Actions
        setAspectRatio: (aspectRatio) => set({ aspectRatio }),
        setResolution: (resolution) => set({ resolution }),

        // Utility Actions
        reset: () => set(getInitialState()),

        // Derived Getters
        getProductState: () => {
          const { selection } = get();
          return determineProductState(selection.action);
        },

        getReferenceImageUrl: () => {
          const productState = get().getProductState();
          return getReferenceImageUrl(productState);
        },

        getImageArray: () => {
          const { images } = get();
          return Array.from(images.values());
        },

        getStats: () => {
          const images = get().getImageArray();
          return {
            successCount: images.filter((img) => img.status === "success").length,
            failedCount: images.filter((img) => img.status === "failed").length,
            selectedCount: images.filter((img) => img.selected).length,
            savedCount: images.filter((img) => img.storageUrl).length,
          };
        },
      }),
      {
        name: "generation-store",
        partialize: (state) => ({
          // 只持久化必要的数据
          selection: state.selection,
          aspectRatio: state.aspectRatio,
          resolution: state.resolution,
        }),
      }
    ),
    { name: "GenerationStore" }
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

function generateCreativeName(selection: ABCDSelection): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${date}_${selection.sceneCategory}_${selection.sceneDetail}_${selection.action}_${selection.driver}_${selection.format}`;
}
```

#### 迁移 page.tsx 到 Zustand

文件：`/Users/tony/rolloy-creativeos/app/page.tsx`

**迁移前**（21 个 useState）:
```tsx
const [selection, setSelection] = useState<ABCDSelection>({...});
const [step, setStep] = useState<WorkflowStep>("select");
const [prompt, setPrompt] = useState("");
// ... 18 more useState
```

**迁移后**:
```tsx
import { useGenerationStore } from '@/lib/stores/generation-store';

export default function HomePage() {
  // Selection & Workflow
  const selection = useGenerationStore((state) => state.selection);
  const setSelection = useGenerationStore((state) => state.setSelection);
  const step = useGenerationStore((state) => state.step);
  const setStep = useGenerationStore((state) => state.setStep);

  // Prompt
  const prompt = useGenerationStore((state) => state.prompt);
  const editedPrompt = useGenerationStore((state) => state.editedPrompt);
  const setEditedPrompt = useGenerationStore((state) => state.setEditedPrompt);
  const generatePrompt = useGenerationStore((state) => state.generatePrompt);

  // Images
  const images = useGenerationStore((state) => state.getImageArray());
  const toggleImageSelection = useGenerationStore((state) => state.toggleImageSelection);
  const updateImageRating = useGenerationStore((state) => state.updateImageRating);
  const deleteImage = useGenerationStore((state) => state.deleteImage);

  // Stats (derived)
  const stats = useGenerationStore((state) => state.getStats());

  // Derived states
  const productState = useGenerationStore((state) => state.getProductState());
  const referenceImageUrl = useGenerationStore((state) => state.getReferenceImageUrl());

  // ... rest of the component
}
```

#### 性能优化

使用 Zustand 的细粒度订阅，避免不必要的重渲染：

```tsx
// ❌ 不好：订阅整个 state，任何变化都会重新渲染
const state = useGenerationStore();

// ✅ 好：只订阅需要的字段
const selection = useGenerationStore((state) => state.selection);
const images = useGenerationStore((state) => state.getImageArray());

// ✅ 最好：使用 shallow 比较（对于对象/数组）
import { shallow } from 'zustand/shallow';

const { selection, images } = useGenerationStore(
  (state) => ({ selection: state.selection, images: state.getImageArray() }),
  shallow
);
```

#### 测试清单

- [ ] 安装 Zustand 后 `npm run build` 无错误
- [ ] 页面加载后状态正常（selection, images 等）
- [ ] 状态持久化工作正常（刷新页面后状态保留）
- [ ] DevTools 可以查看状态变化
- [ ] 性能测试：切换图片选中状态不会导致其他图片重新渲染

---

## Phase 3: API 架构重构（Medium - 8 小时）

### 任务 3.1：创建 Service Layer

#### 目录结构

```
lib/services/
├── gemini-service.ts          (已存在)
├── session-service.ts          (已存在)
├── image-generation-service.ts (新建)
├── storage-service.ts          (新建)
└── database-service.ts         (新建)
```

#### 代码实现

**1. Storage Service**

文件：`/Users/tony/rolloy-creativeos/lib/services/storage-service.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STORAGE_BUCKET = 'creative-assets';

export interface UploadImageRequest {
  base64Data: string;
  mimeType: string;
  creativeName: string;
  imageIndex: number;
}

export interface UploadImageResult {
  publicUrl: string;
  storagePath: string;
}

export class StorageService {
  private supabase;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured');
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async uploadImage(request: UploadImageRequest): Promise<UploadImageResult | null> {
    try {
      const { base64Data, mimeType, creativeName, imageIndex } = request;

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Create storage path
      const extension = mimeType.includes('png') ? 'png' : 'jpg';
      const fileName = `${String(imageIndex + 1).padStart(2, '0')}.${extension}`;
      const storagePath = `generated/${creativeName}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600',
        });

      if (error) {
        console.error('Storage upload error:', error.message);
        return null;
      }

      // Get public URL
      const { data: publicUrlData } = this.supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);

      return {
        publicUrl: publicUrlData.publicUrl,
        storagePath: data.path,
      };
    } catch (error) {
      console.error('Failed to upload to storage:', error);
      return null;
    }
  }

  async deleteImage(storagePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

      if (error) {
        console.error('Storage delete error:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete from storage:', error);
      return false;
    }
  }
}
```

**2. Database Service**

文件：`/Users/tony/rolloy-creativeos/lib/services/database-service.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface UpdateImageRecordRequest {
  sessionId: string;
  imageIndex: number;
  storageUrl: string;
  storagePath: string;
  aspectRatio: string;
  resolution: string;
}

export class DatabaseService {
  private supabase;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured');
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async updateImageRecord(request: UpdateImageRecordRequest): Promise<boolean> {
    try {
      const { sessionId, imageIndex, storageUrl, storagePath, aspectRatio, resolution } = request;

      const { error } = await this.supabase
        .from('generated_images_v2')
        .update({
          status: 'success',
          storage_url: storageUrl,
          storage_path: storagePath,
          generated_at: new Date().toISOString(),
          aspect_ratio: aspectRatio,
          resolution: resolution,
        })
        .eq('session_id', sessionId)
        .eq('image_index', imageIndex + 1); // DB is 1-based

      if (error) {
        console.error('Failed to update image record:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database update failed:', error);
      return false;
    }
  }
}
```

**3. Image Generation Service**

文件：`/Users/tony/rolloy-creativeos/lib/services/image-generation-service.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StorageService } from './storage-service';
import { DatabaseService } from './database-service';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';

export interface GenerateSingleImageRequest {
  prompt: string;
  referenceImageUrl: string;
  imageIndex: number;
  totalImages: number;
  creativeName: string;
  sessionId?: string;
  aspectRatio: string;
  resolution: string;
  productState: "FOLDED" | "UNFOLDED";
}

export interface GeneratedImageResult {
  imageUrl: string;
  storageUrl: string | null;
  storagePath: string | null;
  imageIndex: number;
}

export class ImageGenerationService {
  private storageService: StorageService;
  private databaseService: DatabaseService;

  constructor() {
    this.storageService = new StorageService();
    this.databaseService = new DatabaseService();
  }

  async generateSingleImage(request: GenerateSingleImageRequest): Promise<GeneratedImageResult> {
    const {
      prompt,
      referenceImageUrl,
      imageIndex,
      totalImages,
      creativeName,
      sessionId,
      aspectRatio,
      resolution,
      productState,
    } = request;

    // 1. Build full prompt
    const fullPrompt = this.buildFullPrompt(prompt, productState, imageIndex, totalImages, aspectRatio);

    // 2. Fetch reference image
    const referenceImageBase64 = await this.fetchImageAsBase64(referenceImageUrl);
    const mimeType = referenceImageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // 3. Generate image
    const imageData = await this.generateImage({
      prompt: fullPrompt,
      referenceImageBase64,
      mimeType,
      resolution,
    });

    // 4. Upload to storage
    const storageResult = await this.storageService.uploadImage({
      base64Data: imageData.base64,
      mimeType: imageData.mimeType,
      creativeName,
      imageIndex,
    });

    // 5. Update database
    if (sessionId && storageResult) {
      await this.databaseService.updateImageRecord({
        sessionId,
        imageIndex,
        storageUrl: storageResult.publicUrl,
        storagePath: storageResult.storagePath,
        aspectRatio,
        resolution,
      });
    }

    // 6. Return result
    return {
      imageUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
      storageUrl: storageResult?.publicUrl || null,
      storagePath: storageResult?.storagePath || null,
      imageIndex,
    };
  }

  private buildFullPrompt(
    basePrompt: string,
    productState: "FOLDED" | "UNFOLDED",
    variationIndex: number,
    totalVariations: number,
    aspectRatio: string
  ): string {
    const scaleInstruction = this.getScaleInstruction(productState);

    return `Create a commercial advertising photograph based on this reference product image.

${basePrompt}

${scaleInstruction}

CRITICAL INSTRUCTIONS:
1. PRODUCT PRESERVATION: The red 'Rolloy Compact Master' rollator must be rendered EXACTLY as shown in the reference image - same design, color, and components. No modifications.
2. SCALE ACCURACY: Maintain realistic proportions - the product size relative to humans must match real-world scale.
3. VARIATION: This is variation ${variationIndex + 1} of ${totalVariations} - create a unique scene with different camera angle, lighting, or composition.
4. ASPECT RATIO: Output in ${aspectRatio} format.
5. QUALITY: Commercial photography style, Photorealistic, Ultra high definition (UHD), professional lighting.`;
  }

  private getScaleInstruction(productState: "FOLDED" | "UNFOLDED"): string {
    return productState === "FOLDED"
      ? `CRITICAL SCALE REFERENCE: The folded walker is COMPACT - only 66cm (26 inches) tall, about knee-height of an adult. It should appear SMALL relative to any human subjects, easily held with one hand. Similar size to a small carry-on suitcase.`
      : `SCALE REFERENCE: The unfolded walker reaches about waist-height of a standing senior. Hands rest comfortably on the handles at hip level.`;
  }

  private async fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }

  private async generateImage(params: {
    prompt: string;
    referenceImageBase64: string;
    mimeType: string;
    resolution: string;
  }): Promise<{ base64: string; mimeType: string }> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      generationConfig: {
        // @ts-ignore
        responseModalities: ['IMAGE'],
        // @ts-ignore
        imageConfig: {
          imageSize: params.resolution,
        },
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: params.mimeType,
          data: params.referenceImageBase64,
        },
      },
      { text: params.prompt },
    ]);

    const response = await result.response;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ('inlineData' in part && part.inlineData?.data) {
          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
      }
    }

    throw new Error('Gemini did not return an image');
  }
}
```

**4. 重构 API Route**

文件：`/Users/tony/rolloy-creativeos/app/api/generate-single/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationService } from '@/lib/services/image-generation-service';
import type { APIResponse } from '@/lib/types';

const imageGenService = new ImageGenerationService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    if (!body.prompt || !body.referenceImageUrl || !body.creativeName) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields',
          },
        },
        { status: 400 }
      );
    }

    // Delegate to service layer
    const result = await imageGenService.generateSingleImage(body);

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/generate-single:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate image',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}
```

#### 测试清单

- [ ] API 调用成功返回图片
- [ ] 图片上传到 Supabase Storage
- [ ] 数据库记录正确更新
- [ ] 错误处理正常（网络错误、Gemini 错误、存储错误）
- [ ] Service 类可以独立进行单元测试

---

## Phase 4: 数据库增强（Medium - 4 小时）

### 任务 4.1：添加性能追踪字段

#### Migration 文件

文件：`/Users/tony/rolloy-creativeos/supabase/migrations/20251209_add_performance_fields.sql`

```sql
-- Rolloy Creative OS - Add Performance Tracking Fields
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. Add Performance Metrics to generated_images_v2
-- ============================================================================

ALTER TABLE generated_images_v2
  -- Performance Metrics (Nullable - populated via CSV import or API)
  ADD COLUMN IF NOT EXISTS impressions INTEGER,
  ADD COLUMN IF NOT EXISTS clicks INTEGER,
  ADD COLUMN IF NOT EXISTS conversions INTEGER,
  ADD COLUMN IF NOT EXISTS spend DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS revenue DECIMAL(10, 2);

-- ============================================================================
-- 2. Add Calculated Columns (CPA & ROAS)
-- ============================================================================

-- CPA (Cost Per Acquisition) - only calculated if conversions > 0
ALTER TABLE generated_images_v2
  ADD COLUMN IF NOT EXISTS cpa DECIMAL(10, 2)
  GENERATED ALWAYS AS (
    CASE
      WHEN conversions > 0 THEN spend / conversions
      ELSE NULL
    END
  ) STORED;

-- ROAS (Return On Ad Spend) - only calculated if spend > 0
ALTER TABLE generated_images_v2
  ADD COLUMN IF NOT EXISTS roas DECIMAL(10, 2)
  GENERATED ALWAYS AS (
    CASE
      WHEN spend > 0 THEN revenue / spend
      ELSE NULL
    END
  ) STORED;

-- ============================================================================
-- 3. Add ABCD Tags (Denormalized for faster queries)
-- ============================================================================

ALTER TABLE generated_images_v2
  ADD COLUMN IF NOT EXISTS a1_tag VARCHAR(50),
  ADD COLUMN IF NOT EXISTS a2_tag VARCHAR(50),
  ADD COLUMN IF NOT EXISTS b_tag VARCHAR(50),
  ADD COLUMN IF NOT EXISTS c_tag VARCHAR(50),
  ADD COLUMN IF NOT EXISTS d_tag VARCHAR(50);

-- ============================================================================
-- 4. Create Indexes for Performance Queries
-- ============================================================================

-- Index for analytics queries (best performing images)
CREATE INDEX IF NOT EXISTS idx_images_performance
  ON generated_images_v2(cpa, roas)
  WHERE status = 'success' AND cpa IS NOT NULL;

-- Index for ABCD filtering
CREATE INDEX IF NOT EXISTS idx_images_abcd
  ON generated_images_v2(a1_tag, a2_tag, b_tag, c_tag, d_tag);

-- Index for time-based analytics
CREATE INDEX IF NOT EXISTS idx_images_created_at
  ON generated_images_v2(created_at DESC)
  WHERE status = 'success';

-- ============================================================================
-- 5. Create Trigger to Auto-Populate ABCD Tags
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_abcd_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- Populate ABCD tags from the related session
  SELECT
    (sess.abcd_selection->>'A1')::VARCHAR(50),
    (sess.abcd_selection->>'A2')::VARCHAR(50),
    (sess.abcd_selection->>'B')::VARCHAR(50),
    (sess.abcd_selection->>'C')::VARCHAR(50),
    (sess.abcd_selection->>'D')::VARCHAR(50)
  INTO
    NEW.a1_tag,
    NEW.a2_tag,
    NEW.b_tag,
    NEW.c_tag,
    NEW.d_tag
  FROM generation_sessions sess
  WHERE sess.id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (runs on INSERT)
DROP TRIGGER IF EXISTS trg_populate_abcd_tags ON generated_images_v2;
CREATE TRIGGER trg_populate_abcd_tags
  BEFORE INSERT ON generated_images_v2
  FOR EACH ROW
  EXECUTE FUNCTION populate_abcd_tags();

-- ============================================================================
-- 6. Backfill ABCD Tags for Existing Records
-- ============================================================================

UPDATE generated_images_v2 img
SET
  a1_tag = (sess.abcd_selection->>'A1')::VARCHAR(50),
  a2_tag = (sess.abcd_selection->>'A2')::VARCHAR(50),
  b_tag = (sess.abcd_selection->>'B')::VARCHAR(50),
  c_tag = (sess.abcd_selection->>'C')::VARCHAR(50),
  d_tag = (sess.abcd_selection->>'D')::VARCHAR(50)
FROM generation_sessions sess
WHERE img.session_id = sess.id
  AND img.a1_tag IS NULL;

-- ============================================================================
-- 7. Create Materialized View for Top Performers
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_performing_images AS
SELECT
  id,
  session_id,
  image_index,
  storage_url,
  a1_tag,
  a2_tag,
  b_tag,
  c_tag,
  d_tag,
  impressions,
  clicks,
  conversions,
  spend,
  revenue,
  cpa,
  roas,
  rating,
  created_at
FROM generated_images_v2
WHERE
  status = 'success'
  AND cpa IS NOT NULL
  AND roas IS NOT NULL
ORDER BY roas DESC
LIMIT 100;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_performers_id
  ON mv_top_performing_images(id);

-- ============================================================================
-- 8. Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN generated_images_v2.impressions IS 'Number of times the ad was shown';
COMMENT ON COLUMN generated_images_v2.clicks IS 'Number of clicks on the ad';
COMMENT ON COLUMN generated_images_v2.conversions IS 'Number of conversions attributed to this ad';
COMMENT ON COLUMN generated_images_v2.spend IS 'Total spend on this ad (USD)';
COMMENT ON COLUMN generated_images_v2.revenue IS 'Total revenue from this ad (USD)';
COMMENT ON COLUMN generated_images_v2.cpa IS 'Cost Per Acquisition (auto-calculated)';
COMMENT ON COLUMN generated_images_v2.roas IS 'Return On Ad Spend (auto-calculated)';
COMMENT ON COLUMN generated_images_v2.a1_tag IS 'ABCD Tag A1 (denormalized for fast queries)';

-- ============================================================================
-- Done!
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Performance tracking fields added successfully';
  RAISE NOTICE 'Run: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_performing_images;';
END $$;
```

#### 运行 Migration

```bash
cd /Users/tony/rolloy-creativeos
npx supabase db push
```

#### 刷新 Materialized View（定期任务）

```sql
-- 在 Supabase Dashboard 或 cron job 中运行
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_performing_images;
```

#### 测试清单

- [ ] Migration 成功运行，无错误
- [ ] `generated_images_v2` 表包含新字段
- [ ] 插入新记录时 ABCD tags 自动填充
- [ ] 计算列 `cpa` 和 `roas` 自动计算
- [ ] 索引创建成功，查询性能提升
- [ ] Materialized View 包含数据

---

## 回滚方案

### Phase 1 回滚

如果出现问题，恢复 page.tsx 中的 Product State 切换按钮：

```bash
git checkout HEAD -- app/page.tsx
```

### Phase 2 回滚

卸载 Zustand，恢复 useState：

```bash
npm uninstall zustand
git checkout HEAD -- app/page.tsx lib/stores/
```

### Phase 3 回滚

删除新的 Service 文件，恢复原始 API Route：

```bash
rm -f lib/services/image-generation-service.ts
rm -f lib/services/storage-service.ts
rm -f lib/services/database-service.ts
git checkout HEAD -- app/api/generate-single/route.ts
```

### Phase 4 回滚

运行回滚 Migration：

```sql
-- 20251209_rollback_performance_fields.sql

DROP MATERIALIZED VIEW IF EXISTS mv_top_performing_images;
DROP TRIGGER IF EXISTS trg_populate_abcd_tags ON generated_images_v2;
DROP FUNCTION IF EXISTS populate_abcd_tags();

ALTER TABLE generated_images_v2
  DROP COLUMN IF EXISTS impressions,
  DROP COLUMN IF EXISTS clicks,
  DROP COLUMN IF EXISTS conversions,
  DROP COLUMN IF EXISTS spend,
  DROP COLUMN IF EXISTS revenue,
  DROP COLUMN IF EXISTS cpa,
  DROP COLUMN IF EXISTS roas,
  DROP COLUMN IF EXISTS a1_tag,
  DROP COLUMN IF EXISTS a2_tag,
  DROP COLUMN IF EXISTS b_tag,
  DROP COLUMN IF EXISTS c_tag,
  DROP COLUMN IF EXISTS d_tag;
```

---

## 验收标准

### Phase 1 完成标准
- [ ] Product State 无法手动切换
- [ ] Product State 显示为只读，带有自动计算提示
- [ ] "Beside" 动作可选，映射到 UNFOLDED
- [ ] 所有单元测试通过

### Phase 2 完成标准
- [ ] Zustand 成功集成，DevTools 可用
- [ ] 状态持久化正常工作
- [ ] 页面刷新后状态保留
- [ ] 性能改善：图片选中操作 <50ms

### Phase 3 完成标准
- [ ] Service 层成功提取
- [ ] API Route 代码行数减少 50%
- [ ] Service 类通过单元测试
- [ ] 功能无回归

### Phase 4 完成标准
- [ ] 数据库包含性能字段
- [ ] 计算列自动更新
- [ ] Materialized View 创建成功
- [ ] 查询性能提升（测试用 EXPLAIN ANALYZE）

---

## 最后检查清单

在发布到生产环境前，确保：

- [ ] 所有代码通过 TypeScript 类型检查 (`npm run type-check`)
- [ ] 所有单元测试通过 (`npm test`)
- [ ] 在开发环境完整测试流程（选择 → 生成 Prompt → 生成图片）
- [ ] 检查 Supabase Dashboard 中的数据正确性
- [ ] 代码已经过 Code Review
- [ ] 更新了相关文档（README, API 文档）
- [ ] 创建了 Git Tag (`git tag v1.1.0`)

---

**实施完成日期**：待定
**预计完成时间**：1-2 周（根据团队规模）
