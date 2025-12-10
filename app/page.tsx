"use client";

import { useState, useCallback, useEffect, useRef, useTransition, useMemo, memo } from "react";
import { Sparkles, Eye, ImageIcon, RefreshCw, Copy, Check, Loader2, StopCircle, Cloud, Play, Pause, Star, Plus, Download, ZoomIn, Trash2, ChevronDown, ChevronUp, Pencil, Wand2, Send, Languages } from "lucide-react";
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
  aspectRatio?: string;
  resolution?: string;
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

  // Image settings
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K");

  // Available options
  const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
  const RESOLUTIONS = ["1K", "2K", "4K"];

  // Generation state
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Prompt refinement state
  const [refinementInput, setRefinementInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // Prompt translation state
  const [chinesePrompt, setChinesePrompt] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showChinesePrompt, setShowChinesePrompt] = useState(false);

  // Use ref to track stop state (avoids stale closure issues)
  const shouldStopRef = useRef(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Prompt panel state (for generate step)
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(true);
  const [, startTransition] = useTransition();

  // Optimized toggle handler
  const togglePromptPanel = useCallback(() => {
    startTransition(() => {
      setIsPromptPanelOpen(prev => !prev);
    });
  }, []);

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
          aspectRatio: img.aspect_ratio || undefined,
          resolution: img.resolution || undefined,
        }));
        setImages(restoredImages);

        if (sessionDetail.status === "draft") {
          setStep("prompt");
        } else {
          setStep("generate");

          // Auto-resume: check for pending images and continue generating
          const pendingImages = restoredImages.filter(img => img.status === "pending");
          if (pendingImages.length > 0 && sessionDetail.status === "in_progress") {
            console.log(`Found ${pendingImages.length} pending images, will resume generation...`);
            // Trigger generation for pending images after a short delay
            setTimeout(() => {
              handleResumePendingImages(session.id, sessionDetail, restoredImages);
            }, 500);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  // Resume generating pending images for a session
  const handleResumePendingImages = async (
    sessionId: string,
    sessionDetail: any,
    restoredImages: GeneratedImage[]
  ) => {
    // Find pending image indices
    const pendingIndices = restoredImages
      .map((img, idx) => img.status === "pending" ? idx : -1)
      .filter(idx => idx !== -1);

    if (pendingIndices.length === 0) return;

    setIsGeneratingImages(true);
    shouldStopRef.current = false;

    for (const globalIndex of pendingIndices) {
      if (shouldStopRef.current) {
        console.log("Resume generation stopped by user");
        break;
      }

      setCurrentImageIndex(globalIndex);

      // Update status to generating
      setImages(prev => prev.map((img, idx) =>
        idx === globalIndex ? { ...img, status: "generating" as const } : img
      ));

      try {
        const response = await fetch("/api/generate-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: sessionDetail.prompt,
            referenceImageUrl: sessionDetail.reference_image_url,
            imageIndex: globalIndex,
            totalImages: restoredImages.length,
            creativeName: sessionDetail.creative_name,
            sessionId: sessionId,
            aspectRatio: restoredImages[globalIndex]?.aspectRatio || aspectRatio,
            resolution: restoredImages[globalIndex]?.resolution || resolution,
            productState: sessionDetail.product_state,
          }),
        });

        const data = await response.json();

        if (data.success && data.data.imageUrl) {
          setImages(prev => prev.map((img, idx) =>
            idx === globalIndex ? {
              ...img,
              url: data.data.imageUrl,
              storageUrl: data.data.storageUrl || null,
              status: "success" as const,
            } : img
          ));
        } else {
          setImages(prev => prev.map((img, idx) =>
            idx === globalIndex ? { ...img, status: "failed" as const } : img
          ));
        }
      } catch (err) {
        setImages(prev => prev.map((img, idx) =>
          idx === globalIndex ? { ...img, status: "failed" as const } : img
        ));
      }

      // Delay between requests
      if (globalIndex < pendingIndices[pendingIndices.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
      }
    }

    setIsGeneratingImages(false);
    await updateSessionStatus(sessionId, "completed");
    await loadSessions();
  };

  // Delete a session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // If deleting current session, reset state
        if (currentSessionId === sessionId) {
          handleNewSession();
        }
        await loadSessions();
      } else {
        console.error("Failed to delete session:", data.error?.message);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
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

  // Handle Product State change with Prompt regeneration
  const handleProductStateChange = async (newState: "FOLDED" | "UNFOLDED") => {
    const oldState = productState;

    // Update state and reference image immediately
    setProductState(newState);
    setReferenceImageUrl(
      newState === "UNFOLDED"
        ? process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || ""
        : process.env.NEXT_PUBLIC_FOLDED_IMAGE_URL || ""
    );

    // If state actually changed and we have a prompt, regenerate it
    if (oldState && oldState !== newState && editedPrompt) {
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
            forceProductState: newState, // Force specific product state
          }),
        });

        const data = await response.json();

        if (data.success) {
          setPrompt(data.data.prompt);
          setEditedPrompt(data.data.prompt);
        } else {
          setError(data.error?.message || "Failed to regenerate prompt");
        }
      } catch (err) {
        setError("Network error. Please try again.");
        console.error(err);
      } finally {
        setIsGeneratingPrompt(false);
      }
    }
  };

  // Background translation helper (doesn't block UI)
  const translatePromptInBackground = async (promptText: string) => {
    setIsTranslating(true);
    setChinesePrompt(""); // Clear old translation
    try {
      const response = await fetch("/api/translate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await response.json();
      if (data.success) {
        setChinesePrompt(data.data.translatedPrompt);
        setShowChinesePrompt(true);
      }
    } catch (err) {
      console.error("Background translation failed:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Handle Prompt Refinement
  const handleRefinePrompt = async () => {
    if (!refinementInput.trim() || !editedPrompt) {
      return;
    }

    setIsRefining(true);
    setError("");

    try {
      const response = await fetch("/api/refine-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt: editedPrompt,
          refinementInstruction: refinementInput.trim(),
          productState,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const refinedPrompt = data.data.refinedPrompt;
        setPrompt(refinedPrompt);
        setEditedPrompt(refinedPrompt);
        setRefinementInput(""); // Clear input after success
        // Auto-translate the refined prompt
        translatePromptInBackground(refinedPrompt);
      } else {
        setError(data.error?.message || "Failed to refine prompt");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setIsRefining(false);
    }
  };

  // Handle Prompt Translation
  const handleTranslatePrompt = async () => {
    if (!editedPrompt) return;

    setIsTranslating(true);
    setError("");

    try {
      const response = await fetch("/api/translate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editedPrompt }),
      });

      const data = await response.json();

      if (data.success) {
        setChinesePrompt(data.data.translatedPrompt);
        setShowChinesePrompt(true);
      } else {
        setError(data.error?.message || "Failed to translate prompt");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
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
          // Use database-defined product state instead of keyword matching
          forceProductState: selection.actionProductState,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const generatedPrompt = data.data.prompt;
        setPrompt(generatedPrompt);
        setEditedPrompt(generatedPrompt);
        setProductState(data.data.productState);
        setReferenceImageUrl(data.data.referenceImageUrl);
        setCreativeName(data.data.creativeName);
        setStep("prompt");

        // Auto-translate to Chinese in the background
        translatePromptInBackground(generatedPrompt);
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

    // Add pending images for this batch (with current settings)
    const newPendingImages: GeneratedImage[] = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `img-${startIndex + i + 1}`,
      url: "",
      storageUrl: null,
      selected: false,
      rating: 0,
      status: "pending" as const,
      aspectRatio,
      resolution,
    }));
    setImages(prev => [...prev, ...newPendingImages]);

    // Generate single image (returns a promise)
    const generateSingleImage = async (globalIndex: number) => {
      // Update status to generating
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
            aspectRatio,
            resolution,
            productState,
          }),
        });

        const data = await response.json();

        if (data.success && data.data.imageUrl) {
          setImages(prev => prev.map((img, idx) =>
            idx === globalIndex ? {
              ...img,
              url: data.data.imageUrl,
              storageUrl: data.data.storageUrl || null,
              status: "success" as const,
              // Ensure aspectRatio and resolution are preserved
              aspectRatio: img.aspectRatio || aspectRatio,
              resolution: img.resolution || resolution,
            } : img
          ));
        } else {
          setImages(prev => prev.map((img, idx) =>
            idx === globalIndex ? {
              ...img,
              status: "failed" as const,
              aspectRatio: img.aspectRatio || aspectRatio,
              resolution: img.resolution || resolution,
            } : img
          ));
          console.error(`Image ${globalIndex + 1} failed:`, data.error?.message);
        }
      } catch (err) {
        setImages(prev => prev.map((img, idx) =>
          idx === globalIndex ? {
            ...img,
            status: "failed" as const,
            aspectRatio: img.aspectRatio || aspectRatio,
            resolution: img.resolution || resolution,
          } : img
        ));
        console.error(`Image ${globalIndex + 1} error:`, err);
      }
    };

    // Launch all requests with staggered start (1 second apart)
    const promises: Promise<void>[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      if (shouldStopRef.current) {
        console.log("Generation stopped by user");
        break;
      }

      const globalIndex = startIndex + i;
      setCurrentImageIndex(globalIndex);

      // Start the request immediately (don't await)
      promises.push(generateSingleImage(globalIndex));

      // Wait 1 second before starting the next request (except for the last one)
      if (i < BATCH_SIZE - 1) {
        await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
      }
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    // Mark batch as completed
    if (!shouldStopRef.current) {
      await updateSessionStatus(activeSessionId, "completed");
    }

    setIsGeneratingImages(false);
    await loadSessions();
  }, [editedPrompt, referenceImageUrl, creativeName, currentSessionId, images.length, aspectRatio, resolution]);

  // Stop generation - memoized
  const handleStopGeneration = useCallback(() => {
    shouldStopRef.current = true;
  }, []);

  // Copy prompt - memoized
  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(editedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editedPrompt]);

  // Toggle image selection - memoized
  const toggleImageSelection = useCallback((id: string) => {
    startTransition(() => {
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, selected: !img.selected } : img
      ));
    });
  }, []);

  // Update image rating - memoized
  const handleRatingChange = useCallback(async (id: string, rating: number) => {
    // Optimistic update - update UI immediately
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, rating } : img
    ));

    // Persist to database
    try {
      const response = await fetch(`/api/images/${id}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        throw new Error('Failed to save rating');
      }
    } catch (error) {
      console.error('Failed to save rating:', error);
      // Note: We don't rollback the optimistic update for better UX
      // The rating will be lost on refresh but that's acceptable
    }
  }, []);

  // Open lightbox - memoized
  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // Download selected images - memoized
  const handleDownloadSelected = useCallback(async () => {
    const selectedImages = images.filter(img => img.selected && img.url);
    for (let i = 0; i < selectedImages.length; i++) {
      const img = selectedImages[i];
      const link = document.createElement("a");
      link.href = img.url;
      link.download = `image_${img.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (i < selectedImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }, [images]);

  // Delete image - memoized
  const handleDeleteImage = useCallback((id: string) => {
    startTransition(() => {
      setImages(prev => prev.filter(img => img.id !== id));
    });
  }, []);

  // Get stats - memoized to avoid recalculation on every render
  const { successCount, failedCount, selectedCount, savedCount } = useMemo(() => ({
    successCount: images.filter(img => img.status === "success").length,
    failedCount: images.filter(img => img.status === "failed").length,
    selectedCount: images.filter(img => img.selected).length,
    savedCount: images.filter(img => img.storageUrl).length,
  }), [images]);

  // Get successful images for lightbox - memoized
  const successfulImages = useMemo(() =>
    images
      .map((img, index) => ({ ...img, originalIndex: index }))
      .filter(img => img.status === "success" && img.url),
    [images]
  );

  // Pre-compute image ID to lightbox index mapping for O(1) lookup
  const imageIdToLightboxIndex = useMemo(() => {
    const map = new Map<string, number>();
    successfulImages.forEach((img, index) => {
      map.set(img.id, index);
    });
    return map;
  }, [successfulImages]);

  // Helper: Convert aspect ratio string to CSS value (e.g., "16:9" -> "16/9")
  const getAspectRatioCSS = useCallback((ratio: string | undefined): string => {
    if (!ratio) return "1/1";
    return ratio.replace(":", "/");
  }, []);

  // Helper: Get grid config based on aspect ratio
  const getGridConfig = useCallback((ratio: string) => {
    switch (ratio) {
      case "16:9":
      case "21:9":
        return { cols: "grid-cols-2", gap: "gap-4" };
      case "9:16":
        return { cols: "grid-cols-4", gap: "gap-3" };
      case "3:4":
      case "4:5":
        return { cols: "grid-cols-3", gap: "gap-3" };
      case "4:3":
      case "3:2":
      case "5:4":
        return { cols: "grid-cols-3", gap: "gap-3" };
      case "2:3":
        return { cols: "grid-cols-4", gap: "gap-3" };
      default: // 1:1
        return { cols: "grid-cols-4", gap: "gap-3" };
    }
  }, []);

  // Get grid configuration based on ACTUAL images' aspect ratios (not selector)
  const gridConfig = useMemo(() => {
    // Count aspect ratios of actual images
    const ratioCounts: Record<string, number> = {};
    images.forEach(img => {
      const ratio = img.aspectRatio || "1:1";
      ratioCounts[ratio] = (ratioCounts[ratio] || 0) + 1;
    });

    // Find the dominant (most common) aspect ratio
    let dominantRatio = "1:1";
    let maxCount = 0;
    Object.entries(ratioCounts).forEach(([ratio, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantRatio = ratio;
      }
    });

    // If no images yet, use default layout
    if (images.length === 0) {
      return { cols: "grid-cols-4", gap: "gap-3" };
    }

    return getGridConfig(dominantRatio);
  }, [images, getGridConfig]);

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
            onDeleteSession={handleDeleteSession}
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
                  <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product State Selector */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  {referenceImageUrl && (
                    <img
                      src={referenceImageUrl}
                      alt="Reference"
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Product State</p>
                      <span className="text-xs text-muted-foreground">
                        AI 自动识别，如有误差可手动调整
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleProductStateChange("UNFOLDED")}
                        disabled={isGeneratingPrompt}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                          productState === "UNFOLDED"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground",
                          isGeneratingPrompt && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isGeneratingPrompt && productState !== "UNFOLDED" ? "Regenerating..." : "UNFOLDED（打开）"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProductStateChange("FOLDED")}
                        disabled={isGeneratingPrompt}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                          productState === "FOLDED"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-muted-foreground",
                          isGeneratingPrompt && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isGeneratingPrompt && productState !== "FOLDED" ? "Regenerating..." : "FOLDED（折叠）"}
                      </button>
                    </div>
                    {isGeneratingPrompt && (
                      <p className="text-xs text-amber-500 mt-1">
                        正在根据新状态重新生成 Prompt...
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      Edit Prompt (optional) - Modify and confirm, or click Generate directly
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTranslatePrompt}
                      disabled={isTranslating || !editedPrompt}
                      className="h-7 text-xs"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          翻译中...
                        </>
                      ) : (
                        <>
                          <Languages className="mr-1.5 h-3 w-3" />
                          翻译成中文
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => {
                      setEditedPrompt(e.target.value);
                      setChinesePrompt(""); // Clear translation when prompt edited
                      setShowChinesePrompt(false);
                    }}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder="Edit the prompt here..."
                  />
                  {/* Chinese Translation Display */}
                  {showChinesePrompt && chinesePrompt && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Languages className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">中文翻译</span>
                        <button
                          onClick={() => setShowChinesePrompt(false)}
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                        >
                          收起
                        </button>
                      </div>
                      <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                        {chinesePrompt}
                      </p>
                    </div>
                  )}
                </div>

                {/* Prompt Refinement */}
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                    <label className="text-sm font-medium">AI Prompt 微调</label>
                    <span className="text-xs text-muted-foreground">
                      用自然语言描述你想要的修改，AI会帮你调整Prompt
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && refinementInput.trim()) {
                          e.preventDefault();
                          handleRefinePrompt();
                        }
                      }}
                      placeholder="例如：我希望这个woman是她自己在做美甲..."
                      className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      disabled={isRefining || !editedPrompt}
                    />
                    <Button
                      onClick={handleRefinePrompt}
                      disabled={isRefining || !refinementInput.trim() || !editedPrompt}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isRefining ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          微调中...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          微调
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Image Settings */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {ASPECT_RATIOS.map((ratio) => (
                        <option key={ratio} value={ratio}>{ratio}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Resolution</label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {RESOLUTIONS.map((res) => (
                        <option key={res} value={res}>{res}</option>
                      ))}
                    </select>
                  </div>
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
            <div className="space-y-4">
              {/* Collapsible Prompt Panel */}
              <Card>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={togglePromptPanel}
                >
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Pencil className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-shrink-0">Prompt</span>
                      {!isPromptPanelOpen && editedPrompt && (
                        <span className="text-sm font-normal text-muted-foreground truncate">
                          - {editedPrompt.slice(0, 40)}...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCopyPrompt(); }}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      {isPromptPanelOpen ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                {isPromptPanelOpen && (
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      {/* Reference Image + State Selector */}
                      <div className="flex-shrink-0 space-y-2">
                        {referenceImageUrl && (
                          <img
                            src={referenceImageUrl}
                            alt="Reference"
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                        )}
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setProductState("UNFOLDED");
                              setReferenceImageUrl(process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || "");
                            }}
                            className={cn(
                              "flex-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                              productState === "UNFOLDED"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            打开
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProductState("FOLDED");
                              setReferenceImageUrl(process.env.NEXT_PUBLIC_FOLDED_IMAGE_URL || "");
                            }}
                            className={cn(
                              "flex-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                              productState === "FOLDED"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            折叠
                          </button>
                        </div>
                      </div>
                      {/* Prompt Editor */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTranslatePrompt}
                            disabled={isTranslating || !editedPrompt}
                            className="h-6 text-[10px] px-2"
                          >
                            {isTranslating ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                翻译中
                              </>
                            ) : (
                              <>
                                <Languages className="mr-1 h-3 w-3" />
                                翻译中文
                              </>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          value={editedPrompt}
                          onChange={(e) => {
                            setEditedPrompt(e.target.value);
                            setChinesePrompt("");
                            setShowChinesePrompt(false);
                          }}
                          rows={4}
                          className="font-mono text-sm"
                          placeholder="Edit the prompt here..."
                        />
                      </div>
                    </div>

                    {/* Chinese Translation Display - Compact */}
                    {showChinesePrompt && chinesePrompt && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Languages className="h-3 w-3 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">中文翻译</span>
                          <button
                            onClick={() => setShowChinesePrompt(false)}
                            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            收起
                          </button>
                        </div>
                        <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
                          {chinesePrompt}
                        </p>
                      </div>
                    )}

                    {/* Prompt Refinement - Compact version for Generate step */}
                    <div className="p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="h-3.5 w-3.5 text-purple-500" />
                        <label className="text-xs font-medium">AI Prompt 微调</label>
                        <span className="text-[10px] text-muted-foreground">
                          用自然语言描述你想要的修改
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={refinementInput}
                          onChange={(e) => setRefinementInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && refinementInput.trim()) {
                              e.preventDefault();
                              handleRefinePrompt();
                            }
                          }}
                          placeholder="例如：我希望这个woman是她自己在做美甲..."
                          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          disabled={isRefining || !editedPrompt}
                        />
                        <Button
                          size="sm"
                          onClick={handleRefinePrompt}
                          disabled={isRefining || !refinementInput.trim() || !editedPrompt}
                          className="bg-purple-600 hover:bg-purple-700 h-9"
                        >
                          {isRefining ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              <span className="text-xs">微调中...</span>
                            </>
                          ) : (
                            <>
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              <span className="text-xs">微调</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Settings Row */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">Ratio:</label>
                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                        >
                          {ASPECT_RATIOS.map((ratio) => (
                            <option key={ratio} value={ratio}>{ratio}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">Resolution:</label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                        >
                          {RESOLUTIONS.map((res) => (
                            <option key={res} value={res}>{res}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={handleGenerateBatch}
                        disabled={isGeneratingImages || !editedPrompt}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Generate {BATCH_SIZE} More
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Gallery Card */}
              <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>
                    Generated Images
                    {isGeneratingImages && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({currentImageIndex + 1}/{images.length})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-normal text-muted-foreground">
                      Total: {successCount} | Failed: {failedCount} | Selected: {selectedCount}
                    </span>
                    {isGeneratingImages && (
                      <Button variant="destructive" size="sm" onClick={handleStopGeneration}>
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    )}
                    {!isGeneratingImages && selectedCount > 0 && (
                      <Button variant="outline" size="sm" onClick={handleDownloadSelected}>
                        <Download className="mr-2 h-4 w-4" />
                        Download ({selectedCount})
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("grid", gridConfig.cols, gridConfig.gap)}>
                  {images.map((image, index) => {
                    // Use image's own aspect ratio, default to 1:1 (NOT selector value)
                    const imageRatio = image.aspectRatio || "1:1";
                    const cssAspectRatio = getAspectRatioCSS(imageRatio);

                    return (
                      <div
                        key={image.id}
                        className={cn(
                          "relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer group shadow-sm hover:shadow-md",
                          image.selected ? "border-primary ring-2 ring-primary/30" : "border-border/50 hover:border-border",
                          image.status === "generating" && "border-yellow-500/70",
                          image.status === "failed" && "border-red-500/50 bg-red-500/5"
                        )}
                        style={{ aspectRatio: cssAspectRatio }}
                      >
                        {/* Pending state */}
                        {image.status === "pending" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm">
                            <span className="text-2xl font-light text-muted-foreground/50">{index + 1}</span>
                            <span className="text-[10px] text-muted-foreground mt-1">Waiting...</span>
                          </div>
                        )}

                        {/* Generating state */}
                        {image.status === "generating" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
                            <span className="text-xs text-muted-foreground mt-2">Generating...</span>
                          </div>
                        )}

                        {/* Success state */}
                        {image.status === "success" && image.url && (
                          <>
                            <img
                              src={image.url}
                              alt={`Generated ${index + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                              onClick={() => toggleImageSelection(image.id)}
                            />
                            {/* Gradient overlay for better text visibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            {/* Action buttons on hover */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              {/* Zoom button */}
                              <button
                                className="w-8 h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const lightboxIdx = imageIdToLightboxIndex.get(image.id) ?? 0;
                                  openLightbox(lightboxIdx);
                                }}
                                title="放大预览"
                              >
                                <ZoomIn className="h-4 w-4 text-white" />
                              </button>
                              {/* Delete button */}
                              <button
                                className="w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteImage(image.id);
                                }}
                                title="删除图片"
                              >
                                <Trash2 className="h-4 w-4 text-white" />
                              </button>
                            </div>
                          </>
                        )}

                        {/* Failed state */}
                        {image.status === "failed" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
                            <span className="text-sm text-red-500 font-medium">Failed</span>
                            <span className="text-[10px] text-muted-foreground mt-1">Click to retry</span>
                          </div>
                        )}

                        {/* Selection indicator - top left */}
                        {image.selected && (
                          <div className="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center z-10 shadow-lg">
                            <Check className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                        )}

                        {/* Star rating badge */}
                        {image.rating > 0 && (
                          <div className={cn(
                            "absolute top-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1",
                            image.selected ? "left-10" : "left-2"
                          )}>
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-[11px] text-white font-medium">{image.rating}</span>
                          </div>
                        )}

                        {/* Bottom info bar */}
                        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2 bg-gradient-to-t from-black/60 to-transparent">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded-full font-medium">
                              #{index + 1}
                            </span>
                            {image.aspectRatio && image.resolution && (
                              <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                                {image.aspectRatio} · {image.resolution}
                              </span>
                            )}
                          </div>
                          {/* Cloud saved indicator */}
                          {image.storageUrl && (
                            <div className="bg-green-500/90 text-white p-1 rounded-full" title="Saved to cloud">
                              <Cloud className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
            </div>
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
          rating: img.rating ?? 0,
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
