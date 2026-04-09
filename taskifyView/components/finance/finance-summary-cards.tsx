"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinanceSummary } from "@/lib/types";

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

interface FinanceSummaryCardsProps {
  summary: FinanceSummary;
}

export function FinanceSummaryCards({ summary }: FinanceSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total expense</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{vndFormatter.format(summary.totalAmount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{summary.count}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Average expense</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{vndFormatter.format(summary.averageAmount)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
