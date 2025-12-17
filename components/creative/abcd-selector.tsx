"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  useSceneCategories,
  useSceneDetails,
  useActions,
  useEmotions,
  useFormats,
} from "@/lib/hooks/useABCD";

export interface ABCDSelection {
  sceneCategory: string; // code like "01-Home"
  sceneDetail: string;   // code like "01-Bedroom"
  action: string;        // code like "01-Walk"
  actionProductState?: 'FOLDED' | 'UNFOLDED'; // Product state from database
  driver: string;        // code like "01-Independence" (emotion)
  format: string;        // code like "I01-Lifestyle"
}

interface ABCDSelectorProps {
  onSelectionChange: (selection: ABCDSelection) => void;
  initialSelection?: ABCDSelection;
  disabled?: boolean;
}

export function ABCDSelector({ onSelectionChange, initialSelection, disabled }: ABCDSelectorProps) {
  // Selection state - stores codes
  const [sceneCategory, setSceneCategory] = useState<string>(initialSelection?.sceneCategory || "");
  const [sceneDetail, setSceneDetail] = useState<string>(initialSelection?.sceneDetail || "");
  const [action, setAction] = useState<string>(initialSelection?.action || "");
  const [driver, setDriver] = useState<string>(initialSelection?.driver || "");
  const [format, setFormat] = useState<string>(initialSelection?.format || "");

  // Fetch data from database
  const { data: sceneCategories, isLoading: loadingCategories } = useSceneCategories();
  const { data: sceneDetails, isLoading: loadingDetails } = useSceneDetails();
  const { data: actions, isLoading: loadingActions } = useActions();
  const { data: emotions, isLoading: loadingEmotions } = useEmotions();
  const { data: formats, isLoading: loadingFormats } = useFormats();

  // Track if we're syncing from parent to avoid loops
  const isSyncingRef = useRef(false);
  const prevInitialRef = useRef<string>("");
  const syncCounterRef = useRef(0);

  // Update state when initialSelection changes (for loading sessions)
  useEffect(() => {
    if (initialSelection) {
      const selectionKey = JSON.stringify(initialSelection);
      if (selectionKey !== prevInitialRef.current && initialSelection.sceneCategory) {
        prevInitialRef.current = selectionKey;
        isSyncingRef.current = true;
        syncCounterRef.current += 1;
        const currentSync = syncCounterRef.current;

        setSceneCategory(initialSelection.sceneCategory);
        setSceneDetail(initialSelection.sceneDetail);
        setAction(initialSelection.action);
        setDriver(initialSelection.driver);
        setFormat(initialSelection.format);

        requestAnimationFrame(() => {
          if (syncCounterRef.current === currentSync) {
            isSyncingRef.current = false;
          }
        });
      }
    }
  }, [initialSelection]);

  // Get selected category's ID for filtering details
  const selectedCategoryId = useMemo(() => {
    if (!sceneCategory || !sceneCategories) return null;
    const category = sceneCategories.find(c => c.code === sceneCategory);
    return category?.id || null;
  }, [sceneCategory, sceneCategories]);

  // Filter scene details by selected category
  const availableSceneDetails = useMemo(() => {
    if (!selectedCategoryId || !sceneDetails) return [];
    return sceneDetails
      .filter(d => d.category_id === selectedCategoryId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedCategoryId, sceneDetails]);

  // Track previous category to detect actual changes
  const prevCategoryRef = useRef(sceneCategory);

  // Reset scene detail when category changes (only for user interaction)
  useEffect(() => {
    if (!isSyncingRef.current && sceneCategory !== prevCategoryRef.current) {
      setSceneDetail("");
    }
    prevCategoryRef.current = sceneCategory;
  }, [sceneCategory]);

  // Get the selected action's product_state
  const selectedActionProductState = useMemo(() => {
    if (!action || !actions) return undefined;
    const selectedAction = actions.find(a => a.code === action);
    return selectedAction?.product_state;
  }, [action, actions]);

  // Notify parent of changes
  useEffect(() => {
    if (!isSyncingRef.current) {
      onSelectionChange({
        sceneCategory,
        sceneDetail,
        action,
        actionProductState: selectedActionProductState,
        driver,
        format,
      });
    }
  }, [sceneCategory, sceneDetail, action, selectedActionProductState, driver, format, onSelectionChange]);

  // Helper to format display: "Code(中文名称)"
  const formatLabel = (code: string, nameZh: string) => `${code}(${nameZh})`;

  // Loading indicator
  const isLoading = loadingCategories || loadingDetails || loadingActions || loadingEmotions || loadingFormats;

  // Memoized sorted options to avoid re-sorting on every render
  const sortedCategories = useMemo(() =>
    sceneCategories?.slice().sort((a, b) => a.sort_order - b.sort_order) || [],
    [sceneCategories]
  );

  const sortedActions = useMemo(() =>
    actions?.slice().sort((a, b) => a.sort_order - b.sort_order) || [],
    [actions]
  );

  const sortedEmotions = useMemo(() =>
    emotions?.slice().sort((a, b) => a.sort_order - b.sort_order) || [],
    [emotions]
  );

  const sortedFormats = useMemo(() =>
    formats?.slice().sort((a, b) => a.sort_order - b.sort_order) || [],
    [formats]
  );

  // Optimized onChange handlers - use value directly for Radix Select
  const handleSceneCategoryChange = useCallback((value: string) => {
    setSceneCategory(value);
  }, []);

  const handleSceneDetailChange = useCallback((value: string) => {
    setSceneDetail(value);
  }, []);

  const handleActionChange = useCallback((value: string) => {
    setAction(value);
  }, []);

  const handleDriverChange = useCallback((value: string) => {
    setDriver(value);
  }, []);

  const handleFormatChange = useCallback((value: string) => {
    setFormat(value);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ABCD Framework
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* A - Scene (Two-level) */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            A - Scene (场景)
          </h3>
          <Select
            value={sceneCategory}
            onValueChange={handleSceneCategoryChange}
            disabled={disabled || loadingCategories}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择场景分类..." />
            </SelectTrigger>
            <SelectContent>
              {sortedCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.code}>
                  {formatLabel(cat.code, cat.name_zh)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sceneDetail}
            onValueChange={handleSceneDetailChange}
            disabled={disabled || !sceneCategory || loadingDetails}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择具体场景..." />
            </SelectTrigger>
            <SelectContent>
              {availableSceneDetails.map((detail) => (
                <SelectItem key={detail.id} value={detail.code}>
                  {formatLabel(detail.code, detail.name_zh)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* B - Action */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            B - Action (动作)
          </h3>
          <Select
            value={action}
            onValueChange={handleActionChange}
            disabled={disabled || loadingActions}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择动作..." />
            </SelectTrigger>
            <SelectContent>
              {sortedActions.map((act) => (
                <SelectItem key={act.id} value={act.code}>
                  {formatLabel(act.code, act.name_zh)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* C - Driver (Emotion) */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            C - Driver (情绪驱动)
          </h3>
          <Select
            value={driver}
            onValueChange={handleDriverChange}
            disabled={disabled || loadingEmotions}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择情绪驱动..." />
            </SelectTrigger>
            <SelectContent>
              {sortedEmotions.map((emo) => (
                <SelectItem key={emo.id} value={emo.code}>
                  {formatLabel(emo.code, emo.name_zh)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* D - Format */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            D - Format (格式)
          </h3>
          <Select
            value={format}
            onValueChange={handleFormatChange}
            disabled={disabled || loadingFormats}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择格式..." />
            </SelectTrigger>
            <SelectContent>
              {sortedFormats.map((fmt) => (
                <SelectItem key={fmt.id} value={fmt.code}>
                  {formatLabel(fmt.code, fmt.name_zh)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
