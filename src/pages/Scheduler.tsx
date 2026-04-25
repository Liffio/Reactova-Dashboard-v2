import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

const posts = [
  { id: 1, day: 5, title: "Spring product reveal", time: "10:00 AM", status: "scheduled" as const, kw: "SPRING" },
  { id: 2, day: 12, title: "Behind the scenes", time: "2:00 PM", status: "published" as const, kw: "BTS" },
  { id: 3, day: 18, title: "Customer story #4", time: "9:30 AM", status: "scheduled" as const, kw: "STORY" },
  { id: 4, day: 22, title: "Q&A reel", time: "4:00 PM", status: "draft" as const, kw: "ASK" },
];

export default function Scheduler() {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <DashboardLayout title="Posts & Scheduler" subtitle="Plan and publish your Instagram content.">
      <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
        <div className="inline-flex p-1 rounded-lg bg-card border border-border">
          {(["calendar", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{v}</button>
          ))}
        </div>
        <Button>Schedule New Post</Button>
      </div>

      {view === "calendar" ? (
        <section className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">April 2026</h3>
            <div className="flex gap-1">
              <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm">Today</Button>
              <Button variant="outline" size="sm"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-center text-muted-foreground py-2">{d}</div>)}
            {days.map((d) => {
              const post = posts.find((p) => p.day === d);
              return (
                <div key={d} className="aspect-square rounded-lg border border-border bg-background p-1.5 hover:border-primary/40 transition-colors">
                  <div className="text-[11px] text-muted-foreground">{d}</div>
                  {post && (
                    <div className="mt-1 px-1.5 py-1 rounded-md bg-primary/15 text-primary text-[10px] font-medium truncate">
                      {post.title}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Post</th>
                  <th className="px-5 py-3 font-medium">Caption</th>
                  <th className="px-5 py-3 font-medium">Scheduled</th>
                  <th className="px-5 py-3 font-medium">Keyword</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="stripe-row">
                    <td className="px-5 py-3"><div className="h-10 w-10 rounded-md bg-gradient-to-br from-primary/20 to-accent/20" /></td>
                    <td className="px-5 py-3 font-medium">{p.title}</td>
                    <td className="px-5 py-3 text-muted-foreground">Apr {p.day}, {p.time}</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{p.kw}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} withDot /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
