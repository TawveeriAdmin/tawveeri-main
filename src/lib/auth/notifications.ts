/**
 * Notification System
 * Handles both in-app and email notifications
 */

import { createServerClient, getSupabaseBrowserClient } from '@/lib/database';

const getSupabase = () =>
  typeof window === 'undefined' ? createServerClient() : getSupabaseBrowserClient();

export interface NotificationParams {
  user_id: string;
  type: 'price_drop' | 'back_in_stock' | 'deal' | 'system' | 'account';
  title_ar: string;
  title_en: string;
  message_ar: string;
  message_en: string;
  product_id?: string | null;
  store_id?: string | null;
  link?: string | null;
}

export interface EmailNotificationParams {
  to: string;
  subject_ar: string;
  subject_en: string;
  template: EmailTemplate;
  data: Record<string, any>;
  user_language?: 'ar' | 'en';
}

export type EmailTemplate =
  | 'welcome'
  | 'password_reset'
  | 'password_changed'
  | 'email_verification'
  | 'price_drop_alert'
  | 'back_in_stock'
  | 'daily_deals';

/**
 * Create an in-app notification
 */
export async function createNotification(params: NotificationParams) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('notifications').insert({
      user_id: params.user_id,
      type: params.type,
      title_ar: params.title_ar,
      title_en: params.title_en,
      message_ar: params.message_ar,
      message_en: params.message_en,
      product_id: params.product_id || null,
      is_read: false,
    });

    if (error) {
      console.error('Error creating notification:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Error in createNotification:', error);
    return { error: error as Error };
  }
}

/**
 * Get user notifications with pagination
 */
