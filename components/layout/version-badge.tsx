"use client";

/**
 * Version Badge Component
 * Displays version number and build timestamp in Beijing time
 */

// Version info - update this when releasing new versions
const VERSION = "3.4.0";
const BUILD_TIMESTAMP = "2025-12-06T14:04:00+08:00"; // Beijing time

export function VersionBadge() {
  // Format the timestamp for display
  const formatBeijingTime = (isoString: string) => {
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

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-muted/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground">
        <div className="font-medium">Rolloy Creative OS</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-mono">
            v{VERSION}
          </span>
          <span className="text-[10px]">
            {formatBeijingTime(BUILD_TIMESTAMP)}
          </span>
        </div>
      </div>
    </div>
  );
}
