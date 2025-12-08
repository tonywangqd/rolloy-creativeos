"use client";

import { useState, useCallback, startTransition, useEffect } from "react";
import { X, Download, Star, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageData {
  id: string;
  url: string;
  storageUrl: string | null;
  rating: number;
}

interface ImageLightboxProps {
  images: ImageData[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onRatingChange: (id: string, rating: number) => void;
  onNavigate: (index: number) => void;
}

export function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onRatingChange,
  onNavigate,
}: ImageLightboxProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);

  // Reset error state when image changes
  useEffect(() => {
    setImageError(false);
    setUseFallbackUrl(false);
  }, [currentIndex]);

  // Optimized close handler with startTransition to prevent INP issues
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Use startTransition to mark state updates as non-urgent
    startTransition(() => {
      onClose();
    });
  }, [onClose]);

  // Background click handler
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking directly on the background
    if (e.target === e.currentTarget) {
      startTransition(() => {
        onClose();
      });
    }
  }, [onClose]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      startTransition(() => {
        onNavigate(currentIndex - 1);
      });
    }
  }, [currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      startTransition(() => {
        onNavigate(currentIndex + 1);
      });
    }
  }, [currentIndex, images.length, onNavigate]);

  if (!isOpen || currentIndex < 0 || currentIndex >= images.length) {
    return null;
  }

  const currentImage = images[currentIndex];

  // Safety check - if image data is invalid, don't render
  if (!currentImage) {
    return null;
  }

  // Get the effective image URL with fallback logic
  const primaryUrl = currentImage.url;
  const fallbackUrl = currentImage.storageUrl;
  const effectiveUrl = useFallbackUrl && fallbackUrl ? fallbackUrl : (primaryUrl || fallbackUrl);

  // If no URL available at all, don't render
  if (!effectiveUrl) {
    console.warn('ImageLightbox: No URL available for image', currentImage.id);
    return null;
  }

  // Ensure rating is a valid number
  const safeRating = currentImage.rating ?? 0;

  // Handle image load error - try fallback URL
  const handleImageError = () => {
    if (!useFallbackUrl && fallbackUrl && fallbackUrl !== primaryUrl) {
      console.log('ImageLightbox: Primary URL failed, trying fallback:', fallbackUrl);
      setUseFallbackUrl(true);
    } else {
      console.error('ImageLightbox: All URLs failed for image', currentImage.id);
      setImageError(true);
    }
  };

  const handleDownload = async () => {
    if (!effectiveUrl) return;

    setIsDownloading(true);
    try {
      // For base64 images
      if (effectiveUrl.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = effectiveUrl;
        link.download = `image_${currentIndex + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For URL images
        const response = await fetch(effectiveUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `image_${currentIndex + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Download failed:", error);
      // Try fallback URL for download if available
      if (fallbackUrl && effectiveUrl !== fallbackUrl) {
        try {
          const response = await fetch(fallbackUrl);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `image_${currentIndex + 1}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (fallbackError) {
          console.error("Fallback download also failed:", fallbackError);
        }
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      startTransition(() => onClose());
    }
    if (e.key === "ArrowLeft") handlePrevious();
    if (e.key === "ArrowRight") handleNext();
  }, [onClose, handlePrevious, handleNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackgroundClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={handleClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation - Previous */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Navigation - Next */}
      {currentIndex < images.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Main content */}
      <div
        className="flex flex-col items-center max-w-4xl max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative">
          {imageError ? (
            // Error state - show error message
            <div className="flex flex-col items-center justify-center min-h-[300px] min-w-[400px] bg-muted/20 rounded-lg border border-destructive/30">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive font-medium">图片加载失败</p>
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
                无法加载此图片，请稍后重试
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2 font-mono break-all max-w-xs">
                {effectiveUrl?.substring(0, 50)}...
              </p>
            </div>
          ) : (
            <img
              src={effectiveUrl}
              alt={`Image ${currentIndex + 1}`}
              className="max-h-[70vh] max-w-full object-contain rounded-lg"
              onError={handleImageError}
              onLoad={() => setImageError(false)}
            />
          )}
          {/* Image counter */}
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-sm px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center gap-6 bg-card/90 backdrop-blur-sm rounded-lg px-6 py-4">
          {/* Star Rating */}
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-2">Rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRatingChange(currentImage.id, star)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    star <= safeRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground hover:text-yellow-400"
                  )}
                />
              </button>
            ))}
            {safeRating > 0 && (
              <button
                onClick={() => onRatingChange(currentImage.id, 0)}
                className="ml-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Download button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        </div>
      </div>
    </div>
  );
}
