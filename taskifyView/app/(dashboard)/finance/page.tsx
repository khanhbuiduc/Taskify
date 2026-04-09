"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FinanceToolbar } from "@/components/finance/finance-toolbar";
import { FinanceSummaryCards } from "@/components/finance/finance-summary-cards";
import { FinanceTable } from "@/components/finance/finance-table";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { FinanceCalendar } from "@/components/finance/finance-calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceEntryDialog } from "@/components/finance/finance-entry-dialog";
import { FinanceCategoryDialog } from "@/components/finance/finance-category-dialog";
import { useFinanceStore } from "@/lib/finance-store";
import { useFinanceCategoryStore } from "@/lib/finance-category-store";
import type { FinanceEntry } from "@/lib/types";

function toDateInput(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FinancePage() {
  const { entries, summary, isLoading, isSummaryLoading, error, filters, setFilters, refresh, createEntry, updateEntry, deleteEntry } =
    useFinanceStore();
  const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useFinanceCategoryStore();

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);

  const [from, setFrom] = useState(toDateInput(filters.from));
  const [to, setTo] = useState(toDateInput(filters.to));
  const [category, setCategory] = useState(filters.category ?? "");
  const [search, setSearch] = useState(filters.search ?? "");

  const computedFilters = useMemo(
    () => ({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      category: category || undefined,
      search: search.trim() || undefined,
    }),
    [from, to, category, search]
  );

  useEffect(() => {
    setFilters(computedFilters);
    refresh().catch(() => {});
  }, [computedFilters, refresh, setFilters]);

  useEffect(() => {
    fetchCategories().catch(() => {});
  }, [fetchCategories]);

  const handleSaveEntry = async (payload: { date: string; category: string; description?: string; amount: number }) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, payload);
    } else {
      await createEntry(payload);
    }
  };

  return (
    <div className="space-y-6">
      <FinanceToolbar
        categories={categories}
        from={from}
        to={to}
        category={category}
        search={search}
        onFromChange={setFrom}
        onToChange={setTo}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        onRefresh={() => refresh().catch(() => {})}
        onCreate={() => {
          if (categories.length === 0) {
            toast.error("Create at least one category before adding expenses.");
            setCategoryDialogOpen(true);
            return;
          }
          setEditingEntry(null);
          setEntryDialogOpen(true);
        }}
        onManageCategories={() => setCategoryDialogOpen(true)}
      />

      {(isLoading || isSummaryLoading) && (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FinanceSummaryCards summary={summary} />

      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <FinanceTable
            entries={entries}
            onEdit={(entry) => {
              setEditingEntry(entry);
              setEntryDialogOpen(true);
            }}
            onDelete={(entry) =>
              deleteEntry(entry.id).catch(() => {
                toast.error("Failed to delete finance entry");
              })
            }
          />
        </TabsContent>

        <TabsContent value="dashboard">
          <FinanceDashboard entries={entries} />
        </TabsContent>

        <TabsContent value="calendar">
          <FinanceCalendar entries={entries} />
        </TabsContent>
      </Tabs>

      <FinanceEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        entry={editingEntry}
        categories={categories}
        onSave={(payload) =>
          handleSaveEntry(payload).catch(() => {
            toast.error("Failed to save finance entry");
          })
        }
      />

      <FinanceCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categories}
        onCreate={async (payload) => {
          try {
            await createCategory(payload);
          } catch {
            toast.error("Failed to create category");
          }
        }}
        onUpdate={async (id, payload) => {
          try {
            await updateCategory(id, payload);
            await refresh();
          } catch {
            toast.error("Failed to update category");
          }
        }}
        onDelete={async (id) => {
          try {
            await deleteCategory(id);
          } catch {
            toast.error("Failed to delete category");
          }
        }}
      />
    </div>
  );
}
