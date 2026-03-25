/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Image as ImageIcon, X, Clock, Share2, Plus, Calendar, Heart, History, ChevronLeft, Trash2 } from 'lucide-react';

interface Post {
  id: number;
  content: string;
  images: string[];
  likes: number;
  timestamp: string;
}

interface ArchiveItem {
  postId: number;
  imageUrl: string;
  timestamp: string;
  index: number;
}

interface ComposerImage {
  file: File;
  previewUrl: string;
}

interface UploadSignatureResponse {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

const MAX_IMAGES_PER_POST = 9;
const ADMIN_PASSWORD_STORAGE_KEY = 'class-circle-admin-password';
const ADMIN_PASSWORD_HEADER = 'x-admin-password';
const CLOUDINARY_UPLOAD_SEGMENT = '/image/upload/';
const LOADING_COVER_IMAGE_URL = '/loading-cover.jpg';

const getCloudinaryTransformedUrl = (sourceUrl: string, transforms: string): string | null => {
  try {
    const parsedUrl = new URL(sourceUrl);
    if (!parsedUrl.hostname.endsWith('cloudinary.com')) return null;

    const markerIndex = parsedUrl.pathname.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
    if (markerIndex === -1) return null;

    const prefix = parsedUrl.pathname.slice(0, markerIndex + CLOUDINARY_UPLOAD_SEGMENT.length);
    const suffix = parsedUrl.pathname.slice(markerIndex + CLOUDINARY_UPLOAD_SEGMENT.length).replace(/^\/+/, '');
    parsedUrl.pathname = `${prefix}${transforms}/${suffix}`;
    return parsedUrl.toString();
  } catch {
    return null;
  }
};

const addCacheBustingParam = (sourceUrl: string): string => {
  try {
    const parsedUrl = new URL(sourceUrl);
    parsedUrl.searchParams.set('__wxfb', '1');
    return parsedUrl.toString();
  } catch {
    return sourceUrl;
  }
};

const buildImageCandidates = (sourceUrl: string): string[] => {
  const autoFormatUrl = getCloudinaryTransformedUrl(sourceUrl, 'f_auto,q_auto');
  const fallbackJpegUrl = getCloudinaryTransformedUrl(sourceUrl, 'f_jpg,q_auto');

  const orderedCandidates = [
    autoFormatUrl,
    fallbackJpegUrl ? addCacheBustingParam(fallbackJpegUrl) : null,
    sourceUrl,
  ];

  return orderedCandidates.filter((item, index): item is string => {
    return typeof item === 'string' && item.length > 0 && orderedCandidates.indexOf(item) === index;
  });
};

type PostImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
};

