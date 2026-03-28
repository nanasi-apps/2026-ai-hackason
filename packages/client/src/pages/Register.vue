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
    error.value = e.message || "Registration failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-16">
    <h1 class="text-2xl font-bold text-center mb-6">Register</h1>
    <form @submit.prevent="handleRegister" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <input
          v-model="username"
          type="text"
          required
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="3-20 characters (a-z, 0-9, _)"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          v-model="password"
          type="password"
          required
          minlength="6"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="6 characters minimum"
        />
      </div>
      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-gray-900 text-white py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
      >
        {{ loading ? "..." : "Create Account" }}
      </button>
    </form>
    <p class="text-center mt-4 text-sm text-gray-500">
      Already have an account?
      <RouterLink to="/login" class="text-gray-900 underline">Login</RouterLink>
    </p>
  </div>
</template>
