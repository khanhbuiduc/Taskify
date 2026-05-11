"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FinanceCategory, FinanceEntry } from "@/lib/types";

interface FinanceEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinanceEntry | null;
  categories: FinanceCategory[];
  onSave: (payload: {
    date: string;
    category: string;
    description?: string;
    amount: number;
  }) => Promise<void>;
}

function toDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayDateInput(): string {
  return toDateInput(new Date().toISOString());
}

export function FinanceEntryDialog({
  open,
  onOpenChange,
  entry,
  categories,
  onSave,
}: FinanceEntryDialogProps) {
  const [date, setDate] = useState(todayDateInput());
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setDate(toDateInput(entry.date));
      setCategory(entry.category);
      setDescription(entry.description ?? "");
      setAmount(String(entry.amount));
    } else {
      setDate(todayDateInput());
      setCategory(categories[0]?.name ?? "");
      setDescription("");
      setAmount("");
    }
  }, [entry, open, categories]);

  const canSave = useMemo(() => {
    const num = Number(amount);
    return !!date && !!category && Number.isFinite(num) && num > 0;
  }, [amount, category, date]);

  const handleSubmit = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({
        date: new Date(date).toISOString(),
        category,
        description: description.trim(),
        amount: Number(amount),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Sửa chi phí" : "Chi phí mới"}</DialogTitle>
          <DialogDescription>
            Theo dõi chi tiêu của bạn với ngày, danh mục, mô tả và số tiền.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="finance-date">Ngày</Label>
              <Input
                id="finance-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-description">Mô tả</Label>
            <Textarea
              id="finance-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bạn đã chi tiêu vào việc gì?"
              maxLength={500}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-amount">Số tiền (VND)</Label>
            <Input
              id="finance-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSave || isSaving || categories.length === 0}
          >
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
