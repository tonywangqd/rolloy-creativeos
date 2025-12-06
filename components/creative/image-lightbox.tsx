"use client";

import { useState } from "react";
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

  if (!isOpen || currentIndex < 0 || currentIndex >= images.length) {
    return null;
  }

  const currentImage = images[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleDownload = async () => {
    if (!currentImage.url) return;

    setIsDownloading(true);
    try {
      // For base64 images
      if (currentImage.url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = currentImage.url;
        link.download = `image_${currentIndex + 1}.png`;
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
        link.download = `image_${currentIndex + 1}.png`;
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
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") handlePrevious();
    if (e.key === "ArrowRight") handleNext();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
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
          <img
            src={currentImage.url}
            alt={`Image ${currentIndex + 1}`}
            className="max-h-[70vh] max-w-full object-contain rounded-lg"
          />
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
                    star <= currentImage.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground hover:text-yellow-400"
                  )}
                />
              </button>
            ))}
            {currentImage.rating > 0 && (
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
