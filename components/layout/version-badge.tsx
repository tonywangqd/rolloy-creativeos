"use client";

/**
 * Version Badge Component
 * Displays version number and build timestamp in Beijing time
 */

// Version info - update this when releasing new versions
export const VERSION = "3.19.0";
export const BUILD_TIMESTAMP = "2025-12-08T15:38:00+08:00"; // Beijing time

// Format the timestamp for display
export const formatBeijingTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Legacy component - kept for backward compatibility but no longer used
// Version info is now displayed in the Sidebar
export function VersionBadge() {
  return null;
}
