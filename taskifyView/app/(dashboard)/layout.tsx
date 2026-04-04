"use client";

import { AuthGuard } from "@/components/auth-guard";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { TaskStoreInitializer } from "@/components/task-store-initializer";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <TaskStoreInitializer>
        <SidebarProvider>
          <Sidebar />
          <SidebarInset>
            <TopBar />
            <div className="p-6 min-h-0 flex-1">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TaskStoreInitializer>
    </AuthGuard>
  );
}
