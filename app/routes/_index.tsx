import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => {
  return [
    { title: "Space Combat Game" },
    { name: "description", content: "Welcome to 2.5D Space Combat!" },
  ];
};

export default function Index() {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-900 text-white">
      <header className="flex flex-col items-center gap-9 mb-12">
        <h1 className="text-5xl font-bold">Space Combat Deluxe</h1>
        <p className="text-xl text-gray-400">Multiplayer 2.5D Mayhem!</p>
      </header>
      
      <nav className="flex flex-col items-center gap-6">
        <Link to="/lobby">
          <Button size="lg" variant="secondary" className="px-10 py-6 text-lg">
            Enter Lobby
          </Button>
        </Link>
        <Link to="/highscores"> {/* Placeholder for high scores page */}
          <Button size="lg" variant="outline" className="px-10 py-6 text-lg">
            View High Scores
          </Button>
        </Link>
      </nav>

      <footer className="absolute bottom-8 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} Bolt Industries. Pew Pew!</p>
      </footer>
    </div>
  );
}
