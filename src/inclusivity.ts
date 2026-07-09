// Display labels for the gender / relationship-style vocabularies (fixed enums
// in the API — see backend docs/CLIENT_INTEGRATION.md §3/§5). Shared by
// ProfilePage, PreferencesPage, and DiscoveryPage.

import type { Gender, RelationshipStyle } from "./api/types";

export const GENDER_OPTIONS: Gender[] = ["woman", "man", "nonbinary"];

export const GENDER_LABELS: Record<Gender, string> = {
  woman: "Woman",
  man: "Man",
  nonbinary: "Non-binary",
};

export const RELATIONSHIP_STYLE_OPTIONS: RelationshipStyle[] = [
  "monogamy",
  "non_monogamy",
  "open",
  "polyamory",
];

export const RELATIONSHIP_STYLE_LABELS: Record<RelationshipStyle, string> = {
  monogamy: "Monogamy",
  non_monogamy: "Non-monogamy (ENM)",
  open: "Open relationship",
  polyamory: "Polyamory",
};
