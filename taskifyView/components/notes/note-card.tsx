"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pin, PinOff, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Note } from "@/lib/types";

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
}

export function NoteCard({ note, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const updated = formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true });
  const snippet = note.content?.slice(0, 180) ?? "";

  return (
    <Card
      className="relative h-full transition-shadow hover:shadow-lg"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 pr-6">{note.title || "Untitled note"}</CardTitle>
          {note.isPinned && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Pin className="h-4 w-4 text-accent" />
                </TooltipTrigger>
                <TooltipContent>Đang ghim</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        {snippet ? <p className="line-clamp-4 whitespace-pre-wrap">{snippet}</p> : <p className="italic">No content yet</p>}
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">Updated {updated}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onTogglePin(note)}>
            {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(note)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(note)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardFooter>
      {isHovering && <div className="absolute inset-0 rounded-xl ring-1 ring-primary/10 pointer-events-none" />}
    </Card>
  );
}
