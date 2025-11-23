'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { AlertCircle, Home, LogIn, Shield } from 'lucide-react';

export default function UnauthorizedPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{isRTL ? 'الرئيسية' : 'Home'}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{isRTL ? 'غير مصرح' : 'Unauthorized'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="border-warning-200 dark:border-warning-800">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/20">
              <Shield className="h-8 w-8 text-warning-600 dark:text-warning-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {isRTL ? 'غير مصرح بالوصول' : 'Access Denied'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isRTL
                ? 'ليس لديك الصلاحيات اللازمة للوصول إلى هذه الصفحة.'
                : "You don't have permission to access this page."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-warning-800 dark:text-warning-200">
                  {isRTL
                    ? 'إذا كنت تعتقد أن هذا خطأ، يرجى الاتصال بفريق الدعم.'
                    : 'If you believe this is an error, please contact our support team.'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={() => router.push(`/${locale}`)}
                variant="default"
                className="flex-1"
              >
                <Home className="h-4 w-4 mr-2" />
                {isRTL ? 'الذهاب إلى الرئيسية' : 'Go to Home'}
              </Button>

              {!user && (
                <Button
                  onClick={() => router.push(`/${locale}/auth/login`)}
                  variant="outline"
                  className="flex-1"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {isRTL ? 'تسجيل الدخول' : 'Login'}
                </Button>
              )}
            </div>

            {user && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isRTL
                    ? 'ملاحظة: تم تسجيل دخولك كـ'
                    : 'Note: You are logged in as'}{' '}
                  <span className="font-semibold">{user.role || 'customer'}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {isRTL
                    ? 'قد تحتاج إلى صلاحيات مختلفة للوصول إلى هذه الصفحة.'
                    : 'You may need different permissions to access this page.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

