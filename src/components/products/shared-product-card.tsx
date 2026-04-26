'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/utils';

export const PRODUCT_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHBhdGggZD0iTTEyMCAxMzBoMTYwdjE0MEgxMjB6IiBmaWxsPSIjRTVFN0VCIi8+PHBhdGggZD0iTTE1MiAxNzRoOTZ2MTJoLTk2em0wIDMwaDk2djEyaC05NnptMCAzMGg2NHYxMmgtNjR6IiBmaWxsPSIjOUIxMDhBIi8+PC9zdmc+';

export interface SharedProductSummary {
  name_ar?: string | null;
  name_en?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  image_urls?: string[] | null;
  imageUrl?: string | null;
  slug?: string | null;
}

export function getProductName(product: SharedProductSummary | null | undefined, locale: string) {
  if (!product) return '';
  return (
    (locale === 'ar' ? product.name_ar : product.name_en) ||
    product.name ||
    product.name_en ||
    product.name_ar ||
    ''
  );
}

export function getProductImage(product: SharedProductSummary | null | undefined) {
  return product?.imageUrl || product?.image_urls?.find(Boolean) || null;
}

interface ProductImageFrameProps {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  unoptimized?: boolean;
  loadingOverlay?: boolean;
  fallbackIcon?: React.ReactNode;
  onImageError?: () => void;
  onImageLoad?: () => void;
}

export function ProductImageFrame({
  src,
  alt,
  className,
  imageClassName,
  sizes = '96px',
  priority = false,
  unoptimized = true,
  loadingOverlay = false,
  fallbackIcon,
  onImageError,
  onImageLoad,
}: ProductImageFrameProps) {
  const [fallback, setFallback] = useState(false);
  const imageSrc = fallback || !src ? PRODUCT_PLACEHOLDER_IMAGE : src;

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[color:var(--color-surface-container-low)]',
        className,
      )}
    >
      {loadingOverlay && (
        <div className="absolute inset-0 animate-pulse bg-[var(--brand-bg-green)]" />
      )}
      {fallbackIcon && !src && (
        <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant/45">
          {fallbackIcon}
        </div>
      )}
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        className={cn(
          'object-contain p-2 transition-transform duration-[var(--dur-med)] ease-[var(--ease-out-brand)]',
          !src && fallbackIcon && 'opacity-0',
          imageClassName,
        )}
        onLoad={onImageLoad}
        onError={() => {
          if (onImageError) {
            onImageError();
            return;
          }
          setFallback(true);
        }}
      />
    </div>
  );
}

interface ProductIdentityProps {
  product?: SharedProductSummary | null;
  locale: string;
  name?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  imageClassName?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  imageSizeClassName?: string;
  fallbackIcon?: React.ReactNode;
}

export function ProductIdentity({
  product,
  locale,
  name,
  subtitle,
  imageUrl,
  imageClassName,
  className,
  titleClassName,
  subtitleClassName,
  imageSizeClassName = 'h-12 w-12',
  fallbackIcon,
}: ProductIdentityProps) {
  const productName = name || getProductName(product, locale);
  const productSubtitle = subtitle ?? [product?.brand, product?.model].filter(Boolean).join(' · ');

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <ProductImageFrame
        src={imageUrl ?? getProductImage(product)}
        alt={productName}
        className={cn('rounded-lg', imageSizeClassName)}
        imageClassName={cn('p-1.5', imageClassName)}
        fallbackIcon={fallbackIcon ?? <Package className="h-5 w-5" />}
      />
      <div className="min-w-0">
        <p
          dir="auto"
          className={cn('truncate text-sm font-medium text-on-surface', titleClassName)}
          title={productName}
        >
          {productName || '-'}
        </p>
        {productSubtitle ? (
          <p className={cn('truncate text-xs text-on-surface-variant', subtitleClassName)}>
            {productSubtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface SharedProductRailCardProps {
  product: SharedProductSummary & {
    current_price?: number | null;
    original_price?: number | null;
    product_stores?: Array<{
      current_price?: number | null;
      original_price?: number | null;
    }>;
  };
  locale: string;
  href: string;
  size?: 'sm' | 'md';
  priceUnavailableLabel: string;
  fallbackIcon?: React.ReactNode;
}

export function SharedProductRailCard({
  product,
  locale,
  href,
  size = 'md',
  priceUnavailableLabel,
  fallbackIcon,
}: SharedProductRailCardProps) {
  const name = getProductName(product, locale);
  const isSm = size === 'sm';
  const currentPrice = product.current_price ?? product.product_stores?.[0]?.current_price ?? null;
  const originalPrice = product.original_price ?? product.product_stores?.[0]?.original_price ?? null;

  return (
    <Link
      href={href}
      className={cn(
        'group shrink-0 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-green)]/45 hover:shadow-[var(--elevation-2)] active:translate-y-0',
        isSm ? 'w-[160px]' : 'w-[200px]',
      )}
    >
      <ProductImageFrame
        src={getProductImage(product)}
        alt={name}
        className={cn('w-full rounded-none', isSm ? 'aspect-square' : 'aspect-[4/3]')}
        imageClassName="group-hover:scale-105"
        sizes={isSm ? '160px' : '200px'}
        fallbackIcon={fallbackIcon ?? <Package className={cn('text-on-surface-variant/40', isSm ? 'h-8 w-8' : 'h-10 w-10')} />}
      />
      <div className={isSm ? 'p-2.5' : 'p-3'}>
        <p
          dir="auto"
          className={cn('line-clamp-2 font-medium text-on-surface', isSm ? 'text-xs' : 'text-sm')}
          title={name}
        >
          {name}
        </p>
        {currentPrice ? (
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <Price
              amount={currentPrice}
              className={cn('font-bold text-primary', isSm ? 'text-xs' : 'text-sm')}
              symbolClassName={isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'}
            />
            {originalPrice && originalPrice > currentPrice && (
              <Price
                amount={originalPrice}
                className="text-[10px] text-on-surface-variant line-through"
                symbolClassName="h-2.5 w-2.5"
              />
            )}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-on-surface-variant">{priceUnavailableLabel}</p>
        )}
      </div>
    </Link>
  );
}
