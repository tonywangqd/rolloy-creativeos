"use client";

import { useState } from "react";
import { Plus, History, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SessionItem } from "./session-item";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/lib/types/session";

interface SessionListProps {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  onSessionSelect: (session: SessionSummary) => void;
  onNewSession: () => void;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  className?: string;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  className,
}: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session =>
    session.creative_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort sessions by updated_at (newest first)
  const sortedSessions = [...filteredSessions].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCollapsed(false)}
        className={cn("w-full justify-start", className)}
      >
        <History className="h-4 w-4 mr-2" />
        Sessions ({sessions.length})
      </Button>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Sessions
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsCollapsed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {/* New Session Button */}
        <Button
          onClick={onNewSession}
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>

        {/* Search */}
        {sessions.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        )}

        {/* Session List */}
        <ScrollArea className="max-h-[400px] pr-1">
          <div className="space-y-2">
            {sortedSessions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? "No sessions found" : "No sessions yet"}
              </div>
            ) : (
              sortedSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  onClick={() => onSessionSelect(session)}
                  onDelete={onDeleteSession}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Stats */}
        {sessions.length > 0 && (
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Total Sessions</span>
              <span className="font-medium">{sessions.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Active</span>
              <span className="font-medium">
                {sessions.filter(s => s.status === "in_progress").length}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
