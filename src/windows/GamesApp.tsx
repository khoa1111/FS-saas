import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { send } from "../ws";

interface Score {
  name: string;
  color: string;
  best: number;
}

function Ttt() {
  const ttt = useStore((s) => s.ttt);
  const user = useStore((s) => s.user)!;
  if (!ttt) return <p style={{ color: "var(--muted)" }}>Connecting to the arcade table…</p>;

  const mySeat = ttt.seats.X?.id === user.id ? "X" : ttt.seats.O?.id === user.id ? "O" : null;
  const canPlay = mySeat && !ttt.winner && ttt.turn === mySeat && ttt.seats.X && ttt.seats.O;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div className="ttt">
        {ttt.board.map((cell, i) => (
          <button
            key={i}
            className={cell === "X" ? "x" : cell === "O" ? "o" : ""}
            disabled={!canPlay || !!cell}
            onClick={() => send({ t: "ttt.move", cell: i })}
          >
            {cell ?? ""}
          </button>
        ))}
      </div>
      <div style={{ minWidth: 200 }}>
        {(["X", "O"] as const).map((seat) => (
          <div key={seat} style={{ marginBottom: 10 }}>
            <span className="mlabel">Player {seat}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <strong style={{ color: seat === "X" ? "var(--cobalt)" : "var(--orange)" }}>
                {ttt.seats[seat]?.name ?? "empty seat"}
              </strong>
              {(!ttt.seats[seat] || ttt.seats[seat]?.id === user.id) && (
                <button className="btn ghost sm" onClick={() => send({ t: "ttt.sit", seat })}>
                  {ttt.seats[seat]?.id === user.id ? "Stand up" : "Sit"}
                </button>
              )}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          {ttt.winner ? (
            <p style={{ fontWeight: 800 }}>
              {ttt.winner === "draw" ? "It's a draw!" : `${ttt.seats[ttt.winner]?.name ?? ttt.winner} wins! 🏆`}
            </p>
          ) : ttt.seats.X && ttt.seats.O ? (
            <p style={{ color: "var(--ink-2)" }}>Turn: <strong>{ttt.seats[ttt.turn]?.name}</strong></p>
          ) : (
            <p style={{ color: "var(--muted)" }}>Two seats needed — invite a teammate over!</p>
          )}
          <button className="btn sm" onClick={() => send({ t: "ttt.reset" })}>Reset board</button>
        </div>
      </div>
    </div>
  );
}

function ReactionGame({ onScored }: { onScored: () => void }) {
  const [phase, setPhase] = useState<"idle" | "wait" | "go" | "result">("idle");
  const [result, setResult] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const goAt = useRef(0);
  const showToast = useStore((s) => s.showToast);

  useEffect(() => () => clearTimeout(timer.current), []);

  function start() {
    setPhase("wait");
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setPhase("go");
    }, 900 + Math.random() * 2200);
  }

  async function tap() {
    if (phase === "wait") {
      clearTimeout(timer.current);
      setPhase("idle");
      showToast("Too early! Wait for orange.");
      return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - goAt.current);
      setResult(ms);
      setPhase("result");
      try {
        await api.post("/games/score", { game: "reaction", score: -ms }); // lower is better
        onScored();
      } catch { /* leaderboard is best-effort */ }
    }
  }

  const bg = phase === "go" ? "var(--orange)" : phase === "wait" ? "var(--cobalt)" : "var(--shell)";
  const label =
    phase === "idle" ? "Click to start" :
    phase === "wait" ? "Wait for it…" :
    phase === "go" ? "TAP NOW!" :
    `${result} ms — click to retry`;

  return (
    <div
      className="reaction-pad"
      style={{ background: bg }}
      onClick={() => (phase === "idle" || phase === "result" ? start() : tap())}
    >
      {label}
    </div>
  );
}

export default function GamesApp() {
  const [scores, setScores] = useState<Score[]>([]);
  const loadScores = () =>
    api.get<{ scores: Score[] }>("/games/leaderboard/reaction").then((r) => setScores(r.scores)).catch(() => {});
  useEffect(() => { loadScores(); }, []);

  return (
    <div>
      <div className="section">
        <h4>Tic-tac-toe · shared table <span className="mlabel">realtime</span></h4>
        <Ttt />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <h4>Reaction race</h4>
          <ReactionGame onScored={loadScores} />
        </div>
        <div className="section" style={{ marginBottom: 0 }}>
          <h4>Fastest fingers <span className="mlabel">best reaction</span></h4>
          <table className="grid">
            <thead><tr><th>#</th><th>Agent</th><th className="num">Best</th></tr></thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={s.name}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>
                    <span className="dot" style={{ background: s.color, marginRight: 6 }} />
                    {s.name}
                  </td>
                  <td className="num">{Math.abs(s.best)} ms</td>
                </tr>
              ))}
              {scores.length === 0 && <tr><td colSpan={3} style={{ color: "var(--muted)" }}>No scores yet — be first!</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
