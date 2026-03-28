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
        style="border-color: #252538; border-top-color: #8b7cf8"
      ></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-sm font-mono" style="color: #ec6fac">{{ error.message }}</p>
    </div>

    <div v-else-if="note">
      <!-- Note card -->
      <NoteCard :note="note" :full="true" />

      <!-- Thread line + reply form -->
      <div class="flex mt-2">
        <!-- Left connector: vertical line + ┗ hook -->
        <div class="flex flex-col items-center mr-3" style="width: 24px; padding-top: 2px">
          <div class="flex-1 w-px" style="background-color: #252538; min-height: 16px"></div>
          <span class="text-xs leading-none select-none" style="color: #f0f0f8">┗</span>
        </div>

        <!-- Reply form or login prompt -->
        <div class="flex-1">
          <div
            v-if="isLoggedIn"
            class="rounded-xl border overflow-hidden"
            style="background-color: #15151f; border-color: #252538"
          >
            <div class="flex items-center gap-3 px-4 py-2">
              <textarea
                v-model="replyContent"
                rows="1"
                class="flex-1 resize-none focus:outline-none text-sm leading-relaxed bg-transparent"
                style="color: #f0f0f8; caret-color: #b8acfa; max-height: 120px; overflow-y: auto"
                placeholder="返信を書く..."
                @input="
                  ($event.target as HTMLTextAreaElement).style.height = 'auto';
                  ($event.target as HTMLTextAreaElement).style.height =
                    ($event.target as HTMLTextAreaElement).scrollHeight + 'px';
                "
              />
              <div class="flex items-center gap-2 flex-shrink-0">
                <span v-if="replyError" class="text-xs" style="color: #ec6fac">{{
                  replyError
                }}</span>
                <span v-else class="text-xs font-mono" style="color: #f0f0f8">{{
                  replyContent.length || ""
                }}</span>
                <button
                  @click="handleReply"
                  :disabled="!replyContent.trim() || replyMutation.isPending.value"
                  class="px-4 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-40"
                  style="
                    background: linear-gradient(135deg, #8b7cf8 0%, #ec6fac 100%);
                    color: white;
                  "
                >
                  {{ replyMutation.isPending.value ? "送信中..." : "返信" }}
                </button>
              </div>
            </div>
          </div>

          <div v-else class="py-1">
            <p class="text-xs" style="color: #f0f0f8">
              <RouterLink
                to="/login"
                style="color: #b8acfa"
                onmouseover="this.style.color = &quot;#f0f0f8&quot;;"
                onmouseout="this.style.color = &quot;#b8acfa&quot;;"
                >ログイン</RouterLink
              >
              して返信する
            </p>
          </div>
        </div>
      </div>

      <!-- Replies section -->
      <div class="mt-5">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xs font-mono tracking-widest uppercase" style="color: #f0f0f8">
            返信 ({{ note.replyCount }})
          </span>
          <div class="flex-1 h-px" style="background-color: #252538"></div>
        </div>

        <div v-if="repliesLoading" class="text-center py-8">
          <div
            class="inline-block w-4 h-4 rounded-full border-2 animate-spin"
            style="border-color: #252538; border-top-color: #8b7cf8"
          ></div>
        </div>
        <!-- Each reply indented with ┗ connector -->
        <div v-else-if="replies && replies.length > 0" class="space-y-2">
          <div v-for="reply in replies" :key="reply.id" class="flex">
            <div class="flex flex-col items-center mr-3" style="width: 24px; padding-top: 2px">
              <div class="flex-1 w-px" style="background-color: #252538; min-height: 16px"></div>
              <span class="text-xs leading-none select-none" style="color: #f0f0f8">┗</span>
            </div>
            <div class="flex-1">
              <NoteCard :note="reply" />
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-sm font-mono" style="color: #f0f0f8">まだ返信がありません</p>
        </div>
      </div>
    </div>
  </div>
</template>
