import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/contexts/ThemeContext";
import { User, Moon, Sun, Bell, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useDairy";

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, role } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setFarmName(profile.farm_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const save = async () => {
    try {
      await update.mutateAsync({ full_name: fullName, farm_name: farmName, phone });
      toast.success("Profile updated!");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message);
    }
  };

  const initials = (fullName || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xl font-semibold text-primary-foreground">{initials}</span>
              </div>
              <div>
                <p className="font-semibold">{fullName || "—"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                {role && <p className="text-[10px] uppercase mt-1 text-primary">{role}</p>}
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled type="email" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-4 w-4" /> Farm Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Farm Name</Label><Input value={farmName} onChange={(e) => setFarmName(e.target.value)} /></div>
            </div>
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                { key: "health_alerts", label: "Health Alerts", desc: "Get notified about cattle health issues" },
                { key: "vaccination_reminders", label: "Vaccination Reminders", desc: "Reminders for upcoming vaccinations" },
                { key: "milk_reports", label: "Milk Production Reports", desc: "Daily production summary" },
              ] as const
            ).map((n) => {
              const prefs = (profile?.notification_preferences ?? {}) as Record<string, boolean>;
              return (
                <div key={n.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch
                    checked={!!prefs[n.key]}
                    onCheckedChange={async (v) => {
                      try {
                        const health_alerts = n.key === "health_alerts" ? v : !!prefs.health_alerts;
                        const vaccination_reminders = n.key === "vaccination_reminders" ? v : !!prefs.vaccination_reminders;
                        const milk_reports = n.key === "milk_reports" ? v : !!prefs.milk_reports;
                        await update.mutateAsync({
                          notification_preferences: { health_alerts, vaccination_reminders, milk_reports },
                        });
                      } catch (e: unknown) {
                        const err = e as Error;
                        toast.error(err.message);
                      }
                    }}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Appearance</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Toggle between light and dark themes</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
