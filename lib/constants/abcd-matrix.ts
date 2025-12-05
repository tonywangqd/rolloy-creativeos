/**
 * Rolloy Creative OS - ABCD Matrix Constants
 *
 * Complete definition of all ABCD options for creative generation
 */

import { ABCDMatrix, ABCDOption } from '@/lib/types';

// ============================================================================
// A1 Category: Primary Environment
// ============================================================================

const A1_OPTIONS: ABCDOption[] = [
  { id: 'a1_outdoor', label: 'Outdoor', category: 'A', description: 'Outdoor environments' },
  { id: 'a1_indoor', label: 'Indoor', category: 'A', description: 'Indoor environments' },
  { id: 'a1_urban', label: 'Urban', category: 'A', description: 'Urban settings' },
  { id: 'a1_nature', label: 'Nature', category: 'A', description: 'Natural environments' },
];

// ============================================================================
// A2 Category: Specific Location
// ============================================================================

const A2_OPTIONS: ABCDOption[] = [
  // Outdoor specific
  { id: 'a2_backyard', label: 'Backyard', category: 'A', description: 'Home backyard' },
  { id: 'a2_park', label: 'Park', category: 'A', description: 'Public park' },
  { id: 'a2_beach', label: 'Beach', category: 'A', description: 'Beach setting' },
  { id: 'a2_garden', label: 'Garden', category: 'A', description: 'Garden area' },

  // Indoor specific
  { id: 'a2_living_room', label: 'Living-Room', category: 'A', description: 'Living room' },
  { id: 'a2_bedroom', label: 'Bedroom', category: 'A', description: 'Bedroom' },
  { id: 'a2_nursery', label: 'Nursery', category: 'A', description: 'Baby nursery' },
  { id: 'a2_cafe', label: 'Cafe', category: 'A', description: 'Cafe or restaurant' },

  // Urban specific
  { id: 'a2_street', label: 'Street', category: 'A', description: 'City street' },
  { id: 'a2_mall', label: 'Mall', category: 'A', description: 'Shopping mall' },
  { id: 'a2_airport', label: 'Airport', category: 'A', description: 'Airport terminal' },
  { id: 'a2_parking', label: 'Parking', category: 'A', description: 'Parking lot' },
];

// ============================================================================
// B Category: Action/Use Case
// ============================================================================

const B_OPTIONS: ABCDOption[] = [
  // UNFOLDED actions (product in use, open state)
  { id: 'b_walk', label: 'Walk', category: 'B', description: 'Walking with stroller' },
  { id: 'b_sit', label: 'Sit', category: 'B', description: 'Baby sitting in stroller' },
  { id: 'b_turn', label: 'Turn', category: 'B', description: 'Turning/maneuvering' },
  { id: 'b_stand', label: 'Stand', category: 'B', description: 'Stationary/parked' },
  { id: 'b_rest', label: 'Rest', category: 'B', description: 'Resting/napping' },

  // FOLDED actions (product compact, storage state)
  { id: 'b_lift', label: 'Lift', category: 'B', description: 'Lifting the stroller' },
  { id: 'b_pack', label: 'Pack', category: 'B', description: 'Packing/storing' },
  { id: 'b_carry', label: 'Carry', category: 'B', description: 'Carrying folded' },
  { id: 'b_car_trunk', label: 'Car-Trunk', category: 'B', description: 'Placing in car trunk' },
];

// ============================================================================
// C Category: Character/Persona
// ============================================================================

const C_OPTIONS: ABCDOption[] = [
  { id: 'c_mom_baby', label: 'Mom-Baby', category: 'C', description: 'Mother with baby' },
  { id: 'c_dad_baby', label: 'Dad-Baby', category: 'C', description: 'Father with baby' },
  { id: 'c_couple_baby', label: 'Couple-Baby', category: 'C', description: 'Both parents with baby' },
  { id: 'c_grandparent_baby', label: 'Grandparent-Baby', category: 'C', description: 'Grandparent with baby' },
  { id: 'c_sibling_baby', label: 'Sibling-Baby', category: 'C', description: 'Sibling with baby' },
  { id: 'c_nanny_baby', label: 'Nanny-Baby', category: 'C', description: 'Caregiver with baby' },
  { id: 'c_solo_mom', label: 'Solo-Mom', category: 'C', description: 'Mother alone (product focus)' },
  { id: 'c_solo_dad', label: 'Solo-Dad', category: 'C', description: 'Father alone (product focus)' },
];

// ============================================================================
// D Category: Emotion/Mood Code
// ============================================================================

