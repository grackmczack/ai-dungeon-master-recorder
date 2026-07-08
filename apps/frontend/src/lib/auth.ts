import { writable, derived, get } from 'svelte/store';
import type { User } from './types.js';

const TOKEN_KEY = 'dnd_token';

function createAuthStore() {
  const token = writable<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  );
  const user = writable<User | null>(null);
  const loading = writable(false);

  token.subscribe((t) => {
    if (typeof localStorage !== 'undefined') {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
  });

  return {
    token,
    user,
    loading,
    isAuthenticated: derived(token, ($t) => !!$t),
    setAuth(t: string, u: User) {
      token.set(t);
      user.set(u);
    },
    logout() {
      token.set(null);
      user.set(null);
    },
    getToken: () => get(token)
  };
}

export const auth = createAuthStore();
