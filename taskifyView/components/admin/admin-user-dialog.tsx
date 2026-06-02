"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminUser, AdminUserRole } from "@/lib/types"

interface AdminUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: AdminUser | null
  isSaving: boolean
  onCreate: (payload: {
    email: string
    displayName: string
    password: string
    role: AdminUserRole
  }) => Promise<boolean>
  onUpdate: (id: string, payload: {
    email: string
    displayName: string
    role: AdminUserRole
    newPassword?: string
    confirmNewPassword?: string
  }) => Promise<boolean>
}

export function AdminUserDialog({
  open,
  onOpenChange,
  user,
  isSaving,
  onCreate,
  onUpdate,
}: AdminUserDialogProps) {
  const isEditMode = !!user
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<AdminUserRole>("User")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setEmail(user?.email ?? "")
    setDisplayName(user?.userName ?? "")
    setRole(user?.roles[0] ?? "User")
    setPassword("")
    setConfirmPassword("")
    setError(null)
  }, [open, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    const trimmedDisplayName = displayName.trim()

    if (!trimmedEmail || !trimmedDisplayName) {
      setError("Email and display name are required.")
      return
    }

    if (!isEditMode && !password) {
      setError("Password is required when creating a user.")
      return
    }

    if ((password || confirmPassword) && password !== confirmPassword) {
      setError("Password confirmation does not match.")
      return
    }

    let succeeded = false

    if (isEditMode && user) {
      succeeded = await onUpdate(user.userId, {
        email: trimmedEmail,
        displayName: trimmedDisplayName,
        role,
        newPassword: password || undefined,
        confirmNewPassword: confirmPassword || undefined,
      })
    } else {
      succeeded = await onCreate({
        email: trimmedEmail,
        displayName: trimmedDisplayName,
        password,
        role,
      })
    }

    if (succeeded) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update account details, role, or reset the password."
              : "Create a new account and assign its initial role."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-user-email">Email</Label>
              <Input
                id="admin-user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@taskify.com"
                maxLength={256}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-user-display-name">Display name</Label>
              <Input
                id="admin-user-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="User name"
                maxLength={100}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-user-role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as AdminUserRole)}
                disabled={isSaving}
              >
                <SelectTrigger id="admin-user-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-user-password">
                {isEditMode ? "New password" : "Password"}
              </Label>
              <Input
                id="admin-user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEditMode ? "Leave blank to keep current password" : "Minimum 6 characters"}
                minLength={6}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-user-confirm-password">Confirm password</Label>
              <Input
                id="admin-user-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                minLength={6}
                disabled={isSaving}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isEditMode ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
