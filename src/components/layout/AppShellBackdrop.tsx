/** Ambient liquid-glass background for dashboard and in-app pages */
export function AppShellBackdrop() {
  return (
    <div className="app-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="app-mesh absolute inset-0" />
      <div className="app-ig-grid absolute inset-0 opacity-50 dark:opacity-30" />
      <div className="app-orb app-orb-a absolute -left-[10%] top-[6%] h-[min(52vw,460px)] w-[min(52vw,460px)]" />
      <div className="app-orb app-orb-b absolute right-[-6%] top-[38%] h-[min(44vw,380px)] w-[min(44vw,380px)]" />
      <div className="app-orb app-orb-c absolute bottom-[-5%] left-[32%] h-[min(38vw,320px)] w-[min(38vw,320px)]" />
    </div>
  );
}
