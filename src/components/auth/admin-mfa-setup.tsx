'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/database/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function mfaClient() {
  const client = getBrowserClient();
  if (!client) throw new Error('Authentication unavailable');
  return client.auth.mfa;
}

export function AdminMfaSetup({ locale }: { locale: string }) {
  const ar = locale === 'ar';
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string }>>([]);
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await mfaClient().listFactors();
        if (error) throw error;
        if (!active) return;
        setFactors(data.totp);
        setFactorId(data.totp[0]?.id ?? '');
      } catch {
        if (active) setError(ar ? 'تعذر تحميل عوامل المصادقة. أعد المحاولة.' : 'Could not load authentication factors. Please retry.');
      } finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [ar]);

  async function enroll() {
    setBusy(true); setError(''); setVerified(false);
    try {
      const { data, error } = await mfaClient().enroll({ factorType: 'totp', issuer: 'Tawveeri', friendlyName: `Authenticator ${factors.length + 1}` });
      if (error) throw error;
      setFactorId(data.id); setQr(data.totp.qr_code);
    } catch {
      setError(ar ? 'تعذر إعداد العامل. تحقق من جلستك وحاول مجددًا.' : 'Could not enroll a factor. Check your session and retry.');
    } finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { error } = await mfaClient().challengeAndVerify({ factorId, code });
      if (error) throw error;
      setVerified(true); setQr(null); setCode('');
    } catch {
      setError(ar ? 'لم يُقبل الرمز. استخدم الرمز الحالي في تطبيق المصادقة.' : 'Code not accepted. Use the current code in your authenticator.');
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-12" dir={ar ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{ar ? 'حماية حساب الإدارة' : 'Protect your administrator account'}</h1>
      <p>{ar ? 'استخدم تطبيق مصادقة، واحتفظ بنسخة آمنة من إعداده في جهاز آخر قبل الاعتماد عليه وحده. لا تشارك رمز الإعداد أو رموز الدخول.' : 'Use an authenticator app and keep a secure copy of its setup on another device before relying on it alone. Never share setup or sign-in codes.'}</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {verified ? (
        <div className="space-y-4" role="status">
          <p>{ar ? 'تم التحقق من العامل لهذه الجلسة. تأكد أيضًا من قدرتك على الاسترداد عبر حساب المورد المحمي.' : 'This session has verified the factor. Also confirm recovery access through your protected provider account.'}</p>
          <Button asChild><a href={`/${locale}/admin/command-center`}>{ar ? 'العودة إلى الإدارة' : 'Return to administration'}</a></Button>
        </div>
      ) : (
        <>
          {factors.length > 0 && !qr && <label className="block space-y-2">
            <span>{ar ? 'تطبيق المصادقة' : 'Authenticator'}</span>
            <select className="w-full rounded border p-2" value={factorId} onChange={e => setFactorId(e.target.value)}>
              {factors.map(f => <option key={f.id} value={f.id}>{f.friendly_name || (ar ? 'تطبيق المصادقة' : 'Authenticator')}</option>)}
            </select>
          </label>}
          {!qr && <Button type="button" variant="outline" disabled={busy} onClick={enroll}>{ar ? 'إعداد تطبيق مصادقة' : 'Set up an authenticator'}</Button>}
          {qr && <div className="space-y-2">
            <p>{ar ? 'امسح الرمز بتطبيق المصادقة ثم أدخل رمز التحقق.' : 'Scan with your authenticator, then enter its verification code.'}</p>
            {/* The SDK supplies this private enrollment QR; never log or persist it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={240} height={240} alt={ar ? 'رمز إعداد المصادقة الخاص بحسابك' : 'Your private authenticator setup QR'} />
          </div>}
          {factorId && <form onSubmit={verify} className="space-y-3">
            <label htmlFor="mfa-code">{ar ? 'رمز تطبيق المصادقة' : 'Authenticator code'}</label>
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} />
            <Button disabled={busy || code.length !== 6}>{ar ? 'تحقق' : 'Verify'}</Button>
          </form>}
        </>
      )}
    </main>
  );
}
