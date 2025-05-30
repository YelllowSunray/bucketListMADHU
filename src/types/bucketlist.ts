export interface Comment {
  id: string;
  text: string;
  createdAt: Date;
  authorName: string;
  authorEmail: string;
}

export interface BucketListItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  photoUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  suggestedBy: string;
  suggestedByEmail: string;
  comments?: Comment[];
} 