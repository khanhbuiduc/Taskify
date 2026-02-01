"use client"

import React, { useEffect, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  ListTodo,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const baseExtensions = [
  StarterKit.configure({
    heading: false,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  Underline,
  TaskList,
  TaskItem.configure({
    nested: true,
    HTMLAttributes: {
      class: "flex items-start gap-2",
    },
  }),
]

export interface DescriptionEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
  className?: string
}

export function DescriptionEditor({
  value,
  onChange,
  placeholder = "Enter task description…",
  editable = true,
  className,
}: DescriptionEditorProps) {
  const editor = useEditor({
    extensions: [
      ...baseExtensions,
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editable,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] max-h-[320px] overflow-y-auto px-3 py-2 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:overflow-x-auto",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  const updateContent = useCallback(
    (newValue: string) => {
      if (!editor) return
      const current = editor.getHTML()
      if (current === newValue) return
      editor.commands.setContent(newValue || "", false)
    },
    [editor]
  )

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const normalized = value?.trim() || ""
    if (normalized !== current && !editor.isFocused) {
      updateContent(normalized)
    }
  }, [value, editor, updateContent])

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground",
          className
        )}
      >
        {placeholder}
      </div>
    )
  }

  const toolbar = editable && (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 px-1 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="Todo list (Ctrl+Shift+9)"
        >
          <ListTodo className="size-4" />
        </ToolbarButton>
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Code"
        >
          <Code className="size-4" />
        </ToolbarButton>
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align left"
        >
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align center"
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align right"
        >
          <AlignRight className="size-4" />
        </ToolbarButton>
        <Separator />
        <ToolbarButton
          onClick={() => {
            const url = window.prompt("URL:")
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive("link")}
          title="Insert link"
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
      </div>
    </TooltipProvider>
  )

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background overflow-hidden",
        className
      )}
    >
      {toolbar}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "size-8 rounded",
            active && "bg-accent text-accent-foreground"
          )}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  )
}

function Separator() {
  return <div className="mx-0.5 h-5 w-px bg-border" role="separator" />
}
