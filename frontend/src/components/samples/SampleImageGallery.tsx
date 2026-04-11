'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Download,
} from 'lucide-react';

interface SampleImageGalleryProps {
  images: string[];
  documents?: string[];
  title?: string;
}

export function SampleImageGallery({ images, documents, title }: SampleImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setZoom(1);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setZoom(1);
  };

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
  }, [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, goNext, goPrev]);

  return (
    <div className="space-y-3">
      {/* Image Thumbnails */}
      {images.length > 0 && (
        <div>
          {title && (
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Images ({images.length})
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => openLightbox(idx)}
                className="relative group h-16 w-16 rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={url}
                  alt={`Image ${idx + 1}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Document Links */}
      {documents && documents.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Documents ({documents.length})
          </p>
          <div className="space-y-1">
            {documents.map((url, idx) => {
              const fileName = url.split('/').pop() || `Document ${idx + 1}`;
              return (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline py-1 px-2 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{fileName}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          {/* Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={() => setZoom(z => Math.min(z + 0.5, 3))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <a
              href={images[currentIndex]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-white hover:bg-white/20 transition-colors"
            >
              <Download className="h-4 w-4" />
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={closeLightbox}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white text-sm bg-black/50 rounded px-2 py-1">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Navigation */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-10 w-10 p-0"
                onClick={goPrev}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-10 w-10 p-0"
                onClick={goNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Image */}
          <img
            src={images[currentIndex]}
            alt={`Image ${currentIndex + 1}`}
            className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      )}
    </div>
  );
}
