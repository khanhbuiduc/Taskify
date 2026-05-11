import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const settingTabs = [
  { value: "model", label: "Model" },
  { value: "agent", label: "Agent" },
  { value: "data-source", label: "Data Source" },
  { value: "message-channels", label: "Message Channels" },
  { value: "mcp", label: "MCP" },
  { value: "log", label: "Log" },
] as const;

const modelTabs = [
  { value: "local", label: "Local" },
  { value: "download", label: "Download" },
  { value: "cloud", label: "Cloud" },
] as const;

function ComingSoonCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <CardDescription>
          This section is under development and will be available soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-40 rounded-md border border-dashed border-border bg-muted/20" />
      </CardContent>
    </Card>
  );
}

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
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:text-green-600"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">Model</CardTitle>
                <Tabs defaultValue="local">
                  <TabsList>
                    {modelTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="data-[state=active]:text-green-600"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
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

        {settingTabs
          .filter((tab) => tab.value !== "model")
          .map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <ComingSoonCard title={tab.label} />
            </TabsContent>
          ))}
      </Tabs>
    </div>
  );
}
