import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { HealthBadge } from "@/components/HealthBadge";
import { Badge } from "@/components/ui/badge";
import { Plus, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCattle, useHealthRecords, useAddHealth, PAGE_SIZE } from "@/hooks/useDairy";

const statusColors: Record<string, string> = {
  Upcoming: "bg-info/10 text-info border-info/20",
  Overdue: "bg-destructive/10 text-destructive border-destructive/20",
  Scheduled: "bg-muted text-muted-foreground border-border",
  Completed: "bg-success/10 text-success border-success/20",
};

const HealthMonitoring = () => {
  const { data: cattle = [] } = useCattle();
  const [page, setPage] = useState(0);
  const { data: healthPage } = useHealthRecords(page);
  const records = healthPage?.rows ?? [];
  const total = healthPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const addHealth = useAddHealth();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    cattle_id: "",
    condition: "",
    treatment: "",
    vet_name: "",
    date: new Date().toISOString().slice(0, 10),
    next_checkup: "",
    status: "Scheduled",
  });

  const today = new Date().toISOString().slice(0, 10);
  const alerts = records.filter((r) => r.status !== "Completed" && (r.status === "Overdue" || (r.next_checkup && r.next_checkup <= today)));
  const unhealthy = cattle.filter((c) => c.health_status !== "Healthy");

  const handleSave = async () => {
    if (!form.cattle_id || !form.condition) return toast.error("Cattle and condition are required");
    try {
      await addHealth.mutateAsync({
        cattle_id: form.cattle_id,
        condition: form.condition,
        treatment: form.treatment || undefined,
        vet_name: form.vet_name || undefined,
        date: form.date,
        next_checkup: form.next_checkup || undefined,
        status: form.status as "Scheduled" | "Upcoming" | "Overdue" | "Completed",
      });
      setAddOpen(false);
      setForm({ ...form, condition: "", treatment: "", vet_name: "", next_checkup: "" });
      toast.success("Health record added!");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Health Monitoring</h1>
            <p className="text-sm text-muted-foreground">Track cattle health, vaccinations, and treatments</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Health Record
          </Button>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((a) => (
              <Card key={a.id} className={`border-l-4 ${a.status === "Overdue" ? "border-l-destructive" : "border-l-warning"}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Bell className={`h-4 w-4 shrink-0 ${a.status === "Overdue" ? "text-destructive" : "text-warning"}`} />
                  <p className="text-sm">
                    <span className="font-medium">{a.cattle?.name ?? "Cattle"}</span> — {a.condition}
                    {a.next_checkup && ` (next: ${a.next_checkup})`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {unhealthy.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unhealthy.map((c) => (
              <Card key={c.id} className="transition-shadow duration-200 hover:shadow-md">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.breed} · {c.age}y</p>
                  </div>
                  <HealthBadge status={c.health_status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Health & Vaccination Records</CardTitle></CardHeader>
          <CardContent className="p-0">
            {records.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No health records yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cattle</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="hidden md:table-cell">Treatment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Next Checkup</TableHead>
                    <TableHead className="hidden sm:table-cell">Vet</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.cattle?.name ?? "—"}</TableCell>
                      <TableCell>{r.condition}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.treatment ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.date}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{r.next_checkup ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.vet_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[r.status]}>{r.status}</Badge>
                      </TableCell>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Health Record</DialogTitle>
            <DialogDescription>Record a new health entry for a cattle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cattle</Label>
              <Select value={form.cattle_id} onValueChange={(v) => setForm({ ...form, cattle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select cattle" /></SelectTrigger>
                <SelectContent>{cattle.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.tag})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition / Vaccine</Label>
              <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g. FMD Vaccination" />
            </div>
            <div className="space-y-2">
              <Label>Treatment</Label>
              <Input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="e.g. Antipyretic administered" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Next Checkup</Label>
                <Input type="date" value={form.next_checkup} onChange={(e) => setForm({ ...form, next_checkup: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Veterinarian</Label>
                <Input value={form.vet_name} onChange={(e) => setForm({ ...form, vet_name: e.target.value })} placeholder="e.g. Dr. Sharma" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={addHealth.isPending}>
              {addHealth.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HealthMonitoring;
