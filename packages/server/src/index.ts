import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, desc, and, isNull, sql, count } from "drizzle-orm";
import { contract } from "@aihackason/contract";
import { users, notes, likes, recommendations, dailyRecommendState } from "./db/schema";
import { hashSync, compareSync } from "bcrypt-ts";
import { SignJWT, jwtVerify } from "jose";
import { summarizeIntoThreeWords, type AiBinding } from "./threeWordSummary";

// ========== Types ==========

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI: AiBinding;
  JWT_SECRET?: string;
}

interface Context {
  db: DrizzleD1Database;
  ai: AiBinding;
  jwtSecret: Uint8Array;
  headers: Headers;
}

interface AuthContext extends Context {
  userId: string;
}

type NoteWithUserRow = {
  note: typeof notes.$inferSelect;
  author: typeof users.$inferSelect;
};

const RECOMMEND_LIMIT = 3;
const ADMIN_USERNAMES = new Set(["mattyatea", "kasukasukun"]);

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
  noteRows: NoteWithUserRow[],
  currentUserId: string | null,
) {
  if (noteRows.length === 0) return [];

  const noteIds = noteRows.map((row) => row.note.id);

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

  const recommendationCounts = await db
    .select({
      noteId: recommendations.noteId,
      count: count(),
    })
    .from(recommendations)
    .where(
      and(
        sql`${recommendations.noteId} IN (${sql.join(
          noteIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        sql`date(${recommendations.createdAt}) = date('now')`,
      ),
    )
    .groupBy(recommendations.noteId);

  const recommendationCountMap = new Map(
    recommendationCounts.map((item) => [item.noteId, item.count]),
  );

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

  return noteRows.map((row) => {
    return {
      id: row.note.id,
      summary: row.note.summary ?? null,
      createdAt: row.note.createdAt,
      userId: row.note.userId,
      replyTo: row.note.replyTo ?? null,
      author: { id: row.author.id, username: row.author.username, createdAt: row.author.createdAt },
      likeCount: likeCountMap.get(row.note.id) ?? 0,
      replyCount: replyCountMap.get(row.note.id) ?? 0,
      liked: likedSet.has(row.note.id),
      recommendCount: recommendationCountMap.get(row.note.id) ?? 0,
      recommended: row.note.isUnlocked,
    };
  });
}

async function enrichSingleNote(
  db: DrizzleD1Database,
  note: typeof notes.$inferSelect,
  author: typeof users.$inferSelect,
  currentUserId: string | null,
) {
  const result = await enrichNotes(db, [{ note, author }], currentUserId);
  return result[0];
}

async function getRemainingRecommendations(db: DrizzleD1Database, userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.userId, userId),
        sql`date(${recommendations.createdAt}) = date('now')`,
      ),
    );

  return Math.max(RECOMMEND_LIMIT - result.count, 0);
}

async function refreshNoteUnlockState(db: DrizzleD1Database, noteId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [result] = await db
    .select({ count: count() })
    .from(recommendations)
    .where(
      and(eq(recommendations.noteId, noteId), sql`date(${recommendations.createdAt}) = ${today}`),
    );

  const publishedEntries = await db
    .select({ id: dailyRecommendState.id })
    .from(dailyRecommendState)
    .where(eq(dailyRecommendState.noteId, noteId));

  const recommendCount = result.count;
  const unlocked = publishedEntries.length > 0;

  await db.update(notes).set({ recommendCount, isUnlocked: unlocked }).where(eq(notes.id, noteId));

  return { recommendCount, unlocked };
}

function getTodayDay() {
  return new Date().toISOString().slice(0, 10);
}

function getPreviousDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function requireAdmin(context: AuthContext) {
  const [user] = await context.db.select().from(users).where(eq(users.id, context.userId));
  if (!user || !ADMIN_USERNAMES.has(user.username)) {
    throw new Error("Forbidden");
  }

  return user;
}

async function getDailyWinnerNote(
  db: DrizzleD1Database,
  currentUserId: string | null,
  day: string,
) {
  const winners = await db
    .select({
      noteId: recommendations.noteId,
      count: count(),
      latestAt: sql<string>`max(${recommendations.createdAt})`,
    })
    .from(recommendations)
    .where(sql`date(${recommendations.createdAt}) = ${day}`)
    .groupBy(recommendations.noteId)
    .orderBy(desc(count()), desc(sql`max(${recommendations.createdAt})`))
    .limit(1);

  const winner = winners[0];
  if (!winner) {
    return null;
  }

  const rows = await db
    .select({ note: notes, author: users })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.id, winner.noteId));

  if (rows.length === 0) {
    return null;
  }

  const enriched = await enrichSingleNote(db, rows[0].note, rows[0].author, currentUserId);

  return {
    ...enriched,
    recommended: true,
  };
}

async function publishDailyRecommendForDay(
  db: DrizzleD1Database,
  publishedDay: string,
  sourceDay: string,
  manual: boolean,
  currentUserId: string | null,
) {
  try {
    const [existing] = await db
      .select()
      .from(dailyRecommendState)
      .where(eq(dailyRecommendState.publishedDay, publishedDay));

    if (existing) {
      const note = existing.noteId
        ? await getDailyWinnerNote(db, currentUserId, existing.sourceDay)
        : null;
      return {
        publishedDay: existing.publishedDay,
        sourceDay: existing.sourceDay,
        note,
        manual: existing.manual,
      };
    }

    const winner = await getDailyWinnerNote(db, currentUserId, sourceDay);

    await db.insert(dailyRecommendState).values({
      id: crypto.randomUUID(),
      publishedDay,
      sourceDay,
      noteId: winner?.id ?? null,
      manual,
    });

    if (winner) {
      await db.update(notes).set({ isUnlocked: true }).where(eq(notes.id, winner.id));
      await refreshNoteUnlockState(db, winner.id);
    }

    return {
      publishedDay,
      sourceDay,
      note: winner,
      manual,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("no such table: daily_recommend_state")) {
      const winner = await getDailyWinnerNote(db, currentUserId, sourceDay);

      if (winner) {
        await db.update(notes).set({ isUnlocked: true }).where(eq(notes.id, winner.id));
        await refreshNoteUnlockState(db, winner.id);
      }

      return {
        publishedDay,
        sourceDay,
        note: winner,
        manual,
      };
    }

    throw error;
  }
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

const summarizeThreeWords = os.ai.summarizeThreeWords.handler(async ({ input, context }) => {
  const ctx = context as Context;
  return summarizeIntoThreeWords(ctx.ai, input.content);
});

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
  const generatedSummary = await summarizeIntoThreeWords(auth.ai, input.content);
  const insertedNotes = await auth.db
    .insert(notes)
    .values({
      id,
      userId: auth.userId,
      content: input.content,
      summary: generatedSummary.summary,
      replyTo: input.replyTo ?? null,
      recommendCount: 0,
      isUnlocked: false,
    })
    .returning();

  if (!Array.isArray(insertedNotes) || insertedNotes.length === 0) {
    throw new Error("Failed to create note");
  }

  const [note] = insertedNotes;

  const [author] = await auth.db.select().from(users).where(eq(users.id, auth.userId));

  return enrichSingleNote(auth.db, note, author, auth.userId);
});

const listNotes = os.note.list.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

  const rows = await ctx.db
    .select({ note: notes, author: users })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(isNull(notes.replyTo))
    .orderBy(desc(notes.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return enrichNotes(ctx.db, rows, currentUserId);
});

const getNote = os.note.get.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

  const rows = await ctx.db
    .select({ note: notes, author: users })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.id, input.id));

  if (rows.length === 0) {
    throw new Error("Note not found");
  }

  const row = rows[0];
  return enrichSingleNote(ctx.db, row.note, row.author, currentUserId);
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
  await auth.db.delete(recommendations).where(eq(recommendations.noteId, input.id));
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
    .select({ note: notes, author: users })
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
    .select({ note: notes, author: users })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.replyTo, input.noteId))
    .orderBy(notes.createdAt)
    .limit(input.limit)
    .offset(input.offset);

  return enrichNotes(ctx.db, rows, currentUserId);
});

const topRecommended = os.note.topRecommended.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);

  const today = new Date().toISOString().slice(0, 10);
  const topIds = await ctx.db
    .select({
      noteId: recommendations.noteId,
      count: count(),
    })
    .from(recommendations)
    .where(sql`date(${recommendations.createdAt}) = ${today}`)
    .groupBy(recommendations.noteId)
    .orderBy(desc(count()), desc(sql`max(${recommendations.createdAt})`))
    .limit(input.limit);

  if (topIds.length === 0) {
    return [];
  }

  const ids = topIds.map((item) => item.noteId);
  const rows = await ctx.db
    .select({ note: notes, author: users })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(
      sql`${notes.id} IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );

  const enriched = await enrichNotes(ctx.db, rows, currentUserId);
  const orderMap = new Map(ids.map((id, index) => [id, index]));

  return enriched.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
});

