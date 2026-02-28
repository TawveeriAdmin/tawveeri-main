import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { useTheme } from '@/src/lib/theme/theme-context';
import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';

type KeyedProductImageProps = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  threshold?: number;
  softness?: number;
  enabledInDark?: boolean;
};

const WHITE_KEY_EFFECT = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float threshold;
uniform float softness;

half4 main(float2 xy) {
  half4 c = image.eval(xy);
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float sat = maxC - minC;

  // Key near-white, low-saturation pixels only.
  float whiteMask = smoothstep(threshold - softness, threshold + softness, minC);
  float neutralMask = 1.0 - smoothstep(0.02, 0.16, sat);
  float key = whiteMask * neutralMask;

  c.a *= (1.0 - key);
  return c;
}
`);

function mapContentFit(fit: ImageContentFit | undefined): 'contain' | 'cover' | 'fill' | 'fitHeight' | 'fitWidth' | 'none' | 'scaleDown' {
  switch (fit) {
    case 'cover':
    case 'fill':
    case 'fitHeight':
    case 'fitWidth':
    case 'none':
    case 'scale-down':
    case 'scaleDown':
      return fit === 'scale-down' ? 'scaleDown' : fit;
    case 'contain':
    default:
      return 'contain';
  }
}

export function KeyedProductImage({
  uri,
  style,
  contentFit = 'contain',
  threshold = 0.93,
  softness = 0.06,
  enabledInDark = true,
}: KeyedProductImageProps) {
  const { isDark } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const shouldKey = Boolean(uri && isDark && enabledInDark && WHITE_KEY_EFFECT);
  const skImage = useImage(shouldKey ? String(uri) : undefined);
  const fit = useMemo(() => mapContentFit(contentFit), [contentFit]);

  const canRenderSkia = Boolean(
    shouldKey &&
      skImage &&
      size.width > 0 &&
      size.height > 0
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  return (
    <View style={[style, styles.container]} onLayout={handleLayout}>
      {!!uri && (
        <ExpoImage
          source={{ uri }}
          style={[
            StyleSheet.absoluteFillObject,
            canRenderSkia && styles.hiddenImage,
          ]}
          contentFit={contentFit}
        />
      )}

      {canRenderSkia && WHITE_KEY_EFFECT ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Fill>
            <Shader source={WHITE_KEY_EFFECT} uniforms={{ threshold, softness }}>
              <ImageShader
                image={skImage!}
                x={0}
                y={0}
                width={size.width}
                height={size.height}
                fit={fit}
              />
            </Shader>
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  hiddenImage: {
    opacity: 0,
  },
});

