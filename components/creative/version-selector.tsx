/**
 * Rolloy Creative OS - Prompt Version Selector Component
 * Allows users to switch between different prompt versions
 */

"use client";

import { memo, useMemo } from 'react';
import { ChevronDown, Clock, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import type { PromptVersionSummary } from '@/lib/types/prompt-version';
import { cn } from '@/lib/utils';

interface VersionSelectorProps {
  sessionId: string;
  versions: PromptVersionSummary[];
  activeVersionId: string | null;
  onVersionChange: (versionId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Format date to relative time (e.g., "2 minutes ago", "1 hour ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Version Selector Component
 */
export const VersionSelector = memo(function VersionSelector({
  sessionId,
  versions,
  activeVersionId,
  onVersionChange,
  disabled = false,
  className,
}: VersionSelectorProps) {
  // Sort versions by version_number (ascending)
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.version_number - b.version_number),
    [versions]
  );

  // Find active version
  const activeVersion = useMemo(
    () => sortedVersions.find((v) => v.id === activeVersionId),
    [sortedVersions, activeVersionId]
  );

  // If no versions, don't render
  if (sortedVersions.length === 0) {
    return null;
  }

  // If only one version, render a static display (no dropdown)
  if (sortedVersions.length === 1) {
    const version = sortedVersions[0];
    return (
      <div className={cn("flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border", className)}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">V{version.version_number}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Prompt Version</span>
            <span className="text-sm font-medium">V{version.version_number} (Initial)</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(version.created_at)}
          <ImageIcon className="h-3 w-3 ml-2" />
          {version.image_count}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 p-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg border border-blue-500/20", className)}>
      {/* Version Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="text-base font-bold text-primary">
          V{activeVersion?.version_number || '?'}
        </span>
      </div>

      {/* Dropdown Selector */}
      <div className="flex-1 min-w-0">
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
          Prompt Version
        </label>
        <select
          value={activeVersionId || ''}
          onChange={(e) => onVersionChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full h-8 px-2 pr-8 rounded-md border border-input bg-background text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "appearance-none bg-no-repeat bg-right",
            "cursor-pointer"
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1rem',
          }}
        >
          {sortedVersions.map((version) => (
            <option key={version.id} value={version.id}>
              V{version.version_number} - {formatRelativeTime(version.created_at)} - {version.prompt_preview}
            </option>
          ))}
        </select>
      </div>

      {/* Version Stats */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(activeVersion?.created_at || '')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          <span>{activeVersion?.image_count || 0} images</span>
        </div>
      </div>

      {/* Active Indicator */}
      {activeVersion && (
        <div className="flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Compact Version for Generate Step
// ============================================================================

interface CompactVersionSelectorProps {
  versions: PromptVersionSummary[];
  activeVersionId: string | null;
  onVersionChange: (versionId: string) => void;
  disabled?: boolean;
}

export const CompactVersionSelector = memo(function CompactVersionSelector({
  versions,
  activeVersionId,
  onVersionChange,
  disabled = false,
}: CompactVersionSelectorProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.version_number - b.version_number),
    [versions]
  );

  const activeVersion = useMemo(
    () => sortedVersions.find((v) => v.id === activeVersionId),
    [sortedVersions, activeVersionId]
  );

  if (sortedVersions.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Version:</span>
      <select
        value={activeVersionId || ''}
        onChange={(e) => onVersionChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "h-7 px-2 rounded-md border border-input bg-background text-xs",
          "focus:outline-none focus:ring-1 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {sortedVersions.map((version) => (
          <option key={version.id} value={version.id}>
            V{version.version_number} ({version.image_count} imgs)
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(activeVersion?.created_at || '')}
      </span>
    </div>
  );
});

// ============================================================================
// Version Badge for Images
// ============================================================================

interface VersionBadgeProps {
  versionNumber: number;
  isActive?: boolean;
  className?: string;
}

export const VersionBadge = memo(function VersionBadge({
  versionNumber,
  isActive = false,
  className,
}: VersionBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-blue-500/80 text-white",
        className
      )}
    >
      <span>V{versionNumber}</span>
      {isActive && (
        <CheckCircle2 className="h-2.5 w-2.5" />
      )}
    </div>
  );
});

// ============================================================================
// Version List (for comparison/history view)
// ============================================================================

interface VersionListProps {
  versions: PromptVersionSummary[];
  activeVersionId: string | null;
  onVersionSelect: (versionId: string) => void;
}

export const VersionList = memo(function VersionList({
  versions,
  activeVersionId,
  onVersionSelect,
}: VersionListProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version_number - a.version_number), // Descending
    [versions]
  );

  return (
    <div className="space-y-2">
      {sortedVersions.map((version) => {
        const isActive = version.id === activeVersionId;

        return (
          <button
            key={version.id}
            onClick={() => onVersionSelect(version.id)}
            className={cn(
              "w-full p-3 rounded-lg border-2 transition-all text-left",
              isActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Version Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">V{version.version_number}</span>
                  {isActive && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(version.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {version.prompt_preview}
                </p>
              </div>

              {/* Stats */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  <span>{version.image_count}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {version.product_state}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
