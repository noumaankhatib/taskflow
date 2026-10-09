import { created, route } from "@/utils/api";
import { invalid } from "@/utils/errors";

export const GET = route(({ svc, sp }) =>
  svc.attachments.list({ projectId: sp.get("projectId") ?? undefined, entityType: sp.get("entityType") ?? undefined, entityId: sp.get("entityId") ?? undefined }));

export const POST = route(async ({ svc, actor, req }) => {
  const form = await req.formData().catch(() => { throw invalid("Upload must be multipart form data."); });
  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  const entityType = String(form.get("entityType") ?? "PROJECT");
  if (!(file instanceof File)) throw invalid("Choose a file to upload.");
  if (!["PROJECT", "TASK", "EXPENSE"].includes(entityType)) throw invalid("Invalid entity type.");
  const entityId = form.get("entityId") ? String(form.get("entityId")) : undefined;
  return created(await svc.attachments.upload(actor, { projectId, entityType: entityType as "PROJECT", entityId }, file));
});
