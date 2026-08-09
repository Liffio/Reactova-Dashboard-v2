export const CREATOR_PROGRAM_LINKS = {
  /** TODO: page not yet written. Blocks launch — the consent
   *  checkbox gates submit on agreeing to this document. */
  terms: "https://liffio.com/creator-program-terms",

  /** TODO: point at the existing privacy page — find the route
   *  already used elsewhere in the app, don't create a new one. */
  privacy: "https://liffio.com/privacy",

  /** Programme matters: terms line, rejection appeal, programme rules. */
  creatorEmail: "mailto:creators@liffio.com",

  /** Platform failures: Paused, MetricsUnavailable, Error frames. */
  supportEmail: "mailto:support@liffio.com",
} as const;
