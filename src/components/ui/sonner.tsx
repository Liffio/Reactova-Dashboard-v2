import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;
export type AppToastType = "success" | "error" | "info" | "warning";
export type AppToastOptions = {
  title?: string;
  message?: string;
  description?: string;
  duration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center" | undefined;
};

const DEFAULT_DURATION = 5000;

const styleByType: Record<
  AppToastType,
  {
    container: string;
    backgroundOverlay: string;
    blobPrimary: string;
    blobSecondary: string;
    svgTint: string;
    iconWrap: string;
    iconColor: string;
    progressTrack: string;
    progress: string;
    closeHover: string;
    titleText: string;
    messageText: string;
  }
> = {
  success: {
    container: "bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-700",
    backgroundOverlay: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-400/15 dark:to-teal-400/10",
    blobPrimary: "bg-emerald-500/20 dark:bg-emerald-400/20",
    blobSecondary: "bg-teal-500/15 dark:bg-teal-400/15",
    svgTint: "text-emerald-500/20 dark:text-emerald-300/20",
    iconWrap: "bg-emerald-600/20 dark:bg-emerald-400/20",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    progressTrack: "bg-emerald-100 dark:bg-emerald-900/80",
    progress: "bg-emerald-500/65 dark:bg-emerald-400/65",
    closeHover: "hover:bg-emerald-100/80 dark:hover:bg-emerald-900/80",
    titleText: "text-emerald-950 dark:text-emerald-100",
    messageText: "text-emerald-800 dark:text-emerald-200"
  },
  error: {
    container: "bg-rose-100 border-rose-300 dark:bg-rose-950 dark:border-rose-700",
    backgroundOverlay: "from-rose-500/10 to-pink-500/10 dark:from-rose-400/15 dark:to-pink-400/10",
    blobPrimary: "bg-rose-500/20 dark:bg-rose-400/20",
    blobSecondary: "bg-pink-500/15 dark:bg-pink-400/15",
    svgTint: "text-rose-500/20 dark:text-rose-300/20",
    iconWrap: "bg-rose-600/20 dark:bg-rose-400/20",
    iconColor: "text-rose-700 dark:text-rose-300",
    progressTrack: "bg-rose-100 dark:bg-rose-900/80",
    progress: "bg-rose-500/65 dark:bg-rose-400/65",
    closeHover: "hover:bg-rose-100/80 dark:hover:bg-rose-900/80",
    titleText: "text-rose-950 dark:text-rose-100",
    messageText: "text-rose-800 dark:text-rose-200"
  },
  info: {
    container: "bg-sky-100 border-sky-300 dark:bg-sky-950 dark:border-sky-700",
    backgroundOverlay: "from-sky-500/10 to-blue-500/10 dark:from-sky-400/15 dark:to-blue-400/10",
    blobPrimary: "bg-sky-500/20 dark:bg-sky-400/20",
    blobSecondary: "bg-blue-500/15 dark:bg-blue-400/15",
    svgTint: "text-sky-500/20 dark:text-sky-300/20",
    iconWrap: "bg-sky-600/20 dark:bg-sky-400/20",
    iconColor: "text-sky-700 dark:text-sky-300",
    progressTrack: "bg-sky-100 dark:bg-sky-900/80",
    progress: "bg-sky-500/65 dark:bg-sky-400/65",
    closeHover: "hover:bg-sky-100/80 dark:hover:bg-sky-900/80",
    titleText: "text-sky-950 dark:text-sky-100",
    messageText: "text-sky-800 dark:text-sky-200"
  },
  warning: {
    container: "bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-700",
    backgroundOverlay: "from-amber-500/10 to-orange-500/10 dark:from-amber-400/15 dark:to-orange-400/10",
    blobPrimary: "bg-amber-500/20 dark:bg-amber-400/20",
    blobSecondary: "bg-orange-500/15 dark:bg-orange-400/15",
    svgTint: "text-amber-500/20 dark:text-amber-300/20",
    iconWrap: "bg-amber-600/20 dark:bg-amber-400/20",
    iconColor: "text-amber-700 dark:text-amber-300",
    progressTrack: "bg-amber-100 dark:bg-amber-900/80",
    progress: "bg-amber-500/65 dark:bg-amber-400/65",
    closeHover: "hover:bg-amber-100/80 dark:hover:bg-amber-900/80",
    titleText: "text-amber-950 dark:text-amber-100",
    messageText: "text-amber-800 dark:text-amber-200"
  }
};

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

