"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, Eye, ImageIcon, RefreshCw, Copy, Check, Loader2, StopCircle, Cloud, Play, Pause, Star, Plus, Download, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ABCDSelector, type ABCDSelection } from "@/components/creative/abcd-selector";
import { NamingCard } from "@/components/creative/naming-card";
import { SessionList } from "@/components/sessions/session-list";
import { ImageLightbox } from "@/components/creative/image-lightbox";
import type { SessionSummary } from "@/lib/types/session";
import { cn } from "@/lib/utils";

type WorkflowStep = "select" | "prompt" | "generate";

interface GeneratedImage {
  id: string;
  url: string;
  storageUrl: string | null;
  selected: boolean;
  rating: number;
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
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Use ref to track stop state (avoids stale closure issues)
  const shouldStopRef = useRef(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Batch size - generate 4 images at a time
  const BATCH_SIZE = 4;
  // Delay between API calls (1 second)
  const API_DELAY_MS = 1000;

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
  const createSession = async (totalImages: number): Promise<string | null> => {
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
        await loadSessions();
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
      await loadSessions();
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

        setCurrentSessionId(session.id);
        setSelection({
          sceneCategory: sessionDetail.abcd_selection.A1,
          sceneDetail: sessionDetail.abcd_selection.A2,
          action: sessionDetail.abcd_selection.B,
          driver: sessionDetail.abcd_selection.C,
          format: sessionDetail.abcd_selection.D,
        });
        setPrompt(sessionDetail.prompt);
        setEditedPrompt(sessionDetail.prompt);
        setProductState(sessionDetail.product_state);
        setReferenceImageUrl(sessionDetail.reference_image_url);
        setCreativeName(sessionDetail.creative_name);

        const restoredImages: GeneratedImage[] = sessionDetail.images.map((img: any) => ({
          id: img.id,
          url: img.storage_url || "",
          storageUrl: img.storage_url || null,
          selected: false,
          rating: img.rating || 0,
          status: img.status === "success" ? "success" : img.status === "failed" ? "failed" : "pending",
        }));
        setImages(restoredImages);

        if (sessionDetail.status === "draft") {
          setStep("prompt");
        } else {
          setStep("generate");
        }
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
    shouldStopRef.current = false;
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

  // Generate a batch of images (4 at a time, 1 second delay between each)
  const handleGenerateBatch = useCallback(async () => {
    setIsGeneratingImages(true);
    shouldStopRef.current = false;
    setError("");
    setStep("generate");

    // Calculate starting index (add to existing images)
    const startIndex = images.length;
    const endIndex = startIndex + BATCH_SIZE;

    // Create session if first batch
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = await createSession(endIndex);
      if (!activeSessionId) {
        setError("Failed to create session");
        setIsGeneratingImages(false);
        return;
      }
    } else {
      await updateSessionStatus(activeSessionId, "in_progress");
    }

    // Add pending images for this batch
    const newPendingImages: GeneratedImage[] = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `img-${startIndex + i + 1}`,
      url: "",
      storageUrl: null,
      selected: false,
      rating: 0,
      status: "pending" as const,
    }));
    setImages(prev => [...prev, ...newPendingImages]);

