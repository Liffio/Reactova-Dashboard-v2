export function AuthBackdrop() {
  return (
    <div className="auth-backdrop pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="auth-ig-mesh absolute inset-0" />
      <div className="auth-ig-grid absolute inset-0 opacity-50 dark:opacity-35" />
      <div className="auth-liquid-orb auth-liquid-orb-a absolute -left-[12%] top-[8%] h-[42vmin] w-[42vmin]" />
      <div className="auth-liquid-orb auth-liquid-orb-b absolute right-[-8%] top-[35%] h-[36vmin] w-[36vmin]" />
      <div className="auth-liquid-orb auth-liquid-orb-c absolute bottom-[-6%] left-[30%] h-[32vmin] w-[32vmin]" />
    </div>
  );
}
