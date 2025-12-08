"use client";

import { useState, startTransition } from "react";
import { X, Download, Star, ChevronLeft, ChevronRight } from "lucide-react";
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

  // CRITICAL SAFETY CHECK: Validate all inputs early to prevent 500 errors
  // Check if images array is valid
  const safeImages = Array.isArray(images) ? images : [];
  const safeIndex = typeof currentIndex === 'number' ? currentIndex : -1;

  // Early return if not open or invalid state
  if (!isOpen || safeImages.length === 0 || safeIndex < 0 || safeIndex >= safeImages.length) {
    return null;
  }

  // Get current image with safety check
  const currentImage = safeImages[safeIndex];

  // Safety check - if image data is invalid, close lightbox
  if (!currentImage || typeof currentImage.url !== 'string' || !currentImage.url) {
    // Auto-close on invalid data
    try { onClose(); } catch {}
    return null;
  }

  // Optimized close handler with startTransition to prevent INP issues
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(() => {
      onClose();
    });
  };

  // Background click handler
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      startTransition(() => {
        onClose();
      });
    }
  };

  const handlePrevious = () => {
    if (safeIndex > 0) {
      startTransition(() => {
        onNavigate(safeIndex - 1);
      });
    }
  };

  const handleNext = () => {
    if (safeIndex < safeImages.length - 1) {
      startTransition(() => {
        onNavigate(safeIndex + 1);
      });
    }
  };

  // Ensure rating is a valid number
  const safeRating = currentImage.rating ?? 0;

  const handleDownload = async () => {
    if (!currentImage.url) return;

    setIsDownloading(true);
    try {
      // For base64 images
      if (currentImage.url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = currentImage.url;
        link.download = `image_${safeIndex + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For URL images
        const response = await fetch(currentImage.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `image_${safeIndex + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      startTransition(() => onClose());
    }
    if (e.key === "ArrowLeft") handlePrevious();
    if (e.key === "ArrowRight") handleNext();
  };

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
      {safeIndex > 0 && (
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
      {safeIndex < safeImages.length - 1 && (
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
          <img
            src={currentImage.url}
            alt={`Image ${safeIndex + 1}`}
            className="max-h-[70vh] max-w-full object-contain rounded-lg"
          />
          {/* Image counter */}
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-sm px-2 py-1 rounded">
            {safeIndex + 1} / {safeImages.length}
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
