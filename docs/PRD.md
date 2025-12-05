# Rolloy Creative OS - Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2025-12-05
**Product Director:** Product Team
**Status:** Draft for Review

---

## 1. Executive Summary

### 1.1 Product Vision
Rolloy Creative OS is an internal creative production platform designed to industrialize the ABCD (Attention, Branding, Connection, Direction) creative methodology for DTC mobility aid advertising. The system transforms creative intuition into a data-driven, automated workflow that connects strategic parameters to AI-generated visual assets with full performance traceability.

### 1.2 Business Value
- **Efficiency:** Reduce creative production time from days to minutes (20+ variants per session)
- **Consistency:** Enforce ABCD best practices through systematic parameter selection
- **Traceability:** Enable data-driven creative optimization via structured naming conventions
- **Scalability:** Support rapid market testing across multiple creative hypotheses

### 1.3 Success Metrics
- Time to generate 20 ad variants: < 5 minutes
- Creative parameter adoption rate: 100% (enforced by system)
- Ad naming accuracy: 100% (auto-generated)
- Creative performance trackback rate: 100%

---

## 2. Problem Space

### 2.1 Current State Pain Points
1. **Inconsistent Methodology:** Creative decisions lack systematic framework, leading to unpredictable performance
2. **Manual Production Bottleneck:** Designers spend excessive time on mechanical variant generation
3. **Attribution Gap:** No reliable way to link creative parameters to campaign performance
4. **Quality Variance:** Ad-hoc production leads to inconsistent brand representation

### 2.2 Target Users
**Primary Persona: Creative Producer**
- Role: Marketing team member responsible for ad asset production
- Technical Skill: Intermediate (familiar with web tools, no coding required)
- Daily Task: Generate 10-50 ad variants for A/B testing
- Pain Point: Repetitive manual work, unclear which creative elements drive performance

**Secondary Persona: Performance Marketer**
- Role: Analyzes campaign data to optimize ROAS
- Need: Structured creative metadata to correlate with performance data
- Pain Point: Creative assets lack systematic labeling for analysis

---

## 3. Product Scope

### 3.1 In-Scope (MVP)
1. ABCD parameter configuration interface with cascading logic
2. Automatic creative naming generation (YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code])
3. Gemini + Flux Img2Img batch generation (20 variants)
4. Reference image management (Expanded/Folded state selection)
5. CSV export for batch results with metadata

### 3.2 Out-of-Scope (Post-MVP)
- Video/motion ad generation
- Real-time campaign performance integration
- Multi-language support
- Collaborative workflow (multi-user sessions)
- Version control for generated assets

---

## 4. User Stories

### Epic 1: Creative Configuration
**UC-001** As a Creative Producer, I want to select Scene (A) parameters with location-based sub-options, so that I can accurately describe the usage context.
- **Acceptance Criteria:**
  - Given I select "Home" as primary scene
  - When I access secondary scene dropdown
  - Then I see only "Washroom" and "LivingRoom" options
  - And "Transit" shows "Parking" and "Subway"

**UC-002** As a Creative Producer, I want to select Action (B) that determines product state, so that the system automatically picks the correct reference image.
- **Acceptance Criteria:**
  - Given I select Action = "Unfolding" OR "Using"
  - When reference image is retrieved
  - Then system loads "Expanded State" product image
  - And Action = "Carrying" OR "Storing" loads "Folded State" image

**UC-003** As a Creative Producer, I want to see a real-time preview of the auto-generated naming convention, so that I can verify creative metadata before generation.
- **Acceptance Criteria:**
  - Given I complete all ABCD selections
  - When any parameter changes
  - Then naming preview updates instantly with format: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]
  - And invalid selections show error state

### Epic 2: AI Visual Factory
**UC-004** As a Creative Producer, I want to trigger batch generation of 20 image variants via Gemini+Flux pipeline, so that I can rapidly produce testable assets.
- **Acceptance Criteria:**
  - Given all ABCD parameters are valid
  - When I click "Generate Assets"
  - Then system sends 20 sequential API calls with identical prompt base
  - And progress indicator shows completion status (X/20)
  - And generation completes within 5 minutes

