"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useTheme } from "next-themes"

const data = [
  { date: "Jan", completed: 145, created: 180 },
  { date: "Feb", completed: 220, created: 250 },
  { date: "Mar", completed: 310, created: 340 },
  { date: "Apr", completed: 280, created: 295 },
  { date: "May", completed: 390, created: 420 },
  { date: "Jun", completed: 450, created: 480 },
  { date: "Jul", completed: 520, created: 550 },
  { date: "Aug", completed: 480, created: 510 },
  { date: "Sep", completed: 560, created: 590 },
  { date: "Oct", completed: 620, created: 650 },
  { date: "Nov", completed: 580, created: 600 },
  { date: "Dec", completed: 650, created: 680 },
]

export function TaskCompletionChart() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const gridColor = isDark ? "#333" : "#e5e5e5"
  const axisColor = isDark ? "#666" : "#888"
  const tooltipBg = isDark ? "#1a1a1a" : "#ffffff"
  const tooltipBorder = isDark ? "#333" : "#e5e5e5"
  const tooltipLabel = isDark ? "#fff" : "#111"
  const tooltipItem = isDark ? "#999" : "#666"

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Task Overview</CardTitle>
        <CardDescription>Tasks created vs completed over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5ebaad" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5ebaad" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6ba6d6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6ba6d6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                }}
                labelStyle={{ color: tooltipLabel }}
                itemStyle={{ color: tooltipItem }}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke="#5ebaad"
                strokeWidth={2}
                fill="url(#colorCreated)"
                name="Created"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#6ba6d6"
                strokeWidth={2}
                fill="url(#colorCompleted)"
                name="Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
