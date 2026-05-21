import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useTheme } from "next-themes";
import { cva } from "class-variance-authority";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { AlertTriangle, Check, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SonnerToasterProps = ComponentProps<typeof Sonner>;

export type AppToastType = "success" | "error" | "info" | "warning";

export type AppToastOptions = {
  title?: string;
  message?: string;
  description?: string;
  duration?: number;
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center"
    | undefined;
  /** Extra classes on the outer toast card */
  className?: string;
  /** Classes applied to the inner content row (icon + text + close) */
  contentClassName?: string;
  /** Visually mute the type accent for a neutral notice */
  neutral?: boolean;
  /** Default true; set false to hide the countdown bar */
  showProgress?: boolean;
  /** Replace the default type icon */
  icon?: ReactNode;
};

const DEFAULT_DURATION = 5000;

const toastCardVariants = cva(
  [
    "app-toast group relative w-full max-w-[min(calc(100vw-1.5rem),20rem)] sm:max-w-[22rem]",
    "overflow-hidden rounded-xl border bg-background/95 text-foreground backdrop-blur-md",
    "shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_8px_24px_-4px_hsl(var(--foreground)/0.08)]",
    "dark:shadow-[0_1px_2px_hsl(0_0%_0%/0.2),0_8px_24px_-4px_hsl(0_0%_0%/0.45)]",
    "transition-[transform,box-shadow,opacity] duration-200 ease-out",
    "data-[swipe=move]:transition-none"
  ]
);

const toastAccentBorder: Record<AppToastType, string> = {
  success: "border-l-[hsl(var(--success))]",
  error: "border-l-[hsl(var(--destructive))]",
  info: "border-l-[hsl(var(--info))]",
  warning: "border-l-[hsl(var(--warning))]"
};

const toastSurfaceBorder: Record<AppToastType, string> = {
  success: "border-success/20",
  error: "border-destructive/20",
  info: "border-[hsl(var(--info)/0.25)]",
  warning: "border-[hsl(var(--warning)/0.25)]"
};

const iconVariants = cva("size-[15px] shrink-0", {
  variants: {
    type: {
      success: "text-[hsl(var(--success))]",
      error: "text-[hsl(var(--destructive))]",
      info: "text-[hsl(var(--info))]",
      warning: "text-[hsl(var(--warning))]"
    }
  },
  defaultVariants: { type: "info" }
});

const progressBarVariants = cva("app-toast-progress h-full origin-left", {
  variants: {
    type: {
      success: "bg-[hsl(var(--success))]",
      error: "bg-[hsl(var(--destructive))]",
      info: "bg-[hsl(var(--info))]",
      warning: "bg-[hsl(var(--warning))]"
    }
  },
  defaultVariants: { type: "info" }
});

const iconByType: Record<AppToastType, typeof Check> = {
  success: Check,
  error: XCircle,
  info: Info,
  warning: AlertTriangle
};

const wrapperClassByPosition: Record<NonNullable<AppToastOptions["position"]>, string> = {
  "top-right": "ml-auto mr-0",
  "bottom-right": "ml-auto mr-0",
  "top-left": "mr-auto ml-0",
  "bottom-left": "mr-auto ml-0",
  "top-center": "mx-auto",
  "bottom-center": "mx-auto"
};

export type ToastCardProps = {
  id: string | number;
  type: AppToastType;
  title: ReactNode;
  message?: ReactNode;
  duration: number;
  position?: AppToastOptions["position"];
  className?: string;
  contentClassName?: string;
  neutral?: boolean;
  showProgress?: boolean;
  icon?: ReactNode;
};

function ToastCard({
  id,
  type,
  title,
  message,
  duration,
  position,
  className,
  contentClassName,
  neutral = false,
  showProgress = true,
  icon
}: ToastCardProps) {
  const DefaultIcon = iconByType[type];
  const accent = neutral ? "border-l-border" : toastAccentBorder[type];
  const surface = neutral ? "border-border" : toastSurfaceBorder[type];

  return (
    <div
      className={cn(
        toastCardVariants(),
        "border-l-[3px]",
        accent,
        surface,
        position ? wrapperClassByPosition[position] : undefined,
        className
      )}
      style={{ "--app-toast-duration": `${duration}ms` } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-start gap-2.5 px-3.5 py-3",
          showProgress && "pb-2.5",
          contentClassName
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center",
            neutral && "text-muted-foreground"
          )}
          aria-hidden
        >
          {icon ?? <DefaultIcon className={cn(iconVariants({ type }), neutral && "text-muted-foreground")} strokeWidth={2.25} />}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[13px] font-medium leading-snug tracking-[-0.01em] text-foreground">{title}</p>
          {message != null && message !== "" ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">{message}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => sonnerToast.dismiss(id)}
          className={cn(
            "-mr-0.5 -mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground/70 outline-none transition-colors",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            "hover:bg-muted/80 hover:text-foreground",
            "focus-visible:ring-1 focus-visible:ring-ring"
          )}
          aria-label="Dismiss notification"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </button>
      </div>
      {showProgress ? (
        <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-border/60">
          <div className={cn(progressBarVariants({ type }), neutral && "bg-muted-foreground/35")} />
        </div>
      ) : null}
    </div>
  );
}

function mergeToastInput(
  titleOrOptions: string | AppToastOptions,
  options?: AppToastOptions
): Required<Pick<AppToastOptions, "title">> & AppToastOptions {
  if (typeof titleOrOptions === "string") {
    return { title: titleOrOptions, ...options };
  }
  return {
    title: titleOrOptions.title ?? "Notification",
    ...options,
    ...titleOrOptions
  };
}

const showToast = (
  type: AppToastType,
  titleOrOptions: string | AppToastOptions,
  options?: AppToastOptions
) => {
  const merged = mergeToastInput(titleOrOptions, options);
  const title = merged.title;
  const message = merged.message ?? merged.description;
  const duration = merged.duration ?? DEFAULT_DURATION;
  const position = merged.position;
  const wrapperPosition: NonNullable<AppToastOptions["position"]> = position ?? "top-right";

  return sonnerToast.custom(
    (toastId) => (
      <ToastCard
        id={toastId}
        type={type}
        title={title}
        message={message}
        duration={duration}
        position={wrapperPosition}
        className={merged.className}
        contentClassName={merged.contentClassName}
        neutral={merged.neutral}
        showProgress={merged.showProgress ?? true}
        icon={merged.icon}
      />
    ),
    { duration, position }
  );
};

export type AppToasterProps = SonnerToasterProps & {
  /** Applied to each Sonner toast shell (transparent wrapper around custom content) */
  toastListClassName?: string;
};

const Toaster = ({ className, toastListClassName, position = "top-right", ...props }: AppToasterProps) => {
  const { theme = "system" } = useTheme();
  const resolvedPosition = position as NonNullable<AppToastOptions["position"]>;

  return (
    <Sonner
      theme={theme as SonnerToasterProps["theme"]}
      className={cn("toaster group", className)}
      position={position}
      offset={{ top: "1rem", right: "1rem", bottom: "1rem", left: "1rem" }}
      mobileOffset={{ top: "0.75rem", right: "0.75rem", bottom: "0.75rem", left: "0.75rem" }}
      expand={false}
      richColors={false}
      closeButton={false}
      visibleToasts={4}
      gap={10}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast !w-full !max-w-none !bg-transparent !border-0 !p-0 !shadow-none",
            wrapperClassByPosition[resolvedPosition],
            toastListClassName
          ),
          description: "hidden",
          actionButton: "hidden",
          cancelButton: "hidden"
        }
      }}
      {...props}
    />
  );
};

type ToastMethod = {
  (message: string, options?: AppToastOptions): string | number;
  (options: AppToastOptions): string | number;
};

type ToastFn = ToastMethod & {
  success: ToastMethod;
  error: ToastMethod;
  info: ToastMethod;
  warning: ToastMethod;
  dismiss: (id?: string | number) => void;
};

const toastBase = ((titleOrOptions: string | AppToastOptions, options?: AppToastOptions) =>
  showToast("info", titleOrOptions, options)) as ToastFn;

function makeToastMethod(type: AppToastType): ToastMethod {
  const fn = (titleOrOptions: string | AppToastOptions, options?: AppToastOptions) =>
    showToast(type, titleOrOptions, options);
  return fn as ToastMethod;
}

toastBase.success = makeToastMethod("success");
toastBase.error = makeToastMethod("error");
toastBase.info = makeToastMethod("info");
toastBase.warning = makeToastMethod("warning");
toastBase.dismiss = (id) => sonnerToast.dismiss(id);

export { Toaster, toastBase as toast };
