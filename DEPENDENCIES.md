# Rolloy Creative OS - Dependencies Guide

Required packages and installation instructions.

## Installation Command

```bash
npm install @supabase/supabase-js @google/generative-ai papaparse
npm install -D @types/papaparse
```

Or if using yarn:

```bash
yarn add @supabase/supabase-js @google/generative-ai papaparse
yarn add -D @types/papaparse
```

---

## Production Dependencies

### 1. @supabase/supabase-js (^2.39.0)

**Purpose**: Supabase client for database and storage operations

**Used in**:
- `/lib/supabase/client.ts` - Main client configuration
- All API routes for database operations

**Features used**:
- Database queries (PostgreSQL)
- Storage upload/download
- Authentication (ready for future use)
- Real-time subscriptions (ready for future use)

**Installation**:
```bash
npm install @supabase/supabase-js
```

**Configuration**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

### 2. @google/generative-ai (^0.1.3)

**Purpose**: Google Gemini API client for AI prompt generation

**Used in**:
- `/lib/services/gemini-service.ts` - Prompt generation

**Features used**:
- Text generation with Gemini 2.0 Flash
- System instructions
- Token counting
- Streaming (ready for future use)

**Installation**:
```bash
npm install @google/generative-ai
```

**Configuration**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```

**Get API Key**: https://makersuite.google.com/app/apikey

---

### 3. papaparse (^5.4.1)

**Purpose**: CSV parsing library

**Used in**:
- `/lib/services/analytics-service.ts` - CSV data parsing

**Features used**:
- Header detection
- Type inference
- Skip empty lines
- Error handling

**Installation**:
```bash
npm install papaparse
npm install -D @types/papaparse
```

**Usage**:
```typescript
import Papa from 'papaparse';

Papa.parse<CSVRow>(csvContent, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    // Process results
  }
});
```

---

## Already Installed (Next.js Default)

These packages are already included in a Next.js 14+ project:

### 1. next (^14.0.0)
Next.js framework with App Router

### 2. react (^18.0.0)
React library

### 3. react-dom (^18.0.0)
React DOM renderer

### 4. typescript (^5.0.0)
TypeScript compiler

### 5. @types/node (^20.0.0)
Node.js type definitions

### 6. @types/react (^18.0.0)
React type definitions

---

## Optional Dependencies (For Future Enhancement)

### 1. ioredis
Redis client for caching

```bash
npm install ioredis
npm install -D @types/ioredis
```

**Use case**: Cache API responses, session data

### 2. bullmq
Job queue for background processing

```bash
npm install bullmq
```

**Use case**: Async image generation jobs

### 3. zod
Schema validation

```bash
npm install zod
```

**Use case**: Runtime validation for API inputs

### 4. sharp
Image processing

```bash
npm install sharp
```

**Use case**: Image optimization, resizing, format conversion

### 5. next-auth
Authentication library

```bash
npm install next-auth
```

**Use case**: User authentication and session management

### 6. @vercel/analytics
Vercel analytics

```bash
npm install @vercel/analytics
```

**Use case**: Usage tracking and performance monitoring

---

## Complete package.json

```json
{
  "name": "rolloy-creativeos",
  "version": "1.0.0",
  "description": "AI-powered creative generation system with ABCD matrix",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "@google/generative-ai": "^0.1.3",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/papaparse": "^5.3.14",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## Dependency Management Best Practices

### 1. Version Pinning

Use exact versions for critical dependencies:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "2.39.0",  // No ^ or ~
    "@google/generative-ai": "0.1.3"
  }
}
```

### 2. Security Audits

Run regularly:

```bash
npm audit
npm audit fix
```

### 3. Update Strategy

```bash
# Check for updates
npm outdated

# Update specific package
npm update @supabase/supabase-js

# Update all (carefully!)
npm update
```

### 4. Lock File

Always commit `package-lock.json` to ensure reproducible builds.

---

## Environment-Specific Dependencies

### Development Only

```json
{
  "devDependencies": {
    "@types/*": "...",  // Type definitions
    "eslint": "...",     // Linting
    "jest": "...",       // Testing
    "prettier": "..."    // Code formatting
  }
}
```

### Production Only

All runtime dependencies should be in `dependencies`, not `devDependencies`.

---

## Troubleshooting

### Issue 1: Supabase Types

If you see TypeScript errors with Supabase:

```bash
npx supabase gen types typescript --project-id your-project-ref > lib/types/database.types.ts
```

### Issue 2: Gemini API Import Error

Make sure you're using:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
```

Not:
```typescript
import GoogleGenerativeAI from '@google/generative-ai'; // Wrong!
```

### Issue 3: Papa Parse Types

If types are not recognized:

```bash
npm install -D @types/papaparse
```

And restart TypeScript server in VS Code: `Cmd+Shift+P` → "Restart TS Server"

---

## Installation Verification

After installation, verify all packages:

```bash
# List installed packages
npm list --depth=0

# Check for peer dependency issues
npm ls

# Verify TypeScript can find types
npx tsc --noEmit
```

Expected output:
```
rolloy-creativeos@1.0.0
├── @supabase/supabase-js@2.39.0
├── @google/generative-ai@0.1.3
├── papaparse@5.4.1
├── next@14.0.0
├── react@18.0.0
└── react-dom@18.0.0
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Install Dependencies

on: [push, pull_request]

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
```

### Vercel

Vercel automatically runs `npm install` during deployment. No additional configuration needed.

---

## Bundle Size Optimization

Check bundle size impact:

```bash
# Install bundle analyzer
npm install -D @next/bundle-analyzer

# Analyze
ANALYZE=true npm run build
```

Current estimated sizes:
- `@supabase/supabase-js`: ~150KB (gzipped)
- `@google/generative-ai`: ~50KB (gzipped)
- `papaparse`: ~40KB (gzipped)

**Total additional bundle size**: ~240KB (acceptable for the functionality provided)

---

## License Compliance

All dependencies use permissive licenses:

- `@supabase/supabase-js`: MIT
- `@google/generative-ai`: Apache 2.0
- `papaparse`: MIT
- `next`: MIT
- `react`: MIT

✅ All compatible with commercial use

---

## Update Log

### 2025-01-29
- Initial dependencies setup
- Added Supabase client v2.39.0
- Added Gemini API v0.1.3
- Added Papa Parse v5.4.1

---

## Support

For dependency issues:
1. Check `npm-debug.log`
2. Clear cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall
4. Check Node.js version: `node -v` (must be 18+)

---

**Last Updated**: 2025-01-29
