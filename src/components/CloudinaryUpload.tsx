'use client';

import { CldUploadButton } from 'next-cloudinary';
import { toast } from 'react-hot-toast';
import { useEffect, useState, useCallback } from 'react';

interface CloudinaryUploadProps {
  onUpload: (result: any) => void;
  className?: string;
  buttonText?: string;
  itemId?: string;
}

// Create a singleton instance
let uploadInstance: any = null;

export default function CloudinaryUpload({ 
  onUpload, 
  className = "flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700",
  buttonText = "Add Photo",
  itemId
}: CloudinaryUploadProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!uploadInstance) {
      uploadInstance = {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      };
      console.log('CloudinaryUpload singleton initialized:', uploadInstance);
    }

    setIsMounted(true);
    console.log(`CloudinaryUpload component mounted for item ${itemId}`);

    // Validate environment variables
    if (!uploadInstance.cloudName) {
      console.error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
      toast.error('Cloudinary configuration error. Please check environment variables.');
    }
    if (!uploadInstance.uploadPreset) {
      console.error('Missing NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET');
      toast.error('Cloudinary configuration error. Please check environment variables.');
    }

    return () => {
      setIsMounted(false);
    };
  }, [itemId]);

  const handleUpload = useCallback((result: any) => {
    console.log(`Upload handler triggered for item ${itemId}`);
    console.log('Upload result:', result);
    
    if (result.event === 'success') {
      console.log('Upload successful, calling onUpload');
      setIsUploading(false);
      onUpload(result);
    } else if (result.event === 'error') {
      console.error('Upload error:', result);
      setIsUploading(false);
      toast.error('Failed to upload photo. Please try again.');
    } else if (result.event === 'begin') {
      setIsUploading(true);
      console.log('Upload started');
    }
  }, [onUpload, itemId]);

  const handleError = useCallback((error: any) => {
    console.error('Upload error:', error);
    setIsUploading(false);
    toast.error('Failed to upload photo. Please try again.');
  }, []);

  if (!isMounted || !uploadInstance) {
    return null;
  }

  return (
    <div 
      onClick={() => console.log(`Upload button clicked for item ${itemId}`)}
      className="cursor-pointer"
    >
      <CldUploadButton
        uploadPreset={uploadInstance.uploadPreset}
        onUpload={handleUpload}
        onError={handleError}
        options={{
          maxFiles: 1,
          resourceType: "image",
          sources: ["local"],
          clientAllowedFormats: ["jpg", "jpeg", "png", "gif"],
          maxFileSize: 10000000, // 10MB
          showAdvancedOptions: true,
          showSkipCropButton: true,
          showPoweredBy: false,
          styles: {
            palette: {
              window: "#FFFFFF",
              windowBorder: "#90A0B3",
              tabIcon: "#0078FF",
              menuIcons: "#5A616A",
              textDark: "#000000",
              textLight: "#FFFFFF",
              link: "#0078FF",
              action: "#FF620C",
              inactiveTabIcon: "#0E2F5A",
              error: "#F44235",
              inProgress: "#0078FF",
              complete: "#20B832",
              sourceBg: "#E4EBF1"
            }
          }
        }}
        className={className}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
        {isUploading ? 'Uploading...' : buttonText}
      </CldUploadButton>
    </div>
  );
} 