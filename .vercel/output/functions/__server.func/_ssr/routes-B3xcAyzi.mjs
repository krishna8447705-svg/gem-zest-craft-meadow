import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as previewPathPrefix } from "./router-CXSYcXqx.mjs";
import { t as Chess } from "../_libs/chess.js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B3xcAyzi.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Stockfish = class {
	worker;
	waiter = null;
	buffer = [];
	ready;
	constructor(url, options) {
		this.worker = new Worker(url);
		this.worker.onmessage = (e) => {
			const line = typeof e.data === "string" ? e.data : String(e.data);
			if (this.waiter) this.waiter(line);
			else this.buffer.push(line);
		};
		this.ready = this.boot(options);
	}
	send(cmd) {
		this.worker.postMessage(cmd);
	}
	nextLine(timeoutMs) {
		const queued = this.buffer.shift();
		if (queued) return Promise.resolve(queued);
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiter = null;
				reject(/* @__PURE__ */ new Error("engine timeout"));
			}, timeoutMs);
			this.waiter = (line) => {
				clearTimeout(timer);
				this.waiter = null;
				resolve(line);
			};
		});
	}
	async boot(options) {
		this.send("uci");
		for (;;) if (await this.nextLine(2e4) === "uciok") break;
		for (const opt of options) this.send(opt);
		this.send("isready");
		for (;;) if (await this.nextLine(2e4) === "readyok") break;
	}
	chain = Promise.resolve();
	async search(fen, go) {
		const run = this.chain.then(() => this.searchNow(fen, go));
		this.chain = run.then(() => void 0, () => void 0);
		return run;
	}
	async searchNow(fen, go) {
		await this.ready;
		this.buffer = [];
		this.send("stop");
		this.send(`position fen ${fen}`);
		this.send(go);
		let cp = 0;
		let mate = null;
		let pv = "";
		const stm = fen.split(" ")[1] === "b" ? "b" : "w";
		for (;;) {
			const line = await this.nextLine(45e3);
			if (line.startsWith("info ") && line.includes(" score ") && !line.includes(" lowerbound") && !line.includes(" upperbound")) {
				const score = line.match(/score (cp|mate) (-?\d+)/);
				if (score && (line.includes(" multipv 1") || !line.includes(" multipv "))) {
					if (score[1] === "cp") {
						cp = Number(score[2]);
						mate = null;
					} else {
						mate = Number(score[2]);
						cp = mate > 0 ? 1e4 : -1e4;
					}
					const pvMatch = line.match(/ pv (.+)$/);
					if (pvMatch) pv = pvMatch[1];
				}
			}
			if (line.startsWith("bestmove")) return {
				best: line.split(/\s+/)[1] ?? "",
				whiteCp: stm === "w" ? cp : -cp,
				mate: mate == null ? null : stm === "w" ? mate : -mate,
				pv
			};
		}
	}
	stop() {
		this.send("stop");
	}
	dispose() {
		this.send("quit");
		this.worker.terminate();
	}
};
function sanOf(fen, uci) {
	if (!uci || uci === "(none)" || uci.length < 4) return uci || "—";
	return new Chess(fen).move({
		from: uci.slice(0, 2),
		to: uci.slice(2, 4),
		promotion: uci[4]
	})?.san ?? uci;
}
function fmt(cp) {
	const pawns = cp / 100;
	return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}
