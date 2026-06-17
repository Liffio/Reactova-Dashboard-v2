import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

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

type OkResponse = { ok: boolean; ref: string; [key: string]: unknown };

/** "category.key" refs are how the admin UI addresses templates. */
export const splitTemplateRef = (ref: string): { category: string; key: string } => {
  const dot = ref.indexOf(".");
  return { category: ref.slice(0, dot), key: ref.slice(dot + 1) };
};

export function listEmailTemplates() {
  return apiRequest<EmailTemplatesListResponse>(apiUri.admin.emailTemplates.list);
}

export function createEmailTemplate(body: {
  label: string;
  subject: string;
  variables: string[];
  slug?: string;
}) {
  return apiRequest<{
    ok: boolean;
    ref: string;
    key: string;
    label: string;
    subject: string;
    variables: string[];
  }>(apiUri.admin.emailTemplates.create, { method: "POST", body });
}

export function deleteEmailTemplate(ref: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<{ ok: boolean }>(apiUri.admin.emailTemplates.item(category, key), {
    method: "DELETE",
  });
}

export function getEmailTemplateCodeHtml(ref: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<{ html: string; hasOverride: boolean }>(
    apiUri.admin.emailTemplates.codeHtml(category, key)
  );
}

export function getEmailTemplateRenderedBase(ref: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<{ html: string }>(apiUri.admin.emailTemplates.renderedCodeHtml(category, key));
}

export function getEmailTemplateBrevoHtml(ref: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<{ html: string; templateId: number }>(
    apiUri.admin.emailTemplates.brevoHtml(category, key)
  );
}

export function saveEmailTemplateCodeHtml(ref: string, html: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<OkResponse>(apiUri.admin.emailTemplates.codeHtml(category, key), {
    method: "PUT",
    body: { html },
  });
}

export function deleteEmailTemplateCodeOverride(ref: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<OkResponse>(apiUri.admin.emailTemplates.codeHtml(category, key), {
    method: "DELETE",
  });
}

export function syncEmailTemplateBrevo(ref: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<OkResponse>(apiUri.admin.emailTemplates.brevoSync(category, key), {
    method: "PUT",
    body: {},
  });
}

export function setEmailTemplateSource(ref: string, source: ActiveEmailSource) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<OkResponse>(apiUri.admin.emailTemplates.source(category, key), {
    method: "PUT",
    body: { source },
  });
}

export function publishEmailTemplate(ref: string, source: ActiveEmailSource, html?: string) {
  const { category, key } = splitTemplateRef(ref);
  return apiRequest<OkResponse>(apiUri.admin.emailTemplates.publish(category, key), {
    method: "PUT",
    body: { source, ...(html ? { html } : {}) },
  });
}
