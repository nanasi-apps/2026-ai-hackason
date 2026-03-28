<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { client, orpc } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";
import { useToast } from "../composables/useToast";
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
const { show: showToast } = useToast();
const queryClient = useQueryClient();
const router = useRouter();

const isOwner = computed(() => user.value?.id === props.note.userId);
const summaryLines = computed(() => {
  const lines = props.note.summary
    ?.split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

  return lines && lines.length > 0
    ? lines
    : ["言葉が滲んだ。", "誰かに届いた。", "それだけでいい。"];
});

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
    const remaining = remainingRecommendationCount.value - 1;
    if (remaining <= 0) {
      showToast("推薦しました！今日の推薦枠を使い切りました", "info");
    } else {
      showToast(`推薦しました！残り ${remaining} 回`, "success");
    }
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

function openNote() {
  if (props.full) return;
  router.push(`/${props.note.id}`);
}

function handleCardKeydown(event: KeyboardEvent) {
  if (props.full) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openNote();
  }
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
</script>

<template>
  <article
    class="overflow-hidden rounded-xl border transition-all duration-200 animate-fade-up"
    style="background-color: #12121a; border-color: #2a2a40"
    :class="
      props.full
        ? ''
        : 'cursor-pointer hover:border-[#3a3a55] focus:outline-none focus:ring-1 focus:ring-[#7c6af7]'
    "
    :tabindex="props.full ? undefined : 0"
    :role="props.full ? undefined : 'link'"
    @click="openNote"
    @keydown="handleCardKeydown"
  >
    <!-- Author row -->
    <div class="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <div
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
        >
          {{ note.author.username.charAt(0).toUpperCase() }}
        </div>
        <RouterLink
          :to="`/user/${note.author.username}`"
          class="text-sm font-semibold transition-colors"
          style="color: #a99af9"
          onmouseover="this.style.color = &quot;#ffffff&quot;;"
          onmouseout="this.style.color = &quot;#a99af9&quot;;"
          @click.stop
        >
          @{{ note.author.username }}
        </RouterLink>
      </div>

      <div class="flex items-center gap-2">
        <div v-if="note.replyTo" class="text-xs" style="color: #fff">
          <RouterLink
            :to="`/${note.replyTo}`"
            class="transition-colors"
            style="color: #fff"
            onmouseover="this.style.color = &quot;#fff&quot;;"
            onmouseout="this.style.color = &quot;#fff&quot;;"
            @click.stop
          >
            ↩ 返信
          </RouterLink>
        </div>
        <RouterLink
          :to="`/${note.id}`"
          class="text-xs font-mono transition-colors"
          style="color: #fff"
          onmouseover="this.style.color = &quot;#fff&quot;;"
          onmouseout="this.style.color = &quot;#fff&quot;;"
          @click.stop
        >
          {{ formatDate(note.createdAt) }}
        </RouterLink>
        <button
          v-if="isOwner"
          type="button"
          @click="handleDelete"
          :disabled="deleteMutation.isPending.value"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-all disabled:opacity-50"
          style="border-color: #e85d9a66; background-color: #e85d9a14; color: #e85d9a"
          onmouseover="this.style.backgroundColor = &quot;#e85d9a22&quot;;"
          onmouseout="this.style.backgroundColor = &quot;#e85d9a14&quot;;"
          @click.stop
        >
          {{ deleteMutation.isPending.value ? "削除中..." : "削除" }}
        </button>
      </div>
    </div>

    <div class="border-b border-t px-5 pt-3 pb-3" style="border-color: #2a2a4080">
      <div class="flex flex-col gap-0.5">
        <span
          v-for="(line, i) in summaryLines"
          :key="`${note.id}-${i}`"
          class="text-sm font-medium leading-relaxed"
          style="font-family: &quot;Space Mono&quot;, monospace; color: #fff"
          >{{ line }}</span
        >
      </div>
    </div>

    <div v-if="props.full && note.content" class="px-5 py-4">
      <div class="text-xs mb-2" style="color: #7c6af7">原文</div>
      <p class="whitespace-pre-wrap text-sm leading-7" style="color: #fff">
        {{ note.content }}
      </p>
    </div>

    <!-- Action bar -->
    <div class="flex items-center gap-6 border-t px-5 py-3" style="border-color: #2a2a4060">
      <button
        type="button"
        @click="handleLike"
        :disabled="!isLoggedIn"
        class="flex items-center gap-2 transition-all duration-150 px-2 py-1.5 rounded-lg"
        :style="localLiked ? 'color: #e85d9a;' : 'color: #fff;'"
        :onmouseover="isLoggedIn ? 'this.style.color=\'#e85d9a\'' : ''"
        :onmouseout="localLiked ? 'this.style.color=\'#e85d9a\'' : 'this.style.color=\'#fff\''"
        @click.stop
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          :fill="localLiked ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="2"
          class="h-5 w-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
        <span class="text-sm font-mono">{{ localLikeCount }}</span>
      </button>

      <RouterLink
        :to="`/${note.id}`"
        class="flex items-center gap-2 transition-colors px-2 py-1.5 rounded-lg"
        style="color: #fff"
        onmouseover="this.style.color = &quot;#7c6af7&quot;;"
        onmouseout="this.style.color = &quot;#fff&quot;;"
        @click.stop
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-5 w-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
          />
        </svg>
        <span class="text-sm font-mono">{{ note.replyCount }}</span>
      </RouterLink>

      <button
        type="button"
        @click="handleRecommend"
        :disabled="
          !isLoggedIn || remainingRecommendationCount <= 0 || recommendMutation.isPending.value
        "
        class="flex items-center gap-2 transition-all duration-150 disabled:opacity-40 px-2 py-1.5 rounded-lg"
        :style="recommendationCountForNote > 0 ? 'color: #f59e0b;' : 'color: #fff;'"
        :onmouseover="
          isLoggedIn && remainingRecommendationCount > 0 ? 'this.style.color=\'#f59e0b\'' : ''
        "
        :onmouseout="
          recommendationCountForNote > 0
            ? 'this.style.color=\'#f59e0b\''
            : 'this.style.color=\'#fff\''
        "
        @click.stop
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="h-5 w-5"
        >
          <path
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321 1.01l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.386a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.886a.562.562 0 01-.84-.611l1.285-5.386a.562.562 0 00-.182-.557L2.04 10.407a.563.563 0 01.321-1.01l5.518-.442a.563.563 0 00.475-.345l2.125-5.11z"
          />
        </svg>
        <span class="text-sm font-mono">{{ note.recommendCount }}</span>
        <span v-if="note.recommended" class="text-xs text-emerald-700">daily winner</span>
      </button>
    </div>
  </article>
</template>
