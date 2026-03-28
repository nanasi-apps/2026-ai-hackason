<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";
import { client } from "../lib/orpc";

const router = useRouter();
const { setAuth } = useAuth();

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleRegister() {
  error.value = "";
  loading.value = true;
  try {
    const result = await client.auth.register({
      username: username.value,
      password: password.value,
    });
    setAuth(result.token, result.user);
    router.push("/");
  } catch (e: any) {
    error.value = e.message || "アカウント作成に失敗しました";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-16">
    <!-- Brand -->
    <div class="text-center mb-8">
      <h1
        class="text-3xl font-bold tracking-widest uppercase mb-2"
        style="
          font-family: &quot;Space Mono&quot;, monospace;
          background: linear-gradient(135deg, #a99af9 0%, #e85d9a 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        "
      >
        MISREADER
      </h1>
      <p class="text-xs font-mono tracking-widest uppercase" style="color: #3a3a55">
        誤読の世界へようこそ
      </p>
    </div>

    <!-- Form card -->
    <div class="rounded-xl border p-6" style="background-color: #12121a; border-color: #2a2a40">
      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label
            class="block text-xs font-mono tracking-wider uppercase mb-2"
            style="color: #6b6b8a"
          >
            ユーザー名
          </label>
          <input
            v-model="username"
            type="text"
            required
            class="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors bg-transparent"
            style="border: 1px solid #2a2a40; color: #ffffff; caret-color: #a99af9"
            onfocus="this.style.borderColor = &quot;#7c6af7&quot;;"
            onblur="this.style.borderColor = &quot;#2a2a40&quot;;"
            placeholder="3〜20文字 (a-z, 0-9, _)"
          />
        </div>
        <div>
          <label
            class="block text-xs font-mono tracking-wider uppercase mb-2"
            style="color: #6b6b8a"
          >
            パスワード
          </label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            class="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors bg-transparent"
            style="border: 1px solid #2a2a40; color: #ffffff; caret-color: #a99af9"
            onfocus="this.style.borderColor = &quot;#7c6af7&quot;;"
            onblur="this.style.borderColor = &quot;#2a2a40&quot;;"
            placeholder="6文字以上"
          />
        </div>

        <p
          v-if="error"
          class="text-xs font-mono py-2 px-3 rounded-lg"
          style="color: #e85d9a; background-color: #e85d9a15; border: 1px solid #e85d9a30"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-full text-sm font-medium transition-all disabled:opacity-40 mt-2"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
        >
          {{ loading ? "..." : "アカウント作成" }}
        </button>
      </form>
    </div>

    <p class="text-center mt-5 text-xs" style="color: #3a3a55">
      すでにアカウントをお持ちの方は
      <RouterLink
        to="/login"
        class="transition-colors"
        style="color: #a99af9"
        onmouseover="this.style.color = &quot;#ffffff&quot;;"
        onmouseout="this.style.color = &quot;#a99af9&quot;;"
        >ログイン</RouterLink
      >
    </p>
  </div>
</template>
