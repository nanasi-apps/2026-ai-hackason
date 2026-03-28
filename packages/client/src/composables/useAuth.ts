import { ref, computed } from "vue";
import type { User } from "@aihackason/contract";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
const user = ref<User | null>(
  (() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  })(),
);

export function useAuth() {
  const isLoggedIn = computed(() => !!token.value);

  function setAuth(newToken: string, newUser: User) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return { token, user, isLoggedIn, setAuth, logout };
}
