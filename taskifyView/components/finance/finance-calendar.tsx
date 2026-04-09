"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FinanceEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

interface FinanceCalendarProps {
  entries: FinanceEntry[];
}

export function FinanceCalendar({ entries }: FinanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Group entries by exact date string (YYYY-MM-DD)
  const entriesByDate = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; list: FinanceEntry[] }>();
    entries.forEach((e) => {
      const dStr = format(new Date(e.date), "yyyy-MM-dd");
      if (!map.has(dStr)) map.set(dStr, { income: 0, expense: 0, list: [] });
      
      const dayData = map.get(dStr)!;
      dayData.list.push(e);
      if (e.amount > 0) dayData.income += e.amount;
      else dayData.expense -= e.amount;
    });
    return map;
  }, [entries]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });
  }, [currentMonth]);

  const startDayOfWeek = getDay(startOfMonth(currentMonth)); // 0 = Sunday
  // Adjust so Monday is 0 if needed, but let's stick to standard Sunday=0 for simplicity
  
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedDayData = selectedDate ? entriesByDate.get(selectedDateStr) : null;

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-card border rounded-lg p-4">
        <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-[100px]">
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="border-r border-b bg-muted/20" />
          ))}
          
          {/* Actual days */}
          {daysInMonth.map((day) => {
            const dStr = format(day, "yyyy-MM-dd");
            const data = entriesByDate.get(dStr);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dStr}
                onClick={() => {
                  if (data && data.list.length > 0) {
                    setSelectedDate(day);
                  }
                }}
                className={cn(
                  "border-r border-b p-2 flex flex-col gap-1 transition-colors relative",
                  data && data.list.length > 0 ? "cursor-pointer hover:bg-muted/50" : "opacity-70"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center",
                    isToday ? "bg-primary text-primary-foreground" : ""
                  )}>
                    {format(day, "d")}
                  </span>
                </div>
                
                {data && (
                  <div className="mt-auto flex flex-col gap-0.5 text-xs font-medium">
                    {data.income > 0 && (
                      <span className="text-green-500 bg-green-500/10 px-1 rounded truncate">
                        +{vndFormatter.format(data.income)}
                      </span>
                    )}
                    {data.expense > 0 && (
                      <span className="text-red-500 bg-red-500/10 px-1 rounded truncate">
                        -{vndFormatter.format(data.expense)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(v) => !v && setSelectedDate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Transactions for {selectedDate && format(selectedDate, "dd MMMM yyyy")}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 p-1">
              {selectedDayData?.list.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold">{entry.description || "No description"}</div>
                    <div className={cn("font-bold whitespace-nowrap", entry.amount < 0 ? "text-red-500" : "text-green-500")}>
                      {vndFormatter.format(entry.amount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{entry.category}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(entry.date), "HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
