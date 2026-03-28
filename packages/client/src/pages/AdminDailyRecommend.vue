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
  <section>
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Admin</p>
      <h1 class="mt-2 text-2xl font-semibold text-gray-900">Daily Recommend Control</h1>
      <p class="mt-2 text-sm leading-6 text-gray-600">
        Admin users can publish today's Daily Recommend immediately without waiting for the next
        day.
      </p>

      <div v-if="isAdmin" class="mt-5 flex items-center gap-3">
        <button
          @click="publishMutation.mutate()"
          :disabled="publishMutation.isPending.value"
          class="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {{ publishMutation.isPending.value ? "Publishing..." : "Publish now" }}
        </button>
      </div>
      <p v-else class="mt-5 text-sm text-red-500">You are not allowed to access this page.</p>
    </div>

    <div
      v-if="isAdmin"
      class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-gray-700"
    >
      <p v-if="isLoading">Loading current state...</p>
      <template v-else-if="data">
        <p>Published day: {{ data.publishedDay }}</p>
        <p>Source day: {{ data.sourceDay }}</p>
        <p>Mode: {{ data.manual ? "manual" : "automatic" }}</p>
        <p v-if="data.note">Current note: @{{ data.note.author.username }}</p>
        <p v-else>No published winner yet.</p>
      </template>
    </div>
  </section>
</template>
