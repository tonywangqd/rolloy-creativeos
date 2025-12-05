/**
 * Rolloy Creative OS - Naming Service
 *
 * Generates standardized creative names
 * Format: YYYYMMDD_[A1]_[A2]_[B]_[C]_[D-Code]
 * Example: 20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY
 */

import {
  ABCDSelection,
  CreativeNaming,
  ProductState,
  ValidationError,
} from '@/lib/types';
import { getProductState } from '@/lib/constants/abcd-matrix';

// ============================================================================
// Naming Generation
// ============================================================================

/**
 * Generate creative naming from ABCD selection
 * @param selection - ABCD selection object
 * @param customDate - Optional custom date (default: current date)
 */
export function generateCreativeNaming(
  selection: ABCDSelection,
  customDate?: Date
): CreativeNaming {
  // Validate selection
  validateSelection(selection);

  // Generate timestamp
  const timestamp = formatTimestamp(customDate || new Date());

  // Determine product state
  const productState = getProductState(selection.B);

  // Sanitize tags for file naming
  const A1 = sanitizeTag(selection.A1);
  const A2 = sanitizeTag(selection.A2);
  const B = sanitizeTag(selection.B);
  const C = sanitizeTag(selection.C);
  const DCode = sanitizeTag(selection.D);

  // Build full name
  const fullName = `${timestamp}_${A1}_${A2}_${B}_${C}_${DCode}`;

  return {
    fullName,
    timestamp,
    A1,
    A2,
    B,
    C,
    DCode,
    productState,
  };
}

/**
 * Generate file path for image storage
 * @param naming - Creative naming object
 * @param imageIndex - Image index (1-20)
 * @param extension - File extension (default: 'png')
 */
export function generateImagePath(
  naming: CreativeNaming,
  imageIndex: number,
  extension: string = 'png'
): string {
  if (imageIndex < 1 || imageIndex > 100) {
    throw new ValidationError('Image index must be between 1 and 100');
  }

  const paddedIndex = String(imageIndex).padStart(2, '0');
  return `${naming.fullName}/${paddedIndex}.${extension}`;
}

/**
 * Generate batch image paths
 * @param naming - Creative naming object
 * @param count - Number of images (default: 20)
 */
