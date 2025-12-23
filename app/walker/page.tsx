"use client";

import { useState, useCallback, useEffect, useRef, useTransition, useMemo, memo } from "react";
import { Sparkles, Eye, ImageIcon, RefreshCw, Copy, Check, Loader2, StopCircle, Cloud, Play, Pause, Star, Plus, Download, ZoomIn, Trash2, ChevronDown, ChevronUp, Pencil, Wand2, Send, Languages, History, RotateCcw, Film, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ABCDSelector, type ABCDSelection } from "@/components/creative/abcd-selector";
import { NamingCard } from "@/components/creative/naming-card";
import { SessionList } from "@/components/sessions/session-list";
import { ImageLightbox } from "@/components/creative/image-lightbox";
import type { SessionSummary } from "@/lib/types/session";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type WorkflowStep = "select" | "prompt" | "generate";

// Walker-specific state: IN_USE or STORED (different from rollator's FOLDED/UNFOLDED)
type WalkerState = "IN_USE" | "STORED";

// Prompt Version for tracking history (per session)
interface PromptVersion {
  id: string;
  version: number;
  englishPrompt: string;
  chinesePrompt: string;
  videoPrompt: string;
  createdAt: string;
  cloudId?: string;
  synced?: boolean;
}

interface GeneratedImage {
  id: string;
  url: string;
  storageUrl: string | null;
  selected: boolean;
  rating: number;
  status: "pending" | "generating" | "success" | "failed";
  aspectRatio?: string;
  resolution?: string;
  promptVersion?: number;
}

// LocalStorage keys - separate from Rollator to avoid conflicts
const STORAGE_KEY_WALKER_PROMPT_VERSIONS = "rolloy_walker_prompt_versions";
const STORAGE_KEY_WALKER_IMAGES = "rolloy_walker_generated_images";
const STORAGE_KEY_WALKER_SESSION_DATA = "rolloy_walker_session_data";

