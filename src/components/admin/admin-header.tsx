'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';

interface AdminHeaderProps {
  userProfile: any;
  locale: string;
}

export function AdminHeader({ userProfile, locale }: AdminHeaderProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/auth/login`);
  };

  const userInitials = userProfile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AD';

  return (
    <header className="h-16 border-b border-outline-variant bg-surface flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-title-lg text-on-surface">
          {t('admin.header.adminDashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={userProfile?.avatar_url || ''} alt={userProfile?.full_name || ''} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-label-lg text-on-surface">
                  {userProfile?.full_name || 'Admin User'}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  {userProfile?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('admin.header.signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
