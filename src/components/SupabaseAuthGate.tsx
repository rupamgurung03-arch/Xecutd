import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';
import { getJournalAuthHeaders, hasSupabaseConfig, supabase } from '../lib/supabaseClient';
import { dismissLegacyImportForUser, importLegacyDataForUser, needsLegacyImport } from '../utils/userStorage';

type AuthView = 'sign-in' | 'sign-up' | 'reset-password' | 'update-password';
export type WelcomeKind = 'new' | 'daily' | 'returning';

const localDayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

interface SupabaseAuthGateProps {
  children: (userId: string, onSignOut: () => Promise<void>, onDeleteAccount: (reason: string, details: string) => Promise<void>, welcomeKind: WelcomeKind, accountName: string, accountEmail: string) => React.ReactNode;
}

export const SupabaseAuthGate: React.FC<SupabaseAuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [legacyChoiceRequired, setLegacyChoiceRequired] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<AuthView>('sign-up');
  const [guestMode, setGuestMode] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [welcomeKind, setWelcomeKind] = useState<WelcomeKind>('daily');
  const processedVisitUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    let active = true;
    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setLegacyChoiceRequired(Boolean(nextSession && needsLegacyImport(nextSession.user.id)));
      if (!nextSession) {
        processedVisitUserRef.current = null;
        setWelcomeKind('daily');
        return;
      }
      const user = nextSession.user;
      if (processedVisitUserRef.current === user.id) return;
      processedVisitUserRef.current = user.id;

      const today = localDayKey(new Date());
      const previousVisitDay = typeof user.user_metadata?.journal_last_visit_day === 'string'
        ? user.user_metadata.journal_last_visit_day
        : null;
      const createdDay = user.created_at ? localDayKey(new Date(user.created_at)) : null;
      const firstSessionForNewAccount = !previousVisitDay && createdDay === today;
      setWelcomeKind(firstSessionForNewAccount ? 'new' : previousVisitDay === today ? 'returning' : 'daily');

      if (previousVisitDay !== today) {
        const client = supabase;
        if (!client) return;
        window.setTimeout(() => {
          void client.auth.updateUser({
            data: { ...user.user_metadata, journal_last_visit_day: today },
          });
        }, 0);
      }
    };

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      applySession(data.session);
      setCheckingSession(false);
    }).catch(() => {
      if (!active) return;
      setError('Could not check your sign-in session. Refresh the page and try again.');
      setCheckingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('update-password');
        setPassword('');
        setConfirmPassword('');
        setError('');
        setNotice('Choose a new password for your account.');
      }
      applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const redirectUrl = () => `${window.location.origin}${window.location.pathname}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (view === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) setError(authError.message);
      } else if (view === 'sign-up') {
        if (password !== confirmPassword) {
          setError('The passwords do not match.');
          return;
        }
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl(),
            data: { display_name: accountName.trim() },
          },
        });
        if (authError) setError(authError.message);
        else if (!data.session) setNotice('Check your email for a confirmation link, then come back here to sign in.');
      } else if (view === 'reset-password') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() });
        if (authError) setError(authError.message);
        else setNotice('If there is an account for that address, a password reset link is on its way.');
      } else {
        if (password.length < 6) {
          setError('Use at least 6 characters for your new password.');
          return;
        }
        if (password !== confirmPassword) {
          setError('The passwords do not match.');
          return;
        }
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) setError(authError.message);
        else {
          await supabase.auth.signOut();
          setSession(null);
          setView('sign-in');
          setPassword('');
          setConfirmPassword('');
          setNotice('Password updated. Sign in with your new password.');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl() },
      });
      if (authError) {
        setError(authError.message);
        setSubmitting(false);
      }
    } catch {
      setError('Could not start Google sign-in. Please try again.');
      setSubmitting(false);
    }
  };

  const switchView = (nextView: AuthView) => {
    setView(nextView);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleImportLegacyData = () => {
    if (!session) return;
    try {
      importLegacyDataForUser(session.user.id);
      setLegacyChoiceRequired(false);
      setError('');
    } catch {
      setError('Could not import the previous journal data. The original local copy is still untouched.');
    }
  };

  const handleStartFresh = () => {
    if (!session) return;
    dismissLegacyImportForUser(session.user.id);
    setLegacyChoiceRequired(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };

  const handleDeleteAccount = async (reason: string, details: string) => {
    const headers = await getJournalAuthHeaders();
    const response = await fetch('/api/account/delete', {
      method: 'POST', headers,
      body: JSON.stringify({ reason, details }),
    });
    const result = await response.json() as { error?: string; deleted?: boolean };
    if (!response.ok || !result.deleted) throw new Error(result.error || 'Could not delete your account.');
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setView('sign-up');
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-on-surface">
        <div className="flex items-center gap-3 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Checking your sign-in…
        </div>
      </div>
    );
  }

  if (guestMode) {
    return <>{children('guest-local', async () => { setGuestMode(false); setView('sign-up'); }, async () => { setGuestMode(false); }, 'daily', 'Guest', '')}</>;
  }

  if (session && view !== 'update-password') {
    if (!legacyChoiceRequired) {
      const metadataName = session.user.user_metadata?.display_name;
      const accountName = typeof metadataName === 'string' ? metadataName.trim() : '';
      return <>{children(session.user.id, handleSignOut, handleDeleteAccount, welcomeKind, accountName, session.user.email || '')}</>;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-on-surface">
        <section className="w-full max-w-lg border border-outline-variant bg-surface-container-lowest p-7 shadow-sm sm:p-9" aria-labelledby="legacy-data-title">
          <p className="mb-2 font-caption-mono text-caption-mono uppercase tracking-[.16em] text-tertiary">Account data separation</p>
          <h1 id="legacy-data-title" className="font-headline-lg text-headline-lg font-semibold tracking-tight text-on-surface">Choose what this account should see</h1>
          <p className="mt-3 font-body-sm text-body-sm text-tertiary">
            {session.user.email ? `Signed in as ${session.user.email}. ` : ''}Existing journal data was found on this device. Import it only while signed into your original account. Other accounts will stay separate.
          </p>
          {error && <p role="alert" className="mt-4 border border-secondary/40 bg-error-container/30 p-3 font-body-sm text-on-surface">{error}</p>}
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={handleImportLegacyData} className="min-h-11 bg-primary px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase tracking-wider text-on-primary">Import existing journal into this account</button>
            <button type="button" onClick={handleStartFresh} className="min-h-11 border border-outline-variant bg-surface-container-low px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase tracking-wider text-on-surface">Start with an empty journal</button>
            <button type="button" onClick={() => { void handleSignOut(); }} className="self-center px-3 py-2 font-caption-mono text-[10px] text-tertiary underline underline-offset-4 hover:text-on-surface">Sign out and switch to the original account</button>
          </div>
        </section>
      </main>
    );
  }

  const titles: Record<AuthView, string> = {
    'sign-in': 'Sign in to your journal',
    'sign-up': 'Create your journal account',
    'reset-password': 'Reset your password',
    'update-password': 'Choose a new password',
  };
  const submitLabels: Record<AuthView, string> = {
    'sign-in': 'Sign in',
    'sign-up': 'Create account',
    'reset-password': 'Send reset link',
    'update-password': 'Update password',
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-on-surface">
      <section className="w-full max-w-md border border-outline-variant bg-surface-container-lowest p-7 shadow-sm sm:p-9" aria-labelledby="login-title">
        <div className="mb-7 flex h-11 w-11 items-center justify-center border border-outline-variant bg-surface-container-low text-on-surface">
          {view === 'sign-up' ? <UserPlus size={20} aria-hidden="true" /> : view === 'reset-password' ? <MailCheck size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}
        </div>
        <p className="mb-2 font-caption-mono text-caption-mono uppercase tracking-[.16em] text-tertiary">Xecutd Journal · Your trading workspace</p>
        <h1 id="login-title" className="font-headline-lg text-headline-lg font-semibold tracking-tight text-on-surface">{titles[view]}</h1>
        <p className="mt-2 font-body-sm text-body-sm text-tertiary">
          {view === 'sign-up' ? 'Create an account to keep your journal synced across devices.' : view === 'reset-password' ? 'We’ll email you a secure link to reset your password.' : view === 'update-password' ? 'Your reset link is verified. Enter a new password below.' : 'Use the email and password for your journal account.'}
        </p>

        {view === 'sign-up' && <button type="button" onClick={() => setGuestMode(true)} className="mt-6 min-h-11 w-full border border-outline-variant bg-surface-container-low px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase tracking-wider text-on-surface transition hover:bg-surface-container">Continue as a guest</button>}

        {!hasSupabaseConfig ? (
          <div className="mt-6 border border-secondary/40 bg-error-container/30 p-4 font-body-sm text-on-surface" role="alert">
            Supabase isn’t connected to this build yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in the local environment and Cloudflare Pages build settings, then rebuild.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            {(view === 'sign-in' || view === 'sign-up') && (
              <>
                <button type="button" onClick={() => { void handleGoogleSignIn(); }} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-3 border border-outline-variant bg-surface-container-low px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase tracking-wider text-on-surface transition hover:bg-surface-container disabled:cursor-wait disabled:opacity-60">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.92 3.27-4.74 3.27-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z" />
                    <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.16a11 11 0 0 0 0 9.9l3.69-2.84Z" />
                    <path fill="#EA4335" d="M12 4.36c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0A11 11 0 0 0 2.16 7.05l3.69 2.84C6.72 7.29 9.14 4.36 12 4.36Z" />
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 font-caption-mono text-[10px] uppercase tracking-wider text-tertiary" aria-hidden="true">
                  <span className="h-px flex-1 bg-outline-variant" />
                  or use email
                  <span className="h-px flex-1 bg-outline-variant" />
                </div>
              </>
            )}
            {view === 'sign-up' && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Username
                <input type="text" autoComplete="nickname" required maxLength={48} value={accountName} onChange={(event) => setAccountName(event.target.value)} className="min-h-11 border border-outline-variant bg-surface-container-low px-3 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="Choose a journal name" />
              </label>
            )}
            {view !== 'update-password' && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Email address
                <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 border border-outline-variant bg-surface-container-low px-3 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="you@example.com" />
              </label>
            )}
            {(view === 'sign-in' || view === 'sign-up') && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Password
                <span className="relative block">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input type={showPassword ? 'text' : 'password'} autoComplete={view === 'sign-in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full border border-outline-variant bg-surface-container-low pl-9 pr-12 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="At least 6 characters" />
                  <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-tertiary hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-on-surface">
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </span>
              </label>
            )}
            {(view === 'sign-up' || view === 'update-password') && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Confirm password
                <input type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-h-11 border border-outline-variant bg-surface-container-low px-3 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="Enter the password again" />
              </label>
            )}
            {error && <p role="alert" className="border border-secondary/40 bg-error-container/30 p-3 font-body-sm text-on-surface">{error}</p>}
            {notice && <p role="status" className="border border-outline-variant bg-surface-container-low p-3 font-body-sm text-on-surface">{notice}</p>}
            <button type="submit" disabled={submitting} className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase tracking-wider text-on-primary transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
              {submitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
              {submitting ? 'Please wait…' : submitLabels[view]}
            </button>
            {view === 'sign-in' && (
              <div className="flex flex-col items-center gap-2 font-caption-mono text-[10px]">
                <button type="button" onClick={() => switchView('reset-password')} className="text-tertiary underline underline-offset-4 hover:text-on-surface">Forgot password?</button>
                <p className="text-tertiary">New to Xecutd? <button type="button" onClick={() => switchView('sign-up')} className="font-semibold text-on-surface underline underline-offset-4">Create an account</button></p>
              </div>
            )}
            {view === 'sign-up' && <p className="text-center font-caption-mono text-[10px] text-tertiary">Already registered? <button type="button" onClick={() => switchView('sign-in')} className="font-semibold text-on-surface underline underline-offset-4">Sign in</button></p>}
            {view === 'reset-password' && <p className="text-center font-caption-mono text-[10px] text-tertiary"><button type="button" onClick={() => switchView('sign-in')} className="font-semibold text-on-surface underline underline-offset-4">Back to sign in</button></p>}
            {view === 'update-password' && <p className="text-center font-caption-mono text-[10px] text-tertiary">Your journal opens after the password is updated.</p>}
          </form>
        )}
      </section>
    </main>
  );
};
