/** Solid Staunton-style pieces. `code` is like "wk" or "bp". */
export function Piece({ code, className = "" }: { code: string; className?: string }) {
  const white = code[0] === "w";
  const fill = white ? "#f6efe2" : "#241c16";
  const edge = white ? "#3a2e22" : "#cbbfa8";
  const type = code[1];
  return (
    <svg viewBox="0 0 40 40" className={`pointer-events-none h-[86%] w-[86%] ${className}`} aria-hidden>
      <g fill={fill} stroke={edge} strokeWidth="1.3" strokeLinejoin="round">
        {type === "p" && (
          <>
            <circle cx="20" cy="12" r="5.2" />
            <path d="M14 20h12l2.2 8.5H11.8z" />
            <rect x="10" y="30" width="20" height="3.4" rx="1" />
          </>
        )}
        {type === "r" && (
          <>
            <path d="M11 8h4v4h3V8h4v4h3V8h4v8H11z" />
            <path d="M13 16h14l1.6 12H11.4z" />
            <rect x="9" y="29.2" width="22" height="3.6" rx="1" />
          </>
        )}
        {type === "n" && (
          <>
            <path d="M12 32h18l-2-6c2-1 4-4 3-8-1-3-2-3-2-6 0-2-2-3-3-1-1 2-3 2-4 0 0 3-2 4-4 6-2 2-4 3-4 7 0 3 2 5 3 6z" />
            <circle cx="24.5" cy="13" r="0.9" fill={edge} stroke="none" />
          </>
        )}
        {type === "b" && (
          <>
            <circle cx="20" cy="8" r="2.1" />
            <path d="M20 11c-4 2-7 6-7 10 0 3 2 5 4 6l-1 4h8l-1-4c2-1 4-3 4-6 0-4-3-8-7-10z" />
            <path d="M18 18h4" stroke={edge} />
            <rect x="10" y="30.2" width="20" height="3.4" rx="1" />
          </>
        )}
        {type === "q" && (
          <>
            <circle cx="8" cy="10" r="2" />
            <circle cx="14.5" cy="7" r="2" />
            <circle cx="20" cy="6" r="2.2" />
            <circle cx="25.5" cy="7" r="2" />
            <circle cx="32" cy="10" r="2" />
            <path d="M9 12l3 8h16l3-8-5 3-4-4-4 4z" />
            <path d="M13 20h14l1.4 9H11.6z" />
            <rect x="9" y="30.2" width="22" height="3.5" rx="1" />
          </>
        )}
        {type === "k" && (
          <>
            <path d="M18.2 4h3.6v3.2H26v3.4h-4.2V14h-3.6v-3.4H14V7.2h4.2z" />
            <path d="M12 15h16l-1.5 5H13.5z" />
            <path d="M13 20h14l1.3 9H11.7z" />
            <rect x="9" y="30.2" width="22" height="3.5" rx="1" />
          </>
        )}
      </g>
    </svg>
  );
}
