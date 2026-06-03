/** Subtle ambient background for dashboard and in-app pages */
export function AppShellBackdrop() {
  return (
    <div className="app-backdrop pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="app-mesh absolute inset-0" />
      <div className="app-orb app-orb-a absolute -left-[10%] top-[5%] h-[min(50vw,420px)] w-[min(50vw,420px)]" />
      <div className="app-orb app-orb-b absolute right-[-6%] top-[40%] h-[min(40vw,340px)] w-[min(40vw,340px)]" />
      <div className="app-orb app-orb-c absolute bottom-[-4%] left-[35%] h-[min(36vw,300px)] w-[min(36vw,300px)]" />
    </div>
  );
}
