import type { Table } from "dexie";
import type { z } from "zod";
import type { BaseEntity } from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";

type Fields<T> = Omit<T, keyof BaseEntity>;

export interface EntityRepository<T extends BaseEntity, I> {
  create(input: Fields<I>): Promise<T>;
  get(id: string): Promise<T | undefined>;
  listActive(): Promise<T[]>;
  update(id: string, patch: Partial<Fields<T>>): Promise<T>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

export interface EntityRepositoryDeps<T extends BaseEntity, I> {
  table: Table<NoInfer<T>, string, unknown>;
  schema: z.ZodType<T, I>;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * CRUD with validation, automatic timestamps and soft delete (deletedAt).
 * Every write is validated by the domain schema before it touches IndexedDB.
 */
export function createEntityRepository<T extends BaseEntity, I>({
  table,
  schema,
  clock,
  ids,
}: EntityRepositoryDeps<T, I>): EntityRepository<T, I> {
  async function mustGet(id: string): Promise<T> {
    const found = await table.get(id);
    if (!found) throw new Error(`${table.name} ${id} not found`);
    return found;
  }

  async function write(next: unknown): Promise<T> {
    const valid = schema.parse(next);
    await table.put(valid);
    return valid;
  }

  return {
    async create(input) {
      const now = clock.now();
      return write({ ...input, id: ids.next(), createdAt: now, updatedAt: now, deletedAt: null });
    },

    get: (id) => table.get(id),

    // deletedAt null is not indexable in IndexedDB, so active rows are filtered.
    listActive: () => table.filter((e) => e.deletedAt === null).toArray(),

    async update(id, patch) {
      const current = await mustGet(id);
      return write({ ...current, ...patch, updatedAt: clock.now() });
    },

    async softDelete(id) {
      const current = await mustGet(id);
      const now = clock.now();
      await write({ ...current, deletedAt: now, updatedAt: now });
    },

    async restore(id) {
      const current = await mustGet(id);
      await write({ ...current, deletedAt: null, updatedAt: clock.now() });
    },
  };
}
