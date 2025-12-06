# Session Management - Component Tree & Data Flow

## Visual Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HomePage Component                            │
│                         (app/page-with-sessions.tsx)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
          ┌─────────▼────────┐           ┌─────────▼──────────┐
          │  Left Sidebar    │           │  Right Content     │
          │  (1/3 width)     │           │  (2/3 width)       │
          └─────────┬────────┘           └─────────┬──────────┘
                    │                               │
        ┌───────────┼───────────┐                   │
        │           │           │                   │
┌───────▼────┐ ┌────▼─────┐ ┌──▼────────┐  ┌──────▼──────────┐
│ SessionList│ │  ABCD    │ │  Naming   │  │  Prompt/Gallery │
│ Component  │ │ Selector │ │   Card    │  │     Cards       │
└───────┬────┘ └──────────┘ └───────────┘  └─────────────────┘
        │
        │
┌───────┴─────────────────────────────────────────────────────┐
│                   SessionList Internals                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         CardHeader (Title + Collapse)              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │         CardContent                                │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │  Button: "New Session"                       │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │  Input: Search (shows if 3+ sessions)        │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │         ScrollArea (max-h-400px)             │ │   │
│  │  │  ┌────────────────────────────────────────┐ │ │   │
│  │  │  │     SessionItem 1 (Active)             │ │ │   │
│  │  │  │  ┌──────────────────────────────────┐ │ │ │   │
│  │  │  │  │  Creative Name + StatusBadge     │ │ │ │   │
│  │  │  │  └──────────────────────────────────┘ │ │ │   │
│  │  │  │  ┌──────────────────────────────────┐ │ │ │   │
│  │  │  │  │  Time (with Clock icon)          │ │ │ │   │
│  │  │  │  └──────────────────────────────────┘ │ │ │   │
│  │  │  │  ┌──────────────────────────────────┐ │ │ │   │
│  │  │  │  │  Progress Bar + Percentage       │ │ │ │   │
│  │  │  │  └──────────────────────────────────┘ │ │ │   │
│  │  │  └────────────────────────────────────┘ │ │ │   │
│  │  │  │                                        │ │ │   │
│  │  │  │     SessionItem 2                     │ │ │   │
│  │  │  │     SessionItem 3                     │ │ │   │
│  │  │  │     ...                               │ │ │   │
│  │  │  └────────────────────────────────────────┘ │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │  Stats Footer (Total / Active)               │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. SessionList (Main Container)
**File**: `components/sessions/session-list.tsx`

**Children**:
- Card (from shadcn)
  - CardHeader
    - CardTitle (with History icon)
    - Button (collapse)
  - CardContent
    - Button ("New Session")
    - Input (search)
    - ScrollArea
      - SessionItem[] (array)
    - Stats div

**Props**:
```typescript
{
  sessions: SessionSummary[];
  currentSessionId: string | null;
  onSessionSelect: (session: SessionSummary) => void;
  onNewSession: () => void;
  className?: string;
}
```

**State**:
- `searchQuery: string` - Search input value
- `isCollapsed: boolean` - Collapsed/expanded state

---

### 2. SessionItem (Individual Card)
**File**: `components/sessions/session-item.tsx`

**Children**:
- button (wrapper)
  - div (creative name row)
    - h4 (name)
    - SessionStatusBadge
  - div (time row)
    - Clock icon
    - span (relative time)
  - div (progress row)
    - Image icon
    - span (count)
    - div (progress bar)
    - span (percentage)

**Props**:
```typescript
{
  session: SessionSummary;
  isActive: boolean;
  onClick: () => void;
}
```

**No State** (stateless component)

---

### 3. SessionStatusBadge (Status Indicator)
**File**: `components/sessions/session-status-badge.tsx`

**Children**:
- Badge
  - Icon (conditional)
  - span (label)

**Props**:
```typescript
{
  status: SessionStatus;
  showIcon?: boolean;
}
```

