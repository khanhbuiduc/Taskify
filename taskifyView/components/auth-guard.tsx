"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRoles?: string[]
  fallbackPath?: string
}

export function AuthGuard({
  children,
  requiredRoles,
  fallbackPath = "/tasks",
}: AuthGuardProps) {
  const router = useRouter()
  const { user, isAuthenticated, isInitialized, checkAuth, isLoading } = useAuthStore()

  const hasRequiredRole =
    !requiredRoles || requiredRoles.some((role) => user?.roles.includes(role))

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isInitialized, router])

  useEffect(() => {
    if (isInitialized && isAuthenticated && !hasRequiredRole) {
      router.push(fallbackPath)
    }
  }, [fallbackPath, hasRequiredRole, isAuthenticated, isInitialized, router])

  // Show loading while checking authentication
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null
  }

  if (!hasRequiredRole) {
    return null
  }

  // Render children if authenticated
  return <>{children}</>
}
