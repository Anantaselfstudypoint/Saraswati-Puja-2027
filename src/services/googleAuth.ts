import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing app or initialize with applet config
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Workspace Sheets Scope
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

// Subscribers for token changes
const tokenListeners = new Set<(token: string | null) => void>();

export const onTokenChange = (cb: (token: string | null) => void) => {
  tokenListeners.add(cb);
  cb(cachedAccessToken);
  return () => {
    tokenListeners.delete(cb);
  };
};

function notifyTokenChange() {
  tokenListeners.forEach((cb) => {
    try {
      cb(cachedAccessToken);
    } catch (e) {
      console.warn('Error in token listener:', e);
    }
  });
}

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not in memory yet, require interaction or user click
        cachedAccessToken = null;
        notifyTokenChange();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      notifyTokenChange();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    notifyTokenChange();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';

    // Gracefully handle standard user cancellation - window closed or dismissed by user
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/user-cancelled'
    ) {
      console.info('Google sign-in popup was closed or cancelled by the user.');
      return null;
    }

    // Handle browser popup blocker
    if (errorCode === 'auth/popup-blocked') {
      console.warn('Google sign-in popup was blocked by browser.');
      throw new Error('POPUP_BLOCKED');
    }

    console.warn('Google Sign In notice:', error?.message || error);
    throw new Error(error?.message || 'Google Sign In failed');
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const hasActiveToken = (): boolean => {
  return Boolean(cachedAccessToken);
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  notifyTokenChange();
};
