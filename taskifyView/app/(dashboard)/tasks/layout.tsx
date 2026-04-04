"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Dashboard", href: "/tasks/dashboard", value: "dashboard" },
    { name: "List", href: "/tasks/list", value: "list" },
    { name: "Calendar", href: "/tasks/calendar", value: "calendar" },
    { name: "Table", href: "/tasks/table", value: "table" },
  ];

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-fit">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.value}
              href={tab.href}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/50"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div className="flex-1 min-h-[500px] h-full m-0">{children}</div>
    </div>
  );
}
