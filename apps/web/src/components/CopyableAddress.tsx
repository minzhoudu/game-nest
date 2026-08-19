import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

export function CopyableAddress({ address }: { address: string }) {
  const [state, setState] = useState<CopyState>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setState('copied');
    } catch {
      // navigator.clipboard can reject (permissions, non-HTTPS, browser
      // policy) — fall back to the old selection-based copy before giving up.
      setState(legacyCopy(address) ? 'copied' : 'failed');
    }
    setTimeout(() => setState('idle'), 1500);
  };

  const label = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : 'Copy';

  return (
    <span className="copyable-address">
      <code>{address}</code>
      <button type="button" className="ghost copy-btn" onClick={() => void copy()}>
        {label}
      </button>
    </span>
  );
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let succeeded = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- best-effort fallback only
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  return succeeded;
}
