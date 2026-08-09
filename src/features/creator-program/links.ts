export const CREATOR_PROGRAM_LINKS = {
  /** The Creators Program Policy. Covers the three things the consent modal
   *  gates submit on: participation terms (§"What Is the Creators Program"),
   *  the monthly requirements (§6.1), and revocation for missing them (§9). */
  terms: "https://liffio.com/creators-policy",

  privacy: "https://liffio.com/privacy-policy",

  /** Programme matters: terms line, rejection appeal, programme rules. */
  creatorEmail: "mailto:creators@liffio.com",

  /** Platform failures: Paused, MetricsUnavailable, Error frames. */
  supportEmail: "mailto:support@liffio.com",
} as const;
