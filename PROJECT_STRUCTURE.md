# Rolloy Creative OS - Project Structure

Complete file organization and architecture overview.

## Directory Tree

```
rolloy-creativeos/
│
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (Server-side)
│   │   ├── abcd-options/
│   │   │   └── route.ts         # ✅ ABCD matrix API
│   │   ├── generate/
│   │   │   └── route.ts         # ✅ Image generation API
│   │   └── analytics/
│   │       └── route.ts         # ✅ Analytics API
│   │
│   ├── analytics/
│   │   └── page.tsx             # Analytics dashboard page
│   ├── settings/
│   │   └── page.tsx             # Settings page
│   │
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
│
├── lib/                          # Core business logic
│   ├── types/
│   │   └── index.ts             # ✅ TypeScript type definitions
│   │
│   ├── constants/
│   │   ├── abcd-matrix.ts       # ✅ ABCD matrix data & helpers
│   │   └── abcd.ts              # Legacy ABCD constants
│   │
│   ├── services/                # Service layer (Backend logic)
│   │   ├── naming-service.ts    # ✅ Creative naming generation
│   │   ├── gemini-service.ts    # ✅ Gemini API integration
│   │   ├── flux-service.ts      # ✅ Flux API integration
│   │   └── analytics-service.ts # ✅ CSV parsing & analytics
│   │
│   ├── supabase/
│   │   └── client.ts            # ✅ Supabase client & storage
│   │
│   └── utils.ts                 # Utility functions
│
├── components/                   # React components
│   ├── layout/
│   │   ├── header.tsx           # App header
│   │   └── sidebar.tsx          # Navigation sidebar
│   │
│   ├── creative/
│   │   ├── abcd-selector.tsx    # ABCD selection UI
│   │   ├── naming-card.tsx      # Creative naming display
│   │   └── gallery.tsx          # Image gallery
│   │
│   ├── analytics/
│   │   ├── csv-uploader.tsx     # CSV upload component
│   │   └── insight-dashboard.tsx # Analytics dashboard
│   │
│   └── ui/                       # Reusable UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── select.tsx
│       └── textarea.tsx
│
├── supabase/                     # Database & migrations
│   └── migrations/
│       ├── 00001_initial_schema.sql       # ✅ Complete DB schema
│       └── 20251205000001_initial_schema.sql
│
├── __tests__/                    # Unit tests
│   ├── csv-parser.test.ts       # CSV parsing tests
│   ├── naming-service.test.ts   # Naming logic tests
│   └── state-router.test.ts     # State routing tests
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md          # System architecture
│   ├── PRD.md                   # Product requirements
│   ├── SECURITY_AUDIT_CHECKLIST.md
│   ├── TEST_PLAN.md
│   └── TESTING_QUICK_START.md
│
├── .env.example                 # ✅ Environment variables template
├── BACKEND_IMPLEMENTATION.md    # ✅ Complete backend guide
├── IMPLEMENTATION_SUMMARY.md    # ✅ Implementation overview
├── QUICK_START_BACKEND.md       # ✅ Quick start guide
├── PROJECT_STRUCTURE.md         # ✅ This file
├── README.md                    # Project overview
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── tailwind.config.ts           # Tailwind CSS config
└── next.config.js               # Next.js config
```

---

## File Descriptions

### Backend Core Files (✅ Implemented)

#### Type Definitions
- **`lib/types/index.ts`**
  - Complete TypeScript type system
  - 200+ lines of interfaces and types
  - Covers ABCD, Naming, AI, Storage, Analytics
  - Custom error classes

#### Constants
- **`lib/constants/abcd-matrix.ts`**
  - Complete ABCD matrix data
  - 4 A1 options, 12 A2 options, 9 B options, 8 C options, 10 D options
  - Helper functions for validation and filtering
  - Product state routing logic

#### Services
- **`lib/services/naming-service.ts`**
  - Creative naming generation (YYYYMMDD_A1_A2_B_C_D)
  - Image path generation
  - Name parsing and validation
  - Batch operations

- **`lib/services/gemini-service.ts`**
  - Gemini API integration
  - Prompt generation for Flux
  - Prompt quality validation
  - System prompt optimization

- **`lib/services/flux-service.ts`**
  - Flux API integration (Image-to-Image)
  - Batch generation with retry logic
  - Progress tracking
  - Cost estimation

