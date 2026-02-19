/**
 * OAuth Callback Handler
 *
 * Handles deep link: tawveeri://auth/callback
 * Extracts tokens from the URL fragment and sets the Supabase session.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/src/lib/supabase/client';
import { useTheme } from '@/src/lib/theme/theme-context';
import { typography, spacing } from '@/src/lib/theme/typography';

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const params = useGlobalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Get the full URL that opened this screen
      const url = await Linking.getInitialURL();

      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      // Try to extract from URL fragment (#access_token=...)
      if (url) {
        const hashParams = url.split('#')[1];
        if (hashParams) {
          const parsed = new URLSearchParams(hashParams);
          accessToken = parsed.get('access_token');
          refreshToken = parsed.get('refresh_token');
        }

        // Also try query params (?access_token=...)
        if (!accessToken) {
          const queryParams = url.split('?')[1];
          if (queryParams) {
            const parsed = new URLSearchParams(queryParams);
            accessToken = parsed.get('access_token');
            refreshToken = parsed.get('refresh_token');
          }
        }
      }

      // Also check from expo-router params
      if (!accessToken && params.access_token) {
        accessToken = params.access_token as string;
        refreshToken = params.refresh_token as string;
      }

      if (accessToken && refreshToken) {
        // Set the session in Supabase
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session from callback:', error);
        }
      }

      // Navigate to home regardless
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Auth callback error:', error);
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.body, { color: colors.secondaryLabel, marginTop: spacing.md }]}>
        Signing in...
      </Text>
    </View>
  );
}
