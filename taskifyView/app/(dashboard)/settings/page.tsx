import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const settingTabs = [
  { value: "model", label: "Model" },
  { value: "agent", label: "Agent" },
  { value: "data-source", label: "Data Source" },
  { value: "message-channels", label: "Message Channels" },
  { value: "mcp", label: "MCP" },
  { value: "log", label: "Log" },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure workspace-level settings and integrations
        </p>
      </div>

      <Tabs defaultValue="model" className="space-y-6">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 justify-start">
          {settingTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {settingTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">{tab.label}</CardTitle>
                  <Badge variant="secondary">Coming soon</Badge>
                </div>
                <CardDescription>
                  This section is under development and will be available soon.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-40 rounded-md border border-dashed border-border bg-muted/20" />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
