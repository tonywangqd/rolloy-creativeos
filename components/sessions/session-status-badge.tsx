import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, PauseCircle, XCircle, FileText, Ban } from "lucide-react";
import type { SessionStatus } from "@/lib/types/session";

interface SessionStatusBadgeProps {
  status: SessionStatus;
  showIcon?: boolean;
}

export function SessionStatusBadge({ status, showIcon = true }: SessionStatusBadgeProps) {
  const config = {
    draft: {
      label: "Draft",
      variant: "outline" as const,
      icon: FileText,
      iconClass: "",
    },
    in_progress: {
      label: "In Progress",
      variant: "info" as const,
      icon: Loader2,
      iconClass: "animate-spin",
    },
    paused: {
      label: "Paused",
      variant: "warning" as const,
      icon: PauseCircle,
      iconClass: "",
    },
    completed: {
      label: "Completed",
      variant: "success" as const,
      icon: CheckCircle2,
      iconClass: "",
    },
    cancelled: {
      label: "Cancelled",
      variant: "secondary" as const,
      icon: Ban,
      iconClass: "",
    },
    failed: {
      label: "Failed",
      variant: "destructive" as const,
      icon: XCircle,
      iconClass: "",
    },
  };

  const { label, variant, icon: Icon, iconClass } = config[status];

  return (
    <Badge variant={variant} className="gap-1">
      {showIcon && <Icon className={`h-3 w-3 ${iconClass}`} />}
      {label}
    </Badge>
  );
}
