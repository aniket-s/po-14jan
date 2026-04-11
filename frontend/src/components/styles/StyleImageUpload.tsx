'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImageIcon, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface StyleImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  compact?: boolean;
}

/**
 * A compact per-style image upload button used in import dialogs.
 * Uploads images to the style-images endpoint and returns paths.
 */
export function StyleImageUpload({
  images,
  onImagesChange,
  compact = true,
}: StyleImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images[]', file);
      });

      const response = await api.post('/upload/style-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedPaths = response.data.images.map(
        (img: { path: string }) => img.path
      );
      onImagesChange([...images, ...uploadedPaths]);
    } catch {
      // Silently fail - the user can retry
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          multiple
          onChange={handleUpload}
          className="hidden"
          disabled={isUploading}
        />
        {images.length > 0 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-green-600"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title={`${images.length} image(s) uploaded. Click to add more.`}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
            <span className="text-xs text-green-600 font-medium">
              {images.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onImagesChange([])}
              title="Remove all images"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Upload style image"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    );
  }

  // Non-compact version with thumbnails
  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        onChange={handleUpload}
        className="hidden"
        disabled={isUploading}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <ImageIcon className="mr-2 h-4 w-4" />
            {images.length > 0 ? 'Add More Images' : 'Upload Image'}
          </>
        )}
      </Button>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img.startsWith('http') ? img : `/storage/${img}`}
                alt={`Style ${index + 1}`}
                className="w-16 h-16 object-cover rounded border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