    // Generate images one by one with delay
    for (let i = 0; i < BATCH_SIZE; i++) {
      const globalIndex = startIndex + i;

      // Check if user requested stop
      if (shouldStopRef.current) {
        console.log("Generation stopped by user");
        await updateSessionStatus(activeSessionId, "paused");
        break;
      }

      setCurrentImageIndex(globalIndex);

      // Update current image status to generating
      setImages(prev => prev.map((img, idx) =>
        idx === globalIndex ? { ...img, status: "generating" as const } : img
      ));

      try {
        const response = await fetch("/api/generate-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: editedPrompt,
            referenceImageUrl,
            imageIndex: globalIndex,
            totalImages: endIndex,
            creativeName,
            sessionId: activeSessionId,
          }),
        });

        const data = await response.json();

        if (data.success && data.data.imageUrl) {
          setImages(prev => prev.map((img, idx) =>
            idx === globalIndex ? {
              ...img,
              url: data.data.imageUrl,
              storageUrl: data.data.storageUrl || null,
              status: "success" as const
            } : img
          ));
        } else {
          setImages(prev => prev.map((img, idx) =>
            idx === globalIndex ? { ...img, status: "failed" as const } : img
          ));
          console.error(`Image ${globalIndex + 1} failed:`, data.error?.message);
        }
      } catch (err) {
        setImages(prev => prev.map((img, idx) =>
          idx === globalIndex ? { ...img, status: "failed" as const } : img
        ));
        console.error(`Image ${globalIndex + 1} error:`, err);
      }

      // Wait 1 second before next API call (except for the last one)
      if (i < BATCH_SIZE - 1 && !shouldStopRef.current) {
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
      }
    }

    // Mark batch as completed
    if (!shouldStopRef.current) {
      await updateSessionStatus(activeSessionId, "completed");
    }

    setIsGeneratingImages(false);
    await loadSessions();
  }, [editedPrompt, referenceImageUrl, creativeName, currentSessionId, images.length]);

  // Stop generation
  const handleStopGeneration = () => {
    shouldStopRef.current = true;
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

  // Update image rating
  const handleRatingChange = (id: string, rating: number) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, rating } : img
    ));
  };

  // Open lightbox
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Download selected images
  const handleDownloadSelected = async () => {
    const selectedImages = images.filter(img => img.selected && img.url);
    for (let i = 0; i < selectedImages.length; i++) {
      const img = selectedImages[i];
      const link = document.createElement("a");
      link.href = img.url;
      link.download = `image_${img.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Small delay between downloads
      if (i < selectedImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  // Get stats
  const successCount = images.filter(img => img.status === "success").length;
  const failedCount = images.filter(img => img.status === "failed").length;
  const selectedCount = images.filter(img => img.selected).length;
  const savedCount = images.filter(img => img.storageUrl).length;

  // Get successful images for lightbox
  const successfulImages = images
    .map((img, index) => ({ ...img, originalIndex: index }))
    .filter(img => img.status === "success" && img.url);

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
          <SessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
          />

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

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleGenerateBatch}
                    disabled={isGeneratingImages || !editedPrompt}
                  >
                    <ImageIcon className="mr-2 h-5 w-5" />
                    Generate {BATCH_SIZE} Images
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gallery Step */}
          {step === "generate" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    Generated Images
                    {isGeneratingImages && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({currentImageIndex + 1}/{images.length})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Total: {successCount} | Failed: {failedCount} | Selected: {selectedCount}
                    </span>
                    {isGeneratingImages ? (
                      <Button variant="destructive" size="sm" onClick={handleStopGeneration}>
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleGenerateBatch}>
                          <Plus className="mr-2 h-4 w-4" />
                          Generate {BATCH_SIZE} More
                        </Button>
                        {selectedCount > 0 && (
                          <Button variant="outline" size="sm" onClick={handleDownloadSelected}>
                            <Download className="mr-2 h-4 w-4" />
                            Download ({selectedCount})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer group",
                        image.selected ? "border-primary ring-2 ring-primary/50" : "border-border",
                        image.status === "generating" && "border-yellow-500",
                        image.status === "failed" && "border-red-500 bg-red-500/10"
                      )}
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
                        <>
                          <img
                            src={image.url}
                            alt={`Generated ${index + 1}`}
                            className="w-full h-full object-cover"
                            onClick={() => toggleImageSelection(image.id)}
                          />
                          {/* Zoom button for lightbox */}
                          <button
                            className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox(successfulImages.findIndex(img => img.id === image.id));
                            }}
                            title="放大预览"
                          >
                            <ZoomIn className="h-4 w-4 text-white" />
                          </button>
                        </>
                      )}

                      {/* Failed state */}
                      {image.status === "failed" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-red-500">Failed</span>
                        </div>
                      )}

                      {/* Selection indicator */}
                      {image.selected && (
                        <div className="absolute top-2 left-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}

                      {/* Star rating on thumbnail */}
                      {image.rating > 0 && (
                        <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 rounded px-1 py-0.5">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-[10px] text-white font-medium">{image.rating}</span>
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

                {images.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No images generated yet</p>
                    <p className="text-sm">Click "Generate {BATCH_SIZE} More" to start</p>
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

      {/* Image Lightbox */}
      <ImageLightbox
        images={successfulImages.map(img => ({
          id: img.id,
          url: img.url,
          storageUrl: img.storageUrl,
          rating: img.rating,
        }))}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onRatingChange={handleRatingChange}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
