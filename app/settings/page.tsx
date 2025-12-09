"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [geminiKey, setGeminiKey] = useState("");
  const [fluxKey, setFluxKey] = useState("");
  const [referenceUrls, setReferenceUrls] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [originalSystemPrompt, setOriginalSystemPrompt] = useState(""); // Track original value
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(true);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false); // Separate saved state for prompt
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false); // Separate saving state for prompt
  const [isResetting, setIsResetting] = useState(false);

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
      setReferenceUrls(localStorage.getItem("reference_urls") || "");

      // Load system prompt from API
      const response = await fetch("/api/settings/system-prompt");
      const data = await response.json();
      if (data.success) {
        setSystemPrompt(data.data.systemPrompt);
        setOriginalSystemPrompt(data.data.systemPrompt); // Store original value
        setIsDefaultPrompt(data.data.isDefault);
        setPromptUpdatedAt(data.data.updatedAt);
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
        setOriginalSystemPrompt(data.data.systemPrompt); // Update original after reset
        setIsDefaultPrompt(true);
        setPromptUpdatedAt(null);
      }
    } catch (error) {
      console.error("Failed to reset prompt:", error);
    } finally {
      setIsResetting(false);
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

  // Check if prompt has unsaved changes
  const hasPromptChanges = systemPrompt !== originalSystemPrompt;

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
          {/* System Prompt - Most Important */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  System Prompt
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
                The AI uses this prompt to generate image descriptions. Customize it to match your brand and product requirements.
                {isDefaultPrompt && (
                  <span className="ml-1 text-primary">(Using default)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={16}
                className="font-mono text-sm"
                placeholder="Enter your custom system prompt..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Tip: The prompt should instruct the AI how to generate image descriptions. Include rules about what to focus on and what to avoid.
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
                value={referenceUrls}
                onChange={(e) => setReferenceUrls(e.target.value)}
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
