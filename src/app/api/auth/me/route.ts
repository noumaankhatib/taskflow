import { route } from "@/utils/api";
import { toPublic } from "@/modules/users/user.service";
import { ROLE_PERMISSIONS } from "@/utils/rbac";

export const GET = route(async ({ user }) => ({ user: toPublic(user), permissions: ROLE_PERMISSIONS[user.role] }));
