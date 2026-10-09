import { NextResponse } from "next/server";
import { route } from "@/utils/api";
export const GET = route(async ({ svc, actor }) => {
  const bundle = await svc.backups.export(actor);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="taskflow-export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
});