const dailyWinner = os.note.dailyWinner.handler(async ({ context }) => {
  const ctx = context as Context;
  const currentUserId = await optionalAuth(ctx);
  const publishedDay = getTodayDay();
  const sourceDay = getPreviousDay(publishedDay);
  const published = await publishDailyRecommendForDay(
    ctx.db,
    publishedDay,
    sourceDay,
    false,
    currentUserId,
  );

  return {
    publishedDay: published.publishedDay,
    sourceDay: published.sourceDay,
    note: published.note,
    manual: published.manual,
  };
});

const publishDailyRecommend = os.note.publishDailyRecommend.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);
  await requireAdmin(auth);

  const publishedDay = getTodayDay();
  const sourceDay = input.sourceDay ?? publishedDay;
  const published = await publishDailyRecommendForDay(
    auth.db,
    publishedDay,
    sourceDay,
    true,
    auth.userId,
  );

  return published;
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

// --- Recommendations ---

const recommendCreate = os.recommend.create.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  const [note] = await auth.db.select().from(notes).where(eq(notes.id, input.noteId));
  if (!note) {
    throw new Error("Note not found");
  }

  const remainingBefore = await getRemainingRecommendations(auth.db, auth.userId);
  if (remainingBefore <= 0) {
    throw new Error("Recommendation limit reached");
  }

  const inserted = await auth.db
    .insert(recommendations)
    .values({
      id: crypto.randomUUID(),
      userId: auth.userId,
      noteId: input.noteId,
    })
    .returning();

  const [recommendation] = inserted;
  const { recommendCount } = await refreshNoteUnlockState(auth.db, input.noteId);
  const remainingCount = await getRemainingRecommendations(auth.db, auth.userId);
  const day = new Date().toISOString().slice(0, 10);

  return {
    recommendation: {
      id: recommendation.id,
      userId: recommendation.userId,
      noteId: recommendation.noteId,
      createdAt: recommendation.createdAt,
    },
    recommendCount,
    remainingCount,
    day,
  };
});

