<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";
import { useAuth } from "./composables/useAuth";
import { useToast } from "./composables/useToast";
import { useRouter } from "vue-router";

const { isLoggedIn, user, logout } = useAuth();
const { toasts, dismiss } = useToast();
const router = useRouter();

function handleLogout() {
  logout();
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen" style="background-color: #0e0e16; color: #f0f0f8">
    <!-- Header -->
    <header
      class="sticky top-0 z-10 border-b"
      style="background-color: #0e0e16ea; backdrop-filter: blur(12px); border-color: #252538"
    >
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <!-- Logo -->
        <RouterLink to="/" class="flex items-center gap-2 group">
          <span
            class="text-lg font-bold tracking-widest uppercase"
            style="
              font-family: &quot;Space Mono&quot;, monospace;
              color: #f0f0f8;
              letter-spacing: 0.2em;
            "
          >
            今北SNS
          </span>
        </RouterLink>

        <!-- Nav -->
        <nav class="flex items-center gap-3">
          <RouterLink
            to="/recommend"
            class="text-sm transition-colors"
            style="color: #f0f0f8"
            onmouseover="this.style.color = &quot;#ffffff&quot;;"
            onmouseout="this.style.color = &quot;#f0f0f8&quot;;"
          >
            おすすめ
          </RouterLink>
          <template v-if="isLoggedIn">
            <RouterLink
              v-if="user && ['mattyatea', 'kasukasukun'].includes(user.username)"
              to="/admin/recommend"
              class="text-sm transition-colors"
              style="color: #f0f0f8"
              onmouseover="this.style.color = &quot;#e8e8f0&quot;;"
              onmouseout="this.style.color = &quot;#f0f0f8&quot;;"
            >
              管理
            </RouterLink>
            <RouterLink
              :to="`/user/${user?.username}`"
              class="text-sm transition-colors px-3 py-1.5 rounded-full"
              style="color: #b8acfa; border: 1px solid #252538"
              onmouseover="this.style.borderColor = &quot;#8b7cf8&quot;;"
              onmouseout="this.style.borderColor = &quot;#252538&quot;;"
            >
              @{{ user?.username }}
            </RouterLink>
            <button
              @click="handleLogout"
              class="text-sm transition-colors px-3 py-1.5 rounded-full"
              style="color: #f0f0f8"
              onmouseover="this.style.color = &quot;#ffffff&quot;;"
              onmouseout="this.style.color = &quot;#f0f0f8&quot;;"
            >
              ログアウト
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="text-sm transition-colors"
              style="color: #f0f0f8"
              onmouseover="this.style.color = &quot;#ffffff&quot;;"
              onmouseout="this.style.color = &quot;#f0f0f8&quot;;"
            >
              ログイン
            </RouterLink>
            <RouterLink
              to="/register"
              class="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
              style="background: linear-gradient(135deg, #8b7cf8 0%, #ec6fac 100%); color: white"
            >
              登録
            </RouterLink>
          </template>
        </nav>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-2xl mx-auto px-4 py-8">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="text-center py-8 text-xs leading-6" style="color: #f0f0f8">
      <span class="block">だらだら書いとけ。</span>
      <span class="block">最後に残った言葉が、お前そのもんやで。</span>
      <span class="block mt-4">© 2026 nanasi-apps</span>
    </footer>

    <!-- Toast container -->
    <div
      class="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex items-center gap-3 rounded-full px-5 py-2.5 text-sm font-mono shadow-lg cursor-pointer"
          :style="
            t.type === 'error'
              ? 'background-color: #2a1020; border: 1px solid #ec6fac60; color: #ec6fac'
              : t.type === 'success'
                ? 'background-color: #0f2a1a; border: 1px solid #4ade8060; color: #4ade80'
                : 'background-color: #1c1c2e; border: 1px solid #8b7cf860; color: #b8acfa'
          "
          @click="dismiss(t.id)"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