**UC-005** As a Creative Producer, I want to provide a reference image that matches the selected Action state, so that generated outputs maintain product accuracy.
- **Acceptance Criteria:**
  - Given Action = "Unfolding"
  - When I access reference image selector
  - Then only "Expanded State" images are shown
  - And system validates image format (PNG/JPG, max 5MB)

**UC-006** As a Creative Producer, I want Gemini to analyze my reference image and generate context-aware prompts, so that Flux produces semantically consistent variations.
- **Acceptance Criteria:**
  - Given a reference image is uploaded
  - When Gemini API is called
  - Then it returns a structured prompt incorporating: reference visual elements, selected ABCD parameters, brand guidelines
  - And prompt length is < 500 characters

### Epic 3: Output Management
**UC-007** As a Creative Producer, I want to download all 20 generated images with auto-named filenames, so that I can directly upload to ad platforms.
- **Acceptance Criteria:**
  - Given generation is complete
  - When I click "Download All"
  - Then system creates ZIP file with structure: /YYYYMMDD_SessionID/[Individual named images]
  - And each image filename follows naming convention

**UC-008** As a Performance Marketer, I want to export a CSV manifest of all generated assets with full ABCD metadata, so that I can merge with campaign performance data.
- **Acceptance Criteria:**
  - Given generation session is complete
  - When I click "Export Metadata"
  - Then CSV contains columns: [Filename, Timestamp, ScenePrimary, SceneSecondary, Action, Driver, Format, ReferenceImageID]
  - And CSV is UTF-8 encoded with proper escaping

### Epic 4: Performance Insight (Future Phase)
**UC-009** As a Performance Marketer, I want to upload campaign CSV data to correlate creative parameters with ROAS, so that I can identify winning creative patterns.
- **Status:** Deferred to Phase 2
- **Acceptance Criteria:**
  - Given a CSV with columns [AdName, Impressions, Clicks, Conversions, Spend]
  - When I upload to dashboard
  - Then system parses naming convention to extract ABCD parameters
  - And generates pivot tables showing: CTR by Scene, CVR by Action, ROAS by Driver

---

## 5. Business Rules Matrix

### BR-1: Scene Hierarchy Logic
| Primary Scene (A1) | Valid Secondary Scenes (A2) |
|--------------------|-----------------------------|
| Home               | Washroom, LivingRoom        |
| Transit            | Parking, Subway             |
| Outdoor            | Park, Street                |

**Implementation:** Cascading dropdown with disabled state for invalid combinations.

### BR-2: Action to Product State Mapping
| Action (B)          | Product State | Reference Image Type |
|---------------------|---------------|----------------------|
| Unfolding           | Expanded      | Product-Expanded.png |
| Using               | Expanded      | Product-Expanded.png |
| Carrying            | Folded        | Product-Folded.png   |
| Storing             | Folded        | Product-Folded.png   |

**Implementation:** System automatically filters reference image library based on Action selection.

### BR-3: Naming Convention Format
```
Pattern: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]
Example: 20251205_Home_Washroom_Using_Independence_SQ1

Rules:
- Date: Generation date in ISO format (auto-populated)
- A1/A2: Scene codes (no spaces, CamelCase)
- B: Action code (no spaces)
- C: Driver code (no spaces)
- D-Code: Format abbreviation (SQ=Square, PT=Portrait, LS=Landscape + variant number)
```

### BR-4: Batch Generation Parameters
| Parameter          | Value | Rationale                                  |
|--------------------|-------|--------------------------------------------|
| Variants per batch | 20    | Balances API cost vs statistical validity  |
| API timeout        | 30s   | Per-image generation timeout               |
| Retry logic        | 3x    | Automatic retry for failed generations     |
| Image format       | PNG   | Lossless quality for archival              |
| Resolution         | 1080x1080 | Platform-optimal (Instagram/Facebook) |

