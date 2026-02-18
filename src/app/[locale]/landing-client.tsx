'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from '@/lib/simple-intl-provider';
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
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  Gift,
  Globe,
  Headphones,
  Heart,
  Languages,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Moon,
  Percent,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Sun,
  Target,
  User,
  Users,
  X,
  Zap,
  Menu,
} from 'lucide-react';

const EMOJI_REGEX =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

function stripEmojis(value: string): string {
  return value.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ─── Gradient palettes for feature icons ─── */
const FEATURE_GRADIENTS = [
  'from-blue-500 to-cyan-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-violet-500 to-purple-400',
  'from-rose-500 to-pink-400',
  'from-sky-500 to-indigo-400',
];

const AVATAR_GRADIENTS = [
  'from-blue-600 to-cyan-500',
  'from-violet-600 to-purple-500',
  'from-amber-600 to-orange-500',
];

export default function LandingPageClient() {
  const t = useTranslations();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingText, setTypingText] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const tx = (key: string) => stripEmojis(String(t(key)));

  /* ─── Mount & scroll ─── */
  useEffect(() => {
    const mountTimer = window.setTimeout(() => setMounted(true), 0);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearTimeout(mountTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /* ─── Typing animation for search placeholder ─── */
  useEffect(() => {
    if (!mounted) return;

    const products = isRTL
      ? ['آيفون 15 برو ماكس', 'ماك بوك اير M3', 'سوني WH-1000XM5', 'سامسونج جالكسي S24', 'آيباد برو M4']
      : ['iPhone 15 Pro Max', 'MacBook Air M3', 'Sony WH-1000XM5', 'Samsung Galaxy S24', 'iPad Pro M4'];
    let idx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = products[idx];
      if (!deleting) {
        charIdx++;
        setTypingText(word.slice(0, charIdx));
        if (charIdx === word.length) {
          deleting = true;
          timer = setTimeout(tick, 2000);
          return;
        }
        timer = setTimeout(tick, 80);
      } else {
        charIdx--;
        setTypingText(word.slice(0, charIdx));
        if (charIdx === 0) {
          deleting = false;
          idx = (idx + 1) % products.length;
          timer = setTimeout(tick, 400);
          return;
        }
        timer = setTimeout(tick, 40);
      }
    };

    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [mounted]);

  /* ─── Intersection Observer for scroll-triggered reveals ─── */
  useEffect(() => {
    if (!mounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );

    requestAnimationFrame(() => {
      document.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el));
    });

    return () => observer.disconnect();
  }, [mounted]);

  const switchLocale = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    if (!pathname) {
      router.push(`/${nextLocale}`);
      return;
    }
    const nextPath = pathname.startsWith(`/${locale}`)
      ? pathname.replace(`/${locale}`, `/${nextLocale}`)
      : `/${nextLocale}`;
    router.push(nextPath);
  };

  const handleSearch = (forcedQuery?: string) => {
    const query = (forcedQuery ?? searchQuery).trim();
    if (!query) {
      router.push(`/${locale}/products`);
      return;
    }
    router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
  };

  /* ─── Data ─── */

  const menuCopy = useMemo(
    () => ({
      dashboard: isRTL ? 'لوحة التحكم' : 'Dashboard',
      settings: isRTL ? 'الإعدادات' : 'Settings',
      signOut: isRTL ? 'تسجيل الخروج' : 'Sign Out',
      profileFallback: isRTL ? 'مستخدم' : 'User',
      compareNow: isRTL ? 'قارن الآن' : 'Compare Now',
      liveScan: isRTL ? 'فحص مباشر للأسعار' : 'Live Price Scan',
    }),
    [isRTL]
  );

  const navLinks = [
    { href: '#features', label: tx('nav.features') },
    { href: '#how-it-works', label: tx('nav.howItWorks') },
    { href: '#stores', label: tx('nav.stores') },
    { href: '#testimonials', label: tx('nav.testimonials') },
  ];

  const quickSearches = isRTL
    ? [
        { icon: <Smartphone className="h-4 w-4" />, query: 'آيفون 15 برو' },
        { icon: <Laptop className="h-4 w-4" />, query: 'ماك بوك اير M3' },
        { icon: <Headphones className="h-4 w-4" />, query: 'سوني WH-1000XM5' },
      ]
    : [
        { icon: <Smartphone className="h-4 w-4" />, query: 'iPhone 15 Pro' },
        { icon: <Laptop className="h-4 w-4" />, query: 'MacBook Air M3' },
        { icon: <Headphones className="h-4 w-4" />, query: 'Sony WH-1000XM5' },
      ];

  const heroStats = [
    { icon: <Users className="h-5 w-5" />, value: '100K+', label: tx('stats.activeUsers') },
    { icon: <Star className="h-5 w-5" />, value: '4.9', label: tx('stats.rating') },
    { icon: <Store className="h-5 w-5" />, value: '5+', label: tx('stats.trustedStores') },
    { icon: <Percent className="h-5 w-5" />, value: '60%', label: tx('stats.avgSavings') },
  ];

  const stores = [
    { name: 'Amazon.sa', icon: Globe, tone: 'from-amber-500/20 to-orange-500/20' },
    { name: 'Noon', icon: Sparkles, tone: 'from-primary/20 to-secondary/20' },
    { name: 'Jarir', icon: Store, tone: 'from-rose-500/20 to-red-500/20' },
    { name: 'Extra', icon: ShoppingCart, tone: 'from-cyan-500/20 to-primary/20' },
    { name: 'Almanea', icon: Shield, tone: 'from-emerald-500/20 to-success/20' },
  ];

  const marqueeStoreCycles = 4;
  const marqueeStores = Array.from({ length: marqueeStoreCycles }, () => stores).flat();

  const features = [
    {
      icon: Zap,
      title: tx('features.instant.title'),
      description: tx('features.instant.description'),
      stat: tx('features.instant.stats'),
    },
    {
      icon: Bell,
      title: tx('features.alerts.title'),
      description: tx('features.alerts.description'),
      stat: tx('features.alerts.stats'),
    },
    {
      icon: Shield,
      title: tx('features.trusted.title'),
      description: tx('features.trusted.description'),
      stat: tx('features.trusted.stats'),
    },
    {
      icon: BarChart3,
      title: tx('features.analytics.title'),
      description: tx('features.analytics.description'),
      stat: tx('features.analytics.stats'),
    },
    {
      icon: Heart,
      title: tx('features.wishlist.title'),
      description: tx('features.wishlist.description'),
      stat: tx('features.wishlist.stats'),
    },
    {
      icon: Gift,
      title: tx('features.deals.title'),
      description: tx('features.deals.description'),
      stat: tx('features.deals.stats'),
    },
  ];

  const steps = [
    {
      step: '01',
      icon: Search,
      title: tx('howItWorks.step1.title'),
      description: tx('howItWorks.step1.description'),
    },
    {
      step: '02',
      icon: BarChart3,
      title: tx('howItWorks.step2.title'),
      description: tx('howItWorks.step2.description'),
    },
    {
      step: '03',
      icon: Target,
      title: tx('howItWorks.step3.title'),
      description: tx('howItWorks.step3.description'),
    },
  ];

  const testimonials = [
    {
      name: tx('testimonials.user1.name'),
      role: tx('testimonials.user1.role'),
      comment: tx('testimonials.user1.comment'),
      saved: parseNumber(tx('testimonials.user1.saved')),
    },
    {
      name: tx('testimonials.user2.name'),
      role: tx('testimonials.user2.role'),
      comment: tx('testimonials.user2.comment'),
      saved: parseNumber(tx('testimonials.user2.saved')),
    },
    {
      name: tx('testimonials.user3.name'),
      role: tx('testimonials.user3.role'),
      comment: tx('testimonials.user3.comment'),
      saved: parseNumber(tx('testimonials.user3.saved')),
    },
  ];

  const footerPrimary = [
    { href: `/${locale}/products`, label: tx('footer.products') },
    { href: `/${locale}/stores`, label: tx('footer.stores') },
    { href: `/${locale}/deals`, label: tx('footer.deals') },
    { href: `/${locale}/search`, label: tx('button.search') },
  ];

  const footerSupport = [
    { href: `/${locale}/privacy`, label: tx('footer.privacy') },
    { href: `/${locale}/terms`, label: tx('footer.terms') },
    { href: `/${locale}/auth/login`, label: tx('nav.login') },
    { href: `/${locale}/auth/signup`, label: tx('nav.startFree') },
  ];

  /* ═══════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════ */

  return (
    <div className="relative min-h-screen overflow-x-clip bg-surface text-on-surface">
      {/* ─── Animated Gradient Mesh Background ─── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(100,116,139,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* ═══════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════ */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrollY > 16
            ? 'border-b border-outline-variant/50 bg-surface/80 shadow-sm backdrop-blur-2xl'
            : 'bg-transparent backdrop-blur-sm'
        }`}
      >
        <div className="container mx-auto flex h-[4.5rem] items-center justify-between px-4">
          {/* Logo with glow ring on hover */}
          <Link href={`/${locale}`} className="group flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-2xl bg-primary/20 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0a2f7e] to-primary text-lg font-black text-white shadow-sm shadow-primary/15">
                {tx('app.initial')}
              </div>
            </div>
            <span className="text-lg font-bold tracking-tight text-on-surface">
              {tx('app.name')}
            </span>
          </Link>

          {/* Nav — pill-shaped hover indicator */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-xl border border-outline-variant/50 bg-surface-container-low/50 p-2.5 backdrop-blur-sm transition hover:border-primary/40 hover:bg-surface-container"
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-warning" />
                ) : (
                  <Moon className="h-5 w-5 text-primary" />
                )
              ) : (
                <div className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={switchLocale}
              className="flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-low/50 px-3 py-2.5 text-sm font-semibold text-on-surface backdrop-blur-sm transition hover:border-primary/40 hover:bg-surface-container"
              aria-label="Toggle language"
            >
              <Languages className="h-4 w-4 text-primary" />
              <span>{locale === 'ar' ? 'EN' : 'AR'}</span>
            </button>

            {/* Mobile hamburger — after theme & language buttons */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl border border-outline-variant/50 bg-surface-container-low/50 p-2.5 backdrop-blur-sm transition hover:border-primary/40 hover:bg-surface-container md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-on-surface" />
              ) : (
                <Menu className="h-5 w-5 text-on-surface" />
              )}
            </button>

            {authLoading ? (
              <div className="h-9 w-9 animate-pulse rounded-full bg-surface-container-high" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-2 py-1.5 transition hover:bg-surface-container">
                    <Avatar className="h-7 w-7">
                      <AvatarImage
                        src={user.avatar_url || undefined}
                        alt={user.full_name || user.email || menuCopy.profileFallback}
                      />
                      <AvatarFallback className="bg-primary text-xs text-white">
                        {user.full_name
                          ? user.full_name
                              .split(' ')
                              .map((part) => part[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)
                          : user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-28 truncate text-sm text-on-surface-variant sm:block">
                      {user.full_name || user.email?.split('@')[0] || menuCopy.profileFallback}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold">
                        {user.full_name || menuCopy.profileFallback}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/dashboard`} className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{menuCopy.dashboard}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/profile`} className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>{menuCopy.settings}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      router.push(`/${locale}`);
                    }}
                    className="flex cursor-pointer items-center gap-2 text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{menuCopy.signOut}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href={`/${locale}/auth/login`}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:text-primary"
                >
                  {tx('nav.login')}
                </Link>
                <Link
                  href={`/${locale}/auth/signup`}
                  className="shimmer-btn relative overflow-hidden rounded-full bg-gradient-to-r from-[#0a2f7e] to-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/15 transition hover:shadow-md hover:shadow-primary/20"
                >
                  <span className="relative z-10">{tx('nav.startFree')}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu panel */}
      <div
        className={`fixed inset-x-0 top-[4.5rem] z-40 transform transition-all duration-300 md:hidden ${
          mobileMenuOpen
            ? 'translate-y-0 opacity-100'
            : '-translate-y-4 pointer-events-none opacity-0'
        }`}
      >
        <div className="mx-4 rounded-2xl border-2 border-gray-300 bg-gray-50 shadow-2xl dark:border-gray-500 dark:bg-[#1a1a2e] dark:shadow-black/50">
          <nav className="flex flex-col p-3 gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {!user && !authLoading && (
            <div className="flex flex-col gap-2 border-t border-outline-variant/30 p-3">
              <Link
                href={`/${locale}/auth/login`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-center text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container"
              >
                {tx('nav.login')}
              </Link>
              <Link
                href={`/${locale}/auth/signup`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-gradient-to-r from-[#0a2f7e] to-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-sm"
              >
                {tx('nav.startFree')}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN
          ═══════════════════════════════════════════ */}
      <main className="relative">
        {/* ─── Hero Section — Split Layout ─── */}
        <section className="relative overflow-hidden pt-32 pb-28 sm:pt-36 lg:pt-40 lg:pb-36">
          {/* Parallax glow ring */}
          <div
            className="pointer-events-none absolute start-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/20 via-secondary/10 to-transparent blur-3xl"
            style={{ transform: `translateY(${scrollY * 0.12}px)` }}
          />

          <div className="container mx-auto px-4">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* ── Left: Text + Search ── */}
              <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-none lg:text-start">
                {/* Badge with shimmer */}
                <div className="scroll-reveal inline-flex">
                  <span className="shimmer-badge relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span>{tx('hero.badge')}</span>
                  </span>
                </div>

                {/* Headline */}
                <h1 className="scroll-reveal mt-6 text-balance text-4xl font-black leading-[1.1] sm:text-5xl lg:text-7xl">
                  <span className="text-on-surface">{tx('hero.saveUpTo')} </span>
                  <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_auto] bg-clip-text text-transparent">
                    60%
                  </span>
                  <br />
                  <span className="text-on-surface">{tx('hero.onPurchases')}</span>
                </h1>

                {/* Description */}
                <p className="scroll-reveal mx-auto mt-6 max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg lg:mx-0">
                  {tx('hero.description')}{' '}
                  <span className="font-semibold text-on-surface">{tx('hero.descriptionBold')}</span>{' '}
                  {tx('hero.descriptionEnd')}. {tx('hero.tagline')}
                </p>

                {/* Search bar — pill-shaped with animated glow border */}
                <div className="scroll-reveal relative mx-auto mt-8 max-w-xl lg:mx-0">
                  <div className="search-glow-border rounded-full p-[2px] transition-shadow focus-within:shadow-[0_0_0_3px_rgba(13,71,161,0.25)]">
                    <div className="flex items-center gap-3 rounded-full bg-surface py-2 pe-2 ps-5 shadow-sm">
                      <Search className="h-5 w-5 shrink-0 text-primary" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleSearch();
                        }}
                        placeholder={mounted && typingText ? typingText : tx('hero.searchPlaceholder')}
                        style={{ outline: 'none' }}
                        className={`min-w-0 flex-1 bg-transparent py-2 text-base font-medium text-on-surface placeholder:text-on-surface-variant/60 sm:text-lg ${
                          isRTL ? 'text-right' : 'text-left'
                        }`}
                      />
                      <button
                        onClick={() => handleSearch()}
                        disabled={!searchQuery.trim()}
                        className={`group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition sm:px-8 ${
                          searchQuery.trim()
                            ? 'bg-gradient-to-r from-[#0a2f7e] to-primary text-white shadow-sm shadow-primary/15 hover:shadow-md hover:shadow-primary/20'
                            : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'
                        }`}
                      >
                        <span className="hidden sm:inline">{tx('button.search')}</span>
                        <ArrowRight
                          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
                            isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick searches */}
                <div className="scroll-reveal mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span className="me-1 text-xs font-medium text-on-surface-variant">
                    {tx('hero.popular')}
                  </span>
                  {quickSearches.map((item) => (
                    <button
                      key={item.query}
                      onClick={() => {
                        setSearchQuery(item.query);
                        handleSearch(item.query);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface/80 px-3 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur-sm transition hover:border-primary/40 hover:text-primary"
                    >
                      {item.icon}
                      <span>{item.query}</span>
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="scroll-reveal mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                  <Link
                    href={`/${locale}/products`}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0a2f7e] to-primary px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-primary/15 transition hover:shadow-md hover:shadow-primary/20"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span>{tx('button.browseProducts')}</span>
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface/80 px-6 py-3.5 text-sm font-semibold text-on-surface backdrop-blur-sm transition hover:border-primary/40 hover:text-primary"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>{tx('button.howItWorks')}</span>
                  </Link>
                </div>
              </div>

              {/* ── Right: Floating Price Comparison Mockup ── */}
              <div className="hidden lg:flex lg:items-center lg:justify-center">
                <div className="mockup-float relative">
                  {/* Glow behind card */}
                  <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/5 to-success/10 blur-3xl" />

                  <div className="relative w-[340px] rounded-2xl border border-outline-variant/30 bg-surface/90 p-5 shadow-sm backdrop-blur-xl">
                    {/* Product header */}
                    <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{isRTL ? 'آيفون 15 برو ماكس' : 'iPhone 15 Pro Max'}</p>
                        <p className="text-xs text-on-surface-variant">{isRTL ? '256 جيجا · تيتانيوم طبيعي' : '256GB · Natural Titanium'}</p>
                      </div>
                    </div>

                    {/* Store prices */}
                    <div className="mt-4 space-y-2">
                      {/* Best price */}
                      <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/10 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium text-on-surface">Amazon.sa</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-success" />
                          <Price
                            amount={4199}
                            className="text-sm font-bold tabular-nums text-success"
                            symbolClassName="h-3.5 w-3.5 fill-success"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-on-surface">Noon</span>
                        </div>
                        <Price
                          amount={4399}
                          className="text-sm font-medium tabular-nums text-on-surface-variant"
                          symbolClassName="h-3.5 w-3.5"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-rose-500" />
                          <span className="text-sm font-medium text-on-surface">Jarir</span>
                        </div>
                        <Price
                          amount={4599}
                          className="text-sm font-medium tabular-nums text-on-surface-variant"
                          symbolClassName="h-3.5 w-3.5"
                        />
                      </div>
                    </div>

                    {/* Savings */}
                    <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-success/10 px-4 py-3">
                      <Percent className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-on-surface">{isRTL ? 'وفّر حتى' : 'Save up to'}</span>
                      <Price
                        amount={400}
                        className="text-sm font-bold text-success"
                        symbolClassName="h-3.5 w-3.5 fill-success"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Stats Floating Bar — Glass Morphism ─── */}
        <div className="relative z-10 -mt-14">
          <div className="container mx-auto px-4">
            <div className="scroll-reveal mx-auto max-w-5xl rounded-2xl border border-outline-variant/40 bg-surface/70 p-6 shadow-sm backdrop-blur-xl sm:p-8">
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {stat.icon}
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-on-surface">{stat.value}</p>
                    <p className="text-xs text-on-surface-variant">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            STORES — Infinite Marquee
            ═══════════════════════════════════════════ */}
        <section id="stores" className="py-20">
          <div className="container mx-auto px-4">
            <div className="scroll-reveal mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Store className="h-4 w-4" />
                {tx('stores.title')}
              </p>
              <h2 className="text-3xl font-black text-on-surface sm:text-4xl">{tx('stores.subtitle')}</h2>
            </div>
          </div>

          {/* Marquee */}
          <div className="marquee-container relative overflow-hidden px-4 py-4" dir="ltr">
            <div className="pointer-events-none absolute inset-y-0 start-0 z-10 w-16 bg-gradient-to-r from-surface to-transparent sm:w-24" />
            <div className="pointer-events-none absolute inset-y-0 end-0 z-10 w-16 bg-gradient-to-l from-surface to-transparent sm:w-24" />

            <div
              className={`marquee-track ${isRTL ? 'marquee-rtl' : ''}`}
              style={{ '--marquee-duration': `${marqueeStoreCycles * 30}s` } as React.CSSProperties}
            >
              {[0, 1].map((duplicateIndex) => (
                <div key={`stores-strip-${duplicateIndex}`} className="marquee-group">
                  {marqueeStores.map((store, storeIndex) => (
                    <div
                      key={`${store.name}-${duplicateIndex}-${storeIndex}`}
                      className="group relative flex w-52 shrink-0 flex-col gap-4 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 transition-transform duration-300 hover:scale-105 hover:border-primary/30 hover:shadow-md dark:bg-surface-container"
                      aria-hidden={duplicateIndex === 1 || storeIndex >= stores.length ? 'true' : undefined}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${store.tone} opacity-0 transition group-hover:opacity-100`} />
                      <div className="relative z-10 flex flex-col gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-primary transition group-hover:scale-110 dark:bg-surface-container-high">
                          <store.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-on-surface">{store.name}</p>
                          <p className="text-sm text-on-surface-variant">{tx('features.trusted.stats')}</p>
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <Check className="h-4 w-4" />
                          <span>{tx('features.trusted.title')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FEATURES — Bento Grid
            ═══════════════════════════════════════════ */}
        <section id="features" className="py-24">
          <div className="container mx-auto px-4">
            <div className="scroll-reveal mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                <Sparkles className="h-4 w-4" />
                {tx('features.badge')}
              </p>
              <h2 className="text-3xl font-black text-on-surface sm:text-4xl">
                {tx('features.title')}{' '}
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {tx('features.titleBrand')}
                </span>{' '}
                {tx('features.titleEnd')}
              </h2>
              <p className="mt-4 text-base text-on-surface-variant sm:text-lg">{tx('features.subtitle')}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className="scroll-reveal group rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-md dark:bg-surface-container"
                  style={{ '--reveal-delay': `${index * 80}ms` } as React.CSSProperties}
                >
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${FEATURE_GRADIENTS[index]} text-white transition group-hover:scale-110`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-on-surface">{feature.title}</h3>
                  <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">{feature.description}</p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface-variant">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>{feature.stat}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            HOW IT WORKS — Horizontal Timeline
            ═══════════════════════════════════════════ */}
        <section id="how-it-works" className="py-24">
          <div className="container mx-auto px-4">
            <div className="scroll-reveal mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-success">
                <Target className="h-4 w-4" />
                {tx('howItWorks.badge')}
              </p>
              <h2 className="text-3xl font-black text-on-surface sm:text-4xl">{tx('howItWorks.title')}</h2>
              <p className="mt-4 text-base text-on-surface-variant sm:text-lg">{tx('howItWorks.subtitle')}</p>
            </div>

            {/* Desktop: Horizontal Timeline */}
            <div className="hidden lg:block">
              <div className="relative mx-auto max-w-5xl">
                {/* Connecting dashed line */}
                <div className="timeline-line absolute top-[3.5rem] h-[2px] border-t-2 border-dashed border-primary/30" style={{ insetInlineStart: '16.67%', insetInlineEnd: '16.67%' }} />

                <div className="grid grid-cols-3 gap-8">
                  {steps.map((step, index) => (
                    <div key={step.step} className="scroll-reveal group relative text-center" style={{ '--reveal-delay': `${index * 150}ms` } as React.CSSProperties}>
                      {/* Step number */}
                      <div className="relative z-10 mx-auto mb-6 flex h-[7rem] w-[7rem] items-center justify-center rounded-3xl bg-gradient-to-br from-[#0a2f7e] to-primary text-4xl font-black text-white shadow-md shadow-primary/15 transition group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-primary/20">
                        {step.step}
                      </div>
                      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-on-surface">{step.title}</h3>
                      <p className="mx-auto max-w-xs text-sm leading-relaxed text-on-surface-variant">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile: Vertical Timeline */}
            <div className="lg:hidden">
              <div className="relative space-y-8">
                {/* Vertical dashed line */}
                <div className="absolute bottom-0 top-0 w-[2px] border-s-2 border-dashed border-primary/30" style={{ insetInlineStart: '1.75rem' }} />

                {steps.map((step, index) => (
                  <div key={step.step} className="scroll-reveal relative flex gap-5" style={{ '--reveal-delay': `${index * 120}ms` } as React.CSSProperties}>
                    <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a2f7e] to-primary text-xl font-black text-white shadow-sm shadow-primary/15">
                      {step.step}
                    </div>
                    <div className="pt-2">
                      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <step.icon className="h-4 w-4" />
                      </div>
                      <h3 className="mb-1 text-lg font-bold text-on-surface">{step.title}</h3>
                      <p className="text-sm leading-relaxed text-on-surface-variant">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="scroll-reveal mt-12 text-center">
              <Link
                href={user ? `/${locale}/dashboard` : `/${locale}/auth/signup`}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0a2f7e] to-primary px-7 py-3.5 text-sm font-semibold text-white shadow-sm shadow-primary/15 transition hover:shadow-md hover:shadow-primary/20"
              >
                <span>{tx('button.startSavingNow')}</span>
                <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            TESTIMONIALS — Stacked Cards
            ═══════════════════════════════════════════ */}
        <section id="testimonials" className="py-24">
          <div className="container mx-auto px-4">
            <div className="scroll-reveal mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Award className="h-4 w-4" />
                {tx('testimonials.badge')}
              </p>
              <h2 className="text-3xl font-black text-on-surface sm:text-4xl">
                {tx('testimonials.title')}{' '}
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {tx('testimonials.titleBrand')}
                </span>{' '}
                {tx('testimonials.titleEnd')}
              </h2>
              <p className="mt-4 text-base text-on-surface-variant sm:text-lg">{tx('testimonials.subtitle')}</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial, index) => {
                const rotation = index === 0 ? 'lg:-rotate-2' : index === 2 ? 'lg:rotate-2' : '';
                return (
                  <article
                    key={testimonial.name}
                    className={`scroll-reveal group rounded-2xl border border-outline-variant/50 bg-surface/80 p-6 backdrop-blur-sm transition-all duration-300 hover:rotate-0 hover:-translate-y-2 hover:shadow-md ${rotation}`}
                    style={{ '--reveal-delay': `${index * 100}ms` } as React.CSSProperties}
                  >
                    {/* Star rating — gold gradient */}
                    <div className="mb-4 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star key={starIndex} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>

                    <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">
                      &ldquo;{testimonial.comment}&rdquo;
                    </p>

                    {/* Author */}
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[index]} text-sm font-bold text-white`}>
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{testimonial.name}</p>
                        <p className="text-xs text-on-surface-variant">{testimonial.role}</p>
                      </div>
                    </div>

                    {/* Savings badge with pulse */}
                    <div className="savings-pulse inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5">
                      <Percent className="h-4 w-4 text-success" />
                      <span className="text-xs font-medium text-on-surface-variant">{tx('testimonials.saved')}</span>
                      <Price
                        amount={testimonial.saved}
                        className="text-sm font-semibold text-success"
                        symbolClassName="h-4 w-4 fill-success"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            CTA — Full-Bleed Gradient
            ═══════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-24">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#071a3e] via-[#0a2f7e] to-primary" />

          {/* Floating decorative circles */}
          <div className="pointer-events-none absolute -start-20 top-10 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -end-20 bottom-10 h-56 w-56 rounded-full bg-white/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute end-1/3 top-1/4 h-40 w-40 rounded-full bg-secondary/20 blur-3xl" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="scroll-reveal mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-3xl font-black text-white sm:text-5xl">
                {tx('cta.title')}
              </h2>
              <p className="mt-5 text-base text-white/75 sm:text-lg">
                {tx('cta.subtitle')}{' '}
                <span className="font-semibold text-white">{tx('cta.subtitleBold')}</span>{' '}
                {tx('cta.subtitleEnd')}
              </p>

              {/* Benefits */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[tx('cta.benefit1'), tx('cta.benefit2'), tx('cta.benefit3'), tx('cta.benefit4')].map(
                  (benefit) => (
                    <div
                      key={benefit}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white/90 backdrop-blur-sm"
                    >
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{benefit}</span>
                    </div>
                  )
                )}
              </div>

              {/* Buttons — inverted style */}
              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                {authLoading ? (
                  <div className="h-12 w-48 animate-pulse rounded-full bg-white/20" />
                ) : user ? (
                  <Link
                    href={`/${locale}/dashboard`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-sm transition hover:bg-white/90"
                  >
                    <User className="h-4 w-4" />
                    <span>{menuCopy.dashboard}</span>
                  </Link>
                ) : (
                  <Link
                    href={`/${locale}/auth/signup`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-sm transition hover:bg-white/90"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{tx('button.startFreeNow')}</span>
                  </Link>
                )}
                <Link
                  href={`/${locale}/products`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/25 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{tx('button.browseProductsShort')}</span>
                </Link>
              </div>

              <div className="mt-7 inline-flex items-center gap-2 text-xs text-white/60">
                <Lock className="h-4 w-4" />
                <span>{tx('cta.security')}</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════
          FOOTER — Modernized
          ═══════════════════════════════════════════ */}
      <footer className="border-t border-outline-variant bg-surface-container py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 md:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0a2f7e] to-primary text-lg font-black text-white">
                  {tx('app.initial')}
                </div>
                <span className="text-lg font-bold text-on-surface">{tx('app.name')}</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant">{tx('footer.description')}</p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                {tx('footer.quickLinks')}
              </h3>
              <ul className="space-y-3">
                {footerPrimary.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-sm text-on-surface-variant transition hover:text-primary"
                    >
                      <ArrowRight className={`h-3.5 w-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                {tx('footer.support')}
              </h3>
              <ul className="space-y-3">
                {footerSupport.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-sm text-on-surface-variant transition hover:text-primary"
                    >
                      <ArrowRight className={`h-3.5 w-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                {tx('footer.newsletter')}
              </h3>
              <p className="mb-4 text-sm text-on-surface-variant">{tx('footer.newsletterDescription')}</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant ${isRTL ? 'right-3' : 'left-3'}`} />
                  <input
                    type="email"
                    placeholder={tx('footer.emailPlaceholder')}
                    className={`w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(13,71,161,0.15)] ${isRTL ? 'pr-9' : 'pl-9'}`}
                  />
                </div>
                <button className="rounded-xl bg-gradient-to-r from-[#0a2f7e] to-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-md hover:shadow-primary/15">
                  {tx('button.subscribe')}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col gap-4 border-t border-outline-variant/60 pt-8 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
            <p>{tx('footer.copyright')}</p>
            <div className="flex items-center gap-3">
              {[Globe, Mail, Shield].map((Icon, i) => (
                <span
                  key={i}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/50 bg-surface text-on-surface-variant transition hover:border-primary/40 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════
          ANIMATIONS
          ═══════════════════════════════════════════ */}
      <style jsx>{`
        /* ── Pointer cursor on all clickable elements ── */
        button:not(:disabled),
        a,
        [role="button"] {
          cursor: pointer;
        }

        /* ── Animated gradient mesh background ── */
        .gradient-mesh {
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(13, 71, 161, 0.15), transparent 50%),
            radial-gradient(ellipse 50% 60% at 80% 15%, rgba(16, 185, 129, 0.12), transparent 45%),
            radial-gradient(ellipse 55% 45% at 50% 80%, rgba(79, 70, 229, 0.12), transparent 50%);
          animation: gradient-shift 12s ease-in-out infinite alternate;
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 0%, 100% 0%, 50% 100%;
          }
          50% {
            background-position: 30% 20%, 70% 30%, 40% 70%;
          }
          100% {
            background-position: 10% 40%, 90% 10%, 60% 90%;
          }
        }

        /* ── Scroll reveal animation ── */
        .scroll-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.01s, transform 0.01s;
        }

        .scroll-reveal.revealed {
          animation: reveal-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: var(--reveal-delay, 0ms);
        }

        @keyframes reveal-up {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ── Floating mockup card ── */
        .mockup-float {
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }

        /* ── Shimmer effect for badges ── */
        .shimmer-badge::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.15) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
          border-radius: inherit;
        }

        /* ── Shimmer effect for CTA buttons ── */
        .shimmer-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.12) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 2.5s ease-in-out infinite;
          border-radius: inherit;
        }

        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        /* ── Search bar glowing border ── */
        .search-glow-border {
          background: linear-gradient(
            135deg,
            rgba(13, 71, 161, 0.5),
            rgba(79, 70, 229, 0.3),
            rgba(16, 185, 129, 0.3),
            rgba(13, 71, 161, 0.5)
          );
          background-size: 300% 300%;
          animation: glow-rotate 4s ease infinite;
        }

        @keyframes glow-rotate {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        /* ── Marquee ── */
        .marquee-track {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marquee-ltr var(--marquee-duration, 30s) linear infinite;
        }

        .marquee-group {
          display: flex;
          flex-shrink: 0;
          gap: 1.25rem;
          padding-inline-end: 1.25rem;
        }

        .marquee-rtl {
          animation-name: marquee-rtl;
        }

        .marquee-container:hover .marquee-track {
          animation-play-state: paused;
        }

        @keyframes marquee-ltr {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes marquee-rtl {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }

        /* ── Timeline connecting line animation ── */
        .timeline-line {
          background-image: repeating-linear-gradient(
            90deg,
            transparent,
            transparent 6px,
            rgba(13, 71, 161, 0.3) 6px,
            rgba(13, 71, 161, 0.3) 12px
          );
        }

        /* ── Savings badge pulse ── */
        .savings-pulse {
          animation: pulse-soft 3s ease-in-out infinite;
        }

        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.15); }
          50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .gradient-mesh,
          .mockup-float,
          .shimmer-badge::after,
          .shimmer-btn::after,
          .search-glow-border,
          .marquee-track,
          .savings-pulse {
            animation: none !important;
          }

          .scroll-reveal {
            opacity: 1 !important;
            transform: none !important;
          }

          .scroll-reveal.revealed {
            animation: none !important;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
