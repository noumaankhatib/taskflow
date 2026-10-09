import { redirect } from "next/navigation";
import { getCurrentUser } from "@/utils/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  // only allow same-site relative redirects
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white">TF</span>
          <span className="text-xl font-semibold tracking-tight">TaskFlow</span>
        </div>
        <LoginForm next={safeNext} />
        <p className="mt-4 text-center text-xs text-slate-400">Internal tool. Ask an admin if you need access.</p>
      </div>
    </div>
  );
}
