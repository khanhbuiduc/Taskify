import { Sparkles } from "lucide-react";

export default function EventsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6">
      <div className="h-24 w-24 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
        <Sparkles className="h-12 w-12 text-accent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Events</h2>
        <p className="text-muted-foreground text-lg max-w-[500px] mx-auto">
          We are working hard to bring this feature to you. Stay tuned for updates!
        </p>
      </div>
    </div>
  );
}
