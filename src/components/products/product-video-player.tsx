'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ProductVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  className?: string;
}

export function ProductVideoPlayer({
  videoUrl,
  thumbnailUrl,
  className,
}: ProductVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(videoUrl) : null;

  function getYouTubeEmbedUrl(url: string): string {
    // Extract video ID from various YouTube URL formats
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;

    if (!videoId) return url;

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  }

  const handlePlay = () => {
    setIsPlaying(true);
    setVideoKey((prev) => prev + 1); // Force re-render for autoplay
  };

  if (isPlaying && embedUrl) {
    // YouTube iframe
    return (
      <div className={cn('relative aspect-video w-full rounded-xl overflow-hidden', className)}>
        <iframe
          key={videoKey}
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Product video"
        />
      </div>
    );
  }

  if (isPlaying && !embedUrl) {
    // Direct video URL
    return (
      <div className={cn('relative aspect-video w-full rounded-xl overflow-hidden bg-black', className)}>
        <video
          key={videoKey}
          src={videoUrl}
          controls
          autoPlay
          className="w-full h-full"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Thumbnail with play button
  return (
    <div className={cn('relative aspect-video w-full rounded-xl overflow-hidden cursor-pointer group', className)}>
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt="Video thumbnail"
          fill
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-container-highest" />
      )}
      
      {/* Play Button Overlay */}
      <button
        onClick={handlePlay}
        className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
        aria-label="Play video"
      >
        <div className="bg-surface-container-lowest/90 rounded-full p-4 group-hover:scale-110 transition-transform">
          <Play className="h-12 w-12 text-primary fill-current" />
        </div>
      </button>
    </div>
  );
}

