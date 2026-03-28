<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { orpc } from '../lib/orpc'

const queryClient = useQueryClient()
const newTitle = ref('')

const { data: todos, isLoading, error } = useQuery(
  orpc.todo.list.queryOptions({ input: { limit: 50, offset: 0 } })
)

const createMutation = useMutation({
  ...orpc.todo.create.mutationOptions(),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: orpc.todo.list.key() })
    newTitle.value = ''
  },
})

const updateMutation = useMutation({
  ...orpc.todo.update.mutationOptions(),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: orpc.todo.list.key() })
  },
})

const deleteMutation = useMutation({
  ...orpc.todo.delete.mutationOptions(),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: orpc.todo.list.key() })
  },
})

function addTodo() {
  const title = newTitle.value.trim()
  if (!title) return
  createMutation.mutate({ title })
}

function toggleTodo(id: string, completed: boolean) {
  updateMutation.mutate({ id, completed: !completed })
}

function removeTodo(id: string) {
  deleteMutation.mutate({ id })
}
</script>

<template>
  <div>
    <form class="flex gap-2 mb-6" @submit.prevent="addTodo">
      <input
        v-model="newTitle"
        placeholder="新しいTodoを追加..."
        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
        :disabled="createMutation.isPending.value"
      />
      <button
        type="submit"
        class="px-5 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
        :disabled="createMutation.isPending.value"
      >
        追加
      </button>
    </form>

    <div v-if="isLoading" class="text-center py-8 text-gray-400">読み込み中...</div>
    <div v-else-if="error" class="text-center py-8 text-red-500">エラー: {{ error.message }}</div>
    <ul v-else-if="todos" class="space-y-2">
      <li
        v-for="todo in todos"
        :key="todo.id"
        class="flex items-center justify-between px-4 py-3 bg-white rounded-lg shadow-sm"
      >
        <label class="flex items-center gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            :checked="todo.completed"
            class="w-4 h-4 accent-indigo-600"
            @change="toggleTodo(todo.id, todo.completed)"
          />
          <span :class="todo.completed ? 'line-through text-gray-400' : 'text-gray-800'">
            {{ todo.title }}
          </span>
        </label>
        <button
          class="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors cursor-pointer"
          @click="removeTodo(todo.id)"
        >
          削除
        </button>
      </li>
      <li v-if="todos.length === 0" class="text-center py-8 text-gray-400">
        Todoはありません
      </li>
    </ul>
  </div>
</template>
