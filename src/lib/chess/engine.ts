export type SearchResult = {
  best: string;
  /** Centipawns from White's point of view. Mate is ±10000. */
  whiteCp: number;
  mate: number | null;
  pv: string;
};

type Waiter = (line: string) => void;

export class Stockfish {
  private worker: Worker;
  private waiter: Waiter | null = null;
  private buffer: string[] = [];
  ready: Promise<void>;

  constructor(url: string, options: string[]) {
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent<string>) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);
      if (this.waiter) this.waiter(line);
      else this.buffer.push(line);
    };
    this.ready = this.boot(options);
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private nextLine(timeoutMs: number): Promise<string> {
    const queued = this.buffer.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error("engine timeout"));
      }, timeoutMs);
      this.waiter = (line) => {
        clearTimeout(timer);
        this.waiter = null;
        resolve(line);
      };
    });
  }

  private async boot(options: string[]) {
    this.send("uci");
    for (;;) {
      const line = await this.nextLine(20000);
      if (line === "uciok") break;
    }
    for (const opt of options) this.send(opt);
    this.send("isready");
    for (;;) {
      const line = await this.nextLine(20000);
      if (line === "readyok") break;
    }
  }

  private chain: Promise<unknown> = Promise.resolve();

  async search(fen: string, go: string): Promise<SearchResult> {
    const run = this.chain.then(() => this.searchNow(fen, go));
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async searchNow(fen: string, go: string): Promise<SearchResult> {
    await this.ready;
    this.buffer = [];
    this.send("stop");
    this.send(`position fen ${fen}`);
    this.send(go);
    let cp = 0;
    let mate: number | null = null;
    let pv = "";
    const stm = fen.split(" ")[1] === "b" ? "b" : "w";
    for (;;) {
      const line = await this.nextLine(45000);
      if (line.startsWith("info ") && line.includes(" score ") && !line.includes(" lowerbound") && !line.includes(" upperbound")) {
        const score = line.match(/score (cp|mate) (-?\d+)/);
        if (score && (line.includes(" multipv 1") || !line.includes(" multipv "))) {
          if (score[1] === "cp") {
            cp = Number(score[2]);
            mate = null;
          } else {
            mate = Number(score[2]);
            cp = mate > 0 ? 10000 : -10000;
          }
          const pvMatch = line.match(/ pv (.+)$/);
          if (pvMatch) pv = pvMatch[1];
        }
      }
      if (line.startsWith("bestmove")) {
        const best = line.split(/\s+/)[1] ?? "";
        const whiteCp = stm === "w" ? cp : -cp;
        const whiteMate = mate == null ? null : stm === "w" ? mate : -mate;
        return { best, whiteCp, mate: whiteMate, pv };
      }
    }
  }

  stop() {
    this.send("stop");
  }

  dispose() {
    this.send("quit");
    this.worker.terminate();
  }
}
