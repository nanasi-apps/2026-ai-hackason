<script setup lang="ts">
import { ref } from "vue";
import { useQuery, useQueryClient, useMutation } from "@tanstack/vue-query";
import { orpc, client } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";
import NoteCard from "../components/NoteCard.vue";

const props = defineProps<{ noteId: string }>();
const { isLoggedIn } = useAuth();
const queryClient = useQueryClient();

const replyContent = ref("");
const replyError = ref("");

const {
  data: note,
  isLoading,
  error,
} = useQuery(orpc.note.get.queryOptions({ input: { id: props.noteId } }));

const { data: replies, isLoading: repliesLoading } = useQuery(
  orpc.note.replies.queryOptions({ input: { noteId: props.noteId, limit: 50 } }),
);

const replyMutation = useMutation({
  mutationFn: (content: string) => client.note.create({ content, replyTo: props.noteId }),
  onSuccess: () => {
    replyContent.value = "";
    replyError.value = "";
    queryClient.invalidateQueries({
      queryKey: orpc.note.replies.queryOptions({ input: { noteId: props.noteId } }).queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: orpc.note.get.queryOptions({ input: { id: props.noteId } }).queryKey,
    });
  },
  onError: (e: Error) => {
    replyError.value = e.message || "Failed to reply";
  },
});

function handleReply() {
  if (!replyContent.value.trim()) return;
  replyMutation.mutate(replyContent.value);
}
</script>

<template>
  <div>
    <div v-if="isLoading" class="text-center text-gray-400 py-8">Loading...</div>
    <div v-else-if="error" class="text-center text-red-500 py-8">{{ error.message }}</div>
    <div v-else-if="note">
      <NoteCard :note="note" :full="true" />

      <!-- Reply form -->
      <div v-if="isLoggedIn" class="bg-white rounded-lg border border-gray-200 p-4 mt-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">Reply</h3>
        <textarea
          v-model="replyContent"
          rows="2"
          class="w-full border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Write a reply..."
        />
        <div class="flex items-center justify-between mt-2">
          <p v-if="replyError" class="text-red-500 text-sm">{{ replyError }}</p>
          <span v-else class="text-sm text-gray-400">{{ replyContent.length }} / 10000</span>
          <button
            @click="handleReply"
            :disabled="!replyContent.trim() || replyMutation.isPending.value"
            class="bg-gray-900 text-white px-4 py-1.5 rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {{ replyMutation.isPending.value ? "Replying..." : "Reply" }}
          </button>
        </div>
      </div>
      <div
        v-else
        class="bg-white rounded-lg border border-gray-200 p-4 mt-4 text-center text-gray-500"
      >
        <RouterLink to="/login" class="text-gray-900 underline">Login</RouterLink> to reply
      </div>

      <!-- Replies list -->
      <div class="mt-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Replies ({{ note.replyCount }})</h3>
        <div v-if="repliesLoading" class="text-center text-gray-400 py-4">Loading replies...</div>
        <div v-else-if="replies && replies.length > 0" class="space-y-3">
          <NoteCard v-for="reply in replies" :key="reply.id" :note="reply" />
        </div>
        <div v-else class="text-center text-gray-400 py-4">No replies yet</div>
      </div>
    </div>
  </div>
</template>
