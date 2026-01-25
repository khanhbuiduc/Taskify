"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const projects = [
  { name: "Website Redesign", progress: 85, color: "bg-chart-1" },
  { name: "Mobile App v2.0", progress: 62, color: "bg-chart-2" },
  { name: "API Integration", progress: 94, color: "bg-chart-3" },
  { name: "Marketing Campaign", progress: 45, color: "bg-chart-4" },
  { name: "Customer Portal", progress: 78, color: "bg-chart-5" },
]

export function ProjectProgressChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Project Progress</CardTitle>
        <CardDescription>Current status of active projects</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {projects.map((project) => (
          <div key={project.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{project.name}</span>
              <span className="text-muted-foreground">{project.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all duration-500", project.color)}
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
