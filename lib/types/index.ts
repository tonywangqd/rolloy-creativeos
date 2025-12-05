/**
 * Rolloy Creative OS - Type Definitions
 * TypeScript interfaces and types for the entire system
 */

// ============================================================================
// ABCD Matrix Types
// ============================================================================

export type ABCDCategory = 'A' | 'B' | 'C' | 'D';

export interface ABCDOption {
  id: string;
  label: string;
  category: ABCDCategory;
  description?: string;
}

export interface ABCDMatrix {
  A: {
    A1: ABCDOption[];
    A2: ABCDOption[];
  };
  B: ABCDOption[];
  C: ABCDOption[];
  D: ABCDOption[];
}

export interface ABCDSelection {
  A1: string; // e.g., "Outdoor"
  A2: string; // e.g., "Backyard"
  B: string;  // e.g., "Sit"
  C: string;  // e.g., "Mom-Baby"
  D: string;  // e.g., "JOY"
}

// ============================================================================
// Product State Types
// ============================================================================

export type ProductState = 'FOLDED' | 'UNFOLDED';

export const UNFOLDED_ACTIONS = ['Walk', 'Sit', 'Turn', 'Stand', 'Rest'] as const;
export const FOLDED_ACTIONS = ['Lift', 'Pack', 'Carry', 'Car-Trunk'] as const;

export type UnfoldedAction = typeof UNFOLDED_ACTIONS[number];
export type FoldedAction = typeof FOLDED_ACTIONS[number];

// ============================================================================
// Naming System Types
// ============================================================================

export interface CreativeNaming {
  fullName: string;        // e.g., "20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY"
  timestamp: string;       // e.g., "20250129"
  A1: string;
  A2: string;
  B: string;
  C: string;
  DCode: string;           // e.g., "JOY"
  productState: ProductState;
}

// ============================================================================
// AI Generation Types
// ============================================================================

export interface GeminiPromptRequest {
  selection: ABCDSelection;
  productState: ProductState;
  baseImageUrl: string;
  additionalContext?: string;
}

export interface GeminiPromptResponse {
  prompt: string;
  metadata: {
    model: string;
    timestamp: string;
    tokensUsed?: number;
  };
}

export interface FluxGenerationRequest {
  prompt: string;
  baseImageUrl: string;
  strength?: number;        // Default: 0.75
  numImages?: number;       // Default: 20
  seed?: number;
}

export interface FluxGenerationResponse {
  images: FluxImage[];
  metadata: {
    requestId: string;
    timestamp: string;
    model: string;
    totalGenerated: number;
    failed: number;
  };
}

export interface FluxImage {
  url: string;
  index: number;
  seed?: number;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageUploadRequest {
  imageUrl: string;
  naming: CreativeNaming;
  index: number;            // 1-20
}

export interface StorageUploadResponse {
  success: boolean;
  publicUrl?: string;
  storagePath?: string;
  error?: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AdPerformanceData {
  adName: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  cpa?: number;
  roas?: number;
}

export interface ParsedAdData extends AdPerformanceData {
  abcdTags: Partial<ABCDSelection>;
  parsedSuccess: boolean;
}

export interface ABCDAnalytics {
  category: ABCDCategory;
  tag: string;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  totalRevenue: number;
  avgCPA: number;
  avgROAS: number;
  adCount: number;
}

export interface AnalyticsReport {
  summary: {
    totalAds: number;
    totalSpend: number;
    totalRevenue: number;
    overallROAS: number;
    overallCPA: number;
  };
  byCategory: {
    A1: ABCDAnalytics[];
    A2: ABCDAnalytics[];
    B: ABCDAnalytics[];
    C: ABCDAnalytics[];
    D: ABCDAnalytics[];
  };
  topPerformers: {
    bestROAS: ABCDAnalytics[];
    lowestCPA: ABCDAnalytics[];
  };
  rawData: ParsedAdData[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

// ============================================================================
// Database Types (Supabase)
// ============================================================================

export interface CreativeRecord {
  id: string;
  created_at: string;
  updated_at: string;

  // ABCD Selection
  a1_tag: string;
  a2_tag: string;
  b_tag: string;
  c_tag: string;
  d_tag: string;

  // Generated Assets
  creative_name: string;
  product_state: ProductState;
  gemini_prompt: string;
  base_image_url: string;

  // Generated Images
  generated_images: string[];  // Array of Supabase Storage URLs

  // Performance Tracking (nullable, populated later)
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spend?: number;
  revenue?: number;
  cpa?: number;
  roas?: number;

  // Metadata
  user_id?: string;
  status: 'generating' | 'completed' | 'failed';
  error_message?: string;
}

export interface GenerationJob {
  id: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;  // 0-100
  total_images: number;
  completed_images: number;
  failed_images: number;
  creative_id: string;
  error_message?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface FluxConfig {
  apiKey: string;
  apiEndpoint: string;
  defaultStrength: number;
  defaultNumImages: number;
  maxRetries: number;
  retryDelay: number;
}

export interface AppConfig {
  supabase: SupabaseConfig;
  gemini: GeminiConfig;
  flux: FluxConfig;
}

// ============================================================================
// Error Types
// ============================================================================

export class CreativeOSError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CreativeOSError';
  }
}

export class GeminiAPIError extends CreativeOSError {
  constructor(message: string, details?: any) {
    super(message, 'GEMINI_API_ERROR', details);
    this.name = 'GeminiAPIError';
  }
}

export class FluxAPIError extends CreativeOSError {
  constructor(message: string, details?: any) {
    super(message, 'FLUX_API_ERROR', details);
    this.name = 'FluxAPIError';
  }
}

export class StorageError extends CreativeOSError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class ValidationError extends CreativeOSError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
