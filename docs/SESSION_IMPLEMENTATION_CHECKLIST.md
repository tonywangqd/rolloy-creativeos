# Session System Implementation Checklist

## Overview
This checklist guides you through integrating the session management system into your existing Creative Workbench page.

---

## Prerequisites

- [x] Next.js 14 app with App Router
- [x] TypeScript configured
- [x] Tailwind CSS installed
- [x] Shadcn UI components (Button, Card, Input)
- [x] date-fns library installed

---

## Phase 1: Core Components (Completed ✓)

### 1.1 UI Components
- [x] Create `/components/ui/badge.tsx`
- [x] Create `/components/ui/scroll-area.tsx`

### 1.2 Session Components
- [x] Create `/components/sessions/session-status-badge.tsx`
- [x] Create `/components/sessions/session-item.tsx`
- [x] Create `/components/sessions/session-list.tsx`

### 1.3 Type Definitions
- [x] Create `/lib/types/session.ts` (already exists with comprehensive types)

### 1.4 Custom Hook
- [x] Create `/lib/hooks/use-session-manager.ts`

### 1.5 Documentation
- [x] Create `/docs/SESSION_SYSTEM_GUIDE.md`
- [x] Create `/docs/SESSION_UI_EXAMPLES.md`
- [x] Create `/docs/SESSION_IMPLEMENTATION_CHECKLIST.md` (this file)

---

## Phase 2: Integration with Existing Page

### 2.1 Update `/app/page.tsx`

#### Option A: Replace Entirely
Replace `/app/page.tsx` with `/app/page-with-sessions.tsx`

```bash
# Backup original
mv app/page.tsx app/page-backup.tsx

# Use session-enabled version
mv app/page-with-sessions.tsx app/page.tsx
```

#### Option B: Manual Integration (Recommended for learning)

Follow these steps:

**Step 1: Add Imports**
```typescript
import { SessionList } from "@/components/sessions/session-list";
import { useSessionManager } from "@/lib/hooks/use-session-manager";
import type { SessionSummary } from "@/lib/types/session";
```

**Step 2: Initialize Hook (after component declaration)**
```typescript
export default function HomePage() {
  const {
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    updateSession,
    loadSession,
    startNewSession,
    isLoaded,
  } = useSessionManager();

  // ... existing state
}
```

**Step 3: Add Session Load Effect**
```typescript
// Load session data when current session changes
useEffect(() => {
  if (currentSession) {
    setSelection(currentSession.abcd_selection);
    setPrompt(currentSession.prompt);
    setEditedPrompt(currentSession.prompt);
    setProductState(currentSession.product_state);
    setReferenceImageUrl(currentSession.reference_image_url);
    setCreativeName(currentSession.creative_name);

    // Restore images if they exist
    if (currentSession.images && currentSession.images.length > 0) {
      const restoredImages = currentSession.images.map(img => ({
        id: img.id,
        url: img.storage_url || "",
        storageUrl: img.storage_url,
        selected: false,
        status: img.status,
      }));
      setImages(restoredImages);
      setStep("generate");
    } else if (currentSession.prompt) {
      setStep("prompt");
    }
  }
}, [currentSession]);
```

**Step 4: Auto-Save Session Progress**
```typescript
useEffect(() => {
  if (currentSessionId && images.length > 0) {
    const generatedCount = images.filter(img => img.status === "success").length;
    const failedCount = images.filter(img => img.status === "failed").length;
    const allComplete = images.every(img =>
      img.status === "success" || img.status === "failed"
    );

    updateSession(currentSessionId, {
      generated_count: generatedCount,
      failed_count: failedCount,
      status: isGeneratingImages ? "in_progress" :
              (allComplete ? "completed" : "paused"),
    });
  }
}, [images, isGeneratingImages, currentSessionId, updateSession]);
```

**Step 5: Update handleGenerateImages**

Add session creation at the start of image generation:

```typescript
const handleGenerateImages = useCallback(async () => {
  setIsGeneratingImages(true);
  setShouldStop(false);
  setError("");
  setStep("generate");

  // Create or update session
  let sessionId = currentSessionId;
  if (!sessionId) {
    const newSession = createSession({
      creative_name: creativeName,
      abcd_selection: {
        A1: selection.sceneCategory,
        A2: selection.sceneDetail,
        B: selection.action,
        C: selection.driver,
        D: selection.format,
      },
      prompt: prompt,
      product_state: productState as "FOLDED" | "UNFOLDED",
      reference_image_url: referenceImageUrl,
      total_images: totalImages,
    });
    sessionId = newSession.id;
  }

  // ... rest of generation logic
}, [/* dependencies */]);
```

