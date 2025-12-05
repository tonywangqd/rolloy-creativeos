# Rolloy Creative OS - Quick Start Guide (Backend)

Get the backend up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Gemini API key (from Google AI Studio)
- Flux/Nano Banana API key

---

## Step 1: Clone and Install (2 min)

```bash
# Navigate to project
cd rolloy-creativeos

# Install dependencies
npm install

# Required packages will be:
# - @supabase/supabase-js
# - @google/generative-ai
# - papaparse
# - @types/papaparse
```

---

## Step 2: Environment Setup (1 min)

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your actual values
nano .env.local
```

**Minimum required values**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

GEMINI_API_KEY=AIzaSy...
FLUX_API_KEY=your-flux-api-key
```

---

## Step 3: Database Setup (1 min)

### Option A: Using Supabase CLI

```bash
# Initialize Supabase
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Push migration
supabase db push
```

### Option B: Manual Setup

1. Go to Supabase Dashboard → SQL Editor
2. Copy content from `supabase/migrations/00001_initial_schema.sql`
3. Execute the SQL

This creates:
- 3 tables (creative_records, generation_jobs, analytics_data)
- Storage bucket (creative-assets)
- RLS policies
- Indexes and triggers

---

## Step 4: Start Development Server (30 sec)

```bash
npm run dev
```

Open http://localhost:3000

---

## Step 5: Test APIs (30 sec)

### Test 1: ABCD Options

```bash
curl http://localhost:3000/api/abcd-options
```

Expected: JSON with ABCD matrix

### Test 2: Generation (requires valid API keys)

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "selection": {
      "A1": "Outdoor",
      "A2": "Backyard",
      "B": "Sit",
      "C": "Mom-Baby",
      "D": "JOY"
    },
    "numImages": 1
  }'
```

Expected: Generation starts (takes 10-30 seconds for 1 image)

### Test 3: Analytics

Create a test CSV file:

```csv
Ad Name,Impressions,Clicks,Conversions,Spend,Revenue
20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY,10000,500,50,1000.00,5000.00
```

Upload:

```bash
curl -X POST http://localhost:3000/api/analytics \
  -F "file=@test.csv"
```

Expected: Analytics report with aggregated data

---

## Common Issues

### Issue 1: Supabase Connection Error

**Error**: `Failed to fetch from Supabase`

**Solution**:
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Ensure Supabase project is not paused

### Issue 2: Gemini API Error

**Error**: `GEMINI_API_ERROR`

**Solution**:
- Get API key from https://makersuite.google.com/app/apikey
- Check `GEMINI_API_KEY` in `.env.local`
- Verify API quota is not exceeded

### Issue 3: Flux API Error

**Error**: `FLUX_API_ERROR`

**Solution**:
- Check `FLUX_API_KEY` is valid
- Verify `FLUX_API_ENDPOINT` is correct
- Ensure API has sufficient credits

### Issue 4: Storage Upload Failed

**Error**: `STORAGE_ERROR`

**Solution**:
- Run database migration to create bucket
- Check RLS policies in Supabase Dashboard
- Verify storage quota is not exceeded

---

## File Structure

```
rolloy-creativeos/
├── app/
│   └── api/
│       ├── abcd-options/
│       │   └── route.ts          # ABCD options API
│       ├── generate/
│       │   └── route.ts          # Generation API
│       └── analytics/
│           └── route.ts          # Analytics API
│
├── lib/
│   ├── types/
│   │   └── index.ts              # TypeScript types
│   ├── constants/
│   │   └── abcd-matrix.ts        # ABCD data
│   ├── services/
│   │   ├── naming-service.ts     # Naming logic
│   │   ├── gemini-service.ts     # Gemini API
│   │   ├── flux-service.ts       # Flux API
│   │   └── analytics-service.ts  # Analytics
│   └── supabase/
│       └── client.ts             # Supabase client
│
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql
│
├── .env.example                  # Environment template
├── BACKEND_IMPLEMENTATION.md     # Full documentation
├── IMPLEMENTATION_SUMMARY.md     # Implementation details
└── QUICK_START_BACKEND.md        # This file
```

---

## API Quick Reference

### GET /api/abcd-options
Get ABCD matrix options

```bash
curl http://localhost:3000/api/abcd-options
curl http://localhost:3000/api/abcd-options?category=B
curl http://localhost:3000/api/abcd-options?category=A2&a1=Outdoor
```

### POST /api/generate
Generate creative assets

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"selection":{"A1":"Outdoor","A2":"Backyard","B":"Sit","C":"Mom-Baby","D":"JOY"},"numImages":20}'
```

