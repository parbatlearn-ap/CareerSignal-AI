/**
 * Data repository abstraction. Agents and the orchestrator never touch
 * storage directly, so the file store can be swapped for SQLite/PostgreSQL
 * by implementing this interface.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Workspace } from "../schemas/workspace";

export interface WorkspaceRepository {
  create(ws: Workspace): Promise<void>;
  get(id: string): Promise<Workspace | null>;
  save(ws: Workspace): Promise<void>;
  listByOwner(ownerId: string): Promise<Pick<Workspace, "id" | "title" | "isDemo" | "createdAt" | "updatedAt">[]>;
  delete(id: string): Promise<boolean>;
  deleteByOwner(ownerId: string): Promise<number>;
}

const SAFE_ID = /^[a-zA-Z0-9_-]{6,64}$/;

export class MemoryRepository implements WorkspaceRepository {
  private items = new Map<string, Workspace>();
  async create(ws: Workspace) {
    this.items.set(ws.id, structuredClone(ws));
  }
  async get(id: string) {
    const w = this.items.get(id);
    return w ? structuredClone(w) : null;
  }
  async save(ws: Workspace) {
    this.items.set(ws.id, structuredClone(ws));
  }
  async listByOwner(ownerId: string) {
    return [...this.items.values()]
      .filter((w) => w.ownerId === ownerId)
      .map(({ id, title, isDemo, createdAt, updatedAt }) => ({ id, title, isDemo, createdAt, updatedAt }));
  }
  async delete(id: string) {
    return this.items.delete(id);
  }
  async deleteByOwner(ownerId: string) {
    let n = 0;
    for (const [id, w] of this.items) if (w.ownerId === ownerId && this.items.delete(id)) n++;
    return n;
  }
}

/**
 * Local-first JSON file store (one file per workspace) in DATA_DIR, which is
 * gitignored and never served publicly. Writes are atomic (temp + rename).
 */
export class FileRepository implements WorkspaceRepository {
  constructor(private dir: string) {}

  private file(id: string) {
    if (!SAFE_ID.test(id)) throw new Error("Invalid workspace id");
    return path.join(this.dir, `${id}.json`);
  }
  private async ensure() {
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
  }
  async create(ws: Workspace) {
    await this.save(ws);
  }
  async get(id: string) {
    if (!SAFE_ID.test(id)) return null;
    try {
      return JSON.parse(await fs.readFile(this.file(id), "utf8")) as Workspace;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async save(ws: Workspace) {
    await this.ensure();
    const f = this.file(ws.id);
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(ws), { encoding: "utf8", mode: 0o600 });
    await renameWithRetry(tmp, f);
  }
  async listByOwner(ownerId: string) {
    await this.ensure();
    const files = (await fs.readdir(this.dir)).filter((f) => f.endsWith(".json"));
    const out = [];
    for (const f of files) {
      const w = await this.get(f.replace(/\.json$/, ""));
      if (w && w.ownerId === ownerId) out.push({ id: w.id, title: w.title, isDemo: w.isDemo, createdAt: w.createdAt, updatedAt: w.updatedAt });
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async delete(id: string) {
    try {
      await fs.unlink(this.file(id));
      return true;
    } catch {
      return false;
    }
  }
  async deleteByOwner(ownerId: string) {
    const list = await this.listByOwner(ownerId);
    let n = 0;
    for (const w of list) if (await this.delete(w.id)) n++;
    return n;
  }
}

/**
 * On Windows, sync clients (OneDrive) and antivirus briefly lock files, so
 * rename fails with EPERM/EBUSY/EACCES. Retry a few times before giving up.
 */
export async function renameWithRetry(from: string, to: string, attempts = 6): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i >= attempts || !["EPERM", "EBUSY", "EACCES"].includes(code ?? "")) {
        await fs.unlink(from).catch(() => undefined);
        throw e;
      }
      await new Promise((r) => setTimeout(r, 50 * i));
    }
  }
}

let singleton: WorkspaceRepository | null = null;
export function getRepository(): WorkspaceRepository {
  if (!singleton) singleton = new FileRepository(path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR || ".data"));
  return singleton;
}
export function setRepository(r: WorkspaceRepository) {
  singleton = r;
}
