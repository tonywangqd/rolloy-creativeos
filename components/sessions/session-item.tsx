"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Image, Trash2, Loader2 } from "lucide-react";
import { SessionStatusBadge } from "./session-status-badge";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/lib/types/session";

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (sessionId: string) => Promise<void>;
}

export function SessionItem({ session, isActive, onClick, onDelete }: SessionItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const progress = session.progress_percentage || 0;

  // Format date as Beijing time (absolute)
  const formattedTime = useMemo(() => {
    try {
      const date = new Date(session.updated_at);
      // Format: 2025-12-06 13:45
      return format(date, "yyyy-MM-dd HH:mm");
    } catch {
      return "";
    }
  }, [session.updated_at]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;

    if (!showConfirm) {
      setShowConfirm(true);
      // Auto-hide confirm after 3 seconds
      setTimeout(() => setShowConfirm(false), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(session.id);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div
      className={cn(
        "relative w-full text-left p-3 rounded-lg border transition-all hover:border-primary/50 group cursor-pointer",
        isActive
          ? "bg-primary/10 border-primary shadow-sm"
          : "bg-card border-border hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "absolute top-2 right-2 p-1.5 rounded-md transition-all z-10",
            showConfirm
              ? "bg-red-500 text-white opacity-100"
              : "opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
          )}
          title={showConfirm ? "再次点击确认删除" : "删除会话"}
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {/* Creative Name */}
      <div className="flex items-start justify-between gap-2 mb-2 pr-6">
        <h4 className={cn(
          "text-sm font-medium truncate flex-1",
          isActive ? "text-primary" : "text-foreground group-hover:text-foreground"
        )}>
          {session.creative_name || "Untitled Session"}
        </h4>
        <SessionStatusBadge status={session.status} showIcon={false} />
      </div>

      {/* Time */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Clock className="h-3 w-3" />
        <span>{formattedTime}</span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Image className="h-3 w-3" />
          <span className="font-medium">{session.generated_count}/{session.total_images}</span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              session.status === "in_progress" && "bg-blue-500",
              session.status === "completed" && "bg-green-500",
              session.status === "paused" && "bg-yellow-500",
              session.status === "failed" && "bg-red-500",
              session.status === "cancelled" && "bg-gray-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs text-muted-foreground font-medium min-w-[3ch] text-right">
          {progress}%
        </span>
      </div>
    </div>
  );
}