### BR-5: Reference Image Validation
- **Allowed formats:** PNG, JPG, WEBP
- **Max file size:** 5MB
- **Min resolution:** 512x512px
- **Required metadata:** Product state tag (Expanded/Folded)

---

## 6. ABCD Matrix Data Structure

### 6.1 Complete Taxonomy Definition

```json
{
  "abcd_taxonomy": {
    "version": "1.0",
    "last_updated": "2025-12-05",

    "dimensions": {
      "A_Scene": {
        "label": "Usage Scene",
        "description": "Where the product is being used",
        "type": "hierarchical",
        "levels": [
          {
            "level": 1,
            "options": [
              {
                "code": "Home",
                "display": "Home Environment",
                "children": ["Washroom", "LivingRoom", "Kitchen"]
              },
              {
                "code": "Transit",
                "display": "In Transit",
                "children": ["Parking", "Subway", "Airport"]
              },
              {
                "code": "Outdoor",
                "display": "Outdoor Activities",
                "children": ["Park", "Street", "Beach"]
              },
              {
                "code": "Medical",
                "display": "Medical Settings",
                "children": ["Hospital", "Clinic", "Pharmacy"]
              }
            ]
          },
          {
            "level": 2,
            "inherited_from": "level_1_selection"
          }
        ]
      },

      "B_Action": {
        "label": "User Action",
        "description": "What the user is doing with the product",
        "type": "flat",
        "mapping_rules": {
          "product_state": {
            "Expanded": ["Unfolding", "Using", "Sitting", "Walking"],
            "Folded": ["Carrying", "Storing", "Packing", "Transporting"]
          }
        },
        "options": [
          {
            "code": "Unfolding",
            "display": "Unfolding the Walker",
            "product_state": "Expanded",
            "prompt_modifier": "mid-action shot of unfolding mechanism"
          },
          {
            "code": "Using",
            "display": "Actively Using",
            "product_state": "Expanded",
            "prompt_modifier": "user confidently using the walker"
          },
          {
            "code": "Sitting",
            "display": "Sitting/Resting",
            "product_state": "Expanded",
            "prompt_modifier": "user comfortably seated on walker"
          },
          {
            "code": "Walking",
            "display": "Walking with Support",
            "product_state": "Expanded",
            "prompt_modifier": "natural walking motion with walker"
          },
          {
            "code": "Carrying",
            "display": "Carrying Folded Unit",
            "product_state": "Folded",
            "prompt_modifier": "compact folded walker being carried"
          },
          {
            "code": "Storing",
            "display": "Storing Away",
            "product_state": "Folded",
            "prompt_modifier": "folded walker in storage position"
          },
          {
            "code": "Packing",
            "display": "Packing for Travel",
            "product_state": "Folded",
            "prompt_modifier": "folded walker being packed into car/bag"
          }
        ]
      },

      "C_Driver": {
        "label": "Emotional Driver",
        "description": "The emotional benefit or motivation",
        "type": "flat",
        "options": [
          {
            "code": "Independence",
            "display": "Regain Independence",
            "prompt_modifier": "confident, empowered expression",
            "target_emotion": "empowerment"
          },
          {
            "code": "Safety",
            "display": "Safety & Security",
            "prompt_modifier": "calm, secure environment",
            "target_emotion": "reassurance"
          },
          {
            "code": "Freedom",
            "display": "Freedom to Explore",
            "prompt_modifier": "open space, adventurous mood",
            "target_emotion": "aspiration"
          },
          {
            "code": "Dignity",
            "display": "Preserve Dignity",
            "prompt_modifier": "respectful, elegant composition",
            "target_emotion": "respect"
          },
          {
            "code": "Convenience",
            "display": "Convenience & Ease",
            "prompt_modifier": "effortless usage, simple interaction",
            "target_emotion": "relief"
          },
          {
            "code": "Social",
            "display": "Social Connection",
            "prompt_modifier": "interacting with others, community setting",
            "target_emotion": "belonging"
          }
        ]
      },

      "D_Format": {
        "label": "Creative Format",
        "description": "Visual composition and aspect ratio",
        "type": "flat",
        "options": [
          {
            "code": "SQ1",
            "display": "Square - Center Focus",
            "aspect_ratio": "1:1",
            "resolution": "1080x1080",
            "composition": "product centered, symmetrical"
          },
          {
            "code": "SQ2",
            "display": "Square - Lifestyle Context",
            "aspect_ratio": "1:1",
            "resolution": "1080x1080",
            "composition": "product in natural environment"
          },
          {
            "code": "PT1",
            "display": "Portrait - Full Body",
            "aspect_ratio": "4:5",
            "resolution": "1080x1350",
            "composition": "full user + product visible"
          },
          {
            "code": "PT2",
            "display": "Portrait - Close-up Detail",
            "aspect_ratio": "4:5",
            "resolution": "1080x1350",
            "composition": "focus on product features"
          },
          {
            "code": "LS1",
            "display": "Landscape - Wide Scene",
            "aspect_ratio": "16:9",
            "resolution": "1920x1080",
            "composition": "environmental context emphasized"
          },
          {
            "code": "LS2",
            "display": "Landscape - Product Hero",
            "aspect_ratio": "16:9",
            "resolution": "1920x1080",
            "composition": "product as primary subject"
          }
        ]
      }
    }
  }
}
```

