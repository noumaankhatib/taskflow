import { created, paged, route } from "@/utils/api";
import { paginate, parsePageQuery } from "@/utils/query";
import { expenseFilterFromParams } from "@/modules/expenses/expense.service";

export const GET = route(async ({ svc, actor, sp }) => {
  const rows = await svc.expenses.list(actor, expenseFilterFromParams(sp));
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 50 }), ["date", "amount", "category", "createdAt"]), { summary: svc.expenses.summarize(rows) });
});
export const POST = route(async ({ svc, actor, body }) => created(await svc.expenses.create(actor, await body())));
