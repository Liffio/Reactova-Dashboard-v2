import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type ActiveEmailSource = "code" | "brevo";

export type EmailTemplateEntry = {
  ref: string;
  label: string;
  brevoName: string;
  templateId: number | null;
  activeSource: ActiveEmailSource;
  isOtpLocked: boolean;
  isCustom: boolean;
  hasCodeOverride: boolean;
  variables: string[];
  category: "security" | "notifications" | "custom";
  subject?: string;
};

export type EmailTemplatesListResponse = {
  templates: EmailTemplateEntry[];
};

type CodeHtmlResponse = { html: string; hasOverride: boolean };
type BrevoHtmlResponse = { html: string; templateId: number };
type OkResponse = { ok: boolean; ref: string; [key: string]: unknown };

const splitRef = (ref: string): { category: string; key: string } => {
  const dot = ref.indexOf(".");
  return { category: ref.slice(0, dot), key: ref.slice(dot + 1) };
};

const refPath = (ref: string) => {
  const { category, key } = splitRef(ref);
  return `/api/v1/admin/email-templates/${category}/${key}`;
};

export function useEmailTemplatesQuery() {
  return useQuery({
    queryKey: ["admin", "email-templates"],
    queryFn: () => apiRequest<EmailTemplatesListResponse>("/api/v1/admin/email-templates")
  });
}

export function useEmailTemplateCodeHtmlQuery(ref: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "email-template-code-html", ref],
    queryFn: () => apiRequest<CodeHtmlResponse>(`${refPath(ref)}/code-html`),
    enabled: Boolean(ref) && enabled
  });
}

export function useEmailTemplateRenderedBaseQuery(ref: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "email-template-rendered-base", ref],
    queryFn: () => apiRequest<{ html: string }>(`${refPath(ref)}/rendered-code-html`),
    enabled: Boolean(ref) && enabled
  });
}

export function useEmailTemplateBrevoHtmlQuery(ref: string, enabled = false) {
  return useQuery({
    queryKey: ["admin", "email-template-brevo-html", ref],
    queryFn: () => apiRequest<BrevoHtmlResponse>(`${refPath(ref)}/brevo-html`),
    enabled: Boolean(ref) && enabled,
    retry: false
  });
}

export function useSaveCodeHtmlMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, html }: { ref: string; html: string }) =>
      apiRequest<OkResponse>(`${refPath(ref)}/code-html`, {
        method: "PUT",
        body: { html }
      }),
    onSuccess: (_data, { ref }) => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-template-code-html", ref] });
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
    }
  });
}

export function useDeleteCodeOverrideMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ref: string) =>
      apiRequest<OkResponse>(`${refPath(ref)}/code-html`, { method: "DELETE" }),
    onSuccess: (_data, ref) => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-template-code-html", ref] });
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
    }
  });
}

export function useBrevoSyncMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ref: string) =>
      apiRequest<OkResponse>(`${refPath(ref)}/brevo-sync`, { method: "PUT", body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
    }
  });
}

export function useSetSourceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, source }: { ref: string; source: ActiveEmailSource }) =>
      apiRequest<OkResponse>(`${refPath(ref)}/source`, {
        method: "PUT",
        body: { source }
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
    }
  });
}

export function useCreateTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; subject: string; variables: string[]; slug?: string }) =>
      apiRequest<{ ok: boolean; ref: string; key: string; label: string; subject: string; variables: string[] }>(
        "/api/v1/admin/email-templates",
        { method: "POST", body: data }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
    }
  });
}

export function useDeleteTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ref: string) => {
      const { category, key } = (() => {
        const dot = ref.indexOf(".");
        return { category: ref.slice(0, dot), key: ref.slice(dot + 1) };
      })();
      return apiRequest<{ ok: boolean }>(`/api/v1/admin/email-templates/${category}/${key}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
    }
  });
}

export function usePublishMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, source, html }: { ref: string; source: ActiveEmailSource; html?: string }) =>
      apiRequest<OkResponse>(`${refPath(ref)}/publish`, {
        method: "PUT",
        body: { source, ...(html ? { html } : {}) }
      }),
    onSuccess: (_data, { ref }) => {
      void qc.invalidateQueries({ queryKey: ["admin", "email-templates"] });
      void qc.invalidateQueries({ queryKey: ["admin", "email-template-code-html", ref] });
    }
  });
}
