"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ABCDSelector, type ABCDSelection } from "@/components/creative/abcd-selector";
import { NamingCard } from "@/components/creative/naming-card";
import { Gallery } from "@/components/creative/gallery";

// Mock data for demonstration
const mockImages = Array.from({ length: 20 }, (_, i) => ({
  id: `img-${i + 1}`,
  url: `https://via.placeholder.com/400x400?text=Image+${i + 1}`,
  selected: false,
}));

export default function HomePage() {
  const [selection, setSelection] = useState<ABCDSelection>({
    sceneCategory: "",
    sceneDetail: "",
    action: "",
    driver: "",
    format: "",
  });

  const [images, setImages] = useState<typeof mockImages>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = async () => {
    const { sceneCategory, sceneDetail, action, driver, format } = selection;

    if (!sceneCategory || !sceneDetail || !action || !driver || !format) {
      alert("Please complete all ABCD selections before generating");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setImages([]);

    // Simulate generation process
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setImages(mockImages);
          return 100;
        }
        return prev + 5;
      });
    }, 200);
  };

  const handleSaveSelected = (selectedIds: string[]) => {
    console.log("Saving selected images:", selectedIds);
    // Implement save logic here
    alert(`Saved ${selectedIds.length} images!`);
  };

  const isSelectionComplete =
    selection.sceneCategory &&
    selection.sceneDetail &&
    selection.action &&
    selection.driver &&
    selection.format;

  return (
    <div className="space-y-6">
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
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={!isSelectionComplete || isGenerating}
        >
          <Sparkles className="mr-2 h-5 w-5" />
          {isGenerating ? "Generating..." : "Generate 20 Images"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <ABCDSelector onSelectionChange={setSelection} />
          <NamingCard selection={selection} />
        </div>

        <div className="lg:col-span-2">
          <Gallery
            images={images}
            isLoading={isGenerating}
            progress={progress}
            onSaveSelected={handleSaveSelected}
          />
        </div>
      </div>
    </div>
  );
}
