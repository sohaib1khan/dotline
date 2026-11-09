import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CelebrationOverlay, type CelebrationPayload } from "@/components/CelebrationOverlay";
import { BrailleCell } from "@/features/braille/BrailleCell";
import { LETTER_DOTS, lettersForDifficulty } from "@/features/braille/alphabet";
import { submitGameScore, type ScoreSubmitResult } from "@/features/games/submitScore";
import { feedback } from "@/feedback";

type Card = {
  id: string;
  pairId: string;
  kind: "cell" | "letter";
  letter: string;
};

type Props = { difficulty: number; durationS: number; highScore: number };

function buildDeck(level: number): Card[] {
  const pool = lettersForDifficulty(level);
  const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(6, 3 + level));
  const cards: Card[] = [];
  for (const letter of pick) {
    cards.push({ id: `${letter}-cell`, pairId: letter, kind: "cell", letter });
    cards.push({ id: `${letter}-letter`, pairId: letter, kind: "letter", letter });
  }
  return cards.sort(() => Math.random() - 0.5);
}

export function CellMatchGame({ difficulty, durationS, highScore }: Props) {
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(difficulty));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [result, setResult] = useState<ScoreSubmitResult | null>(null);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [error, setError] = useState("");

  const pairs = useMemo(() => deck.length / 2, [deck.length]);
  const done = matched.length === deck.length && deck.length > 0;

  useEffect(() => {
    if (!done || result) return;
    const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const accuracy = Math.round((pairs / Math.max(moves, pairs)) * 100);
    const score = Math.max(10, pairs * 20 - Math.max(0, moves - pairs) * 5 + difficulty * 5);
    void submitGameScore("cell_match", {
      score,
      accuracy,
      duration_s: Math.min(durationS, elapsed),
    })
      .then((data) => {
        setResult(data);
        if (data.new_badges[0]) {
          setCelebration({
            kind: "badge",
            title: data.new_badges[0].title,
            detail: data.new_badges[0].description,
          });
        } else {
          feedback.correct("Board cleared");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Save failed"));
  }, [done, result, startedAt, pairs, moves, difficulty, durationS]);

  function flip(card: Card) {
    if (matched.includes(card.id) || flipped.includes(card.id) || flipped.length >= 2 || result) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length < 2) return;
    setMoves((value) => value + 1);
    const a = deck.find((cardItem) => cardItem.id === next[0])!;
    const b = deck.find((cardItem) => cardItem.id === next[1])!;
    if (a.pairId === b.pairId && a.kind !== b.kind) {
      feedback.correct(a.letter);
      setMatched((value) => [...value, a.id, b.id]);
      setFlipped([]);
    } else {
      feedback.wrong("Not a match");
      window.setTimeout(() => setFlipped([]), 700);
    }
  }

  function reset() {
    setDeck(buildDeck(difficulty));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setStartedAt(Date.now());
    setResult(null);
    setError("");
  }

  return (
    <section className="game-panel" aria-labelledby="cell-match-title">
      <h1 id="cell-match-title" className="page-title">
        Cell Match
      </h1>
      <p className="page-copy">
        <strong>Match each braille cell to its letter.</strong> Moves {moves} · Best {highScore}
      </p>
      <div className="match-grid" role="grid" aria-label="Memory cards">
        {deck.map((card) => {
          const open = flipped.includes(card.id) || matched.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`match-card${open ? " is-open" : ""}${matched.includes(card.id) ? " is-matched" : ""}`}
              onClick={() => flip(card)}
              aria-label={open ? `${card.kind} ${card.letter}` : "Hidden card"}
            >
              {open ? (
                card.kind === "letter" ? (
                  <strong className="match-letter">{card.letter}</strong>
                ) : (
                  <BrailleCell dots={LETTER_DOTS[card.letter] ?? []} showNumbers={false} />
                )
              ) : (
                <strong>?</strong>
              )}
            </button>
          );
        })}
      </div>
      {result ? (
        <div className="lesson-result">
          <p className="success-text" role="status">
            <strong>
              Score {result.score} · +{result.xp_awarded} XP · best {result.high_score}
            </strong>
          </p>
          <button className="primary-button" type="button" onClick={reset}>
            Play again
          </button>
          <Link className="secondary-button link-button" to="/app/games">
            All games
          </Link>
        </div>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <CelebrationOverlay payload={celebration} onDismiss={() => setCelebration(null)} />
    </section>
  );
}
