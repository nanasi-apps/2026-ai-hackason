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
    queryClient.invalidateQueries();
  },
  onError: (e: Error) => {
    replyError.value = e.message || "返信に失敗しました";
  },
});

function handleReply() {
  if (!replyContent.value.trim()) return;
  replyMutation.mutate(replyContent.value);
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-16">
      <div
        class="inline-block w-5 h-5 rounded-full border-2 animate-spin"
        style="border-color: #2a2a40; border-top-color: #7c6af7"
      ></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-sm font-mono" style="color: #e85d9a">{{ error.message }}</p>
    </div>

    <div v-else-if="note">
      <!-- Note card -->
      <NoteCard :note="note" :full="true" />

      <!-- Reply form -->
      <div
        v-if="isLoggedIn"
        class="rounded-xl border mt-4 overflow-hidden"
        style="background-color: #12121a; border-color: #2a2a40"
      >
        <div class="px-4 pt-3 pb-2">
          <p class="text-xs font-mono tracking-wider uppercase mb-2" style="color: #3a3a55">返信</p>
          <textarea
            v-model="replyContent"
            rows="3"
            class="w-full resize-none focus:outline-none text-sm leading-relaxed bg-transparent"
            style="color: #ffffff; caret-color: #a99af9"
            placeholder="返信を書く..."
          />
        </div>
        <div
          class="flex items-center justify-between px-4 py-3 border-t"
          style="border-color: #2a2a4060"
        >
          <p v-if="replyError" class="text-xs" style="color: #e85d9a">{{ replyError }}</p>
          <span v-else class="text-xs font-mono" style="color: #3a3a55">{{
            replyContent.length
          }}</span>
          <button
            @click="handleReply"
            :disabled="!replyContent.trim() || replyMutation.isPending.value"
            class="px-5 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-40"
            style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
          >
            {{ replyMutation.isPending.value ? "送信中..." : "返信する" }}
          </button>
        </div>
      </div>

      <!-- Login prompt -->
      <div
        v-else
        class="rounded-xl border mt-4 p-5 text-center"
        style="background-color: #12121a; border-color: #2a2a40"
      >
        <p class="text-sm" style="color: #6b6b8a">
          <RouterLink
            to="/login"
            style="color: #a99af9"
            onmouseover="this.style.color = &quot;#ffffff&quot;;"
            onmouseout="this.style.color = &quot;#a99af9&quot;;"
            >ログイン</RouterLink
          >
          して返信する
        </p>
      </div>

      <!-- Replies section -->
      <div class="mt-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-xs font-mono tracking-widest uppercase" style="color: #3a3a55">
            返信 ({{ note.replyCount }})
          </span>
          <div class="flex-1 h-px" style="background-color: #2a2a40"></div>
        </div>

        <div v-if="repliesLoading" class="text-center py-8">
          <div
            class="inline-block w-4 h-4 rounded-full border-2 animate-spin"
            style="border-color: #2a2a40; border-top-color: #7c6af7"
          ></div>
        </div>
        <div v-else-if="replies && replies.length > 0" class="space-y-3">
          <NoteCard v-for="reply in replies" :key="reply.id" :note="reply" />
        </div>
        <div v-else class="text-center py-8">
          <p class="text-sm font-mono" style="color: #3a3a55">まだ返信がありません</p>
        </div>
      </div>
    </div>
  </div>
</template>
