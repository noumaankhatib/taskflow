import fs from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "../interfaces/infra";
import { paths } from "@/utils/config";

/** Uploads on the local disk (`data/uploads`). */
export function createDiskFileStorage(): FileStorage {
  return {
    async put(name, data) {
      await fs.mkdir(paths.uploads, { recursive: true });
      await fs.writeFile(path.join(paths.uploads, name), data);
      return name;
    },
    async get(key) {
      return fs.readFile(path.join(paths.uploads, path.basename(key))).catch(() => null);
    },
    async remove(key) {
      await fs.rm(path.join(paths.uploads, path.basename(key)), { force: true });
    },
  };
}
