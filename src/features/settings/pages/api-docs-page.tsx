import { ApiDocsContent } from "@/components/api-docs-content";
import { API_BASE } from "@/lib/api/http";
import { SettingsCard } from "../components";

const baseUrl = API_BASE.replace(/\/$/, "");

/** The External API reference, as a card at the bottom of Settings → Developer (`#api-docs`). */
export function ApiDocsPage() {
  return (
    <div id="api-docs" className="scroll-mt-6">
      <SettingsCard
        title="API docs"
        description="Automate post scheduling and workflow creation from Postman, Zapier, or your own scripts."
        actions={
          <span className="whitespace-nowrap rounded-[6px] bg-muted px-2 py-[3px] font-mono text-xs text-muted-foreground">
            {baseUrl}/api/v1/external
          </span>
        }
      >
        <div className="px-5 py-6 sm:px-7">
          <ApiDocsContent />
        </div>
      </SettingsCard>
    </div>
  );
}
