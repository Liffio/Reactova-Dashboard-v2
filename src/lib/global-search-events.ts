/**
 * The topbar field, the mobile icon and the ⌘K listener all ask for the same thing, and the
 * palette that answers is mounted once at the layout root.
 *
 * A DOM event rather than a context: the triggers would otherwise have to sit inside a provider
 * that exists only to carry one boolean, and every route in the shell would re-render when it
 * flipped. This also gives the keyboard shortcut and a click exactly the same path.
 */
export const OPEN_SEARCH_EVENT = "liffio:open-search";

export function openGlobalSearch(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT));
}
