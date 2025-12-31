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

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

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

  // Load sessions from API (filter by product_type=walker)
  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const response = await fetch("/api/sessions?product_type=walker");
      const data = await response.json();
      if (data.success) {
        setSessions(data.data.sessions || []);
      }
    } catch (err) {
      console.error("[Walker] Failed to load sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Load versions from cloud (called when loading a session)
  const loadVersionsFromCloud = async (sessionId: string): Promise<PromptVersion[]> => {
    try {
      console.log(`[Walker] Loading versions for session ${sessionId}...`);
      const response = await fetch(`/api/sessions/${sessionId}/versions`);
      const data = await response.json();

      if (data.success && data.data?.versions) {
        const cloudVersions: PromptVersion[] = data.data.versions.map((v: any) => ({
          id: `v${v.version_number}-${Date.now()}`,
          version: v.version_number,
          englishPrompt: v.prompt,
          chinesePrompt: v.prompt_chinese || "",
          videoPrompt: v.video_prompt || "",
          createdAt: v.created_at,
          cloudId: v.id,
          synced: true,
        }));
        console.log(`[Walker] Loaded ${cloudVersions.length} versions from cloud`);
        return cloudVersions;
      }

      console.warn(`[Walker] No versions found`);
      return [];
    } catch (err) {
      console.error("[Walker] Failed to load versions:", err);
      return [];
    }
  };

  // Load a session
  const handleSessionSelect = async (session: SessionSummary) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}`);
      const data = await response.json();

      if (data.success) {
        const sessionDetail = data.data;

        // CRITICAL: Update ref immediately, then state
        currentSessionIdRef.current = session.id;
        setCurrentSessionId(session.id);
        console.log(`[Walker] Loading session: ${session.id}`);

        setSelection({
          sceneCategory: sessionDetail.abcd_selection.A1,
          sceneDetail: sessionDetail.abcd_selection.A2,
          action: sessionDetail.abcd_selection.B,
          driver: sessionDetail.abcd_selection.C,
          format: sessionDetail.abcd_selection.D,
        });
        setPrompt(sessionDetail.prompt);
        setEditedPrompt(sessionDetail.prompt);
        setLocalEditedPrompt(sessionDetail.prompt);
        setWalkerState(sessionDetail.product_state as WalkerState);
        setReferenceImageUrl(sessionDetail.reference_image_url);
        setCreativeName(sessionDetail.creative_name);

        // Load prompt versions from cloud FIRST (needed for image-version mapping)
        const cloudVersions = await loadVersionsFromCloud(session.id);

        // Map images with version information
        console.log(`[Walker] Session has ${sessionDetail.images.length} images in database`);
        const restoredImages: GeneratedImage[] = sessionDetail.images.map((img: any) => {
          let promptVersionNumber: number | undefined;
          if (img.prompt_version_id && cloudVersions.length > 0) {
            const version = cloudVersions.find(v => v.cloudId === img.prompt_version_id);
            promptVersionNumber = version?.version;
          }
          return {
            id: img.id,
            url: img.storage_url || "",
            storageUrl: img.storage_url || null,
            selected: false,
            rating: img.rating || 0,
            status: img.status === "success" ? "success" : img.status === "failed" ? "failed" : "pending",
            aspectRatio: img.aspect_ratio || undefined,
            resolution: img.resolution || undefined,
            promptVersion: promptVersionNumber,
          };
        });

        setImages(restoredImages);

        if (cloudVersions.length > 0) {
          promptVersionsRef.current = cloudVersions;
          setPromptVersions(cloudVersions);
          const activeVersion = cloudVersions.find(v => v.synced) || cloudVersions[cloudVersions.length - 1];
          setEditedPrompt(activeVersion.englishPrompt);
          setLocalEditedPrompt(activeVersion.englishPrompt);
          setChinesePrompt(activeVersion.chinesePrompt || "");
          setVideoPrompt(activeVersion.videoPrompt || "");
          setCurrentVersionNumber(activeVersion.version);
        }

        // Determine step based on data
        if (restoredImages.length > 0) {
          setStep("generate");
        } else if (sessionDetail.prompt) {
          setStep("prompt");
        } else {
          setStep("select");
        }
      }
    } catch (err) {
      console.error("[Walker] Failed to load session:", err);
      setError("加载会话失败");
    }
  };

  // Delete a session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        if (currentSessionId === sessionId) {
          handleNewSession();
        }
        await loadSessions();
      } else {
        console.error("[Walker] Failed to delete session:", data.error?.message);
      }
    } catch (err) {
      console.error("[Walker] Failed to delete session:", err);
    }
  };

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

  // Create a new prompt version for current session
  const createPromptVersion = (englishText: string, chineseText: string = ""): number => {
    const newVersionNumber = promptVersionsRef.current.length + 1;

    const newVersion: PromptVersion = {
      id: `v${newVersionNumber}-${Date.now()}`,
      version: newVersionNumber,
      englishPrompt: englishText,
      chinesePrompt: chineseText,
      videoPrompt: "",
      createdAt: new Date().toISOString(),
    };

    promptVersionsRef.current = [...promptVersionsRef.current, newVersion];
    setPromptVersions(prev => [...prev, newVersion]);
    setCurrentVersionNumber(newVersionNumber);
    setVideoPrompt("");

    console.log(`[Walker] Created version V${newVersionNumber}`);
    return newVersionNumber;
  };

  // Update Chinese translation for a specific version
  const updateVersionChinesePrompt = (versionNumber: number, chineseText: string) => {
    if (versionNumber <= 0) return;
    promptVersionsRef.current = promptVersionsRef.current.map(v =>
      v.version === versionNumber ? { ...v, chinesePrompt: chineseText } : v
    );
    setPromptVersions(prev =>
      prev.map(v => v.version === versionNumber ? { ...v, chinesePrompt: chineseText } : v)
    );
  };

  // Switch to a different prompt version
  const switchToVersion = (versionNumber: number) => {
    const version = promptVersions.find(v => v.version === versionNumber);
    if (version) {
      setCurrentVersionNumber(versionNumber);
      setEditedPrompt(version.englishPrompt);
      setLocalEditedPrompt(version.englishPrompt);
      setPrompt(version.englishPrompt);
      setChinesePrompt(version.chinesePrompt);
      setVideoPrompt(version.videoPrompt || "");
    }
  };

  // Background translation helper
  const translatePromptInBackground = async (promptText: string, versionNumber: number) => {
    setIsTranslating(true);
    setChinesePrompt("");
    console.log(`[Walker] Starting translation for V${versionNumber}...`);
    try {
      const response = await fetch("/api/translate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await response.json();
      if (data.success) {
        const translatedText = data.data.translatedPrompt;
        setChinesePrompt(translatedText);
        updateVersionChinesePrompt(versionNumber, translatedText);
        console.log(`[Walker] V${versionNumber} translated`);
      }
    } catch (err) {
      console.error("[Walker] Background translation failed:", err);
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
          productState: walkerState,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const refinedPrompt = data.data.refinedPrompt;
        setPrompt(refinedPrompt);
        setEditedPrompt(refinedPrompt);
        setLocalEditedPrompt(refinedPrompt);
        setRefinementInput("");
        setLocalRefinementInput("");

        // Create new version
        const newVersionNumber = createPromptVersion(refinedPrompt);

        // Start translation
        translatePromptInBackground(refinedPrompt, newVersionNumber);
      } else {
        setError(data.error?.message || "Failed to refine prompt");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("[Walker]", err);
    } finally {
      setIsRefining(false);
    }
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
        await loadSessions();
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
    await loadSessions();
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

  // Delete image
  const handleDeleteImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Toggle image selection
  const toggleImageSelection = (id: string) => {
    startTransition(() => {
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, selected: !img.selected } : img
      ));
    });
  };

  // Handle rating change - with database persistence
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
      console.error('[Walker] Failed to save rating:', error);
    }
  }, []);

  // Computed values
  const successfulImages = useMemo(() =>
    images.filter(img => img.status === "success" && img.url),
    [images]
  );

  const imageIdToLightboxIndex = useMemo(() => {
    const map = new Map<string, number>();
    successfulImages.forEach((img, idx) => map.set(img.id, idx));
    return map;
  }, [successfulImages]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Footprints className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Walker 创意工作台</h1>
            <p className="text-muted-foreground">
              Standard Walker (两轮助行器) 广告创意生成
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full ${step === "select" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1. 选择
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "prompt" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2. Prompt
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "generate" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3. 生成
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
                {isGeneratingPrompt ? "生成中..." : "预览 Prompt"}
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
                重新开始
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Prompt Preview or Gallery */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Preview Step */}
          {step === "prompt" && (
            <div className="space-y-6">
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
                <CardContent className="space-y-4">
                  {/* Version Selector */}
                  {promptVersions.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <History className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Prompt 版本</span>
                      <div className="flex gap-1 flex-wrap">
                        {promptVersions.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => switchToVersion(v.version)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium transition-all",
                              currentVersionNumber === v.version
                                ? "bg-amber-600 text-white"
                                : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800"
                            )}
                          >
                            V{v.version}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">
                        当前: V{currentVersionNumber}
                      </span>
                    </div>
                  )}

                  <Textarea
                    value={localEditedPrompt}
                    onChange={handleEditedPromptChange}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="生成的 Walker 广告 Prompt 将显示在这里..."
                  />

                  {/* Prompt Refinement */}
                  <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 className="h-4 w-4 text-purple-500" />
                      <label className="text-sm font-medium">AI Prompt 微调</label>
                      <span className="text-xs text-muted-foreground">输入修改建议，AI 将自动调整 Prompt</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={localRefinementInput}
                        onChange={handleRefinementInputChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isRefining && localRefinementInput.trim()) {
                            setRefinementInput(localRefinementInput);
                            handleRefinePrompt();
                          }
                        }}
                        placeholder="例如：我希望场景更加温馨..."
                        className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        disabled={isRefining || !editedPrompt}
                      />
                      <Button
                        onClick={handleRefinePrompt}
                        disabled={isRefining || !localRefinementInput.trim() || !editedPrompt}
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

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("select")}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  返回选择
                </Button>
                <Button onClick={() => handleGenerateImages(0, 4)} disabled={!editedPrompt}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成 4 张图片
                </Button>
              </div>
            </div>
          )}

          {/* Generate Step */}
          {step === "generate" && (
            <div className="space-y-6">
              {/* Prompt Panel (collapsible) */}
              <Card>
                <CardHeader className="cursor-pointer" onClick={togglePromptPanel}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5" />
                      当前 Prompt
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
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
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

              {/* Generation Controls */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Footprints className="h-5 w-5" />
                      Walker 图片生成
                      {isGeneratingImages && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({currentImageIndex + 1}/{images.length})
                        </span>
                      )}
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
                            onClick={() => handleGenerateImages(images.length, images.length + 4)}
                            disabled={!editedPrompt}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            生成 4 张
                          </Button>
                          <Button
                            onClick={() => handleGenerateImages(images.length, images.length + 20)}
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
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                  <div className="grid grid-cols-4 gap-3">
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        className={cn(
                          "group relative aspect-square rounded-lg overflow-hidden transition-all cursor-pointer border-2",
                          image.status === "success"
                            ? "border-transparent hover:border-primary"
                            : image.status === "generating"
                            ? "border-primary animate-pulse"
                            : image.status === "failed"
                            ? "border-destructive"
                            : "border-muted"
                        )}
                      >
                        {/* Pending state */}
                        {image.status === "pending" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted">
                            <span className="text-2xl font-bold text-muted-foreground/50">{index + 1}</span>
                          </div>
                        )}

                        {/* Generating state */}
                        {image.status === "generating" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        )}

                        {/* Success state */}
                        {image.status === "success" && image.url && (
                          <>
                            <img
                              src={image.url}
                              alt={`Walker 图片 ${index + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onClick={() => {
                                const lightboxIdx = imageIdToLightboxIndex.get(image.id) ?? 0;
                                openLightbox(lightboxIdx);
                              }}
                            />
                            {/* Selection checkbox */}
                            <button
                              className={cn(
                                "absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center z-20 transition-all",
                                image.selected
                                  ? "bg-primary shadow-lg"
                                  : "bg-black/30 hover:bg-black/50 border-2 border-white/80"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleImageSelection(image.id);
                              }}
                              title={image.selected ? "取消选择" : "选择图片"}
                            >
                              {image.selected && <Check className="h-4 w-4 text-white" />}
                            </button>
                            {/* Version badge */}
                            {image.promptVersion && (
                              <div className="absolute bottom-10 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 backdrop-blur-sm text-white z-10">
                                V{image.promptVersion}
                              </div>
                            )}
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            {/* Action buttons on hover */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                            <span className="text-sm text-red-500 font-medium">失败</span>
                            <span className="text-[10px] text-muted-foreground mt-1">点击重试</span>
                          </div>
                        )}

                        {/* Star rating badge */}
                        {image.rating > 0 && (
                          <div className="absolute top-2 left-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 z-10">
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
                          {image.storageUrl && (
                            <div className="bg-green-500/90 text-white p-1 rounded-full" title="已保存到云端">
                              <Cloud className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {images.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>尚未生成图片</p>
                      <p className="text-sm">点击上方按钮开始生成</p>
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
                <Footprints className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">准备创作</p>
                <p className="text-sm">完成左侧 ABCD 选择，然后点击预览 Prompt</p>
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
