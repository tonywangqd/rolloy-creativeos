"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Footprints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VERSION, BUILD_TIMESTAMP, formatBeijingTime } from "./version-badge";

// Navigation items - two independent workbenches + shared pages
const navigation = [
  {
    name: "Rollator 工作台",
    href: "/",
    icon: LayoutDashboard,
    description: "四轮助行车创意工作台",
  },
  {
    name: "Walker 工作台",
    href: "/walker",
    icon: Footprints,
    description: "两轮助行器创意工作台",
  },
  {
    name: "效能追踪",
    href: "/analytics",
    icon: BarChart3,
    description: "查看创意效能数据",
  },
  {
    name: "设置",
    href: "/settings",
    icon: Settings,
    description: "系统设置",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, startTransition] = useTransition();

  // Optimized toggle handler to avoid INP issues
  const toggleCollapse = useCallback(() => {
    startTransition(() => {
      setIsCollapsed(prev => !prev);
    });
  }, []);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b",
        isCollapsed ? "justify-center px-2" : "gap-2 px-6"
      )}>
        <Sparkles className="h-6 w-6 text-primary flex-shrink-0" />
        {!isCollapsed && (
          <span className="text-lg font-bold whitespace-nowrap">Rolloy Creative OS</span>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1", isCollapsed ? "p-2" : "p-4")}>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={isCollapsed ? item.name : item.description}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* Version Info + Collapse Toggle */}
      <div className="border-t p-2 space-y-2">
        {/* Version Badge */}
        {!isCollapsed && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-mono">
                v{VERSION}
              </span>
              <span className="text-[10px]">
                {formatBeijingTime(BUILD_TIMESTAMP)}
              </span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center py-1">
            <span className="bg-primary/20 text-primary px-1 py-0.5 rounded text-[9px] font-mono">
              {VERSION}
            </span>
          </div>
        )}

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className={cn(
            "w-full",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              收起
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