const recommendDelete = os.recommend.delete.handler(async ({ input, context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  const [recommendation] = await auth.db
    .select()
    .from(recommendations)
    .where(eq(recommendations.id, input.recommendationId));

  if (!recommendation) {
    throw new Error("Recommendation not found");
  }

  if (recommendation.userId !== auth.userId) {
    throw new Error("Forbidden");
  }

  await auth.db.delete(recommendations).where(eq(recommendations.id, input.recommendationId));

  const { recommendCount } = await refreshNoteUnlockState(auth.db, recommendation.noteId);
  const remainingCount = await getRemainingRecommendations(auth.db, auth.userId);
  const day = new Date().toISOString().slice(0, 10);

  return {
    success: true,
    recommendCount,
    remainingCount,
    day,
  };
});

const recommendListMine = os.recommend.listMine.handler(async ({ context }) => {
  const ctx = context as Context;
  const auth = await requireAuth(ctx, ctx.headers);

  const items = await auth.db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.userId, auth.userId),
        sql`date(${recommendations.createdAt}) = date('now')`,
      ),
    )
    .orderBy(desc(recommendations.createdAt));

  const remainingCount = await getRemainingRecommendations(auth.db, auth.userId);
  const day = new Date().toISOString().slice(0, 10);

  return {
    recommendations: items.map((item) => ({
      id: item.id,
      userId: item.userId,
      noteId: item.noteId,
      createdAt: item.createdAt,
    })),
    remainingCount,
    day,
  };
});

// ========== Router ==========

const router = os.router({
  auth: {
    register,
    login,
    me: meHandler,
  },
  ai: {
    summarizeThreeWords,
  },
  note: {
    create: createNote,
    list: listNotes,
    get: getNote,
    delete: deleteNote,
    listByUser: listNotesByUser,
    replies: noteReplies,
    topRecommended,
    dailyWinner,
    publishDailyRecommend,
  },
  like: {
    toggle: likeToggle,
    status: likeStatus,
  },
  recommend: {
    create: recommendCreate,
    delete: recommendDelete,
    listMine: recommendListMine,
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
      context: { db, ai: env.AI, jwtSecret, headers: request.headers },
    });

    if (matched) {
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