### 6.2 Data Structure for Runtime State

```typescript
// Type definitions for implementation
interface CreativeConfig {
  sessionId: string;
  timestamp: string;

  parameters: {
    scenePrimary: SceneCode;
    sceneSecondary: string;
    action: ActionCode;
    driver: DriverCode;
    format: FormatCode;
  };

  derivedState: {
    productState: 'Expanded' | 'Folded';
    referenceImageId: string;
    generatedName: string;
  };

  generationConfig: {
    batchSize: 20;
    apiEndpoints: {
      gemini: string;
      flux: string;
    };
    promptTemplate: string;
  };
}

interface GeneratedAsset {
  assetId: string;
  filename: string; // Following naming convention
  sessionId: string;
  parameters: CreativeConfig['parameters'];
  metadata: {
    generationTimestamp: string;
    apiLatency: number;
    fileSize: number;
    checksum: string;
  };
}
```

---

## 7. User Flow Diagram (Text Description)

### 7.1 Primary Happy Path: Single Batch Generation

```
[Start]
  → User lands on Creative Workbench
  → Step 1: Select Scene (A)
      → Choose Primary Scene (dropdown)
      → Choose Secondary Scene (cascading dropdown, filtered by primary)
  → Step 2: Select Action (B)
      → Choose from action list
      → [System Action] Auto-determine product state
      → [System Action] Filter reference image library
  → Step 3: Select Driver (C)
      → Choose emotional driver
  → Step 4: Select Format (D)
      → Choose composition type
      → [System Action] Generate naming preview in real-time
  → Step 5: Upload Reference Image
      → Drag-drop or file picker
      → [System Validation] Check format/size/resolution
      → [System Action] Display thumbnail preview
  → Step 6: Confirm & Generate
      → Review parameter summary
      → Click "Generate 20 Variants"
      → [System Action] Show progress modal (0/20 → 20/20)
  → Step 7: Review Results
      → Grid view of 20 generated images
      → Click individual images to preview full-size
  → Step 8: Download Assets
      → Option A: Download All (ZIP)
      → Option B: Download Metadata CSV
      → Option C: Select individual images
[End]
```

### 7.2 Alternative Flow: Validation Error

```
[From Step 5: Upload Reference Image]
  → User uploads 10MB file
  → [System Action] Validation fails
  → Display error toast: "File size exceeds 5MB limit"
  → Return to file upload state
  → User corrects and retries
```

### 7.3 Alternative Flow: API Generation Failure

