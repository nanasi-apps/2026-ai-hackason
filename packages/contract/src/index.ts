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
  content: z.string(),
  summary: z.string().nullable(),
  createdAt: z.string(),
  userId: z.string(),
});

export type Note = z.infer<typeof NoteSchema>;

export const NoteWithAuthorSchema = NoteSchema.extend({
  author: UserSchema,
});

export type NoteWithAuthor = z.infer<typeof NoteWithAuthorSchema>;

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
      content: z.string().min(1).max(10000),
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

// ========== Contract ==========

export const contract = {
  auth: {
    register,
    login,
    me,
  },
  note: {
    create: createNote,
    list: listNotes,
    get: getNote,
    delete: deleteNote,
    listByUser: listNotesByUser,
  },
};
