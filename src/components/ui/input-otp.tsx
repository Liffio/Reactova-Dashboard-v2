import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, pasteTransformer, id, ...props }, ref) => {
  const generatedId = React.useId();
  return (
    <OTPInput
      ref={ref}
      // Codes are often copied or autofilled formatted ("123 456", "123-456"). Strip the separators
      // BEFORE `maxLength` truncates, or a six-digit code pastes as five.
      pasteTransformer={pasteTransformer ?? ((text) => text.replace(/[\s-]/g, ""))}
      // Password managers (Bitwarden, 1Password) and iOS/Android code suggestions decide a field is a
      // one-time code from `autocomplete`, then `name`/`id`, then the label or aria-label. The library
      // defaults `autocomplete` but sets none of the rest, so state all of them here once instead of
      // at every call site. Pair with `<Label htmlFor={id}>` where the field has a visible label.
      id={id ?? `otp-${generatedId}`}
      name="one-time-code"
      autoComplete="one-time-code"
      // Only when no caller-supplied id — a caller passing `id` binds a visible <Label>, which an
      // aria-label would override for screen readers.
      aria-label={id ? undefined : "One-time code"}
      spellCheck={false}
      autoCorrect="off"
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
});
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