- **`lib/services/analytics-service.ts`**
  - CSV parsing with Papa Parse
  - ABCD tag extraction from ad names
  - CPA/ROAS calculation
  - Report generation and export

#### Supabase
- **`lib/supabase/client.ts`**
  - Supabase client configuration
  - Storage upload/download utilities
  - Batch operations
  - Error handling

#### API Routes
- **`app/api/abcd-options/route.ts`**
  - GET endpoint for ABCD matrix
  - Filtering by category
  - A2 recommendations based on A1

- **`app/api/generate/route.ts`**
  - POST endpoint for creative generation
  - Complete AI workflow orchestration
  - GET endpoint for status checking

- **`app/api/analytics/route.ts`**
  - POST endpoint for CSV upload
  - GET endpoint for filtering/exporting
  - Multi-format support (CSV/JSON)

#### Database
- **`supabase/migrations/00001_initial_schema.sql`**
  - 3 main tables with indexes
  - Row Level Security policies
  - Storage bucket setup
  - Materialized views
  - Triggers and functions

#### Documentation
- **`BACKEND_IMPLEMENTATION.md`**
  - Complete implementation guide
  - API documentation
  - Service layer details
  - Security and deployment

- **`IMPLEMENTATION_SUMMARY.md`**
  - Architecture overview
  - Feature list
  - Usage examples
  - Deployment steps

- **`QUICK_START_BACKEND.md`**
  - 5-minute setup guide
  - Quick reference
  - Troubleshooting

- **`.env.example`**
  - Environment variables template
  - Required API keys
  - Configuration options

---

## Architecture Layers

### 1. Presentation Layer (Frontend)
```
components/ + app/
├── User Interface (React Components)
├── Form Handling & Validation
└── State Management
```

### 2. API Layer (Next.js Routes)
```
app/api/
├── Request Validation
├── Error Handling
├── Response Formatting
└── Service Orchestration
```

### 3. Service Layer (Business Logic)
```
lib/services/
├── Naming Service    → Creative name generation
├── Gemini Service    → AI prompt generation
├── Flux Service      → Image generation
├── Analytics Service → CSV parsing & aggregation
└── Supabase Client   → Storage & database
```

### 4. Data Layer (Database & Storage)
```
Supabase
├── PostgreSQL Database
│   ├── creative_records
│   ├── generation_jobs
│   └── analytics_data
│
└── Storage Bucket
    └── creative-assets/
        └── {creativeName}/
            ├── 01.png
            ├── 02.png
            └── ...
```

### 5. External Services
```
├── Google Gemini API   → Prompt generation
├── Flux/Nano Banana    → Image generation
└── Supabase Platform   → Database + Storage + Auth
```

---

## Data Flow

### Generation Workflow

```
1. User Input (Frontend)
   └── ABCD Selection { A1, A2, B, C, D }

2. API Route (/api/generate)
   ├── Validate selection
   ├── Generate naming
   └── Determine product state

3. Gemini Service
   └── Generate Flux-optimized prompt

4. Flux Service
   ├── Generate 20 images (batch)
   └── Handle retries

5. Supabase Storage
   ├── Upload images
   └── Get public URLs

6. Database (creative_records)
   ├── Save metadata
   └── Update status

7. Response to Frontend
   └── Return generated images + metadata
```

### Analytics Workflow

```
1. CSV Upload (Frontend)
   └── File or raw content

2. API Route (/api/analytics)
   ├── Validate CSV structure
   └── Parse with Papa Parse

3. Analytics Service
   ├── Extract ABCD tags from ad names
   ├── Calculate CPA/ROAS
   ├── Aggregate by category
   └── Find top performers

4. Response to Frontend
   └── Return analytics report

5. Optional: Export
   └── Download as CSV or JSON
```

---

## Key Design Patterns

### 1. Service Pattern
All business logic in dedicated service files:
- Single responsibility
- Testable in isolation
- Reusable across routes

### 2. Error Handling
Consistent error format across all APIs:
```typescript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human-readable message',
    details: 'Additional info'
  }
}
```

### 3. Type Safety
Complete TypeScript coverage:
- All functions typed
- Request/response interfaces
- Database schema types
- No `any` types

### 4. Validation
Multi-layer validation:
- Input validation (API routes)
- Business logic validation (Services)
- Database constraints (SQL)

