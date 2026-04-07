"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, RefreshCcw } from "lucide-react";

interface NoteToolbarProps {
  search: string;
  showPinnedOnly: boolean;
  onSearchChange: (value: string) => void;
  onTogglePinnedFilter: (checked: boolean) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

export function NoteToolbar({
  search,
  showPinnedOnly,
  onSearchChange,
  onTogglePinnedFilter,
  onCreate,
  onRefresh,
}: NoteToolbarProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <Input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="Refresh notes">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={showPinnedOnly} onCheckedChange={onTogglePinnedFilter} id="filter-pinned" />
          <Label htmlFor="filter-pinned">Pinned only</Label>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New note
        </Button>
      </div>
    </div>
  );
}
