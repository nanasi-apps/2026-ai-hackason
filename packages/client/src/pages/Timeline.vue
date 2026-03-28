<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useRoute, useRouter } from "vue-router";
import { client, orpc } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";
import NoteCard from "../components/NoteCard.vue";

const { isLoggedIn } = useAuth();
const queryClient = useQueryClient();
const route = useRoute();
const router = useRouter();

const content = ref("");
const postError = ref("");
const composerRef = ref<HTMLTextAreaElement | null>(null);

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

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && e.altKey) {
    e.preventDefault();
    handlePost();
  }
}

const charLimit = 5000;
const charColor = () => {
  if (content.value.length > charLimit * 0.9) return "#ec6fac";
  if (content.value.length > charLimit * 0.7) return "#f59e0b";
  return "#f0f0f8";
};

async function focusComposer() {
  await nextTick();
  composerRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
  composerRef.value?.focus();
}

function handleOpenComposerEvent() {
  if (!isLoggedIn.value) return;
  focusComposer();
}

onMounted(() => {
  window.addEventListener("open-composer", handleOpenComposerEvent);
});

onBeforeUnmount(() => {
  window.removeEventListener("open-composer", handleOpenComposerEvent);
});

watch(
  () => route.query.compose,
  async (compose) => {
    if (compose !== "1" || !isLoggedIn.value) return;
    await focusComposer();
    router.replace({ path: "/" });
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <div
      v-if="isLoggedIn"
      class="mb-8 overflow-hidden rounded-xl border"
      style="background-color: #15151f; border-color: #252538"
    >
      <div class="px-4 pt-4 pb-3">
        <div v-if="myRecommendations" class="mb-3 text-xs font-mono" style="color: #f59e0b">
          今日の残り推薦 {{ myRecommendations.remainingCount }}
        </div>
        <textarea
          ref="composerRef"
          v-model="content"
          rows="4"
          class="w-full resize-none bg-transparent text-sm leading-relaxed focus:outline-none"
          style="color: #f0f0f8; caret-color: #b8acfa"
          placeholder="何でも書いてください。（Alt+Enter で送信）"
          :maxlength="charLimit"
          @keydown="handleKeydown"
        />
      </div>
      <div
        class="flex items-center justify-between border-t px-4 py-3"
        style="border-color: #25253840"
      >
        <div class="flex items-center gap-3">
          <p v-if="postError" class="text-xs" style="color: #ec6fac">{{ postError }}</p>
          <span v-else class="text-xs font-mono" :style="{ color: charColor() }">
            {{ content.length }} / {{ charLimit }}
          </span>
        </div>
        <button
          @click="handlePost"
          :disabled="!content.trim() || createMutation.isPending.value"
          class="rounded-full px-5 py-1.5 text-sm font-medium transition-all duration-150 disabled:opacity-40"
          style="background: linear-gradient(135deg, #8b7cf8 0%, #ec6fac 100%); color: white"
        >
          {{ createMutation.isPending.value ? "投稿中..." : "投稿" }}
        </button>
      </div>
    </div>

    <div
      v-else
      class="mb-8 rounded-xl border p-6 text-center"
      style="background-color: #15151f; border-color: #252538"
    >
      <p class="mb-3 text-sm" style="color: #f0f0f8">
        投稿するには
        <RouterLink
          to="/login"
          class="transition-colors"
          style="color: #b8acfa"
          onmouseover="this.style.color = &quot;#f0f0f8&quot;;"
          onmouseout="this.style.color = &quot;#b8acfa&quot;;"
          >ログイン</RouterLink
        >
        してください
      </p>
      <div class="flex justify-center gap-3">
        <RouterLink
          to="/login"
          class="rounded-full px-4 py-1.5 text-sm transition-colors"
          style="border: 1px solid #252538; color: #f0f0f8"
          onmouseover="this.style.borderColor = &quot;#8b7cf8&quot;;
          this.style.color = &quot;#b8acfa&quot;;"
          onmouseout="this.style.borderColor = &quot;#252538&quot;;
          this.style.color = &quot;#f0f0f8&quot;;"
          >ログイン</RouterLink
        >
        <RouterLink
          to="/register"
          class="rounded-full px-4 py-1.5 text-sm font-medium"
          style="background: linear-gradient(135deg, #8b7cf8 0%, #ec6fac 100%); color: white"
          >新規登録</RouterLink
        >
      </div>
    </div>

    <div v-if="isLoading" class="py-12 text-center">
      <div
        class="inline-block h-5 w-5 rounded-full border-2 animate-spin"
        style="border-color: #252538; border-top-color: #8b7cf8"
      ></div>
    </div>
    <div v-else-if="notes && notes.length > 0" class="space-y-3">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" />
    </div>
    <div v-else class="py-16 text-center">
      <p class="text-sm font-mono" style="color: #f0f0f8">まだ投稿がありません</p>
    </div>
  </div>
</template>