**No State** (stateless component)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interactions                       │
└────────┬────────────────────────────────────────────────────┘
         │
         │  1. Click "New Session"
         │  2. Click session item
         │  3. Type in search
         │  4. Click collapse
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Handlers                           │
│  • onNewSession()                                           │
│  • onSessionSelect(session)                                 │
│  • setSearchQuery(query)                                    │
│  • setIsCollapsed(bool)                                     │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│               useSessionManager Hook                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  State:                                               │ │
│  │  • sessions: SessionSummary[]                         │ │
│  │  • currentSessionId: string | null                    │ │
│  │  • currentSession: SessionSummary | null              │ │
│  │                                                       │ │
│  │  Methods:                                             │ │
│  │  • createSession(data) → Session                      │ │
│  │  • updateSession(id, updates)                         │ │
│  │  • loadSession(id)                                    │ │
│  │  • startNewSession()                                  │ │
│  │  • deleteSession(id)                                  │ │
│  └───────────────────────────────────────────────────────┘ │
└────────┬────────────────────────────────────────────────────┘
         │
         │  Save/Load
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   localStorage                              │
│  Key: "rolloy_creative_sessions"                            │
│  Value: JSON.stringify(SessionSummary[])                    │
│                                                             │
│  Format:                                                    │
│  [                                                          │
│    {                                                        │
│      id: "session-123",                                     │
│      creative_name: "Beach Sunrise",                        │
│      status: "paused",                                      │
│      generated_count: 12,                                   │
│      total_images: 20,                                      │
│      ...                                                    │
│    },                                                       │
│    ...                                                      │
│  ]                                                          │
└────────┬────────────────────────────────────────────────────┘
         │
         │  Read on mount
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Component Re-render                         │
│  SessionList receives new sessions prop                     │
│  → Filters by search                                        │
│  → Sorts by updated_at                                      │
│  → Renders SessionItems                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## State Management Flow

### Creating a Session

```
User clicks "Generate Images"
         ↓
Page checks: currentSessionId exists?
         ↓ (NO)
Call: createSession({
  creative_name: "Beach Sunrise",
  abcd_selection: {...},
  prompt: "...",
  ...
})
         ↓
useSessionManager:
  1. Generate new ID
  2. Create session object
  3. Add to sessions array
  4. Set as currentSessionId
  5. Save to localStorage
         ↓
Page re-renders
         ↓
SessionList receives new sessions
         ↓
New session appears at top
```

### Loading a Session

```
User clicks SessionItem
         ↓
onSessionSelect(session) called
         ↓
loadSession(session.id)
         ↓
useSessionManager:
  Set currentSessionId = session.id
         ↓
useEffect in page.tsx detects currentSession change
         ↓
Load session data into form:
  - setSelection(currentSession.abcd_selection)
  - setPrompt(currentSession.prompt)
  - setImages(currentSession.images)
  - etc.
         ↓
UI updates with session data
```

### Auto-Saving Progress

```
Image generation completes
         ↓
setImages([...updated images])
         ↓
useEffect detects images change
         ↓
Calculate:
  - generatedCount
  - failedCount
  - status (in_progress/paused/completed)
         ↓
updateSession(currentSessionId, {
  generated_count: 12,
  failed_count: 0,
  status: "in_progress"
})
         ↓
useSessionManager:
  1. Find session by ID
  2. Merge updates
  3. Set updated_at = now()
  4. Save to localStorage
         ↓
SessionList re-renders
         ↓
Progress bar updates to 60%
```

---

## Component Props Flow

```
HomePage
  │
  ├─ sessions (from useSessionManager)
  │     ↓
  ├─ currentSessionId (from useSessionManager)
  │     ↓
  └─ SessionList
        │
        ├─ sessions ────────────────────────┐
        │                                   │
        ├─ currentSessionId ────────────┐   │
        │                               │   │
        ├─ onSessionSelect ─────────┐   │   │
        │                           │   │   │
        └─ onNewSession ────────┐   │   │   │
                                │   │   │   │
              ┌─────────────────┴───┴───┴───┴──────────┐
              │                                         │
              │  filters, sorts, maps sessions          │
              │                                         │
              ▼                                         ▼
        SessionItem (1)                           SessionItem (2)
              │                                         │
              ├─ session: sessions[0]                   ├─ session: sessions[1]
              ├─ isActive: id === currentSessionId      ├─ isActive: id === currentSessionId
              └─ onClick: () => onSessionSelect(s)      └─ onClick: () => onSessionSelect(s)
                    │                                         │
                    └─ SessionStatusBadge                     └─ SessionStatusBadge
                          │                                         │
                          └─ status: session.status                 └─ status: session.status
```

---

## Lifecycle Events

### On Page Load

```
1. HomePage mounts
     ↓
2. useSessionManager initializes
     ↓
3. useEffect: Load from localStorage
     ↓
4. setSessions(parsed data)
     ↓
5. setIsLoaded(true)
     ↓
6. SessionList renders
     ↓
7. Map sessions → SessionItems
```

### On Session Create

```
1. User starts generation
     ↓
2. Call createSession(data)
     ↓
3. Hook: Add to sessions array
     ↓
4. Hook: Save to localStorage
     ↓
5. Hook: Set currentSessionId
     ↓
6. SessionList re-renders
     ↓
7. New session appears (highlighted)
```

### On Session Update

