import { useEffect, useRef, useState } from "react";
import { profile } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { LocationVisibility } from "../api/types";
import { searchCities } from "../cities";
import type { City } from "../cities";

const VISIBILITY_LABELS: Record<LocationVisibility, string> = {
  exact: "exact distances",
  approximate: "approximate distances (rounded to 5 km)",
  hidden: "hidden from distance features",
};

/**
 * Location editor shown on the discovery page (it changes more often than the
 * rest of the profile). Raw coordinates are never shown: the user either
 * shares their device location or picks a city from the bundled autocomplete,
 * and we send lat/lng to PUT /profile/location behind the scenes.
 *
 * The server never echoes coordinates back (ProfileResponse only carries
 * locationSet + visibility), so changing visibility alone requires coords
 * from this session — otherwise it applies on the next location update.
 */
export function LocationSection({ onSaved }: { onSaved?: () => void }) {
  const [locationSet, setLocationSet] = useState<boolean | null>(null);
  const [visibility, setVisibility] = useState<LocationVisibility>("approximate");
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  // Coordinates picked in this session; kept only so a visibility change can
  // re-save without asking the user to pick their location again.
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profile
      .get()
      .then((p) => {
        setLocationSet(p.locationSet);
        if (p.locationVisibility) setVisibility(p.locationVisibility);
        if (!p.locationSet) setEditing(true);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function save(lat: number, lng: number, vis: LocationVisibility, label: string) {
    setError(null);
    setBusy(true);
    try {
      await profile.updateLocation({ lat, lng, visibility: vis });
      coordsRef.current = { lat, lng };
      setLocationSet(true);
      setSavedLabel(label);
      onSaved?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser can't share your location — search for your city instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setQuery("");
        setResults([]);
        save(pos.coords.latitude, pos.coords.longitude, visibility, "your current location");
      },
      (err) => {
        setBusy(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location access was denied — search for your city instead."
            : err.message,
        );
      },
    );
  }

  function pickCity(city: City) {
    setQuery(`${city.name}, ${city.country}`);
    setResults([]);
    save(city.lat, city.lng, visibility, city.name);
  }

  function onVisibilityChange(vis: LocationVisibility) {
    setVisibility(vis);
    // Re-save immediately when we still know the coordinates.
    const coords = coordsRef.current;
    if (coords) save(coords.lat, coords.lng, vis, savedLabel ?? "your location");
  }

  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) setResults([]);
  }

  if (locationSet === null && !error) return null;

  if (!editing) {
    return (
      <div className="card location-bar">
        <span>
          📍 {savedLabel ? `Location: ${savedLabel}` : "Location set"}
          <span className="muted"> · {VISIBILITY_LABELS[visibility]}</span>
        </span>
        <button className="link-button" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="card form location-card">
      <div className="location-card-head">
        <strong>📍 Your location</strong>
        {locationSet && (
          <button className="link-button" onClick={() => setEditing(false)}>
            Done
          </button>
        )}
      </div>
      {!locationSet && (
        <p className="muted">
          Set a location to unlock distance scoring — share it from your device or
          just pick your city. We never show your coordinates to anyone.
        </p>
      )}
      <button type="button" className="secondary" onClick={useMyLocation} disabled={busy}>
        Use my current location
      </button>
      <div className="autocomplete" onBlur={onBlur}>
        <label>
          Or search for a city
          <input
            value={query}
            placeholder="Start typing… e.g. Stockholm"
            onChange={(e) => {
              setQuery(e.target.value);
              setResults(searchCities(e.target.value));
            }}
            onFocus={(e) => setResults(searchCities(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Escape") setResults([]);
            }}
            disabled={busy}
          />
        </label>
        {results.length > 0 && (
          <div className="autocomplete-list" role="listbox">
            {results.map((city) => (
              <button
                key={`${city.name}|${city.country}`}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickCity(city)}
              >
                {city.name} <span className="muted">{city.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <label>
        Visibility
        <select
          value={visibility}
          onChange={(e) => onVisibilityChange(e.target.value as LocationVisibility)}
          disabled={busy}
        >
          <option value="exact">Exact — show real distances</option>
          <option value="approximate">Approximate — distances rounded to 5 km</option>
          <option value="hidden">Hidden — excluded from distance features</option>
        </select>
      </label>
      {locationSet && !coordsRef.current && (
        <p className="muted">
          A visibility change takes effect the next time you update your location.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {savedLabel && !error && <p className="notice">Location saved.</p>}
    </div>
  );
}
