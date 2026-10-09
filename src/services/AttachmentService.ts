import path from "node:path";
import crypto from "node:crypto";
import type { Deps } from "./shared";
import { alive } from "./shared";
import type { FileStorage } from "@/repositories/interfaces";
import { MAX_UPLOAD_BYTES } from "@/utils/config";
import { forbidden, invalid, notFound } from "@/utils/errors";
import { can, requirePerm, type Actor } from "@/utils/rbac";

const ALLOWED_EXT = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".md", ".json",
]);

export class AttachmentService {
  constructor(
    private d: Deps,
    private files: FileStorage,
  ) {}

  async list(f: { projectId?: string; entityType?: string; entityId?: string }) {
    return alive(await this.d.repos.attachments.findAll())
      .filter((a) => (!f.projectId || a.projectId === f.projectId) && (!f.entityType || a.entityType === f.entityType) && (!f.entityId || a.entityId === f.entityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** `entityId` may be omitted for expense receipts uploaded before the expense exists. */
  async upload(actor: Actor, meta: { projectId: string; entityType: "PROJECT" | "TASK" | "EXPENSE"; entityId?: string }, file: File) {
    if (!can(actor.role, "task:write") && !can(actor.role, "expense:write") && !can(actor.role, "project:write")) throw forbidden();
    const project = await this.d.repos.projects.findById(meta.projectId);
    if (!project || project.isDeleted) throw notFound("Project");
    if (meta.entityType === "TASK") {
      const t = meta.entityId ? await this.d.repos.tasks.findById(meta.entityId) : null;
      if (!t || t.isDeleted || t.projectId !== meta.projectId) throw invalid("Task not found in this project.");
    }
    if (file.size === 0) throw invalid("The file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) throw invalid(`File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`);
    const fileName = path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 200) || "file";
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw invalid(`File type ${ext || "(none)"} is not allowed.`);
    const storedName = await this.files.put(`${crypto.randomUUID()}${ext}`, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
    try {
      const a = await this.d.repos.attachments.create({
        entityType: meta.entityType, entityId: meta.entityId ?? "UNLINKED", projectId: meta.projectId,
        fileName, mimeType: file.type || "application/octet-stream", size: file.size, storedName,
        uploadedBy: actor.id, isDeleted: false, deletedAt: null, deletedBy: null,
      });
      await this.d.activity.log({
        entityType: "ATTACHMENT", entityId: a.id, projectId: a.projectId, action: "FILE_UPLOADED", userId: actor.id,
        message: `${actor.name} uploaded ${fileName}`,
      });
      return a;
    } catch (err) {
      await this.files.remove(storedName);
      throw err;
    }
  }

  async open(id: string) {
    const a = await this.d.repos.attachments.findById(id);
    if (!a || a.isDeleted) throw notFound("File");
    const buf = await this.files.get(a.storedName);
    if (!buf) throw notFound("File");
    return { attachment: a, buffer: buf };
  }

  async remove(actor: Actor, id: string) {
    const a = await this.d.repos.attachments.findById(id);
    if (!a || a.isDeleted) throw notFound("File");
    if (a.uploadedBy !== actor.id) requirePerm(actor, "task:manage");
    await this.d.repos.attachments.update(id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: actor.id });
    await this.d.activity.log({
      entityType: "ATTACHMENT", entityId: id, projectId: a.projectId, action: "DELETED", userId: actor.id,
      message: `${actor.name} removed ${a.fileName}`,
    });
  }
}
