"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FinanceCategory } from "@/lib/types";
import { Pencil, Trash2, X, Check } from "lucide-react";

interface FinanceCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  onCreate: (payload: { name: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function FinanceCategoryDialog({
  open,
  onOpenChange,
  categories,
  onCreate,
  onUpdate,
  onDelete,
}: FinanceCategoryDialogProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await onCreate({ name });
      setNewName("");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (category: FinanceCategory) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await onUpdate(editingId, { name });
      setEditingId(null);
      setEditingName("");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage finance categories</DialogTitle>
          <DialogDescription>Create, rename, and remove your categories.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-finance-category">New category</Label>
            <div className="flex gap-2">
              <Input
                id="new-finance-category"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Food, Transport, Bills"
                maxLength={60}
              />
              <Button onClick={handleCreate} disabled={isSaving || !newName.trim()}>
                Add
              </Button>
            </div>
          </div>

          <ScrollArea className="h-64 rounded-md border p-3">
            <div className="space-y-2">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2 rounded-md border p-2">
                    {editingId === category.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          maxLength={60}
                          className="h-8"
                        />
                        <Button size="icon" variant="ghost" onClick={saveEdit} disabled={isSaving || !editingName.trim()}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="flex-1 text-sm font-medium">{category.name}</p>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(category)} disabled={isSaving}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(category.id)}
                          disabled={isSaving}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
