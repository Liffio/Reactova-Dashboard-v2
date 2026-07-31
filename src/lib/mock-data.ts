// Mock data for the Liffio dashboard preview.

export const stats = {
  dmsSent: 24817,
  dmsDelta: 0.184,
  commentsTriggered: 31204,
  commentsDelta: 0.092,
  leadsCaptured: 1842,
  leadsDelta: 0.241,
  clickThrough: 0.378,
  clickDelta: -0.021,
  followConv: 0.412,
  revenueAttributed: 18420,
};

export const funnel = [
  { stage: "Comments", value: 31204 },
  { stage: "DMs sent", value: 24817 },
  { stage: "Replied", value: 14903 },
  { stage: "Clicked link", value: 9384 },
  { stage: "Captured lead", value: 1842 },
  { stage: "Converted", value: 412 },
];

export const dmTrend = Array.from({ length: 14 }, (_, i) => {
  const base = 1200 + i * 60;
  return {
    day: `D${i + 1}`,
    dms: Math.round(base + Math.sin(i) * 280 + Math.random() * 220),
    clicks: Math.round((base + Math.sin(i) * 280) * 0.42 + Math.random() * 80),
  };
});

export const accounts = [
  { handle: "@oat.studio", followers: 84210, dms: 9120, status: "active" as const },
  { handle: "@brewlab.co", followers: 32450, dms: 6240, status: "active" as const },
  { handle: "@fern.fitness", followers: 128900, dms: 5430, status: "paused" as const },
  { handle: "@maker.daily", followers: 19840, dms: 4027, status: "active" as const },
];

export const campaigns = [
  {
    id: "c1",
    name: "Launch waitlist — Reel 'AI scripting'",
    trigger: "Comment keyword",
    keywords: ["GUIDE", "ACCESS", "PDF"],
    account: "@oat.studio",
    status: "live" as const,
    sent: 4820,
    replied: 2914,
    clicked: 1832,
    leads: 412,
    updated: "2h ago",
  },
  {
    id: "c2",
    name: "Story reply → discount code",
    trigger: "Story reply",
    keywords: ["YES", "ME"],
    account: "@brewlab.co",
    status: "live" as const,
    sent: 2104,
    replied: 1620,
    clicked: 940,
    leads: 287,
    updated: "5h ago",
  },
  {
    id: "c3",
    name: "Welcome new followers",
    trigger: "New follower",
    keywords: [],
    account: "@maker.daily",
    status: "live" as const,
    sent: 1287,
    replied: 480,
    clicked: 211,
    leads: 64,
    updated: "1d ago",
  },
  {
    id: "c4",
    name: "Re-engage cold commenters",
    trigger: "Re-engagement",
    keywords: [],
    account: "@fern.fitness",
    status: "paused" as const,
    sent: 643,
    replied: 198,
    clicked: 92,
    leads: 31,
    updated: "3d ago",
  },
  {
    id: "c5",
    name: "Live keyword → free chapter",
    trigger: "Live comment",
    keywords: ["CHAPTER"],
    account: "@oat.studio",
    status: "draft" as const,
    sent: 0,
    replied: 0,
    clicked: 0,
    leads: 0,
    updated: "just now",
  },
];

export const leads = [
  {
    id: "l1",
    handle: "@nora.builds",
    name: "Nora P.",
    email: "nora@buildlab.co",
    source: "Launch waitlist",
    campaign: "c1",
    capturedAt: "2026-06-10 09:14",
    tags: ["waitlist"],
  },
  {
    id: "l2",
    handle: "@ezra.eats",
    name: "Ezra K.",
    email: "ezra+ig@hey.com",
    source: "Story reply",
    campaign: "c2",
    capturedAt: "2026-06-10 08:51",
    tags: ["discount"],
  },
  {
    id: "l3",
    handle: "@runs.with.mira",
    name: "Mira O.",
    email: "mira@runslow.app",
    source: "Launch waitlist",
    campaign: "c1",
    capturedAt: "2026-06-10 08:32",
    tags: ["waitlist", "creator"],
  },
  {
    id: "l4",
    handle: "@cafe.fume",
    name: "Tao L.",
    email: "hello@fume.cafe",
    source: "Welcome",
    campaign: "c3",
    capturedAt: "2026-06-10 07:48",
    tags: ["follower"],
  },
  {
    id: "l5",
    handle: "@plant.theory",
    name: "Iris W.",
    email: "iris@planttheory.io",
    source: "Story reply",
    campaign: "c2",
    capturedAt: "2026-06-10 06:30",
    tags: ["discount"],
  },
  {
    id: "l6",
    handle: "@nineoclock.fm",
    name: "Sam B.",
    email: "sam@nine.fm",
    source: "Launch waitlist",
    campaign: "c1",
    capturedAt: "2026-06-09 23:11",
    tags: ["waitlist"],
  },
  {
    id: "l7",
    handle: "@rye.print",
    name: "Rye J.",
    email: "rye@ryeprint.shop",
    source: "Welcome",
    campaign: "c3",
    capturedAt: "2026-06-09 21:02",
    tags: ["follower"],
  },
  {
    id: "l8",
    handle: "@hex.gallery",
    name: "Mo A.",
    email: "mo@hexgallery.art",
    source: "Launch waitlist",
    campaign: "c1",
    capturedAt: "2026-06-09 19:44",
    tags: ["waitlist"],
  },
];

