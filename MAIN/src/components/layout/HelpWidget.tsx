import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HelpWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open && (
        <Card className="w-72 mb-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Support Chat</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
              👋 Hi! How can we help you with SmartDairy AI?
            </div>
            <div className="flex gap-2">
              <Input placeholder="Type a message..." className="h-8 text-sm" />
              <Button size="icon" className="h-8 w-8 shrink-0">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Button
        size="icon"
        variant="outline"
        className="h-10 w-10 rounded-full shadow-lg bg-card transition-transform duration-200 hover:scale-105"
        onClick={() => setOpen(!open)}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}
