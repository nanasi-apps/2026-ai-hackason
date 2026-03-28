<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { orpc } from '../lib/orpc'
import NoteCard from '../components/NoteCard.vue'

const props = defineProps<{ noteId: string }>()

const { data: note, isLoading, error } = useQuery(
  orpc.note.get.queryOptions({ input: { id: props.noteId } }),
)
</script>

<template>
  <div>
    <div v-if="isLoading" class="text-center text-gray-400 py-8">Loading...</div>
    <div v-else-if="error" class="text-center text-red-500 py-8">{{ error.message }}</div>
    <div v-else-if="note">
      <NoteCard :note="note" :full="true" />
    </div>
  </div>
</template>
