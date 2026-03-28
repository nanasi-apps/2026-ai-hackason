import { oc } from '@orpc/contract'
import { z } from 'zod'

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
})

export type Todo = z.infer<typeof TodoSchema>

const listTodos = oc
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
  )
  .output(z.array(TodoSchema))

const getTodo = oc
  .input(z.object({ id: z.string() }))
  .output(TodoSchema)

const createTodo = oc
  .input(z.object({ title: z.string().min(1) }))
  .output(TodoSchema)

const updateTodo = oc
  .input(z.object({
    id: z.string(),
    title: z.string().min(1).optional(),
    completed: z.boolean().optional(),
  }))
  .output(TodoSchema)

const deleteTodo = oc
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))

export const contract = {
  todo: {
    list: listTodos,
    get: getTodo,
    create: createTodo,
    update: updateTodo,
    delete: deleteTodo,
  },
}
