'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Languages, User, LogOut, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Price } from '@/components/ui/price';
import {
  Search,
  TrendingUp,
  Bell,
  Star,
  ShoppingCart,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Sparkles,
  Gift,
  Heart,
  BarChart3,
  Check,
  ChevronDown,
  Award,
  Target,
  Percent,
} from 'lucide-react';

export default function LandingPageClient() {
  const t = useTranslations();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Get locale from params
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  // Fix hydration mismatch - only render theme-dependent content after mount
  useEffect(() => {
    // Run setMounted in a microtask to avoid synchronous state update
    Promise.resolve().then(() => setMounted(true));

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Function to switch locale
  const switchLocale = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    window.location.href = newPath;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 transition-colors duration-300">
      {/* Enhanced Navigation with Glassmorphism */}
      <nav
        className={`fixed top-0 ${isRTL ? 'right-0 left-0' : 'left-0 right-0'} z-50 transition-all duration-300 ${
          scrollY > 20
            ? 'bg-white dark:bg-gray-900/95 backdrop-blur-2xl shadow-lg shadow-primary-600/5 dark:shadow-primary-600/10'
            : 'bg-white dark:bg-gray-900/80 backdrop-blur-xl'
        } border-b border-gray-200 dark:border-gray-700`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-600/30 dark:shadow-primary-600/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                {t('app.initial')}
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                {t('app.name')}
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              {[
                { href: '#features', label: t('nav.features') },
                { href: '#how-it-works', label: t('nav.howItWorks') },
                { href: '#stores', label: t('nav.stores') },
                { href: '#testimonials', label: t('nav.testimonials') },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group font-medium"
                >
                  {item.label}
                  <span className="absolute bottom-0 start-0 w-0 h-0.5 bg-gradient-to-r from-primary-600 to-primary-800 group-hover:w-full transition-all duration-300" />
                </Link>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle with Animation */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="relative p-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 group border border-gray-200 dark:border-gray-600 shadow-sm"
                aria-label="Toggle theme"
              >
                {mounted ? (
                  theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-featured-500 group-hover:rotate-90 transition-transform duration-300" />
                  ) : (
                    <Moon className="w-5 h-5 text-primary-600 group-hover:-rotate-12 transition-transform duration-300" />
                  )
                ) : (
                  <div className="w-5 h-5" />
                )}
              </button>

              {/* Language Toggle */}
              <button
                onClick={switchLocale}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 group border border-gray-200 dark:border-gray-600 shadow-sm"
                aria-label="Toggle language"
              >
                <Languages className="w-5 h-5 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
                  {locale === 'ar' ? 'EN' : 'عربي'}
                </span>
              </button>

              {/* Show user menu if logged in, otherwise show sign in/get started */}
              {/* Show loading state briefly to prevent flash of wrong UI */}
              {authLoading ? (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 border border-gray-200 dark:border-gray-600 shadow-sm">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || user.email || ''} />
                        <AvatarFallback className="bg-primary-600 text-white text-sm">
                          {user.full_name
                            ? user.full_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)
                            : user.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline-block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {user.full_name || user.email?.split('@')[0] || 'User'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.full_name || 'User'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/dashboard`} className="cursor-pointer flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/profile`} className="cursor-pointer flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        await signOut();
                        router.push(`/${locale}`);
                      }}
                      className="cursor-pointer text-red-600 dark:text-red-400 flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link
                    href={`/${locale}/auth/login`}
                    className="hidden sm:inline-block px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    href={`/${locale}/auth/signup`}
                    className="px-6 py-2.5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl hover:shadow-xl hover:shadow-primary-600/30 dark:hover:shadow-primary-600/20 transform hover:scale-105 transition-all duration-300 font-bold shadow-lg"
                    style={{ color: '#ffffff' }}
                  >
                    <span className="relative" style={{
                      textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
                      color: '#ffffff'
                    }}>
                      {t('nav.startFree')}
                    </span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Enhanced with Parallax Effect */}
      <section className="relative overflow-hidden pt-32 pb-24">
        {/* Animated Background Blobs with Better Dark Mode Support */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 start-0 w-96 h-96 bg-primary-400/30 dark:bg-primary-600/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-70 dark:opacity-50 animate-blob"
            style={{ transform: `translateY(${scrollY * 0.5}px)` }}
          />
          <div
            className="absolute top-0 end-0 w-96 h-96 bg-success-400/30 dark:bg-success-600/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-70 dark:opacity-50 animate-blob animation-delay-2000"
            style={{ transform: `translateY(${scrollY * 0.3}px)` }}
          />
          <div
            className="absolute -bottom-8 start-20 w-96 h-96 bg-featured-400/30 dark:bg-featured-600/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-70 dark:opacity-50 animate-blob animation-delay-4000"
            style={{ transform: `translateY(${scrollY * 0.4}px)` }}
          />
        </div>

        <div className="relative container mx-auto px-4">
          <div className="text-center space-y-8 max-w-5xl mx-auto">
            {/* Enhanced Badge */}
            <div
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary-50 via-success-50 to-featured-50 dark:from-primary-900/40 dark:via-success-900/40 dark:to-featured-900/40 border border-primary-200 dark:border-primary-700 shadow-xl shadow-primary-600/10 dark:shadow-primary-600/5 backdrop-blur-sm"
              style={{ animation: 'fadeInUp 0.6s ease-out' }}
            >
              <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-pulse" />
              <span className="text-sm font-bold bg-gradient-to-r from-primary-700 to-success-700 dark:from-primary-300 dark:to-success-300 bg-clip-text text-transparent">
                {t('hero.badge')}
              </span>
              <Sparkles className="w-5 h-5 text-success-600 dark:text-success-400 animate-pulse animation-delay-1000" />
            </div>

            {/* Main Headline with Enhanced Gradient */}
            <h1
              className="text-6xl md:text-8xl font-black leading-tight"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.2s backwards' }}
            >
              <span className="inline-block bg-gradient-to-r from-primary-600 to-success-600 bg-clip-text text-transparent animate-gradient drop-shadow-lg">
                {t('hero.saveUpTo')}
              </span>
              <br />
              <span className="inline-block text-7xl md:text-9xl bg-gradient-to-r from-success-600 to-primary-600 bg-clip-text text-transparent animate-gradient animation-delay-1000 drop-shadow-2xl">
                60%
              </span>
              <br />
              <span className="text-gray-900 dark:text-white drop-shadow-md">
                {t('hero.onPurchases')}
              </span>
            </h1>

            <p
              className="text-2xl md:text-3xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed font-light"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.4s backwards' }}
            >
              {t('hero.description')}{' '}
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {t('hero.descriptionBold')}
              </span>{' '}
              {t('hero.descriptionEnd')}
              <br />
              <span className="text-xl text-gray-600 dark:text-gray-400">
                {t('hero.tagline')}
              </span>
            </p>

            {/* Enhanced Floating Search Bar with Glassmorphism */}
            <div
              className="max-w-3xl mx-auto pt-6"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.6s backwards' }}
            >
              <div className="relative group">
                {/* Animated Glow Effect */}
                <div className="absolute -inset-3 bg-gradient-to-r from-primary-600 to-success-600 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 dark:opacity-30 dark:group-hover:opacity-50 transition duration-500 animate-pulse" />

                {/* Search Bar with Glassmorphism */}
                <div className="relative flex items-center bg-white dark:bg-gray-900 backdrop-blur-xl rounded-2xl shadow-2xl p-3 border-2 border-primary-200 dark:border-primary-700 group-hover:border-primary-400 dark:group-hover:border-primary-500 transition duration-300">
                  <div className="flex-1 flex items-center gap-3 px-4">
                    <Search className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                    <input
                      type="text"
                      placeholder={t('hero.searchPlaceholder')}
                      className="flex-1 bg-transparent outline-none text-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                  <button
                    className="px-10 py-4 bg-gradient-to-r from-primary-700 to-primary-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 dark:hover:shadow-primary-600/20 transform hover:scale-105 transition-all duration-300 group/btn shadow-lg"
                    style={{ color: '#ffffff' }}
                  >
                    <span className="relative" style={{
                      textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
                      color: '#ffffff'
                    }}>
                      {t('button.search')}
                    </span>
                    <ArrowRight
                      className={`inline-block ${isRTL ? 'me-2 rotate-180' : 'ms-2'} w-5 h-5 group-hover/btn:translate-x-1 transition-transform`}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                    />
                  </button>
                </div>
              </div>

              {/* Popular Searches */}
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 font-medium">
                  <TrendingUp className="w-4 h-4" />
                  {t('hero.popular')}
                </span>
                {[
                  { name: 'iPhone 15 Pro', icon: '📱' },
                  { name: 'Samsung S24', icon: '📱' },
                  { name: 'MacBook Air', icon: '💻' },
                  { name: 'AirPods Pro', icon: '🎧' },
                ].map((term) => (
                  <button
                    key={term.name}
                    className="group/tag px-5 py-2.5 bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-primary-50 hover:to-success-50 dark:hover:from-primary-900/50 dark:hover:to-success-900/50 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all shadow-sm hover:shadow-md hover:scale-105"
                  >
                    <span className={isRTL ? 'ms-2' : 'me-2'}>{term.icon}</span>
                    {term.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dual CTAs with Enhanced Design */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.8s backwards' }}
            >
              <Link
                href={`/${locale}/products`}
                className="group/cta relative px-12 py-5 bg-gradient-to-r from-primary-700 to-primary-900 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 dark:hover:shadow-primary-600/20 transform hover:scale-105 transition-all duration-300 overflow-hidden shadow-lg"
                style={{ color: '#ffffff' }}
              >
                <span className="relative z-10 flex items-center gap-3" style={{
                  textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
                  color: '#ffffff'
                }}>
                  <ShoppingCart className="w-6 h-6 group-hover/cta:scale-110 transition-transform" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  {t('button.browseProducts')}
                  <ArrowRight className={`w-5 h-5 group-hover/cta:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-800 to-primary-950 opacity-0 group-hover/cta:opacity-100 transition duration-300" />
              </Link>
              <Link
                href="#how-it-works"
                className="group/cta px-12 py-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-700 rounded-2xl font-bold text-lg hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center gap-3"
              >
                <span>{t('button.howItWorks')}</span>
                <ChevronDown className="w-5 h-5 animate-bounce" />
              </Link>
            </div>

            {/* Enhanced Social Proof with Glassmorphism */}
            <div
              className="flex flex-wrap justify-center items-center gap-6 pt-12"
              style={{ animation: 'fadeInUp 0.6s ease-out 1s backwards' }}
            >
              {[
                {
                  icon: <Users className="w-6 h-6" />,
                  value: '+100K',
                  label: t('stats.activeUsers'),
                  color: 'from-primary-500 to-primary-700'
                },
                {
                  icon: <Star className="w-6 h-6" />,
                  value: '4.9',
                  label: t('stats.rating'),
                  color: 'from-featured-500 to-featured-700'
                },
                {
                  icon: <ShoppingCart className="w-6 h-6" />,
                  value: '+5',
                  label: t('stats.trustedStores'),
                  color: 'from-warning-500 to-warning-700'
                },
                {
                  icon: <Gift className="w-6 h-6" />,
                  value: '60%',
                  label: t('stats.avgSavings'),
                  color: 'from-success-500 to-success-700'
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="group/stat relative px-6 py-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-200 dark:border-gray-700"
                  style={{ animation: `fadeInUp 0.6s ease-out ${1 + idx * 0.1}s backwards` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl text-white group-hover/stat:scale-110 group-hover/stat:rotate-6 transition-all duration-300 shadow-lg`}>
                      {stat.icon}
                    </div>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <div className="text-3xl font-black text-gray-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                  {/* Hover glow effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover/stat:opacity-10 dark:group-hover/stat:opacity-20 rounded-2xl transition duration-300`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 start-1/2 transform -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 text-primary-400 dark:text-primary-600 animate-bounce">
            <ChevronDown className="w-6 h-6" />
            <ChevronDown className="w-6 h-6 -mt-4 opacity-50" />
          </div>
        </div>
      </section>

      {/* Trusted Stores - Enhanced */}
      <section id="stores" className="py-20 bg-white dark:bg-gray-900 border-y border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                {t('stores.title')}
              </span>
            </div>
            <h3 className="text-4xl font-black text-gray-900 dark:text-white">
              {t('stores.subtitle')}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { name: 'Extra', logo: '🛒', color: 'from-warning-500 to-warning-700' },
              { name: 'Jarir', logo: '📚', color: 'from-primary-500 to-primary-700' },
              { name: 'Noon', logo: '🌙', color: 'from-featured-500 to-featured-700' },
              { name: 'Amazon.sa', logo: '📦', color: 'from-success-500 to-success-700' },
              { name: 'Almanea', logo: '🏪', color: 'from-primary-600 to-success-600' },
            ].map((store, idx) => (
              <div
                key={store.name}
                className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-white dark:bg-gray-800 hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 border border-gray-200 dark:border-gray-700 cursor-pointer"
                style={{ animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s backwards` }}
              >
                <div className="text-6xl filter grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-125 group-hover:rotate-12">
                  {store.logo}
                </div>
                <span className="text-xl font-bold text-gray-700 dark:text-gray-300 transition duration-300">
                  {store.name}
                </span>
                <div className={`absolute inset-0 bg-gradient-to-br ${store.color} opacity-0 group-hover:opacity-15 dark:group-hover:opacity-20 rounded-2xl transition duration-300`} />
                <div className="absolute -top-2 -end-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 bg-success-500 rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features - Enhanced with Better Dark Mode */}
      <section id="features" className="py-32 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-block px-6 py-3 bg-gradient-to-r from-primary-100 to-success-100 dark:from-primary-900/40 dark:to-success-900/40 rounded-full mb-4 border border-primary-200 dark:border-primary-700">
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('features.badge')}
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6">
              {t('features.title')}{' '}
              <span className="bg-gradient-to-r from-primary-600 to-success-600 bg-clip-text text-transparent">
                {t('features.titleBrand')}
              </span>
              {' '}{t('features.titleEnd')}
            </h2>
            <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-10 h-10" />,
                title: t('features.instant.title'),
                description: t('features.instant.description'),
                gradient: 'from-featured-400 to-featured-600',
                stats: t('features.instant.stats'),
              },
              {
                icon: <Bell className="w-10 h-10" />,
                title: t('features.alerts.title'),
                description: t('features.alerts.description'),
                gradient: 'from-warning-400 to-warning-600',
                stats: t('features.alerts.stats'),
              },
              {
                icon: <Shield className="w-10 h-10" />,
                title: t('features.trusted.title'),
                description: t('features.trusted.description'),
                gradient: 'from-success-400 to-success-600',
                stats: t('features.trusted.stats'),
              },
              {
                icon: <BarChart3 className="w-10 h-10" />,
                title: t('features.analytics.title'),
                description: t('features.analytics.description'),
                gradient: 'from-primary-400 to-primary-600',
                stats: t('features.analytics.stats'),
              },
              {
                icon: <Heart className="w-10 h-10" />,
                title: t('features.wishlist.title'),
                description: t('features.wishlist.description'),
                gradient: 'from-warning-400 to-warning-600',
                stats: t('features.wishlist.stats'),
              },
              {
                icon: <Gift className="w-10 h-10" />,
                title: t('features.deals.title'),
                gradient: 'from-success-400 to-success-600',
                description: t('features.deals.description'),
                stats: t('features.deals.stats'),
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group relative"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s backwards`,
                }}
              >
                {/* Glow effect on hover */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${feature.gradient} rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition duration-500`} />

                {/* Card content */}
                <div className="relative h-full p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-transparent transition duration-500 group-hover:shadow-2xl group-hover:-translate-y-3 overflow-hidden">
                  {/* Background gradient on hover */}
                  <div className={`absolute top-0 end-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 rounded-full filter blur-3xl transition duration-500`} />

                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} text-white mb-6 group-hover:scale-110 transition-all duration-300 shadow-xl relative z-10`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 transition duration-300 relative z-10">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 relative z-10">
                    {feature.description}
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full relative z-10">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${feature.gradient} animate-pulse`} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {feature.stats}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Enhanced */}
      <section id="how-it-works" className="py-32 bg-gradient-to-br from-blue-50 via-green-50 to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-block px-6 py-3 bg-white dark:bg-gray-900 backdrop-blur-sm rounded-full mb-4 border border-gray-200 dark:border-gray-700">
              <span className="text-sm font-bold bg-gradient-to-r from-primary-600 to-success-600 bg-clip-text text-transparent flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                {t('howItWorks.badge')}
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6">
              {t('howItWorks.title')}
            </h2>
            <p className="text-xl text-gray-800 dark:text-gray-300">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="relative max-w-5xl mx-auto">
            {/* Connection line */}
            <div className="hidden md:block absolute top-1/2 start-0 end-0 h-1 bg-gradient-to-r from-primary-300 via-success-300 to-featured-300 dark:from-primary-700 dark:via-success-700 dark:to-featured-700 transform -translate-y-1/2" />

            <div className="grid md:grid-cols-3 gap-8 relative">
              {[
                {
                  step: '01',
                  title: t('howItWorks.step1.title'),
                  description: t('howItWorks.step1.description'),
                  icon: <Search className="w-16 h-16" />,
                  color: 'from-primary-500 to-primary-700',
                },
                {
                  step: '02',
                  title: t('howItWorks.step2.title'),
                  description: t('howItWorks.step2.description'),
                  icon: <BarChart3 className="w-16 h-16" />,
                  color: 'from-success-500 to-success-700',
                },
                {
                  step: '03',
                  title: t('howItWorks.step3.title'),
                  description: t('howItWorks.step3.description'),
                  icon: <Gift className="w-16 h-16" />,
                  color: 'from-featured-500 to-featured-700',
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className="relative group"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${idx * 0.2}s backwards`,
                  }}
                >
                  {/* Step number badge */}
                  <div className="absolute -top-6 start-1/2 transform -translate-x-1/2 z-10">
                    <div className={`relative w-16 h-16 bg-gradient-to-br ${step.color} rounded-full flex items-center justify-center text-white font-black text-2xl shadow-2xl group-hover:scale-125 transition-all duration-300`}>
                      {idx + 1}
                      <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-30 transition duration-300" />
                    </div>
                  </div>

                  {/* Card */}
                  <div className="mt-8 p-8 bg-white dark:bg-gray-900 backdrop-blur-xl rounded-3xl shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-4 border border-gray-200 dark:border-gray-800">
                    <div className={`mx-auto w-24 h-24 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300 shadow-xl`}>
                      {step.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                      {step.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                      {step.description}
                    </p>

                    {/* Arrow to next step */}
                    {idx < 2 && (
                      <div className={`hidden md:block absolute top-1/2 ${isRTL ? 'start-auto -end-12' : '-end-12'} transform -translate-y-1/2 text-primary-400 dark:text-primary-600 animate-pulse`}>
                        <ArrowRight className={`w-8 h-8 ${isRTL ? 'rotate-180' : ''}`} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-16">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-3 px-12 py-5 bg-gradient-to-r from-primary-700 to-success-700 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-primary-600/30 dark:hover:shadow-primary-600/20 transform hover:scale-105 transition-all duration-300 shadow-lg"
              style={{ color: '#ffffff' }}
            >
              <span className="relative" style={{
                textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8)',
                color: '#ffffff'
              }}>
                {t('button.startSavingNow')}
              </span>
              <Sparkles className="w-6 h-6 animate-pulse" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Counter - Enhanced with Dark Mode */}
      <section className="py-24 bg-gradient-to-r from-primary-50 via-success-50 to-primary-50 dark:from-primary-600 dark:via-success-600 dark:to-primary-600 relative overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 start-0 w-full h-full" style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            animation: 'moveBackground 20s linear infinite'
          }} />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              {
                value: '100K+',
                label: t('stats.happyUsers'),
                icon: <Users className="w-12 h-12 mx-auto mb-4 text-primary-600 dark:text-white" />
              },
              {
                value: '5+',
                label: t('stats.trustedStores'),
                icon: <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-success-600 dark:text-white" />
              },
              {
                value: '50K+',
                label: t('stats.products'),
                icon: <BarChart3 className="w-12 h-12 mx-auto mb-4 text-primary-600 dark:text-white" />
              },
              {
                value: '60%',
                label: t('stats.avgSavings'),
                icon: <TrendingUp className="w-12 h-12 mx-auto mb-4 text-success-600 dark:text-white" />
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="group transform hover:scale-110 transition-transform duration-300"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s backwards`,
                }}
              >
                <div className="group-hover:animate-bounce">
                  {stat.icon}
                </div>
                <div className="text-6xl md:text-7xl font-black mb-3 drop-shadow-lg text-gray-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-xl font-semibold text-gray-700 dark:text-white/90">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="absolute top-0 start-0 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full filter blur-3xl" />
        <div className="absolute bottom-0 end-0 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full filter blur-3xl" />
      </section>

      {/* Testimonials - Enhanced */}
      <section id="testimonials" className="py-32 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-block px-6 py-3 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4 border border-primary-200 dark:border-primary-700">
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400 flex items-center gap-2">
                <Award className="w-4 h-4" />
                {t('testimonials.badge')}
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white mb-6">
              {t('testimonials.title')}{' '}
              <span className="bg-gradient-to-r from-primary-600 to-success-600 bg-clip-text text-transparent">
                {t('testimonials.titleBrand')}
              </span>
              {' '}{locale === 'en' && t('testimonials.titleEnd')}
            </h2>
            <p className="text-xl text-gray-700 dark:text-gray-300">
              {t('testimonials.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: t('testimonials.user1.name'),
                role: t('testimonials.user1.role'),
                avatar: locale === 'ar' ? 'أ' : 'A',
                comment: t('testimonials.user1.comment'),
                rating: 5,
                saved: t('testimonials.user1.saved'),
              },
              {
                name: t('testimonials.user2.name'),
                role: t('testimonials.user2.role'),
                avatar: locale === 'ar' ? 'س' : 'S',
                comment: t('testimonials.user2.comment'),
                rating: 5,
                saved: t('testimonials.user2.saved'),
              },
              {
                name: t('testimonials.user3.name'),
                role: t('testimonials.user3.role'),
                avatar: locale === 'ar' ? 'خ' : 'K',
                comment: t('testimonials.user3.comment'),
                rating: 5,
                saved: t('testimonials.user3.saved'),
              },
            ].map((testimonial, idx) => (
              <div
                key={idx}
                className="group relative p-8 bg-white dark:bg-gray-900 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-3 border border-gray-200 dark:border-gray-800"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s backwards`,
                }}
              >
                {/* Quote mark */}
                <div className={`absolute top-8 ${isRTL ? 'start-8' : 'end-8'} text-6xl text-primary-200 dark:text-primary-900 opacity-50`}>
                  "
                </div>

                {/* Rating stars */}
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-featured-400 text-featured-400" />
                  ))}
                </div>

                {/* Comment */}
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 leading-relaxed relative z-10 italic">
                  "{testimonial.comment}"
                </p>

                {/* User info */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-success-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:rotate-12 transition-transform duration-300">
                    {testimonial.avatar}
                  </div>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <div className="font-bold text-lg text-gray-900 dark:text-white">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {testimonial.role}
                    </div>
                  </div>
                </div>

                {/* Savings badge */}
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-success-100 dark:bg-success-900/30 rounded-full border border-success-200 dark:border-success-800">
                  <Percent className="w-4 h-4 text-success-600 dark:text-success-400" />
                  <span className="text-sm font-bold text-success-700 dark:text-success-300 flex items-center gap-1">
                    {t('testimonials.saved')} <Price amount={parseFloat(testimonial.saved.replace(',', ''))} className="inline text-sm font-bold" symbolClassName="w-5 h-5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Enhanced */}
      <section className="relative py-32 bg-gradient-to-br from-primary-50 via-success-50 to-primary-50 dark:from-primary-600 dark:via-success-600 dark:to-primary-600 overflow-hidden">
        {/* Animated blobs */}
        <div className="absolute inset-0">
          <div className="absolute top-0 start-0 w-96 h-96 bg-white/20 dark:bg-white/10 rounded-full filter blur-3xl animate-blob" />
          <div className="absolute bottom-0 end-0 w-96 h-96 bg-white/20 dark:bg-white/10 rounded-full filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/2 start-1/2 w-96 h-96 bg-white/10 dark:bg-white/5 rounded-full filter blur-3xl animate-blob animation-delay-4000" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-6xl animate-bounce">
              ⭐✨💰
            </div>

            <h2 className="text-5xl md:text-7xl font-black leading-tight text-gray-900 dark:text-white">
              {t('cta.title')}
            </h2>

            <p className="text-2xl md:text-3xl text-gray-700 dark:text-white/90 font-light">
              {t('cta.subtitle')}{' '}
              <span className="font-bold text-gray-900 dark:text-white">{t('cta.subtitleBold')}</span>{' '}
              {t('cta.subtitleEnd')}
            </p>

            {/* Benefits badges */}
            <div className="flex flex-wrap justify-center gap-4 py-8">
              {[
                { text: t('cta.benefit1'), icon: <Check className="w-5 h-5" /> },
                { text: t('cta.benefit2'), icon: <Shield className="w-5 h-5" /> },
                { text: t('cta.benefit3'), icon: <Zap className="w-5 h-5" /> },
                { text: t('cta.benefit4'), icon: <Gift className="w-5 h-5" /> },
              ].map((benefit, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/20 backdrop-blur-sm rounded-full text-lg font-semibold border border-gray-200 dark:border-white/30 hover:bg-gray-50 dark:hover:bg-white/30 transition-all hover:scale-105 text-gray-700 dark:text-white"
                >
                  {benefit.icon}
                  {benefit.text}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-4">
              {!authLoading && user ? (
                <Link
                  href={`/${locale}/dashboard`}
                  className="group relative px-16 py-6 bg-gradient-to-r from-primary-600 to-primary-800 dark:bg-white text-white dark:text-primary-600 rounded-2xl font-black text-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    Go to Dashboard
                    <Sparkles className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-700 to-success-600 dark:from-primary-50 dark:to-success-50 opacity-0 group-hover:opacity-100 transition duration-300" />
                </Link>
              ) : (
                <Link
                  href={`/${locale}/auth/signup`}
                  className="group relative px-16 py-6 bg-gradient-to-r from-primary-600 to-primary-800 dark:bg-white text-white dark:text-primary-600 rounded-2xl font-black text-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    {t('button.startFreeNow')}
                    <Sparkles className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-700 to-success-600 dark:from-primary-50 dark:to-success-50 opacity-0 group-hover:opacity-100 transition duration-300" />
                </Link>
              )}
              <Link
                href={`/${locale}/products`}
                className="px-16 py-6 bg-transparent border-3 border-primary-600 dark:border-white text-primary-600 dark:text-white rounded-2xl font-black text-xl hover:bg-primary-600 hover:text-white dark:hover:bg-white dark:hover:text-primary-600 transition-all duration-300 flex items-center gap-3 justify-center hover:scale-105 transform"
              >
                {t('button.browseProductsShort')}
                <ArrowRight className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            </div>

            {/* Security badge */}
            <div className="pt-8">
              <p className="text-sm text-gray-600 dark:text-white/80 flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" />
                <span>{t('cta.security')}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Enhanced with Dark Mode */}
      <footer className="bg-gray-50 dark:bg-gray-900 py-16 border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-success-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {t('app.initial')}
                </div>
                <span className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-success-600 dark:from-primary-400 dark:to-success-400 bg-clip-text text-transparent">
                  {t('app.name')}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('footer.description')}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
                {t('footer.quickLinks')}
              </h4>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                {[
                  { href: `/${locale}/products`, label: t('footer.products') },
                  { href: `/${locale}/stores`, label: t('footer.stores') },
                  { href: `/${locale}/deals`, label: t('footer.deals') },
                  { href: '/about', label: t('footer.about') },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-primary-600 dark:hover:text-primary-400 transition flex items-center gap-2 group"
                    >
                      <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
                {t('footer.support')}
              </h4>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                {[
                  { href: '/help', label: t('footer.helpCenter') },
                  { href: '/contact', label: t('footer.contact') },
                  { href: '/privacy', label: t('footer.privacy') },
                  { href: '/terms', label: t('footer.terms') },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-primary-600 dark:hover:text-primary-400 transition flex items-center gap-2 group"
                    >
                      <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h4 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">
                {t('footer.newsletter')}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('footer.newsletterDescription')}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('footer.emailPlaceholder')}
                  className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-700"
                />
                <button className="px-6 py-3 bg-gradient-to-r from-primary-600 to-success-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all">
                  {t('button.subscribe')}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 dark:text-gray-400 text-center md:text-start">
              {t('footer.copyright')}
            </p>
            <div className="flex gap-4">
              {['𝕏', 'in', 'f', '📷'].map((social, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gradient-to-br hover:from-primary-600 hover:to-success-600 hover:border-transparent rounded-xl flex items-center justify-center transition transform hover:scale-110 hover:-translate-y-1 text-gray-700 dark:text-white hover:text-white"
                >
                  <span className="text-xl">{social}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(20px, -50px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          75% {
            transform: translate(50px, 50px) scale(1.05);
          }
        }

        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes gradient-x {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes moveBackground {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 50px 50px;
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-1000 {
          animation-delay: 1s;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animate-gradient {
          animation: gradient 3s ease infinite;
          background-size: 200% 200%;
        }

        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