### GET /api/generate?id={uuid}
Get generation status

```bash
curl http://localhost:3000/api/generate?id=uuid-here
```

### POST /api/analytics
Upload and analyze CSV

```bash
# File upload
curl -X POST http://localhost:3000/api/analytics \
  -F "file=@performance.csv"

# JSON content
curl -X POST http://localhost:3000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"csvContent":"Ad Name,Impressions,Clicks,...\n..."}'
```

---

## Service Layer Quick Reference

### Naming Service

```typescript
import { generateCreativeNaming } from '@/lib/services/naming-service';

const naming = generateCreativeNaming({
  A1: 'Outdoor',
  A2: 'Backyard',
  B: 'Sit',
  C: 'Mom-Baby',
  D: 'JOY'
});
// Result: 20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY
```

### Gemini Service

```typescript
import { generatePrompt } from '@/lib/services/gemini-service';

const response = await generatePrompt({
  selection: { ... },
  productState: 'UNFOLDED',
  baseImageUrl: 'https://...'
});
// Result: AI-generated Flux prompt
```

### Flux Service

```typescript
import { generateImages } from '@/lib/services/flux-service';

const response = await generateImages({
  prompt: 'Professional photography...',
  baseImageUrl: 'https://...',
  strength: 0.75,
  numImages: 20
});
// Result: Array of generated image URLs
```

### Analytics Service

```typescript
import { parseCSV, generateAnalyticsReport } from '@/lib/services/analytics-service';

const data = await parseCSV(csvContent);
const report = generateAnalyticsReport(data);
// Result: Complete analytics report with aggregations
```

### Supabase Client

```typescript
import { uploadImageFromUrl } from '@/lib/supabase/client';

const result = await uploadImageFromUrl(
  'https://generated-image.url',
  '20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY/01.png'
);
// Result: { publicUrl: '...', storagePath: '...' }
```

---

## Database Quick Reference

### Query Creative Records

```sql
-- Get all creatives
SELECT * FROM creative_records ORDER BY created_at DESC;

-- Get by ABCD tags
SELECT * FROM creative_records
WHERE a1_tag = 'Outdoor' AND b_tag = 'Sit';

-- Get with performance metrics
SELECT * FROM creative_records
WHERE roas > 3.0 AND cpa < 50;
```

### Refresh Analytics

```sql
-- Refresh materialized view
SELECT refresh_abcd_performance_summary();

-- Query aggregated data
SELECT * FROM abcd_performance_summary
WHERE category = 'B'
ORDER BY avg_roas DESC;
```

---

## Next Steps

1. **Frontend Integration**: Build UI components to consume these APIs
2. **Authentication**: Add NextAuth for user management
3. **Real-time Updates**: Implement WebSocket for generation progress
4. **Optimization**: Add caching and image optimization
5. **Monitoring**: Set up logging and error tracking

---

## Resources

- **Full Documentation**: `BACKEND_IMPLEMENTATION.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Supabase Docs**: https://supabase.com/docs
- **Gemini API Docs**: https://ai.google.dev/docs
- **Next.js Docs**: https://nextjs.org/docs

---

## Support

Need help?
1. Check `BACKEND_IMPLEMENTATION.md` for detailed guides
2. Review Supabase Dashboard logs
3. Check browser console for errors
4. Contact: support@rolloy.com

---

**Last Updated**: 2025-01-29
**Estimated Setup Time**: 5 minutes
**Status**: Production-Ready
