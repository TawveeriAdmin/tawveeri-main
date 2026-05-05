import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach((cookie) => {
    if (!cookie.name.startsWith('sb-')) return;

    response.cookies.set(cookie.name, '', {
      path: '/',
      maxAge: 0,
    });
  });

  response.headers.set('Clear-Site-Data', '"cookies", "storage"');
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Server sign-out failed; clearing auth cookies locally.', error);
  }

  clearSupabaseCookies(request, response);
  return response;
}

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/ar';
  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Server sign-out failed; clearing auth cookies locally.', error);
  }

  clearSupabaseCookies(request, response);
  return response;
}
