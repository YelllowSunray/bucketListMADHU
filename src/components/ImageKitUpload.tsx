'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { handleImageUpload } from '@/lib/imagekit';

interface ImageKitUploadProps {
  onUpload: (result: { url: string; fileId: string; name: string }) => void;
  className?: string;
  buttonText?: string;
}

export default function ImageKitUpload({
  onUpload,
  className = "flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700",
  buttonText = "Add Photo"
}: ImageKitUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      console.log('Starting file upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      const result = await handleImageUpload(file);
      console.log('Upload successful:', result);
      onUpload(result);
      toast.success('Photo uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file);
          }
        }}
        className="hidden"
        id="imagekit-upload"
        disabled={isUploading}
      />
      <label
        htmlFor="imagekit-upload"
        className="flex items-center gap-2 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
        {isUploading ? 'Uploading...' : buttonText}
      </label>
    </div>
  );
} 