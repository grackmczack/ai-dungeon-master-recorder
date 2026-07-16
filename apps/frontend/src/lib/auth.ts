import { writable, derived } from "svelte/store";
import type { User } from "./types.js";

function createAuthStore() {
  const user = writable<User | null>(null);
  const loading = writable(true);

  return {
    user,
    loading,
    isAuthenticated: derived(user, ($user) => !!$user),
    setAuth(u: User) {
      user.set(u);
    },
    logout() {
      user.set(null);
    }
  };
}

export const auth = createAuthStore();
