import { cn } from "@/lib/utils";

export type PageTabItem<T extends string> = {
  id: T;
  label: string;
};

type PageTabsProps<T extends string> = {
  tabs: PageTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function PageTabs<T extends string>({ tabs, value, onChange, className }: PageTabsProps<T>) {
  return (
    <div
      className={cn(
        "page-tabs -mx-1 px-1 flex gap-1 overflow-x-auto pb-1 scrollbar-thin sm:mx-0 sm:px-0",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors min-h-10",
            value === tab.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "glass-inset text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
