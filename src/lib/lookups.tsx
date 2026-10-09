"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Client, PublicUser } from "@/schemas/entities";
import { useApi } from "./hooks";
import type { Permission } from "@/utils/rbac";
import { can as roleCan } from "@/utils/rbac";

/* ------------------------------ current user ------------------------------ */
const MeContext = createContext<PublicUser | null>(null);
export const MeProvider = ({ user, children }: { user: PublicUser; children: ReactNode }) => (
  <MeContext.Provider value={user}>{children}</MeContext.Provider>
);
export function useMe(): PublicUser {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <MeProvider>");
  return me;
}
export const useCan = (perm: Permission) => roleCan(useMe().role, perm);

/* ------------------------------ lookups ------------------------------ */
export interface ProjectLite { id: string; name: string; clientId: string; status: string; memberIds: string[]; projectManagerId: string | null; isDeleted: boolean }

/** Users / clients / projects are small; fetch once and resolve ids to names anywhere in the UI. */
export function useLookups() {
  const users = useApi<PublicUser[]>("/api/users?pageSize=500");
  const clients = useApi<(Client & { projectCount: number })[]>("/api/clients?pageSize=500");
  const projects = useApi<ProjectLite[]>("/api/projects?pageSize=500");
  return useMemo(() => {
    const u = users.data ?? [], c = clients.data ?? [], p = projects.data ?? [];
    const usersById = new Map(u.map((x) => [x.id, x]));
    const clientsById = new Map(c.map((x) => [x.id, x]));
    const projectsById = new Map(p.map((x) => [x.id, x]));
    return {
      users: u, clients: c, projects: p, usersById, clientsById, projectsById,
      userName: (id?: string | null) => (id ? usersById.get(id)?.name ?? id : "Unassigned"),
      clientName: (id?: string | null) => (id ? clientsById.get(id)?.companyName ?? id : "—"),
      projectName: (id?: string | null) => (id ? projectsById.get(id)?.name ?? id : "—"),
      loading: users.isLoading || clients.isLoading || projects.isLoading,
      reload: () => Promise.all([users.reload(), clients.reload(), projects.reload()]),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.data, clients.data, projects.data, users.isLoading, clients.isLoading, projects.isLoading]);
}
export type Lookups = ReturnType<typeof useLookups>;

const LookupContext = createContext<Lookups | null>(null);
export function LookupProvider({ children }: { children: ReactNode }) {
  const l = useLookups();
  return <LookupContext.Provider value={l}>{children}</LookupContext.Provider>;
}
export function useLookup(): Lookups {
  const l = useContext(LookupContext);
  if (!l) throw new Error("useLookup must be used inside <LookupProvider>");
  return l;
}