```
1. Image generation completes
     ↓
2. Call updateSession(id, { generated_count: 13 })
     ↓
3. Hook: Find session, merge updates
     ↓
4. Hook: Save to localStorage
     ↓
5. SessionList re-renders
     ↓
6. Progress bar animates to new value
```

### On Session Switch

```
1. User clicks different session
     ↓
2. Call loadSession(newId)
     ↓
3. Hook: Set currentSessionId = newId
     ↓
4. Page useEffect detects change
     ↓
5. Load data into form
     ↓
6. SessionList re-renders (new highlight)
     ↓
7. ABCD selector becomes read-only
```

---

## Performance Optimizations

### Memo & Callback Usage

```typescript
// SessionList.tsx
const filteredSessions = useMemo(
  () => sessions.filter(s => s.creative_name.includes(searchQuery)),
  [sessions, searchQuery]
);

const sortedSessions = useMemo(
  () => [...filteredSessions].sort((a, b) => ...),
  [filteredSessions]
);

// SessionItem.tsx
const SessionItem = React.memo(({ session, isActive, onClick }) => {
  // Component doesn't re-render if props unchanged
});

// page-with-sessions.tsx
const handleSessionSelect = useCallback(
  (session) => loadSession(session.id),
  [loadSession]
);
```

### Virtual Scrolling (Future)

For 100+ sessions, add react-virtual:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: sortedSessions.length,
  getScrollElement: () => scrollAreaRef.current,
  estimateSize: () => 80, // Height of SessionItem
});
```

---

## Type Safety Flow

```
TypeScript Types (session.ts)
         ↓
SessionSummary interface
         ↓
useSessionManager: sessions typed as SessionSummary[]
         ↓
SessionList: receives SessionSummary[]
         ↓
SessionItem: receives SessionSummary
         ↓
SessionStatusBadge: receives SessionStatus
         ↓
All props type-checked at compile time
```

---

## Error Handling

### localStorage Quota Exceeded

```typescript
try {
  localStorage.setItem('rolloy_creative_sessions', JSON.stringify(sessions));
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Show warning: "Storage full, old sessions will be removed"
    // Keep only latest 50 sessions
    const latest50 = sessions.slice(0, 50);
    localStorage.setItem('rolloy_creative_sessions', JSON.stringify(latest50));
  }
}
```

### Corrupted Data

```typescript
const stored = localStorage.getItem('rolloy_creative_sessions');
try {
  const parsed = JSON.parse(stored);
  // Validate structure
  if (!Array.isArray(parsed)) throw new Error('Invalid format');
  setSessions(parsed);
} catch (error) {
  console.error('Corrupted session data, clearing...');
  localStorage.removeItem('rolloy_creative_sessions');
  setSessions([]);
}
```

### Session Not Found

```typescript
const loadSession = (id: string) => {
  const session = sessions.find(s => s.id === id);
  if (!session) {
    console.error('Session not found:', id);
    setCurrentSessionId(null);
    return;
  }
  setCurrentSessionId(id);
};
```

---

## File Dependencies

```
page-with-sessions.tsx
  ├── imports SessionList from components/sessions/session-list.tsx
  ├── imports useSessionManager from lib/hooks/use-session-manager.ts
  └── imports SessionSummary from lib/types/session.ts

session-list.tsx
  ├── imports SessionItem from ./session-item.tsx
  ├── imports Button, Card, Input from components/ui/*
  ├── imports ScrollArea from components/ui/scroll-area.tsx
  └── imports SessionSummary from lib/types/session.ts

session-item.tsx
  ├── imports SessionStatusBadge from ./session-status-badge.tsx
  ├── imports formatDistanceToNow from date-fns
  ├── imports zhCN from date-fns/locale
  └── imports SessionSummary from lib/types/session.ts

session-status-badge.tsx
  ├── imports Badge from components/ui/badge.tsx
  ├── imports icons from lucide-react
  └── imports SessionStatus from lib/types/session.ts

use-session-manager.ts
  └── imports Session, CreateSessionData, UpdateSessionData from lib/types/session.ts
```

---

## Summary

This component tree implements a **clean separation of concerns**:

- **Data Layer**: `useSessionManager` (localStorage abstraction)
- **UI Layer**: `SessionList`, `SessionItem`, `SessionStatusBadge` (presentation)
- **Type Layer**: `session.ts` (type safety)
- **Integration Layer**: `page-with-sessions.tsx` (orchestration)

All components are:
- **Type-safe**: Full TypeScript coverage
- **Performant**: Memoized, virtualized (future)
- **Accessible**: ARIA labels, keyboard navigation
- **Themeable**: Uses CSS custom properties

---

**Last Updated**: 2025-12-06