```
[From Step 6: Confirm & Generate]
  → Progress reaches 15/20
  → Flux API returns 503 error for image #16
  → [System Action] Auto-retry 3 times
  → If still fails:
      → Mark image #16 as "Failed"
      → Continue with remaining generations
  → At completion:
      → Show summary: "19/20 successful, 1 failed"
      → Option to retry failed items
```

---

## 8. MVP Feature Prioritization

### 8.1 Must-Have (Launch Blockers)
**Priority P0 - Required for core value delivery**

1. **ABCD Parameter Selection Interface**
   - Effort: 5 days
   - Risk: Low
   - Value: Critical (enables methodology enforcement)
   - Dependencies: None

2. **Automatic Naming Generation**
   - Effort: 2 days
   - Risk: Low
   - Value: Critical (enables performance tracking)
   - Dependencies: Parameter selection

3. **Gemini Vision API Integration**
   - Effort: 3 days
   - Risk: Medium (API stability)
   - Value: Critical (prompt intelligence)
   - Dependencies: Reference image upload

4. **Flux Img2Img Batch Generation**
   - Effort: 5 days
   - Risk: High (API rate limits, cost management)
   - Value: Critical (core production capability)
   - Dependencies: Gemini integration

5. **Reference Image Management**
   - Effort: 3 days
   - Risk: Low
   - Value: Critical (ensures product accuracy)
   - Dependencies: Action selection

6. **ZIP Download with Naming**
   - Effort: 2 days
   - Risk: Low
   - Value: Critical (deliverable format)
   - Dependencies: Generation complete

### 8.2 Should-Have (Enhance User Experience)
**Priority P1 - Defer if timeline pressure**

7. **CSV Metadata Export**
   - Effort: 2 days
   - Risk: Low
   - Value: High (enables future analytics)
   - Dependencies: Generation complete

8. **Progress Indicator with Retry**
   - Effort: 3 days
   - Risk: Medium
   - Value: High (handles API failures gracefully)
   - Dependencies: Batch generation

9. **Image Preview Gallery**
   - Effort: 3 days
   - Risk: Low
   - Value: Medium (quality control)
   - Dependencies: Generation complete

10. **Parameter Preset Templates**
    - Effort: 2 days
    - Risk: Low
    - Value: Medium (speeds up repetitive tasks)
    - Dependencies: Parameter selection

### 8.3 Could-Have (Post-MVP)
**Priority P2 - Phase 2 backlog**

11. **Performance Dashboard (CSV Upload + Analysis)**
    - Effort: 8 days
    - Risk: Medium
    - Value: High (closes feedback loop)
    - Dependencies: CSV naming convention adoption

12. **Version History for Generated Assets**
    - Effort: 5 days
    - Risk: Low
    - Value: Medium (supports iteration)
    - Dependencies: Database schema expansion

13. **Multi-User Collaboration**
    - Effort: 10 days
    - Risk: High (requires auth + real-time sync)
    - Value: Medium (team efficiency)
    - Dependencies: User management system

### 8.4 Won't-Have (Out of Scope)
- Video generation
- 3D rendering
- Real-time campaign API integration
- External user access (remains internal tool)

---

## 9. Technical Constraints & Considerations

### 9.1 API Dependencies
**Gemini Vision API:**
- Rate Limit: 60 requests/minute (need batching strategy for 20 images)
- Cost: $0.25 per 1K requests (estimated $5/month for typical usage)
- Fallback: None (critical path dependency)

**Flux Img2Img API:**
- Rate Limit: 10 concurrent requests (sequential generation required)
- Latency: ~15 seconds per image (5 minutes total for 20 images)
- Cost: $0.08 per image ($1.60 per batch)
- Fallback: Retry logic + manual upload option

### 9.2 Storage Requirements
- Reference images: ~100MB (20 images × 5MB max)
- Generated assets per batch: ~40MB (20 images × 2MB avg)
- Monthly storage estimate: 5GB (assuming 125 batches/month)
- Retention policy: 90 days for generated assets

