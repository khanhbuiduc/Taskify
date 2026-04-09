"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinanceEntry } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

interface FinanceTableProps {
  entries: FinanceEntry[];
  onEdit: (entry: FinanceEntry) => void;
  onDelete: (entry: FinanceEntry) => void;
}

export function FinanceTable({ entries, onEdit, onDelete }: FinanceTableProps) {
  if (entries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-lg font-semibold">No expenses found</p>
          <p className="text-muted-foreground">Create your first expense entry to start tracking.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{new Date(entry.date).toLocaleDateString("vi-VN")}</TableCell>
              <TableCell>
                <Badge variant="secondary">{entry.category}</Badge>
              </TableCell>
              <TableCell className="max-w-[420px] truncate">{entry.description || "-"}</TableCell>
              <TableCell className="text-right font-medium">{vndFormatter.format(entry.amount)}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(entry)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(entry)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
