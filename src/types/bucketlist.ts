export interface Comment {
  id: string;
  text: string;
  createdAt: Date;
  authorName: string;
  authorEmail: string;
  photoUrl?: string;
  photoMetadata?: {
    fileId: string;
    uploadedAt: Date;
    uploadedBy: string;
    fileType: string;
  };
}

export interface BucketListItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  suggestedBy: string;
  suggestedByEmail: string;
  photoUrl?: string;
  photoMetadata?: {
    publicId: string;
    uploadedAt: Date;
    uploadedBy: string;
    fileType: string;
    itemId: string;
  };
  comments?: Comment[];
} 