### 9.3 Performance Targets
- Page load time: < 2 seconds
- Parameter selection responsiveness: < 100ms
- Batch generation completion: < 5 minutes
- ZIP download preparation: < 10 seconds

---

## 10. Data Privacy & Compliance

### 10.1 Data Sensitivity Classification
- **Public:** ABCD taxonomy, format specifications
- **Internal:** Generated creative assets, reference images
- **Confidential:** API keys, usage analytics

### 10.2 Data Retention Policy
- Generated assets: 90 days automatic deletion
- Reference images: Retained until manually deleted
- Session metadata: 1 year retention for analytics

### 10.3 Third-Party Data Processing
- Gemini API: Image data sent to Google Cloud (ephemeral processing)
- Flux API: Image data sent to Flux.1 servers (no storage guarantee)
- Compliance: Ensure no personally identifiable user information in reference images

---

## 11. Success Criteria & Validation

### 11.1 Quantitative Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time to generate 20 variants | < 5 min | System timer from "Generate" click to completion |
| Naming accuracy | 100% | Automated validation against regex pattern |
| API success rate | > 95% | Failed requests / Total requests |
| User task completion rate | > 90% | Sessions with downloads / Total sessions |

### 11.2 Qualitative Validation
- User interview with 3 Creative Producers (post-MVP launch)
- Key questions:
  - Does ABCD structure make creative decisions clearer?
  - Are generated assets usable without manual editing?
  - Is the naming convention helpful for performance analysis?

### 11.3 Launch Readiness Checklist
- [ ] All P0 features functional in staging
- [ ] API error handling tested with mock failures
- [ ] User documentation completed (5-minute quick start guide)
- [ ] Performance targets validated with 10 test batches
- [ ] Security review completed (API key storage, CORS policy)
- [ ] Rollback plan documented

---

## 12. Open Questions & Decisions Required

### 12.1 Product Decisions
- **Q1:** Should we support custom ABCD dimensions beyond predefined taxonomy?
  - **Recommendation:** No for MVP (maintain consistency), revisit in Phase 2

- **Q2:** How should we handle failed generations in a batch? Skip or halt entire batch?
  - **Recommendation:** Continue batch, mark failures, allow selective retry

- **Q3:** Should reference images be reusable across sessions or session-specific?
  - **Recommendation:** Store in library for reuse (reduces redundant uploads)

### 12.2 Technical Decisions
- **Q4:** Database choice for metadata storage (Supabase vs. local JSON files)?
  - **Impact:** Affects scalability and analytics capability
  - **Recommendation:** Supabase (already in stack, enables future dashboard)

- **Q5:** Frontend framework for parameter selection UI?
  - **Recommendation:** Next.js + Shadcn (consistency with existing stack)

### 12.3 Operational Decisions
- **Q6:** Who approves new ABCD taxonomy additions?
  - **Recommendation:** Require product director approval with documented rationale

---

## 13. Appendices

### Appendix A: Glossary
- **ABCD Framework:** Attention-Branding-Connection-Direction creative methodology
- **Img2Img:** Image-to-image AI generation (reference-guided synthesis)
- **Product State:** Physical configuration (Expanded for use, Folded for storage)
- **Batch Generation:** Creating multiple variants with identical parameters

### Appendix B: Reference Documents
- Original BRD (provided by stakeholder)
- ABCD Methodology White Paper (Google Ads best practices)
- Gemini Vision API Documentation
- Flux.1 Img2Img API Specifications

### Appendix C: Revision History
| Version | Date       | Author       | Changes                  |
|---------|------------|--------------|--------------------------|
| 1.0     | 2025-12-05 | Product Team | Initial PRD draft        |

---

## Document Status
**Current Phase:** Requirements Definition
**Next Steps:**
1. Stakeholder review (Target: 2025-12-08)
2. Technical feasibility assessment (Target: 2025-12-10)
3. Design mockup creation (Target: 2025-12-15)
4. Development sprint planning (Target: 2025-12-17)

**Contact:** For questions or clarifications, please refer to project documentation or consult the product team.
