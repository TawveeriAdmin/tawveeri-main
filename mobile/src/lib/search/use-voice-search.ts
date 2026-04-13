import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

type UseVoiceSearchParams = {
  locale: string;
  onFinalTranscript: (text: string) => void;
};

/**
 * Voice-to-text for the search field using expo-speech-recognition (native only).
 * Invokes onFinalTranscript when the platform returns a final result.
 */
export function useVoiceSearch({ locale, onFinalTranscript }: UseVoiceSearchParams) {
  const [isListening, setIsListening] = useState(false);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    const t = event.results[0]?.transcript?.trim();
    if (!t) return;
    onFinalRef.current(t);
    ExpoSpeechRecognitionModule.stop();
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    const title = locale === 'ar' ? 'البحث الصوتي' : 'Voice search';
    const message =
      locale === 'ar'
        ? 'تعذر التعرف على الصوت. تحقق من الأذونات أو حاول مرة أخرى.'
        : 'Voice recognition failed. Check permissions or try again.';
    Alert.alert(title, message);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  const toggleListening = useCallback(async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          locale === 'ar' ? 'إذن مطلوب' : 'Permission required',
          locale === 'ar'
            ? 'يحتاج التطبيق إلى الميكروفون والتعرف على الكلام للبحث الصوتي.'
            : 'Microphone and speech recognition are required for voice search.',
        );
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: locale === 'ar' ? 'ar-SA' : 'en-US',
        interimResults: false,
        continuous: false,
      });
      setIsListening(true);
    } catch {
      setIsListening(false);
      Alert.alert(
        locale === 'ar' ? 'البحث الصوتي' : 'Voice search',
        locale === 'ar' ? 'تعذر بدء التعرف على الصوت.' : 'Could not start voice recognition.',
      );
    }
  }, [isListening, locale]);

  return { isListening, toggleListening };
}
