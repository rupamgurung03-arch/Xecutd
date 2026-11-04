import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, KeyRound, LoaderCircle, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient';
import { dismissLegacyImportForUser, importLegacyDataForUser, needsLegacyImport } from '../utils/userStorage';

type AuthView = 'sign-in' | 'sign-up' | 'reset-password' | 'update-password';
export type WelcomeKind = 'new' | 'daily' | 'returning';

const localDayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

interface SupabaseAuthGateProps {
  children: (userId: string, onSignOut: () => Promise<void>, welcomeKind: WelcomeKind, accountName: string) => React.ReactNode;
}

export const SupabaseAuthGate: React.FC<SupabaseAuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [legacyChoiceRequired, setLegacyChoiceRequired] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<AuthView>('sign-in');
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-on-surface">
        <div className="flex items-center gap-3 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Checking your sign-in…
        </div>
      </div>
    );
  }

  if (session && view !== 'update-password') {
    if (!legacyChoiceRequired) {
      const metadataName = session.user.user_metadata?.display_name;
      const accountName = typeof metadataName === 'string' ? metadataName.trim() : '';
      return <>{children(session.user.id, handleSignOut, welcomeKind, accountName)}</>;
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
        <p className="mb-2 font-caption-mono text-caption-mono uppercase tracking-[.16em] text-tertiary">Xecutd Journal · Private access</p>
        <h1 id="login-title" className="font-headline-lg text-headline-lg font-semibold tracking-tight text-on-surface">{titles[view]}</h1>
        <p className="mt-2 font-body-sm text-body-sm text-tertiary">
          {view === 'sign-up' ? 'Create an account with a username, email address, and password.' : view === 'reset-password' ? 'We’ll email you a secure link to reset your password.' : view === 'update-password' ? 'Your reset link is verified. Enter a new password below.' : 'Use the email and password for your journal account.'}
        </p>

        {!hasSupabaseConfig ? (
          <div className="mt-6 border border-secondary/40 bg-error-container/30 p-4 font-body-sm text-on-surface" role="alert">
            Supabase isn’t connected to this build yet. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in the local environment and Cloudflare Pages build settings, then rebuild.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            {view === 'sign-up' && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Username
                <input type="text" autoComplete="nickname" required maxLength={48} value={accountName} onChange={(event) => setAccountName(event.target.value)} className="min-h-11 border border-outline-variant bg-surface-container-low px-3 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="Choose a journal name" />
              </label>
            )}
            {view !== 'update-password' && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Email address
                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 border border-outline-variant bg-surface-container-low px-3 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="you@example.com" />
              </label>
            )}
            {(view === 'sign-in' || view === 'sign-up') && (
              <label className="flex flex-col gap-1.5 font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">
                Password
                <span className="relative block">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input type="password" autoComplete={view === 'sign-in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full border border-outline-variant bg-surface-container-low pl-9 pr-3 font-body-md text-on-surface outline-none focus:border-on-surface" placeholder="At least 6 characters" />
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
