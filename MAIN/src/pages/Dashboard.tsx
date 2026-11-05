import { useState } from "react";
import { Beef, Milk, HeartPulse, AlertTriangle, Plus, ScanSearch, Sparkles, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useReports, useProfile } from "@/hooks/useDairy";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";;


const Dashboard = () => {
  const navigate = useNavigate();
  
  
  const { data: reports, isLoading } = useReports();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const { error } = await supabase.functions.invoke("seed-demo-data", { method: "POST" });
      if (error) throw error;
      toast.success("Demo data loaded!");
      qc.invalidateQueries();
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to seed data");
    } finally {
      setSeeding(false);
    }
  };

  const summary = reports?.summary;
  const isEmpty = !isLoading && summary?.total_cattle === 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Welcome back, {profile?.full_name || user?.email?.split("@")[0]}! Here's your farm overview.
            </p>
          </div>
          {isEmpty && (
            <Button onClick={seedDemo} disabled={seeding} variant="secondary">
              {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Load demo data
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Cattle" value={summary?.total_cattle ?? 0} icon={Beef} trend={`${summary?.healthy ?? 0} healthy`} trendUp />
          <StatCard title="Milk (week)" value={`${summary?.week_milk ?? 0} L`} icon={Milk} trend={`${summary?.today_milk ?? 0} L today`} trendUp />
          <StatCard title="Healthy Cattle" value={summary?.healthy ?? 0} icon={HeartPulse} trend={`${summary?.at_risk ?? 0} at risk`} trendUp={(summary?.at_risk ?? 0) === 0} />
          <StatCard title="Active Alerts" value={summary?.active_alerts ?? 0} icon={AlertTriangle} trend={`${summary?.critical ?? 0} critical`} trendUp={(summary?.active_alerts ?? 0) === 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Milk Production (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={reports?.daily_milk ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tickFormatter={(d) => d.slice(5)} />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cattle Health Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={reports?.health_distribution ?? []} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {(reports?.health_distribution ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Health Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {(reports?.alerts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active alerts. All clear!</p>
              ) : (
                <div className="space-y-3">
                  {reports!.alerts.map((a: Record<string, unknown>) => (
                    <div key={a.id as string} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <AlertTriangle className={`h-4 w-4 ${a.status === "Overdue" ? "text-destructive" : "text-warning"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.condition as string}</p>
                        <p className="text-xs text-muted-foreground">Next checkup: {(a.next_checkup as string) ?? "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={() => navigate("/cattle")}>
                <Plus className="mr-2 h-4 w-4" /> Add Cattle
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/milk-production")}>
                <Milk className="mr-2 h-4 w-4" /> Record Milk
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/breed-recognition")}>
                <ScanSearch className="mr-2 h-4 w-4" /> Recognize Breed
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
