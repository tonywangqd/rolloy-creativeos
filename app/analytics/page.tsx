"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { CSVUploader, type AnalyticsData } from "@/components/analytics/csv-uploader";
import { InsightDashboard } from "@/components/analytics/insight-dashboard";

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Analyze creative performance data and discover insights
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CSVUploader onDataParsed={setAnalyticsData} />
        </div>
        <div className="lg:col-span-2">
          <InsightDashboard data={analyticsData} />
        </div>
      </div>
    </div>
  );
}
