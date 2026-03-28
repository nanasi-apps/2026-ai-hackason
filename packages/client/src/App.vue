<script setup lang="ts">
import TodoApp from './components/TodoApp.vue'
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-8 min-h-screen bg-gray-50">
    <h1 class="text-3xl font-bold text-center text-gray-800">Todo App</h1>
    <p class="text-center text-gray-400 mb-8">Vue + oRPC + Cloudflare Workers</p>
    <TodoApp />
  </div>
</template>
