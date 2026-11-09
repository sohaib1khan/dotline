import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { ApiError, apiGet } from "@/lib/api";
import { readLastRoom, writeLastRoom, type RoomTrack } from "@/store/room";
import { useAuth } from "@/store/auth";

type TracksResponse = { tracks: string[] };

export function DoorChooserPage() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<string[] | null>(null);
  const [welcome, setWelcome] = useState(
    "Choose a room to practice — one calm space at a time.",
  );
  const [error, setError] = useState("");
  const lastRoom = readLastRoom();

  useEffect(() => {
    let cancelled = false;
    void apiGet<TracksResponse>("/api/me/tracks")
      .then((data) => {
        if (!cancelled) setTracks(data.tracks);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your tracks.");
          setTracks([]);
        }
      });
    void apiGet<{ welcome_message?: string; app_name?: string }>("/api/public/site")
      .then((data) => {
        if (!cancelled && data.welcome_message) setWelcome(data.welcome_message);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (tracks && tracks.length === 0) {
    return <Navigate to="/tracks" replace />;
  }

  function enterRoom(track: RoomTrack) {
    writeLastRoom(track);
    navigate(`/app/rooms/${track}`);
  }

  const hasBraille = Boolean(tracks?.includes("braille"));
  const hasCursive = Boolean(tracks?.includes("cursive"));
  const focusTrack: RoomTrack | null =
    lastRoom && tracks?.includes(lastRoom)
      ? lastRoom
      : hasBraille
        ? "braille"
        : hasCursive
          ? "cursive"
          : null;

  return (
    <section className="door-chooser" aria-labelledby="door-chooser-title">
      <div className="door-chooser-brand">
        <BrandMark to="/app" />
      </div>
      <h1 id="door-chooser-title" className="page-title">
        Choose a room to practice
      </h1>
      <p className="page-copy">
        <strong>
          Welcome{user ? `, ${user.first_name}` : ""}. {welcome}{" "}
          {focusTrack === "braille" && hasBraille
            ? "Tip: press Enter Braille room to continue where you left off."
            : focusTrack === "cursive" && hasCursive
              ? "Tip: press Enter Cursive room to continue where you left off."
              : "Pick Braille or Cursive — one room at a time."}
        </strong>
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!tracks ? (
        <p className="status">Loading your rooms…</p>
      ) : (
        <div className="door-grid" role="group" aria-label="Practice rooms">
          <DoorCard
            track="braille"
            title="Braille room"
            guide="Start here for touch reading — dots, chords, and listening."
            enrolled={hasBraille}
            recommended={focusTrack === "braille"}
            onEnter={() => enterRoom("braille")}
          />
          <DoorCard
            track="cursive"
            title="Cursive room"
            guide="Enter when you want stroke practice — tracing and free writing."
            enrolled={hasCursive}
            recommended={focusTrack === "cursive"}
            onEnter={() => enterRoom("cursive")}
          />
        </div>
      )}
      <p className="door-chooser-foot">
        <Link className="linkish" to="/app/settings">
          Change enrolled tracks in Settings
        </Link>
      </p>
    </section>
  );
}

function DoorCard({
  track,
  title,
  guide,
  enrolled,
  recommended,
  onEnter,
}: {
  track: RoomTrack;
  title: string;
  guide: string;
  enrolled: boolean;
  recommended: boolean;
  onEnter: () => void;
}) {
  return (
    <article
      className={`door-card door-${track}${enrolled ? "" : " is-locked"}${recommended ? " is-recommended" : ""}`}
      aria-labelledby={`door-${track}-title`}
    >
      <h2 id={`door-${track}-title`} className="door-card-title">
        {title}
      </h2>
      <p className="door-card-guide">
        <strong>{guide}</strong>
      </p>
      {enrolled ? (
        <button type="button" className="primary-button" onClick={onEnter}>
          Enter {track === "braille" ? "Braille" : "Cursive"} room
          {recommended ? " · continue" : ""}
        </button>
      ) : (
        <p className="door-card-locked">
          <strong>Not enrolled yet.</strong> Add this track in Settings when you are ready — no rush.
        </p>
      )}
    </article>
  );
}
