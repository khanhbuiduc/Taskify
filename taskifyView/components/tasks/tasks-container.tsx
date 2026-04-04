"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardView } from "./dashboard-view";
import { ListView } from "./list-view";
import { CalendarView } from "./calendar-view";
import { TableView } from "./table-view";

export function TasksContainer() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <Tabs
      defaultValue="dashboard"
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full flex flex-col gap-6"
    >
      <TabsList>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="table">Table</TabsTrigger>
      </TabsList>

      <div className="flex-1 min-h-[500px]">
        <TabsContent value="dashboard" className="h-full m-0 data-[state=active]:block">
          <DashboardView />
        </TabsContent>
        <TabsContent value="list" className="h-full m-0 data-[state=active]:block">
          <ListView />
        </TabsContent>
        <TabsContent value="calendar" className="h-full m-0 data-[state=active]:block">
          <CalendarView />
        </TabsContent>
        <TabsContent value="table" className="h-full m-0 data-[state=active]:block">
          <TableView />
        </TabsContent>
      </div>
    </Tabs>
  );
}
