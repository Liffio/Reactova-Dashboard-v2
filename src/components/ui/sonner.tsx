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
            "group toast group-[.toaster]:w-[400px] group-[.toaster]:min-h-16 group-[.toaster]:p-4 group-[.toaster]:gap-3 group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:rounded-xl group-[.toaster]:shadow-xl",
          title: "group-[.toast]:text-base group-[.toast]:font-semibold",
          description: "group-[.toast]:text-sm group-[.toast]:text-muted-foreground",
          icon: "group-[.toast]:flex group-[.toast]:size-8 group-[.toast]:shrink-0 group-[.toast]:items-center group-[.toast]:justify-center group-[.toast]:rounded-full group-[.toast]:[&_svg]:size-4",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:[&_[data-icon]]:bg-success/15 group-[.toaster]:[&_[data-icon]]:text-success",
          error:
            "group-[.toaster]:[&_[data-icon]]:bg-destructive/15 group-[.toaster]:[&_[data-icon]]:text-destructive",
          warning:
            "group-[.toaster]:[&_[data-icon]]:bg-warning/15 group-[.toaster]:[&_[data-icon]]:text-warning",
          info: "group-[.toaster]:[&_[data-icon]]:bg-primary/15 group-[.toaster]:[&_[data-icon]]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
