'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BucketListItem, Comment } from '@/types/bucketlist';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { CldUploadButton } from 'next-cloudinary';
import { getImageUrl } from '@/lib/cloudinary';

export default function Home() {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [newItem, setNewItem] = useState({ title: '', description: '' });
  const [editingItem, setEditingItem] = useState<BucketListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentingItemId, setCommentingItemId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ itemId: string; commentId: string; text: string } | null>(null);

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
      await addDoc(collection(db, 'bucketlist'), {
        ...newItem,
        completed: false,
        createdAt: new Date(),
        suggestedBy: user.displayName || user.email || 'Anonymous',
        suggestedByEmail: user.email
      });
      setNewItem({ title: '', description: '' });
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
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
    if (!user) return;
    
    try {
      console.log('Starting photo upload handler');
      console.log('Full upload result:', JSON.stringify(result, null, 2));
      
      if (!result.info || !result.info.secure_url) {
        console.error('Invalid upload result:', result);
        toast.error('Invalid upload result. Please try again.');
        return;
      }

      const photoUrl = result.info.secure_url;
      const publicId = result.info.public_id;
      
      console.log('Photo URL:', photoUrl);
      console.log('Public ID:', publicId);
      
      // Update the item in Firestore
      const updateData = { 
        photoUrl,
        photoMetadata: {
          publicId,
          uploadedAt: new Date(),
          uploadedBy: user.email,
          fileType: result.info.format
        }
      };
      
      console.log('Updating Firestore with:', updateData);
      
      await updateDoc(doc(db, 'bucketlist', item.id), updateData);
      
      // Show success message
      toast.success('Photo uploaded successfully!');
      
      // Refresh the items list
      await fetchItems();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo. Please try again.');
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
    if (!user || !newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment.trim(),
      createdAt: new Date(),
      authorName: user.displayName || user.email || 'Anonymous',
      authorEmail: user.email || ''
    };

    try {
      await updateDoc(doc(db, 'bucketlist', itemId), {
        comments: arrayUnion(comment)
      });
      setNewComment('');
      setCommentingItemId(null);
      fetchItems();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
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
        <form onSubmit={handleAddItem} className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-semibold mb-4">Add New Challenge</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Title"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
            <textarea
              placeholder="Description"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="w-full p-2 border rounded whitespace-pre-wrap"
              required
            />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Add Challenge
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
                          <div className="relative w-full h-[300px]">
                            {/* Debug info */}
                            <div className="absolute top-0 left-0 bg-black bg-opacity-50 text-white p-2 text-xs z-10">
                              Photo URL: {item.photoUrl}
                            </div>
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
                          </div>
                          {item.suggestedByEmail === user.email && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleDeletePhoto(item)}
                                className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                title="Delete photo"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <CldUploadButton
                            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                            onUpload={(result: any) => {
                              console.log('Upload result:', result);
                              if (result.event === 'success') {
                                handlePhotoUpload(item, result);
                              }
                            }}
                            onError={(error: any) => {
                              console.error('Upload error:', error);
                              toast.error('Failed to upload photo. Please try again.');
                            }}
                            options={{
                              maxFiles: 1,
                              resourceType: "image",
                              sources: ["local"],
                              clientAllowedFormats: ["jpg", "jpeg", "png", "gif"],
                              maxFileSize: 10000000, // 10MB
                            }}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                            Add Photo
                          </CldUploadButton>
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
                          onClick={() => setCommentingItemId(commentingItemId === item.id ? null : item.id)}
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
                            placeholder="Write a comment..."
                            className="w-full p-2 border rounded text-sm whitespace-pre-wrap"
                            rows={2}
                          />
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => handleAddComment(item.id)}
                              className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600"
                            >
                              Post Comment
                            </button>
                          </div>
                        </div>
                      )}

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
                                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{comment.text}</p>
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
      </div>
    </div>
  );
}
