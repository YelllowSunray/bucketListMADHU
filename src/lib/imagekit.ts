import ImageKit from 'imagekit';

// Initialize ImageKit with only public key and URL endpoint
export const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
  privateKey: 'dummy-key', // Required by type but not used in client-side
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
});

// Function to get image URL
export const getImageUrl = (fileId: string) => {
  return `${process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}/${fileId}`;
};

// Function to handle image upload
export const handleImageUpload = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    console.log('Uploading to ImageKit via API:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Upload failed:', errorData);
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    console.log('Upload response:', data);
    
    return {
      url: data.url,
      fileId: data.fileId,
      name: data.name,
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}; 