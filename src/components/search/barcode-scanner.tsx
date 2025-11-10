'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/lib/simple-intl-provider';

type BarcodeDetectionResult = {
  rawValue: string;
};

type BarcodeDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<BarcodeDetectionResult[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorInstance;
    };
  }
}

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

const DETECTOR_FORMATS = ['qr_code', 'code_128', 'ean_13', 'ean_8'];

export function BarcodeScanner({ open, onOpenChange, onDetected }: BarcodeScannerProps) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const detectionFrameRef = useRef<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [detectorSupported, setDetectorSupported] = useState(false);

  useEffect(() => {
    setDetectorSupported(typeof window !== 'undefined' && Boolean(window.BarcodeDetector));
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    setPermissionError(null);
    startScanner();

    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startScanner = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setPermissionError(t('search.barcode.noCamera'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (detectorSupported && window.BarcodeDetector) {
          detectorRef.current = new window.BarcodeDetector({ formats: DETECTOR_FORMATS });
          detectionFrameRef.current = requestAnimationFrame(detectFrame);
        }
      }
    } catch {
      setPermissionError(t('search.barcode.permission'));
    }
  };

  const stopScanner = () => {
    if (detectionFrameRef.current) {
      cancelAnimationFrame(detectionFrameRef.current);
      detectionFrameRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    detectorRef.current = null;
  };

  const detectFrame = async () => {
    if (!videoRef.current || !detectorRef.current) {
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      if (barcodes.length > 0) {
        const value = barcodes[0].rawValue;
        onDetected(value);
        onOpenChange(false);
        stopScanner();
        return;
      }
    } catch {
      // ignore detection errors, continue scanning
    }

    detectionFrameRef.current = requestAnimationFrame(detectFrame);
  };

  const handleManualSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualValue.trim()) return;
    onDetected(manualValue.trim());
    setManualValue('');
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('search.barcode.start')}</DialogTitle>
          <DialogDescription>
            {detectorSupported
              ? t('search.barcode.instructions')
              : t('search.barcode.noSupport')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-900 aspect-video flex items-center justify-center">
            {permissionError ? (
              <p className="px-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                {permissionError}
              </p>
            ) : (
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label htmlFor="manual-barcode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('search.barcode.manualHint')}
            </label>
            <div className="flex gap-2">
              <Input
                id="manual-barcode"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="EG. 978020137962"
              />
              <Button type="submit">{t('search.title')}</Button>
            </div>
          </form>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t('search.barcode.stop')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

