import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Milk, Calendar, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useCattle, useMilkRecords, useAddMilk, useReports, PAGE_SIZE } from "@/hooks/useDairy";

const MilkProduction = () => {
  const { data: cattle = [] } = useCattle();
  const [page, setPage] = useState(0);
  const { data: milkPage } = useMilkRecords(page);
  const records = milkPage?.rows ?? [];
  const total = milkPage?.total ?? 0;
  const { data: reports } = useReports();
  const addMilk = useAddMilk();

  const [cattleId, setCattleId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [morning, setMorning] = useState("");
  const [evening, setEvening] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cattleId) return toast.error("Select a cattle");
    try {
      await addMilk.mutateAsync({
        cattle_id: cattleId,
        date,
        morning: Number(morning) || 0,
        evening: Number(evening) || 0,
        notes: notes || undefined,
      });
      toast.success("Milk record saved!");
      setMorning(""); setEvening(""); setNotes("");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message);
    }
  };

  const monthly = useMemo(() => {
    const rows = milkPage?.rows ?? [];
    const map = new Map<string, number>();
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + Number(r.total));
    }
    return Array.from(map.entries()).sort().map(([month, total]) => ({ month, total }));
  }, [milkPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Milk Production</h1>
          <p className="text-sm text-muted-foreground">Track and analyze daily milk production</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Today's Total" value={`${reports?.summary.today_milk ?? 0} L`} icon={Milk} trend="Live" trendUp />
          <StatCard title="This Week" value={`${reports?.summary.week_milk ?? 0} L`} icon={Calendar} trend="7-day total" trendUp />
          <StatCard title="This Month" value={`${reports?.summary.month_milk ?? 0} L`} icon={TrendingUp} trend="30-day total" trendUp />
          <StatCard title="Avg per Cattle" value={`${reports?.summary.avg_per_cattle ?? 0} L`} icon={BarChart3} trend="Daily avg" trendUp />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Record Daily Milk</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cattle</Label>
                  <Select value={cattleId} onValueChange={setCattleId}>
                    <SelectTrigger><SelectValue placeholder="Select cattle" /></SelectTrigger>
                    <SelectContent>
                      {cattle.filter((c) => c.gender === "Female").map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.tag})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Morning (L)</Label>
                    <Input type="number" step="0.1" value={morning} onChange={(e) => setMorning(e.target.value)} placeholder="0.0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Evening (L)</Label>
                    <Input type="number" step="0.1" value={evening} onChange={(e) => setEvening(e.target.value)} placeholder="0.0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any observations..." rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={addMilk.isPending}>
                  {addMilk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Record
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Daily Trend (30d)</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-lg">Monthly Overview</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Milk Records</CardTitle></CardHeader>
          <CardContent className="p-0">
            {records.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No milk records yet. Add your first entry above.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cattle</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Morning (L)</TableHead>
                    <TableHead>Evening (L)</TableHead>
                    <TableHead>Total (L)</TableHead>
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.cattle?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.date}</TableCell>
                      <TableCell>{r.morning}</TableCell>
                      <TableCell>{r.evening}</TableCell>
                      <TableCell className="font-medium">{r.total}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{r.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between p-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} · {total} records
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default MilkProduction;
