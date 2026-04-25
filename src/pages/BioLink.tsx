import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const swatches = ["#7C6AF7", "#F97316", "#22C55E", "#EAB308", "#EF4444", "#34B7F1"];

export default function BioLink() {
  const [color, setColor] = useState("#7C6AF7");
  const [name, setName] = useState("Alex Morgan");
  const [bio, setBio] = useState("Helping creators turn followers into customers ✨");
  const [links, setLinks] = useState([
    { id: 1, title: "Free Guide PDF", url: "https://reactova.com/free-guide" },
    { id: 2, title: "Latest YouTube Video", url: "https://youtube.com/@alex" },
    { id: 3, title: "Book a Call", url: "https://cal.com/alex" },
  ]);

  return (
    <DashboardLayout title="Bio Link" subtitle="A simple landing page for your Instagram bio.">
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Editor */}
        <div className="lg:col-span-3 space-y-5">
          <Card title="Profile">
            <div className="flex gap-4 items-start">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" /></div>
                <div className="space-y-1.5">
                  <Label>Bio</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={2} maxLength={160} className="bg-input border-border resize-none" />
                  <div className="text-[11px] text-muted-foreground text-right">{bio.length}/160</div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Links">
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input value={l.title} onChange={(e) => setLinks(links.map(x => x.id === l.id ? { ...x, title: e.target.value } : x))} className="bg-input border-border h-8 text-sm" />
                    <Input value={l.url} onChange={(e) => setLinks(links.map(x => x.id === l.id ? { ...x, url: e.target.value } : x))} className="bg-input border-border h-8 text-sm" />
                  </div>
                  <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => setLinks(links.filter(x => x.id !== l.id))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setLinks([...links, { id: Date.now(), title: "New link", url: "https://" }])}>
                <Plus className="h-4 w-4" /> Add Link
              </Button>
            </div>
          </Card>

          <Card title="Appearance">
            <div className="space-y-3">
              <div>
                <Label>Theme colour</Label>
                <div className="flex gap-2 mt-2">
                  {swatches.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={cn("h-8 w-8 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ background: c }} />
                  ))}
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="bg-input border-border h-8 w-24 text-xs font-mono" />
                </div>
              </div>
              <div>
                <Label>Button style</Label>
                <div className="inline-flex p-1 rounded-lg bg-background border border-border mt-2">
                  {["Filled", "Outlined", "Rounded"].map((s) => <button key={s} className="px-3 py-1.5 rounded-md text-xs hover:bg-muted">{s}</button>)}
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Copy Link</Button>
            <Button variant="outline">View Analytics</Button>
            <Button>Save Changes</Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="text-xs text-muted-foreground mb-3 text-center">Live Preview</div>
            <div className="mx-auto w-[280px] rounded-[2.5rem] border-8 border-card bg-background shadow-2xl p-6 min-h-[480px]">
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full mb-3" style={{ background: `linear-gradient(135deg, ${color}, hsl(var(--accent)))` }} />
                <div className="font-bold text-foreground">{name}</div>
                <p className="text-xs text-muted-foreground mt-1">{bio}</p>
                <div className="w-full mt-6 space-y-2">
                  {links.map((l) => (
                    <div key={l.id} className="w-full text-xs font-medium py-2.5 rounded-lg text-white" style={{ background: color }}>
                      {l.title}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-6">Powered by Reactova</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}
