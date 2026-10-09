import { created, paged, route } from "@/utils/api";
import { paginate, parsePageQuery } from "@/utils/query";
import { paymentFilterFromParams } from "@/modules/payments/payment.service";

export const GET = route(async ({ svc, actor, sp }) => {
  const rows = await svc.payments.list(actor, paymentFilterFromParams(sp));
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 50 }), ["paymentDate", "dueDate", "amount", "invoiceNumber", "createdAt"]));
});
export const POST = route(async ({ svc, actor, body }) => created(await svc.payments.create(actor, await body())));
