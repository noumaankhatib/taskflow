// Creates the first admin (or resets the password of an existing user and makes them an active Admin).
// Usage: npm run db:create-admin -- you@company.com "Your Name" 'a-strong-password'
//    or: ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run db:create-admin
import bcrypt from "bcryptjs";
import { createInfra } from "../src/repositories/infra";

const [, , a1, a2, a3] = process.argv;
const email = (a1 ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const name = (a2 ?? process.env.ADMIN_NAME ?? "Admin").trim();
const password = a3 ?? process.env.ADMIN_PASSWORD ?? "";
if (!email.includes("@") || password.length < 8) {
  console.error('Usage: npm run db:create-admin -- <email> "<name>" <password (min 8 chars)>');
  process.exit(1);
}
const { repos, kind } = await createInfra();
const passwordHash = await bcrypt.hash(password, 10);
const existing = (await repos.users.find({ email }))[0];
if (existing) {
  await repos.users.update(existing.id, { passwordHash, role: "ADMIN", active: true, isDeleted: false, deletedAt: null, deletedBy: null });
  console.log(`Updated ${email}: Admin, active, password reset (${kind}).`);
} else {
  const u = await repos.users.create({ name, email, role: "ADMIN", avatar: null, hourlyRate: 0, dailyRate: 0, active: true, passwordHash, isDeleted: false, deletedAt: null, deletedBy: null });
  console.log(`Created admin ${u.id} ${email} (${kind}).`);
}
process.exit(0);
