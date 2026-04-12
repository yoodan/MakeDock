"use client";

import React, { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Download,
  ChevronDown,
  Image,
  FileCode,
  Copy,
  Check,
  Expand,
} from "lucide-react";
import { domToPng, domToSvg } from "modern-screenshot";
import { type Theme } from "@/lib/themes";
import { toast } from "sonner";

interface ExportMenuProps {
  dockRef: React.RefObject<HTMLDivElement | null>;
  theme: Theme;
}

type ExportSize = "2x" | "4x" | "6x";

const sizeMultipliers: Record<ExportSize, number> = {
  "2x": 2,
  "4x": 4,
  "6x": 6,
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function responseToDataUrl(response: Response): Promise<string | false> {
  if (!response.ok) {
    return false;
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

// Custom fetch function for modern-screenshot.
// Uses local API proxy for external HTTP(S) resources to avoid browser CORS failures.
async function fetchImageAsDataUrl(url: string): Promise<string | false> {
  // Skip if already a data URL
  if (url.startsWith("data:")) {
    return false; // Let library handle it normally
  }

  try {
    const base =
      typeof window !== "undefined" ? window.location.href : undefined;
    const resolvedUrl = base ? new URL(url, base) : new URL(url);
    const isHttp =
      resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:";
    const isSameOrigin =
      typeof window !== "undefined" &&
      resolvedUrl.origin === window.location.origin;

    // Same-origin and blob URLs can be fetched directly.
    if (resolvedUrl.protocol === "blob:" || isSameOrigin || !isHttp) {
      const response = await fetch(resolvedUrl.toString(), {
        cache: "force-cache",
      });
      return responseToDataUrl(response);
    }

    // External URLs should be fetched through our own proxy route.
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(resolvedUrl.toString())}`;
    const proxiedResponse = await fetch(proxyUrl, { cache: "force-cache" });
    const proxiedDataUrl = await responseToDataUrl(proxiedResponse);
    if (proxiedDataUrl) {
      return proxiedDataUrl;
    }

    // Last-resort fallback for hosts that already expose permissive CORS headers.
    const directResponse = await fetch(resolvedUrl.toString(), {
      cache: "force-cache",
    });
    return responseToDataUrl(directResponse);
  } catch (error) {
    console.warn("Failed to fetch image for export:", url, error);
    return false;
  }
}

function normalizeClonedNodeForExport(cloned: Node): void {
  if (!(cloned instanceof HTMLElement)) {
    return;
  }

  // modern-screenshot can rasterize backdrop-filter as hard-edged rectangles.
  if (cloned.classList.contains("backdrop-blur-md")) {
    cloned.style.backdropFilter = "none";
    cloned.style.setProperty("-webkit-backdrop-filter", "none");
    cloned.style.overflow = "hidden";
  }

  // Filter-based shadows on transparent PNGs can create square artifacts in export.
  if (
    cloned instanceof HTMLImageElement &&
    cloned.style.filter.includes("drop-shadow(")
  ) {
    cloned.style.filter = "none";
  }

  // Freeze animations/transitions to avoid mid-frame export glitches.
  if (cloned.style.animation) {
    cloned.style.animation = "none";
  }
  if (cloned.style.transition) {
    cloned.style.transition = "none";
  }
}

export function ExportMenu({ dockRef, theme }: ExportMenuProps) {
  const [selectedSize, setSelectedSize] = useState<ExportSize>("2x");
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const getExportOptions = useCallback(
    () => ({
      scale: sizeMultipliers[selectedSize],
      fetchFn: fetchImageAsDataUrl,
      onCloneEachNode: normalizeClonedNodeForExport,
      timeout: 60000,
      backgroundColor: null,
      style: {
        // Use the selected theme's gradient
        background: theme.gradient,
      },
    }),
    [selectedSize, theme],
  );

  const handleExportPng = useCallback(async () => {
    if (!dockRef.current) return;
    setIsExporting(true);

    try {
      const dataUrl = await domToPng(dockRef.current, getExportOptions());

      const link = document.createElement("a");
      link.download = `MakeDock ${selectedSize}.png`;
      link.href = dataUrl;
      link.click();
      toast("PNG saved successfully!", {
        description: `Exported at ${selectedSize} resolution`,
      });
    } catch (error) {
      console.error("Failed to export PNG:", error);
      toast.error("Failed to export PNG", {
        description: "Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [dockRef, selectedSize, getExportOptions]);

  const handleExportSvg = useCallback(async () => {
    if (!dockRef.current) return;
    setIsExporting(true);

    try {
      // For SVG, use a solid background color since gradients don't render well
      const svgOptions = {
        scale: sizeMultipliers[selectedSize],
        fetchFn: fetchImageAsDataUrl,
        onCloneEachNode: normalizeClonedNodeForExport,
        timeout: 60000,
        backgroundColor: theme.solidColor, // Use theme's solid color
      };

      const dataUrl = await domToSvg(dockRef.current, svgOptions);

      const link = document.createElement("a");
      link.download = `MakeDock ${selectedSize}.svg`;
      link.href = dataUrl;
      link.click();
      toast("SVG saved successfully!", {
        description: `Exported at ${selectedSize} resolution`,
      });
    } catch (error) {
      console.error("Failed to export SVG:", error);
      toast.error("Failed to export SVG", {
        description: "Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [dockRef, selectedSize, theme]);

  const handleCopyImage = useCallback(async () => {
    if (!dockRef.current) return;
    setIsExporting(true);

    try {
      const dataUrl = await domToPng(dockRef.current, getExportOptions());

      // Convert data URL to blob
      const base64Data = dataUrl.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Image copied to clipboard!", {
        description: "Ready to paste anywhere",
      });
    } catch (error) {
      console.error("Failed to copy image:", error);
      // Fallback: copy the data URL as text
      try {
        const dataUrl = await domToPng(dockRef.current, getExportOptions());
        await navigator.clipboard.writeText(dataUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast("Image URL copied!", {
          description: "Data URL copied to clipboard",
        });
      } catch {
        toast.error("Failed to copy image", {
          description: "Please try again.",
        });
      }
    } finally {
      setIsExporting(false);
    }
  }, [dockRef, getExportOptions]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          className="gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 text-white px-2.5 sm:px-4"
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleExportPng}
          className="gap-2 cursor-pointer"
        >
          <Image className="h-4 w-4" />
          Save PNG
          <span className="ml-auto text-xs text-muted-foreground">⌘ S</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportSvg}
          className="gap-2 cursor-pointer"
        >
          <FileCode className="h-4 w-4" />
          Save SVG
          <span className="ml-auto text-xs text-muted-foreground">⌘ ⇧ S</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleCopyImage}
          className="gap-2 cursor-pointer"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copy Image
          <span className="ml-auto text-xs text-muted-foreground">⌘ C</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Expand className="h-4 w-4" />
            Size
            <span className="ml-auto">{selectedSize}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {(["2x", "4x", "6x"] as ExportSize[]).map((size) => (
              <DropdownMenuItem
                key={size}
                onClick={() => setSelectedSize(size)}
                className="cursor-pointer"
              >
                {selectedSize === size && <span className="mr-2">•</span>}
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
