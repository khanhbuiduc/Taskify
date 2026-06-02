"use client"

import { useDeferredValue, useEffect, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AdminUserDialog } from "@/components/admin/admin-user-dialog"
import { AdminUserTable } from "@/components/admin/admin-user-table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/lib/auth-store"
import { useAdminUserStore } from "@/lib/admin-user-store"
import type { AdminUser } from "@/lib/types"
import { Plus, RefreshCcw, Search } from "lucide-react"

export default function AdminUsersPage() {
  return (
    <AuthGuard requiredRoles={["Admin"]} fallbackPath="/tasks">
      <AdminUsersView />
    </AuthGuard>
  )
}

function AdminUsersView() {
  const currentUserId = useAuthStore((state) => state.user?.userId)
  const users = useAdminUserStore((state) => state.users)
  const page = useAdminUserStore((state) => state.page)
  const totalCount = useAdminUserStore((state) => state.totalCount)
  const totalPages = useAdminUserStore((state) => state.totalPages)
  const search = useAdminUserStore((state) => state.search)
  const roleFilter = useAdminUserStore((state) => state.roleFilter)
  const statusFilter = useAdminUserStore((state) => state.statusFilter)
  const isLoading = useAdminUserStore((state) => state.isLoading)
  const isSaving = useAdminUserStore((state) => state.isSaving)
  const error = useAdminUserStore((state) => state.error)
  const setSearch = useAdminUserStore((state) => state.setSearch)
  const setRoleFilter = useAdminUserStore((state) => state.setRoleFilter)
  const setStatusFilter = useAdminUserStore((state) => state.setStatusFilter)
  const setPage = useAdminUserStore((state) => state.setPage)
  const fetchUsers = useAdminUserStore((state) => state.fetchUsers)
  const createUser = useAdminUserStore((state) => state.createUser)
  const updateUser = useAdminUserStore((state) => state.updateUser)
  const banUser = useAdminUserStore((state) => state.banUser)
  const unbanUser = useAdminUserStore((state) => state.unbanUser)

  const [searchInput, setSearchInput] = useState(search)
  const deferredSearch = useDeferredValue(searchInput)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [moderationTarget, setModerationTarget] = useState<AdminUser | null>(null)

  useEffect(() => {
    setSearch(deferredSearch)
  }, [deferredSearch, setSearch])

  useEffect(() => {
    fetchUsers().catch(() => {
      // Errors are handled in the store.
    })
  }, [fetchUsers, page, roleFilter, search, statusFilter])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user)
    setDialogOpen(true)
  }

  const handleToggleBan = (user: AdminUser) => {
    setModerationTarget(user)
  }

  const confirmModeration = async () => {
    if (!moderationTarget) {
      return
    }

    const succeeded = moderationTarget.isBanned
      ? await unbanUser(moderationTarget.userId)
      : await banUser(moderationTarget.userId)

    if (succeeded) {
      setModerationTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-3 md:grid-cols-3 xl:flex-1">
          <div className="relative md:col-span-3 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by email or display name"
              className="pl-9"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as "all" | "Admin" | "User")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="User">User</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | "active" | "banned")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchUsers().catch(() => {})}
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleOpenCreate} disabled={isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            Add user
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AdminUserTable
        users={users}
        currentUserId={currentUserId}
        isLoading={isLoading}
        onEdit={handleOpenEdit}
        onToggleBan={handleToggleBan}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} user{totalCount === 1 ? "" : "s"} found
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={isLoading || page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={isLoading || totalPages === 0 || page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <AdminUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        isSaving={isSaving}
        onCreate={createUser}
        onUpdate={updateUser}
      />

      <AlertDialog
        open={!!moderationTarget}
        onOpenChange={(open) => {
          if (!open) {
            setModerationTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {moderationTarget?.isBanned ? "Unban user" : "Ban user"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {moderationTarget?.isBanned
                ? `Allow ${moderationTarget.email} to sign in and use the API again.`
                : `Immediately block ${moderationTarget?.email} from signing in and calling the API.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmModeration().catch(() => {})
              }}
              disabled={isSaving}
            >
              {moderationTarget?.isBanned ? "Unban" : "Ban"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