export const bioLinks = [
  {
    id: "b1",
    label: "New drop — Maker Toolkit v3",
    url: "https://oatstudio.co/toolkit",
    clicks: 3820,
    ctr: 0.41,
  },
  {
    id: "b2",
    label: "Free AI scripting guide",
    url: "https://oatstudio.co/guide",
    clicks: 2914,
    ctr: 0.33,
  },
  { id: "b3", label: "Book a 1:1 call", url: "https://cal.com/oat", clicks: 612, ctr: 0.07 },
  {
    id: "b4",
    label: "Latest podcast — Ep. 41",
    url: "https://oatstudio.co/p/41",
    clicks: 410,
    ctr: 0.05,
  },
];

export const shortLinks = [
  {
    id: "s1",
    slug: "toolkit",
    target: "https://oatstudio.co/toolkit",
    clicks: 9420,
    lastClick: "2m ago",
  },
  {
    id: "s2",
    slug: "guide",
    target: "https://oatstudio.co/guide",
    clicks: 6184,
    lastClick: "12m ago",
  },
  {
    id: "s3",
    slug: "drop24",
    target: "https://brewlab.co/drops/24",
    clicks: 2820,
    lastClick: "1h ago",
  },
  { id: "s4", slug: "ep41", target: "https://oatstudio.co/p/41", clicks: 412, lastClick: "5h ago" },
];

export const scheduled = [
  {
    id: "p1",
    account: "@oat.studio",
    caption: "How we automated 24k DMs last month →",
    when: "Thu, Jun 12 · 9:00 AM",
    type: "Reel" as const,
  },
  {
    id: "p2",
    account: "@brewlab.co",
    caption: "Summer batch is back. Tap the link in bio.",
    when: "Thu, Jun 12 · 12:30 PM",
    type: "Post" as const,
  },
  {
    id: "p3",
    account: "@maker.daily",
    caption: "Behind the scenes: shipping the v3 toolkit",
    when: "Fri, Jun 13 · 8:15 AM",
    type: "Carousel" as const,
  },
  {
    id: "p4",
    account: "@oat.studio",
    caption: "Comment GUIDE for the free PDF 👇",
    when: "Sat, Jun 14 · 6:45 PM",
    type: "Reel" as const,
  },
];

export const team = [
  { id: "u1", name: "Ada Levin", email: "ada@oatstudio.co", role: "Owner" as const, avatar: "AL" },
  { id: "u2", name: "Niko Tran", email: "niko@oatstudio.co", role: "Admin" as const, avatar: "NT" },
  {
    id: "u3",
    name: "Rae Okonkwo",
    email: "rae@oatstudio.co",
    role: "Member" as const,
    avatar: "RO",
  },
  {
    id: "u4",
    name: "Jules Park",
    email: "jules@brewlab.co",
    role: "Client" as const,
    avatar: "JP",
  },
];

export const activity = [
  { id: "a1", text: "DM sent to @nora.builds via 'Launch waitlist'", time: "just now" },
  { id: "a2", text: "Lead captured: ezra+ig@hey.com", time: "2m ago" },
  { id: "a3", text: "Keyword 'GUIDE' triggered on @oat.studio reel", time: "4m ago" },
  { id: "a4", text: "Short link go.liffio.com/toolkit clicked × 12", time: "9m ago" },
  { id: "a5", text: "Story reply triggered DM flow on @brewlab.co", time: "14m ago" },
  { id: "a6", text: "New follower welcomed: @rye.print", time: "22m ago" },
];

export function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function formatPct(n: number, withSign = false) {
  const v = (n * 100).toFixed(1);
  if (withSign) return `${n >= 0 ? "+" : ""}${v}%`;
  return `${v}%`;
}
