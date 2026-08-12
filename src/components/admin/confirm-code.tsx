import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ApiError, formatApiErrorBody } from "@/lib/api/http";

/**
 * TOTP step-up for control-plane mutations.
 *
 * These endpoints take the six-digit code in the request *body* as `confirmCode` rather than in a
 * header, so the code is part of the form, not of the transport. The server strips the field
 * before the handler runs — it never lands in a log or an audit row — and it is deliberately not
 * kept in any store here either: the state lives inside whichever dialog is open and dies with it.
 *
 * Three of the backend's error codes are answers about *this field* and belong beside it rather
 * than in a toast that disappears while the operator is still typing. `applyStepUpError` sorts
 * those from everything else so callers can render the rest as a form-level message.
 */

export type StepUpError =
  /** Code missing or not six digits. */
  | { kind: "code"; message: string }
  /** Wrong code — the input is cleared so retrying doesn't mean selecting stale digits first. */
  | { kind: "code"; message: string; clear: true }
  /** No authenticator enrolled at all. There is no password fallback; they have to enrol first. */
  | { kind: "enrolment"; message: string };

export type ConfirmCodeState = {
  code: string;
  setCode: (next: string) => void;
  error: StepUpError | null;
  /** True once six digits are present — gate the submit button on this, not on a non-empty string. */
  isComplete: boolean;
  /**
   * Feeds a failed mutation back into the field.
   *
   * Returns the message the *caller* still has to render: null when the error was about the code
   * and is now shown under the input, otherwise the human-readable text of whatever else went
   * wrong (including a zod `flatten()` body, which `formatApiErrorBody` has already collapsed).
   */
  applyError: (err: unknown) => string | null;
  /** Clears code and error — call when a dialog opens or closes. */
  reset: () => void;
};

export function useConfirmCode(): ConfirmCodeState {
  const [code, setCodeState] = useState("");
  const [error, setError] = useState<StepUpError | null>(null);

  const setCode = useCallback((next: string) => {
    // The OTP input can receive pasted text; anything non-numeric would fail the server's
    // six-digit check with a message that reads as if the operator typed the wrong code.
    setCodeState(next.replace(/\D/g, "").slice(0, 6));
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setCodeState("");
    setError(null);
  }, []);

  const applyError = useCallback((err: unknown): string | null => {
    const apiError = err instanceof ApiError ? err : null;
    switch (apiError?.code) {
      case "TOTP_CODE_REQUIRED":
        setError({ kind: "code", message: apiError.message || "Enter the six-digit code." });
        return null;
      case "TOTP_INVALID":
        setCodeState("");
        setError({
          kind: "code",
          message: apiError.message || "That code didn't match. Try the current one.",
          clear: true,
        });
        return null;
      case "TOTP_REQUIRED":
        setError({
          kind: "enrolment",
          message: apiError.message || "This action needs an authenticator app on your account.",
        });
        return null;
      default:
        // Not about the code — hand it back for the caller's form-level slot. `formatApiErrorBody`
        // handles the zod-flatten shape some validation failures return in place of a string.
        return err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : formatApiErrorBody(err);
    }
  }, []);

  return { code, setCode, error, isComplete: code.length === 6, applyError, reset };
}

/** The code input plus its own error slot. Pair it with `useConfirmCode`. */
export function ConfirmCodeField({
  state,
  label = "Authenticator code",
  hint = "Six-digit code from your authenticator app.",
  disabled,
}: {
  state: ConfirmCodeState;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const { code, setCode, error } = state;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        <span className="ml-0.5 text-destructive">*</span>
      </Label>
      <InputOTP maxLength={6} value={code} onChange={setCode} disabled={disabled}>
        <InputOTPGroup>
          {Array.from({ length: 6 }).map((_, i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error?.kind === "enrolment" ? (
        <p className="text-[11px] text-destructive">
          {error.message}{" "}
          <Link to="/settings" className="font-medium underline underline-offset-2">
            Set up an authenticator
          </Link>{" "}
          — there is no password fallback for this action.
        </p>
      ) : (
        <p className={`text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error?.message ?? hint}
        </p>
      )}
    </div>
  );
}
