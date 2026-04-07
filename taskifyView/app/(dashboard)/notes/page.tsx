"use client";

import { useEffect, useMemo, useState } from "react";
import { NoteToolbar } from "@/components/notes/note-toolbar";
import { NoteCard } from "@/components/notes/note-card";
import { NoteEditorDialog } from "@/components/notes/note-editor-dialog";
import { useNoteStore } from "@/lib/note-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function NotesPage() {
  const { notes, isLoading, error, fetchNotes, createNote, updateNote, deleteNote, togglePin, setSearchTerm, searchTerm } =
    useNoteStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  useEffect(() => {
    fetchNotes().catch(() => {});
  }, [fetchNotes]);

  const editingNote = useMemo(() => notes.find((n) => n.id === editingId), [notes, editingId]);

  const filteredNotes = useMemo(() => {
    return showPinnedOnly ? notes.filter((n) => n.isPinned) : notes;
  }, [notes, showPinnedOnly]);

  const handleSave = async (payload: { title: string; content?: string; isPinned?: boolean }) => {
    if (editingNote) {
      await updateNote(editingNote.id, payload);
    } else {
      await createNote(payload);
    }
  };

  const handleDelete = async (noteId: string) => {
    await deleteNote(noteId);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    fetchNotes({ search: value }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <NoteToolbar
        search={searchTerm}
        showPinnedOnly={showPinnedOnly}
        onSearchChange={handleSearchChange}
        onTogglePinnedFilter={setShowPinnedOnly}
        onCreate={() => {
          setEditingId(null);
          setDialogOpen(true);
        }}
        onRefresh={() => fetchNotes().catch(() => {})}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <p className="text-lg font-semibold">No notes yet</p>
            <p className="text-muted-foreground">Create your first note to start capturing ideas.</p>
            <Button
              onClick={() => {
                setEditingId(null);
                setDialogOpen(true);
              }}
            >
              New note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={(n) => {
                setEditingId(n.id);
                setDialogOpen(true);
              }}
              onDelete={(n) =>
                handleDelete(n.id).catch(() => {
                  toast.error("Failed to delete note");
                })
              }
              onTogglePin={(n) =>
                togglePin(n.id).catch(() => {
                  toast.error("Failed to update pin");
                })
              }
            />
          ))}
        </div>
      )}

      <NoteEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(payload) =>
          handleSave(payload).catch(() => {
            toast.error("Failed to save note");
          })
        }
        note={editingNote}
      />
    </div>
  );
}
