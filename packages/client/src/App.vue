<script setup lang="ts">
import { computed } from "vue";
import { RouterView, RouterLink, useRoute } from "vue-router";
import { IconHome2, IconPencilPlus, IconSparkles } from "@tabler/icons-vue";
import { useAuth } from "./composables/useAuth";
import { useToast } from "./composables/useToast";
import { useRouter } from "vue-router";

const { isLoggedIn, user, logout } = useAuth();
const { toasts, dismiss } = useToast();
const router = useRouter();
const route = useRoute();

const isHomeRoute = computed(() => route.path === "/");
const isRecommendRoute = computed(() => route.path === "/recommend");

function handleLogout() {
  logout();
  router.push("/login");
}

function openComposer() {
  if (!isLoggedIn.value) {
    router.push("/login");
    return;
  }

  if (route.path === "/") {
    window.dispatchEvent(new CustomEvent("open-composer"));
    return;
  }

  router.push({ path: "/", query: { compose: "1" } });
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
            今北SNS
          </span>
        </RouterLink>

        <!-- Nav -->
        <nav class="flex items-center gap-2 sm:gap-3">
          <RouterLink
            to="/recommend"
            class="hidden text-sm transition-colors sm:inline-flex"
            style="color: #fff"
            onmouseover="this.style.color = &quot;#ffffff&quot;;"
            onmouseout="this.style.color = &quot;#fff&quot;;"
          >
            おすすめ
          </RouterLink>
          <template v-if="isLoggedIn">
            <RouterLink
              v-if="user && ['mattyatea', 'kasukasukun'].includes(user.username)"
              to="/admin/recommend"
              class="text-sm transition-colors"
              style="color: #fff"
              onmouseover="this.style.color = &quot;#e8e8f0&quot;;"
              onmouseout="this.style.color = &quot;#fff&quot;;"
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
              <span class="hidden sm:inline">@{{ user?.username }}</span>
              <span class="sm:hidden">Profile</span>
            </RouterLink>
            <button
              @click="handleLogout"
              class="text-sm transition-colors px-3 py-1.5 rounded-full"
              style="color: #fff"
              onmouseover="this.style.color = &quot;#ffffff&quot;;"
              onmouseout="this.style.color = &quot;#fff&quot;;"
            >
              ログアウト
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="text-sm transition-colors"
              style="color: #fff"
              onmouseover="this.style.color = &quot;#ffffff&quot;;"
              onmouseout="this.style.color = &quot;#fff&quot;;"
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
    <main class="max-w-2xl mx-auto px-4 py-6 pb-24 sm:py-8 sm:pb-8">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="px-4 py-8 pb-24 text-center text-xs leading-6 sm:pb-8" style="color: #fff">
      <span class="block">だらだら書いとけ。</span>
      <span class="block">最後に残った言葉が、お前そのもんやで。</span>
      <span class="block mt-4">© 2026 nanasi-apps</span>
    </footer>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:hidden"
      style="background-color: #0a0a0ff2; backdrop-filter: blur(18px); border-color: #2a2a40"
      aria-label="モバイルナビゲーション"
    >
      <div class="mx-auto grid max-w-2xl grid-cols-3 gap-2">
        <RouterLink
          to="/recommend"
          class="flex items-center justify-center rounded-2xl px-3 py-3 transition-all"
          :style="
            isRecommendRoute
              ? 'background-color: #f59e0b18; color: #f59e0b; border: 1px solid #f59e0b33'
              : 'background-color: #12121a; color: #ffffff; border: 1px solid #2a2a40'
          "
          aria-label="おすすめ"
        >
          <IconSparkles :size="22" stroke="1.8" />
        </RouterLink>

        <RouterLink
          to="/"
          class="flex items-center justify-center rounded-2xl px-3 py-3 transition-all"
          :style="
            isHomeRoute
              ? 'background-color: #7c6af718; color: #a99af9; border: 1px solid #7c6af733'
              : 'background-color: #12121a; color: #ffffff; border: 1px solid #2a2a40'
          "
          aria-label="ホーム"
        >
          <IconHome2 :size="22" stroke="1.8" />
        </RouterLink>

        <button
          type="button"
          class="flex items-center justify-center rounded-2xl px-3 py-3 transition-all"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
          aria-label="投稿"
          @click="openComposer"
        >
          <IconPencilPlus :size="22" stroke="1.8" />
        </button>
      </div>
    </nav>

    <!-- Toast container -->
    <div
      class="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6"
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
