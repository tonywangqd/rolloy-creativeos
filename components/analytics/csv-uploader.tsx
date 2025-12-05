"use client";

import { useState, useRef } from "react";
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
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
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
    if (csvText.trim()) {
      setIsParsing(true);
      parseCSV(csvText);
    }
  };

  const clearData = () => {
    setCsvText("");
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
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste your CSV data here..."
            rows={8}
            className="font-mono text-xs"
          />
          <Button
            onClick={handleTextPaste}
            disabled={!csvText.trim() || isParsing}
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
