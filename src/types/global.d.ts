
declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean;
  }
}

// Adding this empty export statement turns this file into a module, which is necessary for 'declare global' to work correctly.
export {};