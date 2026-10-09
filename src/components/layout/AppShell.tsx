"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, BriefcaseBusiness, CheckSquare, CreditCard, FileBarChart, Home, LogOut, Menu as MenuIcon, Receipt, Search, Settings, Users, UsersRound, X,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Avatar } from "@/components/ui/display";
import { Menu } from "@/components/ui/menu";
import { useCan, useMe } from "@/lib/lookups";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { label } from "@/utils/format";
import { CommandPalette } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";
import { useToast } from "@/components/ui/toast";

interface NavItem { href: string; label: string; icon: ReactNode; show?: boolean; mobile?: boolean }

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const canFinance = useCan("finance:view");
  const canReports = useCan("report:view");
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const unread = useApi<unknown[]>("/api/notifications?unread=true&pageSize=1", { refreshInterval: 60_000 }).meta?.unread as number | undefined;

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: <Home className="size-[18px]" />, mobile: true },
    { href: "/projects", label: "Projects", icon: <BriefcaseBusiness className="size-[18px]" />, mobile: true },
    { href: "/tasks", label: "My Tasks", icon: <CheckSquare className="size-[18px]" />, mobile: true },
    { href: "/team", label: "Team", icon: <UsersRound className="size-[18px]" /> },
    { href: "/clients", label: "Clients", icon: <Users className="size-[18px]" /> },
    { href: "/expenses", label: "Expenses", icon: <Receipt className="size-[18px]" />, mobile: true },
    { href: "/payments", label: "Payments", icon: <CreditCard className="size-[18px]" />, show: canFinance },
    { href: "/reports", label: "Reports", icon: <FileBarChart className="size-[18px]" />, show: canReports },
    { href: "/notifications", label: "Notifications", icon: <Bell className="size-[18px]" /> },
    { href: "/settings", label: "Settings", icon: <Settings className="size-[18px]" /> },
  ].filter((i) => i.show !== false);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  async function logout() {
    try {
      await api.post("/api/auth/logout");
      router.replace("/login");
      router.refresh();
    } catch (e) { toast.error(e); }
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active(i.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
          {i.icon}
          <span className="flex-1">{i.label}</span>
          {i.href === "/notifications" && !!unread && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
        </Link>
      ))}
    </nav>
  );
  const brand = (
    <Link href="/" className="flex h-14 items-center gap-2.5 px-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">TF</span>
      <span className="text-base font-semibold tracking-tight text-slate-900">TaskFlow</span>
    </Link>
  );

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        {brand}
        {nav}
        <div className="border-t border-slate-100 p-3 text-xs text-slate-400">Internal use only</div>
      </aside>

      {/* tablet / mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="tf-fade absolute inset-0 bg-slate-900/40" onClick={() => setNavOpen(false)} aria-hidden />
          <aside className="tf-slide-in relative flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3">{brand}<button aria-label="Close menu" onClick={() => setNavOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button></div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-5">
          <button aria-label="Open menu" onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><MenuIcon className="size-5" /></button>
          <button onClick={() => setSearchOpen(true)} aria-label="Search"
            className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 hover:border-slate-300">
            <Search className="size-4" /><span className="flex-1 truncate text-left">Search projects, tasks, clients…</span>
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-500 sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Menu
              trigger={<span className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100"><Avatar name={me.name} src={me.avatar} size={28} /><span className="hidden whitespace-nowrap text-left leading-tight sm:block"><span className="block text-sm font-medium text-slate-800">{me.name}</span><span className="block text-xs text-slate-500">{label(me.role)}</span></span></span>}
              items={[
                { label: "Settings", icon: <Settings className="size-4" />, onSelect: () => router.push("/settings") },
                { label: "Sign out", icon: <LogOut className="size-4" />, onSelect: logout, danger: true },
              ]}
            />
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[1400px] px-3 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* mobile bottom navigation */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {items.filter((i) => i.mobile).map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active(i.href) ? "text-indigo-600" : "text-slate-500")}>
            {i.icon}{i.label.replace("My ", "")}
          </Link>
        ))}
        <button onClick={() => setNavOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"><MenuIcon className="size-[18px]" />More</button>
      </nav>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
