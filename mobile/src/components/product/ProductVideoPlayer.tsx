import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Play } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/src/lib/theme/theme-context';
import { radii, spacing } from '@/src/lib/theme/typography';

interface ProductVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

export function ProductVideoPlayer({ videoUrl, thumbnailUrl }: ProductVideoPlayerProps) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);

  // YouTube URLs → open externally
  if (isYouTubeUrl(videoUrl)) {
    return (
      <Pressable
        onPress={() => Linking.openURL(videoUrl)}
        style={[styles.container, { backgroundColor: colors.secondaryBackground }]}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: colors.tertiaryFill }]} />
        )}
        <View style={[styles.playOverlay]}>
          <View style={[styles.playButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Play size={32} color="#fff" fill="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  // Direct video URLs → expo-av Video player
  if (!playing) {
    return (
      <Pressable
        onPress={() => setPlaying(true)}
        style={[styles.container, { backgroundColor: colors.secondaryBackground }]}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: colors.tertiaryFill }]} />
        )}
        <View style={styles.playOverlay}>
          <View style={[styles.playButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Play size={32} color="#fff" fill="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  // Lazy load expo-av to avoid bundle cost when not needed
  const { Video, ResizeMode } = require('expo-av');

  return (
    <View style={[styles.container, { backgroundColor: colors.secondaryBackground }]}>
      <Video
        source={{ uri: videoUrl }}
        style={styles.thumbnail}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
