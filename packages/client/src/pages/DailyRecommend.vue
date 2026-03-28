<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { orpc } from "../lib/orpc";
import NoteCard from "../components/NoteCard.vue";

const { data, isLoading, error } = useQuery(orpc.note.dailyWinner.queryOptions());

const todayTopNotes = useQuery(orpc.note.topRecommended.queryOptions({ input: { limit: 3 } }));

const formattedPublishedDay = computed(() => {
  if (!data.value?.publishedDay) return "";
  return new Date(`${data.value.publishedDay}T00:00:00`).toLocaleDateString("ja-JP");
});

const formattedSourceDay = computed(() => {
  if (!data.value?.sourceDay) return "";
  return new Date(`${data.value.sourceDay}T00:00:00`).toLocaleDateString("ja-JP");
});
</script>

<template>
  <div>
    <!-- Hero -->
    <section
      class="mb-8 rounded-2xl border p-5"
      style="
        background: linear-gradient(135deg, #12121a 0%, #171728 60%, #12121a 100%);
        border-color: #2a2a40;
      "
    >
      <p class="text-xs font-mono tracking-[0.28em] uppercase" style="color: #f59e0b">
        Daily Recommend
      </p>
      <h1 class="mt-2 text-2xl font-semibold leading-tight" style="color: #ffffff">
        今日のトップ3と昨日のTop 3
      </h1>
      <p class="mt-3 text-sm leading-6" style="color: #6b6b8a">
        今日のランキングはリアルタイム更新。翌日になると、前日の上位3投稿の本文がここで開きます。
      </p>
      <div v-if="formattedPublishedDay" class="mt-4 flex flex-wrap items-center gap-3">
        <span class="text-xs font-mono" style="color: #f59e0b">
          掲載日: {{ formattedPublishedDay }}
        </span>
        <span v-if="formattedSourceDay" class="text-xs font-mono" style="color: #3a3a55">
          集計日: {{ formattedSourceDay }}
        </span>
        <span
          v-if="data?.manual"
          class="rounded-full px-2 py-0.5 text-xs font-mono"
          style="background-color: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40"
        >
          手動公開
        </span>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center">
      <div
        class="inline-block h-5 w-5 rounded-full border-2 animate-spin"
        style="border-color: #2a2a40; border-top-color: #f59e0b"
      ></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-10 text-center">
      <p class="text-sm font-mono" style="color: #e85d9a">{{ error.message }}</p>
    </div>

    <div class="mb-8">
      <div class="mb-4 flex items-center gap-3">
        <span class="text-xs font-mono tracking-widest uppercase" style="color: #f59e0b">
          今日のトップ3
        </span>
        <div class="flex-1 h-px" style="background-color: #2a2a40"></div>
      </div>

      <div v-if="todayTopNotes.data.value && todayTopNotes.data.value.length > 0" class="space-y-3">
        <NoteCard v-for="note in todayTopNotes.data.value" :key="`today-${note.id}`" :note="note" />
      </div>
      <div
        v-else
        class="rounded-xl border border-dashed p-10 text-center"
        style="border-color: #2a2a40"
      >
        <p class="text-sm font-mono" style="color: #3a3a55">
          まだ今日のトップ3はありません。推薦が入るとここに並びます。
        </p>
      </div>
    </div>

    <!-- Winner card -->
    <div v-if="!isLoading && !error && data?.notes?.length" class="mb-4">
      <div class="flex items-center gap-3 mb-4">
        <span class="text-xs font-mono tracking-widest uppercase" style="color: #f59e0b">
          昨日のTop 3
        </span>
        <div class="flex-1 h-px" style="background-color: #2a2a40"></div>
      </div>
      <div class="space-y-3">
        <NoteCard
          v-for="note in data.notes"
          :key="`yesterday-${note.id}`"
          :note="note"
          :full="true"
        />
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!isLoading && !error"
      class="rounded-xl border border-dashed p-10 text-center"
      style="border-color: #2a2a40"
    >
      <p class="text-sm font-mono" style="color: #3a3a55">
        まだ昨日のTop 3はありません。今日の推薦結果が翌日にここへ反映されます。
      </p>
    </div>
  </div>
</template>
