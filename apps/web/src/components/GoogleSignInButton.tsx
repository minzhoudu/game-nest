import { useEffect, useRef } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// Module-level (not per-component) so multiple mounts — e.g. navigating
// between /login and /signup, both of which render this — share one script
// load instead of re-fetching it.
let scriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface GoogleSignInButtonProps {
  /** Called with the raw ID token once the user picks a Google account — the caller sends it to POST /auth/google. */
  onCredential: (idToken: string) => void;
}

/**
 * Renders Google's own "Sign in with Google" button via its JS SDK
 * (Google Identity Services) rather than a custom-styled button — Google's
 * branding guidelines require using their rendered button, not a lookalike.
 * If VITE_GOOGLE_CLIENT_ID isn't set, renders nothing — email/password auth
 * still works standalone.
 */
export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Effect below runs once — this ref lets it always call the *latest*
  // onCredential without re-running (and re-initializing the SDK/button)
  // every time the parent passes a new inline function.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
        });
      })
      .catch(() => {
        // Script failed to load (offline, ad blocker, etc.) — leave the
        // container empty rather than surfacing an error; email/password
        // auth is right there as a working fallback.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={containerRef} className="google-signin-button" />;
}
