# Rolloy Creative OS - Session Management System

## Overview

The Session Management System transforms Rolloy Creative OS from a single-use generation tool into a conversation-based platform where each generation workflow is saved as a persistent session. Users can view history, resume paused generations, and navigate between multiple creative projects.

---

## Architecture

### Component Structure

```
components/
├── sessions/
│   ├── session-list.tsx          # Main session list component
│   ├── session-item.tsx           # Individual session item
│   └── session-status-badge.tsx   # Status indicator badge
├── ui/
│   ├── badge.tsx                  # Badge component (new)
│   └── scroll-area.tsx            # Scroll container (new)
└── ...

lib/
├── types/
│   └── session.ts                 # TypeScript type definitions
└── hooks/
    └── use-session-manager.ts     # Session state management hook
```

---

## Key Features

### 1. Session Persistence
- All generation sessions are saved to `localStorage`
- Sessions persist across browser refreshes
- Automatic save on status/progress changes

### 2. Session States

| Status | Description | Icon | Color |
|--------|-------------|------|-------|
| `draft` | Created but not started | FileText | Gray |
| `in_progress` | Currently generating | Loader2 (spinning) | Blue |
| `paused` | User paused generation | PauseCircle | Yellow |
| `completed` | All images generated | CheckCircle2 | Green |
| `cancelled` | User cancelled | Ban | Gray |
| `failed` | Generation error | XCircle | Red |

### 3. Session List UI

**Location**: Left sidebar, above ABCD selector

**Features**:
- Collapsible design (saves space)
- Search functionality (shows when 3+ sessions)
- Recent-first sorting
- Active session highlighting
- Real-time progress indicators
- Stats footer (total sessions, active count)

**Session Item Display**:
```
┌─────────────────────────────────────┐
│ Beach Sunrise Campaign    [Paused]  │
│ ⏱ 2 hours ago                       │
│ 🖼 12/20 ████████░░░░░░░░░ 60%      │
└─────────────────────────────────────┘
```

---

## Type Definitions

### Core Types (from `lib/types/session.ts`)

```typescript
// Session Status
export type SessionStatus =
  | 'draft'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

// Image Status
export type ImageGenerationStatus =
  | 'pending'
  | 'generating'
  | 'success'
  | 'failed'
  | 'cancelled';

// Session Data Model
export interface GenerationSession {
  id: string;
  creative_name: string;
  description?: string;

  // ABCD Configuration
  abcd_selection: {
    A1: string;  // Scene Category
    A2: string;  // Scene Detail
    B: string;   // Action
    C: string;   // Driver
    D: string;   // Format
  };

  // Generation Parameters
  prompt: string;
  product_state: 'FOLDED' | 'UNFOLDED';
  reference_image_url: string;

  // Progress
  status: SessionStatus;
  total_images: number;
  generated_count: number;
  failed_count: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
}

// Enhanced Session Summary (for UI)
export interface SessionSummary extends GenerationSession {
  progress_percentage: number;
  pending_count: number;
  generating_count: number;
  success_count: number;
  latest_image_url?: string;
}
```

---

## Component API Reference

### 1. `SessionList`

Main container component for session history.

**Props**:
```typescript
interface SessionListProps {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  onSessionSelect: (session: SessionSummary) => void;
  onNewSession: () => void;
  className?: string;
}
```

**Usage**:
```tsx
<SessionList
  sessions={sessions}
  currentSessionId={currentSessionId}
  onSessionSelect={handleSessionSelect}
  onNewSession={handleNewSession}
/>
```

**Features**:
- Collapsible state (minimize to button)
- Search bar (auto-shows when 3+ sessions)
- Scrollable list (max height 400px)
- Stats footer

---

### 2. `SessionItem`

Individual session card in the list.

**Props**:
```typescript
interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  onClick: () => void;
}
```

**Visual States**:
- **Active**: Blue border, highlighted background
- **Inactive**: Neutral border, hover effect
- **Hover**: Border color transition

**Display Data**:
- Creative name (truncated if long)
- Status badge
- Relative time (e.g., "2 hours ago")
- Progress bar with percentage
- Image count (e.g., "12/20")

