import type { Deps } from "./shared";
import { alive } from "./shared";
import { can, type Actor } from "@/utils/rbac";
import { matchesText } from "@/utils/query";
import { formatMoney } from "@/utils/format";

export interface SearchHit { type: "project" | "task" | "client" | "user" | "expense"; id: string; title: string; subtitle: string; href: string }

export class SearchService {
  constructor(private d: Deps) {}

  async search(actor: Actor, q: string, perType = 5): Promise<SearchHit[]> {
    q = q.trim();
    if (q.length < 2) return [];
    const r = this.d.repos;
    const [projects, tasks, clients, users, expenses] = await Promise.all([
      r.projects.findAll(), r.tasks.findAll(), r.clients.findAll(), r.users.findAll(), r.expenses.findAll(),
    ]);
    const liveProjects = alive(projects);
    const pName = new Map(liveProjects.map((p) => [p.id, p.name]));
    const hits: SearchHit[] = [];
    hits.push(...liveProjects.filter((p) => matchesText(q, p.name, p.description, p.id)).slice(0, perType).map((p) => ({
      type: "project" as const, id: p.id, title: p.name, subtitle: `${p.id} · ${p.status}`, href: `/projects/${p.id}`,
    })));
    hits.push(...alive(tasks).filter((t) => pName.has(t.projectId) && matchesText(q, t.title, t.description, t.id, ...t.tags)).slice(0, perType).map((t) => ({
      type: "task" as const, id: t.id, title: t.title, subtitle: `${t.id} · ${pName.get(t.projectId)}`, href: `/tasks?task=${t.id}`,
    })));
    hits.push(...clients.filter((c) => matchesText(q, c.companyName, c.contactPerson, c.email)).slice(0, perType).map((c) => ({
      type: "client" as const, id: c.id, title: c.companyName, subtitle: c.contactPerson || c.email, href: `/clients?client=${c.id}`,
    })));
    hits.push(...alive(users).filter((u) => matchesText(q, u.name, u.email)).slice(0, perType).map((u) => ({
      type: "user" as const, id: u.id, title: u.name, subtitle: u.email, href: `/team?user=${u.id}`,
    })));
    const seeAll = can(actor.role, "finance:view");
    hits.push(...alive(expenses)
      .filter((e) => pName.has(e.projectId) && (seeAll || e.createdBy === actor.id || e.paidBy === actor.id) && matchesText(q, e.description, e.notes, e.id))
      .slice(0, perType).map((e) => ({
        type: "expense" as const, id: e.id, title: e.description, subtitle: `${e.id} · ${formatMoney(e.amount, e.currency)}`, href: `/expenses?expense=${e.id}`,
      })));
    return hits;
  }
}
