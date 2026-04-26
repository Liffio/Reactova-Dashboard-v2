import { useState } from "react";
import { Plus, Edit, Trash2, X, Lock, Zap, Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/hooks/useCan";

const initial = [
  { id: 1, name: "Free Guide Funnel", keywords: ["GUIDE", "FREE", "PDF"], dms: 1420, status: "active" as const, date: "Apr 12, 2026" },
  { id: 2, name: "Webinar Signup", keywords: ["JOIN", "WEBINAR"], dms: 342, status: "active" as const, date: "Apr 8, 2026" },
  { id: 3, name: "Q&A Reel", keywords: ["ASK", "Q", "QUESTION", "TIPS", "MORE"], dms: 28, status: "paused" as const, date: "Mar 28, 2026" },
  { id: 4, name: "Coupon Drop", keywords: ["SAVE15", "SALE"], dms: 0, status: "draft" as const, date: "Mar 22, 2026" },
];

export default function Automations() {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const canCreate = useCan("automation", "create");
  const canUpdate = useCan("automation", "update");
  const canDelete = useCan("automation", "delete");

  return (
    <DashboardLayout title="Automations" subtitle="Convert comments into DMs on autopilot.">
      <div className="flex justify-end -mt-2">
        <Button variant="accent" onClick={() => setOpen(true)} disabled={!canCreate}>
          <Plus className="h-4 w-4" /> Create New Automation
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No automations yet"
          description="Create your first automation to start converting comments into DMs"
          ctaLabel={canCreate ? "Create Automation" : "No permission to create"}
          onCta={() => {
            if (canCreate) setOpen(true);
          }}
        />
      ) : (
        <section className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Workflow Name</th>
                  <th className="px-5 py-3 font-medium">Trigger Keywords</th>
                  <th className="px-5 py-3 font-medium">DMs Sent</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="stripe-row hover:bg-primary/5 transition-colors">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.keywords.slice(0, 3).map((k) => (
                          <span key={k} className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{k}</span>
                        ))}
                        {a.keywords.length > 3 && <span className="text-xs text-muted-foreground">+{a.keywords.length - 3} more</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono">{a.dms.toLocaleString()}</td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} withDot /></td>
                    <td className="px-5 py-3 text-muted-foreground">{a.date}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
                          onClick={() => setOpen(true)}
                          disabled={!canUpdate}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-40"
                          onClick={() => setItems((x) => x.filter((i) => i.id !== a.id))}
                          disabled={!canDelete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {open && canCreate && <AutomationDrawer onClose={() => setOpen(false)} />}
    </DashboardLayout>
  );
}

function AutomationDrawer({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("New Automation");
  const [active, setActive] = useState(true);
  const [keywords, setKeywords] = useState<string[]>(["GUIDE"]);
  const [kw, setKw] = useState("");
  const [autoReply, setAutoReply] = useState(true);
  const [msg, setMsg] = useState("Hi there! Here's your link 👇");
  const [delay, setDelay] = useState([45]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-card border-l border-border flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Create Automation</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin">
          <Section title="Basics">
            <div className="space-y-2">
              <Label>Workflow name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Status</Label>
              <div className="flex items-center gap-2 text-xs">
                <span className={active ? "text-success" : "text-muted-foreground"}>{active ? "Active" : "Paused"}</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
          </Section>

          <Section title="Trigger Keywords">
            <div className="flex gap-2">
              <Input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (kw.trim()) { setKeywords([...keywords, kw.trim().toUpperCase()]); setKw(""); } }
              }} placeholder="Type & press Enter" className="bg-input border-border" />
              <Button variant="outline" onClick={() => { if (kw.trim()) { setKeywords([...keywords, kw.trim().toUpperCase()]); setKw(""); } }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs">
                  {k}
                  <button onClick={() => setKeywords(keywords.filter((x) => x !== k))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Anyone who comments these words will receive your DM</p>
          </Section>

          <Section title="Auto-Reply to Comment (optional)">
            <div className="flex items-center justify-between">
              <Label>Auto-reply enabled</Label>
              <Switch checked={autoReply} onCheckedChange={setAutoReply} />
            </div>
            {autoReply && [1, 2, 3].map((i) => (
              <Textarea key={i} placeholder={`Comment response ${i}`} maxLength={140} rows={2} className="bg-input border-border resize-none" />
            ))}
          </Section>

          <Section title="DM Message">
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 900))} rows={4} className="bg-input border-border resize-none" />
            <div className="text-[11px] text-muted-foreground text-right">{msg.length}/900</div>
            <Button variant="outline" size="sm"><Plus className="h-3 w-3" /> Add a button</Button>

            <div className="mt-3 p-3 rounded-xl bg-background border border-border">
              <div className="text-xs text-muted-foreground mb-2">Preview</div>
              <div className="rounded-2xl rounded-tl-sm bg-muted p-3 max-w-[85%]">
                <p className="text-sm">{msg}</p>
              </div>
            </div>
          </Section>

          <Section title="Advanced (Pro+)">
            <div className="p-4 rounded-xl border border-border bg-background space-y-3">
              <LockedRow text="Follow Before DM" />
              <LockedRow text="DM Follow-up Sequences" />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-1.5"><Info className="h-3 w-3" />Human-like delay</span>
                  <span className="text-muted-foreground font-mono">{delay[0]}s</span>
                </div>
                <Slider value={delay} onValueChange={setDelay} min={30} max={90} step={5} />
                <p className="text-[11px] text-muted-foreground">Random delay protects your account from spam detection</p>
              </div>
            </div>
          </Section>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Save Draft</Button>
          <Button onClick={onClose}>Save & Activate</Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function LockedRow({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> {text}
      </div>
      <button className="text-xs text-primary hover:underline">Upgrade to Pro</button>
    </div>
  );
}
