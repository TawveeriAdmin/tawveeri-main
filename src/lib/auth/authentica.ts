/**
 * Authentica SMS integration for OTP delivery
 */

interface AuthenticaConfig {
  apiKey: string;
  baseUrl: string;
}

interface SendOTPResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  error?: string;
}

class AuthenticaService {
  private config: AuthenticaConfig;

  constructor() {
    // Strip quotes from environment variables if present
    const apiKey = process.env.AUTHENTICA_API_KEY || '';
    const baseUrl = (process.env.AUTHENTICA_BASE_URL || 'https://api.authentica.sa').replace(/^["']|["']$/g, '');
    
    this.config = {
      apiKey: apiKey.replace(/^["']|["']$/g, ''),
      baseUrl,
    };
  }

  /**
   * Converts phone number to international format (+9665XXXXXXXX)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any spaces, dashes, or other characters
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // If already in international format, return as is
    if (cleaned.startsWith('+966')) {
      return cleaned;
    }
    
    // If starts with 966, add +
    if (cleaned.startsWith('966')) {
      return `+${cleaned}`;
    }
    
    // If starts with 05 (Saudi format), convert to +966
    if (cleaned.startsWith('05') && cleaned.length === 10) {
      return `+966${cleaned.substring(1)}`;
    }
    
    // If starts with 5 and is 9 digits, add +966
    if (cleaned.startsWith('5') && cleaned.length === 9) {
      return `+966${cleaned}`;
    }
    
    // Return as is if format is unclear
    return cleaned;
  }

  /**
   * Sends OTP via SMS using Authentica
   */
  async sendOTP(
    phoneNumber: string,
    otpCode: string,
  ): Promise<SendOTPResponse> {
    try {
      // Always try to load from .env.local explicitly to ensure we get the correct value
      // Next.js might not parse $ characters correctly in env vars
      let envApiKey = process.env.AUTHENTICA_API_KEY;
      
      // If the key is too short (likely Next.js parsed it incorrectly), reload from dotenv
      if (!envApiKey || envApiKey.length < 50) {
        try {
          const dotenv = require('dotenv');
          const path = require('path');
          const result = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
          if (result.parsed?.AUTHENTICA_API_KEY && result.parsed.AUTHENTICA_API_KEY.length >= 50) {
            envApiKey = result.parsed.AUTHENTICA_API_KEY;
            // Also set it in process.env for future calls
            process.env.AUTHENTICA_API_KEY = envApiKey;
          }
        } catch (error) {
          // dotenv might not be available, continue with existing value
          console.warn('Could not load dotenv:', error);
        }
      }
      
      const runtimeApiKey = envApiKey?.replace(/^["']|["']$/g, '') || this.config.apiKey;
      
      // Debug logging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Authentica API Key Check:', {
          hasEnvVar: !!envApiKey,
          envVarLength: envApiKey?.length || 0,
          envVarPrefix: envApiKey?.substring(0, 10) || 'N/A',
          hasConfigKey: !!this.config.apiKey,
          configKeyLength: this.config.apiKey?.length || 0,
          finalKeyLength: runtimeApiKey?.length || 0,
        });
      }
      
      if (!runtimeApiKey) {
        console.error('Authentica API key missing. Check AUTHENTICA_API_KEY in .env.local');
        console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('AUTHENTICA')));
        throw new Error('Authentica API key not configured. Please check server environment variables.');
      }

      const internationalPhone = this.formatPhoneNumber(phoneNumber);

      const requestBody = {
        method: 'sms',
        phone: internationalPhone,
        template_id: 31,
        fallback_email: 'noreply@tawveeri.com',
        otp: otpCode,
      };

      const response = await fetch(`${this.config.baseUrl}/api/v1/send-otp`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Authorization': runtimeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        messageId: data.messageId || data.id,
      };
    } catch (error) {
      console.error('Authentica SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      };
    }
  }

  /**
   * Verifies OTP using Authentica
   */
  async verifyOTP(
    phoneNumber: string,
    otpCode: string,
  ): Promise<VerifyOTPResponse> {
    try {
      // Always try to load from .env.local explicitly to ensure we get the correct value
      // Next.js might not parse $ characters correctly in env vars
      let envApiKey = process.env.AUTHENTICA_API_KEY;
      
      // If the key is too short (likely Next.js parsed it incorrectly), reload from dotenv
      if (!envApiKey || envApiKey.length < 50) {
        try {
          const dotenv = require('dotenv');
          const path = require('path');
          const result = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
          if (result.parsed?.AUTHENTICA_API_KEY && result.parsed.AUTHENTICA_API_KEY.length >= 50) {
            envApiKey = result.parsed.AUTHENTICA_API_KEY;
            // Also set it in process.env for future calls
            process.env.AUTHENTICA_API_KEY = envApiKey;
          }
        } catch (error) {
          // dotenv might not be available, continue with existing value
          console.warn('Could not load dotenv:', error);
        }
      }
      
      const runtimeApiKey = envApiKey?.replace(/^["']|["']$/g, '') || this.config.apiKey;
      
      if (!runtimeApiKey || runtimeApiKey.length < 50) {
        console.error('Authentica API key missing. Check AUTHENTICA_API_KEY in .env.local');
        throw new Error('Authentica API key not configured. Please check server environment variables.');
      }

      const internationalPhone = this.formatPhoneNumber(phoneNumber);

      const response = await fetch(`${this.config.baseUrl}/api/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'X-Authorization': runtimeApiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: internationalPhone,
          email: 'noreply@tawveeri.com',
          otp: otpCode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
        
        console.error('Authentica Verify OTP API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          requestUrl: `${this.config.baseUrl}/api/v1/verify-otp`,
          requestBody: {
            phone: internationalPhone,
            otp: otpCode.substring(0, 2) + '****', // Mask OTP for security
          },
        });
        
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
      };
    } catch (error) {
      console.error('Authentica OTP verification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP',
      };
    }
  }

  /**
   * Validates if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }
}

export const authenticaService = new AuthenticaService();

