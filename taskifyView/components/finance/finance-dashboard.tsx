"use client";

import { useMemo, useState } from "react";
import { format, subMonths, isAfter, startOfMonth, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceEntry } from "@/lib/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

interface FinanceDashboardProps {
  entries: FinanceEntry[];
}

// Generate predefined colors for charts
const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6"
];

export function FinanceDashboard({ entries }: FinanceDashboardProps) {
  const [monthsToCompare, setMonthsToCompare] = useState("3");

  // 1. Cash Flow Data (Income vs Expense by Month for the last 12 months)
  const cashFlowData = useMemo(() => {
    const dataMap = new Map<string, { month: string; income: number; expense: number }>();
    
    // Initialize last 6 months to ensure chronological order and no empty gaps
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "MMM yyyy");
      dataMap.set(key, { month: key, income: 0, expense: 0 });
    }

    const cutoffDate = subMonths(new Date(), 6);
    entries.forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (isAfter(entryDate, cutoffDate)) {
        const key = format(entryDate, "MMM yyyy");
        if (!dataMap.has(key)) {
          dataMap.set(key, { month: key, income: 0, expense: 0 });
        }
        const record = dataMap.get(key)!;
        if (entry.amount > 0) record.income += entry.amount;
        else record.expense -= entry.amount; // Math.abs
      }
    });

    return Array.from(dataMap.values());
  }, [entries]);

  // 2. Spending by Category Data (Bar chart: X = Category, grouping by Month)
  const { categoryData, monthKeys, categoryConfig } = useMemo(() => {
    const monthsBack = parseInt(monthsToCompare, 10);
    const cutoffDate = subMonths(new Date(), monthsBack);
    
    // Collect all valid expense entries within the timeframe
    const validEntries = entries.filter((e) => e.amount < 0 && isAfter(new Date(e.date), cutoffDate));
    
    // Unique months represented within the timeframe
    const uniqueMonths = new Set<string>();
    
    // Group by category, then by month
    // Map<Category, Map<Month, Amount>>
    const map = new Map<string, Map<string, number>>();

    validEntries.forEach((entry) => {
      const m = format(new Date(entry.date), "MMM yyyy");
      uniqueMonths.add(m);

      if (!map.has(entry.category)) {
        map.set(entry.category, new Map());
      }
      const catMap = map.get(entry.category)!;
      catMap.set(m, (catMap.get(m) || 0) + Math.abs(entry.amount));
    });

    // Sort unique months chronologically to ensure consistent color mapping
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Format for Recharts
    const data = Array.from(map.entries()).map(([category, mData]) => {
      const obj: any = { category };
      sortedMonths.forEach((m) => {
        const safeKey = m.replace(/\s/g, "_");
        obj[safeKey] = mData.get(m) || 0;
      });
      return obj;
    });

    // ChartConfig mapping for months
    const config: Record<string, any> = {};
    sortedMonths.forEach((m, idx) => {
      const safeKey = m.replace(/\s/g, "_");
      config[safeKey] = {
        label: m,
        color: COLORS[idx % COLORS.length]
      };
    });

    const safeMonthKeys = sortedMonths.map(m => m.replace(/\s/g, "_"));

    return { categoryData: data, monthKeys: safeMonthKeys, categoryConfig: config };
  }, [entries, monthsToCompare]);

  const cashFlowConfig = {
    income: { label: "Income", color: "hsl(var(--chart-2))" }, // Typically green
    expense: { label: "Expense", color: "hsl(var(--destructive))" } // Red
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow (Last 6 Months)</CardTitle>
          <CardDescription>Visualizing your income vs expense trends.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={cashFlowConfig} className="h-[300px] w-full">
            <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickFormatter={(value) => `${value / 1000}k`}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={80}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey="income" stackId="1" fill="var(--color-income)" stroke="var(--color-income)" fillOpacity={0.4} />
              <Area type="monotone" dataKey="expense" stackId="2" fill="var(--color-expense)" stroke="var(--color-expense)" fillOpacity={0.4} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Grouped by category to compare months.</CardDescription>
          </div>
          <Select value={monthsToCompare} onValueChange={setMonthsToCompare}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No expenses recorded in this period.
            </div>
          ) : (
            <ChartContainer config={categoryConfig} className="h-[400px] w-full">
              <BarChart data={categoryData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickFormatter={(value) => `${value / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  width={80}
                />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Legend verticalAlign="top" height={36} />
                {monthKeys.map((safeKey) => {
                  const originalLabel = categoryConfig[safeKey]?.label || safeKey;
                  return (
                    <Bar key={safeKey} dataKey={safeKey} name={originalLabel} fill={`var(--color-${safeKey})`} radius={[4, 4, 0, 0]} />
                  );
                })}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
