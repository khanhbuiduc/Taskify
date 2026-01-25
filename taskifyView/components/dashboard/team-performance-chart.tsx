"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useTheme } from "next-themes"

const data = [
  { name: "Design", tasks: 85, hours: 120 },
  { name: "Dev", tasks: 142, hours: 280 },
  { name: "Marketing", tasks: 63, hours: 95 },
  { name: "Sales", tasks: 78, hours: 110 },
  { name: "Support", tasks: 96, hours: 150 },
]

export function TeamPerformanceChart() {
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
        <CardTitle className="text-foreground">Team Performance</CardTitle>
        <CardDescription>Tasks completed and hours logged by team</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="name"
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
              <Bar
                dataKey="tasks"
                fill="#5ebaad"
                radius={[4, 4, 0, 0]}
                name="Tasks"
              />
              <Bar
                dataKey="hours"
                fill="#6ba6d6"
                radius={[4, 4, 0, 0]}
                name="Hours"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
