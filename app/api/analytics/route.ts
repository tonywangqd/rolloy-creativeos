/**
 * Rolloy Creative OS - Analytics API
 *
 * POST /api/analytics/upload - Upload CSV for analysis
 * GET /api/analytics/report - Get analytics report
 * GET /api/analytics/export - Export report (CSV/JSON)
 */

import { NextRequest, NextResponse } from 'next/server';
import { APIResponse } from '@/lib/types';
import {
  parseCSV,
  generateAnalyticsReport,
  exportReportToCSV,
  exportReportToJSON,
  validateCSVStructure,
  filterByDateRange,
  sortAnalytics,
} from '@/lib/services/analytics-service';

// ============================================================================
// POST Handler - Upload and analyze CSV
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get CSV content from request
    const contentType = request.headers.get('content-type') || '';

    let csvContent: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'MISSING_FILE',
              message: 'No file provided',
            },
          },
          { status: 400 }
        );
      }

      csvContent = await file.text();
    } else if (contentType.includes('application/json')) {
      // Handle raw CSV content
      const body = await request.json();
      csvContent = body.csvContent;

      if (!csvContent) {
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'MISSING_CONTENT',
              message: 'No CSV content provided',
            },
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Type must be multipart/form-data or application/json',
          },
        },
        { status: 400 }
      );
    }

    // Validate CSV structure
    const validation = validateCSVStructure(csvContent);
    if (!validation.valid) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_CSV',
            message: 'Invalid CSV structure',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    // Parse CSV
    console.log('Parsing CSV...');
    const parsedData = await parseCSV(csvContent);

    console.log(`Parsed ${parsedData.length} ad records`);

    // Generate analytics report
    console.log('Generating analytics report...');
    const report = generateAnalyticsReport(parsedData);

    console.log(
      `Report generated: ${report.summary.totalAds} ads, ${report.rawData.filter((d) => d.parsedSuccess).length} successfully parsed`
    );

    // Return report
    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          report,
          stats: {
            totalAds: parsedData.length,
            successfullyParsed: parsedData.filter((d) => d.parsedSuccess).length,
            failedToParse: parsedData.filter((d) => !d.parsedSuccess).length,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/analytics:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process CSV',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler - Retrieve or filter existing analytics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Handle different actions
    switch (action) {
      case 'export':
        return handleExport(searchParams);

      case 'filter':
        return handleFilter(searchParams);

      default:
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid action. Use: export, filter',
            },
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in GET /api/analytics:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process request',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Handle export action
 * Query params:
 * - format: csv | json
 * - reportData: base64 encoded report JSON
 */
async function handleExport(searchParams: URLSearchParams) {
  try {
    const format = searchParams.get('format') || 'csv';
    const reportDataParam = searchParams.get('reportData');

    if (!reportDataParam) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'MISSING_REPORT_DATA',
            message: 'Report data is required for export',
          },
        },
        { status: 400 }
      );
    }

    // Decode report data
    const reportData = JSON.parse(
      Buffer.from(reportDataParam, 'base64').toString('utf-8')
    );

    let content: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      content = exportReportToJSON(reportData);
      contentType = 'application/json';
      filename = `analytics_report_${Date.now()}.json`;
    } else {
      content = exportReportToCSV(reportData);
      contentType = 'text/csv';
      filename = `analytics_report_${Date.now()}.csv`;
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Failed to export report',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Handle filter action
 * Query params:
 * - category: A1 | A2 | B | C | D
 * - sortBy: roas | cpa | spend | revenue | conversions
 * - order: asc | desc
 * - minROAS: number
 * - maxCPA: number
 */
async function handleFilter(searchParams: URLSearchParams) {
  try {
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') as any;
    const order = searchParams.get('order') || 'desc';
    const minROAS = searchParams.get('minROAS');
    const maxCPA = searchParams.get('maxCPA');
    const reportDataParam = searchParams.get('reportData');

    if (!reportDataParam) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'MISSING_REPORT_DATA',
            message: 'Report data is required for filtering',
          },
        },
        { status: 400 }
      );
    }

    // Decode report data
    const reportData = JSON.parse(
      Buffer.from(reportDataParam, 'base64').toString('utf-8')
    );

    // Get metrics for the specified category
    let metrics = category
      ? reportData.byCategory[category] || []
      : [
          ...reportData.byCategory.A1,
          ...reportData.byCategory.A2,
          ...reportData.byCategory.B,
          ...reportData.byCategory.C,
          ...reportData.byCategory.D,
        ];

    // Apply filters
    if (minROAS) {
      const threshold = parseFloat(minROAS);
      metrics = metrics.filter((m: any) => m.avgROAS >= threshold);
    }

    if (maxCPA) {
      const threshold = parseFloat(maxCPA);
      metrics = metrics.filter(
        (m: any) => m.avgCPA <= threshold && m.avgCPA > 0
      );
    }

    // Apply sorting
    if (sortBy) {
      metrics = sortAnalytics(metrics, sortBy, order === 'asc');
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          metrics,
          filters: {
            category,
            sortBy,
            order,
            minROAS,
            maxCPA,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Filter error:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'FILTER_ERROR',
          message: 'Failed to filter analytics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS Handler (CORS)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
