import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Admin: the chatbot template library (`platform:module_manage`). Metadata and visibility only;
 * a template's flow comes from "Save as template" on a real chatbot and is never edited here.
 */

export interface AdminChatbotTemplate {
  id: string;
  key: string;
  icon: string;
  name: string;
  description: string;
  categoryId: string | null;
  categoryKey: string | null;
  categoryLabel: string | null;
  keywords: string[];
  stepCount: number;
  featured: boolean;
  requiredCapabilities: string[];
  displayOrder: number;
  isEnabled: boolean;
  installCount: number;
  graphVersion: number;
  /** Why it is hidden from the picker (it no longer installs), or null. */
  problem: string | null;
  sourceChatbotId: string | null;
  updatedAt: string;
}

export interface AdminChatbotTemplateDetail extends AdminChatbotTemplate {
  preview: Array<{
    key: string;
    type: string;
    name: string;
    body: string | null;
    buttons: string[];
  }>;
}

export interface AdminTemplateCategory {
  id: string;
  key: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
  templateCount: number;
}

export interface TemplatePatch {
  name?: string;
  description?: string;
  icon?: string;
  categoryId?: string | null;
  keywords?: string[];
  displayOrder?: number;
  featured?: boolean;
  isEnabled?: boolean;
}

export interface CaptureResult {
  templateId: string;
  created: boolean;
  stepCount: number;
  requiredCapabilities: string[];
  stripped: Array<{ step: string | null; what: string }>;
}

const U = apiUri.admin.chatbotTemplates;

export const chatbotTemplatesAdminApi = {
  list: () =>
    apiRequest<{
      data: { templates: AdminChatbotTemplate[]; categories: AdminTemplateCategory[] };
    }>(U.list).then((r) => r.data),
  get: (id: string) =>
    apiRequest<{ data: AdminChatbotTemplateDetail }>(U.byId(id)).then((r) => r.data),
  update: (id: string, patch: TemplatePatch) =>
    apiRequest<{ data: AdminChatbotTemplate }>(U.byId(id), { method: "PATCH", body: patch }).then(
      (r) => r.data,
    ),
  capture: (body: { workspaceId: string; chatbotId: string; templateId?: string }) =>
    apiRequest<{ data: CaptureResult }>(U.capture, { method: "POST", body }).then((r) => r.data),
  createCategory: (label: string) =>
    apiRequest<{ data: AdminTemplateCategory }>(U.categories, {
      method: "POST",
      body: { label },
    }).then((r) => r.data),
  updateCategory: (
    id: string,
    patch: { label?: string; displayOrder?: number; isActive?: boolean },
  ) =>
    apiRequest<{ data: AdminTemplateCategory }>(U.categoryById(id), {
      method: "PATCH",
      body: patch,
    }).then((r) => r.data),
};

export const chatbotTemplatesAdminKeys = {
  all: ["admin-chatbot-templates"] as const,
  detail: (id: string) => ["admin-chatbot-templates", id] as const,
};
