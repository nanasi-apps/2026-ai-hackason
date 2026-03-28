<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { client, orpc } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";
import type { NoteWithAuthor } from "@aihackason/contract";

const props = withDefaults(
  defineProps<{
    note: NoteWithAuthor;
    full?: boolean;
  }>(),
  {
    full: false,
  },
);

const { user } = useAuth();
const queryClient = useQueryClient();

const isOwner = computed(() => user.value?.id === props.note.userId);

const deleteMutation = useMutation({
  mutationFn: () => client.note.delete({ id: props.note.id }),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: orpc.note.list.queryOptions({ input: {} }).queryKey,
    });
  },
});

function handleDelete() {
  if (confirm("Delete this post?")) {
    deleteMutation.mutate();
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleString();
}

const expanded = ref(props.full);
const isLong = computed(() => props.note.content.length > 280);
const displayContent = computed(() => {
  if (expanded.value || !isLong.value) return props.note.content;
  return props.note.content.slice(0, 280) + "...";
});
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <div class="flex items-center justify-between mb-2">
      <RouterLink
        :to="`/user/${note.author.username}`"
        class="text-sm font-semibold text-gray-900 hover:underline"
      >
        @{{ note.author.username }}
      </RouterLink>
      <div class="flex items-center gap-2">
        <RouterLink :to="`/${note.id}`" class="text-xs text-gray-400 hover:underline">
          {{ formatDate(note.createdAt) }}
        </RouterLink>
        <button
          v-if="isOwner"
          @click="handleDelete"
          class="text-xs text-red-400 hover:text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
    <p class="text-gray-800 whitespace-pre-wrap break-words">{{ displayContent }}</p>
    <button
      v-if="isLong && !expanded"
      @click="expanded = true"
      class="text-sm text-gray-500 hover:text-gray-700 mt-1"
    >
      Show more
    </button>
  </div>
</template>
