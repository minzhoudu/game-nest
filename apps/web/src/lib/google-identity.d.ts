// Minimal ambient typing for the slice of Google Identity Services' JS SDK
// this app actually uses (loaded at runtime from a <script> tag — see
// GoogleSignInButton.tsx — not an npm package, so nothing else provides
// these types). Intentionally narrow rather than pulling in a full
// @types/google.accounts dependency for three method calls.
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: number;
              text?: 'signin_with' | 'signup_with' | 'continue_with';
            },
          ): void;
        };
      };
    };
  }
}
