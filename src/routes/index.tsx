import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChessApp } from "@/components/chess/ChessApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="font-display text-2xl text-gold">Kingside</p>
      </main>
    );
  }
  return <ChessApp />;
}