function ToastCard({
  id,
  type,
  title,
  message,
  duration,
  position
}: {
  id: string | number;
  type: AppToastType;
  title: string;
  message?: string;
  duration: number;
  position?: AppToastOptions["position"];
}) {
  const style = styleByType[type];
  const Icon = iconByType[type];

  return (
    <div
      className={`app-toast group relative w-[min(92vw,360px)] md:w-[420px] overflow-hidden rounded-xl md:rounded-2xl border shadow-sm md:shadow-lg ${position ? wrapperClassByPosition[position] : ""} ${style.container}`}
      style={{ "--app-toast-duration": `${duration}ms` } as CSSProperties}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${style.backgroundOverlay}`} />
      <div className={`pointer-events-none hidden md:block absolute -top-8 -left-4 h-20 w-20 rounded-full blur-sm ${style.blobPrimary}`} />
      <div className={`pointer-events-none hidden md:block absolute -bottom-10 right-10 h-24 w-24 rounded-full blur-sm ${style.blobSecondary}`} />
      <div className={`pointer-events-none hidden md:block absolute inset-0 ${style.svgTint}`}>
        <svg className="h-full w-full" viewBox="0 0 420 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="355" cy="24" r="12" fill="currentColor" />
          <circle cx="320" cy="48" r="7" fill="currentColor" />
          <circle cx="384" cy="52" r="6" fill="currentColor" />
          <path
            d="M278 100C302 80 332 73 356 78C383 84 398 104 420 112V140H278V100Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="flex items-center w-full px-4">
        <div className={`z-10 rounded-full p-1.5 md:p-2 shadow-md ring-2 ring-background dark:ring-card ${style.iconWrap}`}>
          <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${style.iconColor}`} />
        </div>
        <div className="relative pl-7 md:pl-8 pr-3 py-2.5 md:pr-4 md:py-3.5 w-full">
          <div className="flex items-start gap-2 md:gap-3">
            <div className="min-w-0 flex-1">
            <div className={`text-[13px] md:text-[18px] font-semibold leading-5 md:leading-6 ${style.titleText}`}>{title}</div>
              {message ? (
              <div className={`mt-0.5 text-[12px] md:text-[13px] leading-[1.25rem] md:leading-[1.35rem] ${style.messageText}`}>
                  {message}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => sonnerToast.dismiss(id)}
              className={`shrink-0 rounded p-1 md:p-1.5 text-muted-foreground transition-colors hover:text-foreground ${style.closeHover}`}
            >
              <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="relative px-3 pb-2 md:px-4 md:pb-3">
        <div className={`h-1 w-full overflow-hidden rounded-full ${style.progressTrack}`}>
          <div className={`app-toast-progress h-full ${style.progress}`} />
        </div>
      </div>
    </div>
  );
}

const showToast = (
  type: AppToastType,
  titleOrOptions: string | AppToastOptions,
  options?: AppToastOptions
) => {
  const merged = typeof titleOrOptions === "string" ? { ...options, title: titleOrOptions } : titleOrOptions;
  const title = merged.title ?? "Notification";
  const message = merged.message ?? merged.description;
  const duration = merged.duration ?? DEFAULT_DURATION;
  const position = merged.position;
  const wrapperPosition: NonNullable<AppToastOptions["position"]> = position ?? "top-right";

  return sonnerToast.custom(
    (id) => (
      <ToastCard id={id} type={type} title={title} message={message} duration={duration} position={wrapperPosition} />
    ),
    { duration, position }
  );
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={props.position ?? "top-right"}
      offset={10}
      mobileOffset={10}
      expand={false}
      richColors={false}
      visibleToasts={5}
      toastOptions={{
        classNames: {
          toast: `group toast !bg-transparent !border-0 !shadow-none !p-0 ${props.position ? wrapperClassByPosition[props.position as NonNullable<AppToastOptions["position"]>] : "" }`,
          description: "hidden",
          actionButton: "hidden",
          cancelButton: "hidden"
        }
      }}
      {...props}
    />
  );
};

type ToastFn = ((title: string, options?: AppToastOptions) => string | number) & {
  success: (title: string, options?: AppToastOptions) => string | number;
  error: (title: string, options?: AppToastOptions) => string | number;
  info: (title: string, options?: AppToastOptions) => string | number;
  warning: (title: string, options?: AppToastOptions) => string | number;
  dismiss: (id?: string | number) => void;
};

const toastBase = ((title: string, options?: AppToastOptions) =>
  showToast("info", title, options)) as ToastFn;
toastBase.success = (title, options) => showToast("success", title, options);
toastBase.error = (title, options) => showToast("error", title, options);
toastBase.info = (title, options) => showToast("info", title, options);
toastBase.warning = (title, options) => showToast("warning", title, options);
toastBase.dismiss = (id) => sonnerToast.dismiss(id);

export { Toaster, toastBase as toast };