---

### 3. `SessionStatusBadge`

Status indicator with icon and label.

**Props**:
```typescript
interface SessionStatusBadgeProps {
  status: SessionStatus;
  showIcon?: boolean;  // default: true
}
```

**Usage**:
```tsx
<SessionStatusBadge status="in_progress" />
<SessionStatusBadge status="paused" showIcon={false} />
```

---

## Custom Hook: `useSessionManager`

Manages session CRUD operations and localStorage persistence.

**API**:
```typescript
const {
  sessions,              // SessionSummary[]
  currentSession,        // SessionSummary | null
  currentSessionId,      // string | null
  createSession,         // (data: CreateSessionRequest) => GenerationSession
  updateSession,         // (id: string, updates: UpdateSessionRequest) => void
  deleteSession,         // (id: string) => void
  loadSession,           // (id: string) => void
  startNewSession,       // () => void
  isLoaded,              // boolean
} = useSessionManager();
```

**Key Methods**:

### `createSession(data)`
Creates a new session and sets it as current.

```typescript
const newSession = createSession({
  creative_name: "Beach Sunrise Campaign",
  abcd_selection: { A1: "Beach", A2: "Sunrise", ... },
  prompt: "A serene beach at sunrise...",
  product_state: "FOLDED",
  reference_image_url: "https://...",
  total_images: 20,
});
```

### `updateSession(id, updates)`
Updates session properties.

```typescript
updateSession(sessionId, {
  status: "paused",
  generated_count: 12,
});
```

### `loadSession(id)`
Loads an existing session as current.

```typescript
loadSession("session-123");
```

### `startNewSession()`
Clears current session (for new workflow).

```typescript
startNewSession();
```

---

## Integration Guide

### Step 1: Import Required Components

```tsx
import { SessionList } from "@/components/sessions/session-list";
import { useSessionManager } from "@/lib/hooks/use-session-manager";
import type { SessionSummary } from "@/lib/types/session";
```

### Step 2: Initialize Hook

```tsx
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
```

### Step 3: Add SessionList to UI

```tsx
{isLoaded && (
  <SessionList
    sessions={sessions}
    currentSessionId={currentSessionId}
    onSessionSelect={handleSessionSelect}
    onNewSession={handleNewSession}
  />
)}
```

### Step 4: Load Session Data

```tsx
useEffect(() => {
  if (currentSession) {
    // Populate form with session data
    setSelection(currentSession.abcd_selection);
    setPrompt(currentSession.prompt);
    setCreativeName(currentSession.creative_name);
    // ... etc
  }
}, [currentSession]);
```

### Step 5: Auto-Save Progress

```tsx
useEffect(() => {
  if (currentSessionId && images.length > 0) {
    const generatedCount = images.filter(img => img.status === "success").length;

    updateSession(currentSessionId, {
      generated_count: generatedCount,
      status: isGenerating ? "in_progress" : "paused",
    });
  }
}, [images, isGenerating, currentSessionId]);
```

---

## User Workflows

### Workflow 1: New User First Time
1. User lands on Creative Workbench
2. No sessions exist → SessionList shows "No sessions yet"
3. User completes ABCD selection
4. User generates prompt
5. User starts generation → **Session auto-created**
6. SessionList now shows 1 session (status: "in_progress")

### Workflow 2: Returning User
1. User lands on Creative Workbench
2. SessionList shows past sessions
3. User clicks on a paused session
4. UI loads session data (read-only ABCD, existing images)
5. User clicks "Resume Generation"
6. Generation continues from last image

### Workflow 3: Multiple Sessions
1. User has 3 in-progress sessions
2. User clicks "New Session" button
3. Current session is cleared
4. ABCD selector becomes editable
5. User starts fresh workflow
6. New session appears in list

---

## UI/UX Best Practices

### Visual Hierarchy
- **Active session**: Primary color border + highlight
- **Recent sessions**: Listed first (sort by `updated_at`)
- **Status badges**: Color-coded for quick scanning

