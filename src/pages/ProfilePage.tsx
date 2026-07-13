import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { profile } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type {
  Gender,
  Interest,
  LocationVisibility,
  ProfileResponse,
  RelationshipStyle,
} from "../api/types";
import {
  GENDER_LABELS,
  GENDER_OPTIONS,
  RELATIONSHIP_STYLE_LABELS,
  RELATIONSHIP_STYLE_OPTIONS,
} from "../inclusivity";
import { usePageTitle } from "../usePageTitle";

const LOOKING_FOR_OPTIONS = ["relationship", "casual", "friendship", "unsure"];

export function ProfilePage() {
  usePageTitle("Profile");
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [allInterests, setAllInterests] = useState<Interest[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [relationshipStyles, setRelationshipStyles] = useState<RelationshipStyle[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // location
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [visibility, setVisibility] = useState<LocationVisibility>("approximate");
  const [locError, setLocError] = useState<string | null>(null);
  const [locSaved, setLocSaved] = useState(false);

  useEffect(() => {
    Promise.all([profile.get(), profile.interests()])
      .then(([p, ints]) => {
        setData(p);
        setAllInterests(ints);
        setDisplayName(p.displayName ?? "");
        setBio(p.bio ?? "");
        setGender(p.gender);
        setLookingFor(p.lookingFor ?? []);
        setRelationshipStyles(p.relationshipStyles ?? []);
        setInterests(p.interests ?? []);
        if (p.locationVisibility) setVisibility(p.locationVisibility);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      // PUT /profile is a full replace — always send everything.
      const p = await profile.update({
        displayName,
        bio,
        gender,
        lookingFor,
        relationshipStyles,
        interests,
      });
      setData(p);
      // The server umbrella-normalizes styles (open/polyamory add non_monogamy);
      // adopt its copy so the chips reflect what's actually stored.
      setRelationshipStyles(p.relationshipStyles ?? []);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
      },
      (err) => setLocError(err.message),
    );
  }

  async function saveLocation(e: FormEvent) {
    e.preventDefault();
    setLocError(null);
    setLocSaved(false);
    try {
      const p = await profile.updateLocation({
        lat: Number(lat),
        lng: Number(lng),
        visibility,
      });
      setData(p);
      setLocSaved(true);
    } catch (err) {
      setLocError(errorMessage(err));
    }
  }

  if (!data && !error) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page">
      <h2>Your profile</h2>
      <form className="card form" onSubmit={onSave}>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            required
          />
        </label>
        <label>
          Bio
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} rows={4} />
        </label>
        <fieldset>
          <legend>Gender</legend>
          <p className="muted">
            Optional and self-described — tap again to clear. It's only used for
            matching against what people ask to see; it's never a requirement.
          </p>
          <div className="chip-row">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`chip ${gender === opt ? "chip-on" : ""}`}
                onClick={() => setGender(gender === opt ? null : opt)}
              >
                {GENDER_LABELS[opt]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Looking for</legend>
          <div className="chip-row">
            {LOOKING_FOR_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`chip ${lookingFor.includes(opt) ? "chip-on" : ""}`}
                onClick={() => toggle(lookingFor, opt, setLookingFor)}
              >
                {opt}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Relationship style</legend>
          <p className="muted">
            Pick everything that fits — choosing both monogamy and non-monogamy
            means "open to either". Open or polyamory automatically counts as
            non-monogamy too.
          </p>
          <div className="chip-row">
            {RELATIONSHIP_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`chip ${relationshipStyles.includes(opt) ? "chip-on" : ""}`}
                onClick={() =>
                  setRelationshipStyles(
                    relationshipStyles.includes(opt)
                      ? relationshipStyles.filter((v) => v !== opt)
                      : [...relationshipStyles, opt],
                  )
                }
              >
                {RELATIONSHIP_STYLE_LABELS[opt]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Interests</legend>
          <div className="chip-row">
            {allInterests.map((i) => (
              <button
                key={i.slug}
                type="button"
                className={`chip ${interests.includes(i.slug) ? "chip-on" : ""}`}
                onClick={() => toggle(interests, i.slug, setInterests)}
              >
                {i.label}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p className="error">{error}</p>}
        {saved && <p className="notice">Profile saved.</p>}
        <button type="submit" disabled={busy}>
          Save profile
        </button>
      </form>

      <h2>Location</h2>
      <form className="card form" onSubmit={saveLocation}>
        <p className="muted">
          {data?.locationSet
            ? `Location is set (visibility: ${data.locationVisibility ?? "unknown"}).`
            : "No location set yet — discovery distance scoring needs one."}
        </p>
        <div className="row">
          <label>
            Latitude
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="59.33" required />
          </label>
          <label>
            Longitude
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="18.06" required />
          </label>
        </div>
        <button type="button" className="secondary" onClick={useMyLocation}>
          Use my current location
        </button>
        <label>
          Visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as LocationVisibility)}
          >
            <option value="exact">Exact — show real distances</option>
            <option value="approximate">Approximate — distances rounded to 5 km</option>
            <option value="hidden">Hidden — excluded from distance features</option>
          </select>
        </label>
        {locError && <p className="error">{locError}</p>}
        {locSaved && <p className="notice">Location saved.</p>}
        <button type="submit">Save location</button>
      </form>
    </div>
  );
}
