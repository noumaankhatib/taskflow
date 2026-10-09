import type { BaseEntity } from "@/schemas/common";

export type NewEntity<T extends BaseEntity> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Storage-agnostic repository contract. Services depend on this only; a PostgresXRepository
 * can implement it later without touching business logic.
 */
export interface Repository<T extends BaseEntity> {
  findAll(): Promise<T[]>;
  /** Equality filter on top-level fields. */
  find(where: Partial<T>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  /** Assigns the next id (e.g. TASK-014) and timestamps atomically. */
  create(data: NewEntity<T>): Promise<T>;
  createMany(data: NewEntity<T>[]): Promise<T[]>;
  /** Merge-patch. Throws NOT_FOUND. */
  update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>): Promise<T>;
  /** Hard delete (soft delete is a service-level concern via isDeleted). */
  delete(id: string): Promise<boolean>;
  deleteWhere(where: Partial<T>): Promise<number>;
}