### Interaction Patterns
- **Click session item**: Load that session
- **Click "New Session"**: Start fresh
- **Search**: Real-time filtering (debounced)
- **Collapse**: Minimize to save space

### Loading States
- Show loading indicator until `isLoaded === true`
- Disable interactions during data fetch

### Error Handling
- Graceful localStorage failure (clear corrupted data)
- Session not found → Remove from list

---

## Styling & Theming

### Dark Theme Colors

All components use CSS custom properties from `globals.css`:

```css
.dark {
  --primary: 217.2 91.2% 59.8%;      /* Blue */
  --success: 142 76% 36%;             /* Green */
  --warning: 48 96% 53%;              /* Yellow */
  --destructive: 0 62.8% 30.6%;      /* Red */
  --muted: 217.2 32.6% 17.5%;        /* Gray */
}
```

### Badge Variants
- `info`: Blue (in_progress)
- `success`: Green (completed)
- `warning`: Yellow (paused)
- `destructive`: Red (failed)
- `secondary`: Gray (cancelled)
- `outline`: Gray border (draft)

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        User Action                           │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│                  useSessionManager Hook                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  sessions: SessionSummary[]                            │  │
│  │  currentSessionId: string | null                       │  │
│  │  createSession() / updateSession() / loadSession()     │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│                    localStorage                              │
│  Key: "rolloy_creative_sessions"                            │
│  Value: SessionSummary[] (JSON)                             │
└───────────────────┬──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│                   UI Components                              │
│  • SessionList (renders all sessions)                       │
│  • SessionItem (individual session card)                    │
│  • SessionStatusBadge (status indicator)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

### Phase 2 (Backend Integration)
- [ ] Replace localStorage with Supabase database
- [ ] Multi-user support with authentication
- [ ] Cloud sync across devices
- [ ] Session sharing/collaboration

### Phase 3 (Advanced Features)
- [ ] Session export (JSON/CSV)
- [ ] Duplicate session functionality
- [ ] Bulk operations (delete multiple)
- [ ] Session analytics dashboard
- [ ] Real-time progress WebSocket updates

### Phase 4 (AI Enhancements)
- [ ] Auto-name sessions based on ABCD selection
- [ ] Smart session recommendations
- [ ] Session templates/presets

---

## Troubleshooting

### Sessions not persisting
**Issue**: Sessions disappear on refresh
**Solution**: Check browser localStorage quota, clear corrupted data

```typescript
// Clear all sessions (in browser console)
localStorage.removeItem('rolloy_creative_sessions');
```

### "Session not found" error
**Issue**: User clicks session that was deleted
**Solution**: Hook automatically removes invalid sessions

### Search not working
**Issue**: Search input doesn't filter
**Solution**: Check `creative_name` field exists in session data

### Slow rendering with many sessions
**Issue**: 100+ sessions cause lag
**Solution**: Implement pagination (show 20 per page)

---

## Testing Checklist

- [ ] Create new session from fresh state
- [ ] Load existing session from list
- [ ] Resume paused generation
- [ ] Search functionality
- [ ] Collapse/expand session list
- [ ] Status badge colors correct
- [ ] Progress bar updates in real-time
- [ ] Relative time updates ("2 hours ago")
- [ ] Data persists after refresh
- [ ] Multiple sessions don't conflict

---

## File Reference

### Component Files
- `/components/sessions/session-list.tsx` - Main list component
- `/components/sessions/session-item.tsx` - Individual session card
- `/components/sessions/session-status-badge.tsx` - Status indicator

### Type Files
- `/lib/types/session.ts` - TypeScript interfaces

### Hook Files
- `/lib/hooks/use-session-manager.ts` - Session state management

### UI Components
- `/components/ui/badge.tsx` - Badge component
- `/components/ui/scroll-area.tsx` - Scroll container

### Example Integration
- `/app/page-with-sessions.tsx` - Reference implementation

---

## Support

For questions or issues:
1. Check this documentation first
2. Review example in `/app/page-with-sessions.tsx`
3. Check TypeScript types in `/lib/types/session.ts`
4. Inspect browser console for errors

---

**Last Updated**: 2025-12-06
**Version**: 1.0.0
