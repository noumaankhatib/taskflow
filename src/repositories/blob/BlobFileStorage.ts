import type { FileStorage } from "../interfaces/infra";

/** Vercel Blob (private by default, so receipts/files are only reachable through our authenticated download route). */
export function createBlobFileStorage(access: "private" | "public" = (process.env.BLOB_ACCESS as "private" | "public") ?? "private"): FileStorage {
  return {
    async put(name, data, contentType) {
      const { put } = await import("@vercel/blob");
      const r = await put(`uploads/${name}`, data, { access, contentType, addRandomSuffix: true });
      return r.pathname;
    },
    async get(key) {
      const { get } = await import("@vercel/blob");
      const r = await get(key, { access });
      if (!r || r.statusCode !== 200) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    },
    async remove(key) {
      const { del } = await import("@vercel/blob");
      await del(key).catch(() => undefined);
    },
  };
}
