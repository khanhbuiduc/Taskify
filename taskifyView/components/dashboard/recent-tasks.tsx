"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const tasks = [
  {
    id: 1,
    title: "Update user authentication flow",
    project: "Website Redesign",
    status: "In Progress",
    priority: "High",
    assignee: "JD",
  },
  {
    id: 2,
    title: "Design new dashboard components",
    project: "Mobile App v2.0",
    status: "Completed",
    priority: "Medium",
    assignee: "SM",
  },
  {
    id: 3,
    title: "Fix payment gateway integration",
    project: "API Integration",
    status: "In Progress",
    priority: "High",
    assignee: "AK",
  },
  {
    id: 4,
    title: "Write API documentation",
    project: "API Integration",
    status: "Todo",
    priority: "Low",
    assignee: "RL",
  },
  {
    id: 5,
    title: "Create email marketing templates",
    project: "Marketing Campaign",
    status: "In Progress",
    priority: "Medium",
    assignee: "CP",
  },
]

const statusColors: Record<string, string> = {
  "In Progress": "bg-chart-1/20 text-chart-1 border-chart-1/30",
  Completed: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  Todo: "bg-muted text-muted-foreground border-border",
}

const priorityColors: Record<string, string> = {
  High: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  Medium: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  Low: "bg-chart-5/20 text-chart-5 border-chart-5/30",
}

export function RecentTasks() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Recent Tasks</CardTitle>
        <CardDescription>Latest updates from your team</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-4">
                <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-xs font-medium text-accent">{task.assignee}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="text-sm text-muted-foreground">{task.project}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("border", statusColors[task.status])}>
                  {task.status}
                </Badge>
                <Badge variant="outline" className={cn("border", priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
