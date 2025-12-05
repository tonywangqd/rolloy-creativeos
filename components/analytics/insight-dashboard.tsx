"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsData } from "./csv-uploader";

interface InsightDashboardProps {
  data: AnalyticsData[];
}

export function InsightDashboard({ data }: InsightDashboardProps) {
  const insights = useMemo(() => {
    if (data.length === 0) return null;

    // Calculate CPA by Scene
    const sceneMetrics: { [key: string]: { cost: number; conversions: number } } = {};
    data.forEach((row) => {
      const scene = String(row.Scene || row.scene || "Unknown");
      const cost = Number(row.Cost || row.cost || 0);
      const conversions = Number(row.Conversions || row.conversions || 0);

      if (!sceneMetrics[scene]) {
        sceneMetrics[scene] = { cost: 0, conversions: 0 };
      }
      sceneMetrics[scene].cost += cost;
      sceneMetrics[scene].conversions += conversions;
    });

    const cpaByscene = Object.entries(sceneMetrics)
      .map(([scene, metrics]) => ({
        scene,
        cpa: metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0,
      }))
      .sort((a, b) => a.cpa - b.cpa);

    // Calculate ROAS by Driver
    const driverMetrics: { [key: string]: { cost: number; revenue: number } } = {};
    data.forEach((row) => {
      const driver = String(row.Driver || row.driver || "Unknown");
      const cost = Number(row.Cost || row.cost || 0);
      const revenue = Number(row.Revenue || row.revenue || 0);

      if (!driverMetrics[driver]) {
        driverMetrics[driver] = { cost: 0, revenue: 0 };
      }
      driverMetrics[driver].cost += cost;
      driverMetrics[driver].revenue += revenue;
    });

    const roasByDriver = Object.entries(driverMetrics)
      .map(([driver, metrics]) => ({
        driver,
        roas: metrics.cost > 0 ? metrics.revenue / metrics.cost : 0,
      }))
      .sort((a, b) => b.roas - a.roas);

    // Compare Format Performance
    const formatMetrics: { [key: string]: { impressions: number; clicks: number; conversions: number } } = {};
    data.forEach((row) => {
      const format = String(row.Format || row.format || "Unknown");
      const impressions = Number(row.Impressions || row.impressions || 0);
      const clicks = Number(row.Clicks || row.clicks || 0);
      const conversions = Number(row.Conversions || row.conversions || 0);

      if (!formatMetrics[format]) {
        formatMetrics[format] = { impressions: 0, clicks: 0, conversions: 0 };
      }
      formatMetrics[format].impressions += impressions;
      formatMetrics[format].clicks += clicks;
      formatMetrics[format].conversions += conversions;
    });

    const formatComparison = Object.entries(formatMetrics).map(
      ([format, metrics]) => ({
        format,
        ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
        cvr: metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : 0,
      })
    );

    return {
      cpaByscene,
      roasByDriver,
      formatComparison,
    };
  }, [data]);

  if (!insights || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Upload data to see insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

  return (
    <div className="space-y-6">
      {/* CPA by Scene */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Per Acquisition (CPA) by Scene</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={insights.cpaByscene}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="scene" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Legend />
              <Bar dataKey="cpa" fill="#3b82f6" name="CPA ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ROAS by Driver */}
      <Card>
        <CardHeader>
          <CardTitle>Return on Ad Spend (ROAS) by Emotional Driver</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={insights.roasByDriver}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="driver" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)}x`}
              />
              <Legend />
              <Bar dataKey="roas" fill="#10b981" name="ROAS (x)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Format Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Format Performance: CTR vs CVR</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={insights.formatComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="format" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)}%`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ctr"
                stroke="#8b5cf6"
                name="CTR (%)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cvr"
                stroke="#ec4899"
                name="CVR (%)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Best Scene (Lowest CPA)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {insights.cpaByscene[0]?.scene}
            </p>
            <p className="text-sm text-muted-foreground">
              ${insights.cpaByscene[0]?.cpa.toFixed(2)} CPA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Best Driver (Highest ROAS)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {insights.roasByDriver[0]?.driver}
            </p>
            <p className="text-sm text-muted-foreground">
              {insights.roasByDriver[0]?.roas.toFixed(2)}x ROAS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Data Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.length}</p>
            <p className="text-sm text-muted-foreground">campaigns analyzed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
