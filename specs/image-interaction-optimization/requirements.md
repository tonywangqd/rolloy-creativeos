# Image Interaction Optimization - Requirements

## 1. CONTEXT & BUSINESS GOALS

### Problem Statement
Current gallery implementation has two critical UX issues:
1. **Visual Occlusion**: Selected state indicators (checkmark, arrows, V-series labels) obstruct the actual image content
2. **Interaction Conflict**: The entire image acts as a selection toggle, preventing users from previewing/enlarging images

### Business Impact
- Users cannot properly evaluate image quality before selection
- Reduced conversion rate from generation to download/save
- Increased cognitive load due to unclear affordances

### Success Metrics
- Click-to-preview rate > 60% of total image interactions
- Selection error rate < 5% (mis-clicks on preview vs. select)
- Time-to-decision (select images) reduced by 30%

---

## 2. USER STORIES

### Story 1: Image Preview
**As a** creative professional
**I want to** click on a generated image to see it in full resolution
**So that** I can evaluate details before deciding to download

### Story 2: Explicit Selection
**As a** user managing multiple images
**I want to** clearly see which images are selected via a dedicated checkbox
**So that** I can make deliberate selection choices without accidental toggles

### Story 3: Unobstructed Viewing
**As a** user reviewing generated content
**I want to** see metadata (V-series labels, quality indicators) without blocking the image
**So that** I can assess both content and metadata simultaneously

---

## 3. INTERACTION DESIGN SPECIFICATION

### 3.1 Click Zone Partitioning

```
┌─────────────────────────────┐
│ [Checkbox]           [Info] │ ← Top Overlay Bar (12% height)
│                             │
│                             │
│      PREVIEW ZONE           │ ← Main Area (click = Lightbox)
│      (88% area)             │
│                             │
│                             │
└─────────────────────────────┘
```

#### Zone Definition Table

| Zone | Location | Interaction | Priority | Dimensions |
|------|----------|-------------|----------|------------|
| **Checkbox Area** | Top-left corner | Select/Deselect | High | 40×40px hit area (min) |
| **Info Overlay** | Top-right corner | Passive display | Low | Auto-width, max 30% |
| **Main Image** | Center 88% | Open Lightbox | High | Remaining area |

### 3.2 Checkbox States (Visual Design)

#### State Matrix

| State | Visual Treatment | Icon | Background | Border |
|-------|------------------|------|------------|--------|
| **Unselected (Default)** | Checkbox outline | Empty square | rgba(0,0,0,0.3) | 2px white |
| **Unselected (Hover)** | Checkbox outline | Empty square | rgba(0,0,0,0.5) | 2px white |
| **Selected** | Filled checkbox | Check icon (white) | Primary color (blue) | None |
| **Selected (Hover)** | Filled checkbox | Check icon (white) | Primary color +10% lighter | None |

#### Positioning
- **Top-Left Corner**: 8px from top, 8px from left
- **Size**: 24×24px visual, 40×40px touch target
- **Z-Index**: Above image, below tooltip (z-index: 10)
- **Accessibility**: `aria-label="Select image {id}"`

---

## 4. OVERLAY ELEMENT OPTIMIZATION

### 4.1 V-Series Badge Relocation

**Current Issue**: Badge overlays image content
**Solution**: Bottom-right corner with semi-transparent backdrop

```
Position: absolute
Bottom: 8px
Right: 8px
Background: rgba(0, 0, 0, 0.6)
Backdrop-filter: blur(4px)
Padding: 4px 8px
Border-radius: 4px
Font-size: 12px
Color: white
```

### 4.2 Metadata Overlay (Optional Enhancement)

For additional info (resolution, prompt version, etc.):
- **Trigger**: Hover over info icon (top-right)
- **Display**: Tooltip/popover (not permanent overlay)
- **Content**: Max 3 key metrics (e.g., "1024×1024", "V2.1", "Rating: 4.2")

---

## 5. LIGHTBOX SPECIFICATION

### 5.1 Trigger Condition
```
IF user clicks on Main Image Area (not checkbox, not badges)
THEN open Lightbox modal
```

### 5.2 Lightbox Features (Minimum Viable)

| Feature | Requirement | Priority |
|---------|-------------|----------|
| Full-screen display | 90% viewport width/height | Must-have |
| Close button | ESC key + X button | Must-have |
| Background dimming | rgba(0,0,0,0.8) | Must-have |
| Keyboard navigation | Left/Right arrows for prev/next | Should-have |
| Zoom controls | Pinch/scroll to zoom | Nice-to-have |

### 5.3 Selection in Lightbox
- Checkbox remains visible in Lightbox (top-left of modal)
- User can select/deselect without closing Lightbox
- Keyboard shortcut: `S` key to toggle selection

---

