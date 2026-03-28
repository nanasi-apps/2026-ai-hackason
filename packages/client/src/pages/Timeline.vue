<script setup lang="ts">
import { ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { client, orpc } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";
import NoteCard from "../components/NoteCard.vue";

const { isLoggedIn } = useAuth();
const queryClient = useQueryClient();

const content = ref("");
const postError = ref("");

const { data: notes, isLoading } = useQuery(orpc.note.list.queryOptions({ input: { limit: 50 } }));
const { data: myRecommendations } = useQuery({
  ...orpc.recommend.listMine.queryOptions(),
  enabled: isLoggedIn,
});

const createMutation = useMutation({
  mutationFn: (value: string) => client.note.create({ content: value }),
  onSuccess: () => {
    content.value = "";
    postError.value = "";
    queryClient.invalidateQueries();
  },
  onError: (e: any) => {
    postError.value = e.message || "投稿に失敗しました";
  },
});

function handlePost() {
  if (!content.value.trim()) return;
  createMutation.mutate(content.value);
}

const charLimit = 5000;
const charColor = () => {
  if (content.value.length > charLimit * 0.9) return "#e85d9a";
  if (content.value.length > charLimit * 0.7) return "#f59e0b";
  return "#3a3a55";
};
</script>

<template>
  <div>
    <section
      class="mb-8 rounded-2xl border p-5"
      style="
        background: linear-gradient(135deg, #12121a 0%, #171728 60%, #12121a 100%);
        border-color: #2a2a40;
      "
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-mono tracking-[0.28em] uppercase" style="color: #6b6b8a">
            AI MISREAD
          </p>
          <h1 class="mt-2 text-2xl font-semibold leading-tight" style="color: #ffffff">
            長く書ける。タイムラインには 3 語だけ残る。
          </h1>
          <p class="mt-3 text-sm leading-6" style="color: #6b6b8a">
            投稿は AI が誤読して 3 単語に変換。推薦は 1
            日ごとに集計され、いちばん推された投稿が翌日に
            <RouterLink to="/recommend" class="underline" style="color: #a99af9"
              >Daily Recommend</RouterLink
            >
            に出ます。
          </p>
        </div>
        <p v-if="isLoggedIn && myRecommendations" class="text-xs font-mono" style="color: #f59e0b">
          今日の残り推薦 {{ myRecommendations.remainingCount }}
        </p>
      </div>
    </section>

    <div
      v-if="isLoggedIn"
      class="mb-8 overflow-hidden rounded-xl border"
      style="background-color: #12121a; border-color: #2a2a40"
    >
      <div class="px-4 pt-4 pb-3">
        <textarea
          v-model="content"
          rows="4"
          class="w-full resize-none bg-transparent text-sm leading-relaxed focus:outline-none"
          style="color: #ffffff; caret-color: #a99af9"
          placeholder="何でも書いてください。AI が盛大に誤読します。"
          :maxlength="charLimit"
        />
      </div>
      <div
        class="flex items-center justify-between border-t px-4 py-3"
        style="border-color: #2a2a4060"
      >
        <div class="flex items-center gap-3">
          <p v-if="postError" class="text-xs" style="color: #e85d9a">{{ postError }}</p>
          <span v-else class="text-xs font-mono" :style="{ color: charColor() }">
            {{ content.length }} / {{ charLimit }}
          </span>
        </div>
        <button
          @click="handlePost"
          :disabled="!content.trim() || createMutation.isPending.value"
          class="rounded-full px-5 py-1.5 text-sm font-medium transition-all duration-150 disabled:opacity-40"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
        >
          {{ createMutation.isPending.value ? "投稿中..." : "投稿" }}
        </button>
      </div>
    </div>

    <div
      v-else
      class="mb-8 rounded-xl border p-6 text-center"
      style="background-color: #12121a; border-color: #2a2a40"
    >
      <p class="mb-3 text-sm" style="color: #6b6b8a">
        投稿するには
        <RouterLink
          to="/login"
          class="transition-colors"
          style="color: #a99af9"
          onmouseover="this.style.color = &quot;#ffffff&quot;;"
          onmouseout="this.style.color = &quot;#a99af9&quot;;"
          >ログイン</RouterLink
        >
        してください
      </p>
      <div class="flex justify-center gap-3">
        <RouterLink
          to="/login"
          class="rounded-full px-4 py-1.5 text-sm transition-colors"
          style="border: 1px solid #2a2a40; color: #6b6b8a"
          onmouseover="this.style.borderColor = &quot;#7c6af7&quot;;
          this.style.color = &quot;#a99af9&quot;;"
          onmouseout="this.style.borderColor = &quot;#2a2a40&quot;;
          this.style.color = &quot;#6b6b8a&quot;;"
          >ログイン</RouterLink
        >
        <RouterLink
          to="/register"
          class="rounded-full px-4 py-1.5 text-sm font-medium"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
          >新規登録</RouterLink
        >
      </div>
    </div>

    <div class="mb-4 flex items-center gap-3">
      <span class="text-xs font-mono tracking-widest uppercase" style="color: #3a3a55"
        >タイムライン</span
      >
      <div class="h-px flex-1" style="background-color: #2a2a40"></div>
    </div>

    <div v-if="isLoading" class="py-12 text-center">
      <div
        class="inline-block h-5 w-5 rounded-full border-2 animate-spin"
        style="border-color: #2a2a40; border-top-color: #7c6af7"
      ></div>
    </div>
    <div v-else-if="notes && notes.length > 0" class="space-y-3">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" />
    </div>
    <div v-else class="py-16 text-center">
      <p class="text-sm font-mono" style="color: #3a3a55">まだ投稿がありません</p>
    </div>
  </div>
</template>
