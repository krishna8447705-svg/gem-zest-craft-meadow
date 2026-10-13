import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { Stockfish } from "@/lib/chess/engine";
import { gradeMove, type Grade, type GradeResult } from "@/lib/chess/grade";
import { Piece } from "@/components/chess/Piece";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

const MARK: Partial<Record<Grade, string>> = {
  Inaccuracy: "?!",
  Mistake: "?",
  Blunder: "??",
  Miss: "!",
};

const MARK_BG: Partial<Record<Grade, string>> = {
  Inaccuracy: "bg-inacc text-bg",
  Mistake: "bg-mistake text-bg",
  Blunder: "bg-blunder text-bg",
  Miss: "bg-miss text-bg",
};

const TIMES = [
  { id: "1", label: "1 min", sec: 60 },
  { id: "3", label: "3 min", sec: 180 },
  { id: "5", label: "5 min", sec: 300 },
  { id: "10", label: "10 min", sec: 600 },
  { id: "15", label: "15 min", sec: 900 },
  { id: "30", label: "30 min", sec: 1800 },
  { id: "0", label: "Unlimited", sec: 0 },
];

type LogMove = { san: string; grade?: Grade };

const GRADE_CLASS: Record<Grade, string> = {
  Best: "text-good",
  Excellent: "text-good",
  Inaccuracy: "text-inacc",
  Mistake: "text-mistake",
  Blunder: "text-blunder",
  Miss: "text-miss",
};