## 6. BUSINESS RULES & EDGE CASES

### Rule Matrix

| Scenario | Condition | System Behavior |
|----------|-----------|-----------------|
| Click checkbox while unselected | Checkbox not in selectedImages Set | Add to Set, update UI instantly |
| Click checkbox while selected | Checkbox in selectedImages Set | Remove from Set, update UI instantly |
| Click main image | Not on checkbox hit area | Open Lightbox, maintain selection state |
| Click on V-badge | Badge area (bottom-right 60×30px) | No action (passive display) |
| Double-click image | Any click within 300ms | Prevent default, treat as single click |
| Image loading failed | URL returns 404/500 | Show placeholder + disable selection |

### Accessibility Requirements
- All interactive elements must have ARIA labels
- Keyboard-only navigation: Tab to checkbox, Enter to toggle, Tab to image, Enter for Lightbox
- Focus indicators: 2px outline offset 2px
- Screen reader: Announce selection state changes

---

## 7. ACCEPTANCE CRITERIA (GHERKIN)

### Scenario 1: Explicit Checkbox Selection
```gherkin
Given the gallery displays 10 generated images
When I click the checkbox in the top-left corner of image #3
Then image #3 is added to selectedImages
And the checkbox shows a filled blue background with white checkmark
And the image border changes to 2px solid primary color
And the "Save Selected" button count increases to (1)
```

### Scenario 2: Lightbox Preview
```gherkin
Given image #5 is NOT selected
When I click the center area of image #5 (not the checkbox)
Then a Lightbox modal opens
And the modal displays image #5 in full resolution
And the background is dimmed to rgba(0,0,0,0.8)
And the checkbox is visible in the modal's top-left corner
And pressing ESC closes the Lightbox
```

### Scenario 3: Selection Persistence in Lightbox
```gherkin
Given image #2 is already selected
And the Lightbox is open for image #2
When I click the checkbox in the Lightbox
Then image #2 is deselected
And the checkbox changes to unselected state
And I close the Lightbox
Then the gallery view shows image #2 as unselected
```

### Scenario 4: V-Badge Non-Interference
```gherkin
Given image #7 displays a "V2.1" badge at bottom-right
When I hover over the badge area
Then no tooltip or interaction occurs
And clicking the badge does NOT trigger selection or Lightbox
And the badge background has 60% opacity with 4px blur
```

### Scenario 5: Keyboard Navigation
```gherkin
Given the gallery has focus
When I press Tab until checkbox of image #4 is focused
And I press Enter
Then image #4 is selected
And I press Tab to focus the image itself
And I press Enter
Then the Lightbox opens for image #4
```

---

## 8. DATA REQUIREMENTS (for future analytics)

### Event Tracking Schema
```typescript
interface ImageInteractionEvent {
  event_type: 'checkbox_click' | 'image_preview' | 'lightbox_close' | 'badge_view';
  image_id: string;
  session_id: string;
  timestamp: ISO8601;
  previous_state: 'selected' | 'unselected';
  new_state: 'selected' | 'unselected' | null;
  interaction_duration_ms: number; // for Lightbox
}
```

No immediate database changes required; log to console for initial rollout.

---

## 9. OUT OF SCOPE (for this iteration)

- Bulk actions in Lightbox (select multiple while previewing)
- Image comparison mode (side-by-side preview)
- Inline editing/cropping
- Download single image from Lightbox (use existing "Save Selected" flow)
- Mobile swipe gestures (rely on click/tap for now)

---

## 10. DEPENDENCIES & CONSTRAINTS

### Technical Constraints
- Must use existing `selectedImages` state management
- Lightbox library: Use `next-image` compatible solution or Shadcn Dialog
- No third-party analytics in v1 (log events client-side only)

### Design System Constraints
- Follow Shadcn color tokens (primary, muted-foreground, etc.)
- Use Lucide icons (`Check`, `Square`, `CheckSquare`)
- Maintain 4px/8px spacing grid

### Browser Support
- Modern evergreen browsers (Chrome, Firefox, Safari, Edge latest 2 versions)
- Pointer/Touch events API for unified interaction handling

---

## APPENDIX: Design Reference

### Color Palette (from Tailwind/Shadcn)
```css
--primary: hsl(var(--primary)); /* Blue for selected state */
--muted-foreground: hsl(var(--muted-foreground)); /* Hover borders */
--background: hsl(var(--background)); /* Lightbox backdrop */
```

### Animation Timing
- Checkbox state transition: 150ms ease-in-out
- Border color change: 200ms ease
- Lightbox open/close: 250ms cubic-bezier(0.4, 0, 0.2, 1)

---

**Document Version**: 1.0
**Author**: Product Director
**Date**: 2025-12-11
**Status**: Ready for Implementation
