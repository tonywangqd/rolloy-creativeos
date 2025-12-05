"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import type { ABCDSelection } from "./abcd-selector";

interface NamingCardProps {
  selection: ABCDSelection;
}

export function NamingCard({ selection }: NamingCardProps) {
  const [copied, setCopied] = useState(false);

  const generateFileName = () => {
    const date = new Date();
    const dateStr = date
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    const { sceneCategory, sceneDetail, action, driver, format } = selection;

    if (!sceneCategory || !sceneDetail || !action || !driver || !format) {
      return "Please complete all selections";
    }

    return `${dateStr}_[${sceneCategory}]_[${sceneDetail}]_[${action}]_[${driver}]_[${format}]`;
  };

  const fileName = generateFileName();
  const isComplete = !fileName.includes("Please complete");

  const handleCopy = async () => {
    if (isComplete) {
      await navigator.clipboard.writeText(fileName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Naming Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4">
          <p className="font-mono text-sm break-all">
            {fileName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            disabled={!isComplete}
            variant="outline"
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Name
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Naming Format:</p>
          <code className="block mt-1 text-xs">
            YYYYMMDD_[Category]_[Detail]_[Action]_[Driver]_[Format-Code]
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
