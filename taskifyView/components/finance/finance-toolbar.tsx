"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinanceCategory } from "@/lib/types";
import { Plus, RefreshCcw, Tags } from "lucide-react";

interface FinanceToolbarProps {
  categories: FinanceCategory[];
  from: string;
  to: string;
  category: string;
  search: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onManageCategories: () => void;
  onRefresh: () => void;
}

export function FinanceToolbar({
  categories,
  from,
  to,
  category,
  search,
  onFromChange,
  onToChange,
  onCategoryChange,
  onSearchChange,
  onCreate,
  onManageCategories,
  onRefresh,
}: FinanceToolbarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="finance-from">Từ</Label>
          <Input
            id="finance-from"
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="finance-to">Đến</Label>
          <Input
            id="finance-to"
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 min-w-[200px]">
          <Label>Danh mục</Label>
          <Select
            value={category || "__all__"}
            onValueChange={(v) => onCategoryChange(v === "__all__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tất cả danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tất cả danh mục</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item.id} value={item.name}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 grid gap-1.5">
          <Label htmlFor="finance-search">Tìm kiếm</Label>
          <Input
            id="finance-search"
            placeholder="Tìm kiếm mô tả..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
        <Button variant="outline" onClick={onManageCategories}>
          <Tags className="h-4 w-4 mr-2" />
          Quản lý danh mục
        </Button>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Chi phí mới
        </Button>
      </div>
    </div>
  );
}