const D_OPTIONS: ABCDOption[] = [
  { id: 'd_joy', label: 'JOY', category: 'D', description: 'Joyful and happy mood' },
  { id: 'd_calm', label: 'CALM', category: 'D', description: 'Calm and peaceful' },
  { id: 'd_love', label: 'LOVE', category: 'D', description: 'Loving and tender' },
  { id: 'd_fun', label: 'FUN', category: 'D', description: 'Fun and playful' },
  { id: 'd_trust', label: 'TRUST', category: 'D', description: 'Trust and security' },
  { id: 'd_comfort', label: 'COMFORT', category: 'D', description: 'Comfort and ease' },
  { id: 'd_adventure', label: 'ADVENTURE', category: 'D', description: 'Adventurous spirit' },
  { id: 'd_modern', label: 'MODERN', category: 'D', description: 'Modern and stylish' },
  { id: 'd_natural', label: 'NATURAL', category: 'D', description: 'Natural and organic' },
  { id: 'd_premium', label: 'PREMIUM', category: 'D', description: 'Premium and luxurious' },
];

// ============================================================================
// Complete ABCD Matrix Export
// ============================================================================

export const ABCD_MATRIX: ABCDMatrix = {
  A: {
    A1: A1_OPTIONS,
    A2: A2_OPTIONS,
  },
  B: B_OPTIONS,
  C: C_OPTIONS,
  D: D_OPTIONS,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get option by ID
 */
export function getOptionById(id: string): ABCDOption | undefined {
  const allOptions = [
    ...A1_OPTIONS,
    ...A2_OPTIONS,
    ...B_OPTIONS,
    ...C_OPTIONS,
    ...D_OPTIONS,
  ];
  return allOptions.find(opt => opt.id === id);
}

/**
 * Get option by label (for reverse lookup)
 */
export function getOptionByLabel(label: string): ABCDOption | undefined {
  const allOptions = [
    ...A1_OPTIONS,
    ...A2_OPTIONS,
    ...B_OPTIONS,
    ...C_OPTIONS,
    ...D_OPTIONS,
  ];
  return allOptions.find(opt => opt.label === label);
}

/**
 * Validate ABCD selection
 */
export function validateABCDSelection(selection: {
  A1?: string;
  A2?: string;
  B?: string;
  C?: string;
  D?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!selection.A1 || !getOptionByLabel(selection.A1)) {
    errors.push('Invalid A1 selection');
  }
  if (!selection.A2 || !getOptionByLabel(selection.A2)) {
    errors.push('Invalid A2 selection');
  }
  if (!selection.B || !getOptionByLabel(selection.B)) {
    errors.push('Invalid B selection');
  }
  if (!selection.C || !getOptionByLabel(selection.C)) {
    errors.push('Invalid C selection');
  }
  if (!selection.D || !getOptionByLabel(selection.D)) {
    errors.push('Invalid D selection');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all options for a specific category
 */
export function getOptionsByCategory(category: 'A1' | 'A2' | 'B' | 'C' | 'D'): ABCDOption[] {
  switch (category) {
    case 'A1':
      return A1_OPTIONS;
    case 'A2':
      return A2_OPTIONS;
    case 'B':
      return B_OPTIONS;
    case 'C':
      return C_OPTIONS;
    case 'D':
      return D_OPTIONS;
    default:
      return [];
  }
}

/**
 * Check if A2 is compatible with A1
 * (Future enhancement: add compatibility rules)
 */
export function isA2CompatibleWithA1(a1Label: string, a2Label: string): boolean {
  // For now, all combinations are valid
  // In the future, you can add rules like:
  // - If A1 is "Indoor", A2 should not be "Beach" or "Park"
  // - If A1 is "Nature", A2 should be outdoor-related
  return true;
}

/**
 * Get recommended A2 options based on A1 selection
 */
export function getRecommendedA2Options(a1Label: string): ABCDOption[] {
  const recommendations: Record<string, string[]> = {
    'Outdoor': ['Backyard', 'Park', 'Beach', 'Garden'],
    'Indoor': ['Living-Room', 'Bedroom', 'Nursery', 'Cafe'],
    'Urban': ['Street', 'Mall', 'Airport', 'Parking'],
    'Nature': ['Park', 'Beach', 'Garden'],
  };

  const recommendedLabels = recommendations[a1Label] || [];
  return A2_OPTIONS.filter(opt => recommendedLabels.includes(opt.label));
}

// ============================================================================
// Product State Logic
// ============================================================================

export const UNFOLDED_ACTIONS = ['Walk', 'Sit', 'Turn', 'Stand', 'Rest'] as const;
export const FOLDED_ACTIONS = ['Lift', 'Pack', 'Carry', 'Car-Trunk'] as const;

/**
 * Determine product state based on B action
 */
export function getProductState(bAction: string): 'UNFOLDED' | 'FOLDED' {
  if (UNFOLDED_ACTIONS.includes(bAction as any)) {
    return 'UNFOLDED';
  }
  if (FOLDED_ACTIONS.includes(bAction as any)) {
    return 'FOLDED';
  }
  // Default to UNFOLDED if unknown action
  return 'UNFOLDED';
}

/**
 * Get base image URL based on product state
 */
export function getBaseImageUrl(productState: 'UNFOLDED' | 'FOLDED'): string {
  // These should be configured in environment variables
  const baseImages = {
    UNFOLDED: process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || '/images/product-unfolded.png',
    FOLDED: process.env.NEXT_PUBLIC_FOLDED_IMAGE_URL || '/images/product-folded.png',
  };

  return baseImages[productState];
}
