"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Download, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface GalleryImage {
  id: string;
  url: string;
  selected: boolean;
}

interface GalleryProps {
  images: GalleryImage[];
  isLoading?: boolean;
  progress?: number;
  onSaveSelected?: (selectedIds: string[]) => void;
}

export function Gallery({
  images,
  isLoading = false,
  progress = 0,
  onSaveSelected,
}: GalleryProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const toggleSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const selectAll = () => {
    setSelectedImages(new Set(images.map((img) => img.id)));
  };

  const deselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleSave = () => {
    if (onSaveSelected) {
      onSaveSelected(Array.from(selectedImages));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Generated Gallery</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={isLoading || images.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={isLoading || selectedImages.size === 0}
            >
              Deselect All
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading || selectedImages.size === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Save Selected ({selectedImages.size})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Generating images... {progress}%
            </p>
            <div className="w-full max-w-md h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>No images generated yet</p>
            <p className="text-sm mt-2">
              Configure ABCD and click Generate to start
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                  selectedImages.has(image.id)
                    ? "border-primary shadow-lg"
                    : "border-transparent hover:border-muted-foreground/50"
                )}
                onClick={() => toggleSelection(image.id)}
              >
                <Image
                  src={image.url}
                  alt={`Generated image ${image.id}`}
                  fill
                  className="object-cover"
                />
                {selectedImages.has(image.id) && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