export default function WalkerPage() {
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
  const [localEditedPrompt, setLocalEditedPrompt] = useState("");
  const [walkerState, setWalkerState] = useState<WalkerState>("IN_USE");
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
  const [localRefinementInput, setLocalRefinementInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // Prompt translation state
  const [chinesePrompt, setChinesePrompt] = useState("");

  // Video prompt state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [isGeneratingVideoPrompt, setIsGeneratingVideoPrompt] = useState(false);

  // Prompt version management
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [currentVersionNumber, setCurrentVersionNumber] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);

  // Use ref to track stop state
  const shouldStopRef = useRef(false);
  const promptVersionsRef = useRef<PromptVersion[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);

  // Debounce timer refs
  const editedPromptDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const refinementDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Prompt panel state
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(true);
  const [, startTransition] = useTransition();

  const togglePromptPanel = useCallback(() => {
    startTransition(() => {
      setIsPromptPanelOpen(prev => !prev);
    });
  }, []);

  // Debounced handlers
  const handleEditedPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalEditedPrompt(value);
    if (editedPromptDebounceRef.current) clearTimeout(editedPromptDebounceRef.current);
    editedPromptDebounceRef.current = setTimeout(() => {
      setEditedPrompt(value);
      setChinesePrompt("");
    }, 300);
  }, []);

  const handleRefinementInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalRefinementInput(value);
    if (refinementDebounceRef.current) clearTimeout(refinementDebounceRef.current);
    refinementDebounceRef.current = setTimeout(() => {
      setRefinementInput(value);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (editedPromptDebounceRef.current) clearTimeout(editedPromptDebounceRef.current);
      if (refinementDebounceRef.current) clearTimeout(refinementDebounceRef.current);
    };
  }, []);

  const BATCH_SIZE = 4;
  const API_DELAY_MS = 1000;

  const isSelectionComplete =
    selection.sceneCategory &&
    selection.sceneDetail &&
    selection.action &&
    selection.driver &&
    selection.format;

  // Keep refs in sync
  useEffect(() => {
    promptVersionsRef.current = promptVersions;
  }, [promptVersions]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Load persisted data from localStorage on mount
  useEffect(() => {
    try {
      const savedVersions = localStorage.getItem(STORAGE_KEY_WALKER_PROMPT_VERSIONS);
      const savedImages = localStorage.getItem(STORAGE_KEY_WALKER_IMAGES);
      const savedSessionData = localStorage.getItem(STORAGE_KEY_WALKER_SESSION_DATA);

      if (savedSessionData) {
        const sessionData = JSON.parse(savedSessionData);
        if (sessionData.selection) setSelection(sessionData.selection);
        if (sessionData.walkerState) setWalkerState(sessionData.walkerState);
        if (sessionData.referenceImageUrl) setReferenceImageUrl(sessionData.referenceImageUrl);
        if (sessionData.creativeName) setCreativeName(sessionData.creativeName);
        if (sessionData.aspectRatio) setAspectRatio(sessionData.aspectRatio);
        if (sessionData.resolution) setResolution(sessionData.resolution);
        if (sessionData.currentVersionNumber) setCurrentVersionNumber(sessionData.currentVersionNumber);
      }

      if (savedVersions) {
        const versions = JSON.parse(savedVersions) as PromptVersion[];
        promptVersionsRef.current = versions;
        setPromptVersions(versions);
        if (versions.length > 0) {
          const currentVersion = versions[versions.length - 1];
          setEditedPrompt(currentVersion.englishPrompt);
          setLocalEditedPrompt(currentVersion.englishPrompt);
          setPrompt(currentVersion.englishPrompt);
          setChinesePrompt(currentVersion.chinesePrompt || "");
          setVideoPrompt(currentVersion.videoPrompt || "");
          setCurrentVersionNumber(currentVersion.version);
          setStep("prompt");
        }
      }

      if (savedImages) {
        const imgs = JSON.parse(savedImages) as GeneratedImage[];
        setImages(imgs);
        if (imgs.length > 0) setStep("generate");
      }
    } catch (err) {
      console.error("[Walker] Failed to load persisted data:", err);
    }
  }, []);

  // Persist data to localStorage
  useEffect(() => {
    if (promptVersions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_WALKER_PROMPT_VERSIONS, JSON.stringify(promptVersions));
      } catch (err) {
        console.warn("[Walker] Failed to save prompt versions:", err);
      }
    }
  }, [promptVersions]);

  useEffect(() => {
    if (images.length > 0) {
      try {
        const imagesToSave = images
          .filter(img => img.storageUrl)
          .map(img => ({ ...img, url: img.storageUrl || "" }));
        if (imagesToSave.length > 0) {
          localStorage.setItem(STORAGE_KEY_WALKER_IMAGES, JSON.stringify(imagesToSave));
        }
      } catch (err) {
        console.warn("[Walker] Failed to save images:", err);
      }
    }
  }, [images]);

  useEffect(() => {
    if (selection.sceneCategory || walkerState || creativeName) {
      try {
        const sessionData = {
          selection,
          walkerState,
          referenceImageUrl,
          creativeName,
          aspectRatio,
          resolution,
          currentVersionNumber,
        };
        localStorage.setItem(STORAGE_KEY_WALKER_SESSION_DATA, JSON.stringify(sessionData));
      } catch (err) {
        console.warn("[Walker] Failed to save session data:", err);
      }
    }
  }, [selection, walkerState, referenceImageUrl, creativeName, aspectRatio, resolution, currentVersionNumber]);

  // Generate Walker Prompt
  const handleGeneratePrompt = async () => {
    if (!isSelectionComplete) {
      setError("Please complete all ABCD selections first");
      return;
    }

    setIsGeneratingPrompt(true);
    setError("");

    try {
      const response = await fetch("/api/walker/generate-prompt", {
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
        setLocalEditedPrompt(data.data.prompt);
        setWalkerState(data.data.walkerState);
        setReferenceImageUrl(data.data.referenceImageUrl);
        setCreativeName(data.data.creativeName);
        setStep("prompt");

        // Create version V1
        const newVersion: PromptVersion = {
          id: `v1-${Date.now()}`,
          version: 1,
          englishPrompt: data.data.prompt,
          chinesePrompt: "",
          videoPrompt: "",
          createdAt: new Date().toISOString(),
        };
        promptVersionsRef.current = [newVersion];
        setPromptVersions([newVersion]);
        setCurrentVersionNumber(1);
        setChinesePrompt("");
        setVideoPrompt("");
      } else {
        setError(data.error?.message || "Failed to generate prompt");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("[Walker]", err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Handle Walker State change
  const handleWalkerStateChange = async (newState: WalkerState) => {
    const oldState = walkerState;
    setWalkerState(newState);
    setReferenceImageUrl(
      newState === "IN_USE"
        ? process.env.NEXT_PUBLIC_WALKER_IN_USE_IMAGE_URL || ""
        : process.env.NEXT_PUBLIC_WALKER_FOLDED_IMAGE_URL || ""
    );

    if (oldState && oldState !== newState && editedPrompt) {
      setIsGeneratingPrompt(true);
      setError("");

      try {
        const response = await fetch("/api/walker/generate-prompt", {
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
            forceWalkerState: newState,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setPrompt(data.data.prompt);
          setEditedPrompt(data.data.prompt);
          setLocalEditedPrompt(data.data.prompt);
        } else {
          setError(data.error?.message || "Failed to regenerate prompt");
        }
      } catch (err) {
        setError("Network error. Please try again.");
        console.error("[Walker]", err);
      } finally {
        setIsGeneratingPrompt(false);
      }
    }
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(editedPrompt || prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Start new session
  const handleNewSession = () => {
    currentSessionIdRef.current = null;
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
    setLocalEditedPrompt("");
    setChinesePrompt("");
    setVideoPrompt("");
    setImages([]);
    setError("");
    shouldStopRef.current = false;
    setCurrentImageIndex(0);
    promptVersionsRef.current = [];
    setPromptVersions([]);
    setCurrentVersionNumber(0);
    setWalkerState("IN_USE");
    setReferenceImageUrl("");
    setCreativeName("");
  };

  // Translate prompt
  const handleTranslatePrompt = async () => {
    if (!editedPrompt) return;
    setIsTranslating(true);

    try {
      const response = await fetch("/api/translate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editedPrompt }),
      });

      const data = await response.json();
      if (data.success) {
        setChinesePrompt(data.data.translatedPrompt);
      }
    } catch (err) {
      console.error("[Walker] Translation error:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Generate video prompt
  const handleGenerateVideoPrompt = async () => {
    if (!editedPrompt) return;
    setIsGeneratingVideoPrompt(true);

    try {
      const response = await fetch("/api/generate-video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editedPrompt }),
      });

      const data = await response.json();
      if (data.success) {
        setVideoPrompt(data.data.videoPrompt);
      }
    } catch (err) {
      console.error("[Walker] Video prompt error:", err);
    } finally {
      setIsGeneratingVideoPrompt(false);
    }
  };

  // Create Walker session with cloud sync
  const createWalkerSession = async (totalImages: number): Promise<string | null> => {
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
          product_type: "walker",
          product_state: walkerState,
          reference_image_url: referenceImageUrl,
          total_images: totalImages,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.session?.id) {
        const newSessionId = data.data.session.id;
        currentSessionIdRef.current = newSessionId;
        setCurrentSessionId(newSessionId);
        console.log(`[Walker] Created session: ${newSessionId}`);
        return newSessionId;
      } else {
        console.error("[Walker] Failed to create session:", data.error);
        return null;
      }
    } catch (err) {
      console.error("[Walker] Session creation error:", err);
      return null;
    }
  };

  // Generate Walker images
  const handleGenerateImages = async (startIndex: number = 0, endIndex: number = 20) => {
    if (!editedPrompt || !referenceImageUrl || !creativeName) {
      setError("请先生成 Prompt");
      return;
    }

    setIsGeneratingImages(true);
    setError("");
    shouldStopRef.current = false;

    // Initialize images array
    const totalToGenerate = endIndex - startIndex;
    const initialImages: GeneratedImage[] = Array.from({ length: totalToGenerate }, (_, i) => ({
      id: `walker-img-${startIndex + i}-${Date.now()}`,
      url: "",
      storageUrl: null,
      selected: false,
      rating: 0,
      status: "pending" as const,
      aspectRatio,
      resolution,
      promptVersion: currentVersionNumber,
    }));
    setImages(initialImages);
    setStep("generate");

    // Create session if not exists
    let activeSessionId = currentSessionIdRef.current;
    if (!activeSessionId) {
      activeSessionId = await createWalkerSession(endIndex);
    }

    // Generate images sequentially
    for (let i = startIndex; i < endIndex; i++) {
      if (shouldStopRef.current) {
        console.log("[Walker] Generation stopped by user");
        break;
      }

      const localIndex = i - startIndex;
      setCurrentImageIndex(localIndex);

      // Update status to generating
      setImages((prev) =>
        prev.map((img, idx) =>
          idx === localIndex ? { ...img, status: "generating" as const } : img
        )
      );

      try {
        const response = await fetch("/api/walker/generate-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: editedPrompt,
            referenceImageUrl,
            imageIndex: i,
            totalImages: endIndex,
            creativeName,
            sessionId: activeSessionId,
            aspectRatio,
            resolution,
            walkerState,
          }),
        });

        const data = await response.json();

        if (data.success && data.data?.imageUrl) {
          setImages((prev) =>
            prev.map((img, idx) =>
              idx === localIndex
                ? {
                    ...img,
                    url: data.data.imageUrl,
                    storageUrl: data.data.storageUrl,
                    status: "success" as const,
                  }
                : img
            )
          );
        } else {
          setImages((prev) =>
            prev.map((img, idx) =>
              idx === localIndex ? { ...img, status: "failed" as const } : img
            )
          );
          console.error(`[Walker] Image ${i + 1} failed:`, data.error);
        }
      } catch (err) {
        setImages((prev) =>
          prev.map((img, idx) =>
            idx === localIndex ? { ...img, status: "failed" as const } : img
          )
        );
        console.error(`[Walker] Image ${i + 1} error:`, err);
      }

      // Add delay between requests
      if (i < endIndex - 1 && !shouldStopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
      }
    }

    setIsGeneratingImages(false);
  };

  // Stop generation
  const handleStopGeneration = () => {
    shouldStopRef.current = true;
    setIsGeneratingImages(false);
  };

  // Open lightbox
  const handleImageClick = (index: number) => {
    const successImages = images.filter((img) => img.status === "success");
    const successIndex = successImages.findIndex(
      (img) => img.id === images.filter((i) => i.status === "success")[index]?.id
    );
    if (successIndex >= 0) {
      setLightboxIndex(successIndex);
      setLightboxOpen(true);
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Footprints className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Walker 创意工作台</h1>
              <p className="text-sm text-muted-foreground">
                Standard Walker (两轮助行器) 广告创意生成
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleNewSession}>
            <Plus className="mr-2 h-4 w-4" />
            新建创意
          </Button>
        </div>

        {/* Workflow Steps */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              step === "select" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <span className="font-medium">1. 选择场景</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              step === "prompt" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <span className="font-medium">2. 生成Prompt</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              step === "generate" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <span className="font-medium">3. 生成图片</span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Step Content */}
        {step === "select" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Footprints className="h-5 w-5" />
                Walker ABCD 场景选择
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                选择场景分类、细节、动作、情感驱动和格式，为 Standard Walker (两轮助行器) 生成创意
              </p>
            </CardHeader>
            <CardContent>
              <ABCDSelector
                onSelectionChange={setSelection}
                initialSelection={selection}
              />
              <div className="mt-6 flex justify-end">
                <Button
                  size="lg"
                  onClick={handleGeneratePrompt}
                  disabled={!isSelectionComplete || isGeneratingPrompt}
                >
                  {isGeneratingPrompt ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      生成 Walker Prompt
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "prompt" && (
          <div className="space-y-6">
            {/* Naming Card */}
            <NamingCard selection={selection} />

            {/* Walker State Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Footprints className="h-5 w-5" />
                  Walker 状态
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Standard Walker 可以是使用中或存放状态
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    variant={walkerState === "IN_USE" ? "default" : "outline"}
                    onClick={() => handleWalkerStateChange("IN_USE")}
                    className="flex-1"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    使用中 (IN_USE)
                  </Button>
                  <Button
                    variant={walkerState === "STORED" ? "default" : "outline"}
                    onClick={() => handleWalkerStateChange("STORED")}
                    className="flex-1"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    存放 (STORED)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* English Prompt */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    Walker Prompt (英文)
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTranslatePrompt}
                      disabled={isTranslating}
                    >
                      {isTranslating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Languages className="mr-2 h-4 w-4" />
                      )}
                      翻译为中文
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={localEditedPrompt}
                  onChange={handleEditedPromptChange}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="生成的 Walker 广告 Prompt 将显示在这里..."
                />
              </CardContent>
            </Card>

            {/* Chinese Translation */}
            {chinesePrompt && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="h-5 w-5" />
                    中文翻译
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={chinesePrompt}
                    readOnly
                    className="min-h-[150px] font-mono text-sm bg-muted"
                  />
                </CardContent>
              </Card>
            )}

            {/* Video Prompt */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5" />
                    视频 Prompt
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateVideoPrompt}
                    disabled={isGeneratingVideoPrompt || !editedPrompt}
                  >
                    {isGeneratingVideoPrompt ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Film className="mr-2 h-4 w-4" />
                    )}
                    生成视频 Prompt
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={videoPrompt}
                  readOnly
                  className="min-h-[100px] font-mono text-sm bg-muted"
                  placeholder="点击上方按钮生成视频 Prompt..."
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("select")}>
                <RotateCcw className="mr-2 h-4 w-4" />
                返回选择
              </Button>
              <Button onClick={() => setStep("generate")} disabled={!editedPrompt}>
                <ImageIcon className="mr-2 h-4 w-4" />
                进入图片生成
              </Button>
            </div>
          </div>
        )}

        {step === "generate" && (
          <div className="space-y-6">
            {/* Prompt Panel */}
            <Card>
              <CardHeader className="cursor-pointer" onClick={togglePromptPanel}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    当前 Walker Prompt
                  </CardTitle>
                  {isPromptPanelOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {isPromptPanelOpen && (
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {editedPrompt || prompt}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep("prompt")}>
                      <Pencil className="mr-2 h-4 w-4" />
                      编辑 Prompt
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Image Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  图片设置
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">宽高比</label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio} value={ratio}>
                            {ratio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">分辨率</label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTIONS.map((res) => (
                          <SelectItem key={res} value={res}>
                            {res}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generation Controls */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Footprints className="h-5 w-5" />
                    Walker 图片生成
                  </CardTitle>
                  <div className="flex gap-2">
                    {isGeneratingImages ? (
                      <Button variant="destructive" onClick={handleStopGeneration}>
                        <StopCircle className="mr-2 h-4 w-4" />
                        停止生成
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleGenerateImages(0, 4)}
                          disabled={!editedPrompt}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          生成 4 张
                        </Button>
                        <Button
                          onClick={() => handleGenerateImages(0, 20)}
                          disabled={!editedPrompt}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          生成 20 张
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isGeneratingImages && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      正在生成第 {currentImageIndex + 1} 张图片...
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{
                          width: `${((images.filter((i) => i.status === "success").length) / images.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Footprints className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">准备生成 Walker 广告图片</p>
                    <p className="text-sm mt-2">
                      点击上方按钮开始生成 Standard Walker 广告图片
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        className={cn(
                          "relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all",
                          image.status === "success"
                            ? "border-green-500"
                            : image.status === "generating"
                            ? "border-primary animate-pulse"
                            : image.status === "failed"
                            ? "border-destructive"
                            : "border-muted"
                        )}
                        onClick={() => image.status === "success" && handleImageClick(index)}
                      >
                        {image.status === "success" && image.url ? (
                          <img
                            src={image.url}
                            alt={`Walker 图片 ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : image.status === "generating" ? (
                          <div className="flex items-center justify-center h-full bg-muted">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : image.status === "failed" ? (
                          <div className="flex flex-col items-center justify-center h-full bg-destructive/10">
                            <RefreshCw className="h-6 w-6 text-destructive" />
                            <span className="text-xs mt-1 text-destructive">失败</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full bg-muted">
                            <span className="text-sm text-muted-foreground">{index + 1}</span>
                          </div>
                        )}
                        {image.status === "success" && (
                          <div className="absolute top-2 right-2">
                            <ZoomIn className="h-4 w-4 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Right Sidebar - Session History (hidden for now) */}
      {/* <SessionList sessions={sessions} onSelect={handleSessionSelect} /> */}

      {/* Image Lightbox */}
      <ImageLightbox
        images={images
          .filter((img) => img.status === "success")
          .map((img) => ({
            id: img.id,
            url: img.url,
            storageUrl: img.storageUrl,
            rating: img.rating,
          }))}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onRatingChange={(id, rating) => {
          setImages((prev) =>
            prev.map((img) => (img.id === id ? { ...img, rating } : img))
          );
        }}
        onNavigate={(index) => setLightboxIndex(index)}
      />
    </div>
  );
}

// Helper component for step indicator
function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
