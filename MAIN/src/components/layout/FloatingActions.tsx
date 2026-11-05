import { useState } from "react";
import { Plus, Beef, Milk, ScanSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function FloatingActions() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { icon: Beef, label: "Add Cattle", path: "/cattle" },
    { icon: Milk, label: "Record Milk", path: "/milk-production" },
    { icon: ScanSearch, label: "Recognize Breed", path: "/breed-recognition" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && actions.map((a, i) => (
        <Button
          key={i}
          size="sm"
          className="shadow-lg animate-in fade-in slide-in-from-bottom-2 transition-all duration-200"
          onClick={() => { navigate(a.path); setOpen(false); }}
        >
          <a.icon className="mr-1 h-4 w-4" /> {a.label}
        </Button>
      ))}
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg transition-transform duration-200 hover:scale-105"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </Button>
    </div>
  );
}
