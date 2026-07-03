import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { discovery } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { PreferencesResponse } from "../api/types";

const LOOKING_FOR_OPTIONS = ["relationship", "casual", "friendship", "unsure"];
const WEIGHT_KEYS: { key: string; label: string }[] = [
  { key: "interests", label: "Shared interests" },
  { key: "distance", label: "Proximity" },
  { key: "activity", label: "Recently active" },
  { key: "mutualFit", label: "Mutual fit" },
];

export function PreferencesPage() {
  // PUT /preferences is a full replace with server defaults for omitted
  // fields, so we keep the whole server object and mutate it locally.
  const [prefs, setPrefs] = useState<PreferencesResponse | null>(null);
  const [dealbreakerText, setDealbreakerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    discovery
      .preferences()
      .then((p) => {
        setPrefs(p);
        setDealbreakerText(p.dealbreakers.join(", "));
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function patch(partial: Partial<PreferencesResponse>) {
    setPrefs((p) => (p ? { ...p, ...partial } : p));
    setSaved(false);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!prefs) return;
    setError(null);
    setBusy(true);
    try {
      const body = {
        ...prefs,
        dealbreakers: dealbreakerText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const next = await discovery.updatePreferences(body);
      setPrefs(next);
      setDealbreakerText(next.dealbreakers.join(", "));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!prefs && !error) return <div className="page-loading">Loading…</div>;
  if (!prefs) return <p className="error">{error}</p>;

  return (
    <div className="page">
      <h2>Preferences</h2>
      <form className="card form" onSubmit={onSave}>
        <label>
          Maximum distance: {prefs.distanceKm} km
          <input
            type="range"
            min={1}
            max={500}
            value={prefs.distanceKm}
            onChange={(e) => patch({ distanceKm: Number(e.target.value) })}
          />
        </label>
        <div className="row">
          <label>
            Age from
            <input
              type="number"
              min={18}
              max={120}
              value={prefs.ageMin}
              onChange={(e) => patch({ ageMin: Number(e.target.value) })}
            />
          </label>
          <label>
            Age to
            <input
              type="number"
              min={18}
              max={120}
              value={prefs.ageMax}
              onChange={(e) => patch({ ageMax: Number(e.target.value) })}
            />
          </label>
        </div>
        <fieldset>
          <legend>Looking for</legend>
          <div className="chip-row">
            {LOOKING_FOR_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`chip ${prefs.lookingFor.includes(opt) ? "chip-on" : ""}`}
                onClick={() =>
                  patch({
                    lookingFor: prefs.lookingFor.includes(opt)
                      ? prefs.lookingFor.filter((v) => v !== opt)
                      : [...prefs.lookingFor, opt],
                  })
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Dealbreakers (comma-separated)
          <input
            value={dealbreakerText}
            onChange={(e) => {
              setDealbreakerText(e.target.value);
              setSaved(false);
            }}
            placeholder="smoking, …"
          />
        </label>
        <fieldset>
          <legend>What matters to you (0–5)</legend>
          {WEIGHT_KEYS.map(({ key, label }) => (
            <label key={key}>
              {label}: {prefs.weights[key] ?? 0}
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={prefs.weights[key] ?? 0}
                onChange={(e) =>
                  patch({ weights: { ...prefs.weights, [key]: Number(e.target.value) } })
                }
              />
            </label>
          ))}
        </fieldset>
        {error && <p className="error">{error}</p>}
        {saved && <p className="notice">Preferences saved.</p>}
        <button type="submit" disabled={busy}>
          Save preferences
        </button>
      </form>
    </div>
  );
}
