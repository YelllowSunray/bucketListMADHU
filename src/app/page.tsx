'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BucketListItem, Comment } from '@/types/bucketlist';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { CldUploadButton } from 'next-cloudinary';
import { getImageUrl } from '@/lib/cloudinary';
import CloudinaryUpload from '@/components/CloudinaryUpload';
import { handleImageUpload } from '@/lib/cloudinary';
import PhotoUploadManager from '@/components/PhotoUploadManager';
import ImageKitUpload from '@/components/ImageKitUpload';

export default function Home() {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [newItem, setNewItem] = useState({ title: '', description: '' });
  const [newItemPhoto, setNewItemPhoto] = useState<{ url: string; fileId: string; name: string } | null>(null);
  const [uploadingNewItem, setUploadingNewItem] = useState(false);
  const [editingItem, setEditingItem] = useState<BucketListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentingItemId, setCommentingItemId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ itemId: string; commentId: string; text: string } | null>(null);
  const [commentPhoto, setCommentPhoto] = useState<{ url: string; fileId: string; name: string; itemId: string } | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; alt: string } | null>(null);
  const [uploadComponentKey, setUploadComponentKey] = useState(0);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'bucketlist'));
      const itemsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Item data:', data);
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
          comments: data.comments?.map((comment: any) => ({
            ...comment,
            createdAt: comment.createdAt?.toDate()
          }))
        };
      }) as BucketListItem[];
      setItems(itemsList);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const itemData = {
        ...newItem,
        completed: false,
        createdAt: new Date(),
        suggestedBy: user.displayName || user.email || 'Anonymous',
        suggestedByEmail: user.email,
        ...(newItemPhoto && {
          photoUrl: newItemPhoto.url,
          photoMetadata: {
            fileId: newItemPhoto.fileId,
            uploadedAt: new Date(),
            uploadedBy: user.email,
            fileType: newItemPhoto.name.split('.').pop() || 'jpg'
          }
        })
      };

      await addDoc(collection(db, 'bucketlist'), itemData);
      setNewItem({ title: '', description: '' });
      setNewItemPhoto(null);
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add challenge');
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingItem) return;

    try {
      await updateDoc(doc(db, 'bucketlist', editingItem.id), {
        title: editingItem.title,
        description: editingItem.description,
      });
      setEditingItem(null);
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteDoc(doc(db, 'bucketlist', itemId));
        fetchItems();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleComplete = async (item: BucketListItem) => {
    if (!user) return;
    
    try {
      await updateDoc(doc(db, 'bucketlist', item.id), {
        completed: true,
        completedAt: new Date(),
      });
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleUndoComplete = async (item: BucketListItem) => {
    if (!user) return;
    
    try {
      await updateDoc(doc(db, 'bucketlist', item.id), {
        completed: false,
        completedAt: null,
        photoUrl: null
      });
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handlePhotoUpload = async (item: BucketListItem, result: any) => {
    if (!user) {
      console.error('No user found when trying to upload photo');
      return;
    }
    
    try {
      console.log('=== PHOTO UPLOAD DEBUG ===');
      console.log('1. Starting photo upload handler');
      console.log('Target item:', {
        id: item.id,
        title: item.title,
        suggestedBy: item.suggestedBy,
        suggestedByEmail: item.suggestedByEmail
      });
      console.log('Current user:', {
        email: user.email,
        displayName: user.displayName
      });
      console.log('Upload result:', result);
      
      if (!result.url || !result.fileId) {
        console.error('Invalid upload result:', result);
        toast.error('Invalid upload result. Please try again.');
        return;
      }

      const photoUrl = result.url;
      const fileId = result.fileId;
      
      console.log('2. Preparing to update Firestore');
      console.log('Photo details:', {
        url: photoUrl,
        fileId: fileId,
        targetItemId: item.id
      });
      
      // Get the current item to verify it exists
      const itemRef = doc(db, 'bucketlist', item.id);
      console.log('3. Fetching current item from Firestore');
      const itemDoc = await getDoc(itemRef);
      
      if (!itemDoc.exists()) {
        console.error('Item not found in Firestore:', item.id);
        throw new Error('Item not found');
      }

      console.log('4. Current item data:', itemDoc.data());

      // Update the item in Firestore
      const updateData = { 
        photoUrl,
        photoMetadata: {
          fileId,
          uploadedAt: new Date(),
          uploadedBy: user.email,
          fileType: result.name.split('.').pop() || 'jpg',
          itemId: item.id
        }
      };
      
      console.log('5. Updating Firestore with:', updateData);
      
      await updateDoc(itemRef, updateData);
      console.log('6. Firestore update successful');
      
      // Show success message
      toast.success('Photo uploaded successfully!');
      
      // Refresh the items list
      console.log('7. Refreshing items list');
      await fetchItems();
      
      // Log the updated item
      const updatedItem = await getDoc(itemRef);
      console.log('8. Updated item data:', updatedItem.data());
      console.log('=== END PHOTO UPLOAD DEBUG ===');
    } catch (error: unknown) {
      console.error('Error uploading photo:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleDeletePhoto = async (item: BucketListItem) => {
    if (!user || item.suggestedByEmail !== user.email) return;
    
    try {
      // Update the item in Firestore
      await updateDoc(doc(db, 'bucketlist', item.id), {
        photoUrl: null,
        photoMetadata: null
      });
      
      // Show success message
      toast.success('Photo deleted successfully!');
      
      // Refresh the items list
      await fetchItems();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo. Please try again.');
    }
  };

  const handleAddComment = async (itemId: string) => {
    if (!user) {
      console.error('No user found when trying to add comment');
      return;
    }

    console.log('Starting to add comment:', {
      itemId,
      user: user.email,
      hasText: !!newComment.trim(),
      hasPhoto: !!commentPhoto,
      commentText: newComment.trim(),
      photoData: commentPhoto
    });

    try {
      // Get the current item
      const itemRef = doc(db, 'bucketlist', itemId);
      const itemDoc = await getDoc(itemRef);
      
      if (!itemDoc.exists()) {
        console.error('Item not found:', itemId);
        throw new Error('Item not found');
      }

      console.log('Found item:', itemDoc.data());

      // Get current comments or initialize empty array
      const currentComments = itemDoc.data().comments || [];
      console.log('Current comments:', currentComments);
      
      // Create the new comment
      const newCommentObj: Comment = {
        id: Date.now().toString(),
        text: newComment.trim() || '', // Allow empty text
        createdAt: new Date(),
        authorName: user.displayName || user.email || 'Anonymous',
        authorEmail: user.email || '',
        ...(commentPhoto && {
          photoUrl: commentPhoto.url,
          photoMetadata: {
            fileId: commentPhoto.fileId,
            uploadedAt: new Date(),
            uploadedBy: user.email || '',
            fileType: commentPhoto.name.split('.').pop() || 'jpg'
          }
        })
      };

      console.log('New comment object:', newCommentObj);

      // Add the new comment to the array
      const updatedComments = [...currentComments, newCommentObj];
      console.log('Updated comments array:', updatedComments);

      // Update the document
      console.log('Updating Firestore document:', {
        itemId,
        commentsCount: updatedComments.length
      });

      await updateDoc(itemRef, {
        comments: updatedComments
      });
      
      console.log('Successfully updated Firestore');

      // Clear the form
      setNewComment('');
      setCommentPhoto(null);
      setCommentingItemId(null);

      // Refresh the items
      await fetchItems();
      console.log('Successfully refreshed items');

      toast.success('Comment added successfully');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      console.error('Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
      toast.error('Failed to add comment');
    }
  };

  const handleStartComment = (itemId: string) => {
    // Clear any existing comment state
    setNewComment('');
    setCommentPhoto(null);
    setCommentingItemId(itemId);
  };

  const handleEditComment = async (itemId: string, commentId: string, newText: string) => {
    if (!user || !newText.trim()) return;

    try {
      const itemRef = doc(db, 'bucketlist', itemId);
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const updatedComments = item.comments?.map(comment => 
        comment.id === commentId 
          ? { ...comment, text: newText.trim() }
          : comment
      );

      await updateDoc(itemRef, { comments: updatedComments });
      setEditingComment(null);
      fetchItems();
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  const handleDeleteComment = async (itemId: string, commentId: string) => {
    if (!user) return;

    try {
      const itemRef = doc(db, 'bucketlist', itemId);
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const updatedComments = item.comments?.filter(comment => comment.id !== commentId);
      await updateDoc(itemRef, { comments: updatedComments });
      fetchItems();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleDeleteCommentPhoto = async (itemId: string, commentId: string) => {
    if (!user) return;

    try {
      const itemRef = doc(db, 'bucketlist', itemId);
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const updatedComments = item.comments?.map(comment => 
        comment.id === commentId 
          ? { ...comment, photoUrl: null, photoMetadata: null }
          : comment
      );

      await updateDoc(itemRef, { comments: updatedComments });
      fetchItems();
      toast.success('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting comment photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Madhu's Ecuadorian Adventure</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Signed in as {user.displayName || user.email}</span>
            <button
              onClick={() => signOut()}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>
        
        {/* Add new item form */}
        <form onSubmit={handleAddItem} className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Add a post</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Title"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              className="w-full p-2 border rounded bg-white text-gray-900"
              required
            />
            <textarea
              placeholder="Description"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="w-full p-2 border rounded whitespace-pre-wrap bg-white text-gray-900"
              required
            />
            <div className="mt-2">
              {newItemPhoto ? (
                <div className="relative group mb-2">
                  <div className="relative w-full h-[200px]">
                    <Image
                      src={newItemPhoto.url}
                      alt="Challenge photo preview"
                      fill
                      className="rounded-lg object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      unoptimized
                    />
                    <button
                      onClick={() => setNewItemPhoto(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <ImageKitUpload
                  key={`upload-new-item-${Date.now()}`}
                  itemId="new-item"
                  onUpload={(result) => {
                    console.log('Photo uploaded for new item:', result);
                    setNewItemPhoto(result);
                  }}
                  buttonText="Add Photo"
                />
              )}
            </div>
            <button 
              type="submit" 
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              disabled={uploadingNewItem}
            >
              {uploadingNewItem ? 'Adding Challenge...' : 'Add Challenge'}
            </button>
          </div>
        </form>

        {/* Edit item form */}
        {editingItem && (
          <form onSubmit={handleEditItem} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-2xl font-semibold mb-4">Edit Challenge</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Title"
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
              <textarea
                placeholder="Description"
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="w-full p-2 border rounded whitespace-pre-wrap"
                required
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Bucket list items */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center">Loading...</p>
          ) : (
            items
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-lg shadow-md">
                {editingItem?.id === item.id ? (
                  <form onSubmit={handleEditItem} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <input
                        type="text"
                        placeholder="Title"
                        value={editingItem.title}
                        onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                        className="text-xl font-semibold p-2 border rounded w-full"
                        required
                      />
                    </div>
                    <textarea
                      placeholder="Description"
                      value={editingItem.description}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      className="w-full p-2 border rounded whitespace-pre-wrap"
                      required
                    />
                    <div className="flex justify-end gap-2">
                      <button type="submit" className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600">
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="bg-gray-500 text-white px-3 py-1 text-sm rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <div className="flex gap-2">
                        {!item.completed ? (
                          <button
                            onClick={() => handleComplete(item)}
                            className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600"
                          >
                            Complete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUndoComplete(item)}
                            className="bg-yellow-500 text-white px-3 py-1 text-sm rounded hover:bg-yellow-600"
                          >
                            Undo
                          </button>
                        )}
                        {item.suggestedByEmail === user.email && (
                          <>
                            <button
                              onClick={() => setEditingItem(item)}
                              className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="bg-red-500 text-white px-3 py-1 text-sm rounded hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
    <div>
                      <p className="text-gray-600 whitespace-pre-wrap">{item.description}</p>
                      <p className="text-sm text-gray-500 mt-2">Suggested by: {item.suggestedBy}</p>
                    </div>

                    {/* Photo Section */}
                    <div className="mt-4">
                      {item.photoUrl ? (
                        <div className="relative group">
                          <div 
                            className="relative w-full h-[300px] cursor-pointer"
                            onClick={() => setExpandedPhoto({ url: item.photoUrl!, alt: item.title })}
                          >
                            <Image
                              src={item.photoUrl}
                              alt={item.title}
                              fill
                              className="rounded-lg object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              unoptimized
                              onError={(e) => {
                                console.error('Image load error:', e);
                                toast.error('Failed to load image');
                              }}
                            />
                            {item.suggestedByEmail === user?.email && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(item);
                                }}
                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          {user && item.suggestedByEmail === user.email && (
                            <ImageKitUpload
                              key={`upload-${item.id}-${uploadComponentKey}`}
                              itemId={item.id}
                              onUpload={async (result) => {
                                try {
                                  console.log('=== IMAGEKIT UPLOAD DEBUG ===');
                                  console.log('1. ImageKit upload completed');
                                  console.log('Target item:', {
                                    id: item.id,
                                    title: item.title,
                                    suggestedBy: item.suggestedBy
                                  });
                                  console.log('Upload result:', result);
                                  
                                  setUploadingItemId(item.id);
                                  console.log('2. Setting uploading item ID:', item.id);
                                  
                                  await handlePhotoUpload(item, result);
                                  console.log('3. Photo upload handler completed');
                                  
                                  // Increment the key to force a re-render of the upload component
                                  setUploadComponentKey(prev => prev + 1);
                                } catch (error: unknown) {
                                  console.error('Error handling upload:', error);
                                  if (error instanceof Error) {
                                    console.error('Error details:', {
                                      name: error.name,
                                      message: error.message,
                                      stack: error.stack
                                    });
                                  }
                                  toast.error('Failed to process upload. Please try again.');
                                } finally {
                                  setUploadingItemId(null);
                                  console.log('4. Reset uploading item ID');
                                  console.log('=== END IMAGEKIT UPLOAD DEBUG ===');
                                }
                              }}
                              buttonText={uploadingItemId === item.id ? "Uploading..." : "Add Photo"}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {item.completed && (
                      <div className="mt-4">
                        <p className="text-green-600 font-semibold">Completed!</p>
                      </div>
                    )}

                    {/* Comments Section */}
                    <div className="mt-4 border-t pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">Comments</h4>
                        <button
                          onClick={() => handleStartComment(item.id)}
                          className="text-blue-500 text-sm hover:text-blue-600"
                        >
                          {commentingItemId === item.id ? 'Cancel' : 'Add Comment'}
                        </button>
                      </div>

                      {/* Add Comment Form */}
                      {commentingItemId === item.id && (
                        <div className="mb-4">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment (optional)..."
                            className="w-full p-2 border rounded text-sm whitespace-pre-wrap"
                            rows={2}
                          />
                          <div className="mt-2">
                            {commentPhoto ? (
                              <div className="relative group mb-2">
                                <div className="relative w-full h-[200px]">
                                  <Image
                                    src={commentPhoto.url}
                                    alt="Comment photo preview"
                                    fill
                                    className="rounded-lg object-cover"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    unoptimized
                                  />
                                  <button
                                    onClick={() => setCommentPhoto(null)}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <ImageKitUpload
                                key={`upload-comment-${item.id}-${Date.now()}`}
                                itemId={`comment-${item.id}`}
                                onUpload={(result) => {
                                  console.log('Photo uploaded for comment on item:', item.id, result);
                                  setCommentPhoto({
                                    ...result,
                                    itemId: item.id
                                  });
                                }}
                                buttonText="Add Photo to Comment"
                              />
                            )}
                          </div>
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => handleAddComment(item.id)}
                              disabled={!newComment.trim() && !commentPhoto}
                              className={`px-3 py-1 text-sm rounded ${
                                (newComment.trim() || commentPhoto)
                                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              Post Comment
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Comments List */}
                      <div className="space-y-3">
                        {item.comments
                          ?.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                          .map((comment) => (
                            <div key={comment.id} className="bg-gray-50 p-3 rounded">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{comment.authorName}</p>
                                  {editingComment?.commentId === comment.id ? (
                                    <div className="mt-2">
                                      <textarea
                                        value={editingComment.text}
                                        onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                        className="w-full p-2 border rounded text-sm whitespace-pre-wrap"
                                        rows={2}
                                      />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          onClick={() => handleEditComment(item.id, comment.id, editingComment.text)}
                                          className="bg-green-500 text-white px-2 py-1 text-xs rounded hover:bg-green-600"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingComment(null)}
                                          className="bg-gray-500 text-white px-2 py-1 text-xs rounded hover:bg-gray-600"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{comment.text}</p>
                                      {comment.photoUrl && (
                                        <div className="mt-2 relative group">
                                          <div 
                                            className="relative w-full h-[200px] cursor-pointer"
                                            onClick={() => setExpandedPhoto({ url: comment.photoUrl!, alt: 'Comment photo' })}
                                          >
                                            <Image
                                              src={comment.photoUrl}
                                              alt="Comment photo"
                                              fill
                                              className="rounded-lg object-cover"
                                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                              unoptimized
                                            />
                                            {comment.authorEmail === user.email && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteCommentPhoto(item.id, comment.id);
                                                }}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className="text-xs text-gray-500">
                                    {comment.createdAt.toLocaleDateString()}
                                  </span>
                                  {comment.authorEmail === user.email && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setEditingComment({ itemId: item.id, commentId: comment.id, text: comment.text })}
                                        className="text-blue-500 text-xs hover:text-blue-600"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComment(item.id, comment.id)}
                                        className="text-red-500 text-xs hover:text-red-600"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Expanded Photo Modal */}
        {expandedPhoto && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedPhoto(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]">
              <Image
                src={expandedPhoto.url}
                alt={expandedPhoto.alt}
                width={1920}
                height={1080}
                className="rounded-lg object-contain max-h-[90vh]"
                unoptimized
              />
              <button
                onClick={() => setExpandedPhoto(null)}
                className="absolute top-4 right-4 bg-white bg-opacity-50 hover:bg-opacity-75 text-black p-2 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