function PostImage({ src, onError, onLoad, className, ...rest }: PostImageProps) {
  const srcCandidates = useMemo(() => buildImageCandidates(src), [src]);
  const [srcIndex, setSrcIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSrcIndex(0);
    setIsLoaded(false);
  }, [srcCandidates]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setIsLoaded(false);
    if (srcIndex < srcCandidates.length - 1) {
      setSrcIndex((prev) => Math.min(prev + 1, srcCandidates.length - 1));
      return;
    }

    if (onError) {
      onError(event);
    }
  };

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(event);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-zinc-900">
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-800 via-zinc-700/60 to-zinc-800">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-emerald-500/60 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
      <img
        {...rest}
        src={srcCandidates[srcIndex]}
        onError={handleError}
        onLoad={handleLoad}
        className={`${className ?? ''} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`.trim()}
      />
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<ComposerImage[]>([]);
  const [newDate, setNewDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isDeletingPostId, setIsDeletingPostId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const composerImagesRef = useRef<ComposerImage[]>([]);
  const adminPasswordRef = useRef('');

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    fetchPosts();
    return () => {
      clearTimeout(timer);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    composerImagesRef.current = newImages;
  }, [newImages]);

  useEffect(() => {
    return () => {
      composerImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  useEffect(() => {
    const cachedPassword = window.sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY)?.trim();
    if (cachedPassword) {
      adminPasswordRef.current = cachedPassword;
      setIsAdminUnlocked(true);
    }
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/posts');
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const clearAdminPassword = () => {
    adminPasswordRef.current = '';
    setIsAdminUnlocked(false);
    window.sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
  };

  const ensureAdminPassword = (): string | null => {
    if (adminPasswordRef.current) {
      return adminPasswordRef.current;
    }

    const input = window.prompt('请输入管理员口令');
    const password = input?.trim();
    if (!password) {
      return null;
    }

    adminPasswordRef.current = password;
    setIsAdminUnlocked(true);
    window.sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password);
    return password;
  };

  const parseErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
    const body = await response.json().catch(() => null);
    if (body && typeof body === 'object') {
      const maybeError = (body as { error?: unknown }).error;
      if (typeof maybeError === 'string') {
        return maybeError;
      }
    }
    return fallbackMessage;
  };

  const fetchUploadSignature = async (adminPassword: string): Promise<UploadSignatureResponse> => {
    const response = await fetch('/api/uploads/signature', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [ADMIN_PASSWORD_HEADER]: adminPassword,
      },
      body: JSON.stringify({ folder: 'class-circle/posts' }),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorMessage(response, 'Failed to create upload signature');
      if (response.status === 401 || response.status === 403) {
        clearAdminPassword();
        throw new Error('管理员口令错误，请重新输入。');
      }
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const uploadImageToCloudinary = async (
    image: ComposerImage,
    signatureData: UploadSignatureResponse,
  ): Promise<string> => {
    const formData = new FormData();
    formData.append('file', image.file);
    formData.append('api_key', signatureData.apiKey);
    formData.append('timestamp', String(signatureData.timestamp));
    formData.append('signature', signatureData.signature);
    formData.append('folder', signatureData.folder);

    const uploadEndpoint = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || 'Failed to upload image to Cloudinary');
    }

    const result = await response.json();
    if (typeof result.secure_url !== 'string' || result.secure_url.length === 0) {
      throw new Error('Cloudinary upload response is missing secure_url');
    }

    return result.secure_url;
  };

  const resetComposer = () => {
    setNewContent('');
    setNewImages((previous) => {
      previous.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    setNewDate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const selectedFiles: File[] = Array.from(files);
    const remainingSlots = Math.max(MAX_IMAGES_PER_POST - newImages.length, 0);
    const acceptedFiles = selectedFiles.slice(0, remainingSlots);

    if (acceptedFiles.length > 0) {
      const appendedImages = acceptedFiles.map((file: File) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setNewImages((prev) => [...prev, ...appendedImages]);
    }

    e.target.value = '';
  };

  const handleSubmit = async () => {
    const trimmedContent = newContent.trim();
    if (!trimmedContent && newImages.length === 0) return;

    const adminPassword = ensureAdminPassword();
    if (!adminPassword) return;

    setIsSubmitting(true);
    try {
      let uploadedImageUrls: string[] = [];
      if (newImages.length > 0) {
        const signatureData = await fetchUploadSignature(adminPassword);
        uploadedImageUrls = await Promise.all(
          newImages.map((image) => uploadImageToCloudinary(image, signatureData)),
        );
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [ADMIN_PASSWORD_HEADER]: adminPassword,
        },
        body: JSON.stringify({
          content: trimmedContent,
          images: uploadedImageUrls,
          timestamp: new Date(newDate).toISOString(),
        }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorMessage(response, 'Failed to create post');
        if (response.status === 401 || response.status === 403) {
          clearAdminPassword();
          throw new Error('管理员口令错误，请重新输入。');
        }
        throw new Error(errorMessage);
      }

      resetComposer();
      setShowUpload(false);
      fetchPosts();
    } catch (error) {
      console.error('Failed to create post:', error);
      alert(error instanceof Error ? error.message : '发布失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      // Scroll ended
    }, 1500);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('链接已复制，可以分享到家长群啦！');
  };

  const handleLike = async (postId: number) => {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setPosts(prev => prev.map(post => 
          post.id === postId ? { ...post, likes: data.likes } : post
        ));
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleOpenUpload = () => {
    const adminPassword = ensureAdminPassword();
    if (!adminPassword) return;
    setShowUpload(true);
  };

  const handleDeletePost = async (postId: number) => {
    const adminPassword = ensureAdminPassword();
    if (!adminPassword) return;

    const confirmed = window.confirm('确认删除这条动态吗？删除后不可恢复。');
    if (!confirmed) return;

    setIsDeletingPostId(postId);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          [ADMIN_PASSWORD_HEADER]: adminPassword,
        },
      });

      if (!response.ok) {
        const errorMessage = await parseErrorMessage(response, 'Failed to delete post');
        if (response.status === 401 || response.status === 403) {
          clearAdminPassword();
          throw new Error('管理员口令错误，请重新输入。');
        }
        throw new Error(errorMessage);
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert(error instanceof Error ? error.message : '删除失败，请稍后重试。');
    } finally {
      setIsDeletingPostId(null);
    }
  };

  const scrollToPost = (index: number) => {
    const container = scrollContainerRef.current;
    const postElements = container?.getElementsByClassName('post-item');
    if (postElements && postElements[index]) {
      (postElements[index] as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleArchiveItemClick = (postId: number) => {
    const index = posts.findIndex(p => p.id === postId);
    if (index !== -1) {
      setShowArchive(false);
      setTimeout(() => scrollToPost(index), 100);
    }
  };

  const handleHomeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      pinchStartDistRef.current = dist;
    }
  };

  const handleHomeTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      
      // If current distance is significantly smaller than start distance (pinch in)
      if (pinchStartDistRef.current - currentDist > 100) {
        setShowArchive(true);
        pinchStartDistRef.current = null; // Reset to prevent multiple triggers
      }
    }
  };

  const handleHomeTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div
          className="absolute inset-0 bg-zinc-950 bg-cover bg-center"
          style={{ backgroundImage: `url("${LOADING_COVER_IMAGE_URL}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/75" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 h-full w-full flex flex-col items-center justify-center text-center px-6"
        >
          <div className="text-white text-4xl font-black mb-4 tracking-tighter italic drop-shadow-[0_4px_20px_rgba(0,0,0,0.75)]">
            CLASS<span className="text-emerald-500">CIRCLE</span>
          </div>
          <div className="h-1 w-14 bg-emerald-500 mx-auto rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
          <h1 className="text-white/80 mt-8 text-sm tracking-widest uppercase">长岭居小学三（3）班级圈</h1>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="h-[100dvh] w-full max-w-md mx-auto bg-black text-white font-sans relative overflow-hidden"
      onTouchStart={handleHomeTouchStart}
      onTouchMove={handleHomeTouchMove}
      onTouchEnd={handleHomeTouchEnd}
    >
      {/* Main Feed */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory scrollbar-hide touch-pan-y"
      >
        {posts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center text-white/20">
            <ImageIcon className="w-16 h-16 mb-4" />
            <p className="text-lg">点击右下角按钮<br/>开始记录班级瞬间</p>
          </div>
        ) : (
          posts.map((post, idx) => (
            <div 
              key={post.id} 
              data-index={idx}
              className="post-item h-full w-full relative snap-start snap-always flex flex-col shrink-0"
            >
              {/* Full Screen Images */}
              <div className="absolute inset-0 bg-zinc-900">
                {post.images && post.images.length > 0 ? (
                  <div className={`h-full w-full grid ${
                    post.images.length === 1 ? 'grid-cols-1' : 
                    post.images.length === 2 ? 'grid-rows-2' : 
                    post.images.length === 3 ? 'grid-cols-1 grid-rows-3' :
                    'grid-cols-2 grid-rows-2'
                  }`}>
                    {post.images.slice(0, 4).map((img, i) => (
                      <PostImage 
                        key={i} 
                        src={img} 
                        className="w-full h-full object-cover" 
                        alt="Post"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-zinc-800">
                    <ImageIcon className="text-white/10 w-24 h-24" />
                  </div>
                )}
                
                {/* Overlay Content */}
                <div className="absolute inset-x-0 bottom-0 p-8 pt-24 bg-gradient-to-t from-black via-black/60 to-transparent">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="h-px w-10 bg-emerald-500" />
                    <span className="text-emerald-500 font-mono text-sm tracking-[0.2em] uppercase font-bold">
                      {new Date(post.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xl font-medium leading-relaxed mb-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {post.content}
                  </p>
                </div>

                {/* Like Button & Count */}
                <div className="absolute bottom-10 right-8 flex flex-col items-center space-y-1">
                  <div className="relative">
                    <AnimatePresence>
                      {/* Floating hearts effect */}
                      {posts.find(p => p.id === post.id)?.likes !== undefined && (
                        <motion.div
                          key={`like-effect-${post.id}-${post.likes}`}
                          initial={{ opacity: 1, y: 0, scale: 0.5 }}
                          animate={{ opacity: 0, y: -100, scale: 2, rotate: Math.random() * 40 - 20 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="absolute inset-0 pointer-events-none flex items-center justify-center"
                        >
                          <Heart className="w-8 h-8 fill-red-500 text-red-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => handleLike(post.id)}
                      className="p-4 bg-white/10 backdrop-blur-xl rounded-full text-white active:text-red-500 transition-colors relative z-10"
                    >
                      <Heart className={`w-7 h-7 transition-all duration-300 ${post.likes > 0 ? 'fill-red-500 text-red-500 scale-110' : ''}`} />
                    </motion.button>
                  </div>
                  <span className="text-xs font-bold text-white/60 tabular-nums drop-shadow-md">
                    {post.likes || 0}
                  </span>
                </div>

                {isAdminUnlocked && (
                  <div className="absolute top-24 right-8">
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      disabled={isDeletingPostId === post.id}
                      className="p-3 bg-black/30 backdrop-blur-xl rounded-full text-white/80 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="删除动态"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Top Actions */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 pointer-events-none">
        <div className="text-white/40 text-[10px] tracking-[0.4em] uppercase font-black pointer-events-auto">
          3(3) CLASS CIRCLE
        </div>
        <div className="flex items-center space-x-3 pointer-events-auto">
          <button 
            onClick={handleOpenUpload}
            className="p-3 bg-black/20 backdrop-blur-xl rounded-full text-white active:scale-90 transition-transform"
            title="发布动态"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowArchive(true)} 
            className="p-3 bg-black/20 backdrop-blur-xl rounded-full text-white active:scale-90 transition-transform"
            title="历史精彩"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating Action Button removed from here */}

      {/* Archive View */}
      <AnimatePresence>
        {showArchive && (
          <ArchiveView 
            posts={posts} 
            onClose={() => setShowArchive(false)} 
            onItemClick={handleArchiveItemClick}
          />
        )}
      </AnimatePresence>

      {/* Upload Modal (Simplified) */}
      <AnimatePresence>
        {showUpload && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ 
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1] // expo out
            }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-6">
              <button onClick={() => setShowUpload(false)} className="text-white/40 text-sm">取消</button>
              <h2 className="text-lg font-bold">记录瞬间</h2>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || (!newContent && newImages.length === 0)}
                className="text-emerald-500 font-bold disabled:opacity-30"
              >
                {isSubmitting ? '保存中...' : '发布'}
              </button>
            </div>
            
            <div className="flex-1 px-6 space-y-8">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="记录此刻的想法..."
                className="w-full h-40 bg-transparent border-none focus:ring-0 text-2xl placeholder:text-white/10 resize-none"
              />

              {/* Date Picker */}
              <div className="flex items-center space-x-3 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <div className="flex-1">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">选择日期</p>
                  <input 
                    type="date" 
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-transparent border-none p-0 text-white focus:ring-0 w-full text-lg"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {newImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square bg-zinc-900 rounded-xl overflow-hidden group">
                    <img src={img.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setNewImages(prev => {
                        const target = prev[idx];
                        if (target) {
                          URL.revokeObjectURL(target.previewUrl);
                        }
                        return prev.filter((_, i) => i !== idx);
                      })}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                
                {newImages.length < MAX_IMAGES_PER_POST && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square bg-zinc-900 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-white/20 hover:bg-zinc-800 transition-colors"
                  >
                    <Plus className="w-6 h-6 mb-1" />
                    <span className="text-[10px] uppercase tracking-widest">添加图片</span>
                  </button>
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                multiple
                accept="image/*"
                className="hidden"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

function ArchiveView({ posts, onClose, onItemClick }: { 
  posts: Post[], 
  onClose: () => void, 
  onItemClick: (postId: number) => void 
}) {
  const [visibleItems, setVisibleItems] = useState(12);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Flatten images with metadata
  const allImages = useMemo(() => {
    const items: ArchiveItem[] = [];
    posts.forEach((post) => {
      post.images.forEach((img, idx) => {
        items.push({
          postId: post.id,
          imageUrl: img,
          timestamp: post.timestamp,
          index: idx
        });
      });
    });
    return items;
  }, [posts]);

  // Group by month
  const groupedImages = useMemo(() => {
    const groups: { [key: string]: ArchiveItem[] } = {};
    allImages.forEach(item => {
      const date = new Date(item.timestamp);
      const key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort((a, b) => {
      // Sort by year and month descending
      const [y1, m1] = a[0].match(/\d+/g)!.map(Number);
      const [y2, m2] = b[0].match(/\d+/g)!.map(Number);
      return (y2 * 12 + m2) - (y1 * 12 + m1);
    });
  }, [allImages]);

  // Lazy loading observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleItems(prev => Math.min(prev + 12, allImages.length));
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [allImages.length]);

  // Helper to determine grid span based on index
  const getGridSpan = (idx: number) => {
    // Pattern: 1st is large, next 4 are small, 6th is medium, etc.
    const mod = idx % 10;
    if (mod === 0) return "col-span-2 row-span-2"; // Large
    if (mod === 5) return "col-span-2 row-span-1"; // Wide
    return "col-span-1 row-span-1"; // Small
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ 
        type: "spring", 
        damping: 30, 
        stiffness: 200,
        opacity: { duration: 0.4, ease: "easeInOut" }
      }}
      className="fixed inset-0 bg-[#121212] z-[60] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-1">历史精彩</h2>
          <p className="text-white/40 text-xs tracking-widest uppercase">长岭居小学 3 (3) 班 影像记忆</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-12 scrollbar-hide">
        <div className="space-y-12 origin-top transition-transform duration-200">
          {groupedImages.map(([month, items]) => {
            // Only show items that are within the visibleItems limit
            const visibleInGroup = items.filter((_, idx) => {
              const globalIdx = allImages.indexOf(items[idx]);
              return globalIdx < visibleItems;
            });

            if (visibleInGroup.length === 0) return null;

            return (
              <div key={month} className="space-y-6">
                <h3 className="text-2xl font-bold text-white/90">{month}</h3>
                <div className="grid grid-cols-2 gap-3 auto-rows-[140px]">
                  {visibleInGroup.map((item, idx) => (
                    <motion.div
                      key={`${item.postId}-${item.index}`}
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ 
                        delay: idx * 0.03,
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1] // expo out
                      }}
                      onClick={() => onItemClick(item.postId)}
                      className={`${getGridSpan(idx)} relative rounded-2xl overflow-hidden bg-zinc-900 group cursor-pointer`}
                    >
                      <PostImage 
                        src={item.imageUrl} 
                        alt="Archive" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Lazy Loading Trigger */}
          {visibleItems < allImages.length && (
            <div ref={loaderRef} className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
