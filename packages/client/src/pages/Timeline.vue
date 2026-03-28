<script setup lang="ts">
import { ref } from "vue";
import { useQuery, useQueryClient, useMutation } from "@tanstack/vue-query";
import { orpc, client } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";
import NoteCard from "../components/NoteCard.vue";

const { isLoggedIn } = useAuth();
const queryClient = useQueryClient();

const content = ref("");
const postError = ref("");

const { data: notes, isLoading } = useQuery(orpc.note.list.queryOptions({ input: { limit: 50 } }));

const createMutation = useMutation({
  mutationFn: (content: string) => client.note.create({ content }),
  onSuccess: () => {
    content.value = "";
    postError.value = "";
    queryClient.invalidateQueries({ queryKey: orpc.note.list.queryOptions({}).queryKey });
  },
  onError: (e: any) => {
    postError.value = e.message || "Failed to post";
  },
});

function handlePost() {
  if (!content.value.trim()) return;
  createMutation.mutate(content.value);
}
</script>

<template>
  <div>
    <!-- Post form -->
    <div v-if="isLoggedIn" class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <textarea
        v-model="content"
        rows="3"
        class="w-full border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
        placeholder="What's on your mind?"
      />
      <div class="flex items-center justify-between mt-2">
        <p v-if="postError" class="text-red-500 text-sm">{{ postError }}</p>
        <span v-else class="text-sm text-gray-400">{{ content.length }} / 10000</span>
        <button
          @click="handlePost"
          :disabled="!content.trim() || createMutation.isPending.value"
          class="bg-gray-900 text-white px-4 py-1.5 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {{ createMutation.isPending.value ? "Posting..." : "Post" }}
        </button>
      </div>
    </div>
    <div
      v-else
      class="bg-white rounded-lg border border-gray-200 p-4 mb-6 text-center text-gray-500"
    >
      <RouterLink to="/login" class="text-gray-900 underline">Login</RouterLink> to post
    </div>

    <!-- Timeline -->
    <div v-if="isLoading" class="text-center text-gray-400 py-8">Loading...</div>
    <div v-else-if="notes && notes.length > 0" class="space-y-4">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" />
    </div>
    <div v-else class="text-center text-gray-400 py-8">No posts yet</div>
  </div>
</template>
