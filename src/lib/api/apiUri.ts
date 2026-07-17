/**
 * Central API route registry — the single source of truth for every backend
 * endpoint the client calls. No component or hook may hardcode an API path;
 * always import from here.
 *
 * Static endpoints are strings; parametrized endpoints are functions that
 * return the final path. Query strings are appended by the module api files.
 */

const V1 = "/api/v1";

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

  workspaces: {
    list: `${V1}/workspaces`,
    create: `${V1}/workspaces`,
    update: (workspaceId: string) => `${V1}/workspaces/${workspaceId}`,
    remove: (workspaceId: string) => `${V1}/workspaces/${workspaceId}`,
  },

  team: {
    members: `${V1}/team/members`,
    member: (userId: string) => `${V1}/team/members/${userId}`,
    invites: `${V1}/team/invites`,
    invite: (inviteId: string) => `${V1}/team/invites/${inviteId}`,
    options: `${V1}/team/options`,
  },

  automations: {
    list: `${V1}/automations`,
    create: `${V1}/automations`,
    byId: (automationId: string) => `${V1}/automations/${automationId}`,
    wizardData: `${V1}/automations/wizard-data`,
  },

  scheduler: {
    musicSearch: `${V1}/scheduler/music/search`,
    platformAccounts: `${V1}/scheduler/platform-accounts`,
    platformAccount: (accountId: string) => `${V1}/scheduler/platform-accounts/${accountId}`,
    posts: `${V1}/scheduler/posts`,
    post: (postId: string) => `${V1}/scheduler/posts/${postId}`,
    postsCalendar: `${V1}/scheduler/posts/calendar`,
    publishNow: (postId: string) => `${V1}/scheduler/posts/${postId}/publish-now`,
    analyticsOverview: `${V1}/scheduler/analytics/overview`,
    analyticsPosts: `${V1}/scheduler/analytics/posts`,
    analyticsSync: `${V1}/scheduler/analytics/sync`,
    mediaUpload: `${V1}/scheduler/media/post`,
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
    list: `${V1}/shortlinks`,
    create: `${V1}/shortlinks`,
    remove: (shortLinkId: string) => `${V1}/shortlinks/${shortLinkId}`,
    resolve: (slug: string) => `${V1}/shortlinks/resolve/${slug}`,
  },

  leads: {
    list: `${V1}/leads`,
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

  admin: {
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
