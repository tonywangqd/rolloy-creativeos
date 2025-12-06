"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { SCENES, ACTIONS, DRIVERS, FORMATS } from "@/lib/constants/abcd";

export interface ABCDSelection {
  sceneCategory: string;
  sceneDetail: string;
  action: string;
  driver: string;
  format: string;
}

interface ABCDSelectorProps {
  onSelectionChange: (selection: ABCDSelection) => void;
  initialSelection?: ABCDSelection;
  disabled?: boolean;
}

export function ABCDSelector({ onSelectionChange, initialSelection, disabled }: ABCDSelectorProps) {
  const [sceneCategory, setSceneCategory] = useState<string>(initialSelection?.sceneCategory || "");
  const [sceneDetail, setSceneDetail] = useState<string>(initialSelection?.sceneDetail || "");
  const [action, setAction] = useState<string>(initialSelection?.action || "");
  const [driver, setDriver] = useState<string>(initialSelection?.driver || "");
  const [format, setFormat] = useState<string>(initialSelection?.format || "");

  // Update state when initialSelection changes (for loading sessions)
  useEffect(() => {
    if (initialSelection) {
      setSceneCategory(initialSelection.sceneCategory);
      setSceneDetail(initialSelection.sceneDetail);
      setAction(initialSelection.action);
      setDriver(initialSelection.driver);
      setFormat(initialSelection.format);
    }
  }, [initialSelection]);

  const availableSceneDetails = sceneCategory
    ? SCENES[sceneCategory as keyof typeof SCENES] || []
    : [];

  // Reset scene detail when category changes
  useEffect(() => {
    setSceneDetail("");
  }, [sceneCategory]);

  // Notify parent of changes
  useEffect(() => {
    onSelectionChange({
      sceneCategory,
      sceneDetail,
      action,
      driver,
      format,
    });
  }, [sceneCategory, sceneDetail, action, driver, format, onSelectionChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ABCD Framework</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* A - Scene (Two-level) */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            A - Scene (场景)
          </h3>
          <Select
            label="Scene Category"
            value={sceneCategory}
            onChange={(e) => setSceneCategory(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Category...</option>
            {Object.keys(SCENES).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>

          <Select
            label="Scene Detail"
            value={sceneDetail}
            onChange={(e) => setSceneDetail(e.target.value)}
            disabled={disabled || !sceneCategory}
          >
            <option value="">Select Detail...</option>
            {availableSceneDetails.map((detail) => (
              <option key={detail} value={detail}>
                {detail}
              </option>
            ))}
          </Select>
        </div>

        {/* B - Action */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            B - Action (动作)
          </h3>
          <Select
            label="Action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Action...</option>
            {ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </Select>
        </div>

        {/* C - Driver */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            C - Driver (情绪驱动)
          </h3>
          <Select
            label="Emotional Driver"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Driver...</option>
            {DRIVERS.map((drv) => (
              <option key={drv} value={drv}>
                {drv}
              </option>
            ))}
          </Select>
        </div>

        {/* D - Format */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            D - Format (格式)
          </h3>
          <Select
            label="Creative Format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Format...</option>
            {FORMATS.map((fmt) => (
              <option key={fmt.code} value={fmt.code}>
                {fmt.label}
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
