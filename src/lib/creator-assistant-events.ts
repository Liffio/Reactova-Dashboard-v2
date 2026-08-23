/**
 * The Lyra drawer is mounted once, in the topbar, but it is opened from two places: the "Ask AI"
 * pill on desktop and the sidebar entry on mobile, where the pill is hidden to unclutter a 360px
 * bar.
 *
 * A DOM event rather than lifting the drawer's state into context, for the reason
 * `global-search-events.ts` gives: the alternative is a provider that exists to carry one boolean
 * and re-renders the whole shell whenever it flips. The drawer keeps owning its own state and
 * simply listens.
 */
export const OPEN_ASSISTANT_EVENT = "liffio:open-assistant";

export function openCreatorAssistant(): void {
  window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT));
}
