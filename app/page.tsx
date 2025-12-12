"use client";

import { useState, useCallback, useEffect, useRef, useTransition, useMemo, memo } from "react";
import { Sparkles, Eye, ImageIcon, RefreshCw, Copy, Check, Loader2, StopCircle, Cloud, Play, Pause, Star, Plus, Download, ZoomIn, Trash2, ChevronDown, ChevronUp, Pencil, Wand2, Send, Languages, History, RotateCcw, Film } from "lucide-react";
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

// Prompt Version for tracking history (per session)
// Compatible with cloud storage in prompt_versions table
interface PromptVersion {
  id: string;
  version: number;
  englishPrompt: string;
  chinesePrompt: string;
  videoPrompt: string;  // Video generation prompt
  createdAt: string;
  // Cloud sync fields
  cloudId?: string; // UUID from Supabase prompt_versions table
  synced?: boolean; // Whether this version has been synced to cloud
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
  promptVersion?: number; // Track which version generated this image
}

// LocalStorage keys
const STORAGE_KEY_PROMPT_VERSIONS = "rolloy_prompt_versions"; // Current session's versions
const STORAGE_KEY_IMAGES = "rolloy_generated_images";
const STORAGE_KEY_SESSION_DATA = "rolloy_session_data";

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

  // Video prompt state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [isGeneratingVideoPrompt, setIsGeneratingVideoPrompt] = useState(false);

  // Prompt version management - per session (simple array)
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [currentVersionNumber, setCurrentVersionNumber] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);

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

  // Load persisted data from localStorage on mount
  useEffect(() => {
    try {
      // Clean up old localStorage keys from previous versions
      localStorage.removeItem("rolloy_prompt_versions"); // Old global versions key
      localStorage.removeItem("rolloy_current_version"); // Old current version key

      // Clean up old localStorage keys
      localStorage.removeItem("rolloy_scenario_versions");
      localStorage.removeItem("rolloy_current_scenario");

      const savedVersions = localStorage.getItem(STORAGE_KEY_PROMPT_VERSIONS);
      const savedImages = localStorage.getItem(STORAGE_KEY_IMAGES);
      const savedSessionData = localStorage.getItem(STORAGE_KEY_SESSION_DATA);

      console.log("Loading persisted data:", { savedVersions: !!savedVersions, savedImages: !!savedImages, savedSessionData: !!savedSessionData });

      // Restore session data (selection, productState, etc.)
      if (savedSessionData) {
        const sessionData = JSON.parse(savedSessionData);
        console.log("Restoring session data:", {
          hasSelection: !!sessionData.selection,
          selection: sessionData.selection,
          productState: sessionData.productState,
          creativeName: sessionData.creativeName,
        });
        if (sessionData.selection) setSelection(sessionData.selection);
        if (sessionData.productState) setProductState(sessionData.productState);
        if (sessionData.referenceImageUrl) setReferenceImageUrl(sessionData.referenceImageUrl);
        if (sessionData.creativeName) setCreativeName(sessionData.creativeName);
        if (sessionData.aspectRatio) setAspectRatio(sessionData.aspectRatio);
        if (sessionData.resolution) setResolution(sessionData.resolution);
        if (sessionData.currentVersionNumber) setCurrentVersionNumber(sessionData.currentVersionNumber);
      } else {
        console.log("No saved session data found in localStorage");
      }

      // Restore prompt versions for current session
      if (savedVersions) {
        const versions = JSON.parse(savedVersions) as PromptVersion[];
        setPromptVersions(versions);
        console.log("Loaded prompt versions:", versions.length);

        if (versions.length > 0) {
          const savedVersionNum = savedSessionData ? JSON.parse(savedSessionData).currentVersionNumber : versions.length;
          const currentVersion = versions.find(v => v.version === savedVersionNum) || versions[versions.length - 1];
          if (currentVersion) {
            console.log("Restoring version:", currentVersion.version);
            setEditedPrompt(currentVersion.englishPrompt);
            setPrompt(currentVersion.englishPrompt);
            setChinesePrompt(currentVersion.chinesePrompt || "");
            setVideoPrompt(currentVersion.videoPrompt || "");
            setCurrentVersionNumber(currentVersion.version);
            setStep("prompt");
          }
        }
      }

      if (savedImages) {
        const imgs = JSON.parse(savedImages) as GeneratedImage[];
        setImages(imgs);
        if (imgs.length > 0) {
          setStep("generate");
        }
      }
    } catch (err) {
      console.error("Failed to load persisted data:", err);
    }
  }, []);

  // Persist prompt versions to localStorage
  useEffect(() => {
    if (promptVersions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_PROMPT_VERSIONS, JSON.stringify(promptVersions));
      } catch (err) {
        console.warn("Failed to save prompt versions:", err);
      }
    }
  }, [promptVersions]);

  // Persist images to localStorage (only save metadata, not base64 data)
  useEffect(() => {
    if (images.length > 0) {
      try {
        // Only save images that have been uploaded to cloud storage
        // Exclude large base64 URLs to avoid quota exceeded errors
        const imagesToSave = images
          .filter(img => img.storageUrl) // Only save images with cloud URLs
          .map(img => ({
            ...img,
            url: img.storageUrl || "", // Use storageUrl instead of base64
          }));

        if (imagesToSave.length > 0) {
          localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(imagesToSave));
        }
      } catch (err) {
        console.warn("Failed to save images to localStorage:", err);
        // If quota exceeded, clear old images
        if (err instanceof Error && err.name === "QuotaExceededError") {
          localStorage.removeItem(STORAGE_KEY_IMAGES);
        }
      }
    }
  }, [images]);

  // Persist session data (selection, productState, currentVersionNumber, etc.)
  useEffect(() => {
    if (selection.sceneCategory || productState || creativeName) {
      try {
        const sessionData = {
          selection,
          productState,
          referenceImageUrl,
          creativeName,
          aspectRatio,
          resolution,
          currentVersionNumber,
        };
        localStorage.setItem(STORAGE_KEY_SESSION_DATA, JSON.stringify(sessionData));
      } catch (err) {
        console.warn("Failed to save session data:", err);
      }
    }
  }, [selection, productState, referenceImageUrl, creativeName, aspectRatio, resolution, currentVersionNumber]);

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
      // Validate required fields before making request
      const sessionName = creativeName || `Creative_${Date.now()}`;
      const sessionPrompt = editedPrompt || prompt;

      console.log("Creating session with:", {
        sessionName,
        hasPrompt: !!sessionPrompt,
        selection,
        productState,
      });

      if (!sessionPrompt) {
        console.error("Cannot create session: no prompt available");
        setError("请先生成Prompt再生成图片");
        return null;
      }

      // Check which selection fields are missing
      const missingFields = [];
      if (!selection.sceneCategory) missingFields.push("Scene Category");
      if (!selection.sceneDetail) missingFields.push("Scene Detail");
      if (!selection.action) missingFields.push("Action");
      if (!selection.driver) missingFields.push("Driver");
      if (!selection.format) missingFields.push("Format");

      if (missingFields.length > 0) {
        console.error("Cannot create session: incomplete selection", { selection, missingFields });
        setError(`请先完成ABCD选择，缺少: ${missingFields.join(", ")}`);
        return null;
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creative_name: sessionName,
          abcd_selection: {
            A1: selection.sceneCategory,
            A2: selection.sceneDetail,
            B: selection.action,
            C: selection.driver,
            D: selection.format,
          },
          prompt: sessionPrompt,
          product_state: productState || "UNFOLDED",
          reference_image_url: referenceImageUrl,
          total_images: totalImages,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCurrentSessionId(data.data.session.id);
        await loadSessions();
        return data.data.session.id;
      } else {
        console.error("Session creation failed:", data.error);
        setError(data.error?.message || "创建会话失败");
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

        // Load prompt versions from cloud FIRST (needed for image-version mapping)
        const cloudVersions = await loadVersionsFromCloud(session.id);

        // Map images with version information
        console.log(`[loadSession] Session has ${sessionDetail.images.length} images in database`);
        const restoredImages: GeneratedImage[] = sessionDetail.images.map((img: any) => {
          // Find version number from cloudVersions using prompt_version_id
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

        // Log image details for debugging
        const successImages = restoredImages.filter(img => img.status === "success" && img.storageUrl);
        console.log(`[loadSession] Images breakdown:`);
        console.log(`  - Total: ${restoredImages.length}`);
        console.log(`  - Success with URL: ${successImages.length}`);
        restoredImages.forEach((img, i) => {
          console.log(`  - #${i+1}: status=${img.status}, hasUrl=${!!img.storageUrl}, version=V${img.promptVersion || '?'}`);
        });

        setImages(restoredImages);

        if (cloudVersions.length > 0) {
          setPromptVersions(cloudVersions);
          // Find active version or use latest
          const activeVersion = cloudVersions.find(v => v.synced) || cloudVersions[cloudVersions.length - 1];
          setCurrentVersionNumber(activeVersion.version);
          setEditedPrompt(activeVersion.englishPrompt);
          setPrompt(activeVersion.englishPrompt);
          setChinesePrompt(activeVersion.chinesePrompt);
          setVideoPrompt(activeVersion.videoPrompt || "");
          console.log(`Restored ${cloudVersions.length} versions from cloud, active: V${activeVersion.version}`);
        } else {
          // Fallback: create V1 from session prompt if no cloud versions
          const fallbackVersion: PromptVersion = {
            id: `v1-${Date.now()}`,
            version: 1,
            englishPrompt: sessionDetail.prompt,
            chinesePrompt: "",
            videoPrompt: "",
            createdAt: sessionDetail.created_at,
            synced: false,
          };
          setPromptVersions([fallbackVersion]);
          setCurrentVersionNumber(1);
          setVideoPrompt("");
          console.log("No cloud versions found, created fallback V1");
        }

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
    setChinesePrompt("");
    setVideoPrompt("");
    setImages([]);
    setError("");
    shouldStopRef.current = false;
    setCurrentImageIndex(0);
    setPromptVersions([]);
    setCurrentVersionNumber(0);
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

  // Create a new prompt version for current session
  const createPromptVersion = (englishText: string, chineseText: string = ""): number => {
    const newVersionNumber = promptVersions.length + 1;

    const newVersion: PromptVersion = {
      id: `v${newVersionNumber}-${Date.now()}`,
      version: newVersionNumber,
      englishPrompt: englishText,
      chinesePrompt: chineseText,
      videoPrompt: "",  // New versions start without video prompt
      createdAt: new Date().toISOString(),
    };

    setPromptVersions(prev => [...prev, newVersion]);
    setCurrentVersionNumber(newVersionNumber);
    setVideoPrompt("");  // Clear video prompt for new version

    console.log(`Created version V${newVersionNumber}`);
    return newVersionNumber;
  };

  // Update Chinese translation for a specific version
  const updateVersionChinesePrompt = (versionNumber: number, chineseText: string) => {
    if (versionNumber <= 0) return;
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
      setPrompt(version.englishPrompt);
      setChinesePrompt(version.chinesePrompt);
      setVideoPrompt(version.videoPrompt || "");
    }
  };

  // ============================================================================
  // Cloud Sync Functions - Save versions to Supabase for cross-device access
  // ============================================================================

  // Save a prompt version to cloud (called after session is created)
  // IMPORTANT: Pass versionNumber so we can update state with cloudId
  const syncVersionToCloud = async (
    sessionId: string,
    versionData: {
      prompt: string;
      prompt_chinese?: string;
      video_prompt?: string;
      product_state: string;
      reference_image_url: string;
      created_from: "initial" | "refinement" | "product_state_change";
      refinement_instruction?: string;
    },
    versionNumber?: number
  ): Promise<string | null> => {
    try {
      console.log(`[syncVersionToCloud] Syncing V${versionNumber} to session ${sessionId}...`);
      console.log(`[syncVersionToCloud] Data:`, JSON.stringify(versionData, null, 2));

      const response = await fetch(`/api/sessions/${sessionId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(versionData),
      });
      const data = await response.json();

      if (data.success && data.data?.version?.id) {
        const cloudId = data.data.version.id;
        const syncedVersionNumber = data.data.version_number || versionNumber;
        console.log(`[syncVersionToCloud] SUCCESS: V${syncedVersionNumber} synced with cloudId: ${cloudId}`);

        // CRITICAL FIX: Update local state with cloudId so that
        // updateCloudVersionChinese and updateCloudVersionVideoPrompt can find it
        if (syncedVersionNumber) {
          setPromptVersions(prev => prev.map(v =>
            v.version === syncedVersionNumber
              ? { ...v, cloudId, synced: true }
              : v
          ));
        }

        return cloudId;
      }

      // IMPORTANT: Show error to user, not just console
      const errorMsg = data.error?.message || data.error?.details || "Unknown error";
      console.error(`[syncVersionToCloud] FAILED: ${errorMsg}`, data.error);
      setError(`版本保存失败: ${errorMsg}`);
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      console.error("[syncVersionToCloud] EXCEPTION:", err);
      setError(`版本保存失败: ${errorMsg}`);
      return null;
    }
  };

  // Load versions from cloud (called when loading a session)
  const loadVersionsFromCloud = async (sessionId: string): Promise<PromptVersion[]> => {
    try {
      console.log(`[loadVersionsFromCloud] Loading versions for session ${sessionId}...`);
      const response = await fetch(`/api/sessions/${sessionId}/versions`);
      const data = await response.json();

      if (data.success && data.data?.versions) {
        // Convert cloud format to local format
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
        console.log(`[loadVersionsFromCloud] SUCCESS: Loaded ${cloudVersions.length} versions`);
        cloudVersions.forEach(v => {
          console.log(`  - V${v.version}: cloudId=${v.cloudId}, chinese=${v.chinesePrompt ? 'YES' : 'NO'}, video=${v.videoPrompt ? 'YES' : 'NO'}`);
        });
        return cloudVersions;
      }

      console.warn(`[loadVersionsFromCloud] No versions found or error:`, data.error);
      return [];
    } catch (err) {
      console.error("[loadVersionsFromCloud] EXCEPTION:", err);
      return [];
    }
  };

  // Update Chinese translation in cloud (with retry for pending sync)
  const updateCloudVersionChinese = async (
    sessionId: string,
    versionNumber: number,
    chineseText: string,
    retryCount: number = 0
  ) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 1000;

    // Find the cloud version ID from current state
    const version = promptVersions.find(v => v.version === versionNumber);

    if (!version?.cloudId) {
      // cloudId not yet available, retry after delay
      if (retryCount < MAX_RETRIES) {
        console.log(`V${versionNumber} cloudId not ready, retrying in ${RETRY_DELAY_MS}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          updateCloudVersionChinese(sessionId, versionNumber, chineseText, retryCount + 1);
        }, RETRY_DELAY_MS);
        return;
      }
      console.warn(`V${versionNumber} cloudId still not available after ${MAX_RETRIES} retries, giving up`);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/versions/${version.cloudId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_chinese: chineseText }),
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Updated Chinese for V${versionNumber} in cloud`);
      } else {
        console.warn("Failed to update cloud Chinese:", data.error);
      }
    } catch (err) {
      console.error("Failed to update cloud version Chinese:", err);
    }
  };

  // Update video prompt in cloud (with retry for pending sync)
  const updateCloudVersionVideoPrompt = async (
    sessionId: string,
    versionNumber: number,
    videoPromptText: string,
    retryCount: number = 0
  ) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 1000;

    // Find the cloud version ID from current state
    const version = promptVersions.find(v => v.version === versionNumber);

    if (!version?.cloudId) {
      // cloudId not yet available, retry after delay
      if (retryCount < MAX_RETRIES) {
        console.log(`V${versionNumber} cloudId not ready for video prompt, retrying in ${RETRY_DELAY_MS}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          updateCloudVersionVideoPrompt(sessionId, versionNumber, videoPromptText, retryCount + 1);
        }, RETRY_DELAY_MS);
        return;
      }
      console.warn(`V${versionNumber} cloudId still not available after ${MAX_RETRIES} retries, giving up`);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/versions/${version.cloudId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_prompt: videoPromptText }),
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Updated video prompt for V${versionNumber} in cloud`);
      } else {
        console.warn("Failed to update cloud video prompt:", data.error);
      }
    } catch (err) {
      console.error("Failed to update cloud version video prompt:", err);
    }
  };

  // Update version's video prompt locally
  const updateVersionVideoPrompt = (versionNumber: number, videoPromptText: string) => {
    setPromptVersions(prev => prev.map(v =>
      v.version === versionNumber
        ? { ...v, videoPrompt: videoPromptText }
        : v
    ));
  };

  // Handle Generate Video Prompt
  const handleGenerateVideoPrompt = async () => {
    if (!editedPrompt) {
      setError("请先生成或选择一个Prompt");
      return;
    }

    setIsGeneratingVideoPrompt(true);
    setError("");

    try {
      const response = await fetch("/api/generate-video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompt: editedPrompt }),
      });

      const data = await response.json();

      if (data.success) {
        const generatedVideoPrompt = data.data.videoPrompt;
        setVideoPrompt(generatedVideoPrompt);

        // Update the current version's video prompt locally
        updateVersionVideoPrompt(currentVersionNumber, generatedVideoPrompt);

        // Also update in cloud if session exists
        if (currentSessionId) {
          updateCloudVersionVideoPrompt(currentSessionId, currentVersionNumber, generatedVideoPrompt);
        }
      } else {
        setError(data.error?.message || "生成Video Prompt失败");
      }
    } catch (err) {
      setError("网络错误，请重试");
      console.error("Generate video prompt failed:", err);
    } finally {
      setIsGeneratingVideoPrompt(false);
    }
  };

  // Background translation helper - updates existing version's Chinese translation
  const translatePromptInBackground = async (promptText: string, versionNumber: number) => {
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
        const translatedText = data.data.translatedPrompt;
        setChinesePrompt(translatedText);
        // Update the version's Chinese translation locally
        updateVersionChinesePrompt(versionNumber, translatedText);

        // Also update in cloud if session exists
        if (currentSessionId) {
          updateCloudVersionChinese(currentSessionId, versionNumber, translatedText);
        }
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
        const savedInstruction = refinementInput.trim();
        setRefinementInput(""); // Clear input after success

        // Create version FIRST (immediately)
        const newVersionNumber = createPromptVersion(refinedPrompt);

        // Sync to cloud if we have a session, then start translation
        // This ensures cloudId is available before translation completes
        if (currentSessionId) {
          syncVersionToCloud(currentSessionId, {
            prompt: refinedPrompt,
            product_state: productState,
            reference_image_url: referenceImageUrl,
            created_from: "refinement",
            refinement_instruction: savedInstruction,
          }, newVersionNumber).then(cloudId => {
            // syncVersionToCloud updates state with cloudId automatically
            console.log(`V${newVersionNumber} synced to cloud with ID: ${cloudId}`);

            // NOW start translation since we have cloudId
            // This ensures updateCloudVersionChinese will find both sessionId and cloudId
            if (cloudId) {
              console.log(`Starting translation for V${newVersionNumber} now that cloudId is ready`);
              translatePromptInBackground(refinedPrompt, newVersionNumber);
            }
          });
        } else {
          // No session yet, translate immediately (cloud sync will happen later)
          translatePromptInBackground(refinedPrompt, newVersionNumber);
        }
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

        // Clear previous data and start fresh with V1
        setImages([]);

        // Create V1 directly (don't rely on async state update)
        const newVersion: PromptVersion = {
          id: `v1-${Date.now()}`,
          version: 1,
          englishPrompt: generatedPrompt,
          chinesePrompt: "",
          videoPrompt: "",
          createdAt: new Date().toISOString(),
        };
        setPromptVersions([newVersion]); // Replace with single V1
        setCurrentVersionNumber(1);
        setVideoPrompt("");  // Clear video prompt for new version
        console.log("Created version V1 for new session");

        // Start translation immediately for better UX
        // Cloud sync will happen later via retry mechanism when session/cloudId is available
        translatePromptInBackground(generatedPrompt, 1);
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

  // Helper: Ensure current version has cloudId (wait for sync if needed)
  const ensureVersionCloudId = async (sessionId: string, version: PromptVersion): Promise<string | null> => {
    // If already has cloudId, return it
    if (version.cloudId) {
      return version.cloudId;
    }

    // First, try to load existing versions from cloud (in case version already exists)
    console.log(`V${version.version} has no cloudId, checking if it exists in cloud...`);
    const existingVersions = await loadVersionsFromCloud(sessionId);
    const existingVersion = existingVersions.find(v => v.version === version.version);

    if (existingVersion?.cloudId) {
      console.log(`V${version.version} found in cloud with ID: ${existingVersion.cloudId}`);
      // Update local state with cloudId
      setPromptVersions(prev => prev.map(v =>
        v.version === version.version
          ? { ...v, cloudId: existingVersion.cloudId, synced: true }
          : v
      ));
      return existingVersion.cloudId;
    }

    // Version doesn't exist in cloud, create it
    console.log(`V${version.version} not found in cloud, creating...`);

    // syncVersionToCloud now updates state with cloudId automatically
    const cloudId = await syncVersionToCloud(sessionId, {
      prompt: version.englishPrompt,
      prompt_chinese: version.chinesePrompt,
      video_prompt: version.videoPrompt,
      product_state: productState,
      reference_image_url: referenceImageUrl,
      created_from: "initial",
    }, version.version);

    return cloudId;
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

      // Sync V1 to cloud after session is created (use ensureVersionCloudId to avoid duplicates)
      const currentVersion = promptVersions.find(v => v.version === currentVersionNumber);
      if (currentVersion && !currentVersion.cloudId) {
        const versionToSync = currentVersionNumber;
        const englishPrompt = currentVersion.englishPrompt;

        // Use ensureVersionCloudId which checks for existing version first
        ensureVersionCloudId(activeSessionId, currentVersion).then(cloudId => {
          console.log(`V${versionToSync} ensured in cloud with ID: ${cloudId}`);

          // Start translation if not done yet
          if (cloudId && versionToSync === 1 && !currentVersion.chinesePrompt) {
            console.log(`Starting translation for V${versionToSync} now that cloudId is ready`);
            translatePromptInBackground(englishPrompt, versionToSync);
          }
        });
      }
    } else {
      await updateSessionStatus(activeSessionId, "in_progress");
    }

    // IMPORTANT: Ensure current version is synced to cloud before generating images
    // This fixes the bug where V2-V4 images were not saved with version info
    const currentVersion = promptVersions.find(v => v.version === currentVersionNumber);
    let versionCloudId: string | null = null;

    if (currentVersion) {
      versionCloudId = await ensureVersionCloudId(activeSessionId, currentVersion);
      if (!versionCloudId) {
        console.warn(`Failed to sync V${currentVersionNumber} to cloud, images will not be linked to version`);
      }
    }

    // Add pending images for this batch (with current settings and version)
    const newPendingImages: GeneratedImage[] = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `img-${startIndex + i + 1}-${Date.now()}`,
      url: "",
      storageUrl: null,
      selected: false,
      rating: 0,
      status: "pending" as const,
      aspectRatio,
      resolution,
      promptVersion: currentVersionNumber, // Track which version generated this image
    }));
    setImages(prev => [...prev, ...newPendingImages]);

    // Generate single image (returns a promise)
    // versionCloudId is captured here and used for all images in this batch
    const generateSingleImage = async (globalIndex: number) => {
      // Update status to generating
      setImages(prev => prev.map((img, idx) =>
        idx === globalIndex ? { ...img, status: "generating" as const } : img
      ));

      try {
        // Use the versionCloudId that was ensured before batch started

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
            promptVersionId: versionCloudId,
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
                    <button
                      onClick={() => {
                        if (confirm("确定要清除所有Prompt版本和图片历史吗？此操作不可撤销。")) {
                          setPromptVersions([]);
                          setImages([]);
                          setCurrentVersionNumber(0);
                          setEditedPrompt("");
                          setPrompt("");
                          setChinesePrompt("");
                          localStorage.removeItem(STORAGE_KEY_PROMPT_VERSIONS);
                          localStorage.removeItem(STORAGE_KEY_IMAGES);
                          localStorage.removeItem(STORAGE_KEY_SESSION_DATA);
                          setStep("select");
                        }
                      }}
                      className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                      title="清除所有历史"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* English and Chinese Prompt Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  {/* English Prompt (Editable) */}
                  <div>
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      English Prompt (可编辑)
                      {currentVersionNumber > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                          V{currentVersionNumber}
                        </span>
                      )}
                    </label>
                    <Textarea
                      value={editedPrompt}
                      onChange={(e) => {
                        setEditedPrompt(e.target.value);
                        setChinesePrompt(""); // Clear translation when prompt edited
                      }}
                      rows={10}
                      className="font-mono text-sm"
                      placeholder="Edit the prompt here..."
                    />
                  </div>
                  {/* Chinese Translation (Read-only) */}
                  <div>
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      <Languages className="h-4 w-4 text-blue-500" />
                      中文翻译 (仅供阅读)
                      {isTranslating && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                    </label>
                    <div className="h-[240px] p-3 rounded-md border border-input bg-muted/30 overflow-y-auto">
                      {chinesePrompt ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {chinesePrompt}
                        </p>
                      ) : isTranslating ? (
                        <p className="text-sm text-muted-foreground">正在翻译中...</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">生成Prompt后将自动显示中文翻译</p>
                      )}
                    </div>
                  </div>
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
                    {/* Version Selector - Compact for Generate step */}
                    {promptVersions.length > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <History className="h-3 w-3 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">版本</span>
                        <div className="flex gap-1 flex-wrap">
                          {promptVersions.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => switchToVersion(v.version)}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all",
                                currentVersionNumber === v.version
                                  ? "bg-amber-600 text-white"
                                  : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800"
                              )}
                            >
                              V{v.version}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          当前: V{currentVersionNumber}
                        </span>
                      </div>
                    )}
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
                      {/* Prompt Editor - English */}
                      <div className="flex-1">
                        <Textarea
                          value={editedPrompt}
                          onChange={(e) => {
                            setEditedPrompt(e.target.value);
                            setChinesePrompt("");
                          }}
                          rows={4}
                          className="font-mono text-xs"
                          placeholder="Edit the prompt here..."
                        />
                      </div>
                    </div>

                    {/* Chinese Translation - Always visible */}
                    <div className="p-2 bg-muted/30 rounded-lg border border-input">
                      <div className="flex items-center gap-2 mb-1">
                        <Languages className="h-3 w-3 text-blue-500" />
                        <span className="text-xs font-medium">中文翻译</span>
                        {isTranslating && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                      </div>
                      <p className="text-xs leading-relaxed">
                        {chinesePrompt || (isTranslating ? "正在翻译中..." : "生成或微调Prompt后自动显示")}
                      </p>
                    </div>

                    {/* Video Prompt - Display when available */}
                    <div className="p-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Film className="h-3 w-3 text-orange-500" />
                        <span className="text-xs font-medium">Video Prompt</span>
                        {isGeneratingVideoPrompt && <Loader2 className="h-3 w-3 animate-spin text-orange-500" />}
                        {videoPrompt && (
                          <button
                            className="ml-auto p-1 hover:bg-orange-500/20 rounded transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(videoPrompt);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            title="复制Video Prompt"
                          >
                            {copied ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-orange-500" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">
                        {videoPrompt || (isGeneratingVideoPrompt ? "正在生成Video Prompt..." : "点击上方\"Video Prompt\"按钮生成")}
                      </p>
                    </div>

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
                        variant="outline"
                        onClick={handleGenerateVideoPrompt}
                        disabled={isGeneratingVideoPrompt || !editedPrompt}
                        className="border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                      >
                        {isGeneratingVideoPrompt ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Film className="mr-2 h-4 w-4" />
                            Video Prompt
                          </>
                        )}
                      </Button>
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
                            {/* Delete button for pending */}
                            <button
                              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-all hover:scale-110"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(image.id);
                              }}
                              title="取消"
                            >
                              <Trash2 className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        )}

                        {/* Generating state */}
                        {image.status === "generating" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
                            <span className="text-xs text-muted-foreground mt-2">Generating...</span>
                            {/* Delete button for generating */}
                            <button
                              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-all hover:scale-110"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(image.id);
                              }}
                              title="取消生成"
                            >
                              <Trash2 className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        )}

                        {/* Success state */}
                        {image.status === "success" && image.url && (
                          <>
                            {/* Main image - click to zoom */}
                            <img
                              src={image.url}
                              alt={`Generated ${index + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] cursor-zoom-in"
                              onClick={() => {
                                const lightboxIdx = imageIdToLightboxIndex.get(image.id) ?? 0;
                                openLightbox(lightboxIdx);
                              }}
                            />
                            {/* Selection checkbox - top left, always visible */}
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
                            {/* Version badge - bottom right with blur */}
                            {image.promptVersion && (
                              <div className="absolute bottom-10 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 backdrop-blur-sm text-white z-10">
                                V{image.promptVersion}
                              </div>
                            )}
                            {/* Gradient overlay for better text visibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            {/* Action buttons on hover - top right */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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

                        {/* Star rating badge - always offset from checkbox */}
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
