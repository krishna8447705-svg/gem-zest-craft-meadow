import { Chess } from "chess.js";

export type Grade = "Best" | "Excellent" | "Inaccuracy" | "Mistake" | "Blunder" | "Miss";

export type GradeResult = {
  grade: Grade;
  loss: number;
  bestSan: string;
  playedSan: string;
  note: string;
};

function sanOf(fen: string, uci: string): string {
  if (!uci || uci === "(none)" || uci.length < 4) return uci || "—";
  const game = new Chess(fen);
  const move = game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
  });
  return move?.san ?? uci;
}

function fmt(cp: number): string {
  const pawns = cp / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

export function gradeMove(args: {
  fenBefore: string;
  playedUci: string;
  bestUci: string;
  whiteBefore: number;
  whiteAfter: number;
  mateBefore: number | null;
  player: "w" | "b";
}): GradeResult {
  const { fenBefore, playedUci, bestUci, whiteBefore, whiteAfter, mateBefore, player } = args;
  const pov = (cp: number) => (player === "w" ? cp : -cp);
  const before = pov(whiteBefore);
  const after = pov(whiteAfter);
  const loss = Math.round(before - after);
  const bestSan = sanOf(fenBefore, bestUci);
  const playedSan = sanOf(fenBefore, playedUci);
  const same = playedUci.slice(0, 4) === bestUci.slice(0, 4);
  const missedMate = mateBefore != null && (player === "w" ? mateBefore > 0 : mateBefore < 0) && !same;

  let grade: Grade;
  if (same || loss < 15) grade = "Best";
  else if (missedMate) grade = "Miss";
  else if (loss >= 250) grade = "Blunder";
  else if (loss >= 120 && before >= 150 && after < 80) grade = "Miss";
  else if (loss >= 120) grade = "Mistake";
  else if (loss >= 50) grade = "Inaccuracy";
  else grade = "Excellent";

  const swing = `${fmt(before)} → ${fmt(after)}`;
  let note = "";
  if (grade === "Best") note = `${playedSan} is the engine's choice.`;
  else if (grade === "Excellent") note = `${playedSan} is fine. The top move was ${bestSan}.`;
  else if (grade === "Miss")
    note = missedMate
      ? `Missed mate. ${bestSan} was forced. You played ${playedSan}.`
      : `Missed the shot. ${bestSan} kept a clear edge (${swing}). ${playedSan} lets it go.`;
  else if (grade === "Blunder")
    note = `Blunder. ${playedSan} drops about ${(loss / 100).toFixed(1)} pawns (${swing}). Play ${bestSan}.`;
  else if (grade === "Mistake")
    note = `Mistake. ${playedSan} is about ${(loss / 100).toFixed(1)} worse than ${bestSan} (${swing}).`;
  else note = `Inaccuracy. ${bestSan} was cleaner than ${playedSan} (${swing}).`;

  return { grade, loss: Math.max(0, loss), bestSan, playedSan, note };
}
