import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { HealthBadge } from "@/components/HealthBadge";
import { breeds } from "@/data/breed-catalog";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Search, Plus, Pencil, Trash2, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCattle, useUpsertCattle, useDeleteCattle, type CattleRow } from "@/hooks/useDairy";

type CattleFormProps = {
  form: Partial<CattleRow>;
  setForm: React.Dispatch<React.SetStateAction<Partial<CattleRow>>>;
  onSubmit: () => void;
  isEdit: boolean;
  isPending: boolean;
};

const CattleForm = ({ form, setForm, onSubmit, isEdit, isPending }: CattleFormProps) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Tag / ID</Label>
        <Input value={form.tag ?? ""} onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value }))} placeholder="C001" />
      </div>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Cattle name" />
      </div>
      <div className="space-y-2">
        <Label>Breed</Label>
        <Select value={form.breed ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, breed: v }))}>
          <SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger>
          <SelectContent>{breeds.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Age (years)</Label>
        <Input type="number" value={form.age ?? ""} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value === "" ? undefined : Number(e.target.value) }))} />
      </div>
      <div className="space-y-2">
        <Label>Gender</Label>
        <Select value={form.gender ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, gender: v as "Female" | "Male" }))}>
          <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <Input value={form.color ?? ""} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} placeholder="e.g. Brown" />
      </div>
      <div className="space-y-2">
        <Label>Health Status</Label>
        <Select value={form.health_status ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, health_status: v as "Healthy" | "At Risk" | "Critical" }))}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Healthy">Healthy</SelectItem>
            <SelectItem value="At Risk">At Risk</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Milk Yield (L/day)</Label>
        <Input type="number" step="0.1" value={form.milk_yield ?? ""} onChange={(e) => setForm((p) => ({ ...p, milk_yield: e.target.value === "" ? undefined : Number(e.target.value) }))} />
      </div>
    </div>
    <div className="space-y-2">
      <Label>Notes</Label>
      <Input value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any notes..." />
    </div>
    <DialogFooter>
      <Button onClick={onSubmit} disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Update" : "Add"} Cattle
      </Button>
    </DialogFooter>
  </div>
);

const CattleManagement = () => {
  const { data: cattle = [], isLoading } = useCattle();
  const upsert = useUpsertCattle();
  const del = useDeleteCattle();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch(q);
  }, [searchParams]);
  const [breedFilter, setBreedFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<CattleRow | null>(null);
  const [form, setForm] = useState<Partial<CattleRow>>({});

  const filtered = cattle.filter((c) => {
    if (
      search &&
      !c.name.toLowerCase().includes(search.toLowerCase()) &&
      !c.tag.toLowerCase().includes(search.toLowerCase()) &&
      !c.breed.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (breedFilter !== "all" && c.breed !== breedFilter) return false;
    if (genderFilter !== "all" && c.gender !== genderFilter) return false;
    if (healthFilter !== "all" && c.health_status !== healthFilter) return false;
    return true;
  });

  const handleAdd = async () => {
    try {
      await upsert.mutateAsync({
        tag: form.tag || `C${String(cattle.length + 1).padStart(3, "0")}`,
        name: form.name || "New Cattle",
        breed: form.breed || "Indigenous",
        age: form.age || 1,
        gender: (form.gender as "Female" | "Male") || "Female",
        color: form.color || null,
        health_status: form.health_status || "Healthy",
        milk_yield: form.milk_yield || 0,
        notes: form.notes || null,
      });
      setAddOpen(false);
      setForm({});
      toast.success("Cattle added!");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    try {
      await upsert.mutateAsync({ id: selected.id, ...form });
      setEditOpen(false);
      setForm({});
      toast.success("Cattle updated!");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await del.mutateAsync(selected.id);
      setDeleteOpen(false);
      setSelected(null);
      toast.success("Cattle removed!");
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
            <h1 className="text-2xl font-bold">Cattle Management</h1>
            <p className="text-sm text-muted-foreground">Manage your livestock records</p>
          </div>
          <Button onClick={() => { setForm({}); setAddOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Cattle
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, tag, or breed..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setSearchParams(e.target.value ? { q: e.target.value } : {}); }} />
              </div>
              <Select value={breedFilter} onValueChange={setBreedFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Breed" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Breeds</SelectItem>
                  {breeds.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                </SelectContent>
              </Select>
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Health" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Healthy">Healthy</SelectItem>
                  <SelectItem value="At Risk">At Risk</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">No cattle records found</p>
                <p className="text-sm">Add your first cattle to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Breed</TableHead>
                    <TableHead className="hidden md:table-cell">Age</TableHead>
                    <TableHead className="hidden sm:table-cell">Gender</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="hidden lg:table-cell">Milk (L/day)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.tag}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.breed}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.age}y</TableCell>
                      <TableCell className="hidden sm:table-cell">{c.gender}</TableCell>
                      <TableCell><HealthBadge status={c.health_status} /></TableCell>
                      <TableCell className="hidden lg:table-cell">{c.milk_yield}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelected(c); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelected(c); setForm(c); setEditOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelected(c); setDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Cattle</DialogTitle>
            <DialogDescription>Fill in the details for the new cattle.</DialogDescription>
          </DialogHeader>
          <CattleForm form={form} setForm={setForm} onSubmit={handleAdd} isEdit={false} isPending={upsert.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cattle</DialogTitle>
            <DialogDescription>Update cattle information.</DialogDescription>
          </DialogHeader>
          <CattleForm form={form} setForm={setForm} onSubmit={handleEdit} isEdit isPending={upsert.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>Are you sure you want to remove {selected?.name} ({selected?.tag})? This will also delete all related milk and health records.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
              {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4">
              {[
                ["Tag", selected.tag],
                ["Breed", selected.breed],
                ["Age", `${selected.age} years`],
                ["Gender", selected.gender],
                ["Color", selected.color || "—"],
                ["Milk Yield", `${selected.milk_yield} L/day`],
                ["Purchase Date", selected.purchase_date || "—"],
                ["Notes", selected.notes || "—"],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground text-sm">{label}</span>
                  <span className="font-medium text-sm text-right max-w-[60%]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground text-sm">Health</span>
                <HealthBadge status={selected.health_status} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default CattleManagement;
