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
    <!-- Hero text -->
    <div class="mb-8 text-center">
      <p class="text-sm font-mono tracking-widest uppercase" style="color: #3a3a55">
        あなたの言葉を、AIが盛大に誤読する
      </p>
    </div>

    <!-- Post form -->
    <div
      v-if="isLoggedIn"
      class="rounded-xl border mb-8 overflow-hidden"
      style="background-color: #12121a; border-color: #2a2a40"
    >
      <div class="px-4 pt-4 pb-3">
        <textarea
          v-model="content"
          rows="4"
          class="w-full resize-none focus:outline-none text-sm leading-relaxed bg-transparent"
          style="color: #ffffff; caret-color: #a99af9"
          placeholder="何でも書いてください。AIが盛大に誤読します。"
          :maxlength="charLimit"
        />
      </div>
      <div
        class="flex items-center justify-between px-4 py-3 border-t"
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
          class="px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-40"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
        >
          {{ createMutation.isPending.value ? "投稿中..." : "投稿" }}
        </button>
      </div>
    </div>

    <!-- Login prompt -->
    <div
      v-else
      class="rounded-xl border mb-8 p-6 text-center"
      style="background-color: #12121a; border-color: #2a2a40"
    >
      <p class="text-sm mb-3" style="color: #6b6b8a">
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
          class="px-4 py-1.5 rounded-full text-sm transition-colors"
          style="border: 1px solid #2a2a40; color: #6b6b8a"
          onmouseover="this.style.borderColor = &quot;#7c6af7&quot;;
          this.style.color = &quot;#a99af9&quot;;"
          onmouseout="this.style.borderColor = &quot;#2a2a40&quot;;
          this.style.color = &quot;#6b6b8a&quot;;"
          >ログイン</RouterLink
        >
        <RouterLink
          to="/register"
          class="px-4 py-1.5 rounded-full text-sm font-medium"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
          >新規登録</RouterLink
        >
      </div>
    </div>

    <!-- Timeline label -->
    <div class="flex items-center gap-3 mb-4">
      <span class="text-xs font-mono tracking-widest uppercase" style="color: #3a3a55"
        >タイムライン</span
      >
      <div class="flex-1 h-px" style="background-color: #2a2a40"></div>
    </div>

    <!-- Notes -->
    <div v-if="isLoading" class="text-center py-12">
      <div
        class="inline-block w-5 h-5 rounded-full border-2 animate-spin"
        style="border-color: #2a2a40; border-top-color: #7c6af7"
      ></div>
    </div>
    <div v-else-if="notes && notes.length > 0" class="space-y-3">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" />
    </div>
    <div v-else class="text-center py-16">
      <p class="text-sm font-mono" style="color: #3a3a55">まだ投稿がありません</p>
    </div>
  </div>
</template>