export async function getUserNotifications(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    unread_only?: boolean;
  }
) {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('notifications')
      .select(
        `
        *,
        products (
          name_ar,
          name_en,
          image_url
        ),
        stores (
          name_ar,
          name_en,
          logo_url
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.unread_only) {
      query = query.eq('is_read', false);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      data: [],
      count: 0,
      error: error as Error,
    };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string) {
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return {
      count: count || 0,
      error: null,
    };
  } catch (error) {
    console.error('Error getting unread count:', error);
    return {
      count: 0,
      error: error as Error,
    };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { error: error as Error };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error marking all as read:', error);
    return { error: error as Error };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { error: error as Error };
  }
}

/**
 * Send email notification via SendGrid API
 */
export async function sendEmailNotification(params: EmailNotificationParams) {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.warn('SENDGRID_API_KEY not configured — skipping email send');
      return { error: new Error('SendGrid API key not configured') };
    }

    const language = params.user_language || 'ar';
    const subject = language === 'ar' ? params.subject_ar : params.subject_en;
    const emailContent = getEmailTemplate(params.template, params.data, language);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'info@tawveeri.com',
          name: process.env.SENDGRID_FROM_NAME || 'Tawveeri',
        },
        subject,
        content: [{ type: 'text/html', value: emailContent }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No body');
      console.error('SendGrid error:', response.status, errorBody);
      return { error: new Error(`SendGrid API error: ${response.status}`) };
    }

    // SendGrid returns 202 with no body on success
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('Error in sendEmailNotification:', error);
    return { error: error as Error };
  }
}

/**
 * Get email template HTML
 */
function getEmailTemplate(
  template: EmailTemplate,
  data: Record<string, any>,
  language: 'ar' | 'en'
): string {
  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  // Base email template
  const baseTemplate = (content: string, title: string) => `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${language}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: ${isRTL ? 'Tajawal, Arial' : 'Arial'}, sans-serif;
          direction: ${dir};
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
          line-height: 1.6;
          color: #333;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          background: #f8f8f8;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>توفيري | Tawveeri</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>${isRTL ? '© 2025 توفيري. جميع الحقوق محفوظة.' : '© 2025 Tawveeri. All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  switch (template) {
    case 'welcome':
      return baseTemplate(
        isRTL
          ? `
            <h2>مرحباً بك في توفيري! 🎉</h2>
            <p>عزيزي ${data.full_name || 'العميل'},</p>
            <p>نحن سعداء جداً بانضمامك إلى منصة توفيري - أفضل منصة لمقارنة الأسعار في المملكة العربية السعودية.</p>
            <p>مع توفيري، يمكنك:</p>
            <ul>
              <li>مقارنة الأسعار من أفضل المتاجر</li>
              <li>الحصول على تنبيهات انخفاض الأسعار</li>
              <li>حفظ منتجاتك المفضلة</li>
              <li>متابعة العروض اليومية</li>
            </ul>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button">ابدأ التصفح الآن</a>
          `
          : `
            <h2>Welcome to Tawveeri! 🎉</h2>
            <p>Dear ${data.full_name || 'Customer'},</p>
            <p>We're excited to have you join Tawveeri - the best price comparison platform in Saudi Arabia.</p>
            <p>With Tawveeri, you can:</p>
            <ul>
              <li>Compare prices from top stores</li>
              <li>Get price drop alerts</li>
              <li>Save your favorite products</li>
              <li>Track daily deals</li>
            </ul>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button">Start Browsing</a>
          `,
        isRTL ? 'مرحباً بك في توفيري' : 'Welcome to Tawveeri'
      );

    case 'password_reset':
      return baseTemplate(
        isRTL
          ? `
            <h2>إعادة تعيين كلمة المرور</h2>
            <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
            <p>اضغط على الزر أدناه لإنشاء كلمة مرور جديدة:</p>
            <a href="${data.reset_link}" class="button">إعادة تعيين كلمة المرور</a>
            <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.</p>
            <p><small>هذا الرابط صالح لمدة ساعة واحدة فقط.</small></p>
          `
          : `
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your account password.</p>
            <p>Click the button below to create a new password:</p>
            <a href="${data.reset_link}" class="button">Reset Password</a>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
            <p><small>This link is valid for 1 hour only.</small></p>
          `,
        isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Your Password'
      );

    case 'password_changed':
      return baseTemplate(
        isRTL
          ? `
            <h2>تم تغيير كلمة المرور بنجاح ✓</h2>
            <p>تم تغيير كلمة المرور الخاصة بحسابك بنجاح.</p>
            <p>إذا لم تقم بهذا التغيير، يرجى الاتصال بنا فوراً.</p>
            <p><strong>الوقت:</strong> ${new Date().toLocaleString('ar-SA')}</p>
          `
          : `
            <h2>Password Changed Successfully ✓</h2>
            <p>Your account password has been changed successfully.</p>
            <p>If you didn't make this change, please contact us immediately.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-US')}</p>
          `,
        isRTL ? 'تم تغيير كلمة المرور' : 'Password Changed'
      );

    case 'email_verification':
      return baseTemplate(
        isRTL
          ? `
            <h2>تأكيد البريد الإلكتروني</h2>
            <p>شكراً لتسجيلك في توفيري!</p>
            <p>اضغط على الزر أدناه لتأكيد بريدك الإلكتروني:</p>
            <a href="${data.verification_link}" class="button">تأكيد البريد الإلكتروني</a>
          `
          : `
            <h2>Verify Your Email</h2>
            <p>Thank you for signing up with Tawveeri!</p>
            <p>Click the button below to verify your email address:</p>
            <a href="${data.verification_link}" class="button">Verify Email</a>
          `,
        isRTL ? 'تأكيد البريد الإلكتروني' : 'Verify Your Email'
      );

    case 'price_drop_alert':
      return baseTemplate(
        isRTL
          ? `
            <h2>تنبيه انخفاض السعر! 🔔</h2>
            <p>السعر انخفض للمنتج الذي تتابعه:</p>
            <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${data.product_name}</h3>
              <p style="margin: 5px 0;">
                <span style="text-decoration: line-through; color: #999;">${data.old_price} ريال</span>
                <span style="color: #f44336; font-size: 24px; font-weight: bold; margin: 0 10px;">${data.new_price} ريال</span>
              </p>
              <p style="color: #4caf50; font-weight: bold;">وفّر ${data.savings} ريال (${data.discount_percentage}%)</p>
            </div>
            <a href="${data.product_link}" class="button">عرض المنتج</a>
          `
          : `
            <h2>Price Drop Alert! 🔔</h2>
            <p>The price has dropped for a product you're watching:</p>
            <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${data.product_name}</h3>
              <p style="margin: 5px 0;">
                <span style="text-decoration: line-through; color: #999;">SAR ${data.old_price}</span>
                <span style="color: #f44336; font-size: 24px; font-weight: bold; margin: 0 10px;">SAR ${data.new_price}</span>
              </p>
              <p style="color: #4caf50; font-weight: bold;">Save SAR ${data.savings} (${data.discount_percentage}%)</p>
            </div>
            <a href="${data.product_link}" class="button">View Product</a>
          `,
        isRTL ? 'تنبيه انخفاض السعر' : 'Price Drop Alert'
      );

    case 'back_in_stock':
      return baseTemplate(
        isRTL
          ? `
            <h2>عاد للمخزون! 🎉</h2>
            <p>المنتج الذي تنتظره أصبح متوفراً الآن:</p>
            <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${data.product_name}</h3>
              <p><strong>السعر:</strong> ${data.price} ريال</p>
              <p><strong>المتجر:</strong> ${data.store_name}</p>
            </div>
            <a href="${data.product_link}" class="button">اشتري الآن</a>
          `
          : `
            <h2>Back in Stock! 🎉</h2>
            <p>The product you've been waiting for is now available:</p>
            <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${data.product_name}</h3>
              <p><strong>Price:</strong> SAR ${data.price}</p>
              <p><strong>Store:</strong> ${data.store_name}</p>
            </div>
            <a href="${data.product_link}" class="button">Buy Now</a>
          `,
        isRTL ? 'عاد للمخزون' : 'Back in Stock'
      );

    case 'daily_deals':
      return baseTemplate(
        isRTL
          ? `
            <h2>عروض اليوم! 🔥</h2>
            <p>اكتشف أفضل العروض المختارة لك اليوم:</p>
            <div style="margin: 20px 0;">
              ${data.deals
                ?.map(
                  (deal: any) => `
                <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  <h3 style="margin: 0 0 10px 0;">${deal.product_name}</h3>
                  <p style="color: #f44336; font-weight: bold; font-size: 20px;">${deal.price} ريال</p>
                  <p style="color: #4caf50;">خصم ${deal.discount}%</p>
                </div>
              `
                )
                .join('')}
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/deals" class="button">عرض جميع العروض</a>
          `
          : `
            <h2>Today's Deals! 🔥</h2>
            <p>Discover the best deals curated for you today:</p>
            <div style="margin: 20px 0;">
              ${data.deals
                ?.map(
                  (deal: any) => `
                <div style="border: 1px solid #e0e0e0; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  <h3 style="margin: 0 0 10px 0;">${deal.product_name}</h3>
                  <p style="color: #f44336; font-weight: bold; font-size: 20px;">SAR ${deal.price}</p>
                  <p style="color: #4caf50;">${deal.discount}% OFF</p>
                </div>
              `
                )
                .join('')}
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/deals" class="button">View All Deals</a>
          `,
        isRTL ? 'عروض اليوم' : "Today's Deals"
      );

    default:
      return baseTemplate(
        `<p>${isRTL ? 'رسالة من توفيري' : 'Message from Tawveeri'}</p>`,
        isRTL ? 'إشعار' : 'Notification'
      );
  }
}

