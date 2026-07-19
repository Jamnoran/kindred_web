import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { profile } from "../api/endpoints";
import { ApiError, errorMessage } from "../api/http";
import type { Gender, Interest, ProfileResponse, RelationshipStyle } from "../api/types";
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      profile.get().catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
      profile.interests(),
    ])
      .then(([p, ints]) => {
        setAllInterests(ints);
        if (p) {
          setData(p);
          setDisplayName(p.displayName ?? "");
          setBio(p.bio ?? "");
          setGender(p.gender);
          setLookingFor(p.lookingFor ?? []);
          setRelationshipStyles(p.relationshipStyles ?? []);
          setInterests(p.interests ?? []);
        }
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoaded(true));
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

  if (!loaded) return <div className="page-loading">Loading…</div>;

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
      <p className="muted">
        Looking for your location settings? They live on the Discover page now.
      </p>
    </div>
  );
}
