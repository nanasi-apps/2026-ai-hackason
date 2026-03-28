import { oc } from "@orpc/contract";
import { z } from "zod";

// ========== Schemas ==========

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  content: z.string().nullable(),
  summary: z.string().nullable(),
  createdAt: z.string(),
  userId: z.string(),
  replyTo: z.string().nullable(),
});

export type Note = z.infer<typeof NoteSchema>;

export const NoteWithAuthorSchema = NoteSchema.extend({
  author: UserSchema,
  likeCount: z.number(),
  replyCount: z.number(),
  liked: z.boolean(),
  recommendCount: z.number(),
  recommended: z.boolean(),
});

export type NoteWithAuthor = z.infer<typeof NoteWithAuthorSchema>;

export const ThreeWordSummarySchema = z.object({
  words: z.tuple([z.string(), z.string(), z.string()]),
  summary: z.string(),
  model: z.string(),
});

export type ThreeWordSummary = z.infer<typeof ThreeWordSummarySchema>;

export const RecommendationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  noteId: z.string(),
  createdAt: z.string(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

export const DailyWinnerSchema = z.object({
  publishedDay: z.string(),
  sourceDay: z.string(),
  notes: z.array(NoteWithAuthorSchema),
  manual: z.boolean(),
});

export type DailyWinner = z.infer<typeof DailyWinnerSchema>;

// ========== Auth Contract ==========

const register = oc
  .input(
    z.object({
      username: z
        .string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric or underscore"),
      password: z.string().min(6).max(100),
    }),
  )
  .output(AuthResponseSchema);

const login = oc
  .input(
    z.object({
      username: z.string(),
      password: z.string(),
    }),
  )
  .output(AuthResponseSchema);

const me = oc.output(UserSchema);

// ========== Note Contract ==========

const createNote = oc
  .input(
    z.object({
      content: z.string().min(1).max(5000),
      replyTo: z.string().optional(),
    }),
  )
  .output(NoteWithAuthorSchema);

const listNotes = oc
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    }),
  )
  .output(z.array(NoteWithAuthorSchema));

const getNote = oc.input(z.object({ id: z.string() })).output(NoteWithAuthorSchema);

const deleteNote = oc
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }));

const listNotesByUser = oc
  .input(
    z.object({
      username: z.string(),
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    }),
  )
  .output(z.array(NoteWithAuthorSchema));

const noteReplies = oc
  .input(
    z.object({
      noteId: z.string(),
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    }),
  )
  .output(z.array(NoteWithAuthorSchema));

const topRecommendedNotes = oc
  .input(
    z.object({
      limit: z.number().int().min(1).max(20).optional().default(3),
    }),
  )
  .output(z.array(NoteWithAuthorSchema));

const dailyWinnerNote = oc.output(DailyWinnerSchema);

const publishDailyRecommend = oc
  .input(
    z.object({
      sourceDay: z.string().optional(),
    }),
  )
  .output(DailyWinnerSchema);

// ========== AI Contract ==========

const summarizeThreeWords = oc
  .input(
    z.object({
      content: z.string().min(1).max(10000),
    }),
  )
  .output(ThreeWordSummarySchema);

// ========== Like Contract ==========

const LikeResponseSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number(),
});

const likeToggle = oc.input(z.object({ noteId: z.string() })).output(LikeResponseSchema);

const likeStatus = oc.input(z.object({ noteId: z.string() })).output(LikeResponseSchema);

// ========== Recommendation Contract ==========

const RecommendCreateResponseSchema = z.object({
  recommendation: RecommendationSchema,
  recommendCount: z.number(),
  remainingCount: z.number(),
  day: z.string(),
});

const RecommendDeleteResponseSchema = z.object({
  success: z.boolean(),
  recommendCount: z.number(),
  remainingCount: z.number(),
  day: z.string(),
});

const RecommendListMineResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema),
  remainingCount: z.number(),
  day: z.string(),
});

const recommendCreate = oc
  .input(z.object({ noteId: z.string() }))
  .output(RecommendCreateResponseSchema);

const recommendDelete = oc
  .input(z.object({ recommendationId: z.string() }))
  .output(RecommendDeleteResponseSchema);

const recommendListMine = oc.output(RecommendListMineResponseSchema);

// ========== Contract ==========

export const contract = {
  auth: {
    register,
    login,
    me,
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
    topRecommended: topRecommendedNotes,
    dailyWinner: dailyWinnerNote,
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
};
