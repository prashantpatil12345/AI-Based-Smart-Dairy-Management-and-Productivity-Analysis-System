import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useReports } from "@/hooks/useDairy";

const Reports = () => {
  const { data: reports } = useReports();
  const summary = reports?.summary;

  const downloadCsv = () => {
    if (!reports) return;
    const rows = [["date", "total_liters"], ...(reports.daily_milk.map((d) => [d.date, String(d.total)]))];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartdairy-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const insights = [
    { icon: TrendingUp, title: `${summary?.week_milk ?? 0} L this week`, desc: `Average ${summary?.avg_per_cattle ?? 0} L per cattle per day`, positive: true },
    { icon: AlertTriangle, title: `${summary?.active_alerts ?? 0} active alerts`, desc: `${summary?.critical ?? 0} critical, ${summary?.at_risk ?? 0} at risk`, positive: (summary?.active_alerts ?? 0) === 0 },
    { icon: BarChart3, title: `${summary?.total_cattle ?? 0} cattle`, desc: `${summary?.healthy ?? 0} healthy in your herd`, positive: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">Comprehensive farm analytics and insights</p>
          </div>
          <Button onClick={downloadCsv}>
            <Download className="mr-1 h-4 w-4" /> Download Report
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {insights.map((ins, i) => (
            <Card key={i} className="transition-shadow duration-200 hover:shadow-md">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${ins.positive ? "bg-success/10" : "bg-warning/10"}`}>
                  <ins.icon className={`h-4 w-4 ${ins.positive ? "text-success" : "text-warning"}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">{ins.title}</p>
                  <p className="text-xs text-muted-foreground">{ins.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Milk Yield Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={reports?.daily_milk ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                  <YAxis />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Health Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={reports?.health_distribution ?? []} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}>
                    {(reports?.health_distribution ?? []).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Breed Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={reports?.breed_distribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="breed" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Daily Production (filled)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={reports?.daily_milk ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                  <YAxis />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
