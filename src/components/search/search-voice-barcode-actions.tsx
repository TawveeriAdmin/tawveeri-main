'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useToast } from '@/components/ui/use-toast';
import { BarcodeScanner } from '@/components/search/barcode-scanner';

type SpeechRecognitionResultEvent = Event & {
  results: ArrayLike<{
    0?: {
      transcript: string;
    };
  }>;
};

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface SearchVoiceBarcodeActionsProps {
  /** Current UI locale (ar | en) — sets speech recognition language */
  locale: string;
  /** Called with the final query string from voice or barcode */
  onQuery: (query: string) => void;
  /** Smaller icon-only buttons for header */
  compact?: boolean;
  className?: string;
}

/**
 * Mic (Web Speech API) + QR/barcode scanner. Use next to any search field.
 * Not rendered on server — voice/barcode are browser APIs.
 */
export function SearchVoiceBarcodeActions({
  locale,
  onQuery,
  compact = false,
  className = '',
}: SearchVoiceBarcodeActionsProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onQueryRef = useRef(onQuery);
  onQueryRef.current = onQuery;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setVoiceSupported(false);
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = locale === 'ar' ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        onQueryRef.current(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast({
        title: t('search.voice.noSupport'),
        variant: 'destructive',
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
    };
  }, [locale, t, toast]);

  const toggleVoice = () => {
    if (!voiceSupported || !recognitionRef.current) {
      toast({
        title: t('search.voice.noSupport'),
        variant: 'destructive',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch (error) {
        setIsListening(false);
        console.error('Voice search error:', error);
        toast({
          title: t('search.voice.noSupport'),
          variant: 'destructive',
        });
      }
    }
  };

  const handleBarcodeDetected = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    onQueryRef.current(trimmed);
    setScannerOpen(false);
  };

  const btnClass = compact
    ? 'h-8 w-8 shrink-0 p-0'
    : 'h-11 w-11 shrink-0 p-0 sm:h-11 sm:w-11';

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        <Button
          type="button"
          variant={isListening ? 'default' : 'outline'}
          size={compact ? 'icon' : 'icon'}
          className={btnClass}
          onClick={toggleVoice}
          aria-pressed={isListening}
          aria-label={isListening ? t('search.voice.stop') : t('search.voice.start')}
          title={isListening ? t('search.voice.stop') : t('search.voice.start')}
        >
          <Mic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={btnClass}
          onClick={() => setScannerOpen(true)}
          aria-label={t('search.barcode.start')}
          title={t('search.barcode.start')}
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </div>
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcodeDetected}
      />
    </>
  );
}
