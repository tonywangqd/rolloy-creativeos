# Rolloy Creative OS - Backend Implementation Guide

Complete backend implementation with Supabase, Gemini API, and Flux API integration.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [API Documentation](#api-documentation)
5. [Service Layer](#service-layer)
6. [Database Schema](#database-schema)
7. [Security](#security)
8. [Deployment](#deployment)

---

## Overview

The Rolloy Creative OS backend provides a complete API layer for:

- **ABCD Matrix Management**: Structured creative options (Environment, Action, Character, Emotion)
- **Creative Naming**: Standardized naming convention (YYYYMMDD_A1_A2_B_C_D)
- **AI Prompt Generation**: Gemini API integration for Flux-optimized prompts
- **Image Generation**: Flux API integration with batch processing and retry logic
- **Storage Management**: Supabase Storage for generated images
- **Analytics Engine**: CSV parsing and ABCD performance aggregation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Routes                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ /api/abcd-   │  │ /api/        │  │ /api/        │     │
│  │  options     │  │  generate    │  │  analytics   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Naming     │  │   Gemini     │  │    Flux      │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  Analytics   │  │   Supabase   │                        │
│  │   Service    │  │   Client     │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               External Services                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Supabase    │  │   Gemini     │  │    Flux      │     │
│  │  PostgreSQL  │  │     API      │  │     API      │     │
│  │  + Storage   │  │              │  │  (Img2Img)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

Required packages:
- `@supabase/supabase-js` - Supabase client
- `@google/generative-ai` - Gemini API
- `papaparse` - CSV parsing
- `@types/papaparse` - TypeScript types

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gemini API
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash-exp

# Flux API
FLUX_API_KEY=your-flux-api-key
FLUX_API_ENDPOINT=https://api.nanobanana.ai/v1/generate

# Base Images
NEXT_PUBLIC_UNFOLDED_IMAGE_URL=/images/product-unfolded.png
NEXT_PUBLIC_FOLDED_IMAGE_URL=/images/product-folded.png
```

### 3. Database Setup

Run the migration on your Supabase project:

```bash
# Using Supabase CLI
supabase db push

# Or manually execute in Supabase SQL Editor
# Copy content from: supabase/migrations/00001_initial_schema.sql
```

### 4. Storage Bucket

The migration automatically creates the `creative-assets` bucket. Verify in:
- Supabase Dashboard → Storage → Buckets

### 5. Start Development Server

```bash
npm run dev
```

---

## API Documentation

### 1. ABCD Options API

**Endpoint**: `GET /api/abcd-options`

**Description**: Retrieve ABCD matrix options for frontend selection.

**Query Parameters**:
- `category` (optional): Filter by category (`A1`, `A2`, `B`, `C`, `D`)
- `a1` (optional): Filter A2 options based on A1 selection

**Examples**:

```bash
# Get full ABCD matrix
curl http://localhost:3000/api/abcd-options

# Get only A2 options
curl http://localhost:3000/api/abcd-options?category=A2

# Get A2 options filtered by A1
curl http://localhost:3000/api/abcd-options?category=A2&a1=Outdoor
```

**Response**:

```json
{
  "success": true,
  "data": {
    "matrix": {
      "A": {
        "A1": [...],
        "A2": [...]
      },
      "B": [...],
      "C": [...],
      "D": [...]
    },
    "summary": {
      "a1Count": 4,
      "a2Count": 12,
      "bCount": 9,
      "cCount": 8,
      "dCount": 10
    }
  },
  "metadata": {
    "timestamp": "2025-01-29T10:30:00Z"
  }
}
```

---

### 2. Generate API

**Endpoint**: `POST /api/generate`

**Description**: Generate creative assets using AI workflow.

**Request Body**:

```json
{
  "selection": {
    "A1": "Outdoor",
    "A2": "Backyard",
    "B": "Sit",
    "C": "Mom-Baby",
    "D": "JOY"
  },
  "numImages": 20,
  "additionalContext": "Golden hour lighting, modern minimalist style",
  "seed": 12345
}
```

**Workflow**:
1. Validate ABCD selection
2. Generate creative naming
3. Determine product state (FOLDED/UNFOLDED)
4. Generate Gemini prompt
5. Generate images via Flux API (batch of 20)
6. Upload to Supabase Storage
7. Save metadata to database

**Response**:

```json
{
  "success": true,
  "data": {
    "creativeId": "uuid-here",
    "creativeName": "20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY",
    "productState": "UNFOLDED",
    "geminiPrompt": "Photorealistic image of...",
    "generatedImages": [
      {
        "url": "https://supabase.co/storage/...",
        "index": 1,
        "storagePath": "20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY/01.png"
      }
      // ... 19 more
    ],
    "metadata": {
      "totalGenerated": 20,
      "totalFailed": 0,
      "generationTime": 45000
    }
  }
}
```

**Get Generation Status**:

```bash
curl http://localhost:3000/api/generate?id=uuid-here
```

---

### 3. Analytics API

**Endpoint**: `POST /api/analytics`

**Description**: Upload CSV and generate ABCD performance analytics.

**Request** (multipart/form-data):

```bash
curl -X POST \
  -F "file=@performance_data.csv" \
  http://localhost:3000/api/analytics
```

**Request** (JSON):

```json
{
  "csvContent": "Ad Name,Impressions,Clicks,Conversions,Spend,Revenue\n..."
}
```

**CSV Format**:

```csv
Ad Name,Impressions,Clicks,Conversions,Spend,Revenue
20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY,10000,500,50,1000.00,5000.00
```

**Response**:

```json
{
  "success": true,
  "data": {
    "report": {
      "summary": {
        "totalAds": 100,
        "totalSpend": 50000,
        "totalRevenue": 250000,
        "overallROAS": 5.0,
        "overallCPA": 25.0
      },
      "byCategory": {
        "A1": [...],
        "A2": [...],
        "B": [...],
        "C": [...],
        "D": [...]
      },
      "topPerformers": {
        "bestROAS": [...],
        "lowestCPA": [...]
      }
    },
    "stats": {
      "totalAds": 100,
      "successfullyParsed": 95,
      "failedToParse": 5
    }
  }
}
```

**Export Report**:

```bash
# Export as CSV
curl "http://localhost:3000/api/analytics?action=export&format=csv&reportData=<base64>"

# Export as JSON
curl "http://localhost:3000/api/analytics?action=export&format=json&reportData=<base64>"
```

**Filter Analytics**:

```bash
curl "http://localhost:3000/api/analytics?action=filter&category=B&sortBy=roas&order=desc"
```

---

## Service Layer

### 1. Naming Service

**Location**: `/lib/services/naming-service.ts`

**Key Functions**:

```typescript
// Generate creative naming
const naming = generateCreativeNaming({
  A1: 'Outdoor',
  A2: 'Backyard',
  B: 'Sit',
  C: 'Mom-Baby',
  D: 'JOY'
});
// Result: 20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY

// Generate image paths
const paths = generateBatchImagePaths(naming, 20);
// Result: ['20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY/01.png', ...]

// Parse creative name
const parsed = parseCreativeName('20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY');
```

---

### 2. Gemini Service

**Location**: `/lib/services/gemini-service.ts`

**Key Functions**:

```typescript
// Generate prompt
const response = await generatePrompt({
  selection: { A1: 'Outdoor', A2: 'Backyard', B: 'Sit', C: 'Mom-Baby', D: 'JOY' },
  productState: 'UNFOLDED',
  baseImageUrl: 'https://...',
  additionalContext: 'Golden hour lighting'
});

// Validate prompt quality
const validation = validatePromptQuality(response.prompt);
```

**System Prompt**:
- Focus on lighting, atmosphere, emotion, human interaction
- Avoid product geometry descriptions
- Use cinematic photography terminology

---

### 3. Flux Service

**Location**: `/lib/services/flux-service.ts`

**Key Functions**:

```typescript
// Generate images
const response = await generateImages({
  prompt: 'Photorealistic image...',
  baseImageUrl: 'https://...',
  strength: 0.75,
  numImages: 20,
  seed: 12345
});

// Regenerate failed images
const regenerated = await regenerateFailedImages(request, [3, 7, 15]);
```

**Features**:
- Batch generation with parallel processing
- Automatic retry logic (3 retries with exponential backoff)
- Progress tracking
- Error handling and logging

---

### 4. Analytics Service

**Location**: `/lib/services/analytics-service.ts`

**Key Functions**:

```typescript
// Parse CSV
const data = await parseCSV(csvContent);

// Generate report
const report = generateAnalyticsReport(data);

// Export
const csv = exportReportToCSV(report);
const json = exportReportToJSON(report);

// Filter and sort
const filtered = filterByROAS(metrics, 3.0);
const sorted = sortAnalytics(metrics, 'roas', false);
```

---

### 5. Supabase Client

**Location**: `/lib/supabase/client.ts`

**Key Functions**:

```typescript
// Upload image
const result = await uploadImage(blob, 'path/to/image.png');

// Upload from URL
const result = await uploadImageFromUrl(imageUrl, storagePath);

// Batch upload
const results = await uploadImagesFromUrlsInBatch(uploads);

// Get public URL
const url = getPublicUrl('path/to/image.png');
```

---

## Database Schema

### Tables

#### 1. `creative_records`
- Stores all generated creatives with ABCD metadata
- Tracks generation status and performance metrics
- Links to generated images in Storage

#### 2. `generation_jobs`
- Tracks image generation job progress
- Updates in real-time during generation

#### 3. `analytics_data`
- Stores parsed CSV data
- Links to creative_records via creative_id

### Materialized View

#### `abcd_performance_summary`
- Aggregates performance by ABCD tags
- Refresh manually or via trigger

```sql
SELECT * FROM public.refresh_abcd_performance_summary();
```

---

## Security

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

1. **Public Read Access**: Anyone can view creative records
2. **Authenticated Insert**: Only authenticated users can create
3. **User-scoped Updates**: Users can only update their own records
4. **User-scoped Deletes**: Users can only delete their own records

### Storage Policies

- Public read access for all images
- Authenticated upload, update, delete

### API Key Security

- Never expose API keys in frontend code
- Use server-side environment variables only
- Rotate keys regularly

---

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Supabase Setup

1. Create project on supabase.com
2. Run migration script
3. Create storage bucket (auto-created by migration)
4. Configure RLS policies (auto-configured)

### Post-Deployment

1. Test API endpoints
2. Verify storage upload
3. Test Gemini integration
4. Test Flux integration
5. Upload sample CSV for analytics

---

## Testing

### Manual Testing

```bash
# Test ABCD options
curl http://localhost:3000/api/abcd-options

# Test generation (requires valid API keys)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"selection":{"A1":"Outdoor","A2":"Backyard","B":"Sit","C":"Mom-Baby","D":"JOY"}}'

# Test analytics
curl -X POST http://localhost:3000/api/analytics \
  -F "file=@test.csv"
```

### Integration Tests

Create test files in `/tests/`:
- `api.test.ts` - API endpoint tests
- `services.test.ts` - Service layer tests
- `database.test.ts` - Database query tests

---

## Troubleshooting

### Common Issues

1. **Gemini API Error**: Check API key and quota
2. **Flux API Timeout**: Increase timeout or reduce batch size
3. **Storage Upload Failed**: Check bucket permissions
4. **CSV Parse Error**: Validate CSV format and headers
5. **RLS Policy Block**: Check authentication and policies

### Logs

View logs in:
- Vercel Dashboard (Production)
- Terminal (Development)
- Supabase Dashboard (Database logs)

---

## Contributing

1. Follow TypeScript strict mode
2. Add JSDoc comments to all functions
3. Write unit tests for services
4. Update this documentation for new features

---

## License

Proprietary - Rolloy Creative OS

---

## Support

For issues or questions:
- GitHub Issues: [repository-url]
- Email: support@rolloy.com

---

**Last Updated**: 2025-01-29
