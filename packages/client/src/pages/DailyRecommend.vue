<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { orpc } from "../lib/orpc";
import NoteCard from "../components/NoteCard.vue";

const { data, isLoading, error } = useQuery(orpc.note.dailyWinner.queryOptions());

const formattedPublishedDay = computed(() => {
  if (!data.value?.publishedDay) return "";
  return new Date(`${data.value.publishedDay}T00:00:00`).toLocaleDateString();
});

const formattedSourceDay = computed(() => {
  if (!data.value?.sourceDay) return "";
  return new Date(`${data.value.sourceDay}T00:00:00`).toLocaleDateString();
});
</script>

<template>
  <section>
    <div
      class="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-white p-6"
    >
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        Daily Recommend
      </p>
      <h1 class="mt-2 text-2xl font-semibold text-gray-900">Yesterday's most recommended note</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
        At the end of each day, recommendations are aggregated and the top post is opened on the
        next day. This page is the place to check that daily winner as a 3-word misread only.
      </p>
      <p v-if="formattedPublishedDay" class="mt-3 text-sm font-medium text-amber-800">
        Published day: {{ formattedPublishedDay }}
      </p>
      <p v-if="formattedSourceDay" class="mt-1 text-sm text-gray-600">
        Source day: {{ formattedSourceDay }}
        <span
          v-if="data?.manual"
          class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
        >
          manual publish
        </span>
      </p>
    </div>

    <div v-if="isLoading" class="py-10 text-center text-gray-400">Loading daily recommend...</div>
    <div v-else-if="error" class="py-10 text-center text-red-500">{{ error.message }}</div>
    <div v-else-if="data?.note" class="mt-6">
      <NoteCard :note="data.note" :full="true" />
    </div>
    <div
      v-else
      class="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500"
    >
      No daily winner yet. Once recommendations are collected for a day, the top note appears here
      tomorrow.
    </div>
  </section>
</template>
