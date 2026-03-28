import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { contract } from "@aihackason/contract";
import { users, notes, likes } from "./db/schema";
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
  headers: Headers;
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

/** Try to extract userId from token, return null if not authenticated */
async function optionalAuth(context: Context): Promise<string | null> {
  const authHeader = context.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  return verifyToken(token, context.jwtSecret);
}

// ========== Note helpers ==========

async function enrichNotes(
  db: DrizzleD1Database,
  noteRows: { notes: typeof notes.$inferSelect; users: typeof users.$inferSelect }[],
  currentUserId: string | null,
) {
  if (noteRows.length === 0) return [];

  const noteIds = noteRows.map((r) => r.notes.id);

  // Get like counts for all notes
  const likeCounts = await db
    .select({
      noteId: likes.noteId,
      count: count(),
    })
    .from(likes)
    .where(
      sql`${likes.noteId} IN (${sql.join(
        noteIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .groupBy(likes.noteId);

  const likeCountMap = new Map(likeCounts.map((lc) => [lc.noteId, lc.count]));

  // Get reply counts for all notes
  const replyCounts = await db
    .select({
      replyTo: notes.replyTo,
      count: count(),
    })
    .from(notes)
    .where(
      sql`${notes.replyTo} IN (${sql.join(
        noteIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )
    .groupBy(notes.replyTo);

  const replyCountMap = new Map(replyCounts.map((rc) => [rc.replyTo!, rc.count]));

  // Get user's likes for current user
  let likedSet = new Set<string>();
  if (currentUserId) {
    const userLikes = await db
      .select({ noteId: likes.noteId })
      .from(likes)
      .where(
        and(
          eq(likes.userId, currentUserId),
          sql`${likes.noteId} IN (${sql.join(
            noteIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );
    likedSet = new Set(userLikes.map((l) => l.noteId));
  }

  return noteRows.map((row) => ({
    id: row.notes.id,
    content: row.notes.content,
    summary: row.notes.summary ?? null,
    createdAt: row.notes.createdAt,
    userId: row.notes.userId,
    replyTo: row.notes.replyTo ?? null,
    author: { id: row.users.id, username: row.users.username, createdAt: row.users.createdAt },
    likeCount: likeCountMap.get(row.notes.id) ?? 0,
    replyCount: replyCountMap.get(row.notes.id) ?? 0,
    liked: likedSet.has(row.notes.id),
  }));
}

async function enrichSingleNote(
  db: DrizzleD1Database,
  note: typeof notes.$inferSelect,
  author: typeof users.$inferSelect,
  currentUserId: string | null,
) {
  const result = await enrichNotes(db, [{ notes: note, users: author }], currentUserId);
  return result[0];
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
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  const [user] = await auth.db.select().from(users).where(eq(users.id, auth.userId));
  if (!user) {
    throw new Error("User not found");
  }

  return { id: user.id, username: user.username, createdAt: user.createdAt };
});

// --- Notes ---

const createNote = os.note.create.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  // Validate replyTo exists if provided
  if (input.replyTo) {
    const [parentNote] = await auth.db.select().from(notes).where(eq(notes.id, input.replyTo));
    if (!parentNote) {
      throw new Error("Reply target note not found");
    }
  }

  const id = crypto.randomUUID();
  const [note] = await auth.db
    .insert(notes)
    .values({
      id,
      userId: auth.userId,
      content: input.content,
      replyTo: input.replyTo ?? null,
    })
    .returning();

  const [author] = await auth.db.select().from(users).where(eq(users.id, auth.userId));

  return enrichSingleNote(auth.db, note, author, auth.userId);
});

const listNotes = os.note.list.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

  const rows = await ctx.db
    .select()
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .orderBy(desc(notes.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return enrichNotes(ctx.db, rows, currentUserId);
});

const getNote = os.note.get.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

  const rows = await ctx.db
    .select()
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.id, input.id));

  if (rows.length === 0) {
    throw new Error("Note not found");
  }

  const row = rows[0];
  return enrichSingleNote(ctx.db, row.notes, row.users, currentUserId);
});

const deleteNote = os.note.delete.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  const [note] = await auth.db.select().from(notes).where(eq(notes.id, input.id));
  if (!note) {
    throw new Error("Note not found");
  }
  if (note.userId !== auth.userId) {
    throw new Error("Forbidden");
  }

  // Delete associated likes first
  await auth.db.delete(likes).where(eq(likes.noteId, input.id));
  await auth.db.delete(notes).where(eq(notes.id, input.id));
  return { success: true };
});

const listNotesByUser = os.note.listByUser.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

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

  return enrichNotes(ctx.db, rows, currentUserId);
});

const noteReplies = os.note.replies.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

  // Verify the parent note exists
  const [parentNote] = await ctx.db.select().from(notes).where(eq(notes.id, input.noteId));
  if (!parentNote) {
    throw new Error("Note not found");
  }

  const rows = await ctx.db
    .select()
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.replyTo, input.noteId))
    .orderBy(notes.createdAt)
    .limit(input.limit)
    .offset(input.offset);

  return enrichNotes(ctx.db, rows, currentUserId);
});

// --- Likes ---

const likeToggle = os.like.toggle.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  // Verify note exists
  const [note] = await auth.db.select().from(notes).where(eq(notes.id, input.noteId));
  if (!note) {
    throw new Error("Note not found");
  }

  // Check if already liked
  const [existingLike] = await auth.db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, auth.userId), eq(likes.noteId, input.noteId)));

  if (existingLike) {
    // Unlike
    await auth.db.delete(likes).where(eq(likes.id, existingLike.id));
  } else {
    // Like
    await auth.db.insert(likes).values({
      id: crypto.randomUUID(),
      userId: auth.userId,
      noteId: input.noteId,
    });
  }

  // Get updated like count
  const [result] = await auth.db
    .select({ count: count() })
    .from(likes)
    .where(eq(likes.noteId, input.noteId));

  return {
    liked: !existingLike,
    likeCount: result.count,
  };
});

const likeStatus = os.like.status.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  const [existingLike] = await auth.db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, auth.userId), eq(likes.noteId, input.noteId)));

  const [result] = await auth.db
    .select({ count: count() })
    .from(likes)
    .where(eq(likes.noteId, input.noteId));

  return {
    liked: !!existingLike,
    likeCount: result.count,
  };
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
    replies: noteReplies,
  },
  like: {
    toggle: likeToggle,
    status: likeStatus,
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
