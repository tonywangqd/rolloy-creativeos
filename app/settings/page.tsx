"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ABCDManager } from "@/components/settings/abcd-manager";
import {
  Save,
  Key,
  Image,
  Settings as SettingsIcon,
  MessageSquare,
  RotateCcw,
  Loader2,
  Database,
  Check,
  Footprints,
  LayoutDashboard,
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [geminiKey, setGeminiKey] = useState("");
  const [fluxKey, setFluxKey] = useState("");
  const [referenceUrls, setReferenceUrls] = useState("");

  // Rollator System Prompt state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [originalSystemPrompt, setOriginalSystemPrompt] = useState("");
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(true);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [promptSaved, setPromptSaved] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Walker System Prompt state (separate from Rollator)
  const [walkerSystemPrompt, setWalkerSystemPrompt] = useState("");
  const [originalWalkerSystemPrompt, setOriginalWalkerSystemPrompt] = useState("");
  const [isDefaultWalkerPrompt, setIsDefaultWalkerPrompt] = useState(true);
  const [walkerPromptUpdatedAt, setWalkerPromptUpdatedAt] = useState<string | null>(null);
  const [walkerPromptSaved, setWalkerPromptSaved] = useState(false);
  const [isSavingWalkerPrompt, setIsSavingWalkerPrompt] = useState(false);
  const [isResettingWalker, setIsResettingWalker] = useState(false);

  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for immediate UI feedback (debounced sync to main state)
  const [localSystemPrompt, setLocalSystemPrompt] = useState("");
  const [localWalkerSystemPrompt, setLocalWalkerSystemPrompt] = useState("");
  const [localReferenceUrls, setLocalReferenceUrls] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceWalkerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceUrlTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced handler for Rollator system prompt
  const handleSystemPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalSystemPrompt(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setSystemPrompt(value);
    }, 300);
  }, []);

  // Debounced handler for Walker system prompt
  const handleWalkerSystemPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalWalkerSystemPrompt(value);

    if (debounceWalkerTimerRef.current) {
      clearTimeout(debounceWalkerTimerRef.current);
    }
    debounceWalkerTimerRef.current = setTimeout(() => {
      setWalkerSystemPrompt(value);
    }, 300);
  }, []);

  // Debounced handler for reference URLs
  const handleReferenceUrlsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalReferenceUrls(value);

    if (debounceUrlTimerRef.current) {
      clearTimeout(debounceUrlTimerRef.current);
    }
    debounceUrlTimerRef.current = setTimeout(() => {
      setReferenceUrls(value);
    }, 300);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (debounceWalkerTimerRef.current) clearTimeout(debounceWalkerTimerRef.current);
      if (debounceUrlTimerRef.current) clearTimeout(debounceUrlTimerRef.current);
    };
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Load from localStorage
      setGeminiKey(localStorage.getItem("gemini_api_key") || "");
      setFluxKey(localStorage.getItem("flux_api_key") || "");
      const savedReferenceUrls = localStorage.getItem("reference_urls") || "";
      setReferenceUrls(savedReferenceUrls);
      setLocalReferenceUrls(savedReferenceUrls);

      // Load Rollator system prompt from API
      const response = await fetch("/api/settings/system-prompt");
      const data = await response.json();
      if (data.success) {
        setSystemPrompt(data.data.systemPrompt);
        setLocalSystemPrompt(data.data.systemPrompt);
        setOriginalSystemPrompt(data.data.systemPrompt);
        setIsDefaultPrompt(data.data.isDefault);
        setPromptUpdatedAt(data.data.updatedAt);
      }

      // Load Walker system prompt from API
      const walkerResponse = await fetch("/api/settings/walker-system-prompt");
      const walkerData = await walkerResponse.json();
      if (walkerData.success) {
        setWalkerSystemPrompt(walkerData.data.systemPrompt);
        setLocalWalkerSystemPrompt(walkerData.data.systemPrompt);
        setOriginalWalkerSystemPrompt(walkerData.data.systemPrompt);
        setIsDefaultWalkerPrompt(walkerData.data.isDefault);
        setWalkerPromptUpdatedAt(walkerData.data.updatedAt);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (only non-prompt settings)
      localStorage.setItem("gemini_api_key", geminiKey);
      localStorage.setItem("flux_api_key", fluxKey);
      localStorage.setItem("reference_urls", referenceUrls);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Separate function to save system prompt
  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const response = await fetch("/api/settings/system-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      const data = await response.json();

      if (data.success) {
        setOriginalSystemPrompt(data.data.systemPrompt); // Update original after save
        setIsDefaultPrompt(data.data.isDefault);
        setPromptUpdatedAt(data.data.updatedAt);
        setPromptSaved(true);
        setTimeout(() => setPromptSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save system prompt:", error);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleResetPrompt = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/settings/system-prompt", {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setSystemPrompt(data.data.systemPrompt);
        setLocalSystemPrompt(data.data.systemPrompt);
        setOriginalSystemPrompt(data.data.systemPrompt);
        setIsDefaultPrompt(true);
        setPromptUpdatedAt(null);
      }
    } catch (error) {
      console.error("Failed to reset prompt:", error);
    } finally {
      setIsResetting(false);
    }
  };

  // Save Walker system prompt
  const handleSaveWalkerPrompt = async () => {
    setIsSavingWalkerPrompt(true);
    try {
      const response = await fetch("/api/settings/walker-system-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: walkerSystemPrompt }),
      });
      const data = await response.json();

      if (data.success) {
        setOriginalWalkerSystemPrompt(data.data.systemPrompt);
        setIsDefaultWalkerPrompt(data.data.isDefault);
        setWalkerPromptUpdatedAt(data.data.updatedAt);
        setWalkerPromptSaved(true);
        setTimeout(() => setWalkerPromptSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save walker system prompt:", error);
    } finally {
      setIsSavingWalkerPrompt(false);
    }
  };

  // Reset Walker system prompt to default
  const handleResetWalkerPrompt = async () => {
    setIsResettingWalker(true);
    try {
      const response = await fetch("/api/settings/walker-system-prompt", {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setWalkerSystemPrompt(data.data.systemPrompt);
        setLocalWalkerSystemPrompt(data.data.systemPrompt);
        setOriginalWalkerSystemPrompt(data.data.systemPrompt);
        setIsDefaultWalkerPrompt(true);
        setWalkerPromptUpdatedAt(null);
      }
    } catch (error) {
      console.error("Failed to reset walker prompt:", error);
    } finally {
      setIsResettingWalker(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if prompts have unsaved changes
  const hasPromptChanges = systemPrompt !== originalSystemPrompt;
  const hasWalkerPromptChanges = walkerSystemPrompt !== originalWalkerSystemPrompt;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure API keys, prompts, and ABCD data
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="abcd" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            ABCD Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Rollator System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5" />
                  Rollator System Prompt
                </div>
                <div className="flex items-center gap-2">
                  {!isDefaultPrompt && promptUpdatedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last updated: {formatTime(promptUpdatedAt)}
                    </span>
                  )}
                  {!isDefaultPrompt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetPrompt}
                      disabled={isResetting}
                    >
                      {isResetting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                System prompt for Rollator (四轮助行车) creative generation. Customize to match your Rollator product requirements.
                {isDefaultPrompt && (
                  <span className="ml-1 text-primary">(Using default)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={localSystemPrompt}
                onChange={handleSystemPromptChange}
                rows={12}
                className="font-mono text-sm"
                placeholder="Enter your custom Rollator system prompt..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Tip: Include rules about Rollator product rendering, senior demographics, and commercial photography style.
                </p>
                <Button
                  onClick={handleSavePrompt}
                  disabled={isSavingPrompt || !hasPromptChanges}
                  size="sm"
                >
                  {isSavingPrompt ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {promptSaved ? "Saved!" : "Confirm"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Walker System Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Footprints className="h-5 w-5" />
                  Walker System Prompt
                </div>
                <div className="flex items-center gap-2">
                  {!isDefaultWalkerPrompt && walkerPromptUpdatedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last updated: {formatTime(walkerPromptUpdatedAt)}
                    </span>
                  )}
                  {!isDefaultWalkerPrompt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetWalkerPrompt}
                      disabled={isResettingWalker}
                    >
                      {isResettingWalker ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                System prompt for Standard Walker (两轮助行器) creative generation. This is separate from Rollator settings.
                {isDefaultWalkerPrompt && (
                  <span className="ml-1 text-primary">(Using default)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={localWalkerSystemPrompt}
                onChange={handleWalkerSystemPromptChange}
                rows={12}
                className="font-mono text-sm"
                placeholder="Enter your custom Walker system prompt..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Note: Walker has different features (2 wheels, no seat, no brakes) than Rollator. Ensure prompts reflect these differences.
                </p>
                <Button
                  onClick={handleSaveWalkerPrompt}
                  disabled={isSavingWalkerPrompt || !hasWalkerPromptChanges}
                  size="sm"
                >
                  {isSavingWalkerPrompt ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {walkerPromptSaved ? "Saved!" : "Confirm"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Secure credentials for AI services (stored locally)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Gemini API Key</label>
                <Input
                  type="password"
                  placeholder="Enter your Gemini API key"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Flux API Key</label>
                <Input
                  type="password"
                  placeholder="Enter your Flux API key"
                  value={fluxKey}
                  onChange={(e) => setFluxKey(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your API keys are stored locally in your browser and never shared with third parties.
              </p>
            </CardContent>
          </Card>

          {/* Reference Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Reference Images
              </CardTitle>
              <CardDescription>
                URLs of reference images for style consistency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                value={localReferenceUrls}
                onChange={handleReferenceUrlsChange}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              {saved ? "Saved!" : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="abcd">
          <ABCDManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
