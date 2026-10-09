import { NextResponse } from "next/server";
import { noContent, route } from "@/utils/api";
type P = { id: string };

export const GET = route<P>(async ({ svc, params }) => {
  const { attachment, buffer } = await svc.attachments.open(params.id);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "X-Content-Type-Options": "nosniff", // uploaded HTML must never render inline
      "Content-Security-Policy": "sandbox",
    },
  });
});
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.attachments.remove(actor, params.id), noContent()));
