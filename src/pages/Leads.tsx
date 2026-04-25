import { Search, Download, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const leads = [
  { user: "@maya.rivers", kw: "GUIDE", auto: "Free Guide Funnel", date: "Apr 23, 2026", clicked: true },
  { user: "@dev_with_jo", kw: "JOIN", auto: "Webinar Signup", date: "Apr 23, 2026", clicked: true },
  { user: "@sahara.fit", kw: "GUIDE", auto: "Free Guide Funnel", date: "Apr 22, 2026", clicked: false },
  { user: "@thecoffeefiles", kw: "ASK", auto: "Q&A Reel", date: "Apr 22, 2026", clicked: true },
  { user: "@northern.lights", kw: "PDF", auto: "Free Guide Funnel", date: "Apr 21, 2026", clicked: false },
  { user: "@brewbymira", kw: "JOIN", auto: "Webinar Signup", date: "Apr 21, 2026", clicked: true },
  { user: "@minimalmood", kw: "GUIDE", auto: "Free Guide Funnel", date: "Apr 20, 2026", clicked: true },
  { user: "@ravi.codes", kw: "ASK", auto: "Q&A Reel", date: "Apr 20, 2026", clicked: false },
];

export default function Leads() {
  return (
    <DashboardLayout title="Leads" subtitle="Every Instagram user your automations have captured.">
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search leads..." className="bg-card border-border pl-9" />
        </div>
        <Button variant="outline">Filter</Button>
        <Button variant="outline"><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Instagram Username</th>
                <th className="px-5 py-3 font-medium">Keyword</th>
                <th className="px-5 py-3 font-medium">Automation</th>
                <th className="px-5 py-3 font-medium">Date Captured</th>
                <th className="px-5 py-3 font-medium">Link Clicked</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={i} className="stripe-row hover:bg-primary/5 cursor-pointer">
                  <td className="px-5 py-3 font-mono">{l.user}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{l.kw}</span></td>
                  <td className="px-5 py-3">{l.auto}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.date}</td>
                  <td className="px-5 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border", l.clicked ? "bg-success/15 text-success border-success/30" : "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30")}>
                      {l.clicked ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <span>Showing 1–8 of 612 leads</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
