import { Badge } from "@/components/ui/badge";

export function HealthBadge({ status }: { status: "Healthy" | "At Risk" | "Critical" }) {
  const styles = {
    Healthy: "bg-success/10 text-success border-success/20 hover:bg-success/20",
    "At Risk": "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
    Critical: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
  };

  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}
