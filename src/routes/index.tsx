import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-muted-foreground">A simple starting point.</p>
        <Button asChild>
          <Link to="/login">Go to login</Link>
        </Button>
      </div>
    </main>
  );
}
