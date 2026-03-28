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
  <div class="min-h-screen" style="background-color: #0a0a0f; color: #ffffff">
    <!-- Header -->
    <header
      class="sticky top-0 z-10 border-b"
      style="background-color: #0a0a0fea; backdrop-filter: blur(12px); border-color: #2a2a40"
    >
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <!-- Logo -->
        <RouterLink to="/" class="flex items-center gap-2 group">
          <span
            class="text-lg font-bold tracking-widest uppercase"
            style="
              font-family: &quot;Space Mono&quot;, monospace;
              color: #ffffff;
              letter-spacing: 0.2em;
            "
          >
            今北産業SNS
          </span>
        </RouterLink>

        <!-- Nav -->
        <nav class="flex items-center gap-3">
          <RouterLink
            to="/recommend"
            class="text-sm transition-colors"
            style="color: #6b6b8a"
            onmouseover="this.style.color = &quot;#ffffff&quot;;"
            onmouseout="this.style.color = &quot;#6b6b8a&quot;;"
          >
            おすすめ
          </RouterLink>
          <template v-if="isLoggedIn">
            <RouterLink
              v-if="user && ['mattyatea', 'kasukasukun'].includes(user.username)"
              to="/admin/recommend"
              class="text-sm transition-colors"
              style="color: #6b6b8a"
              onmouseover="this.style.color = &quot;#e8e8f0&quot;;"
              onmouseout="this.style.color = &quot;#6b6b8a&quot;;"
            >
              管理
            </RouterLink>
            <RouterLink
              :to="`/user/${user?.username}`"
              class="text-sm transition-colors px-3 py-1.5 rounded-full"
              style="color: #a99af9; border: 1px solid #2a2a40"
              onmouseover="this.style.borderColor = &quot;#7c6af7&quot;;"
              onmouseout="this.style.borderColor = &quot;#2a2a40&quot;;"
            >
              @{{ user?.username }}
            </RouterLink>
            <button
              @click="handleLogout"
              class="text-sm transition-colors px-3 py-1.5 rounded-full"
              style="color: #6b6b8a"
              onmouseover="this.style.color = &quot;#ffffff&quot;;"
              onmouseout="this.style.color = &quot;#6b6b8a&quot;;"
            >
              ログアウト
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="text-sm transition-colors"
              style="color: #6b6b8a"
              onmouseover="this.style.color = &quot;#ffffff&quot;;"
              onmouseout="this.style.color = &quot;#6b6b8a&quot;;"
            >
              ログイン
            </RouterLink>
            <RouterLink
              to="/register"
              class="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
              style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
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
    <footer class="text-center py-8 text-xs" style="color: #3a3a55">
      今北産業SNS — あなたの言葉を、AIが盛大に誤読する
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
              ? 'background-color: #2a1020; border: 1px solid #e85d9a60; color: #e85d9a'
              : t.type === 'success'
                ? 'background-color: #0f2a1a; border: 1px solid #4ade8060; color: #4ade80'
                : 'background-color: #1a1a2e; border: 1px solid #7c6af760; color: #a99af9'
          "
          @click="dismiss(t.id)"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
