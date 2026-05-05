/**
 * Auth Module Exports
 * Central export point for all authentication utilities
 */

// Context and hooks
export { AuthProvider, useAuth } from './auth-context';
export type { AuthUser } from './auth-context';

// Audit logging
export {
  createAuditLog,
  getAuditLogs,
  getUserAuditLogs,
  getAuditLogsByAction,
  getRecentAuditLogs,
  exportAuditLogs,
  logAuthEvent,
  logProductEvent,
  logStoreEvent,
  AUDIT_ACTIONS,
} from './audit';
export type { AuditLogParams } from './audit';

// Notifications
export {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  sendEmailNotification,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPriceDropEmail,
} from './notifications';
export type { NotificationParams, EmailNotificationParams, EmailTemplate } from './notifications';

// Profile management
export {
  getUserProfile,
  updateUserProfile,
  updateAvatar,
  deleteAvatar,
  changeEmail,
  changePhone,
  deleteAccount,
  getUserStats,
  verifyEmailOTP,
  verifyPhoneOTP,
  resendEmailVerification,
  resendPhoneVerification,
} from './profile';
export type { UserProfile } from './profile';

// Server utilities
export {
  createClient as createServerClient,
  getSession,
  getUser,
  getUserProfile as getServerUserProfile,
  isAdmin,
  isStore,
  isCustomer,
  requireAuth,
  requireAdmin,
  requireStore,
} from './server';

// Client utilities
export { createClient as createBrowserClient } from './client';
