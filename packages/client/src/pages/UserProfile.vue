<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { orpc } from '../lib/orpc'
import NoteCard from '../components/NoteCard.vue'

const props = defineProps<{ username: string }>()

const { data: notes, isLoading } = useQuery(
  orpc.note.listByUser.queryOptions({ input: { username: props.username, limit: 50 } }),
)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold mb-4">@{{ username }}</h1>
    <div v-if="isLoading" class="text-center text-gray-400 py-8">Loading...</div>
    <div v-else-if="notes && notes.length > 0" class="space-y-4">
      <NoteCard v-for="note in notes" :key="note.id" :note="note" />
    </div>
    <div v-else class="text-center text-gray-400 py-8">No posts yet</div>
  </div>
</template>