**Step 6: Add Session Handlers**

```typescript
const handleSessionSelect = useCallback((session: SessionSummary) => {
  loadSession(session.id);
}, [loadSession]);

const handleNewSession = useCallback(() => {
  startNewSession();
  // Reset all state
  setSelection({
    sceneCategory: "",
    sceneDetail: "",
    action: "",
    driver: "",
    format: "",
  });
  setStep("select");
  setPrompt("");
  setEditedPrompt("");
  setProductState("");
  setReferenceImageUrl("");
  setCreativeName("");
  setImages([]);
  setCurrentImageIndex(0);
  setError("");
}, [startNewSession]);

const handleReset = () => {
  handleNewSession();
};
```

**Step 7: Add SessionList to JSX**

In the left column div (before ABCD selector):

```typescript
{/* Session List */}
{isLoaded && (
  <SessionList
    sessions={sessions}
    currentSessionId={currentSessionId}
    onSessionSelect={handleSessionSelect}
    onNewSession={handleNewSession}
  />
)}

{/* ABCD Selector - Read-only for existing sessions */}
<div className={currentSession ? "opacity-60 pointer-events-none" : ""}>
  <ABCDSelector onSelectionChange={setSelection} />
</div>
```

**Step 8: Add Resume Button**

In the action buttons section:

```typescript
{/* Resume button for paused sessions */}
{step === "generate" &&
 hasPendingImages &&
 !isGeneratingImages && (
  <Button
    size="lg"
    className="w-full"
    onClick={handleResumeGeneration}
  >
    <Play className="mr-2 h-5 w-5" />
    Resume Generation
  </Button>
)}
```

---

## Phase 3: Testing

### 3.1 Manual Testing Checklist

- [ ] **Create Session**
  - [ ] Complete ABCD selection
  - [ ] Generate prompt
  - [ ] Start generation
  - [ ] Verify session appears in list

- [ ] **Session Persistence**
  - [ ] Refresh page
  - [ ] Verify sessions still exist
  - [ ] Verify current session loads correctly

- [ ] **Load Existing Session**
  - [ ] Click on a paused session
  - [ ] Verify ABCD data loads (read-only)
  - [ ] Verify prompt loads
  - [ ] Verify images load

- [ ] **Resume Generation**
  - [ ] Load paused session
  - [ ] Click "Resume Generation"
  - [ ] Verify generation continues from last image

- [ ] **Multiple Sessions**
  - [ ] Create 3+ sessions
  - [ ] Switch between sessions
  - [ ] Verify data isolation

- [ ] **Search**
  - [ ] Create 4+ sessions
  - [ ] Search by name
  - [ ] Verify filtering works

- [ ] **Status Badges**
  - [ ] Verify "In Progress" shows spinner
  - [ ] Verify "Paused" shows yellow
  - [ ] Verify "Completed" shows green
  - [ ] Verify colors match documentation

- [ ] **Progress Bars**
  - [ ] Verify progress percentage calculation
  - [ ] Verify color coding
  - [ ] Verify animation

- [ ] **Collapse/Expand**
  - [ ] Click collapse button
  - [ ] Verify list minimizes
  - [ ] Click to expand
  - [ ] Verify list shows again

### 3.2 Edge Cases

- [ ] **Empty Session List**
  - [ ] Verify "No sessions yet" message
  - [ ] Verify "New Session" button works

- [ ] **Long Session Names**
  - [ ] Create session with 50+ character name
  - [ ] Verify truncation works

- [ ] **Failed Images**
  - [ ] Simulate API failure
  - [ ] Verify failed count updates
  - [ ] Verify status changes to "failed"

- [ ] **Browser Refresh During Generation**
  - [ ] Start generation
  - [ ] Refresh page mid-generation
  - [ ] Verify session saves with partial progress

- [ ] **localStorage Full**
  - [ ] Create 100+ sessions
  - [ ] Verify quota handling

---

## Phase 4: Optional Enhancements

### 4.1 Backend Integration

If you want to persist sessions to Supabase:

