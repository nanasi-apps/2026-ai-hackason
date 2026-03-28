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
        background: linear-gradient(135deg, #12121a 0%, #171728 60%, #12121a 100%);
        border-color: #2a2a40;
      "
    >
      <p class="text-xs font-mono tracking-[0.28em] uppercase" style="color: #6b6b8a">Admin</p>
      <h1 class="mt-2 text-2xl font-semibold leading-tight" style="color: #ffffff">
        Daily Recommend 管理
      </h1>
      <p class="mt-3 text-sm leading-6" style="color: #6b6b8a">
        管理者は翌日を待たず、今日の Daily Recommend を即時公開できます。
      </p>

      <div v-if="isAdmin" class="mt-5">
        <button
          @click="publishMutation.mutate()"
          :disabled="publishMutation.isPending.value"
          class="rounded-full px-5 py-2 text-sm font-medium transition-all disabled:opacity-40"
          style="background: linear-gradient(135deg, #7c6af7 0%, #e85d9a 100%); color: white"
        >
          {{ publishMutation.isPending.value ? "公開中..." : "今すぐ公開" }}
        </button>
      </div>
      <p v-else class="mt-4 text-sm font-mono" style="color: #e85d9a">
        このページへのアクセス権限がありません。
      </p>
    </section>

    <!-- Current state -->
    <div
      v-if="isAdmin"
      class="rounded-xl border p-5"
      style="background-color: #12121a; border-color: #2a2a40"
    >
      <p class="text-xs font-mono tracking-widest uppercase mb-3" style="color: #3a3a55">
        現在の状態
      </p>
      <div v-if="isLoading" class="py-4 text-center">
        <div
          class="inline-block h-4 w-4 rounded-full border-2 animate-spin"
          style="border-color: #2a2a40; border-top-color: #7c6af7"
        ></div>
      </div>
      <template v-else-if="data">
        <div class="space-y-2 text-sm font-mono">
          <p>
            <span style="color: #3a3a55">掲載日: </span>
            <span style="color: #ffffff">{{ data.publishedDay ?? "—" }}</span>
          </p>
          <p>
            <span style="color: #3a3a55">集計日: </span>
            <span style="color: #ffffff">{{ data.sourceDay ?? "—" }}</span>
          </p>
          <p>
            <span style="color: #3a3a55">モード: </span>
            <span
              class="rounded-full px-2 py-0.5 text-xs"
              :style="
                data.manual
                  ? 'background-color: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40'
                  : 'background-color: #7c6af720; color: #a99af9; border: 1px solid #7c6af740'
              "
            >
              {{ data.manual ? "手動" : "自動" }}
            </span>
          </p>
          <p v-if="data.notes.length > 0">
            <span style="color: #3a3a55">現在の投稿数: </span>
            <span style="color: #a99af9">{{ data.notes.length }}件</span>
          </p>
          <p v-else style="color: #3a3a55">まだ winner がいません。</p>
        </div>
      </template>
    </div>
  </div>
</template>
