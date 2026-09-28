import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ApiDocsContent } from "@/components/api-docs-content";
import { API_BASE } from "@/lib/api/http";

const baseUrl = API_BASE.replace(/\/$/, "");

export function ApiDocsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Developers"
        title="External API"
        description="Automate post scheduling and workflow creation from Postman, Zapier, or your own scripts."
        actions={
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <BookOpen className="h-4 w-4 text-primary" />
            <code className="font-mono text-xs text-muted-foreground">
              {baseUrl}/api/v1/external
            </code>
          </div>
        }
      />
      <div className="p-4 sm:p-6 md:p-10">
        <div className="max-w-3xl">
          <ApiDocsContent />
        </div>
      </div>
    </div>
  );
}