function gradeMove(args) {
	const { fenBefore, playedUci, bestUci, whiteBefore, whiteAfter, mateBefore, player } = args;
	const pov = (cp) => player === "w" ? cp : -cp;
	const before = pov(whiteBefore);
	const after = pov(whiteAfter);
	const loss = Math.round(before - after);
	const bestSan = sanOf(fenBefore, bestUci);
	const playedSan = sanOf(fenBefore, playedUci);
	const same = playedUci.slice(0, 4) === bestUci.slice(0, 4);
	const missedMate = mateBefore != null && (player === "w" ? mateBefore > 0 : mateBefore < 0) && !same;
	let grade;
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
	else if (grade === "Miss") note = missedMate ? `Missed mate. ${bestSan} was forced. You played ${playedSan}.` : `Missed the shot. ${bestSan} kept a clear edge (${swing}). ${playedSan} lets it go.`;
	else if (grade === "Blunder") note = `Blunder. ${playedSan} drops about ${(loss / 100).toFixed(1)} pawns (${swing}). Play ${bestSan}.`;
	else if (grade === "Mistake") note = `Mistake. ${playedSan} is about ${(loss / 100).toFixed(1)} worse than ${bestSan} (${swing}).`;
	else note = `Inaccuracy. ${bestSan} was cleaner than ${playedSan} (${swing}).`;
	return {
		grade,
		loss: Math.max(0, loss),
		bestSan,
		playedSan,
		note
	};
}
var FILES = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h"
];
var RANKS = [
	"8",
	"7",
	"6",
	"5",
	"4",
	"3",
	"2",
	"1"
];
var GLYPH = {
	wk: "♔",
	wq: "♕",
	wr: "♖",
	wb: "♗",
	wn: "♘",
	wp: "♙",
	bk: "♚",
	bq: "♛",
	br: "♜",
	bb: "♝",
	bn: "♞",
	bp: "♟"
};
var TIMES = [
	{
		id: "1",
		label: "1 min",
		sec: 60
	},
	{
		id: "3",
		label: "3 min",
		sec: 180
	},
	{
		id: "5",
		label: "5 min",
		sec: 300
	},
	{
		id: "10",
		label: "10 min",
		sec: 600
	},
	{
		id: "15",
		label: "15 min",
		sec: 900
	},
	{
		id: "30",
		label: "30 min",
		sec: 1800
	},
	{
		id: "0",
		label: "Unlimited",
		sec: 0
	}
];
var GRADE_CLASS = {
	Best: "text-good",
	Excellent: "text-good",
	Inaccuracy: "text-inacc",
	Mistake: "text-mistake",
	Blunder: "text-blunder",
	Miss: "text-miss"
};
function fmtClock(sec) {
	const s = Math.max(0, Math.ceil(sec));
	return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
function engineUrl() {
	return `${typeof window === "undefined" ? "" : previewPathPrefix(window.location.hostname, window.location.pathname) ?? ""}/stockfish.js`;
}
function ChessApp() {
	const gameRef = (0, import_react.useRef)(new Chess());
	const playRef = (0, import_react.useRef)(null);
	const coachRef = (0, import_react.useRef)(null);
	const lock = (0, import_react.useRef)(Promise.resolve());
	const clocks = (0, import_react.useRef)({
		w: 180,
		b: 180
	});
	const lastTick = (0, import_react.useRef)(null);
	const timed = (0, import_react.useRef)(true);
	const playerRef = (0, import_react.useRef)("w");
	const searchGen = (0, import_react.useRef)(0);
	const [fen, setFen] = (0, import_react.useState)(gameRef.current.fen());
	const [player, setPlayer] = (0, import_react.useState)("w");
	const [timeId, setTimeId] = (0, import_react.useState)("3");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)("Engine loading…");
	const [thinking, setThinking] = (0, import_react.useState)(false);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [over, setOver] = (0, import_react.useState)(null);
	const [coach, setCoach] = (0, import_react.useState)(null);
	const [log, setLog] = (0, import_react.useState)([]);
	const [clockW, setClockW] = (0, import_react.useState)(180);
	const [clockB, setClockB] = (0, import_react.useState)(180);
	const [promo, setPromo] = (0, import_react.useState)(null);
	const [started, setStarted] = (0, import_react.useState)(false);
	const [lastMove, setLastMove] = (0, import_react.useState)(null);
	const orientation = player === "w" ? RANKS : [...RANKS].reverse();
	const files = player === "w" ? FILES : [...FILES].reverse();
	const legalTargets = (0, import_react.useMemo)(() => {
		if (!selected) return /* @__PURE__ */ new Set();
		const moves = gameRef.current.moves({
			square: selected,
			verbose: true
		});
		return new Set(moves.map((m) => m.to));
	}, [selected, fen]);
	const sync = (0, import_react.useCallback)(() => {
		setFen(gameRef.current.fen());
	}, []);
	const checkEnd = (0, import_react.useCallback)((g) => {
		if (g.isCheckmate()) return g.turn() === "w" ? "Black wins by checkmate" : "White wins by checkmate";
		if (g.isStalemate()) return "Draw by stalemate";
		if (g.isThreefoldRepetition()) return "Draw by repetition";
		if (g.isInsufficientMaterial()) return "Draw by insufficient material";
		if (g.isDraw()) return "Draw";
		return null;
	}, []);
	const enqueue = (0, import_react.useCallback)((fn) => {
		const run = lock.current.then(fn, fn);
		lock.current = run.then(() => void 0, () => void 0);
		return run;
	}, []);
	(0, import_react.useEffect)(() => {
		const url = engineUrl();
		const play = new Stockfish(url, ["setoption name UCI_LimitStrength value true", "setoption name UCI_Elo value 2500"]);
		const coachE = new Stockfish(url, ["setoption name Skill Level value 20"]);
		playRef.current = play;
		coachRef.current = coachE;
		let dead = false;
		Promise.all([play.ready, coachE.ready]).then(() => {
			if (!dead) {
				setReady(true);
				setStatus("Pick a clock and color, then start.");
			}
		}).catch(() => {
			if (!dead) setStatus("Engine failed to load. Refresh the page.");
		});
		return () => {
			dead = true;
			play.dispose();
			coachE.dispose();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		let raf = 0;
		const loop = (now) => {
			if (started && !over && timed.current && lastTick.current != null) {
				const dt = Math.min(.25, (now - lastTick.current) / 1e3);
				const turn = gameRef.current.turn();
				if (!thinking || turn !== playerRef.current) {
					clocks.current[turn] = Math.max(0, clocks.current[turn] - dt);
					setClockW(clocks.current.w);
					setClockB(clocks.current.b);
					if (clocks.current[turn] <= 0) setOver(turn === "w" ? "Black wins on time" : "White wins on time");
				}
			}
			lastTick.current = now;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [
		started,
		over,
		thinking
	]);
	const botMove = (0, import_react.useCallback)(async () => {
		const play = playRef.current;
		if (!play) return;
		const gen = ++searchGen.current;
		setThinking(true);
		setStatus("Kingside is thinking…");
		const fenNow = gameRef.current.fen();
		const budget = timed.current ? Math.min(4e3, Math.max(400, clocks.current[gameRef.current.turn()] * 80)) : 1600;
		try {
			const result = await play.search(fenNow, `go movetime ${Math.round(budget)}`);
			if (gen !== searchGen.current) return;
			if (!result.best || result.best === "(none)") return;
			const g = gameRef.current;
			const mv = g.move({
				from: result.best.slice(0, 2),
				to: result.best.slice(2, 4),
				promotion: result.best[4] || "q"
			});
			if (!mv) return;
			setLastMove({
				from: mv.from,
				to: mv.to
			});
			setLog((prev) => [...prev, { san: mv.san }]);
			sync();
			const end = checkEnd(g);
			if (end) {
				setOver(end);
				setStatus(end);
			} else setStatus(g.inCheck() ? "Check." : "Your move.");
		} catch {
			if (gen === searchGen.current) setStatus("The engine stalled. Try New game.");
		} finally {
			if (gen === searchGen.current) setThinking(false);
		}
	}, [checkEnd, sync]);
	const review = (0, import_react.useCallback)(async (fenBefore, fenAfter, playedUci, who, ply) => {
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
				player: who
			});
			setCoach(graded);
			setLog((prev) => prev.map((m, i) => i === ply - 1 ? {
				...m,
				grade: graded.grade
			} : m));
		} catch {}
	}, []);
	const applyPlayerMove = (0, import_react.useCallback)((from, to, promotion) => {
		const g = gameRef.current;
		if (g.turn() !== playerRef.current || thinking || over) return;
		const fenBefore = g.fen();
		const moving = g.get(from);
		const rank = to[1];
		if (moving?.type === "p" && (rank === "8" || rank === "1") && !promotion) {
			setPromo({
				from,
				to
			});
			setSelected(null);
			return;
		}
		const mv = g.move({
			from,
			to,
			promotion: promotion ?? "q"
		});
		if (!mv) return;
		setPromo(null);
		setSelected(null);
		setLastMove({
			from: mv.from,
			to: mv.to
		});
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
		review(fenBefore, fenAfter, uci, playerRef.current, ply);
		if (!end) enqueue(() => botMove());
	}, [
		botMove,
		checkEnd,
		enqueue,
		over,
		review,
		sync,
		thinking
	]);
	const onSquare = (sq) => {
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
		clocks.current = {
			w: base,
			b: base
		};
		setClockW(base);
		setClockB(base);
		setLog([]);
		setCoach(null);
		setOver(null);
		setSelected(null);
		setPromo(null);
		setLastMove(null);
		setStarted(true);
		sync();
		if (player === "b") {
			setStatus("Kingside is thinking…");
			enqueue(() => botMove());
		} else setStatus("Your move. The coach grades every move you play.");
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
		setSelected(null);
		setPromo(null);
		const hist = g.history({ verbose: true });
		const last = hist[hist.length - 1];
		setLastMove(last ? {
			from: last.from,
			to: last.to
		} : null);
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-4 py-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-sm tracking-wide text-gold",
					children: "2500 Elo coach"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl leading-none text-fg",
					children: "Kingside"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-sm text-sm text-muted",
					children: "A limit-strength Stockfish that plays about 2500 and marks every one of your moves."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-sm text-muted",
						htmlFor: "time",
						children: "Clock"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						id: "time",
						value: timeId,
						disabled: started && !over,
						onChange: (e) => setTimeId(e.target.value),
						className: "h-11 rounded-lg border border-border bg-surface px-3 text-fg",
						children: TIMES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: t.id,
							children: t.label
						}, t.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "text-sm text-muted",
						htmlFor: "color",
						children: "Color"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						id: "color",
						value: player,
						disabled: started && !over,
						onChange: (e) => setPlayer(e.target.value),
						className: "h-11 rounded-lg border border-border bg-surface px-3 text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "w",
							children: "White"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "b",
							children: "Black"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: start,
						disabled: !ready,
						className: "h-11 rounded-lg bg-gold px-4 font-medium text-bg",
						children: started && !over ? "New game" : "Start"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: undo,
						disabled: !started || thinking,
						className: "h-11 rounded-lg border border-border bg-surface px-4",
						children: "Undo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: resign,
						disabled: !started || !!over,
						className: "h-11 rounded-lg border border-border bg-surface px-4",
						children: "Resign"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto w-full max-w-xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClockBar, {
							label: player === "w" ? "Kingside" : "You",
							time: player === "w" ? clockB : clockW,
							active: started && !over && turn !== player,
							unlimited: !timed.current
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 rounded-xl border border-border bg-surface-2 p-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-8 overflow-hidden rounded-md",
								children: orientation.map((rank, r) => files.map((file, f) => {
									const sq = `${file}${rank}`;
									const dark = (FILES.indexOf(file) + Number(rank)) % 2 === 0;
									const piece = gameRef.current.get(sq);
									const glyph = piece ? GLYPH[piece.color + piece.type] : "";
									const isSel = selected === sq;
									const isTarget = legalTargets.has(sq);
									const isLast = lastMove?.from === sq || lastMove?.to === sq;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										"aria-label": sq,
										onClick: () => onSquare(sq),
										className: `relative aspect-square text-3xl leading-none sm:text-4xl ${dark ? "bg-darksq text-light" : "bg-light text-darksq"} ${isSel ? "outline outline-2 outline-gold" : ""}`,
										children: [
											isLast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pointer-events-none absolute inset-0 bg-gold/25" }),
											isTarget && !glyph && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pointer-events-none absolute inset-0 m-auto h-3 w-3 rounded-full bg-gold/80" }),
											isTarget && glyph && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pointer-events-none absolute inset-1 rounded-full border-2 border-gold/80" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "relative",
												children: glyph
											}),
											f === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `absolute top-0.5 left-0.5 text-[10px] ${dark ? "text-light/80" : "text-darksq/80"}`,
												children: rank
											}),
											r === orientation.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `absolute right-0.5 bottom-0.5 text-[10px] ${dark ? "text-light/80" : "text-darksq/80"}`,
												children: file
											})
										]
									}, sq);
								}))
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClockBar, {
							label: player === "w" ? "You" : "Kingside",
							time: player === "w" ? clockW : clockB,
							active: started && !over && turn === player,
							unlimited: !timed.current
						}),
						promo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm text-muted",
								children: "Promote"
							}), [
								"q",
								"r",
								"b",
								"n"
							].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "h-11 w-11 rounded-lg border border-border bg-surface text-2xl",
								onClick: () => applyPlayerMove(promo.from, promo.to, p),
								children: GLYPH[player + p]
							}, p))]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-border bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs tracking-wide text-muted uppercase",
									children: "Position"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 font-medium",
									children: [over ?? `${boardTurnLabel} to move`, thinking && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "thinking-dot ml-2 inline-block h-2 w-2 rounded-full bg-gold" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: status
								}),
								gameRef.current.inCheck() && !over && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-blunder",
									children: "Check"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-border bg-surface p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs tracking-wide text-muted uppercase",
								children: "Coach"
							}), coach ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `mt-1 font-display text-2xl ${GRADE_CLASS[coach.grade]}`,
								children: coach.grade
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-fg",
								children: coach.note
							})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: "After you move, this panel says whether it was best, an inaccuracy, a mistake, a miss, or a blunder — and the move the engine wanted."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "max-h-64 overflow-auto rounded-xl border border-border bg-surface p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs tracking-wide text-muted uppercase",
								children: "Moves"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
								className: "mt-2 space-y-1 text-sm",
								children: [Array.from({ length: Math.ceil(log.length / 2) }, (_, i) => {
									const w = log[i * 2];
									const b = log[i * 2 + 1];
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "grid grid-cols-[1.5rem_1fr_1fr] gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-muted",
												children: [i + 1, "."]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveCell, { move: w }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveCell, { move: b })
										]
									}, i);
								}), log.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-muted",
									children: "No moves yet."
								})]
							})]
						})
					]
				})]
			})
		]
	});
}
function MoveCell({ move }) {
	if (!move) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: move.grade ? GRADE_CLASS[move.grade] : "text-fg",
		children: move.san
	});
}
function ClockBar({ label, time, active, unlimited }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex items-center justify-between rounded-lg px-3 py-2 ${active ? "bg-gold text-bg" : "bg-surface text-fg"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm font-medium",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-2xl tabular-nums",
			children: unlimited ? "∞" : fmtClock(time)
		})]
	});
}
function Home() {
	const [on, setOn] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setOn(true), []);
	if (!on) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-screen place-items-center px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-2xl text-gold",
			children: "Kingside"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChessApp, {});
}
//#endregion
export { Home as component };
