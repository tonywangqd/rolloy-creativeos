"use client";

import { useState, useCallback, useEffect } from "react";
import { Sparkles, Eye, ImageIcon, RefreshCw, Copy, Check, Loader2, StopCircle, Cloud, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ABCDSelector, type ABCDSelection } from "@/components/creative/abcd-selector";
import { NamingCard } from "@/components/creative/naming-card";
import { SessionList } from "@/components/sessions/session-list";
import type { SessionSummary, GenerationSession } from "@/lib/types/session";

type WorkflowStep = "select" | "prompt" | "generate";

interface GeneratedImage {
  id: string;
  url: string;
  storageUrl: string | null;
  selected: boolean;
  status: "pending" | "generating" | "success" | "failed";
}

export default function HomePage() {
  // Session state
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

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
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [shouldStop, setShouldStop] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const totalImages = 20;

  const isSelectionComplete =
    selection.sceneCategory &&
    selection.sceneDetail &&
    selection.action &&
    selection.driver &&
    selection.format;

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await fetch("/api/sessions");
      const data = await response.json();
      if (data.success) {
        setSessions(data.data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Create a new session
  const createSession = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creative_name: creativeName,
          abcd_selection: {
            A1: selection.sceneCategory,
            A2: selection.sceneDetail,
            B: selection.action,
            C: selection.driver,
            D: selection.format,
          },
          prompt: editedPrompt,
          product_state: productState,
          reference_image_url: referenceImageUrl,
          total_images: totalImages,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCurrentSessionId(data.data.session.id);
        await loadSessions(); // Refresh list
        return data.data.session.id;
      }
      return null;
    } catch (err) {
      console.error("Failed to create session:", err);
      return null;
    }
  };

  // Update session status
  const updateSessionStatus = async (sessionId: string, status: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadSessions(); // Refresh list
    } catch (err) {
      console.error("Failed to update session:", err);
    }
  };

  // Load a session
  const handleSessionSelect = async (session: SessionSummary) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}`);
      const data = await response.json();

      if (data.success) {
        const sessionDetail = data.data;

        // Set current session
        setCurrentSessionId(session.id);

        // Restore selection
        setSelection({
          sceneCategory: sessionDetail.abcd_selection.A1,
          sceneDetail: sessionDetail.abcd_selection.A2,
          action: sessionDetail.abcd_selection.B,
          driver: sessionDetail.abcd_selection.C,
          format: sessionDetail.abcd_selection.D,
        });

        // Restore prompt
        setPrompt(sessionDetail.prompt);
        setEditedPrompt(sessionDetail.prompt);
        setProductState(sessionDetail.product_state);
        setReferenceImageUrl(sessionDetail.reference_image_url);
        setCreativeName(sessionDetail.creative_name);

        // Restore images
        const restoredImages: GeneratedImage[] = sessionDetail.images.map((img: any) => ({
          id: img.id,
          url: img.storage_url || "",
          storageUrl: img.storage_url || null,
          selected: false,
          status: img.status === "success" ? "success" : img.status === "failed" ? "failed" : "pending",
        }));
        setImages(restoredImages);

        // Set step based on session status
        if (sessionDetail.status === "draft") {
          setStep("prompt");
        } else {
          setStep("generate");
        }

        // Check if paused
        setIsPaused(sessionDetail.status === "paused");
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  // Start a new session
  const handleNewSession = () => {
    setCurrentSessionId(null);
    setSelection({
      sceneCategory: "",
      sceneDetail: "",
      action: "",
      driver: "",
      format: "",
    });
    setStep("select");
    setPrompt("");
    setEditedPrompt("");
    setImages([]);
    setError("");
    setShouldStop(false);
    setIsPaused(false);
    setCurrentImageIndex(0);
  };

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

  // Step 2: Generate Images One by One
  const handleGenerateImages = useCallback(async (startIndex: number = 0, sessionId?: string) => {
    setIsGeneratingImages(true);
    setShouldStop(false);
    setIsPaused(false);
    setError("");
    setStep("generate");

    let activeSessionId = sessionId || currentSessionId;

    // Create session if not exists
    if (!activeSessionId) {
      activeSessionId = await createSession();
      if (!activeSessionId) {
        setError("Failed to create session");
        setIsGeneratingImages(false);
        return;
      }
    } else {
      // Update session status to in_progress
      await updateSessionStatus(activeSessionId, "in_progress");
    }

    // Initialize images if starting fresh
    if (startIndex === 0) {
      const initialImages: GeneratedImage[] = Array.from({ length: totalImages }, (_, i) => ({
        id: `img-${i + 1}`,
        url: "",
        storageUrl: null,
        selected: false,
        status: "pending" as const,
      }));
      setImages(initialImages);
    }

    setCurrentImageIndex(startIndex);

    // Generate images one by one
    for (let i = startIndex; i < totalImages; i++) {
      // Check if user requested stop or pause
      if (shouldStop) {
        console.log("Generation stopped by user");
        await updateSessionStatus(activeSessionId, "cancelled");
        break;
      }

      if (isPaused) {
        console.log("Generation paused by user");
        await updateSessionStatus(activeSessionId, "paused");
        break;
      }

      setCurrentImageIndex(i);

      // Update current image status to generating
      setImages(prev => prev.map((img, idx) =>
        idx === i ? { ...img, status: "generating" as const } : img
      ));

      try {
        const response = await fetch("/api/generate-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: editedPrompt,
            referenceImageUrl,
            imageIndex: i,
            totalImages,
            creativeName,
            sessionId: activeSessionId,
          }),
        });

        const data = await response.json();

        if (data.success && data.data.imageUrl) {
          setImages(prev => prev.map((img, idx) =>
            idx === i ? {
              ...img,
              url: data.data.imageUrl,
              storageUrl: data.data.storageUrl || null,
              status: "success" as const
            } : img
          ));
          if (data.data.storageUrl) {
            console.log(`Image ${i + 1} saved to: ${data.data.storageUrl}`);
          }
        } else {
          setImages(prev => prev.map((img, idx) =>
            idx === i ? { ...img, status: "failed" as const } : img
          ));
          console.error(`Image ${i + 1} failed:`, data.error?.message);
        }
      } catch (err) {
        setImages(prev => prev.map((img, idx) =>
          idx === i ? { ...img, status: "failed" as const } : img
        ));
        console.error(`Image ${i + 1} error:`, err);
      }

      // Small delay between requests
      if (i < totalImages - 1 && !shouldStop && !isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mark session as completed if all done
    if (!shouldStop && !isPaused) {
      await updateSessionStatus(activeSessionId, "completed");
    }

    setIsGeneratingImages(false);
    await loadSessions(); // Refresh session list
  }, [editedPrompt, referenceImageUrl, shouldStop, isPaused, creativeName, currentSessionId]);

  // Pause generation
  const handlePauseGeneration = () => {
    setIsPaused(true);
  };

  // Resume generation
  const handleResumeGeneration = () => {
    const nextIndex = images.findIndex(img => img.status === "pending");
    if (nextIndex !== -1) {
      handleGenerateImages(nextIndex, currentSessionId || undefined);
    }
  };

  // Stop generation
  const handleStopGeneration = () => {
    setShouldStop(true);
  };

  // Copy prompt
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(editedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Toggle image selection
  const toggleImageSelection = (id: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  // Get stats
  const successCount = images.filter(img => img.status === "success").length;
  const failedCount = images.filter(img => img.status === "failed").length;
  const selectedCount = images.filter(img => img.selected).length;
  const savedCount = images.filter(img => img.storageUrl).length;

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
        {/* Left Column: Sessions + ABCD Selection */}
        <div className="lg:col-span-1 space-y-4">
          {/* Session List */}
          <SessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
          />

          {/* ABCD Selector */}
          <ABCDSelector
            onSelectionChange={setSelection}
            initialSelection={selection}
            disabled={!!currentSessionId && step !== "select"}
          />
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

            {step !== "select" && !currentSessionId && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleNewSession}
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
                    Edit Prompt (optional) - Modify and confirm, or click Generate directly
                  </label>
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder="Edit the prompt here..."
                  />
                </div>

                {/* Generate Button */}
                <div className="flex gap-3">
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => handleGenerateImages(0)}
                    disabled={isGeneratingImages || !editedPrompt}
                  >
                    <ImageIcon className="mr-2 h-5 w-5" />
                    Confirm & Generate {totalImages} Images
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gallery Step - Real-time Generation */}
          {step === "generate" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    Generated Images
                    {isGeneratingImages && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({currentImageIndex + 1}/{totalImages})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      ✓ {successCount} | ✗ {failedCount} | 💾 {savedCount} | Selected: {selectedCount}
                    </span>
                    {isGeneratingImages ? (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePauseGeneration}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleStopGeneration}>
                          <StopCircle className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                      </div>
                    ) : isPaused && successCount < totalImages ? (
                      <Button size="sm" onClick={handleResumeGeneration}>
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </Button>
                    ) : null}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer
                        ${image.selected ? "border-primary ring-2 ring-primary/50" : "border-border"}
                        ${image.status === "generating" ? "border-yellow-500" : ""}
                        ${image.status === "failed" ? "border-red-500 bg-red-500/10" : ""}
                      `}
                      onClick={() => image.status === "success" && toggleImageSelection(image.id)}
                    >
                      {/* Pending state */}
                      {image.status === "pending" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <span className="text-xs text-muted-foreground">{index + 1}</span>
                        </div>
                      )}

                      {/* Generating state */}
                      {image.status === "generating" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                        </div>
                      )}

                      {/* Success state */}
                      {image.status === "success" && image.url && (
                        <img
                          src={image.url}
                          alt={`Generated ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Failed state */}
                      {image.status === "failed" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-red-500">Failed</span>
                        </div>
                      )}

                      {/* Selection indicator */}
                      {image.selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}

                      {/* Index badge */}
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>

                      {/* Cloud saved indicator */}
                      {image.storageUrl && (
                        <div className="absolute bottom-1 right-1 bg-green-500/80 text-white p-0.5 rounded" title="Saved to cloud">
                          <Cloud className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Save Selected Button */}
                {selectedCount > 0 && !isGeneratingImages && (
                  <div className="mt-4 flex justify-end">
                    <Button>
                      Save {selectedCount} Selected Images
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
