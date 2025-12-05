/**
 * Rolloy Creative OS - Analytics Service
 *
 * CSV parsing and ABCD performance aggregation
 * Extracts ABCD tags from ad names and calculates CPA, ROAS metrics
 */

import Papa from 'papaparse';
import {
  AdPerformanceData,
  ParsedAdData,
  ABCDAnalytics,
  AnalyticsReport,
  ABCDSelection,
  ValidationError,
} from '@/lib/types';
import { parseCreativeName } from './naming-service';

// ============================================================================
// CSV Parsing
// ============================================================================

interface CSVRow {
  'Ad Name': string;
  Impressions: string;
  Clicks: string;
  Conversions: string;
  Spend: string;
  Revenue: string;
  [key: string]: string; // Allow other columns
}

/**
 * Parse CSV file and extract ad performance data
 * @param csvContent - CSV file content as string
 */
export async function parseCSV(csvContent: string): Promise<ParsedAdData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          const parsedData = results.data.map(row => parseCSVRow(row));
          resolve(parsedData);
        } catch (error) {
          reject(
            new ValidationError('Failed to parse CSV data', error)
          );
        }
      },
      error: (error: Error) => {
        reject(new ValidationError('CSV parsing error', error));
      },
    });
  });
}

/**
 * Parse a single CSV row
 */
function parseCSVRow(row: CSVRow): ParsedAdData {
  try {
    // Extract basic metrics
    const adName = row['Ad Name']?.trim() || '';
    const impressions = parseNumber(row['Impressions']);
    const clicks = parseNumber(row['Clicks']);
    const conversions = parseNumber(row['Conversions']);
    const spend = parseNumber(row['Spend']);
    const revenue = parseNumber(row['Revenue']);

    // Calculate derived metrics
    const cpa = conversions > 0 ? spend / conversions : 0;
    const roas = spend > 0 ? revenue / spend : 0;

    // Extract ABCD tags from ad name
    const { abcdTags, parsedSuccess } = extractABCDTags(adName);

    return {
      adName,
      impressions,
      clicks,
      conversions,
      spend,
      revenue,
      cpa,
      roas,
      abcdTags,
      parsedSuccess,
    };
  } catch (error) {
    throw new ValidationError(`Failed to parse row: ${row['Ad Name']}`, error);
  }
}

/**
 * Parse number from string (handles commas, currency symbols)
 */
