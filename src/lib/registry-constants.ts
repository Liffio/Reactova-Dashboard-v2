/**
 * Sidebar section headings offered when editing a module.
 *
 * The server stores `nav_group` as free text, so this list is a convention rather than a
 * constraint — but offering a fixed set is what stops "Account" and "account" becoming two
 * sections that render as separate groups in every tenant's sidebar.
 */
export const NAV_GROUPS = ["Workspace", "Automate", "Distribute", "Account"] as const;

export type NavGroup = (typeof NAV_GROUPS)[number];
