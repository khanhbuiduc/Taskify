"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Mail,
  Lock,
  Shield,
  LogOut,
  Loader2,
  CheckCircle2,
  Bell,
  Volume2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  useNotificationStore,
  type SoundType,
  requestBrowserNotificationPermission,
} from "@/lib/notification-store";

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    logout,
    isLoading,
    isAuthenticated,
    checkAuth,
    isInitialized,
    updateProfile,
    changePassword,
  } = useAuthStore();
  const {
    settings: notificationSettings,
    updateSettings: updateNotificationSettings,
    testSound,
    initialize: initializeNotifications,
  } = useNotificationStore();

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Browser notification permission state
  const [browserNotificationSupported, setBrowserNotificationSupported] =
    useState(false);

  useEffect(() => {
    checkAuth();
    initializeNotifications();
    // Check if browser notifications are supported
    setBrowserNotificationSupported(
      typeof window !== "undefined" && "Notification" in window,
    );
  }, [checkAuth, initializeNotifications]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isInitialized, router]);

  // Load full name when user data is available
  useEffect(() => {
    if (user) {
      setFullName(user.userName || user.email.split("@")[0] || "");
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    await updateProfile(fullName);
    setIsSavingProfile(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    const success = await changePassword(
      currentPassword,
      newPassword,
      confirmPassword,
    );
    if (success) {
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsChangingPassword(false);
  };

  const getInitials = (email: string, userName?: string) => {
    if (userName) {
      return userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = () => {
    if (user?.userName) return user.userName;
    return user?.email.split("@")[0] || "User";
  };

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account and preferences
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Update your profile information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Avatar and Basic Info */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="text-2xl font-medium bg-accent/20 text-accent">
                        {getInitials(user.email, user.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">
                        {getDisplayName()}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Full Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        disabled={isSavingProfile}
                        required
                      />
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  <Button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Email</CardTitle>
                <CardDescription>
                  Your email address information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-500 font-medium">
                      Verified
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Current Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                      <Input
                        id="currentPassword"
                        type="password"
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-10"
                        disabled={isChangingPassword}
                        required
                      />
                    </div>
                  </div>

                  {/* New Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10"
                        disabled={isChangingPassword}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Must contain: 6+ chars, 1 digit, 1 lowercase, 1 uppercase
                    </p>
                  </div>

                  {/* Confirm New Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        disabled={isChangingPassword}
                        required
                      />
                    </div>
                  </div>

                  {/* Change Password Button */}
                  <Button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing password...
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="space-y-6">
              {/* General Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications-enabled">
                        Enable Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications for task updates and reminders
                      </p>
                    </div>
                    <Switch
                      id="notifications-enabled"
                      checked={notificationSettings.enabled}
                      onCheckedChange={(checked) =>
                        updateNotificationSettings({ enabled: checked })
                      }
                    />
                  </div>

                  <Separator />

                  {/* Browser Notifications */}
                  {browserNotificationSupported && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="browser-notifications">
                            Browser Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Show desktop notifications when the tab is not
                            active
                          </p>
                        </div>
                        <Switch
                          id="browser-notifications"
                          checked={
                            notificationSettings.showBrowserNotifications
                          }
                          onCheckedChange={async (checked) => {
                            if (checked) {
                              const granted =
                                await requestBrowserNotificationPermission();
                              updateNotificationSettings({
                                showBrowserNotifications: granted,
                              });
                            } else {
                              updateNotificationSettings({
                                showBrowserNotifications: false,
                              });
                            }
                          }}
                          disabled={!notificationSettings.enabled}
                        />
                      </div>
                      <Separator />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Sound Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    Sound Settings
                  </CardTitle>
                  <CardDescription>
                    Configure notification sounds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable Sound */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sound-enabled">Enable Sound</Label>
                      <p className="text-sm text-muted-foreground">
                        Play a sound when you receive a notification
                      </p>
                    </div>
                    <Switch
                      id="sound-enabled"
                      checked={notificationSettings.soundEnabled}
                      onCheckedChange={(checked) =>
                        updateNotificationSettings({ soundEnabled: checked })
                      }
                      disabled={!notificationSettings.enabled}
                    />
                  </div>

                  <Separator />

                  {/* Sound Type */}
                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="sound-type">Sound Type</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred notification sound
                      </p>
                    </div>
                    <Select
                      value={notificationSettings.soundType}
                      onValueChange={(value: SoundType) =>
                        updateNotificationSettings({ soundType: value })
                      }
                      disabled={
                        !notificationSettings.enabled ||
                        !notificationSettings.soundEnabled
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a sound" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="chime">Chime</SelectItem>
                        <SelectItem value="bell">Bell</SelectItem>
                        <SelectItem value="subtle">Subtle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Volume Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Volume</Label>
                        <p className="text-sm text-muted-foreground">
                          Adjust notification sound volume
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {notificationSettings.volume}%
                      </span>
                    </div>
                    <Slider
                      value={[notificationSettings.volume]}
                      onValueChange={(value) =>
                        updateNotificationSettings({ volume: value[0] })
                      }
                      max={100}
                      step={5}
                      disabled={
                        !notificationSettings.enabled ||
                        !notificationSettings.soundEnabled
                      }
                      className="w-full"
                    />
                  </div>

                  <Separator />

                  {/* Test Sound Button */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Test Sound</Label>
                      <p className="text-sm text-muted-foreground">
                        Preview your notification sound
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={testSound}
                      disabled={
                        !notificationSettings.enabled ||
                        !notificationSettings.soundEnabled
                      }
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      Play Test Sound
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              {/* Two-Factor Authentication */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>
                    Disabled - Add an extra layer of security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Disabled
                    </span>
                    <Button
                      variant="outline"
                      className="bg-accent text-accent-foreground hover:bg-accent/90 border-accent"
                      disabled
                    >
                      Enable
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Sign Out */}
              <Card>
                <CardHeader>
                  <CardTitle>Sign Out</CardTitle>
                  <CardDescription>Sign out from all devices</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="destructive"
                      onClick={handleLogout}
                      disabled={isLoading}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {isLoading ? "Signing out..." : "Sign Out"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
