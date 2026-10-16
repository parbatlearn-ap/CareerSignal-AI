/**
 * Local-first ownership boundary. Without configured authentication, each
 * browser gets a random, httpOnly owner cookie, and every workspace is bound
 * to it. This is NOT multi-user authentication; see docs/KNOWN_LIMITATIONS.md.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Workspace } from "../schemas/workspace";
import { getRepository } from "../repo";

const COOKIE = "cs_owner";

export async function getOwnerId(create = true): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
  if (!create) return null;
  const id = randomBytes(16).toString("hex");
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

/** Load a workspace only if it belongs to the caller. Returns null otherwise (rendered as 404). */
export async function loadOwned(id: string): Promise<Workspace | null> {
  const owner = await getOwnerId(false);
  if (!owner) return null;
  const ws = await getRepository().get(id);
  return ws && ws.ownerId === owner ? ws : null;
}

const locks = new Map<string, Promise<unknown>>();
/** Serialise mutations per workspace within this server process. */
export async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(id, next);
  try {
    return await next;
  } finally {
    if (locks.get(id) === next) locks.delete(id);
  }
}
