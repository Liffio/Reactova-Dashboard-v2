import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[400px] group-[.toaster]:min-h-16 group-[.toaster]:p-4 group-[.toaster]:gap-3 group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-l-4 group-[.toaster]:border-border group-[.toaster]:rounded-xl group-[.toaster]:shadow-xl",
          title: "group-[.toast]:text-base group-[.toast]:font-semibold",
          description: "group-[.toast]:text-sm group-[.toast]:text-muted-foreground",
          icon: "group-[.toast]:size-5",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:![background-color:color-mix(in_oklch,var(--success)_12%,var(--card))] group-[.toaster]:!border-l-success group-[.toaster]:[&_svg]:text-success",
          error:
            "group-[.toaster]:![background-color:color-mix(in_oklch,var(--destructive)_12%,var(--card))] group-[.toaster]:!border-l-destructive group-[.toaster]:[&_svg]:text-destructive",
          warning:
            "group-[.toaster]:![background-color:color-mix(in_oklch,var(--warning)_14%,var(--card))] group-[.toaster]:!border-l-warning group-[.toaster]:[&_svg]:text-warning",
          info: "group-[.toaster]:![background-color:color-mix(in_oklch,var(--primary)_12%,var(--card))] group-[.toaster]:!border-l-primary group-[.toaster]:[&_svg]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
