"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminUser } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Pencil, UserCheck, UserX } from "lucide-react"

interface AdminUserTableProps {
  users: AdminUser[]
  currentUserId?: string
  isLoading: boolean
  onEdit: (user: AdminUser) => void
  onToggleBan: (user: AdminUser) => void
}

export function AdminUserTable({
  users,
  currentUserId,
  isLoading,
  onEdit,
  onToggleBan,
}: AdminUserTableProps) {
  if (isLoading && users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading users...
        </CardContent>
      </Card>
    )
  }

  if (users.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <p className="text-lg font-semibold">No users found</p>
          <p className="text-muted-foreground">
            Try another filter or create a new account.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[220px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isCurrentUser = user.userId === currentUserId

            return (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.userName || user.email}</span>
                      {isCurrentUser && <Badge variant="outline">You</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <Badge key={role} variant={role === "Admin" ? "default" : "secondary"}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      user.isBanned
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(user)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant={user.isBanned ? "outline" : "destructive"}
                      size="sm"
                      onClick={() => onToggleBan(user)}
                      disabled={isCurrentUser}
                      title={isCurrentUser ? "You cannot ban your own account." : undefined}
                    >
                      {user.isBanned ? (
                        <UserCheck className="mr-2 h-4 w-4" />
                      ) : (
                        <UserX className="mr-2 h-4 w-4" />
                      )}
                      {user.isBanned ? "Unban" : "Ban"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
