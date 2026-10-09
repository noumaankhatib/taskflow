/** Where an (entityType, entityId) pair lives in the UI. Used by notifications and activity feeds. */
export function entityHref(entityType: string | null | undefined, entityId: string | null | undefined): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "TASK": return `/tasks?task=${entityId}`;
    case "PROJECT": return `/projects/${entityId}`;
    case "EXPENSE": return `/expenses?expense=${entityId}`;
    case "PAYMENT": return `/payments?payment=${entityId}`;
    case "CLIENT": return `/clients?client=${entityId}`;
    case "USER": return `/team?user=${entityId}`;
    default: return null;
  }
}
