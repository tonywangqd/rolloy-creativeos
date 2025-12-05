# Rolloy Creative OS - System Architecture

**Version:** 1.0
**Last Updated:** 2025-12-05
**Tech Stack:** Next.js 14+ (App Router) | Tailwind CSS | Shadcn UI | Supabase | Vercel

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Modules](#core-modules)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Data Flow](#data-flow)
7. [Security Architecture](#security-architecture)
8. [Storage Strategy](#storage-strategy)
9. [AI Integration](#ai-integration)
10. [Performance & Optimization](#performance--optimization)
11. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### Purpose
Rolloy Creative OS is an internal web application for DTC (Direct-to-Consumer) mobility aid brand to streamline ad creative production, batch AI image generation, and performance tracking.

### Key Capabilities
- **ABCD Creative Framework**: Structured creative configuration (Scene, Action, Driver, Format)
- **AI-Powered Generation**: Gemini for prompt engineering + Flux/Nano Banana for Img2Img
- **Performance Analytics**: CSV import + automated insight generation
- **Cost Control**: API usage tracking and quota management

### Architecture Philosophy
- **Serverless-First**: Leverage Vercel Edge Network for global performance
- **Security-by-Design**: Row Level Security (RLS) enforced at database level
- **Single Source of Truth**: PostgreSQL schema drives all business logic
- **Action over API**: Prefer Next.js Server Actions for mutations

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (Browser)                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Creative       │  │  AI Visual       │  │  Performance     │  │
│  │  Workbench      │  │  Factory         │  │  Dashboard       │  │
│  │  (ABCD Config)  │  │  (Batch Gen)     │  │  (Analytics)     │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                   ┌───────────┴───────────┐
                   │   Next.js App Router  │
                   │   (Vercel Serverless) │
                   └───────────┬───────────┘
                               │
        ┏━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━┓
        ┃                                               ┃
┌───────▼────────┐  ┌──────────────────┐  ┌───────────▼───────────┐
│  Server Actions│  │   API Routes     │  │   External APIs       │
│  (Mutations)   │  │   (Webhooks)     │  │                       │
│                │  │                  │  │  ┌─────────────────┐  │
│ • Create Proj  │  │ • CSV Upload     │  │  │ Gemini API      │  │
│ • Gen Images   │  │ • Webhook RX     │  │  │ (Prompt Gen)    │  │
│ • Update State │  │                  │  │  └─────────────────┘  │
└────────┬───────┘  └────────┬─────────┘  │                       │
         │                   │             │  ┌─────────────────┐  │
         │                   │             │  │ Nano Banana API │  │
         │                   │             │  │ Flux API        │  │
         └───────────────────┼─────────────┤  │ (Img2Img)       │  │
                             │             │  └─────────────────┘  │
                             │             └───────────────────────┘
                             │
                 ┌───────────▼────────────┐
                 │   SUPABASE LAYER       │
                 ├────────────────────────┤
                 │  PostgreSQL + PostgREST│
                 │  • Row Level Security  │
                 │  • Realtime Subs       │
                 │  • Database Functions  │
                 ├────────────────────────┤
                 │  Supabase Storage      │
                 │  • Reference Images    │
                 │  • Generated Images    │
                 │  • Thumbnails          │
                 └────────────────────────┘
```

---

## Core Modules

### 1. Creative Configuration Workbench

**Purpose**: Configure ABCD parameters and generate creative naming

**Components**:
- Scene Selector (two-level: category → specific scene)
- Action Selector (determines product state)
- Driver Selector (emotional tone)
- Format Selector (composition style)
- Reference Image Gallery (filtered by product state)

**Key Features**:
- Real-time naming preview: `YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]`
- Smart reference filtering based on Action selection
- Gemini prompt generation button
- Project save/load functionality

**Technology**:
- React Server Components for data fetching
- Client components for interactive selection
- Optimistic UI updates with `useOptimistic`
- Shadcn UI components (Select, RadioGroup, Card)

---

### 2. AI Visual Factory

**Purpose**: Batch generate images using Img2Img AI models

**Workflow**:
```
1. Load Creative Project → 2. Select Reference Images →
3. Generate Flux Prompt (Gemini) → 4. Configure Batch Settings →
5. Submit to Flux/Nano Banana → 6. Monitor Progress →
7. Review Results → 8. Download/Archive
```

**Key Features**:
- Parallel image generation (queue system)
- Real-time progress tracking
- Automatic retry on failure (3 attempts)
- Image preview gallery
- Bulk download

**Technology**:
- Server Actions for queue management
- WebSocket/Polling for status updates
- Supabase Storage for image hosting
- Sharp for thumbnail generation
- Zod for API response validation

---

### 3. Performance Tracking Dashboard

**Purpose**: Import ad performance data and visualize insights

**Key Features**:
- CSV drag-and-drop upload
- Automatic image matching via naming convention
- Multi-platform support (Facebook, Google, TikTok)
- Performance tier classification (Top 10/20/50)
- ABCD correlation analysis

**Visualizations**:
- CTR trend charts (by week/month)
- Performance heatmap by ABCD parameters
- Top performer leaderboard
- Cost efficiency breakdown

**Technology**:
- Papa Parse for CSV parsing
- Recharts for data visualization
- Tanstack Table for data grids
- Server-side aggregation functions

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   scenes    │      │   actions    │      │   drivers    │
├─────────────┤      ├──────────────┤      ├──────────────┤
│ id          │      │ id           │      │ id           │
│ category    │      │ name         │      │ emotion      │
│ name        │      │ action_type  │      │ keywords[]   │
└──────┬──────┘      │ product_state│      └──────┬───────┘
       │             └──────┬───────┘             │
       │                    │                     │
       │                    │                     │
       └────────┬───────────┴───────────┬─────────┘
                │                       │
        ┌───────▼───────────────────────▼────────┐
        │       creative_projects                │
        ├────────────────────────────────────────┤
        │ id                                     │
        │ scene_id  → scenes.id                  │
        │ action_id → actions.id                 │
        │ driver_id → drivers.id                 │
        │ format_id → formats.id                 │
        │ reference_image_ids[]                  │
        │ gemini_prompt                          │
        │ generated_name (auto)                  │
        │ status (pending/processing/completed)  │
        └────────────────┬───────────────────────┘
                         │
                         │ 1:N
                         │
        ┌────────────────▼───────────────────────┐
        │       generated_images                 │
        ├────────────────────────────────────────┤
        │ id                                     │
        │ project_id → creative_projects.id      │
        │ image_url (Supabase Storage)           │
        │ reference_image_id                     │
        │ flux_prompt                            │
        │ status                                 │
        │ performance_tier                       │
        └────────────────┬───────────────────────┘
                         │
                         │ 1:N
                         │
        ┌────────────────▼───────────────────────┐
        │       performance_data                 │
        ├────────────────────────────────────────┤
        │ id                                     │
        │ generated_image_id                     │
        │ ad_name                                │
        │ impressions, clicks, ctr               │
        │ cost_usd, revenue_usd, roas            │
        │ date, platform                         │
        └────────────────────────────────────────┘
```

### Key Tables

#### creative_projects (Main Entity)
```sql
- id: UUID (PK)
- name: TEXT
- scene_id, action_id, driver_id, format_id: UUID (FK)
- reference_image_ids: UUID[] (Array of reference image IDs)
- gemini_prompt: TEXT (Generated Flux prompt)
- generated_name: TEXT (Auto: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D])
- status: ENUM(pending, processing, completed, failed)
- total_images, completed_images: INTEGER
- created_by: UUID → users.id
```

#### generated_images (Generated Assets)
```sql
- id: UUID (PK)
- project_id: UUID → creative_projects.id
- image_url: TEXT (Supabase Storage path)
- reference_image_id: UUID
- flux_prompt: TEXT
- generation_params: JSONB (strength, steps, seed, etc.)
- status: ENUM(pending, processing, completed, failed)
- performance_tier: ENUM(top_10, top_20, top_50, below_50)
```

#### performance_data (Ad Metrics)
```sql
- id: UUID (PK)
- generated_image_id: UUID → generated_images.id
- ad_name: TEXT (Matches generated_name)
- impressions, clicks, ctr: Numeric metrics
- cost_usd, revenue_usd, roas: Financial metrics
- date: DATE
- platform: TEXT (facebook, google, tiktok)
- import_batch_id: UUID (Group imports)
```

---

## API Design

### Next.js Server Actions (Primary Mutation Interface)

#### 1. Create Creative Project
```typescript
// app/actions/creative-projects.ts
'use server'

export async function createCreativeProject(data: ProjectFormData) {
  const supabase = createServerClient()

  // 1. Validate user quota
  const { data: user } = await supabase.auth.getUser()
  await checkApiQuota(user.id)

  // 2. Insert project (triggers auto-naming function)
  const { data: project } = await supabase
    .from('creative_projects')
    .insert({
      name: data.name,
      scene_id: data.sceneId,
      action_id: data.actionId,
      driver_id: data.driverId,
      format_id: data.formatId,
      reference_image_ids: data.referenceImageIds,
      created_by: user.id
    })
    .select()
    .single()

  return { success: true, project }
}
```

#### 2. Generate Flux Prompt (Gemini API)
```typescript
'use server'

export async function generateFluxPrompt(projectId: string) {
  // 1. Fetch project with ABCD details
  const project = await getProjectWithABCD(projectId)

  // 2. Construct Gemini prompt
  const systemPrompt = `You are an expert at writing Flux image generation prompts...`
  const userPrompt = `
    Scene: ${project.scene.name} (${project.scene.category})
    Action: ${project.action.name}
    Driver: ${project.driver.emotion} - ${project.driver.keywords.join(', ')}
    Format: ${project.format.name}
    Product: Mobility walker for seniors
  `

  // 3. Call Gemini API
  const response = await gemini.generateContent({
    model: 'gemini-2.0-flash-exp',
    prompt: systemPrompt + userPrompt,
    maxTokens: 500
  })

  const fluxPrompt = response.text

  // 4. Update project
  await supabase
    .from('creative_projects')
    .update({
      gemini_prompt: fluxPrompt,
      gemini_prompt_metadata: { model: 'gemini-2.0-flash-exp', tokens: response.usage.tokens }
    })
    .eq('id', projectId)

  // 5. Log API usage
  await logApiUsage({
    user_id: project.created_by,
    project_id: projectId,
    provider: 'gemini',
    tokens_used: response.usage.tokens
  })

  return { fluxPrompt }
}
```

#### 3. Batch Generate Images
```typescript
'use server'

export async function batchGenerateImages(projectId: string, batchConfig: BatchConfig) {
  const project = await getProject(projectId)
  const referenceImages = await getReferenceImages(project.reference_image_ids)

  // Create placeholder records
  const imageRecords = referenceImages.map(refImg => ({
    project_id: projectId,
    reference_image_id: refImg.id,
    flux_prompt: project.gemini_prompt,
    generation_params: batchConfig,
    status: 'pending'
  }))

  const { data: insertedImages } = await supabase
    .from('generated_images')
    .insert(imageRecords)
    .select()

  // Queue generation jobs (non-blocking)
  for (const img of insertedImages) {
    await queueImageGeneration(img.id)
  }

  return { success: true, totalImages: insertedImages.length }
}

// Background job processor
async function processImageGeneration(imageId: string) {
  const image = await getGeneratedImage(imageId)
  const referenceImage = await getReferenceImage(image.reference_image_id)

  try {
    // Call Flux/Nano Banana API
    const response = await nanoBananaApi.img2img({
      prompt: image.flux_prompt,
      image: referenceImage.image_url,
      strength: image.generation_params.strength,
      steps: image.generation_params.steps
    })

    // Upload to Supabase Storage
    const storageUrl = await uploadToStorage(response.imageData, imageId)

    // Update record
    await supabase
      .from('generated_images')
      .update({
        image_url: storageUrl,
        status: 'completed',
        generated_at: new Date()
      })
      .eq('id', imageId)

    // Log API usage
    await logApiUsage({
      provider: 'nano_banana',
      images_generated: 1,
      cost_usd: 0.05
    })

  } catch (error) {
    await handleGenerationError(imageId, error)
  }
}
```

### API Routes (Specialized Endpoints)

#### CSV Upload Handler
```typescript
// app/api/performance/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const platform = formData.get('platform') as string

  // Parse CSV
  const parsed = await parseCsv(file)

  // Match with generated images by ad_name
  const matched = await matchImagesWithPerformance(parsed.data)

  // Bulk insert
  await supabase.from('performance_data').insert(matched)

  // Trigger insight generation
  await generateInsights()

  return Response.json({
    success: true,
    imported: matched.length,
    unmatched: parsed.data.length - matched.length
  })
}
```

---

## Data Flow

### Creative Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CONFIGURES ABCD                                         │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│    │ Scene   │→ │ Action  │→ │ Driver  │→ │ Format  │        │
│    └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│         ↓                                                        │
│    [Auto-filter reference images by product_state]              │
│         ↓                                                        │
│    [Select 3-5 reference images]                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GENERATE FLUX PROMPT (Gemini API)                           │
│    Input:                                                        │
│    - Scene context                                               │
│    - Action description                                          │
│    - Driver keywords                                             │
│    - Format composition rules                                    │
│    - Product: Mobility walker                                    │
│         ↓                                                        │
│    Output: Optimized Flux prompt (saved to project)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. BATCH IMAGE GENERATION (Nano Banana/Flux)                   │
│    For each reference image:                                     │
│    ┌──────────────────────────────────────────────┐            │
│    │ POST /v1/img2img                              │            │
│    │ {                                             │            │
│    │   prompt: project.gemini_prompt,              │            │
│    │   image: reference.image_url,                 │            │
│    │   strength: 0.7,                              │            │
│    │   steps: 50                                   │            │
│    │ }                                             │            │
│    └──────────────────────────────────────────────┘            │
│         ↓                                                        │
│    [Upload to Supabase Storage]                                 │
│    [Update generated_images.status = 'completed']               │
│    [Log API usage]                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DOWNLOAD & USE IN CAMPAIGNS                                  │
│    - Bulk download as ZIP                                        │
│    - Use generated_name for ad naming                            │
│    - Deploy to Facebook/Google/TikTok                            │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Tracking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. EXPORT DATA FROM AD PLATFORMS                                │
│    Facebook Ads Manager / Google Ads / TikTok Ads               │
│    ↓                                                             │
│    CSV columns: ad_name, impressions, clicks, ctr,              │
│                 cost, revenue, date                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. UPLOAD TO CREATIVE OS                                        │
│    - Drag & drop CSV                                             │
│    - Select platform                                             │
│    - Parse CSV (Papa Parse)                                      │
│         ↓                                                        │
│    [Match ad_name with generated_images.project.generated_name] │
│         ↓                                                        │
│    [Insert into performance_data table]                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. AUTO-GENERATE INSIGHTS                                       │
│    SQL aggregations:                                             │
│    - Top 10% performers by CTR                                   │
│    - Scene effectiveness (avg CTR by scene)                      │
│    - Driver correlation (which emotion drives best results)      │
│    - Format trends (composition performance over time)           │
│         ↓                                                        │
│    [Insert into insights table with confidence_score]            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. VISUALIZE IN DASHBOARD                                       │
│    - Performance heatmap (ABCD matrix)                           │
│    - Trend charts (CTR over weeks)                               │
│    - Leaderboard (top 20 creatives)                              │
│    - Cost efficiency breakdown                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication Flow

```
┌────────────┐           ┌─────────────────┐         ┌──────────────┐
│  Browser   │           │  Next.js Server │         │  Supabase    │
└──────┬─────┘           └────────┬────────┘         └──────┬───────┘
       │                          │                          │
       │ 1. Navigate to /login    │                          │
       ├─────────────────────────→│                          │
       │                          │                          │
       │ 2. Render login form     │                          │
       │←─────────────────────────┤                          │
       │                          │                          │
       │ 3. Submit credentials    │                          │
       ├─────────────────────────→│                          │
       │                          │ 4. signInWithPassword()  │
       │                          ├─────────────────────────→│
       │                          │                          │
       │                          │ 5. Return session token  │
       │                          │←─────────────────────────┤
       │                          │                          │
       │ 6. Set HTTP-only cookie  │                          │
       │←─────────────────────────┤                          │
       │                          │                          │
       │ 7. Redirect to /dashboard│                          │
       │←─────────────────────────┤                          │
```

**Implementation**:
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

### Row Level Security (RLS) Policies

**Key Principle**: Never trust the client. All data access is controlled at the database level.

#### Example: creative_projects table

```sql
-- Users can only view their own projects
CREATE POLICY "Users can view own projects"
    ON creative_projects FOR SELECT
    USING (auth.uid() = created_by);

-- Users can only create projects for themselves
CREATE POLICY "Users can create projects"
    ON creative_projects FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Users can only update their own projects
CREATE POLICY "Users can update own projects"
    ON creative_projects FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Users can only delete their own projects
CREATE POLICY "Users can delete own projects"
    ON creative_projects FOR DELETE
    USING (auth.uid() = created_by);
```

#### Admin Override Pattern

```sql
-- Admins can view all projects
CREATE POLICY "Admins can view all projects"
    ON creative_projects FOR SELECT
    USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );
```

### API Security Checklist

- [ ] All Server Actions validate `auth.uid()` before DB operations
- [ ] API routes check authentication via `getSession()`
- [ ] File uploads validate MIME types and file sizes
- [ ] External API keys stored in Vercel environment variables
- [ ] Rate limiting on expensive operations (Gemini calls, image generation)
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention (use parameterized queries)

---

## Storage Strategy

### Supabase Storage Architecture

```
rolloy-creative-os (Bucket)
│
├── reference-images/
│   ├── expanded/
│   │   ├── {uuid}.jpg
│   │   ├── {uuid}.jpg
│   │   └── thumbnails/
│   │       ├── {uuid}_thumb.jpg
│   │       └── {uuid}_thumb.jpg
│   │
│   ├── folded/
│   │   ├── {uuid}.jpg
│   │   └── thumbnails/
│   │       └── {uuid}_thumb.jpg
│   │
│   └── both/
│       └── ...
│
└── generated-images/
    ├── {project_id}/
    │   ├── {image_id}.jpg
    │   ├── {image_id}.jpg
    │   └── thumbnails/
    │       ├── {image_id}_thumb.jpg
    │       └── {image_id}_thumb.jpg
    │
    └── {project_id}/
        └── ...
```

### Storage Policies

```sql
-- Public read access for authenticated users
CREATE POLICY "Allow authenticated read access"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'rolloy-creative-os'
    AND auth.role() = 'authenticated'
);

-- Users can upload to their own project folders
CREATE POLICY "Allow users to upload to own projects"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'rolloy-creative-os'
    AND auth.uid()::text = (storage.foldername(name))[2]  -- Match user ID in path
);

-- Users can delete their own uploaded files
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'rolloy-creative-os'
    AND auth.uid()::text = (storage.foldername(name))[2]
);
```

### Image Processing Pipeline

```typescript
// lib/storage/upload.ts
import sharp from 'sharp'

export async function uploadGeneratedImage(
  imageData: Buffer,
  projectId: string,
  imageId: string
) {
  const supabase = createServerClient()

  // 1. Optimize image
  const optimized = await sharp(imageData)
    .jpeg({ quality: 85, progressive: true })
    .toBuffer()

  // 2. Generate thumbnail
  const thumbnail = await sharp(imageData)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer()

  // 3. Upload to Supabase Storage
  const imagePath = `generated-images/${projectId}/${imageId}.jpg`
  const thumbPath = `generated-images/${projectId}/thumbnails/${imageId}_thumb.jpg`

  await Promise.all([
    supabase.storage.from('rolloy-creative-os').upload(imagePath, optimized),
    supabase.storage.from('rolloy-creative-os').upload(thumbPath, thumbnail)
  ])

  // 4. Get public URLs
  const { data: imageUrl } = supabase.storage
    .from('rolloy-creative-os')
    .getPublicUrl(imagePath)

  const { data: thumbUrl } = supabase.storage
    .from('rolloy-creative-os')
    .getPublicUrl(thumbPath)

  return { imageUrl: imageUrl.publicUrl, thumbnailUrl: thumbUrl.publicUrl }
}
```

---

## AI Integration

### Gemini API (Prompt Engineering)

**Purpose**: Convert ABCD parameters into optimized Flux prompts

**API Configuration**:
```typescript
// lib/ai/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

export async function generateFluxPrompt(abcdParams: ABCDParams) {
  const systemPrompt = `You are an expert at writing image generation prompts for Flux AI.
Your goal is to create prompts that generate high-performing advertising creatives for a DTC mobility walker brand.

Rules:
- Be specific about composition, lighting, and mood
- Include product state (expanded/folded walker)
- Focus on emotional connection with seniors (55-75 age range)
- Avoid abstract concepts; use concrete visual descriptions
- Keep prompts under 200 words

Output format: Single paragraph prompt only, no explanations.`

  const userPrompt = `
Create a Flux image generation prompt with these parameters:

Scene: ${abcdParams.scene.name} (${abcdParams.scene.category})
Action: ${abcdParams.action.name} - ${abcdParams.action.description}
Product State: ${abcdParams.action.product_state} walker
Emotional Driver: ${abcdParams.driver.emotion} (keywords: ${abcdParams.driver.keywords.join(', ')})
Composition: ${abcdParams.format.name} - ${abcdParams.format.description}

Target Audience: Active seniors aged 55-75 who value independence
Brand Tone: Empowering, modern, approachable
Product: Premium mobility walker with modern design
`

  const result = await model.generateContent([
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'user', parts: [{ text: userPrompt }] }
  ])

  const response = result.response
  const fluxPrompt = response.text()

  return {
    prompt: fluxPrompt,
    metadata: {
      model: 'gemini-2.0-flash-exp',
      tokens: response.usageMetadata?.totalTokenCount,
      timestamp: new Date().toISOString()
    }
  }
}
```

**Error Handling & Retry**:
```typescript
const MAX_RETRIES = 3
const RETRY_DELAY = 2000

async function generateWithRetry(params: ABCDParams, attempt = 1): Promise<string> {
  try {
    return await generateFluxPrompt(params)
  } catch (error) {
    if (attempt >= MAX_RETRIES) throw error

    console.warn(`Gemini API attempt ${attempt} failed, retrying...`)
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
    return generateWithRetry(params, attempt + 1)
  }
}
```

---

### Flux / Nano Banana API (Img2Img Generation)

**Purpose**: Generate advertising creatives from reference images

**API Configuration**:
```typescript
// lib/ai/flux.ts
const NANO_BANANA_ENDPOINT = 'https://api.nanobanana.com/v1/img2img'

interface Img2ImgParams {
  prompt: string
  image: string  // URL or base64
  strength: number  // 0.0-1.0 (how much to transform)
  steps: number     // 20-100 (quality vs speed)
  guidance: number  // 7-15 (adherence to prompt)
  seed?: number     // For reproducibility
}

export async function generateImage(params: Img2ImgParams) {
  const response = await fetch(NANO_BANANA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NANO_BANANA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'flux-1-schnell',  // Fast model for batch generation
      prompt: params.prompt,
      image: params.image,
      strength: params.strength,
      num_inference_steps: params.steps,
      guidance_scale: params.guidance,
      seed: params.seed || Math.floor(Math.random() * 1000000)
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Flux API error: ${error.message}`)
  }

  const data = await response.json()
  return {
    imageUrl: data.output[0],  // Generated image URL
    seed: data.seed,
    metadata: data.metadata
  }
}
```

**Queue System for Batch Generation**:
```typescript
// lib/queue/image-generation.ts
import { Queue } from 'bullmq'

const imageQueue = new Queue('image-generation', {
  connection: { host: 'localhost', port: 6379 }  // Redis
})

export async function queueImageGeneration(imageId: string) {
  await imageQueue.add('generate', { imageId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  })
}

// Worker process
const worker = new Worker('image-generation', async (job) => {
  const { imageId } = job.data
  await processImageGeneration(imageId)
}, { connection: { host: 'localhost', port: 6379 } })
```

---

## Performance & Optimization

### Frontend Optimization

1. **Server Components by Default**
   - Fetch data on server to reduce client bundle
   - Use `'use client'` only for interactive components

2. **Image Optimization**
   ```tsx
   import Image from 'next/image'

   <Image
     src={imageUrl}
     alt="Generated creative"
     width={800}
     height={600}
     placeholder="blur"
     blurDataURL={thumbnailUrl}
     loading="lazy"
   />
   ```

3. **Data Fetching Strategy**
   ```typescript
   // Parallel fetching
   const [projects, scenes, actions] = await Promise.all([
     getProjects(),
     getScenes(),
     getActions()
   ])
   ```

4. **Optimistic UI Updates**
   ```typescript
   const [optimisticProjects, addOptimisticProject] = useOptimistic(
     projects,
     (state, newProject) => [...state, newProject]
   )
   ```

### Backend Optimization

1. **Database Indexing** (See migration file)
   - Composite indexes on frequent query patterns
   - GIN indexes for array/JSONB columns
   - Partial indexes for filtered queries

2. **Query Optimization**
   ```sql
   -- Bad: N+1 query problem
   SELECT * FROM creative_projects;
   -- Then for each project:
   SELECT * FROM scenes WHERE id = project.scene_id;

   -- Good: Single query with joins
   SELECT p.*, s.name as scene_name, a.name as action_name
   FROM creative_projects p
   JOIN scenes s ON p.scene_id = s.id
   JOIN actions a ON p.action_id = a.id;
   ```

3. **API Response Caching**
   ```typescript
   export const revalidate = 300  // Cache for 5 minutes

   async function getScenes() {
     const supabase = createServerClient()
     return await supabase
       .from('scenes')
       .select('*')
       .eq('is_active', true)
       .order('display_order')
   }
   ```

4. **Rate Limiting**
   ```typescript
   // lib/rate-limit.ts
   import { Ratelimit } from '@upstash/ratelimit'
   import { Redis } from '@upstash/redis'

   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, '1 m')  // 10 requests per minute
   })

   export async function checkRateLimit(userId: string) {
     const { success } = await ratelimit.limit(userId)
     if (!success) throw new Error('Rate limit exceeded')
   }
   ```

### Cost Optimization

1. **API Usage Tracking**
   ```typescript
   async function logApiUsage(params: {
     user_id: string
     provider: 'gemini' | 'nano_banana'
     tokens_used?: number
     images_generated?: number
   }) {
     await supabase.from('api_usage_logs').insert({
       ...params,
       cost_usd: calculateCost(params),
       created_at: new Date()
     })
   }

   function calculateCost(params) {
     if (params.provider === 'gemini') {
       return params.tokens_used * 0.0000025  // $0.0025 per 1K tokens
     }
     if (params.provider === 'nano_banana') {
       return params.images_generated * 0.05  // $0.05 per image
     }
   }
   ```

2. **User Quota Management**
   ```typescript
   async function checkApiQuota(userId: string) {
     const user = await supabase
       .from('users')
       .select('api_quota_limit')
       .eq('id', userId)
       .single()

     const usage = await supabase
       .from('api_usage_logs')
       .select('images_generated')
       .eq('user_id', userId)
       .gte('created_at', startOfMonth())

     const totalUsed = usage.data.reduce((sum, log) => sum + log.images_generated, 0)

     if (totalUsed >= user.data.api_quota_limit) {
       throw new Error('Monthly API quota exceeded')
     }
   }
   ```

---

## Deployment Architecture

### Vercel Configuration

```javascript
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sfo1"],  // San Francisco (closest to users)
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
    "GEMINI_API_KEY": "@gemini-api-key",
    "NANO_BANANA_API_KEY": "@nano-banana-api-key"
  },
  "crons": [
    {
      "path": "/api/cron/generate-insights",
      "schedule": "0 2 * * *"  // Daily at 2 AM
    }
  ]
}
```

### Environment Variables

```bash
# .env.local (for local development)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...  # Server-only
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXX
NANO_BANANA_API_KEY=nb_xxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase Setup

