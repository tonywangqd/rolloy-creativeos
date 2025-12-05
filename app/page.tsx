"use client";

import { useState } from "react";
import { Sparkles, Eye, ImageIcon, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ABCDSelector, type ABCDSelection } from "@/components/creative/abcd-selector";
import { NamingCard } from "@/components/creative/naming-card";
import { Gallery } from "@/components/creative/gallery";

type WorkflowStep = "select" | "prompt" | "generate";

export default function HomePage() {
  // Selection state
  const [selection, setSelection] = useState<ABCDSelection>({
    sceneCategory: "",
    sceneDetail: "",
    action: "",
    driver: "",
    format: "",
  });

  // Workflow state
  const [step, setStep] = useState<WorkflowStep>("select");
  const [prompt, setPrompt] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [productState, setProductState] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [creativeName, setCreativeName] = useState("");

  // Generation state
  const [images, setImages] = useState<Array<{ id: string; url: string; selected: boolean }>>([]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isSelectionComplete =
    selection.sceneCategory &&
    selection.sceneDetail &&
    selection.action &&
    selection.driver &&
    selection.format;

  // Step 1: Generate Prompt
  const handleGeneratePrompt = async () => {
    if (!isSelectionComplete) {
      setError("Please complete all ABCD selections");
      return;
    }

    setIsGeneratingPrompt(true);
    setError("");

    try {
      const response = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: {
            A1: selection.sceneCategory,
            A2: selection.sceneDetail,
            B: selection.action,
            C: selection.driver,
            D: selection.format,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPrompt(data.data.prompt);
        setEditedPrompt(data.data.prompt);
        setProductState(data.data.productState);
        setReferenceImageUrl(data.data.referenceImageUrl);
        setCreativeName(data.data.creativeName);
        setStep("prompt");
      } else {
        setError(data.error?.message || "Failed to generate prompt");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Step 2: Generate Images
  const handleGenerateImages = async () => {
    setIsGeneratingImages(true);
    setError("");
    setProgress(0);
    setImages([]);
    setStep("generate");

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 90));
    }, 500);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: {
            A1: selection.sceneCategory,
            A2: selection.sceneDetail,
            B: selection.action,
            C: selection.driver,
            D: selection.format,
          },
          prompt: editedPrompt,
          numImages: 20,
        }),
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (data.success && data.data.generatedImages) {
        const generatedImages = data.data.generatedImages.map((url: string, index: number) => ({
          id: `img-${index + 1}`,
          url,
          selected: false,
        }));
        setImages(generatedImages);
        setProgress(100);
      } else {
        setError(data.error?.message || "Failed to generate images");
        setProgress(0);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError("Network error. Please try again.");
      setProgress(0);
      console.error(err);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep("select");
    setPrompt("");
    setEditedPrompt("");
    setImages([]);
    setProgress(0);
    setError("");
  };

  // Copy prompt
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(editedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSelected = (selectedIds: string[]) => {
    console.log("Saving selected images:", selectedIds);
    alert(`Saved ${selectedIds.length} images!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Creative Workbench</h1>
            <p className="text-muted-foreground">
              Generate AI-powered creative assets using ABCD framework
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full ${step === "select" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1. Select
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "prompt" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2. Review Prompt
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "generate" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3. Generate
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/20 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: ABCD Selection */}
        <div className="lg:col-span-1 space-y-6">
          <ABCDSelector onSelectionChange={setSelection} />
          <NamingCard selection={selection} />

          {/* Action Buttons */}
          <div className="space-y-3">
            {step === "select" && (
              <Button
                size="lg"
                className="w-full"
                onClick={handleGeneratePrompt}
                disabled={!isSelectionComplete || isGeneratingPrompt}
              >
                <Eye className="mr-2 h-5 w-5" />
                {isGeneratingPrompt ? "Generating Prompt..." : "Preview Prompt"}
              </Button>
            )}

            {step !== "select" && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleReset}
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Start Over
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Prompt Preview or Gallery */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Preview Step */}
          {step === "prompt" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generated Prompt</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground">
                      Product State: <span className="font-medium text-foreground">{productState}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reference Image Preview */}
                {referenceImageUrl && (
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <img
                      src={referenceImageUrl}
                      alt="Reference"
                      className="w-24 h-24 object-cover rounded"
                    />
                    <div>
                      <p className="font-medium">Reference Image</p>
                      <p className="text-sm text-muted-foreground">
                        {productState === "FOLDED" ? "Folded Walker" : "Unfolded Walker"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Editable Prompt */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Edit Prompt (optional)
                  </label>
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Generate Button */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleGenerateImages}
                  disabled={isGeneratingImages || !editedPrompt}
                >
                  <ImageIcon className="mr-2 h-5 w-5" />
                  Generate 20 Images
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Gallery Step */}
          {(step === "generate" || images.length > 0) && (
            <Gallery
              images={images}
              isLoading={isGeneratingImages}
              progress={progress}
              onSaveSelected={handleSaveSelected}
            />
          )}

          {/* Initial State */}
          {step === "select" && images.length === 0 && (
            <Card className="h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Ready to Create</p>
                <p className="text-sm">Complete ABCD selection and click Preview Prompt</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
