import { useState, useCallback } from "react";

/**
 * On-touch field validation, without restructuring a form into a form library.
 *
 * The app's forms are hand-built with `useState` and the synchronous validators in `lib/validation`
 * (each returns `string | null`). This hook adds only the missing piece: *when* to show a field's
 * error. An error is revealed once the field has been blurred (touched) or once submit has been
 * attempted — never while the user is still first typing into an untouched field.
 *
 * Usage:
 *   const t = useTouched();
 *   const nameErr = lengthError(name, "Name", LIMITS.workspaceName);
 *   <Input onBlur={t.onBlur("name")} ... />
 *   {t.visible("name") && nameErr && <p className="error">{nameErr}</p>}
 *   // on submit: t.submit(); if (!nameErr) save();
 */
export function useTouched() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const markTouched = useCallback((name: string) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  /** Blur handler for a field: `onBlur={t.onBlur("email")}`. */
  const onBlur = useCallback((name: string) => () => markTouched(name), [markTouched]);

  /** Whether this field's error should be shown yet. */
  const visible = useCallback(
    (name: string) => submitted || Boolean(touched[name]),
    [submitted, touched],
  );

  /** Call on a submit attempt so every field's error becomes visible at once. */
  const submit = useCallback(() => setSubmitted(true), []);

  /** Clear touched/submitted state — e.g. after a successful save or when the record changes. */
  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { onBlur, markTouched, visible, submit, reset };
}