/**
 * Helper to send welcome email
 */
export async function sendWelcomeEmail(email: string, fullName?: string, language?: 'ar' | 'en') {
  return sendEmailNotification({
    to: email,
    subject_ar: 'مرحباً بك في توفيري',
    subject_en: 'Welcome to Tawveeri',
    template: 'welcome',
    data: { full_name: fullName },
    user_language: language,
  });
}

/**
 * Helper to send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  language?: 'ar' | 'en'
) {
  return sendEmailNotification({
    to: email,
    subject_ar: 'إعادة تعيين كلمة المرور',
    subject_en: 'Reset Your Password',
    template: 'password_reset',
    data: { reset_link: resetLink },
    user_language: language,
  });
}

/**
 * Helper to send price drop alert email
 */
export async function sendPriceDropEmail(
  email: string,
  productData: {
    product_name: string;
    old_price: number;
    new_price: number;
    product_link: string;
  },
  language?: 'ar' | 'en'
) {
  const savings = productData.old_price - productData.new_price;
  const discountPercentage = Math.round((savings / productData.old_price) * 100);

  return sendEmailNotification({
    to: email,
    subject_ar: `انخفض السعر: ${productData.product_name}`,
    subject_en: `Price Drop: ${productData.product_name}`,
    template: 'price_drop_alert',
    data: {
      ...productData,
      savings,
      discount_percentage: discountPercentage,
    },
    user_language: language,
  });
}

/**
 * Helper to send password changed email
 */
export async function sendPasswordChangedEmail(email: string, language?: 'ar' | 'en') {
  return sendEmailNotification({
    to: email,
    subject_ar: 'تم تغيير كلمة المرور',
    subject_en: 'Password Changed',
    template: 'password_changed',
    data: {},
    user_language: language,
  });
}

/**
 * Helper to send back in stock email
 */
export async function sendBackInStockEmail(
  email: string,
  productData: {
    product_name: string;
    price: number;
    store_name: string;
    product_link: string;
  },
  language?: 'ar' | 'en'
) {
  return sendEmailNotification({
    to: email,
    subject_ar: `عاد للمخزون: ${productData.product_name}`,
    subject_en: `Back in Stock: ${productData.product_name}`,
    template: 'back_in_stock',
    data: productData,
    user_language: language,
  });
}
