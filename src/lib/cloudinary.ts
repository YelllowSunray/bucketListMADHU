import { CldUploadWidget } from 'next-cloudinary';
import { Cloudinary } from '@cloudinary/url-gen';

// Create a Cloudinary instance
export const cld = new Cloudinary({
  cloud: {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  }
});

// Upload widget configuration
export const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// Function to get image URL
export const getImageUrl = (publicId: string) => {
  return cld.image(publicId).toURL();
}; 