function parseNumber(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  if (!value || typeof value !== 'string') {
    return 0;
  }

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// ABCD Tag Extraction
// ============================================================================

/**
 * Extract ABCD tags from ad name
 * Supports multiple formats:
 * 1. Standard: "20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY"
 * 2. With prefix: "Campaign_20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY"
 * 3. Partial tags in name
 */
function extractABCDTags(adName: string): {
  abcdTags: Partial<ABCDSelection>;
  parsedSuccess: boolean;
} {
  try {
    // Try parsing as standard creative name first
    const standardParse = parseStandardFormat(adName);
    if (standardParse.parsedSuccess) {
      return standardParse;
    }

    // Try extracting tags from any position in the name
    const flexibleParse = parseFlexibleFormat(adName);
    return flexibleParse;
  } catch (error) {
    return {
      abcdTags: {},
      parsedSuccess: false,
    };
  }
}

/**
 * Parse standard creative naming format
 */
function parseStandardFormat(adName: string): {
  abcdTags: Partial<ABCDSelection>;
  parsedSuccess: boolean;
} {
  try {
    // Look for pattern: YYYYMMDD_A1_A2_B_C_D
    const match = adName.match(/(\d{8})_([^_]+)_([^_]+)_([^_]+)_([^_]+)_([^_]+)/);

    if (match) {
      const [, , A1, A2, B, C, D] = match;
      return {
        abcdTags: { A1, A2, B, C, D },
        parsedSuccess: true,
      };
    }

    // Try parsing using naming service
    const parts = adName.split('_');
    if (parts.length >= 6) {
      const creativeName = parts.slice(-6).join('_');
      const parsed = parseCreativeName(creativeName);

      if (parsed.A1 && parsed.A2 && parsed.B && parsed.C && parsed.DCode) {
        return {
          abcdTags: {
            A1: parsed.A1,
            A2: parsed.A2,
            B: parsed.B,
            C: parsed.C,
            D: parsed.DCode,
          },
          parsedSuccess: true,
        };
      }
    }

    return {
      abcdTags: {},
      parsedSuccess: false,
    };
  } catch {
    return {
      abcdTags: {},
      parsedSuccess: false,
    };
  }
}

/**
 * Parse flexible format (extract individual tags)
 */
function parseFlexibleFormat(adName: string): {
  abcdTags: Partial<ABCDSelection>;
  parsedSuccess: boolean;
} {
  const tags: Partial<ABCDSelection> = {};
  let foundCount = 0;

  // Known tag patterns
  const tagPatterns = {
    // A1 patterns
    A1: ['Outdoor', 'Indoor', 'Urban', 'Nature'],
    // A2 patterns
    A2: [
      'Backyard',
      'Park',
      'Beach',
      'Garden',
      'Living-Room',
      'Bedroom',
      'Nursery',
      'Cafe',
      'Street',
      'Mall',
      'Airport',
      'Parking',
    ],
    // B patterns
    B: [
      'Walk',
      'Sit',
      'Turn',
      'Stand',
      'Rest',
      'Lift',
      'Pack',
      'Carry',
      'Car-Trunk',
    ],
    // C patterns
    C: [
      'Mom-Baby',
      'Dad-Baby',
      'Couple-Baby',
      'Grandparent-Baby',
      'Sibling-Baby',
      'Nanny-Baby',
      'Solo-Mom',
      'Solo-Dad',
    ],
    // D patterns
    D: [
      'JOY',
      'CALM',
      'LOVE',
      'FUN',
      'TRUST',
      'COMFORT',
      'ADVENTURE',
      'MODERN',
      'NATURAL',
      'PREMIUM',
    ],
  };

  // Search for each tag type
  Object.entries(tagPatterns).forEach(([category, patterns]) => {
    for (const pattern of patterns) {
      if (adName.includes(pattern)) {
        tags[category as keyof ABCDSelection] = pattern;
        foundCount++;
        break; // Take first match for each category
      }
    }
  });

  return {
    abcdTags: tags,
    parsedSuccess: foundCount >= 3, // At least 3 tags found
  };
}

// ============================================================================
// Analytics Aggregation
// ============================================================================

/**
 * Generate analytics report from parsed ad data
 */
export function generateAnalyticsReport(data: ParsedAdData[]): AnalyticsReport {
  // Filter successfully parsed ads
  const validAds = data.filter(ad => ad.parsedSuccess);

  // Calculate summary
  const summary = calculateSummary(data);

  // Aggregate by category
  const byCategory = {
    A1: aggregateByTag(validAds, 'A1'),
    A2: aggregateByTag(validAds, 'A2'),
    B: aggregateByTag(validAds, 'B'),
    C: aggregateByTag(validAds, 'C'),
    D: aggregateByTag(validAds, 'D'),
  };

  // Find top performers
  const topPerformers = findTopPerformers(byCategory);

  return {
    summary,
    byCategory,
    topPerformers,
    rawData: data,
  };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(data: ParsedAdData[]) {
  const totalSpend = data.reduce((sum, ad) => sum + ad.spend, 0);
  const totalRevenue = data.reduce((sum, ad) => sum + ad.revenue, 0);
  const totalConversions = data.reduce((sum, ad) => sum + ad.conversions, 0);

  return {
    totalAds: data.length,
    totalSpend,
    totalRevenue,
    overallROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    overallCPA: totalConversions > 0 ? totalSpend / totalConversions : 0,
  };
}

/**
 * Aggregate metrics by specific tag
 */
function aggregateByTag(
  data: ParsedAdData[],
  tagKey: keyof ABCDSelection
): ABCDAnalytics[] {
  // Group by tag value
  const grouped = data.reduce((acc, ad) => {
    const tagValue = ad.abcdTags[tagKey];
    if (!tagValue) return acc;

    if (!acc[tagValue]) {
      acc[tagValue] = [];
    }
    acc[tagValue].push(ad);
    return acc;
  }, {} as Record<string, ParsedAdData[]>);

  // Calculate metrics for each tag
  return Object.entries(grouped).map(([tag, ads]) => {
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const totalConversions = ads.reduce((sum, ad) => sum + ad.conversions, 0);
    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalRevenue = ads.reduce((sum, ad) => sum + ad.revenue, 0);

    return {
      category: tagKey[0] as 'A' | 'B' | 'C' | 'D',
      tag,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalSpend,
      totalRevenue,
      avgCPA: totalConversions > 0 ? totalSpend / totalConversions : 0,
      avgROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      adCount: ads.length,
    };
  });
}

/**
 * Find top performing tags
 */
function findTopPerformers(byCategory: AnalyticsReport['byCategory']) {
  const allMetrics = [
    ...byCategory.A1,
    ...byCategory.A2,
    ...byCategory.B,
    ...byCategory.C,
    ...byCategory.D,
  ];

  // Sort by ROAS (descending)
  const bestROAS = [...allMetrics]
    .filter(m => m.avgROAS > 0)
    .sort((a, b) => b.avgROAS - a.avgROAS)
    .slice(0, 10);

  // Sort by CPA (ascending - lower is better)
  const lowestCPA = [...allMetrics]
    .filter(m => m.avgCPA > 0)
    .sort((a, b) => a.avgCPA - b.avgCPA)
    .slice(0, 10);

  return {
    bestROAS,
    lowestCPA,
  };
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export report to CSV
 */
export function exportReportToCSV(report: AnalyticsReport): string {
  const rows: string[][] = [
    ['Category', 'Tag', 'Impressions', 'Clicks', 'Conversions', 'Spend', 'Revenue', 'CPA', 'ROAS', 'Ad Count'],
  ];

  // Add data from each category
  Object.entries(report.byCategory).forEach(([category, metrics]) => {
    metrics.forEach(m => {
      rows.push([
        category,
        m.tag,
        m.totalImpressions.toString(),
        m.totalClicks.toString(),
        m.totalConversions.toString(),
        m.totalSpend.toFixed(2),
        m.totalRevenue.toFixed(2),
        m.avgCPA.toFixed(2),
        m.avgROAS.toFixed(2),
        m.adCount.toString(),
      ]);
    });
  });

  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Export report to JSON
 */
export function exportReportToJSON(report: AnalyticsReport): string {
  return JSON.stringify(report, null, 2);
}

// ============================================================================
// Filtering and Sorting
// ============================================================================

/**
 * Filter analytics by date range
 */
export function filterByDateRange(
  data: ParsedAdData[],
  startDate: Date,
  endDate: Date
): ParsedAdData[] {
  return data.filter(ad => {
    const adDate = extractDateFromAdName(ad.adName);
    if (!adDate) return true; // Include if date cannot be extracted

    return adDate >= startDate && adDate <= endDate;
  });
}

/**
 * Extract date from ad name
 */
function extractDateFromAdName(adName: string): Date | null {
  const match = adName.match(/(\d{8})/);
  if (!match) return null;

  const dateStr = match[1];
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Filter by minimum ROAS threshold
 */
export function filterByROAS(
  metrics: ABCDAnalytics[],
  minROAS: number
): ABCDAnalytics[] {
  return metrics.filter(m => m.avgROAS >= minROAS);
}

/**
 * Filter by maximum CPA threshold
 */
export function filterByCPA(
  metrics: ABCDAnalytics[],
  maxCPA: number
): ABCDAnalytics[] {
  return metrics.filter(m => m.avgCPA <= maxCPA && m.avgCPA > 0);
}

/**
 * Sort analytics by metric
 */
export function sortAnalytics(
  metrics: ABCDAnalytics[],
  sortBy: 'roas' | 'cpa' | 'spend' | 'revenue' | 'conversions',
  ascending: boolean = false
): ABCDAnalytics[] {
  const sorted = [...metrics].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'roas':
        comparison = a.avgROAS - b.avgROAS;
        break;
      case 'cpa':
        comparison = a.avgCPA - b.avgCPA;
        break;
      case 'spend':
        comparison = a.totalSpend - b.totalSpend;
        break;
      case 'revenue':
        comparison = a.totalRevenue - b.totalRevenue;
        break;
      case 'conversions':
        comparison = a.totalConversions - b.totalConversions;
        break;
    }

    return ascending ? comparison : -comparison;
  });

  return sorted;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(
  oldValue: number,
  newValue: number
): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Validate CSV file
 */
export function validateCSVStructure(csvContent: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const lines = csvContent.split('\n').filter(Boolean);

    if (lines.length < 2) {
      errors.push('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['Ad Name', 'Impressions', 'Clicks', 'Conversions', 'Spend', 'Revenue'];

    requiredHeaders.forEach(required => {
      if (!headers.includes(required)) {
        errors.push(`Missing required column: ${required}`);
      }
    });
  } catch (error) {
    errors.push('Failed to parse CSV structure');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
