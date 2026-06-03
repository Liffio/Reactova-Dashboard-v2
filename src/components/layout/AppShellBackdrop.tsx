/** Ambient liquid-glass background for dashboard and in-app pages */
export function AppShellBackdrop() {
  return (
    <div className="app-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="app-mesh absolute inset-0" />
      <div className="app-ig-grid absolute inset-0 opacity-40 dark:opacity-25" />
      <div className="app-orb app-orb-a absolute -left-[8%] top-[8%] h-[min(44vw,380px)] w-[min(44vw,380px)]" />
      <div className="app-orb app-orb-b absolute right-[-5%] top-[42%] h-[min(36vw,300px)] w-[min(36vw,300px)]" />
      <div className="app-orb app-orb-c absolute bottom-[-3%] left-[34%] h-[min(30vw,260px)] w-[min(30vw,260px)]" />
    </div>
  );
}
