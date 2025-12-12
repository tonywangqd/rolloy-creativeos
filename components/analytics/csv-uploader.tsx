"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X } from "lucide-react";
import Papa from "papaparse";

export interface AnalyticsData {
  [key: string]: string | number;
}

interface CSVUploaderProps {
  onDataParsed: (data: AnalyticsData[]) => void;
}

export function CSVUploader({ onDataParsed }: CSVUploaderProps) {
  const [csvText, setCsvText] = useState("");
  const [localCsvText, setLocalCsvText] = useState(""); // Local state for immediate UI updates
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced handler for CSV text input
  const handleCsvTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalCsvText(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setCsvText(value);
    }, 300);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      setLocalCsvText(text); // Sync local state
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          onDataParsed(results.data as AnalyticsData[]);
          setIsParsing(false);
        },
        error: (error: Error) => {
          console.error("CSV parsing error:", error);
          setIsParsing(false);
        },
      });
    } catch (error) {
      console.error("Failed to parse CSV:", error);
      setIsParsing(false);
    }
  };

  const handleTextPaste = () => {
    // Use local state for immediate check, but ensure main state is synced
    const textToUse = localCsvText.trim() || csvText.trim();
    if (textToUse) {
      setIsParsing(true);
      setCsvText(localCsvText); // Sync main state before parsing
      parseCSV(textToUse);
    }
  };

  const clearData = () => {
    setCsvText("");
    setLocalCsvText(""); // Clear local state too
    setFileName("");
    onDataParsed([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Performance Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Upload CSV File</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose CSV File
          </Button>
          {fileName && (
            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm">{fileName}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearData}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Text Paste */}
        <div className="space-y-2">
          <Textarea
            label="Paste CSV Data"
            value={localCsvText}
            onChange={handleCsvTextChange}
            placeholder="Paste your CSV data here..."
            rows={8}
            className="font-mono text-xs"
          />
          <Button
            onClick={handleTextPaste}
            disabled={!localCsvText.trim() || isParsing}
            className="w-full"
          >
            {isParsing ? "Parsing..." : "Parse Data"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Expected CSV columns:</p>
          <code className="block bg-muted p-2 rounded">
            Scene, Action, Driver, Format, Impressions, Clicks, Conversions,
            Cost, Revenue
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
