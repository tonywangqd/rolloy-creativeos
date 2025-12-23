"use client";

import { useState, useCallback, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VERSION, BUILD_TIMESTAMP, formatBeijingTime } from "./version-badge";

// Product types
type ProductType = "rollator" | "walker";

// Navigation configuration based on product type
const getNavigation = (productType: ProductType) => [
  {
    name: productType === "rollator" ? "Rollator 创意工作台" : "Walker 创意工作台",
    href: productType === "rollator" ? "/" : "/walker",
    icon: LayoutDashboard,
    isWorkbench: true,
  },
  {
    name: "效能追踪",
    href: "/analytics",
    icon: BarChart3,
    isWorkbench: false,
  },
  {
    name: "设置",
    href: "/settings",
    icon: Settings,
    isWorkbench: false,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, startTransition] = useTransition();

  // Determine current product type based on pathname
  const currentProductType: ProductType = useMemo(() => {
    if (pathname && (pathname === "/walker" || pathname.startsWith("/walker/"))) {
      return "walker";
    }
    return "rollator";
  }, [pathname]);

  // Get navigation items based on current product type
  const navigation = useMemo(() => getNavigation(currentProductType), [currentProductType]);

  // Optimized toggle handler to avoid INP issues
  const toggleCollapse = useCallback(() => {
    startTransition(() => {
      setIsCollapsed(prev => !prev);
    });
  }, []);

  // Handle product type change
  const handleProductTypeChange = useCallback((value: string) => {
    const newType = value as ProductType;
    if (newType !== currentProductType) {
      // Navigate to the corresponding workbench
      if (newType === "walker") {
        router.push("/walker");
      } else {
        router.push("/");
      }
    }
  }, [currentProductType, router]);

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

      {/* Product Type Selector */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b">
          <label className="text-xs text-muted-foreground mb-1.5 block">产品类型</label>
          <Select value={currentProductType} onValueChange={handleProductTypeChange}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="选择产品类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rollator">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Rollator (四轮助行车)</span>
                </div>
              </SelectItem>
              <SelectItem value="walker">
                <div className="flex items-center gap-2">
                  <Footprints className="h-4 w-4" />
                  <span>Walker (两轮助行器)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {isCollapsed && (
        <div className="p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center p-2"
            title={currentProductType === "rollator" ? "Rollator (四轮助行车)" : "Walker (两轮助行器)"}
            onClick={() => handleProductTypeChange(currentProductType === "rollator" ? "walker" : "rollator")}
          >
            {currentProductType === "rollator" ? (
              <LayoutDashboard className="h-5 w-5" />
            ) : (
              <Footprints className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1", isCollapsed ? "p-2" : "p-4")}>
        {navigation.map((item) => {
          // For workbench items, check based on product type
          const isActive = item.isWorkbench
            ? (currentProductType === "rollator" ? pathname === "/" : pathname === "/walker")
            : pathname === item.href;
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
              title={isCollapsed ? item.name : undefined}
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
