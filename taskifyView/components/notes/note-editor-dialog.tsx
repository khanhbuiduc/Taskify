"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Note } from "@/lib/types";

interface NoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { title: string; content?: string; isPinned?: boolean }) => Promise<void>;
  note?: Note | null;
}

export function NoteEditorDialog({ open, onOpenChange, onSave, note }: NoteEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setIsPinned(note.isPinned);
    } else {
      setTitle("");
      setContent("");
      setIsPinned(false);
    }
  }, [note, open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ title: title.trim(), content, isPinned });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle>
          <DialogDescription>Write down your thoughts. You can pin important notes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">Content</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Capture details, decisions, or ideas..."
              maxLength={4000}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="note-pinned" checked={isPinned} onCheckedChange={setIsPinned} />
            <Label htmlFor="note-pinned">Pin this note</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || !title.trim()}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
