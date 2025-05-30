'use client';

import { useState, useEffect } from 'react';
import { CldUploadButton } from 'next-cloudinary';
import { toast } from 'react-hot-toast';

interface PhotoUploadManagerProps {
  onUpload: (result: any) => void;
  className?: string;
  buttonText?: string;
  itemId: string;
}

export default function PhotoUploadManager({
  onUpload,
  className = "flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700",
  buttonText = "Add Photo",
  itemId
}: PhotoUploadManagerProps) {
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Initialize Cloudinary configuration
    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
      console.error('Missing Cloudinary configuration');
      toast.error('Photo upload is not configured properly');
    }
  }, []);

  const handleUpload = (result: any) => {
    console.log(`Upload handler triggered for item ${itemId}`);
    console.log('Upload result:', result);
    
    if (result.event === 'success') {
      console.log('Upload successful');
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
  };

  const handleError = (error: any) => {
    console.error('Upload error:', error);
    setIsUploading(false);
    toast.error('Failed to upload photo. Please try again.');
  };

  return (
    <div className="cursor-pointer">
      <CldUploadButton
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
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