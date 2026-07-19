import { useEffect, useState } from "react";
import { profile } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { LocationVisibility, UpdateLocationRequest } from "../api/types";
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
 * and we send lat/lng to PUT /profile/location behind the scenes. The server
 * responds with a coarse reverse-geocoded label (never coordinates), and
 * accepts a visibility-only PUT — no lat/lng — once a location is stored.
 */
export function LocationSection({ onSaved }: { onSaved?: () => void }) {
  const [locationSet, setLocationSet] = useState<boolean | null>(null);
  const [visibility, setVisibility] = useState<LocationVisibility>("approximate");
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profile
      .get()
      .then((p) => {
        setLocationSet(p.locationSet);
        setPlaceLabel(p.locationLabel ?? null);
        if (p.locationVisibility) setVisibility(p.locationVisibility);
        if (!p.locationSet) setEditing(true);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  /** fallbackLabel covers backends that don't send locationLabel yet. */
  async function save(body: UpdateLocationRequest, fallbackLabel: string | null) {
    setError(null);
    setJustSaved(false);
    setBusy(true);
    try {
      const p = await profile.updateLocation(body);
      setLocationSet(p.locationSet);
      setPlaceLabel(p.locationLabel ?? fallbackLabel);
      if (p.locationVisibility) setVisibility(p.locationVisibility);
      setJustSaved(true);
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
        save(
          { lat: pos.coords.latitude, lng: pos.coords.longitude, visibility },
          "your current location",
        );
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
    save({ lat: city.lat, lng: city.lng, visibility }, city.name);
  }

  function onVisibilityChange(vis: LocationVisibility) {
    setVisibility(vis);
    // Visibility-only update: no coordinates needed once a location is stored.
    if (locationSet) save({ visibility: vis }, placeLabel);
  }

  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) setResults([]);
  }

  if (locationSet === null && !error) return null;

  if (!editing) {
    return (
      <div className="card location-bar">
        <span>
          📍 {placeLabel ? `Location: ${placeLabel}` : "Location set"}
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
      {error && <p className="error">{error}</p>}
      {justSaved && !error && <p className="notice">Location saved.</p>}
    </div>
  );
}
