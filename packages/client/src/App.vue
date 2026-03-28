<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";
import { useAuth } from "./composables/useAuth";
import { useRouter } from "vue-router";

const { isLoggedIn, user, logout } = useAuth();
const router = useRouter();

function handleLogout() {
  logout();
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <RouterLink to="/" class="text-xl font-bold text-gray-900">SNS</RouterLink>
        <nav class="flex items-center gap-4">
          <template v-if="isLoggedIn">
            <RouterLink
              :to="`/user/${user?.username}`"
              class="text-sm text-gray-600 hover:text-gray-900"
            >
              @{{ user?.username }}
            </RouterLink>
            <button @click="handleLogout" class="text-sm text-gray-500 hover:text-gray-700">
              Logout
            </button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="text-sm text-gray-600 hover:text-gray-900"
              >Login</RouterLink
            >
            <RouterLink
              to="/register"
              class="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800"
            >
              Register
            </RouterLink>
          </template>
        </nav>
      </div>
    </header>
    <main class="max-w-2xl mx-auto px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