export function generateBatchImagePaths(
  naming: CreativeNaming,
  count: number = 20
): string[] {
  return Array.from({ length: count }, (_, i) =>
    generateImagePath(naming, i + 1)
  );
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse creative name back into components
 * @param creativeName - Full creative name string
 */
export function parseCreativeName(creativeName: string): Partial<CreativeNaming> {
  try {
    // Expected format: YYYYMMDD_A1_A2_B_C_D
    const parts = creativeName.split('_');

    if (parts.length !== 6) {
      throw new Error('Invalid creative name format');
    }

    const [timestamp, A1, A2, B, C, DCode] = parts;

    // Validate timestamp format
    if (!/^\d{8}$/.test(timestamp)) {
      throw new Error('Invalid timestamp format');
    }

    const productState = getProductState(B);

    return {
      fullName: creativeName,
      timestamp,
      A1,
      A2,
      B,
      C,
      DCode,
      productState,
    };
  } catch (error) {
    throw new ValidationError(
      `Failed to parse creative name: ${creativeName}`,
      error
    );
  }
}

/**
 * Parse image path to extract naming and index
 * Example: "20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY/01.png"
 */
export function parseImagePath(imagePath: string): {
  naming: Partial<CreativeNaming>;
  imageIndex: number;
  extension: string;
} {
  try {
    const pathParts = imagePath.split('/');
    if (pathParts.length !== 2) {
      throw new Error('Invalid image path format');
    }

    const [nameFolder, fileName] = pathParts;
    const naming = parseCreativeName(nameFolder);

    const fileParts = fileName.split('.');
    if (fileParts.length !== 2) {
      throw new Error('Invalid file name format');
    }

    const [indexStr, extension] = fileParts;
    const imageIndex = parseInt(indexStr, 10);

    if (isNaN(imageIndex)) {
      throw new Error('Invalid image index');
    }

    return {
      naming,
      imageIndex,
      extension,
    };
  } catch (error) {
    throw new ValidationError(`Failed to parse image path: ${imagePath}`, error);
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate ABCD selection
 */
function validateSelection(selection: ABCDSelection): void {
  const requiredFields: (keyof ABCDSelection)[] = ['A1', 'A2', 'B', 'C', 'D'];
  const missingFields = requiredFields.filter(field => !selection[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`
    );
  }

  // Validate no empty strings
  Object.entries(selection).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim().length === 0) {
      throw new ValidationError(`Field ${key} cannot be empty`);
    }
  });
}

/**
 * Validate creative name format
 */
export function validateCreativeName(name: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const parts = name.split('_');

    if (parts.length !== 6) {
      errors.push('Name must have exactly 6 parts separated by underscores');
    }

    if (parts[0] && !/^\d{8}$/.test(parts[0])) {
      errors.push('First part must be a date in YYYYMMDD format');
    }

    if (name.length > 255) {
      errors.push('Name is too long (max 255 characters)');
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(name)) {
      errors.push('Name contains invalid characters for file system');
    }
  } catch (error) {
    errors.push('Failed to validate name structure');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date as YYYYMMDD
 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Sanitize tag for file naming
 * - Remove special characters except hyphen
 * - Replace spaces with hyphens
 * - Limit length
 */
function sanitizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9-]/g, '') // Remove special chars except hyphen
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Get date from timestamp string
 */
export function parseTimestamp(timestamp: string): Date {
  if (!/^\d{8}$/.test(timestamp)) {
    throw new ValidationError('Invalid timestamp format');
  }

  const year = parseInt(timestamp.substring(0, 4), 10);
  const month = parseInt(timestamp.substring(4, 6), 10) - 1;
  const day = parseInt(timestamp.substring(6, 8), 10);

  const date = new Date(year, month, day);

  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date values');
  }

  return date;
}

/**
 * Format naming for display
 */
export function formatNamingForDisplay(naming: CreativeNaming): string {
  const date = parseTimestamp(naming.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return `${formattedDate} | ${naming.A1} > ${naming.A2} | ${naming.B} | ${naming.C} | ${naming.DCode}`;
}

/**
 * Generate short hash for creative (useful for URLs)
 */
export function generateCreativeHash(naming: CreativeNaming): string {
  const str = naming.fullName;
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Extract ABCD tags from creative name (for search/filter)
 */
export function extractTags(naming: CreativeNaming): string[] {
  return [naming.A1, naming.A2, naming.B, naming.C, naming.DCode];
}

/**
 * Search creatives by tag
 */
export function matchesSearchQuery(
  naming: CreativeNaming,
  query: string
): boolean {
  const searchStr = naming.fullName.toLowerCase();
  const queryLower = query.toLowerCase();

  return (
    searchStr.includes(queryLower) ||
    extractTags(naming).some(tag => tag.toLowerCase().includes(queryLower))
  );
}

/**
 * Generate variations of a name (for testing)
 */
export function generateVariations(
  baseSelection: ABCDSelection,
  variations: Partial<ABCDSelection>[]
): CreativeNaming[] {
  return variations.map(variation => {
    const combined = { ...baseSelection, ...variation };
    return generateCreativeNaming(combined);
  });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Generate multiple creative names from a selection matrix
 */
export function generateBatchNaming(
  selections: ABCDSelection[]
): CreativeNaming[] {
  return selections.map(selection => generateCreativeNaming(selection));
}

/**
 * Deduplicate creative names
 */
export function deduplicateNaming(namings: CreativeNaming[]): CreativeNaming[] {
  const seen = new Set<string>();
  return namings.filter(naming => {
    if (seen.has(naming.fullName)) {
      return false;
    }
    seen.add(naming.fullName);
    return true;
  });
}

/**
 * Sort naming by timestamp (newest first)
 */
export function sortByTimestamp(
  namings: CreativeNaming[],
  ascending: boolean = false
): CreativeNaming[] {
  return [...namings].sort((a, b) => {
    const comparison = a.timestamp.localeCompare(b.timestamp);
    return ascending ? comparison : -comparison;
  });
}

/**
 * Group naming by date
 */
export function groupByDate(
  namings: CreativeNaming[]
): Record<string, CreativeNaming[]> {
  return namings.reduce((acc, naming) => {
    if (!acc[naming.timestamp]) {
      acc[naming.timestamp] = [];
    }
    acc[naming.timestamp].push(naming);
    return acc;
  }, {} as Record<string, CreativeNaming[]>);
}

/**
 * Group naming by product state
 */
export function groupByProductState(
  namings: CreativeNaming[]
): Record<ProductState, CreativeNaming[]> {
  return namings.reduce((acc, naming) => {
    if (!acc[naming.productState]) {
      acc[naming.productState] = [];
    }
    acc[naming.productState].push(naming);
    return acc;
  }, {} as Record<ProductState, CreativeNaming[]>);
}
