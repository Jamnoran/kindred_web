import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { discovery, notifications } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { NotificationPreferenceEntry, PreferencesResponse } from "../api/types";
import { getStoredTheme, setTheme } from "../theme";
import type { Theme } from "../theme";

const LOOKING_FOR_OPTIONS = ["relationship", "casual", "friendship", "unsure"];
const WEIGHT_KEYS: { key: string; label: string }[] = [
  { key: "interests", label: "Shared interests" },
  { key: "distance", label: "Proximity" },
  { key: "activity", label: "Recently active" },
  { key: "mutualFit", label: "Mutual fit" },
];

// Labels for known types/channels; unknown values from newer backends fall
// back to a humanized slug so they still render (the grid is server-driven).
const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_match: "New match",
  new_message: "New message",
};
const NOTIFICATION_TYPE_HINTS: Record<string, string> = {
  new_message:
    "At most one email per conversation every 15 minutes, and emails never include the message text.",
};
const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
};

function humanize(slug: string): string {
  const words = slug.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : slug;
}

function NotificationSettings() {
  const [entries, setEntries] = useState<NotificationPreferenceEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    notifications
      .preferences()
      .then((r) => setEntries(r.preferences))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // PUT is a full replace: always send the entire grid, then adopt the
  // server's copy of it.
  async function toggle(target: NotificationPreferenceEntry) {
    if (!entries) return;
    const next = entries.map((e) =>
      e.type === target.type && e.channel === target.channel
        ? { ...e, enabled: !e.enabled }
        : e,
    );
    setEntries(next);
    setError(null);
    setBusy(true);
    try {
      const res = await notifications.updatePreferences({ preferences: next });
      setEntries(res.preferences);
    } catch (err) {
      setEntries(entries); // revert the optimistic flip
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!entries && !error) return null;

  // Group rows by type, one toggle per channel, in server order.
  const types = entries ? [...new Set(entries.map((e) => e.type))] : [];

  return (
    <div className="card form">
      <fieldset>
        <legend>Notifications</legend>
        <p className="muted">When you're offline, we'll let you know about…</p>
        {types.map((type) => {
          const hint = NOTIFICATION_TYPE_HINTS[type];
          return (
            <div className="notif-row" key={type}>
              <div className="notif-row-info">
                <span>{NOTIFICATION_TYPE_LABELS[type] ?? humanize(type)}</span>
                {hint && <span className="notif-hint">{hint}</span>}
              </div>
              <div className="notif-row-channels">
                {entries!
                  .filter((e) => e.type === type)
                  .map((entry) => (
                    <label className="switch" key={entry.channel}>
                      <input
                        type="checkbox"
                        checked={entry.enabled}
                        disabled={busy}
                        onChange={() => toggle(entry)}
                      />
                      <span className="switch-track" aria-hidden="true" />
                      {NOTIFICATION_CHANNEL_LABELS[entry.channel] ?? humanize(entry.channel)}
                    </label>
                  ))}
              </div>
            </div>
          );
        })}
        {error && <p className="error">{error}</p>}
      </fieldset>
    </div>
  );
}

export function PreferencesPage() {
  // PUT /preferences is a full replace with server defaults for omitted
  // fields, so we keep the whole server object and mutate it locally.
  const [prefs, setPrefs] = useState<PreferencesResponse | null>(null);
  const [dealbreakerText, setDealbreakerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // stored on this device only, not part of the server-side preferences
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  function onThemeChange(next: Theme) {
    setTheme(next);
    setThemeState(next);
  }

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
      <div className="card form">
        <fieldset>
          <legend>Appearance</legend>
          <div className="chip-row">
            {(["dark", "light"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`chip ${theme === opt ? "chip-on" : ""}`}
                onClick={() => onThemeChange(opt)}
              >
                {opt === "dark" ? "Dark (default)" : "Light"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <NotificationSettings />
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
