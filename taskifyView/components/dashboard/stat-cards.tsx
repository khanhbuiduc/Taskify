"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

const stats = [
  {
    title: "Total Tasks",
    value: "2,847",
    change: "+12.5%",
    trend: "up",
    icon: CheckCircle2,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  {
    title: "In Progress",
    value: "156",
    change: "+8.2%",
    trend: "up",
    icon: Clock,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    title: "Overdue",
    value: "23",
    change: "-4.1%",
    trend: "down",
    icon: AlertCircle,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
  {
    title: "Completion Rate",
    value: "94.2%",
    change: "+2.3%",
    trend: "up",
    icon: TrendingUp,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
]

export function StatCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className={cn("rounded-lg p-2.5", stat.bgColor)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  stat.trend === "up" ? "text-chart-2" : "text-chart-4"
                )}
              >
                {stat.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {stat.change}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
