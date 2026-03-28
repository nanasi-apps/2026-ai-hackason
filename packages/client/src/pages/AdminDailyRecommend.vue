<script setup lang="ts">
import { computed } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { client, orpc } from "../lib/orpc";
import { useAuth } from "../composables/useAuth";

const { user } = useAuth();
const queryClient = useQueryClient();

const isAdmin = computed(() => ["mattyatea", "kasukasukun"].includes(user.value?.username ?? ""));

const { data, isLoading } = useQuery({
  ...orpc.note.dailyWinner.queryOptions(),
  enabled: isAdmin,
});

const publishMutation = useMutation({
  mutationFn: () => client.note.publishDailyRecommend({}),
  onSuccess: () => {
    queryClient.invalidateQueries();
  },
});
</script>

<template>
  <div>
    <!-- Header -->
    <section
      class="mb-8 rounded-2xl border p-5"
      style="
        background: linear-gradient(135deg, #15151f 0%, #1a1a2c 60%, #15151f 100%);
        border-color: #252538;
      "
    >
      <p class="text-xs font-mono tracking-[0.28em] uppercase" style="color: #7878a0">Admin</p>
      <h1 class="mt-2 text-2xl font-semibold leading-tight" style="color: #f0f0f8">
        Daily Recommend 管理
      </h1>
      <p class="mt-3 text-sm leading-6" style="color: #7878a0">
        管理者は翌日を待たず、今日の Daily Recommend を即時公開できます。
      </p>

      <div v-if="isAdmin" class="mt-5">
        <button
          @click="publishMutation.mutate()"
          :disabled="publishMutation.isPending.value"
          class="rounded-full px-5 py-2 text-sm font-medium transition-all disabled:opacity-40"
          style="background: linear-gradient(135deg, #8b7cf8 0%, #ec6fac 100%); color: white"
        >
          {{ publishMutation.isPending.value ? "公開中..." : "今すぐ公開" }}
        </button>
      </div>
      <p v-else class="mt-4 text-sm font-mono" style="color: #ec6fac">
        このページへのアクセス権限がありません。
      </p>
    </section>

    <!-- Current state -->
    <div
      v-if="isAdmin"
      class="rounded-xl border p-5"
      style="background-color: #15151f; border-color: #252538"
    >
      <p class="text-xs font-mono tracking-widest uppercase mb-3" style="color: #383852">
        現在の状態
      </p>
      <div v-if="isLoading" class="py-4 text-center">
        <div
          class="inline-block h-4 w-4 rounded-full border-2 animate-spin"
          style="border-color: #252538; border-top-color: #8b7cf8"
        ></div>
      </div>
      <template v-else-if="data">
        <div class="space-y-2 text-sm font-mono">
          <p>
            <span style="color: #383852">掲載日: </span>
            <span style="color: #f0f0f8">{{ data.publishedDay ?? "—" }}</span>
          </p>
          <p>
            <span style="color: #383852">集計日: </span>
            <span style="color: #f0f0f8">{{ data.sourceDay ?? "—" }}</span>
          </p>
          <p>
            <span style="color: #383852">モード: </span>
            <span
              class="rounded-full px-2 py-0.5 text-xs"
              :style="
                data.manual
                  ? 'background-color: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40'
                  : 'background-color: #8b7cf820; color: #b8acfa; border: 1px solid #8b7cf840'
              "
            >
              {{ data.manual ? "手動" : "自動" }}
            </span>
          </p>
          <p v-if="data.notes.length > 0">
            <span style="color: #383852">現在の投稿数: </span>
            <span style="color: #b8acfa">{{ data.notes.length }}件</span>
          </p>
          <p v-else style="color: #383852">まだ winner がいません。</p>
        </div>
      </template>
    </div>
  </div>
</template>
