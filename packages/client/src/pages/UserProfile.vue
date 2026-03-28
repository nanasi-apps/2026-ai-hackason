<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { orpc } from "../lib/orpc";
import NoteCard from "../components/NoteCard.vue";

const props = defineProps<{ username: string }>();

const { data: notes, isLoading } = useQuery(
  orpc.note.listByUser.queryOptions({ input: { username: props.username, limit: 50 } }),
);
</script>

<template>
  <div>
    <!-- Profile header -->
    <div class="mb-8">
      <div class="flex items-center gap-4 mb-6">
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style="background: linear-gradient(135deg, #8b7cf8 0%, #ec6fac 100%); color: white"
        >
          {{ username.charAt(0).toUpperCase() }}
        </div>
        <div>
          <h1 class="text-lg font-bold" style="color: #f0f0f8">@{{ username }}</h1>
          <p class="text-xs font-mono mt-0.5" style="color: #f0f0f8">
            {{ notes ? notes.length : "..." }} 件の投稿
          </p>
        </div>
      </div>
      <div class="h-px" style="background-color: #252538"></div>
    </div>

    <!-- Posts -->
    <div class="flex items-center gap-3 mb-4">
      <span class="text-xs font-mono tracking-widest uppercase" style="color: #f0f0f8">投稿</span>
      <div class="flex-1 h-px" style="background-color: #252538"></div>
    </div>

    <div v-if="isLoading" class="text-center py-12">
      <div
        class="inline-block w-5 h-5 rounded-full border-2 animate-spin"
        style="border-color: #252538; border-top-color: #8b7cf8"
      ></div>
    </div>
    <div v-else-if="notes && notes.length > 0" class="space-y-3">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" />
    </div>
    <div v-else class="text-center py-16">
      <p class="text-sm font-mono" style="color: #f0f0f8">まだ投稿がありません</p>
    </div>
  </div>
</template>