- [ ] Create database schema
  ```sql
  create table generation_sessions (
    id uuid primary key default uuid_generate_v4(),
    creative_name text not null,
    abcd_selection jsonb not null,
    prompt text not null,
    product_state text not null,
    reference_image_url text not null,
    status text not null,
    total_images int not null,
    generated_count int default 0,
    failed_count int default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create table generated_images (
    id uuid primary key default uuid_generate_v4(),
    session_id uuid references generation_sessions(id),
    image_index int not null,
    storage_url text,
    status text not null,
    created_at timestamptz default now()
  );
  ```

- [ ] Create API routes
  - [ ] POST `/api/sessions` - Create session
  - [ ] GET `/api/sessions` - List sessions
  - [ ] GET `/api/sessions/[id]` - Get session detail
  - [ ] PATCH `/api/sessions/[id]` - Update session
  - [ ] DELETE `/api/sessions/[id]` - Delete session

- [ ] Update `useSessionManager` to use API instead of localStorage

### 4.2 Real-time Updates

If you want live progress updates:

- [ ] Set up Supabase Realtime
- [ ] Subscribe to session changes
- [ ] Update UI on remote changes

### 4.3 Export/Import

- [ ] Add "Export Session" button (JSON download)
- [ ] Add "Import Session" button (JSON upload)

---

## Phase 5: Deployment

### 5.1 Pre-Deployment Checks

- [ ] All TypeScript errors resolved
- [ ] No console errors
- [ ] All features tested
- [ ] Documentation updated

### 5.2 Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "feat: Add session management system"
git push origin main

# Vercel auto-deploys on push
```

### 5.3 Post-Deployment Verification

- [ ] Test on production URL
- [ ] Verify localStorage works
- [ ] Test on mobile
- [ ] Check browser compatibility

---

## Troubleshooting

### Issue: Sessions not showing
**Solution**: Check browser console for errors, verify `isLoaded` is true

### Issue: "Cannot read property of undefined"
**Solution**: Ensure all required fields exist in session data

### Issue: Images not loading
**Solution**: Verify `storage_url` field is populated

### Issue: Search not working
**Solution**: Check `creative_name` field exists and is a string

---

## Migration Guide (From Old to New)

If you already have users with existing data:

### Step 1: Data Migration Script

Create `/scripts/migrate-sessions.ts`:

```typescript
// Convert old localStorage format to new session format
const migrateOldSessions = () => {
  const oldData = localStorage.getItem('old_key');
  if (!oldData) return;

  const parsed = JSON.parse(oldData);
  const newSessions = parsed.map((old: any) => ({
    id: old.id || `session-${Date.now()}`,
    creative_name: old.name || "Untitled",
    abcd_selection: old.selection,
    prompt: old.prompt,
    product_state: old.productState,
    reference_image_url: old.referenceUrl,
    status: old.isComplete ? "completed" : "paused",
    total_images: 20,
    generated_count: old.images?.length || 0,
    failed_count: 0,
    created_at: old.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  localStorage.setItem('rolloy_creative_sessions', JSON.stringify(newSessions));
  localStorage.removeItem('old_key');
};
```

### Step 2: Run Migration on Mount

```typescript
useEffect(() => {
  migrateOldSessions();
}, []);
```

---

## Performance Optimization

### For 100+ Sessions

1. **Implement Pagination**
   ```typescript
   const ITEMS_PER_PAGE = 20;
   const [page, setPage] = useState(1);

   const paginatedSessions = sortedSessions.slice(
     (page - 1) * ITEMS_PER_PAGE,
     page * ITEMS_PER_PAGE
   );
   ```

2. **Add Virtual Scrolling**
   ```bash
   npm install react-virtual
   ```

3. **Lazy Load Images**
   ```typescript
   <img loading="lazy" src={image.url} />
   ```

---

## Next Steps

Once session system is working:

1. [ ] Add session analytics (most used ABCD combos)
2. [ ] Add session templates
3. [ ] Add session sharing (export link)
4. [ ] Add bulk operations (delete multiple)
5. [ ] Add session folders/tags

---

## Support & Resources

- **Documentation**: `/docs/SESSION_SYSTEM_GUIDE.md`
- **Examples**: `/docs/SESSION_UI_EXAMPLES.md`
- **Reference Implementation**: `/app/page-with-sessions.tsx`
- **Type Definitions**: `/lib/types/session.ts`

---

**Last Updated**: 2025-12-06
**Current Phase**: Phase 2 - Ready for Integration
