import type { Deps } from "@/services/shared";
import { alive } from "@/services/shared";
import { ClientInput, ClientUpdateInput } from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { requirePerm, type Actor } from "@/utils/rbac";
import { conflict, notFound } from "@/utils/errors";
import { matchesText } from "@/utils/query";

export class ClientService {
  constructor(private d: Deps) {}

  async list(f: { q?: string; active?: boolean } = {}) {
    const [clients, projects] = await Promise.all([this.d.repos.clients.findAll(), this.d.repos.projects.findAll()]);
    const live = alive(projects);
    return clients
      .filter((c) => matchesText(f.q, c.companyName, c.contactPerson, c.email) && (f.active === undefined || c.active === f.active))
      .map((c) => {
        const mine = live.filter((p) => p.clientId === c.id);
        return {
          ...c,
          projectCount: mine.length,
          activeProjectCount: mine.filter((p) => p.status === "ACTIVE").length,
          totalContractValue: mine.filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.contractValue, 0),
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  async get(id: string) {
    const c = await this.d.repos.clients.findById(id);
    if (!c) throw notFound("Client");
    const projects = alive(await this.d.repos.projects.find({ clientId: id }));
    return { ...c, projects };
  }

  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "client:write");
    const input = parse(ClientInput, raw);
    await this.assertNameFree(input.companyName);
    const c = await this.d.repos.clients.create(input);
    await this.d.activity.log({
      entityType: "CLIENT", entityId: c.id, action: "CREATED", userId: actor.id,
      message: `${actor.name} added client ${c.companyName}`,
    });
    return c;
  }

  async update(actor: Actor, id: string, raw: unknown) {
    requirePerm(actor, "client:write");
    const existing = await this.d.repos.clients.findById(id);
    if (!existing) throw notFound("Client");
    const patch = parse(ClientUpdateInput, raw);
    if (patch.companyName && patch.companyName !== existing.companyName) await this.assertNameFree(patch.companyName, id);
    const c = await this.d.repos.clients.update(id, patch);
    await this.d.activity.log({
      entityType: "CLIENT", entityId: id, action: "UPDATED", userId: actor.id,
      message: `${actor.name} updated client ${c.companyName}`,
    });
    return c;
  }

  /** Clients are deactivated rather than deleted, so history stays intact. */
  async deactivate(actor: Actor, id: string) {
    return this.update(actor, id, { active: false });
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const clash = (await this.d.repos.clients.findAll()).find(
      (c) => c.companyName.toLowerCase() === name.toLowerCase() && c.id !== exceptId,
    );
    if (clash) throw conflict("A client with this company name already exists.");
  }
}