function fmtClock(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function engineUrl() {
  const prefix =
    typeof window === "undefined"
      ? ""
      : (previewPathPrefix(window.location.hostname, window.location.pathname) ?? "");
  return `${prefix}/stockfish.js`;
}

export function ChessApp() {
  const gameRef = useRef(new Chess());
  const playRef = useRef<Stockfish | null>(null);
  const coachRef = useRef<Stockfish | null>(null);
  const lock = useRef(Promise.resolve());
  const clocks = useRef({ w: 180, b: 180 });
  const lastTick = useRef<number | null>(null);
  const timed = useRef(true);
  const playerRef = useRef<"w" | "b">("w");
  const searchGen = useRef(0);

  const [fen, setFen] = useState(gameRef.current.fen());
  const [player, setPlayer] = useState<"w" | "b">("w");
  const [timeId, setTimeId] = useState("3");
  const [selected, setSelected] = useState<Square | null>(null);
  const [status, setStatus] = useState("Engine loading…");
  const [thinking, setThinking] = useState(false);
  const [ready, setReady] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [coach, setCoach] = useState<GradeResult | null>(null);
  const [log, setLog] = useState<LogMove[]>([]);
  const [clockW, setClockW] = useState(180);
  const [clockB, setClockB] = useState(180);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [started, setStarted] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [slide, setSlide] = useState<{ id: number; code: string; from: Square; to: Square; go: boolean } | null>(null);
  const [mark, setMark] = useState<{ sq: Square; grade: Grade } | null>(null);

  const orientation = player === "w" ? RANKS : [...RANKS].reverse();
  const files = player === "w" ? FILES : [...FILES].reverse();

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    const moves = gameRef.current.moves({ square: selected, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [selected, fen]);

  const fly = useCallback((from: Square, to: Square, code: string) => {
    const id = Date.now();
    setSlide({ id, code, from, to, go: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSlide((s) => (s && s.id === id ? { ...s, go: true } : s));
      });
    });
    window.setTimeout(() => {
      setSlide((s) => (s && s.id === id ? null : s));
    }, 300);
  }, []);

  const sync = useCallback(() => {
    setFen(gameRef.current.fen());
  }, []);

  const checkEnd = useCallback((g: Chess): string | null => {
    if (g.isCheckmate()) return g.turn() === "w" ? "Black wins by checkmate" : "White wins by checkmate";
    if (g.isStalemate()) return "Draw by stalemate";
    if (g.isThreefoldRepetition()) return "Draw by repetition";
    if (g.isInsufficientMaterial()) return "Draw by insufficient material";
    if (g.isDraw()) return "Draw";
    return null;
  }, []);

  const enqueue = useCallback(<T,>(fn: () => Promise<T>) => {
    const run = lock.current.then(fn, fn);
    lock.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  useEffect(() => {
    const url = engineUrl();
    const play = new Stockfish(url, [
      "setoption name UCI_LimitStrength value true",
      "setoption name UCI_Elo value 2500",
    ]);
    const coachE = new Stockfish(url, ["setoption name Skill Level value 20"]);
    playRef.current = play;
    coachRef.current = coachE;
    let dead = false;
    Promise.all([play.ready, coachE.ready])
      .then(() => {
        if (!dead) {
          setReady(true);
          setStatus("Pick a clock and color, then start.");
        }
      })
      .catch(() => {
        if (!dead) setStatus("Engine failed to load. Refresh the page.");
      });
    return () => {
      dead = true;
      play.dispose();
      coachE.dispose();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (started && !over && timed.current && lastTick.current != null) {
        const dt = Math.min(0.25, (now - lastTick.current) / 1000);
        const turn = gameRef.current.turn();
        if (!thinking || turn !== playerRef.current) {
          clocks.current[turn] = Math.max(0, clocks.current[turn] - dt);
          setClockW(clocks.current.w);
          setClockB(clocks.current.b);
          if (clocks.current[turn] <= 0) {
            setOver(turn === "w" ? "Black wins on time" : "White wins on time");
          }
        }
      }
      lastTick.current = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, over, thinking]);

  const botMove = useCallback(async () => {
    const play = playRef.current;
    if (!play) return;
    const gen = ++searchGen.current;
    setThinking(true);
    setStatus("Kingside is thinking…");
    const fenNow = gameRef.current.fen();
    const budget = timed.current
      ? Math.min(4000, Math.max(400, clocks.current[gameRef.current.turn()] * 80))
      : 1600;
    try {
      const result = await play.search(fenNow, `go movetime ${Math.round(budget)}`);
      if (gen !== searchGen.current) return;
      if (!result.best || result.best === "(none)") return;
      const g = gameRef.current;
      const mv = g.move({
        from: result.best.slice(0, 2),
        to: result.best.slice(2, 4),
        promotion: (result.best[4] as "q") || "q",
      });
      if (!mv) return;
      setLastMove({ from: mv.from, to: mv.to });
      fly(mv.from, mv.to, mv.color + (mv.promotion ?? mv.piece));
      setLog((prev) => [...prev, { san: mv.san }]);
      sync();
      const end = checkEnd(g);
      if (end) {
        setOver(end);
        setStatus(end);
      } else {
        setStatus(g.inCheck() ? "Check." : "Your move.");
      }
    } catch {
      if (gen === searchGen.current) setStatus("The engine stalled. Try New game.");
    } finally {
      if (gen === searchGen.current) setThinking(false);
    }
  }, [checkEnd, fly, sync]);

  const review = useCallback(async (fenBefore: string, fenAfter: string, playedUci: string, who: "w" | "b", ply: number) => {
    const coachE = coachRef.current;
    if (!coachE) return;
    try {
      const baseline = await coachE.search(fenBefore, "go depth 10");
      const after = await coachE.search(fenAfter, "go depth 10");
      const graded = gradeMove({
        fenBefore,
        playedUci,
        bestUci: baseline.best,
        whiteBefore: baseline.whiteCp,
        whiteAfter: after.whiteCp,
        mateBefore: baseline.mate,
        player: who,
      });
      setCoach(graded);
      const toSq = playedUci.slice(2, 4) as Square;
      setMark(MARK[graded.grade] ? { sq: toSq, grade: graded.grade } : null);
      setLog((prev) => prev.map((m, i) => (i === ply - 1 ? { ...m, grade: graded.grade } : m)));
    } catch {
      /* coach is best-effort */
    }
  }, []);

  const applyPlayerMove = useCallback(
    (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
      const g = gameRef.current;
      if (g.turn() !== playerRef.current || thinking || over) return;
      const fenBefore = g.fen();
      const moving = g.get(from);
      const rank = to[1];
      if (moving?.type === "p" && (rank === "8" || rank === "1") && !promotion) {
        setPromo({ from, to });
        setSelected(null);
        return;
      }
      const mv = g.move({ from, to, promotion: promotion ?? "q" });
      if (!mv) return;
      setPromo(null);
      setSelected(null);
      setLastMove({ from: mv.from, to: mv.to });
      fly(mv.from, mv.to, mv.color + (mv.promotion ?? mv.piece));
      setLog((prev) => [...prev, { san: mv.san }]);
      const ply = g.history().length;
      const fenAfter = g.fen();
      sync();
      const uci = `${from}${to}${mv.promotion ?? ""}`;
      const end = checkEnd(g);
      if (end) {
        setOver(end);
        setStatus(end);
      }
      void review(fenBefore, fenAfter, uci, playerRef.current, ply);
      if (!end) void enqueue(() => botMove());
    },
    [botMove, checkEnd, enqueue, fly, over, review, sync, thinking],
  );

  const onSquare = (sq: Square) => {
    if (!started || over || thinking) return;
    if (gameRef.current.turn() !== player) return;
    if (selected && legalTargets.has(sq)) {
      applyPlayerMove(selected, sq);
      return;
    }
    const piece = gameRef.current.get(sq);
    if (piece && piece.color === player) setSelected(sq);
    else setSelected(null);
  };

  const start = () => {
    if (!ready) return;
    searchGen.current++;
    const g = new Chess();
    gameRef.current = g;
    playerRef.current = player;
    const spec = TIMES.find((t) => t.id === timeId) ?? TIMES[1];
    timed.current = spec.sec > 0;
    const base = spec.sec || 0;
    clocks.current = { w: base, b: base };
    setClockW(base);
    setClockB(base);
    setLog([]);
    setCoach(null);
    setMark(null);
    setOver(null);
    setSelected(null);
    setPromo(null);
    setLastMove(null);
    setSlide(null);
    setMark(null);
    setStarted(true);
    sync();
    if (player === "b") {
      setStatus("Kingside is thinking…");
      void enqueue(() => botMove());
    } else {
      setStatus("Your move. The coach grades every move you play.");
    }
  };

  const undo = () => {
    if (!started || thinking) return;
    const g = gameRef.current;
    if (g.history().length === 0) return;
    searchGen.current++;
    g.undo();
    if (g.turn() !== playerRef.current && g.history().length > 0) g.undo();
    setOver(null);
    setCoach(null);
    setMark(null);
    setSelected(null);
    setPromo(null);
    const hist = g.history({ verbose: true });
    const last = hist[hist.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
    setLog((prev) => prev.slice(0, g.history().length));
    sync();
    setStatus("Undone. Your move.");
  };

  const resign = () => {
    if (!started || over) return;
    const msg = player === "w" ? "You resigned. Black wins." : "You resigned. White wins.";
    setOver(msg);
    setStatus(msg);
  };

  const turn = gameRef.current.turn();
  const boardTurnLabel = turn === "w" ? "White" : "Black";
  const slideBox = slide
    ? {
        fx: files.indexOf(slide.from[0] as (typeof FILES)[number]),
        fy: orientation.indexOf(slide.from[1] as (typeof RANKS)[number]),
        tx: files.indexOf(slide.to[0] as (typeof FILES)[number]),
        ty: orientation.indexOf(slide.to[1] as (typeof RANKS)[number]),
      }
    : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-sm tracking-wide text-gold">2500 Elo coach</p>
          <h1 className="font-display text-4xl leading-none text-fg">Kingside</h1>
        </div>
        <p className="max-w-sm text-sm text-muted">
          A limit-strength Stockfish that plays about 2500 and marks every one of your moves.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted" htmlFor="time">
          Clock
        </label>
        <select
          id="time"
          value={timeId}
          disabled={started && !over}
          onChange={(e) => setTimeId(e.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-3 text-fg"
        >
          {TIMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="text-sm text-muted" htmlFor="color">
          Color
        </label>
        <select
          id="color"
          value={player}
          disabled={started && !over}
          onChange={(e) => setPlayer(e.target.value as "w" | "b")}
          className="h-11 rounded-lg border border-border bg-surface px-3 text-fg"
        >
          <option value="w">White</option>
          <option value="b">Black</option>
        </select>
        <button
          type="button"
          onClick={start}
          disabled={!ready}
          className="h-11 rounded-lg bg-gold px-4 font-medium text-bg"
        >
          {started && !over ? "New game" : "Start"}
        </button>
        <button type="button" onClick={undo} disabled={!started || thinking} className="h-11 rounded-lg border border-border bg-surface px-4">
          Undo
        </button>
        <button type="button" onClick={resign} disabled={!started || !!over} className="h-11 rounded-lg border border-border bg-surface px-4">
          Resign
        </button>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="mx-auto w-full max-w-xl">
          <ClockBar
            label={player === "w" ? "Kingside" : "You"}
            time={player === "w" ? clockB : clockW}
            active={started && !over && turn !== player}
            unlimited={!timed.current}
          />
          <CoachStrip coach={coach} thinking={thinking} />
          <div className="relative mt-2 rounded-2xl border-4 border-gold-dim bg-surface-2 p-2 shadow-[inset_0_0_0_1px_rgba(196,163,90,0.35)]">
            <div className="relative grid grid-cols-8 overflow-hidden rounded-lg">
              {orientation.map((rank, r) =>
                files.map((file, f) => {
                  const sq = `${file}${rank}` as Square;
                  const dark = (FILES.indexOf(file) + Number(rank)) % 2 === 0;
                  const piece = gameRef.current.get(sq);
                  const code = piece ? piece.color + piece.type : "";
                  const hidden = slide?.to === sq;
                  const isSel = selected === sq;
                  const isTarget = legalTargets.has(sq);
                  const isLast = lastMove?.from === sq || lastMove?.to === sq;
                  const flagged = mark?.sq === sq ? mark.grade : undefined;
                  return (
                    <button
                      key={sq}
                      type="button"
                      aria-label={sq}
                      onClick={() => onSquare(sq)}
                      className={`relative flex aspect-square items-center justify-center ${
                        dark ? "bg-darksq" : "bg-light"
                      } ${isSel ? "outline outline-2 outline-gold" : ""}`}
                    >
                      {isLast && <span className="pointer-events-none absolute inset-0 bg-gold/20" />}
                      {flagged && <span className={`pointer-events-none absolute inset-0 ${flagged === "Blunder" ? "bg-blunder/30" : flagged === "Mistake" ? "bg-mistake/30" : flagged === "Miss" ? "bg-miss/30" : "bg-inacc/30"}`} />}
                      {isTarget && !code && (
                        <span className="pointer-events-none absolute m-auto h-3 w-3 rounded-full bg-gold/80" />
                      )}
                      {isTarget && code && (
                        <span className="pointer-events-none absolute inset-1 rounded-full border-2 border-gold/80" />
                      )}
                      {code && !hidden && <Piece code={code} />}
                      {flagged && MARK[flagged] && (
                        <span className={`mark-pop pointer-events-none absolute top-0.5 right-0.5 rounded px-1 text-[10px] font-semibold leading-4 ${MARK_BG[flagged]}`}>
                          {MARK[flagged]}
                        </span>
                      )}
                      {f === 0 && (
                        <span className={`absolute top-0.5 left-1 text-[10px] font-medium ${dark ? "text-light" : "text-darksq"}`}>
                          {rank}
                        </span>
                      )}
                      {r === orientation.length - 1 && (
                        <span className={`absolute right-1 bottom-0 text-[10px] font-medium ${dark ? "text-light" : "text-darksq"}`}>
                          {file}
                        </span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>
            {slide && slideBox && (
              <div
                className="piece-slide pointer-events-none absolute z-10 flex aspect-square items-center justify-center"
                style={{
                  left: `calc(0.5rem + ${slideBox.fx} * (100% - 1rem) / 8)`,
                  top: `calc(0.5rem + ${slideBox.fy} * (100% - 1rem) / 8)`,
                  width: "calc((100% - 1rem) / 8)",
                  transform: slide.go
                    ? `translate(${(slideBox.tx - slideBox.fx) * 100}%, ${(slideBox.ty - slideBox.fy) * 100}%)`
                    : "translate(0,0)",
                }}
              >
                <Piece code={slide.code} />
              </div>
            )}
          </div>
          <ClockBar
            label={player === "w" ? "You" : "Kingside"}
            time={player === "w" ? clockW : clockB}
            active={started && !over && turn === player}
            unlimited={!timed.current}
          />
          {promo && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-muted">Promote</span>
              {(["q", "r", "b", "n"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-light"
                  onClick={() => applyPlayerMove(promo.from, promo.to, p)}
                >
                  <Piece code={player + p} />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs tracking-wide text-muted uppercase">Position</p>
            <p className="mt-1 font-medium">
              {over ?? `${boardTurnLabel} to move`}
              {thinking && <span className="thinking-dot ml-2 inline-block h-2 w-2 rounded-full bg-gold" />}
            </p>
            <p className="mt-1 text-sm text-muted">{status}</p>
            {gameRef.current.inCheck() && !over && <p className="mt-1 text-sm text-blunder">Check</p>}
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border border-border bg-surface p-4">
            <p className="text-xs tracking-wide text-muted uppercase">Moves</p>
            <ol className="mt-2 space-y-1 text-sm">
              {Array.from({ length: Math.ceil(log.length / 2) }, (_, i) => {
                const w = log[i * 2];
                const b = log[i * 2 + 1];
                return (
                  <li key={i} className="grid grid-cols-[1.5rem_1fr_1fr] gap-2">
                    <span className="text-muted">{i + 1}.</span>
                    <MoveCell move={w} />
                    <MoveCell move={b} />
                  </li>
                );
              })}
              {log.length === 0 && <li className="text-muted">No moves yet.</li>}
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

function CoachStrip({ coach, thinking }: { coach: GradeResult | null; thinking: boolean }) {
  return (
    <div className="mt-2 min-h-16 rounded-xl border border-border bg-surface px-3 py-2">
      {coach ? (
        <p className="text-sm">
          <span className={`font-display text-lg ${GRADE_CLASS[coach.grade]}`}>{coach.grade}</span>
          <span className="text-fg"> {coach.note}</span>
        </p>
      ) : (
        <p className="text-sm text-muted">
          {thinking ? "Coach is reading the position…" : "Your grades show up here, above the board, after each move."}
        </p>
      )}
    </div>
  );
}

function MoveCell({ move }: { move?: LogMove }) {
  if (!move) return <span />;
  return <span className={move.grade ? GRADE_CLASS[move.grade] : "text-fg"}>{move.san}</span>;
}

function ClockBar({
  label,
  time,
  active,
  unlimited,
}: {
  label: string;
  time: number;
  active: boolean;
  unlimited: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
        active ? "bg-gold text-bg" : "bg-surface text-fg"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="font-display text-2xl tabular-nums">{unlimited ? "∞" : fmtClock(time)}</span>
    </div>
  );
}