### 5. Async/Await
Consistent async patterns:
- Proper error handling
- Retry logic where needed
- Timeout protection

---

## Database Schema

### Tables

#### creative_records
Primary table for all generated creatives.

**Columns**:
- `id` (UUID) - Primary key
- `creative_name` (VARCHAR) - Unique naming
- `a1_tag`, `a2_tag`, `b_tag`, `c_tag`, `d_tag` - ABCD selection
- `product_state` (VARCHAR) - FOLDED/UNFOLDED
- `gemini_prompt` (TEXT) - Generated prompt
- `generated_images` (TEXT[]) - Array of URLs
- `impressions`, `clicks`, `conversions`, `spend`, `revenue` - Metrics
- `cpa`, `roas` - Calculated metrics
- `status` - Generation status
- `user_id` (UUID) - User association

**Indexes**: All ABCD tags, status, created_at, user_id

#### generation_jobs
Tracks generation progress.

**Columns**:
- `id` (UUID) - Primary key
- `creative_id` (UUID) - Foreign key
- `status` - pending/processing/completed/failed
- `progress` (INT) - 0-100
- `total_images`, `completed_images`, `failed_images`

#### analytics_data
Stores CSV analytics data.

**Columns**:
- `id` (UUID) - Primary key
- `upload_id` (UUID) - Batch identifier
- `ad_name` (VARCHAR)
- `creative_id` (UUID) - Foreign key (nullable)
- `a1_tag`, `a2_tag`, `b_tag`, `c_tag`, `d_tag` - Extracted tags
- `parsed_success` (BOOLEAN)
- Metrics (same as creative_records)

### Materialized View

#### abcd_performance_summary
Pre-aggregated analytics for fast queries.

**Columns**:
- `category` (A1/A2/B/C/D)
- `tag`
- Aggregated metrics (totals and averages)

---

## Security

### Row Level Security (RLS)
- Enabled on all tables
- Public read access
- Authenticated write access
- User-scoped updates/deletes

### Storage Policies
- Public read for images
- Authenticated upload/update/delete

### API Keys
- Server-side only (never exposed)
- Environment variables
- Rotation strategy

---

## Dependencies

### Production
```json
{
  "@supabase/supabase-js": "^2.39.0",
  "@google/generative-ai": "^0.1.3",
  "papaparse": "^5.4.1",
  "next": "^14.0.0",
  "react": "^18.0.0"
}
```

### Development
```json
{
  "@types/papaparse": "^5.3.14",
  "@types/node": "^20.0.0",
  "typescript": "^5.0.0"
}
```

---

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `FLUX_API_KEY`

### Optional
- `GEMINI_MODEL` (default: gemini-2.0-flash-exp)
- `FLUX_API_ENDPOINT` (default: Nano Banana)
- `NEXT_PUBLIC_UNFOLDED_IMAGE_URL`
- `NEXT_PUBLIC_FOLDED_IMAGE_URL`

---

## Deployment Checklist

- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Verify storage bucket creation
- [ ] Test API endpoints
- [ ] Configure domain (if production)
- [ ] Enable monitoring/logging
- [ ] Set up backup strategy

---

## Next Development Steps

### Phase 1: Frontend Integration
- [ ] Build ABCD selector UI
- [ ] Implement generation workflow with progress
- [ ] Create image gallery viewer
- [ ] Build analytics dashboard

### Phase 2: Enhancements
- [ ] Add WebSocket for real-time updates
- [ ] Implement job queue (Bull/BullMQ)
- [ ] Add Redis caching layer
- [ ] Optimize image processing

### Phase 3: User Management
- [ ] Integrate NextAuth
- [ ] Add user profiles
- [ ] Implement usage limits
- [ ] Add subscription tiers

### Phase 4: Advanced Features
- [ ] A/B testing framework
- [ ] Automated performance reporting
- [ ] Batch operations UI
- [ ] Export to ad platforms

---

## Support & Resources

- **Full Documentation**: `BACKEND_IMPLEMENTATION.md`
- **Quick Start**: `QUICK_START_BACKEND.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **GitHub**: [repository-url]
- **Email**: support@rolloy.com

---

**Project Status**: Backend Complete ✅
**Last Updated**: 2025-01-29
**Version**: 1.0.0
