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

const localLiked = ref(props.note.liked);
const localLikeCount = ref(props.note.likeCount);

const { data: myRecommendations } = useQuery({
  ...orpc.recommend.listMine.queryOptions(),
  enabled: isLoggedIn,
});

const recommendationCountForNote = computed(
  () =>
    myRecommendations.value?.recommendations.filter((item) => item.noteId === props.note.id)
      .length ?? 0,
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
  if (confirm("この投稿を削除しますか？")) {
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
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const expanded = ref(props.full);
const isLong = computed(() => props.note.content.length > 280);
const displayContent = computed(() => {
  if (expanded.value || !isLong.value) return props.note.content;
  return props.note.content.slice(0, 280) + "...";
});

// summaryがあれば3単語に分割して表示
const summaryWords = computed(() => {
  if (!props.note.summary) return null;
  return props.note.summary
    .split(/[/\s　]+/)
    .filter(Boolean)
    .slice(0, 3);
});
</script>

<template>
  <article
    class="rounded-xl border transition-all duration-200 animate-fade-up overflow-hidden"
    style="background-color: #12121a; border-color: #2a2a40"
  >
    <!-- Summary banner (AI 3-word) -->
    <div
      v-if="summaryWords && summaryWords.length > 0"
      class="px-5 pt-4 pb-3 border-b"
      style="border-color: #2a2a4080"
    >
      <div class="flex items-center gap-2 mb-2">
        <span
          class="text-xs font-mono tracking-widest uppercase px-2 py-0.5 rounded"
          style="color: #7c6af7; background-color: #7c6af720; border: 1px solid #7c6af740"
        >
          AI 誤読
        </span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <template v-for="(word, i) in summaryWords" :key="i">
          <span
            class="text-lg font-bold tracking-tight"
            style="
              font-family: &quot;Space Mono&quot;, monospace;
              background: linear-gradient(135deg, #a99af9 0%, #e85d9a 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            "
            >{{ word }}</span
          >
          <span v-if="i < summaryWords.length - 1" class="text-sm" style="color: #3a3a55">/</span>
        </template>
      </div>
    </div>

    <!-- Card body -->
    <div class="px-5 py-4">
      <!-- Header row -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <!-- Avatar placeholder -->
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
          >
            {{ note.author.username.charAt(0).toUpperCase() }}
          </div>
          <RouterLink
            :to="`/user/${note.author.username}`"
            class="text-sm font-semibold transition-colors"
            style="color: #a99af9"
            onmouseover="this.style.color = &quot;#e8e8f0&quot;;"
            onmouseout="this.style.color = &quot;#a99af9&quot;;"
          >
            @{{ note.author.username }}
          </RouterLink>
        </div>

        <div class="flex items-center gap-2">
          <div v-if="note.replyTo" class="text-xs" style="color: #3a3a55">
            <RouterLink
              :to="`/${note.replyTo}`"
              class="transition-colors"
              style="color: #3a3a55"
              onmouseover="this.style.color = &quot;#6b6b8a&quot;;"
              onmouseout="this.style.color = &quot;#3a3a55&quot;;"
            >
              ↩ 返信
            </RouterLink>
          </div>
          <RouterLink
            :to="`/${note.id}`"
            class="text-xs font-mono transition-colors"
            style="color: #3a3a55"
            onmouseover="this.style.color = &quot;#6b6b8a&quot;;"
            onmouseout="this.style.color = &quot;#3a3a55&quot;;"
          >
            {{ formatDate(note.createdAt) }}
          </RouterLink>
          <button
            v-if="isOwner"
            @click="handleDelete"
            class="text-xs transition-colors"
            style="color: #3a3a55"
            onmouseover="this.style.color = &quot;#e85d9a&quot;;"
            onmouseout="this.style.color = &quot;#3a3a55&quot;;"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Content -->
      <p class="text-sm leading-relaxed whitespace-pre-wrap break-words" style="color: #c8c8d8">
        {{ displayContent }}
      </p>
      <button
        v-if="isLong && !expanded"
        @click="expanded = true"
        class="text-xs mt-2 transition-colors"
        style="color: #6b6b8a"
        onmouseover="this.style.color = &quot;#a99af9&quot;;"
        onmouseout="this.style.color = &quot;#6b6b8a&quot;;"
      >
        もっと見る →
      </button>
    </div>

    <!-- Actions bar -->
    <div class="flex items-center gap-5 px-5 py-3 border-t" style="border-color: #2a2a4060">
      <!-- Like button -->
      <button
        @click="handleLike"
        :disabled="!isLoggedIn"
        class="flex items-center gap-1.5 text-sm transition-all duration-150"
        :style="localLiked ? 'color: #e85d9a;' : 'color: #3a3a55;'"
        :onmouseover="isLoggedIn ? 'this.style.color=\'#e85d9a\'' : ''"
        :onmouseout="localLiked ? 'this.style.color=\'#e85d9a\'' : 'this.style.color=\'#3a3a55\''"
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
        <span class="font-mono text-xs">{{ localLikeCount }}</span>
      </button>

      <!-- Reply count -->
      <RouterLink
        :to="`/${note.id}`"
        class="flex items-center gap-1.5 text-sm transition-colors"
        style="color: #3a3a55"
        onmouseover="this.style.color = &quot;#7c6af7&quot;;"
        onmouseout="this.style.color = &quot;#3a3a55&quot;;"
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
        <span class="font-mono text-xs">{{ note.replyCount }}</span>
      </RouterLink>

      <!-- Recommend button -->
      <button
        @click="handleRecommend"
        :disabled="
          !isLoggedIn || remainingRecommendationCount <= 0 || recommendMutation.isPending.value
        "
        class="flex items-center gap-1.5 text-sm transition-all duration-150 disabled:opacity-40"
        :style="recommendationCountForNote > 0 ? 'color: #f59e0b;' : 'color: #3a3a55;'"
        :onmouseover="
          isLoggedIn && remainingRecommendationCount > 0 ? 'this.style.color=\'#f59e0b\'' : ''
        "
        :onmouseout="
          recommendationCountForNote > 0
            ? 'this.style.color=\'#f59e0b\''
            : 'this.style.color=\'#3a3a55\''
        "
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
        <span class="font-mono text-xs">{{ note.recommendCount }}</span>
        <span v-if="isLoggedIn" class="text-xs font-mono" style="color: #3a3a55"
          >{{ remainingRecommendationCount }} 回残り</span
        >
      </button>

      <!-- Unlocked badge -->
      <span
        v-if="(note as any).unlocked"
        class="ml-auto text-xs font-mono px-2 py-0.5 rounded"
        style="color: #3dd6c2; background-color: #3dd6c215; border: 1px solid #3dd6c230"
      >
        原文解放済み
      </span>
    </div>
  </article>
</template>
