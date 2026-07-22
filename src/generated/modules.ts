/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: the module registry (`parent_modules` / `child_modules` / `module_mappings`),
 * edited in Superadmin → Module Registry.
 *
 * Regenerate with:  npm run modules:codegen        (from server/)
 * Verify with:      npm run modules:codegen:check
 *
 * Import these constants instead of writing module keys as strings — a literal typo compiles
 * fine and fails silently at runtime, whereas a missing constant is a build error.
 */

/** Every enabled parent module. */
export const MODULES = {
  AFFILIATE: "affiliate",
  AGENCY: "agency",
  ANALYTICS: "analytics",
  API: "api",
  AUTH: "auth",
  AUTOMATION: "automation",
  BILLING: "billing",
  BIOLINK: "biolink",
  DEV: "dev",
  LEAD: "lead",
  NAV_CREATOR_PROGRAM: "nav_creator_program",
  NAV_SETTINGS: "nav_settings",
  SCHEDULER: "scheduler",
  SHORTLINK: "shortlink",
  TEAM: "team",
  WORKSPACE: "workspace",
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

/** Affiliate capabilities. */
export const AFFILIATE_CAPABILITIES = {
  BALANCE: "affiliate:balance",
  CLICK_STATS: "affiliate:click_stats",
  COMMISSION_LEDGER: "affiliate:commission_ledger",
  CUSTOM_CODE: "affiliate:custom_code",
  KYC: "affiliate:kyc",
  PAYOUT_METHOD: "affiliate:payout_method",
  PAYOUT_REQUEST: "affiliate:payout_request",
  REFERRAL_LINK: "affiliate:referral_link",
  REFERRAL_LIST: "affiliate:referral_list",
  TDS_VIEW: "affiliate:tds_view",
} as const;

/** Agency capabilities. */
export const AGENCY_CAPABILITIES = {
  BRANDING: "agency:branding",
  CLIENT_WORKSPACES: "agency:client_workspaces",
  CUSTOM_DOMAIN: "agency:custom_domain",
  DOMAIN_VERIFICATION: "agency:domain_verification",
  HIDE_BRANDING: "agency:hide_branding",
  SHORTLINK_DOMAIN: "agency:shortlink_domain",
  THEME_COLOR: "agency:theme_color",
} as const;

/** Analytics capabilities. */
export const ANALYTICS_CAPABILITIES = {
  AUTOMATION_ATTRIBUTION: "analytics:automation_attribution",
  CONVERSION_RATE: "analytics:conversion_rate",
  EXPORT_DATA: "analytics:export_data",
  OVERVIEW: "analytics:overview",
  POST_METRICS: "analytics:post_metrics",
  PROFILE_OUTCOMES: "analytics:profile_outcomes",
  STORY_METRICS: "analytics:story_metrics",
  TIME_SERIES: "analytics:time_series",
  VIDEO_METRICS: "analytics:video_metrics",
} as const;

/** API capabilities. */
export const API_CAPABILITIES = {
  CREATE_KEYS: "api:create_keys",
  DOCS_ACCESS: "api:docs_access",
  KEY_EXPIRY: "api:key_expiry",
  REVOKE_KEYS: "api:revoke_keys",
  USAGE_STATS: "api:usage_stats",
  VIEW_KEYS: "api:view_keys",
} as const;

/** Automations capabilities. */
export const AUTOMATION_CAPABILITIES = {
  ANY_COMMENT: "automation:any_comment",
  BLOCK_AUTO_REPLY: "automation:block_auto_reply",
  BLOCK_BUTTON: "automation:block_button",
  BLOCK_DM_MESSAGE: "automation:block_dm_message",
  DM_BUTTON: "automation:dm_button",
  DM_BUTTON_TRACKING: "automation:dm_button_tracking",
  EXCLUDED_KEYWORDS: "automation:excluded_keywords",
  FOLLOW_BEFORE_DM: "automation:follow_before_dm",
  KEYWORDS: "automation:keywords",
  POST_SCOPE_ANY: "automation:post_scope_any",
  POST_SCOPE_NEXT: "automation:post_scope_next",
  POST_SCOPE_SPECIFIC: "automation:post_scope_specific",
  PUBLIC_AUTO_REPLY: "automation:public_auto_reply",
  REPLY_VARIANTS: "automation:reply_variants",
  TRIGGER_BLOCKS: "automation:trigger_blocks",
} as const;

/** Billing capabilities. */
export const BILLING_CAPABILITIES = {
  CANCEL: "billing:cancel",
  CHANGE_PLAN: "billing:change_plan",
  INVOICES: "billing:invoices",
  PAYMENT_METHOD: "billing:payment_method",
  USAGE_LIMITS: "billing:usage_limits",
  VIEW_SUBSCRIPTION: "billing:view_subscription",
} as const;

/** Bio Link capabilities. */
export const BIOLINK_CAPABILITIES = {
  CLICK_TRACKING: "biolink:click_tracking",
  CUSTOM_SLUG: "biolink:custom_slug",
  HIDE_BADGE: "biolink:hide_badge",
  ITEM_ICONS: "biolink:item_icons",
  ITEM_ORDERING: "biolink:item_ordering",
  ITEM_THUMBNAILS: "biolink:item_thumbnails",
  ITEM_VISIBILITY: "biolink:item_visibility",
  LINK_ITEMS: "biolink:link_items",
  PROFILE: "biolink:profile",
  SOCIAL_LINKS: "biolink:social_links",
  SOCIAL_ORDERING: "biolink:social_ordering",
} as const;

/** Leads capabilities. */
export const LEAD_CAPABILITIES = {
  CLICK_STATE: "lead:click_state",
  EXPORT_DATA: "lead:export_data",
  FOLLOW_STATE: "lead:follow_state",
  INTERACTION_TIMELINE: "lead:interaction_timeline",
  SOURCE_MEDIA: "lead:source_media",
  TRIGGER_PROVENANCE: "lead:trigger_provenance",
  VIEW_EMAIL: "lead:view_email",
  VIEW_IDENTITY: "lead:view_identity",
} as const;

/** Post Scheduler capabilities. */
export const SCHEDULER_CAPABILITIES = {
  ACTIVITY_LOG: "scheduler:activity_log",
  ALT_TEXT: "scheduler:alt_text",
  APPROVAL_WORKFLOW: "scheduler:approval_workflow",
  APPROVE_POSTS: "scheduler:approve_posts",
  BULK_UPLOAD: "scheduler:bulk_upload",
  CAPTION_TEMPLATES: "scheduler:caption_templates",
  COVER_SELECTION: "scheduler:cover_selection",
  FIRST_COMMENT: "scheduler:first_comment",
  HASHTAG_GROUPS: "scheduler:hashtag_groups",
  LOCATION_TAG: "scheduler:location_tag",
  MEDIA_LIBRARY: "scheduler:media_library",
  MUSIC: "scheduler:music",
  MUSIC_VOLUME: "scheduler:music_volume",
  POST_CAROUSEL: "scheduler:post_carousel",
  POST_FEED: "scheduler:post_feed",
  POST_REEL: "scheduler:post_reel",
  POST_STORY: "scheduler:post_story",
  SCHEDULE_TEMPLATES: "scheduler:schedule_templates",
  SHARE_TO_FEED: "scheduler:share_to_feed",
  THUMBNAIL_OFFSET: "scheduler:thumbnail_offset",
  TIMEZONE_SCHEDULING: "scheduler:timezone_scheduling",
} as const;

/** Short Links capabilities. */
export const SHORTLINK_CAPABILITIES = {
  CLICK_TRACKING: "shortlink:click_tracking",
  CUSTOM_DOMAIN: "shortlink:custom_domain",
  CUSTOM_SLUG: "shortlink:custom_slug",
  EDIT_DESTINATION: "shortlink:edit_destination",
  LEAD_ATTRIBUTION: "shortlink:lead_attribution",
  TOGGLE_ACTIVE: "shortlink:toggle_active",
} as const;

/** Team capabilities. */
export const TEAM_CAPABILITIES = {
  ASSIGN_ROLES: "team:assign_roles",
  REMOVE_MEMBERS: "team:remove_members",
  RESEND_INVITE: "team:resend_invite",
  REVOKE_INVITE: "team:revoke_invite",
  VIEW_MEMBERS: "team:view_members",
} as const;

/** Workspaces capabilities. */
export const WORKSPACE_CAPABILITIES = {
  DRAFTS: "workspace:drafts",
  INSTAGRAM_CONNECT: "workspace:instagram_connect",
  RENAME: "workspace:rename",
  SWITCH: "workspace:switch",
} as const;

/** Capabilities grouped by their parent module key, for iteration. */
export const CAPABILITIES_BY_MODULE = {
  [MODULES.AFFILIATE]: AFFILIATE_CAPABILITIES,
  [MODULES.AGENCY]: AGENCY_CAPABILITIES,
  [MODULES.ANALYTICS]: ANALYTICS_CAPABILITIES,
  [MODULES.API]: API_CAPABILITIES,
  [MODULES.AUTOMATION]: AUTOMATION_CAPABILITIES,
  [MODULES.BILLING]: BILLING_CAPABILITIES,
  [MODULES.BIOLINK]: BIOLINK_CAPABILITIES,
  [MODULES.LEAD]: LEAD_CAPABILITIES,
  [MODULES.SCHEDULER]: SCHEDULER_CAPABILITIES,
  [MODULES.SHORTLINK]: SHORTLINK_CAPABILITIES,
  [MODULES.TEAM]: TEAM_CAPABILITIES,
  [MODULES.WORKSPACE]: WORKSPACE_CAPABILITIES,
} as const;

/** Every capability key in the registry — useful for exhaustive checks. */
export const ALL_CAPABILITY_KEYS = [
  "affiliate:balance",
  "affiliate:click_stats",
  "affiliate:commission_ledger",
  "affiliate:custom_code",
  "affiliate:kyc",
  "affiliate:payout_method",
  "affiliate:payout_request",
  "affiliate:referral_link",
  "affiliate:referral_list",
  "affiliate:tds_view",
  "agency:branding",
  "agency:client_workspaces",
  "agency:custom_domain",
  "agency:domain_verification",
  "agency:hide_branding",
  "agency:shortlink_domain",
  "agency:theme_color",
  "analytics:automation_attribution",
  "analytics:conversion_rate",
  "analytics:export_data",
  "analytics:overview",
  "analytics:post_metrics",
  "analytics:profile_outcomes",
  "analytics:story_metrics",
  "analytics:time_series",
  "analytics:video_metrics",
  "api:create_keys",
  "api:docs_access",
  "api:key_expiry",
  "api:revoke_keys",
  "api:usage_stats",
  "api:view_keys",
  "automation:any_comment",
  "automation:block_auto_reply",
  "automation:block_button",
  "automation:block_dm_message",
  "automation:dm_button",
  "automation:dm_button_tracking",
  "automation:excluded_keywords",
  "automation:follow_before_dm",
  "automation:keywords",
  "automation:post_scope_any",
  "automation:post_scope_next",
  "automation:post_scope_specific",
  "automation:public_auto_reply",
  "automation:reply_variants",
  "automation:trigger_blocks",
  "billing:cancel",
  "billing:change_plan",
  "billing:invoices",
  "billing:payment_method",
  "billing:usage_limits",
  "billing:view_subscription",
  "biolink:click_tracking",
  "biolink:custom_slug",
  "biolink:hide_badge",
  "biolink:item_icons",
  "biolink:item_ordering",
  "biolink:item_thumbnails",
  "biolink:item_visibility",
  "biolink:link_items",
  "biolink:profile",
  "biolink:social_links",
  "biolink:social_ordering",
  "lead:click_state",
  "lead:export_data",
  "lead:follow_state",
  "lead:interaction_timeline",
  "lead:source_media",
  "lead:trigger_provenance",
  "lead:view_email",
  "lead:view_identity",
  "scheduler:activity_log",
  "scheduler:alt_text",
  "scheduler:approval_workflow",
  "scheduler:approve_posts",
  "scheduler:bulk_upload",
  "scheduler:caption_templates",
  "scheduler:cover_selection",
  "scheduler:first_comment",
  "scheduler:hashtag_groups",
  "scheduler:location_tag",
  "scheduler:media_library",
  "scheduler:music",
  "scheduler:music_volume",
  "scheduler:post_carousel",
  "scheduler:post_feed",
  "scheduler:post_reel",
  "scheduler:post_story",
  "scheduler:schedule_templates",
  "scheduler:share_to_feed",
  "scheduler:thumbnail_offset",
  "scheduler:timezone_scheduling",
  "shortlink:click_tracking",
  "shortlink:custom_domain",
  "shortlink:custom_slug",
  "shortlink:edit_destination",
  "shortlink:lead_attribution",
  "shortlink:toggle_active",
  "team:assign_roles",
  "team:remove_members",
  "team:resend_invite",
  "team:revoke_invite",
  "team:view_members",
  "workspace:drafts",
  "workspace:instagram_connect",
  "workspace:rename",
  "workspace:switch",
] as const;

export type CapabilityKey = (typeof ALL_CAPABILITY_KEYS)[number];
