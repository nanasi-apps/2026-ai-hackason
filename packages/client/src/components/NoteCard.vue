<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
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

const { user, isLoggedIn } = useAuth();
const queryClient = useQueryClient();

const isOwner = computed(() => user.value?.id === props.note.userId);
const isLocked = computed(() => !props.note.unlocked && !isOwner.value);

const localLiked = ref(props.note.liked);
const localLikeCount = ref(props.note.likeCount);

const { data: myRecommendations } = useQuery({
  ...orpc.recommend.listMine.queryOptions(),
  enabled: isLoggedIn,
});

const recommendationCountForNote = computed(
  () => myRecommendations.value?.recommendations.filter((item) => item.noteId === props.note.id).length ?? 0,
);

const remainingRecommendationCount = computed(() => myRecommendations.value?.remainingCount ?? 0);

const deleteMutation = useMutation({
  mutationFn: () => client.note.delete({ id: props.note.id }),
  onSuccess: () => {
    queryClient.invalidateQueries();
  },
});

const likeMutation = useMutation({
  mutationFn: () => client.like.toggle({ noteId: props.note.id }),
  onSuccess: (data) => {
    localLiked.value = data.liked;
    localLikeCount.value = data.likeCount;
    queryClient.invalidateQueries();
  },
});

const recommendMutation = useMutation({
  mutationFn: () => client.recommend.create({ noteId: props.note.id }),
  onSuccess: () => {
    queryClient.invalidateQueries();
  },
});

function handleDelete() {
  if (confirm("Delete this post?")) {
    deleteMutation.mutate();
  }
}

function handleLike() {
  if (!isLoggedIn.value) return;
  likeMutation.mutate();
}

function handleRecommend() {
  if (!isLoggedIn.value || remainingRecommendationCount.value <= 0) return;
  recommendMutation.mutate();
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

    <div v-if="note.replyTo" class="text-xs text-gray-400 mb-1">
      <RouterLink :to="`/${note.replyTo}`" class="hover:underline"> Replying to a post </RouterLink>
    </div>

    <div v-if="isLocked" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <p class="font-medium">Original text is locked.</p>
      <p class="mt-1 text-amber-800">
        Daily recommendations are aggregated at the end of the day. The top note opens tomorrow.
      </p>
    </div>
    <p v-else class="text-gray-800 whitespace-pre-wrap break-words">{{ displayContent }}</p>
    <button
      v-if="!isLocked && isLong && !expanded"
      @click="expanded = true"
      class="text-sm text-gray-500 hover:text-gray-700 mt-1"
    >
      Show more
    </button>

    <div class="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100">
      <button
        @click="handleLike"
        :disabled="!isLoggedIn"
        class="flex items-center gap-1 text-sm transition-colors"
        :class="
          localLiked
            ? 'text-red-500 hover:text-red-600'
            : 'text-gray-400 hover:text-red-400 disabled:hover:text-gray-400'
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          :fill="localLiked ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="2"
          class="w-4 h-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
        <span>{{ localLikeCount }}</span>
      </button>

      <RouterLink
        :to="`/${note.id}`"
        class="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="w-4 h-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
          />
        </svg>
        <span>{{ note.replyCount }}</span>
      </RouterLink>

      <button
        @click="handleRecommend"
        :disabled="!isLoggedIn || remainingRecommendationCount <= 0 || recommendMutation.isPending.value"
        class="flex items-center gap-1 text-sm text-amber-600 transition-colors disabled:text-gray-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="w-4 h-4"
        >
          <path
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321 1.01l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.386a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.886a.562.562 0 01-.84-.611l1.285-5.386a.562.562 0 00-.182-.557L2.04 10.407a.563.563 0 01.321-1.01l5.518-.442a.563.563 0 00.475-.345l2.125-5.11z"
          />
        </svg>
        <span>{{ note.recommendCount }}</span>
        <span v-if="isLoggedIn" class="text-xs text-gray-400">today {{ remainingRecommendationCount }} left</span>
        <span v-if="recommendationCountForNote > 0" class="text-xs text-amber-700">
          あなた{{ recommendationCountForNote }}
        </span>
      </button>
    </div>
  </div>
</template>
