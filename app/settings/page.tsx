"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Key, Image, Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [fluxKey, setFluxKey] = useState("");
  const [referenceUrls, setReferenceUrls] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Save to localStorage or backend
    localStorage.setItem("gemini_api_key", geminiKey);
    localStorage.setItem("flux_api_key", fluxKey);
    localStorage.setItem("reference_urls", referenceUrls);
    localStorage.setItem("default_prompt", defaultPrompt);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure API keys and default parameters
          </p>
        </div>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Secure credentials for AI services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Gemini API Key"
            type="password"
            placeholder="Enter your Gemini API key"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
          />
          <Input
            label="Flux API Key"
            type="password"
            placeholder="Enter your Flux API key"
            value={fluxKey}
            onChange={(e) => setFluxKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Your API keys are stored locally and never shared with third parties
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
            label="Image URLs (one per line)"
            placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
            value={referenceUrls}
            onChange={(e) => setReferenceUrls(e.target.value)}
            rows={6}
          />
        </CardContent>
      </Card>

      {/* Default Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Default Generation Parameters</CardTitle>
          <CardDescription>
            Customize the base prompt for image generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            label="Base Prompt Template"
            placeholder="Professional product photography, high quality, well-lit..."
            value={defaultPrompt}
            onChange={(e) => setDefaultPrompt(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">
          <Save className="mr-2 h-5 w-5" />
          {saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
