import { implement } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { CORSPlugin } from '@orpc/server/plugins'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { contract } from '@aihackason/contract'
import { todos } from './db/schema'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

const os = implement(contract)

const listTodos = os.todo.list.handler(async ({ input, context }) => {
  const { db } = context as { db: ReturnType<typeof drizzle> }
  const rows = await db
    .select()
    .from(todos)
    .orderBy(desc(todos.createdAt))
    .limit(input.limit)
    .offset(input.offset)
  return rows
})

const getTodo = os.todo.get.handler(async ({ input, context }) => {
  const { db } = context as { db: ReturnType<typeof drizzle> }
  const [todo] = await db.select().from(todos).where(eq(todos.id, input.id))
  if (!todo) throw new Error('Todo not found')
  return todo
})

const createTodo = os.todo.create.handler(async ({ input, context }) => {
  const { db } = context as { db: ReturnType<typeof drizzle> }
  const id = crypto.randomUUID()
  const [todo] = await db
    .insert(todos)
    .values({ id, title: input.title })
    .returning()
  return todo
})

const updateTodo = os.todo.update.handler(async ({ input, context }) => {
  const { db } = context as { db: ReturnType<typeof drizzle> }
  const updates: Record<string, unknown> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.completed !== undefined) updates.completed = input.completed

  const [todo] = await db
    .update(todos)
    .set(updates)
    .where(eq(todos.id, input.id))
    .returning()
  if (!todo) throw new Error('Todo not found')
  return todo
})

const deleteTodo = os.todo.delete.handler(async ({ input, context }) => {
  const { db } = context as { db: ReturnType<typeof drizzle> }
  const result = await db.delete(todos).where(eq(todos.id, input.id)).returning()
  if (result.length === 0) throw new Error('Todo not found')
  return { success: true }
})

const router = os.router({
  todo: {
    list: listTodos,
    get: getTodo,
    create: createTodo,
    update: updateTodo,
    delete: deleteTodo,
  },
})

export type Router = typeof router

const handler = new RPCHandler(router, {
  plugins: [new CORSPlugin()],
})

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.DB)

    const { matched, response } = await handler.handle(request, {
      prefix: '/rpc',
      context: { db },
    })

    if (matched) {
      return response
    }

    return env.ASSETS.fetch(request)
  },
}