```bash
# 1. Initialize Supabase project
npx supabase init

# 2. Link to remote project
npx supabase link --project-ref your-project-ref

# 3. Run migrations
npx supabase db push

# 4. Create storage bucket
npx supabase storage create rolloy-creative-os --public

# 5. Setup authentication
# Go to Supabase Dashboard → Authentication → Providers
# Enable Email provider
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run type-check

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Appendix

### Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14+ (App Router) | React framework with SSR |
| Styling | Tailwind CSS | Utility-first CSS |
| UI Components | Shadcn UI | Accessible component library |
| Database | Supabase (PostgreSQL) | Managed database with RLS |
| Storage | Supabase Storage | Object storage for images |
| Authentication | Supabase Auth | User management |
| AI - Prompt Gen | Gemini API | Text generation |
| AI - Image Gen | Nano Banana/Flux | Img2Img generation |
| Hosting | Vercel | Serverless deployment |
| Charts | Recharts | Data visualization |
| Forms | React Hook Form + Zod | Form validation |
| State | React Hooks + Optimistic UI | Client state management |

### File Structure

```
rolloy-creativeos/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── factory/
│   │   │   └── [projectId]/
│   │   │       └── page.tsx
│   │   ├── performance/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── performance/
│   │   │   └── upload/
│   │   │       └── route.ts
│   │   └── cron/
│   │       └── generate-insights/
│   │           └── route.ts
│   ├── actions/
│   │   ├── creative-projects.ts
│   │   ├── image-generation.ts
│   │   └── performance.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── creative/
│   │   ├── scene-selector.tsx
│   │   ├── action-selector.tsx
│   │   ├── driver-selector.tsx
│   │   ├── format-selector.tsx
│   │   └── reference-gallery.tsx
│   ├── factory/
│   │   ├── image-grid.tsx
│   │   ├── progress-tracker.tsx
│   │   └── batch-controls.tsx
│   ├── performance/
│   │   ├── csv-uploader.tsx
│   │   ├── performance-chart.tsx
│   │   └── insights-panel.tsx
│   └── ui/
│       └── [shadcn components]
├── lib/
│   ├── ai/
│   │   ├── gemini.ts
│   │   └── flux.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── storage/
│   │   └── upload.ts
│   ├── queue/
│   │   └── image-generation.ts
│   └── utils/
│       └── naming.ts
├── supabase/
│   ├── migrations/
│   │   └── 20251205000001_initial_schema.sql
│   └── config.toml
├── docs/
│   └── ARCHITECTURE.md
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Next Steps

1. **Setup Infrastructure**
   - Create Supabase project
   - Create Vercel project
   - Run database migrations
   - Configure storage bucket
   - Set environment variables

2. **Obtain API Keys**
   - Gemini API key from Google AI Studio
   - Nano Banana API key from nanobanana.com
   - (Alternative) Replicate API for Flux

3. **Development Phases**
   - Phase 1: Authentication + ABCD dictionaries
   - Phase 2: Creative project creation + Gemini integration
   - Phase 3: Image generation + Storage
   - Phase 4: Performance tracking + Analytics

4. **Testing Strategy**
   - Unit tests for utility functions
   - Integration tests for Server Actions
   - E2E tests for critical flows (Playwright)
   - Manual testing for AI outputs

---

**Document Status**: Complete
**Review Required**: Technical Lead, Product Manager
**Last Updated**: 2025-12-05
