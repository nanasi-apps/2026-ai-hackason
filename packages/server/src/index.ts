import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { contract } from "@aihackason/contract";
import { users, notes } from "./db/schema";
import { hashSync, compareSync } from "bcrypt-ts";
import { SignJWT, jwtVerify } from "jose";

// ========== Types ==========

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET?: string;
}

interface Context {
  db: DrizzleD1Database;
  jwtSecret: Uint8Array;
}

interface AuthContext extends Context {
  userId: string;
}

// ========== JWT Helpers ==========

const JWT_ALG = "HS256";

function getJwtSecret(env: Env): Uint8Array {
  const secret = env.JWT_SECRET || "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

async function createToken(userId: string, secret: Uint8Array): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setExpirationTime("7d")
    .sign(secret);
}

async function verifyToken(token: string, secret: Uint8Array): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [JWT_ALG] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ========== Auth middleware helper ==========

async function requireAuth(context: Context, headers: Headers): Promise<AuthContext> {
  const authHeader = headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7);
  const userId = await verifyToken(token, context.jwtSecret);
  if (!userId) {
    throw new Error("Invalid token");
  }
  return { ...context, userId };
}

// ========== Implementation ==========

const os = implement(contract);

// --- Auth ---

const register = os.auth.register.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const existing = await ctx.db.select().from(users).where(eq(users.username, input.username));
  if (existing.length > 0) {
    throw new Error("Username already taken");
  }

  const id = crypto.randomUUID();
  const passwordHash = hashSync(input.password, 10);

  const [user] = await ctx.db
    .insert(users)
    .values({ id, username: input.username, passwordHash })
    .returning();

  const token = await createToken(id, ctx.jwtSecret);

  return {
    user: { id: user.id, username: user.username, createdAt: user.createdAt },
    token,
  };
});

const login = os.auth.login.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const [user] = await ctx.db.select().from(users).where(eq(users.username, input.username));
  if (!user) {
    throw new Error("Invalid username or password");
  }

  const valid = compareSync(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid username or password");
  }

  const token = await createToken(user.id, ctx.jwtSecret);

  return {
    user: { id: user.id, username: user.username, createdAt: user.createdAt },
    token,
  };
});

const meHandler = os.auth.me.handler(async ({ context }) => {
  const ctx = context as Context & { headers: Headers };
  const auth = await requireAuth(ctx, ctx.headers);

  const [user] = await auth.db.select().from(users).where(eq(users.id, auth.userId));
  if (!user) {
    throw new Error("User not found");
  }

  return { id: user.id, username: user.username, createdAt: user.createdAt };
});

// --- Notes ---

const createNote = os.note.create.handler(async ({ input, context }) => {
  const ctx = context as Context & { headers: Headers };
  const auth = await requireAuth(ctx, ctx.headers);

  const id = crypto.randomUUID();
  const [note] = await auth.db
    .insert(notes)
    .values({ id, userId: auth.userId, content: input.content })
    .returning();

  const [author] = await auth.db.select().from(users).where(eq(users.id, auth.userId));

  return {
    ...note,
    summary: note.summary ?? null,
    author: { id: author.id, username: author.username, createdAt: author.createdAt },
  };
});

const listNotes = os.note.list.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const rows = await ctx.db
    .select()
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .orderBy(desc(notes.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    id: row.notes.id,
    content: row.notes.content,
    summary: row.notes.summary ?? null,
    createdAt: row.notes.createdAt,
    userId: row.notes.userId,
    author: { id: row.users.id, username: row.users.username, createdAt: row.users.createdAt },
  }));
});

const getNote = os.note.get.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const rows = await ctx.db
    .select()
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.id, input.id));

  if (rows.length === 0) {
    throw new Error("Note not found");
  }

  const row = rows[0];
  return {
    id: row.notes.id,
    content: row.notes.content,
    summary: row.notes.summary ?? null,
    createdAt: row.notes.createdAt,
    userId: row.notes.userId,
    author: { id: row.users.id, username: row.users.username, createdAt: row.users.createdAt },
  };
});

const deleteNote = os.note.delete.handler(async ({ input, context }) => {
  const ctx = context as Context & { headers: Headers };
  const auth = await requireAuth(ctx, ctx.headers);

  const [note] = await auth.db.select().from(notes).where(eq(notes.id, input.id));
  if (!note) {
    throw new Error("Note not found");
  }
  if (note.userId !== auth.userId) {
    throw new Error("Forbidden");
  }

  await auth.db.delete(notes).where(eq(notes.id, input.id));
  return { success: true };
});

const listNotesByUser = os.note.listByUser.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const [user] = await ctx.db.select().from(users).where(eq(users.username, input.username));
  if (!user) {
    throw new Error("User not found");
  }

  const rows = await ctx.db
    .select()
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.userId, user.id))
    .orderBy(desc(notes.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    id: row.notes.id,
    content: row.notes.content,
    summary: row.notes.summary ?? null,
    createdAt: row.notes.createdAt,
    userId: row.notes.userId,
    author: { id: row.users.id, username: row.users.username, createdAt: row.users.createdAt },
  }));
});

// ========== Router ==========

const router = os.router({
  auth: {
    register,
    login,
    me: meHandler,
  },
  note: {
    create: createNote,
    list: listNotes,
    get: getNote,
    delete: deleteNote,
    listByUser: listNotesByUser,
  },
});

export type Router = typeof router;

const rpcHandler = new RPCHandler(router, {
  plugins: [new CORSPlugin()],
});

// ========== Worker Entry ==========

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.DB);
    const jwtSecret = getJwtSecret(env);

    const { matched, response } = await rpcHandler.handle(request, {
      prefix: "/rpc",
      context: { db, jwtSecret, headers: request.headers },
    });

    if (matched) {
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
