# Authentication System Documentation

## Overview

The Tawveeri authentication system provides comprehensive user authentication with multiple sign-in methods, audit logging, notifications, and profile management. This document covers the complete backend implementation.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [Usage](#usage)
5. [API Reference](#api-reference)
6. [Security](#security)
7. [Testing](#testing)

## Features

### Authentication Methods

✅ **Email & Password**: Traditional email-based authentication
✅ **Phone & Password**: Phone number authentication with SMS OTP
✅ **OAuth Providers**: Google, Facebook, and Apple Sign-In
✅ **Guest Access**: Limited access without registration
✅ **Email Verification**: Confirm email addresses
✅ **Phone Verification**: SMS OTP verification
✅ **Password Reset**: Secure password recovery

### User Management

✅ **Profile Management**: Update user information, avatar, preferences
✅ **Multi-language Support**: Arabic and English preferences
✅ **Role-Based Access**: Admin, Customer, Store, and Guest roles
✅ **Avatar Upload**: Profile picture management with Supabase Storage
✅ **Account Deletion**: Complete account removal

### Security Features

✅ **Row-Level Security (RLS)**: Database-level access control
✅ **Protected Routes**: Middleware-based route protection
✅ **Role-Based Authorization**: Admin, Store, and Customer access levels
✅ **Audit Logging**: Complete activity tracking for admin oversight
✅ **Session Management**: Secure session handling with automatic refresh

### Notifications

✅ **In-App Notifications**: Real-time notifications in the application
✅ **Email Notifications**: Automated emails for important events
✅ **Multi-language Templates**: Arabic and English email templates
✅ **Notification Types**: Price drops, deals, account, and system notifications

## Architecture

### Directory Structure

```
src/lib/auth/
├── auth-context.tsx      # React context and hooks
├── audit.ts              # Audit logging system
├── notifications.ts      # Notification system
├── profile.ts            # Profile management
├── server.ts             # Server-side utilities
├── client.ts             # Client-side utilities
└── index.ts              # Public API exports

src/middleware.ts         # Route protection middleware

src/app/auth/
├── callback/route.ts     # OAuth callback handler
├── verify-email/route.ts # Email verification handler
└── reset-password/route.ts # Password reset handler
```

### Technology Stack

- **Supabase Auth**: Authentication provider
- **Supabase Database**: PostgreSQL with RLS
- **Supabase Storage**: Avatar/file uploads
- **Next.js Middleware**: Route protection
- **React Context**: Client-side state management

## Setup

### 1. Environment Variables

Ensure your `.env.local` file has the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Supabase Configuration

#### Enable Auth Providers

In your Supabase dashboard:

1. Go to **Authentication** → **Providers**
2. Enable the following providers:
   - Email (enabled by default)
   - Phone (configure Twilio for SMS)
   - Google OAuth
   - Facebook OAuth
   - Apple OAuth

#### Configure Redirect URLs

Add these URLs to your **Supabase Auth** settings:

```
http://localhost:3000/auth/callback
http://localhost:3000/auth/verify-email
http://localhost:3000/auth/reset-password
https://yourdomain.com/auth/callback
https://yourdomain.com/auth/verify-email
https://yourdomain.com/auth/reset-password
```

#### Set Up Storage Bucket

Create a storage bucket for user avatars:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true);

-- Set up storage policies
CREATE POLICY "Avatar upload for authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "Avatar read for everyone"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-avatars');

CREATE POLICY "Avatar update for own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user-avatars' AND auth.uid() = owner);

CREATE POLICY "Avatar delete for own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-avatars' AND auth.uid() = owner);
```

### 3. Email Templates

Configure email templates in Supabase Dashboard → **Authentication** → **Email Templates**:

- Confirmation Email
- Password Reset Email
- Magic Link Email

### 4. Phone Authentication (Optional)

To enable phone authentication:

1. Sign up for [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token
3. Configure in Supabase Dashboard → **Authentication** → **Settings** → **Phone Auth**

## Usage

### Client-Side Usage

#### Wrap Your App with AuthProvider

```tsx
// src/app/layout.tsx or src/app/providers.tsx
import { AuthProvider } from '@/lib/auth';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### Use the Auth Hook

```tsx
'use client';

import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const {
    user,
    loading,
    signInWithEmail,
    signInWithPhone,
    signInWithOAuth,
    signOut,
    updateProfile,
  } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <h1>Welcome, {user.full_name}!</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Server-Side Usage

#### In Server Components

```tsx
// src/app/profile/page.tsx
import { getUserProfile, requireAuth } from '@/lib/auth';

export default async function ProfilePage() {
  await requireAuth(); // Redirect if not authenticated
  const profile = await getUserProfile();

  return (
    <div>
      <h1>Profile: {profile?.full_name}</h1>
    </div>
  );
}
```

#### In API Routes

```tsx
// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getUserProfile();
  return NextResponse.json({ profile });
}
```

### Authentication Examples

#### Email Sign Up

```tsx
const { signUp } = useAuth();

const handleSignUp = async () => {
  const { error } = await signUp({
    email: 'user@example.com',
    password: 'SecurePassword123',
    full_name: 'Ahmed Ali',
    preferred_language: 'ar',
  });

  if (error) {
    console.error('Sign up failed:', error);
  }
};
```

#### Phone Sign Up

```tsx
const { signUp } = useAuth();

const handlePhoneSignUp = async () => {
  const { error } = await signUp({
    phone: '+966501234567',
    password: 'SecurePassword123',
    full_name: 'Ahmed Ali',
    preferred_language: 'ar',
  });

  if (error) {
    console.error('Sign up failed:', error);
  }
};
```

#### OAuth Sign In

```tsx
const { signInWithOAuth } = useAuth();

const handleGoogleSignIn = async () => {
  const { error } = await signInWithOAuth('google');
  // User will be redirected to Google
};
```

#### Email Sign In

```tsx
const { signInWithEmail } = useAuth();

const handleSignIn = async () => {
  const { error } = await signInWithEmail('user@example.com', 'password123');

  if (error) {
    console.error('Sign in failed:', error);
  }
};
```

### Profile Management Examples

#### Update Profile

```tsx
import { updateUserProfile } from '@/lib/auth/profile';

const handleUpdateProfile = async (userId: string) => {
  const { data, error } = await updateUserProfile(userId, {
    full_name: 'Ahmed Mohammed',
    preferred_language: 'en',
  });
};
```

#### Upload Avatar

```tsx
import { updateAvatar } from '@/lib/auth/profile';

const handleAvatarUpload = async (userId: string, file: File) => {
  const { data, error } = await updateAvatar(userId, file);

  if (data) {
    console.log('Avatar uploaded:', data); // Returns public URL
  }
};
```

#### Get User Statistics

```tsx
import { getUserStats } from '@/lib/auth/profile';

const stats = await getUserStats(userId);
// Returns: wishlist_count, price_alerts_count, search_count, reviews_count
```

### Notification Examples

#### Create In-App Notification

```tsx
import { createNotification } from '@/lib/auth/notifications';

await createNotification({
  user_id: userId,
  type: 'price_drop',
  title_ar: 'انخفض السعر',
  title_en: 'Price Dropped',
  message_ar: 'انخفض سعر iPhone 15 Pro',
  message_en: 'iPhone 15 Pro price dropped',
  product_id: productId,
  link: `/products/${productId}`,
});
```

#### Send Email Notification

```tsx
import { sendPriceDropEmail } from '@/lib/auth/notifications';

await sendPriceDropEmail(
  'user@example.com',
  {
    product_name: 'iPhone 15 Pro Max 256GB',
    old_price: 5999,
    new_price: 5499,
    product_link: 'https://tawveeri.com/products/iphone-15-pro-max',
  },
  'ar' // User's preferred language
);
```

#### Get User Notifications

```tsx
import { getUserNotifications, getUnreadCount } from '@/lib/auth/notifications';

// Get all notifications
const { data, count } = await getUserNotifications(userId, {
  limit: 20,
  offset: 0,
});

// Get only unread
const { data: unread } = await getUserNotifications(userId, {
  unread_only: true,
});

// Get unread count
const { count: unreadCount } = await getUnreadCount(userId);
```

### Audit Logging Examples

#### Create Audit Log

```tsx
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';

await createAuditLog({
  user_id: userId,
  action: AUDIT_ACTIONS.PRODUCT_CREATED,
  entity_type: 'product',
  entity_id: productId,
  details: {
    product_name: 'New Product',
    category: 'Smartphones',
  },
  ip_address: request.ip,
  user_agent: request.headers.get('user-agent'),
});
```

#### Get Audit Logs (Admin)

```tsx
import { getAuditLogs } from '@/lib/auth/audit';

// Get all logs
const { data, count } = await getAuditLogs({
  limit: 50,
  offset: 0,
});

// Filter by user
const userLogs = await getAuditLogs({
  user_id: userId,
  limit: 50,
});

// Filter by action
const loginLogs = await getAuditLogs({
  action: 'user_login',
  start_date: '2025-01-01',
  end_date: '2025-01-31',
});
```

#### Export Audit Logs

```tsx
import { exportAuditLogs } from '@/lib/auth/audit';

// Export as JSON
const jsonData = await exportAuditLogs(
  {
    start_date: '2025-01-01',
    end_date: '2025-01-31',
  },
  'json'
);

// Export as CSV
const csvData = await exportAuditLogs(
  {
    action: 'user_login',
  },
  'csv'
);
```

## API Reference

### Auth Context

```tsx
interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<AuthResponse>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResponse>;
  signInWithPhone: (phone: string, password: string) => Promise<AuthResponse>;
  signInWithOAuth: (provider: 'google' | 'facebook' | 'apple') => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  updateProfile: (data: ProfileUpdateData) => Promise<AuthResponse>;
  refreshSession: () => Promise<void>;
}
```

### Audit Actions

```tsx
export const AUDIT_ACTIONS = {
  // Authentication
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  EMAIL_VERIFIED: 'email_verified',
  PHONE_VERIFIED: 'phone_verified',

  // Profile
  PROFILE_UPDATED: 'profile_updated',
  AVATAR_UPDATED: 'avatar_updated',

  // Products
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',

  // Admin
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_SUSPENDED: 'user_suspended',
  USER_ACTIVATED: 'user_activated',

  // System
  SYSTEM_ERROR: 'system_error',
  SECURITY_ALERT: 'security_alert',
};
```

### Notification Types

```tsx
type NotificationType = 'price_drop' | 'back_in_stock' | 'deal' | 'system' | 'account';

type EmailTemplate =
  | 'welcome'
  | 'password_reset'
  | 'password_changed'
  | 'email_verification'
  | 'price_drop_alert'
  | 'back_in_stock'
  | 'daily_deals';
```

## Security

### Row-Level Security (RLS)

All database tables have RLS policies enforced. Users can only access their own data unless they have admin privileges.

### Protected Routes

The middleware automatically protects routes based on authentication status and user roles:

- **/dashboard**: Requires authentication
- **/profile**: Requires authentication
- **/wishlist**: Requires authentication
- **/admin**: Requires admin role
- **/store/dashboard**: Requires store role

### Password Requirements

- Minimum 8 characters
- Enforced by Supabase Auth
- Consider adding custom validation for stronger passwords

### Session Management

- Sessions automatically refresh before expiration
- Secure HTTP-only cookies
- CSRF protection built-in

## Testing

### Run Auth Tests

```bash
npm test tests/auth
```

### Test Coverage

The test suite covers:
- Audit logging creation and retrieval
- Notification system
- Profile management
- User statistics

### Manual Testing Checklist

- [ ] Sign up with email
- [ ] Sign up with phone
- [ ] Sign in with Google
- [ ] Sign in with Facebook
- [ ] Sign in with Apple
- [ ] Email verification
- [ ] Phone verification
- [ ] Password reset
- [ ] Profile update
- [ ] Avatar upload
- [ ] Notification creation
- [ ] Email notification sending
- [ ] Audit log creation
- [ ] Protected route access
- [ ] Admin-only route access
- [ ] Role-based permissions

## Troubleshooting

### Issue: OAuth redirect not working

**Solution**: Ensure redirect URLs are configured in Supabase Dashboard → Authentication → URL Configuration

### Issue: Email not sending

**Solution**: Check Supabase email settings and ensure you're not in development mode restrictions

### Issue: Phone verification failing

**Solution**: Verify Twilio credentials in Supabase Dashboard → Authentication → Phone Auth

### Issue: Avatar upload failing

**Solution**: Ensure storage bucket exists and RLS policies are configured correctly

### Issue: Middleware redirecting incorrectly

**Solution**: Check `src/middleware.ts` configuration and route patterns

## Next Steps

### Frontend Implementation

Once you provide the frontend designs, we'll implement:

- Login/Signup forms
- Profile management UI
- Notification center
- Admin dashboard
- Store dashboard

### Additional Features

Consider implementing:
- Two-factor authentication (2FA)
- Social account linking
- Session device management
- Login history
- Account recovery options
- Rate limiting

## Support

For issues or questions:
1. Check this documentation
2. Review Supabase Auth documentation
3. Check the test files for examples
4. Consult the codebase comments

---

**Last Updated**: Week 2 - Authentication System Complete
**Version**: 1.0.0
**Status**: Backend Complete ✅
