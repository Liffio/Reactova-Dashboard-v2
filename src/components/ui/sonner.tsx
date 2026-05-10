import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useTheme } from "next-themes";
import { cva } from "class-variance-authority";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
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
  /** Visually mute the type accent (icon + border) for a neutral notice */
  neutral?: boolean;
  /** Default true; set false to hide the countdown bar */
  showProgress?: boolean;
  /** Replace the default type icon */
  icon?: ReactNode;
};

const DEFAULT_DURATION = 5000;

const toastCardVariants = cva(
  [
    "app-toast group relative w-full max-w-[min(calc(100vw-1.25rem),22rem)] sm:max-w-md",
    "overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md",
    "ring-1 ring-black/5 dark:ring-white/10",
    "border-l-[3px]",
    "transition-[transform,box-shadow] duration-200",
    "data-[swipe=move]:transition-none"
  ]
);

const toastAccentBorder: Record<AppToastType, string> = {
  success: "border-l-emerald-600 dark:border-l-emerald-500",
  error: "border-l-red-600 dark:border-l-red-500",
  info: "border-l-sky-600 dark:border-l-sky-500",
  warning: "border-l-amber-600 dark:border-l-amber-500"
};

const iconShellVariants = cva(
  "flex size-8 shrink-0 items-center justify-center rounded-md border bg-background/80 backdrop-blur-sm",
  {
    variants: {
      type: {
        success: "border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400",
        error: "border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-400",
        info: "border-sky-200 text-sky-700 dark:border-sky-900/60 dark:text-sky-400",
        warning: "border-amber-200 text-amber-800 dark:border-amber-900/60 dark:text-amber-400"
      }
    },
    defaultVariants: { type: "info" }
  }
);

const progressBarVariants = cva("app-toast-progress h-full rounded-full", {
  variants: {
    type: {
      success: "bg-emerald-600/70 dark:bg-emerald-500/70",
      error: "bg-red-600/70 dark:bg-red-500/70",
      info: "bg-sky-600/70 dark:bg-sky-500/70",
      warning: "bg-amber-600/70 dark:bg-amber-500/70"
    }
  },
  defaultVariants: { type: "info" }
});

const iconByType: Record<AppToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
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

  return (
    <div
      className={cn(
        toastCardVariants(),
        neutral ? "border-l-border" : toastAccentBorder[type],
        position ? wrapperClassByPosition[position] : undefined,
        className
      )}
      style={{ "--app-toast-duration": `${duration}ms` } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div className={cn("flex gap-3 px-3 py-3 sm:gap-3.5 sm:px-4 sm:py-3.5", contentClassName)}>
        <div className={cn(iconShellVariants({ type }), neutral && "border-border text-muted-foreground")}>
          {icon ?? <DefaultIcon className="size-4" strokeWidth={2} aria-hidden />}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-sm font-medium leading-snug text-foreground">{title}</div>
          {message != null && message !== "" ? (
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => sonnerToast.dismiss(id)}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-muted-foreground outline-none transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          aria-label="Dismiss notification"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {showProgress ? (
        <div className="px-3 pb-2 sm:px-4 sm:pb-2.5">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted/80">
            <div className={cn(progressBarVariants({ type }), neutral && "bg-muted-foreground/40")} />
          </div>
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
      visibleToasts={5}
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
