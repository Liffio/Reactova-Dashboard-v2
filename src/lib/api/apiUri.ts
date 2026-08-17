/**
 * Central API route registry — the single source of truth for every backend
 * endpoint the client calls. No component or hook may hardcode an API path;
 * always import from here.
 *
 * Static endpoints are strings; parametrized endpoints are functions that
 * return the final path. Query strings are appended by the module api files.
 */

const V1 = "/api/v1";

/** Serialises list params, dropping empties so a blank search box isn't sent as `q=`. */
const listQs = (params: Record<string, string | number | boolean | undefined>): string => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
};

/**
 * Creator Eligibility System — deliberately versioned separately from the
 * rest of the API (`/api/creator/v1/...` not `/api/v1/creators`), per
 * ENDPOINT-CONTRACT.md §1.1, so a future `/api/creator/v2/...` can ship
 * without forcing a synchronized frontend/backend deploy.
 */
const CREATOR_V1 = "/api/creator/v1";

export const apiUri = {
  auth: {
    register: `${V1}/auth/register`,
    login: `${V1}/auth/login`,
    logout: `${V1}/auth/logout`,
    refresh: `${V1}/auth/refresh`,
    me: `${V1}/auth/me`,
    permissions: `${V1}/auth/permissions`,
    activeWorkspace: `${V1}/auth/active-workspace`,
    google: `${V1}/auth/google`,
    emailVerification: {
      verifyCode: `${V1}/auth/email-verification/verify-code`,
      resend: `${V1}/auth/email-verification/resend`,
    },
    password: {
      forgot: `${V1}/auth/password/forgot`,
      reset: `${V1}/auth/password/reset`,
    },
    mfa: {
      loginEmailSend: `${V1}/auth/mfa/login-email/send`,
      loginVerify: `${V1}/auth/mfa/login-verify`,
      setupStart: `${V1}/auth/mfa/setup/start`,
      setupCancel: `${V1}/auth/mfa/setup/cancel`,
      setupVerify: `${V1}/auth/mfa/setup/verify`,
      disable: `${V1}/auth/mfa/disable`,
      channels: `${V1}/auth/mfa/channels`,
      onboardingConsent: `${V1}/auth/mfa/onboarding-consent`,
      onboardingConsentRevoke: `${V1}/auth/mfa/onboarding-consent/revoke`,
    },
    invites: {
      preview: `${V1}/auth/invites/preview`,
      mine: `${V1}/auth/invites/mine`,
      accept: `${V1}/auth/invites/accept`,
      acceptById: (inviteId: string) => `${V1}/auth/invites/${inviteId}/accept`,
    },
    inbox: {
      list: `${V1}/auth/inbox`,
      markRead: `${V1}/auth/inbox/mark-read`,
      markAllRead: `${V1}/auth/inbox/mark-all-read`,
    },
  },

  /** Registry-driven tenant sidebar; server filters it to what the caller can read. */
  navigation: `${V1}/navigation`,

  workspaces: {
    list: `${V1}/workspaces`,
    create: `${V1}/workspaces`,
    update: (workspaceId: string) => `${V1}/workspaces/${workspaceId}`,
    remove: (workspaceId: string) => `${V1}/workspaces/${workspaceId}`,
  },

  team: {
    /** Paginated members. Resolves permissions for the page only — see server `teamSearch`. */
    membersSearch: `${V1}/team/members/search`,
    member: (userId: string) => `${V1}/team/members/${userId}`,
    invites: `${V1}/team/invites`,
    invite: (inviteId: string) => `${V1}/team/invites/${inviteId}`,
    inviteResend: (inviteId: string) => `${V1}/team/invites/${inviteId}/resend`,
    invitesSearch: `${V1}/team/invites/search`,
    invitesSearchSpec: `${V1}/team/invites/search-spec`,
    grantable: `${V1}/team/invites/grantable`,
    options: `${V1}/team/options`,
  },

  assistant: {
    quick: `${V1}/assistant/quick`,
    conversations: `${V1}/assistant/conversations`,
    conversation: (conversationId: string) => `${V1}/assistant/conversations/${conversationId}`,
    conversationMessages: (conversationId: string) =>
      `${V1}/assistant/conversations/${conversationId}/messages`,
  },

  automations: {
    /** Paginated list. POST because the query travels as a body — it reads, despite the verb. */
    search: `${V1}/automations/search`,
    /** Tab tallies for the whole workspace, not the current page. */
    statusCounts: `${V1}/automations/status-counts`,
    create: `${V1}/automations`,
    byId: (automationId: string) => `${V1}/automations/${automationId}`,
    wizardData: `${V1}/automations/wizard-data`,
  },

  scheduler: {
    platformAccounts: `${V1}/scheduler/platform-accounts`,
    platformAccount: (accountId: string) => `${V1}/scheduler/platform-accounts/${accountId}`,
    /** Paginated posts with text search over the caption. */
    postsSearch: `${V1}/scheduler/posts/search`,
    posts: `${V1}/scheduler/posts`,
    post: (postId: string) => `${V1}/scheduler/posts/${postId}`,
    postsCalendar: `${V1}/scheduler/posts/calendar`,
    publishNow: (postId: string) => `${V1}/scheduler/posts/${postId}/publish-now`,
    /** Re-runs the post-publish actions (first comment + comments toggle) for a published post. */
    retryPostPublish: (postId: string) => `${V1}/scheduler/posts/${postId}/retry-post-publish`,
    analyticsOverview: `${V1}/scheduler/analytics/overview`,
    analyticsPosts: `${V1}/scheduler/analytics/posts`,
    analyticsSync: `${V1}/scheduler/analytics/sync`,
    /** Suggested posting times. Buckets are UTC — the composer converts to its selected zone. */
    analyticsBestTimes: `${V1}/scheduler/analytics/best-times`,
    /** Probed on demand only (a Trial toggle click), never on composer open. */
    trialEligibility: `${V1}/scheduler/trial-eligibility`,
    /** One Graph probe per call — click-triggered (Add), never on keystroke. */
    collaboratorsValidate: `${V1}/scheduler/collaborators/validate`,
    mediaUpload: `${V1}/scheduler/media/post`,
    /** Reel cover from an uploaded image. */
    mediaCover: `${V1}/scheduler/media/cover`,
    /** Reel cover extracted from a frame of a Liffio-hosted video. */
    mediaCoverFromFrame: `${V1}/scheduler/media/cover-from-frame`,
  },

  biolink: {
    root: `${V1}/biolink`,
    analytics: `${V1}/biolink/analytics`,
    links: `${V1}/biolink/links`,
    linkItem: (linkId: string) => `${V1}/biolink/links/item/${linkId}`,
    linksReorder: `${V1}/biolink/links/reorder`,
    socials: `${V1}/biolink/socials`,
    socialItem: (socialId: string) => `${V1}/biolink/socials/item/${socialId}`,
    socialsReorder: `${V1}/biolink/socials/reorder`,
    reset: `${V1}/biolink/reset`,
  },

  shortlinks: {
    /** Paginated list. POST because the query travels as a body — it reads, despite the verb. */
    search: `${V1}/shortlinks/search`,
    create: `${V1}/shortlinks`,
    remove: (shortLinkId: string) => `${V1}/shortlinks/${shortLinkId}`,
    resolve: (slug: string) => `${V1}/shortlinks/resolve/${slug}`,
  },

  leads: {
    search: `${V1}/leads/search`,
    export: `${V1}/leads/export`,
  },

  analytics: {
    overview: `${V1}/analytics/overview`,
    page: `${V1}/analytics/page`,
    dashboard: `${V1}/analytics/dashboard`,
  },

  billing: {
    config: `${V1}/billing/config`,
    subscription: `${V1}/billing/subscription`,
    invoices: `${V1}/billing/invoices`,
    invoicesAll: `${V1}/billing/invoices/all`,
    checkout: `${V1}/billing/checkout`,
    portal: `${V1}/billing/portal`,
    sync: `${V1}/billing/sync`,
    cancel: `${V1}/billing/cancel`,
    razorpayVerify: `${V1}/billing/razorpay/verify`,
  },

  notifications: {
    list: `${V1}/notifications`,
    markRead: `${V1}/notifications/mark-read`,
    markAllRead: `${V1}/notifications/mark-all-read`,
    preferences: `${V1}/notifications/preferences`,
  },

  affiliate: {
    profile: `${V1}/affiliate/profile`,
    programConsent: `${V1}/affiliate/program-consent`,
    customCode: `${V1}/affiliate/custom-code`,
    links: `${V1}/affiliate/links`,
    dashboard: `${V1}/affiliate/dashboard`,
    commissions: `${V1}/affiliate/commissions`,
    referrals: `${V1}/affiliate/referrals`,
    payouts: `${V1}/affiliate/payouts`,
    payoutsKycStatus: `${V1}/affiliate/payouts/kyc-status`,
    payoutsRequest: `${V1}/affiliate/payouts/request`,
    validateCode: (code: string) => `${V1}/affiliate/validate-code/${encodeURIComponent(code)}`,
    summary: `${V1}/affiliate/summary`,
    kycStatus: `${V1}/affiliate/kyc/status`,
    kycSubmit: `${V1}/affiliate/kyc/submit`,
  },

  creator: {
    status: `${CREATOR_V1}/status`,
    profile: `${CREATOR_V1}/profile`,
    apply: `${CREATOR_V1}/apply`,
    thresholds: `${CREATOR_V1}/thresholds`,
  },

  agency: {
    brandByDomain: `${V1}/agency/brand/by-domain`,
    masterDashboard: `${V1}/agency/master-dashboard`,
    switchWorkspace: `${V1}/agency/switch-workspace`,
  },

  apiCredentials: {
    list: `${V1}/api-credentials`,
    create: `${V1}/api-credentials`,
    item: (credentialId: string) => `${V1}/api-credentials/${credentialId}`,
    plans: `${V1}/api-credentials/plans`,
  },

  drafts: {
    list: `${V1}/drafts`,
    item: (module: string, key: string) =>
      `${V1}/drafts/${encodeURIComponent(module)}/${encodeURIComponent(key)}`,
  },

  integrations: {
    meta: {
      oauthStart: `${V1}/integrations/meta/oauth/start`,
      unlink: `${V1}/integrations/meta/unlink`,
      instagramMusicSession: `${V1}/integrations/meta/instagram-music-session`,
    },
  },

  /**
   * Workspace-user-facing plugin surface (the superadmin console lives under
   * `admin.plugins`). These take the FULL manifest key (`plugin.user-audit`),
   * while SPA routes use the SHORT key (`/plugins/user-audit`) — the host page
   * derives full = `plugin.` + route param.
   */
  plugins: {
    /** Short-lived iframe token for the plugin's UI; 403 `PLUGIN_NOT_INCLUDED` when not entitled. */
    token: (key: string) => `${V1}/plugins/${encodeURIComponent(key)}/token`,
  },

  admin: {
    /**
     * Superadmin control plane. `platform:*` permissions are a different axis from workspace
     * RBAC — these endpoints are gated by the platform permission catalogue, not by
     * `module:action`, and never by a hardcoded superadmin flag on the client.
     */
    platform: {
      me: `${V1}/admin/platform/me`,
      permissions: `${V1}/admin/platform/permissions`,
      admins: (includeRevoked = false, q?: string) =>
        `${V1}/admin/platform/admins${listQs({ includeRevoked: includeRevoked || undefined, q })}`,
      adminsLookup: (q: string) => `${V1}/admin/platform/admins/lookup?q=${encodeURIComponent(q)}`,
      admin: (userId: string) => `${V1}/admin/platform/admins/${userId}`,
    },
    /** Platform-wide business metrics for the admin overview panel. Preset range or custom start/end days. */
    dashboard: {
      overview: (params: { range?: string; start?: string; end?: string }) =>
        `${V1}/admin/dashboard/overview${listQs(params)}`,
    },
    /**
     * User-management control plane (Phase 2). Keyset-paginated list — query params match the
     * frozen contract in `plan/PHASE-2-user-management.md` §"Response contract" verbatim
     * (snake_case on the wire, including `has_mfa`/`workspace_status`/`created_after`/
     * `created_before`, even though the JSON body itself is camelCase).
     */
    users: {
      list: (
        params: {
          cursor?: string;
          limit?: number;
          q?: string;
          sort?: "created_at" | "email" | "name";
          dir?: "asc" | "desc";
          status?: "active" | "inactive" | "banned";
          plan?: string;
          verified?: boolean;
          has_mfa?: boolean;
          workspace_status?: string;
          created_after?: string;
          created_before?: string;
        } = {},
      ) => `${V1}/admin/users${listQs(params)}`,
      /** Profile+status detail — Task 6 endpoint 1 (`plan/PHASE-2-user-management.md`). */
      detail: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}`,
      /** One row per workspace membership — Task 6 endpoint 2. */
      workspaces: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces`,
      /** Active (non-revoked, non-expired) refresh-token sessions — Task 6 endpoint 3. */
      sessions: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/sessions`,
      /** Keyset-paginated audit trail (actor OR on-behalf-of) — Task 6 endpoint 4. */
      audit: (userId: string, params: { cursor?: string; limit?: number } = {}) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/audit${listQs(params)}`,
      /**
       * Resolved effective access for one user in one workspace — Task 9's resolver. Folds all
       * five layers (package/workspace-override/role/user-override/ABAC) with provenance; read
       * by the Phase 3 drill-down (Task 10), read-only.
       */
      effectiveAccess: (userId: string, workspaceId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/effective-access`,
      /**
       * User-level entitlement mutations (Task 12, consumed by the Task 13 drill-down editor).
       * All scoped `:id/workspaces/:workspaceId/...`, matching this file's existing param names.
       */
      moduleOverridesBulk: (userId: string, workspaceId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/module-overrides/bulk`,
      permissionOverride: (userId: string, workspaceId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/permission-override`,
      permissionOverrideItem: (userId: string, workspaceId: string, overrideId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/permission-override/${encodeURIComponent(overrideId)}`,
      role: (userId: string, workspaceId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/role`,
      policy: (userId: string, workspaceId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/policy`,
      policyItem: (userId: string, workspaceId: string, assignmentId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/workspaces/${encodeURIComponent(workspaceId)}/policy/${encodeURIComponent(assignmentId)}`,
      /**
       * Identity & security mutations (Task 14, consumed by the Task 15 action bar / danger
       * zone). `PATCH` on `detail(userId)` above IS `updateUserProfile` — same path, different
       * method, no separate builder needed.
       */
      deactivate: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/deactivate`,
      activate: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/activate`,
      forcePasswordReset: (userId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/force-password-reset`,
      setPassword: (userId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/set-password`,
      revokeSessions: (userId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/revoke-sessions`,
      resetMfa: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/reset-mfa`,
      verifyEmail: (userId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/verify-email`,
      resendVerification: (userId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/resend-verification`,
      changeEmail: (userId: string) =>
        `${V1}/admin/users/${encodeURIComponent(userId)}/change-email`,
      googleLink: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/google-link`,
      /** Ban/unban/notes — legacy carry-over routes (task-5), not part of Task 14's set but
       *  needed by the Task 15 action bar / Overview notes editor; were missing from this module
       *  before this task added them. */
      ban: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/ban`,
      unban: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/unban`,
      notes: (userId: string) => `${V1}/admin/users/${encodeURIComponent(userId)}/notes`,
    },
    /**
     * Workspace-level entitlement mutations (Task 11, consumed by the Task 13 drill-down editor).
     * Distinct from `packages.assignment` below (the pre-existing Packages-console endpoint,
     * `PUT`/`DELETE /admin/packages/assignments/:workspaceId`) — task-11-report.md §1 documents
     * these as a second HTTP entry point onto the SAME `assignWorkspacePackage`/
     * `clearWorkspacePackage` service functions ("one write path, two consoles"), not a
     * duplicated write path.
     */
    workspaces: {
      package: (workspaceId: string) =>
        `${V1}/admin/workspaces/${encodeURIComponent(workspaceId)}/package`,
      limits: (workspaceId: string) =>
        `${V1}/admin/workspaces/${encodeURIComponent(workspaceId)}/limits`,
    },
    audit: (params: Record<string, string | number | boolean | undefined> = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") qs.set(k, String(v));
      }
      const suffix = qs.toString();
      return `${V1}/admin/audit${suffix ? `?${suffix}` : ""}`;
    },
    auditActions: `${V1}/admin/audit/actions`,
    /**
     * Module registry + packages. Lists take page/limit/q — the server filters and counts in SQL,
     * so the client never fetches a table to search it locally.
     */
    registry: {
      tree: `${V1}/admin/registry/tree`,
      parents: (p: { page?: number; limit?: number; q?: string } = {}) =>
        `${V1}/admin/registry/parents${listQs(p)}`,
      parent: (id: string) => `${V1}/admin/registry/parents/${id}`,
      /** What disabling this module would take offline — backs the confirmation dialog. */
      parentImpact: (id: string) => `${V1}/admin/registry/parents/${id}/impact`,
      children: (p: { page?: number; limit?: number; q?: string; parentModuleId?: string } = {}) =>
        `${V1}/admin/registry/children${listQs(p)}`,
      child: (id: string) => `${V1}/admin/registry/children/${id}`,
      mappings: `${V1}/admin/registry/mappings`,
      mapping: (parentModuleId: string, childModuleId: string) =>
        `${V1}/admin/registry/mappings?parentModuleId=${parentModuleId}&childModuleId=${childModuleId}`,
      codegen: (parentKey?: string) =>
        `${V1}/admin/registry/codegen${parentKey ? `?parentKey=${encodeURIComponent(parentKey)}` : ""}`,
    },
    packages: {
      list: (p: { page?: number; limit?: number; q?: string } = {}) =>
        `${V1}/admin/packages${listQs(p)}`,
      item: (id: string) => `${V1}/admin/packages/${id}`,
      features: (id: string) => `${V1}/admin/packages/${id}/features`,
      limits: (id: string) => `${V1}/admin/packages/${id}/limits`,
      publishStatus: (id: string) => `${V1}/admin/packages/${id}/publish-status`,
      publish: (id: string) => `${V1}/admin/packages/${id}/publish`,
      /**
       * Force the saved contents live for every workspace on this package, now.
       *
       * Distinct from `publish`, which pushes prices to Stripe/Razorpay. This one touches no
       * provider — it reconciles entitlement and tells connected members.
       */
      applyLive: (id: string) => `${V1}/admin/packages/${id}/apply-live`,
      /**
       * Workspace ↔ package assignment. Keyed by workspace, not by package, because a workspace
       * has at most one package — the unique index on `workspace_packages.workspace_id` is what
       * makes "which package is this tenant on" a question with one answer.
       *
       * A workspace with no assignment is **unrestricted**, not entitled to nothing. These three
       * endpoints are the only way a ceiling ever comes into existence.
       */
      assignment: (workspaceId: string) => `${V1}/admin/packages/assignments/${workspaceId}`,
      /** Workspaces with their current package and member count; server-side search and paging. */
      assignments: (p: { page?: number; limit?: number; q?: string } = {}) =>
        `${V1}/admin/packages/assignments${listQs(p)}`,
    },
    /** Per-user access matrix (module × action) for a workspace. */
    access: {
      catalogue: `${V1}/admin/access/catalogue`,
      users: (q: string) => `${V1}/admin/access/users?q=${encodeURIComponent(q)}`,
      workspaces: (userIds: string[]) =>
        `${V1}/admin/access/workspaces?userIds=${encodeURIComponent(userIds.join(","))}`,
      state: (userIds: string[], workspaceId: string) =>
        `${V1}/admin/access/state?userIds=${encodeURIComponent(userIds.join(","))}&workspaceId=${workspaceId}`,
      matrix: `${V1}/admin/access/matrix`,
    },
    rbac: {
      overview: `${V1}/admin/rbac/overview`,
      rolePermissions: (roleKey: string) => `${V1}/admin/rbac/roles/${roleKey}/permissions`,
      userWorkspaceAccess: (userId: string, workspaceId: string) =>
        `${V1}/admin/rbac/users/${userId}/workspaces/${workspaceId}/access`,
      grantPlan: `${V1}/admin/rbac/grant-plan`,
      subscription: (workspaceId: string) => `${V1}/admin/rbac/subscription/${workspaceId}`,
    },
    emailTemplates: {
      list: `${V1}/admin/email-templates`,
      create: `${V1}/admin/email-templates`,
      item: (category: string, key: string) => `${V1}/admin/email-templates/${category}/${key}`,
      codeHtml: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/code-html`,
      renderedCodeHtml: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/rendered-code-html`,
      brevoHtml: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/brevo-html`,
      brevoSync: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/brevo-sync`,
      source: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/source`,
      publish: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/publish`,
      preview: (category: string, key: string) =>
        `${V1}/admin/email-templates/${category}/${key}/preview`,
    },
    affiliate: {
      overview: `${V1}/admin/affiliate/overview`,
      list: `${V1}/admin/affiliate/list`,
      payouts: `${V1}/admin/affiliate/payouts`,
      fraudFlagged: `${V1}/admin/affiliate/fraud/flagged`,
      statsMonthly: `${V1}/admin/affiliate/stats/monthly`,
      statsTopAffiliates: `${V1}/admin/affiliate/stats/top-affiliates`,
      payoutApprove: (payoutId: string) => `${V1}/admin/affiliate/payouts/${payoutId}/approve`,
      payoutReject: (payoutId: string) => `${V1}/admin/affiliate/payouts/${payoutId}/reject`,
      payoutMarkPaid: (payoutId: string) => `${V1}/admin/affiliate/payouts/${payoutId}/mark-paid`,
      referralApprove: (referralId: string) =>
        `${V1}/admin/affiliate/referrals/${referralId}/approve`,
      commissionClawback: (commissionId: string) =>
        `${V1}/admin/affiliate/commissions/${commissionId}/clawback`,
      byId: (affiliateId: string) => `${V1}/admin/affiliate/${affiliateId}`,
      suspend: (affiliateId: string) => `${V1}/admin/affiliate/${affiliateId}/suspend`,
      unsuspend: (affiliateId: string) => `${V1}/admin/affiliate/${affiliateId}/unsuspend`,
      kycQueue: `${V1}/admin/affiliate/kyc/queue`,
      kycApprove: (submissionId: string) => `${V1}/admin/affiliate/kyc/${submissionId}/approve`,
      kycReject: (submissionId: string) => `${V1}/admin/affiliate/kyc/${submissionId}/reject`,
    },
    creator: {
      applications: (params: { page?: number; limit?: number; state?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", String(params.page));
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.state) qs.set("state", params.state);
        const suffix = qs.toString();
        return `${CREATOR_V1}/admin/applications${suffix ? `?${suffix}` : ""}`;
      },
      application: (id: string) => `${CREATOR_V1}/admin/applications/${id}`,
      approve: (id: string) => `${CREATOR_V1}/admin/applications/${id}/approve`,
      reject: (id: string) => `${CREATOR_V1}/admin/applications/${id}/reject`,
      overview: `${CREATOR_V1}/admin/overview`,
      creator: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}`,
      override: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}/override`,
      settings: `${CREATOR_V1}/admin/settings`,
      // Phase 6 — Creator Management Dashboard (ENDPOINT-CONTRACT.md §6)
      list: (params: { limit?: number; cursor?: string; search?: string; state?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.cursor) qs.set("cursor", params.cursor);
        if (params.search) qs.set("search", params.search);
        if (params.state) qs.set("state", params.state);
        const suffix = qs.toString();
        return `${CREATOR_V1}/admin/creators${suffix ? `?${suffix}` : ""}`;
      },
      pause: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}/pause`,
      reactivate: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}/reactivate`,
      remove: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}/remove`,
      forceEligibilityCheck: (profileId: string) =>
        `${CREATOR_V1}/admin/creators/${profileId}/force-eligibility-check`,
      forceHealthCheck: (profileId: string) =>
        `${CREATOR_V1}/admin/creators/${profileId}/force-health-check`,
      forceMetricsSync: (profileId: string) =>
        `${CREATOR_V1}/admin/creators/${profileId}/force-metrics-sync`,
      plan: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}/plan`,
      notes: (profileId: string) => `${CREATOR_V1}/admin/creators/${profileId}/notes`,
      bulk: (
        action: "pause" | "reactivate" | "force-health-check" | "force-metrics-sync" | "export",
        params: { state?: string; search?: string } = {},
      ) => {
        const qs = new URLSearchParams();
        if (params.state) qs.set("state", params.state);
        if (params.search) qs.set("search", params.search);
        const suffix = qs.toString();
        return `${CREATOR_V1}/admin/creators/bulk/${action}${suffix ? `?${suffix}` : ""}`;
      },
      analytics: `${CREATOR_V1}/admin/analytics`,
      // Section 7 additions (ENDPOINT-CONTRACT.md §7)
      waitlist: (params: { limit?: number; cursor?: string } = {}) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.cursor) qs.set("cursor", params.cursor);
        const suffix = qs.toString();
        return `${CREATOR_V1}/admin/waitlist${suffix ? `?${suffix}` : ""}`;
      },
      auditLog: (
        params: {
          creatorProfileId?: string;
          decisionType?: string;
          from?: string;
          to?: string;
          limit?: number;
          cursor?: string;
        } = {},
      ) => {
        const qs = new URLSearchParams();
        if (params.creatorProfileId) qs.set("creatorProfileId", params.creatorProfileId);
        if (params.decisionType) qs.set("decisionType", params.decisionType);
        if (params.from) qs.set("from", params.from);
        if (params.to) qs.set("to", params.to);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.cursor) qs.set("cursor", params.cursor);
        const suffix = qs.toString();
        return `${CREATOR_V1}/admin/audit-log${suffix ? `?${suffix}` : ""}`;
      },
    },
    aiTokens: {
      settings: `${V1}/admin/ai-tokens/settings`,
      plans: `${V1}/admin/ai-tokens/plans`,
      plan: (planKey: string) => `${V1}/admin/ai-tokens/plans/${planKey}`,
      features: `${V1}/admin/ai-tokens/features`,
      feature: (featureKey: string) =>
        `${V1}/admin/ai-tokens/features/${encodeURIComponent(featureKey)}`,
      workspaces: (
        params: {
          limit?: number;
          offset?: number;
          workspaceId?: string;
          sortBy?: "consumed" | "percent" | "remaining";
        } = {},
      ) => {
        const qs = new URLSearchParams();
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.offset) qs.set("offset", String(params.offset));
        if (params.workspaceId) qs.set("workspaceId", params.workspaceId);
        if (params.sortBy) qs.set("sortBy", params.sortBy);
        const suffix = qs.toString();
        return `${V1}/admin/ai-tokens/workspaces${suffix ? `?${suffix}` : ""}`;
      },
      workspaceLedger: (workspaceId: string) =>
        `${V1}/admin/ai-tokens/workspaces/${workspaceId}/ledger`,
      workspaceGrant: (workspaceId: string) =>
        `${V1}/admin/ai-tokens/workspaces/${workspaceId}/grant`,
      ledger: (
        params: {
          workspaceId?: string;
          entryType?: string;
          from?: string;
          to?: string;
          limit?: number;
          offset?: number;
        } = {},
      ) => {
        const qs = new URLSearchParams();
        if (params.workspaceId) qs.set("workspaceId", params.workspaceId);
        if (params.entryType) qs.set("entryType", params.entryType);
        if (params.from) qs.set("from", params.from);
        if (params.to) qs.set("to", params.to);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.offset) qs.set("offset", String(params.offset));
        const suffix = qs.toString();
        return `${V1}/admin/ai-tokens/ledger${suffix ? `?${suffix}` : ""}`;
      },
    },
    /**
     * Plugin lifecycle console. Every endpoint is gated by `platform:plugin_manage`; lifecycle
     * writes additionally carry a 6-digit authenticator code in the body (`confirmCode`).
     */
    plugins: {
      list: (p: { page?: number; limit?: number; q?: string } = {}) =>
        `${V1}/admin/plugins${listQs(p)}`,
      detail: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}`,
      upload: `${V1}/admin/plugins/upload`,
      activate: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/activate`,
      deactivate: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/deactivate`,
      rollback: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/rollback`,
      uninstall: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/uninstall`,
      purgeData: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/purge-data`,
      exposure: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/exposure`,
      /** Grant surfaces (super-admin only; no TOTP — grants are data-only and reversible). */
      grants: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/grants`,
      workspaceGrant: (key: string) =>
        `${V1}/admin/plugins/${encodeURIComponent(key)}/grants/workspace`,
      userGrant: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/grants/user`,
      packages: (key: string) => `${V1}/admin/plugins/${encodeURIComponent(key)}/packages`,
      packageDetach: (key: string, packageId: string) =>
        `${V1}/admin/plugins/${encodeURIComponent(key)}/packages/${encodeURIComponent(packageId)}`,
      /**
       * The Ed25519 public key uploads are verified against — formerly the `PLUGIN_PUBLIC_KEY`
       * env var. Reading is open to `platform:plugin_manage`; the three mutations are
       * super-admin-only and carry `confirmCode` in the body, which is why revoke is a POST.
       */
      signingKeys: `${V1}/admin/plugins/signing-keys`,
      generateSigningKey: `${V1}/admin/plugins/signing-keys/generate`,
      revokeSigningKey: (id: string) => `${V1}/admin/plugins/signing-keys/${id}/revoke`,
    },
  },

  marketing: {
    plans: `${V1}/marketing/plans`,
    affiliateCalculatorConfig: `${V1}/public/marketing/affiliate-calculator-config`,
  },

  public: {
    biolink: `${V1}/public/biolink`,
    biolinkClick: `${V1}/public/biolink/click`,
    shortlink: (slug: string) => `${V1}/public/shortlinks/${encodeURIComponent(slug)}`,
    leadsCaptured: (slug: string) => `${V1}/public/leads-captured/${encodeURIComponent(slug)}`,
  },

  liffio: {
    lyra: `${V1}/liffio/Lyra`,
  },

  aiTokens: {
    balance: `${V1}/ai-tokens/balance`,
  },
} as const;
