import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsAccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and preferences
        </p>
      </div>
      <SettingsView />
    </div>
  );
}
