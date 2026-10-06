import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/http";
import {
  savePayoutAccount,
  type BankScheme,
  type PayoutAccount,
  type PayoutAccountConfig,
} from "@/lib/api/affiliate-api";
import { cn } from "@/lib/utils";
import { SHEET_DIALOG } from "./affiliate-format";

/**
 * Three-step payout details form (spec §5). The server owns the rules: this checks only that
 * required fields are filled (plus the confirm-account-number match, which never leaves the
 * browser) and shows the server's field errors on the step they belong to.
 */

type Form = Record<string, string | boolean>;
type Field = {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  mono?: boolean;
  upper?: boolean;
  secret?: boolean;
  inputMode?: "numeric" | "tel" | "email";
  options?: Array<[string, string]>;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 md:text-sm";

const swift = (optional: boolean): Field => ({
  key: "swift",
  label: "SWIFT/BIC",
  placeholder: "BNPAFRPP",
  mono: true,
  upper: true,
  optional,
  hint: optional
    ? "Add it if your bank has one. It helps international transfers arrive."
    : undefined,
});
const intlAccount: Field = {
  key: "accountNumber",
  label: "Account number",
  mono: true,
  upper: true,
  inputMode: "numeric",
};

/** Which bank fields each scheme asks for. Their validation lives on the server. */
const SCHEME_FIELDS: Record<BankScheme, Field[]> = {
  IBAN: [
    {
      key: "iban",
      label: "IBAN",
      placeholder: "FR14 2004 1010 0505 0001 3M02 606",
      mono: true,
      upper: true,
    },
    swift(false),
  ],
  US: [
    {
      key: "routingNumber",
      label: "Routing number",
      mono: true,
      inputMode: "numeric",
      placeholder: "9 digits",
    },
    {
      key: "usAccountType",
      label: "Account type",
      options: [
        ["checking", "Checking"],
        ["savings", "Savings"],
      ],
    },
    intlAccount,
    swift(true),
  ],
  UK: [
    {
      key: "sortCode",
      label: "Sort code",
      mono: true,
      inputMode: "numeric",
      placeholder: "12-34-56",
    },
    { ...intlAccount, placeholder: "8 digits" },
    swift(true),
  ],
  AU: [
    { key: "bsb", label: "BSB", mono: true, inputMode: "numeric", placeholder: "6 digits" },
    intlAccount,
    swift(true),
  ],
  CA: [
    {
      key: "institutionNumber",
      label: "Institution number",
      mono: true,
      inputMode: "numeric",
      placeholder: "3 digits",
    },
    {
      key: "transitNumber",
      label: "Transit number",
      mono: true,
      inputMode: "numeric",
      placeholder: "5 digits",
    },
    intlAccount,
    swift(true),
  ],
  SWIFT: [intlAccount, swift(false)],
};

const STEP_OF: Record<string, 1 | 2> = {
  residency: 1,
  countryCode: 1,
  legalName: 1,
  phone: 2,
  addressLine1: 2,
  addressLine2: 2,
  city: 2,
  region: 2,
  postalCode: 2,
};

const fromAccount = (a: PayoutAccount | null): Form =>
  a
    ? {
        residency: a.residency,
        countryCode: a.countryCode,
        legalName: a.legalName,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2 ?? "",
        city: a.city,
        region: a.region ?? "",
        postalCode: a.postalCode,
        method: a.method === "BANK_INTL" ? "" : a.method,
        accountType: "savings",
        usAccountType: "checking",
      }
    : { residency: "IN", method: "UPI", accountType: "savings", usAccountType: "checking" };

export function PayoutAccountDialog({
  open,
  onOpenChange,
  account,
  config,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: PayoutAccount | null;
  config: PayoutAccountConfig | undefined;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<Form>(() => fromAccount(account));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm(fromAccount(account));
      setErrors({});
      setFormError(null);
    }
  }, [open, account]);

  const india = form.residency === "IN";
  const country = config?.countries.find((c) => c.code === (india ? "IN" : form.countryCode));
  const scheme: BankScheme = country?.scheme ?? "SWIFT";
  const regionOptional =
    !india && config?.regionOptionalCountries.includes(String(form.countryCode));
  const postalLabel = india ? "PIN code" : form.countryCode === "US" ? "ZIP code" : "Postal code";

  const set = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const fields = useMemo((): Field[] => {
    if (step === 1) {
      return [
        ...(india
          ? []
          : [
              {
                key: "countryCode",
                label: "Country you live in",
                options: (config?.countries ?? [])
                  .filter((c) => c.code !== "IN")
                  .map((c): [string, string] => [c.code, c.name]),
              },
            ]),
        {
          key: "legalName",
          label: "Full legal name",
          hint: "As it appears on your bank account",
          placeholder: "Your full name",
        },
      ];
    }
    if (step === 2) {
      return [
        {
          key: "phone",
          label: "Phone number",
          inputMode: "tel",
          placeholder: india ? "98765 43210" : "Phone number",
          hint: "Only used for payout and verification issues.",
        },
        { key: "addressLine1", label: "Address line 1", placeholder: "House, street" },
        { key: "addressLine2", label: "Address line 2", optional: true },
        { key: "city", label: "City" },
        india
          ? {
              key: "region",
              label: "State",
              options: (config?.indianStates ?? []).map((s): [string, string] => [s, s]),
            }
          : {
              key: "region",
              label: form.countryCode === "GB" ? "County" : "State / Province",
              optional: regionOptional,
            },
        {
          key: "postalCode",
          label: postalLabel,
          inputMode: india || form.countryCode === "US" ? "numeric" : undefined,
        },
      ];
    }
    if (india && form.method === "UPI") {
      return [
        {
          key: "upiId",
          label: "UPI ID",
          placeholder: "name@bank",
          mono: true,
          hint: "Find it in your UPI app under your profile. It must be linked to an account in your name.",
        },
      ];
    }
    if (india) {
      return [
        { key: "holder", label: "Account holder name" },
        {
          key: "accountNumber",
          label: "Account number",
          mono: true,
          secret: true,
          inputMode: "numeric",
        },
        {
          key: "confirmAccountNumber",
          label: "Confirm account number",
          mono: true,
          inputMode: "numeric",
        },
        { key: "ifsc", label: "IFSC", placeholder: "HDFC0001234", mono: true, upper: true },
        {
          key: "accountType",
          label: "Account type",
          options: [
            ["savings", "Savings"],
            ["current", "Current"],
          ],
        },
      ];
    }
    return [
      { key: "holder", label: "Account holder name" },
      { key: "bankName", label: "Bank name" },
      ...SCHEME_FIELDS[scheme],
    ];
  }, [step, india, form.method, form.countryCode, scheme, config, postalLabel, regionOptional]);

  const focusFirstError = (errs: Record<string, string>) => {
    requestAnimationFrame(() => {
      const key = Object.keys(errs).find((k) => errs[k]);
      const el = bodyRef.current?.querySelector<HTMLElement>(`[data-field="${key}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus();
    });
  };

  const checkStep = () => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (!f.optional && !String(form[f.key] ?? "").trim())
        errs[f.key] = `Enter ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}`;
    }
    if (
      step === 3 &&
      india &&
      form.method === "BANK_IN" &&
      form.accountNumber &&
      form.accountNumber !== form.confirmAccountNumber
    ) {
      errs.confirmAccountNumber = "Account numbers don't match";
    }
    if (step === 3 && !form.confirm) errs.confirm = "Confirm the account is in your name";
    setErrors(errs);
    if (Object.keys(errs).length) focusFirstError(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const { confirmAccountNumber: _ignored, ...body } = form;
      return savePayoutAccount({ ...body, method: india ? form.method : "BANK_INTL" });
    },
    onSuccess: () => {
      toast.success("Payout details saved");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => {
      const fieldErrors =
        (e instanceof ApiError
          ? (e.body as { fieldErrors?: Record<string, string> })?.fieldErrors
          : undefined) ?? null;
      if (fieldErrors && Object.keys(fieldErrors).length) {
        const first = Object.keys(fieldErrors)[0];
        setStep(STEP_OF[first] ?? 3);
        setErrors(fieldErrors);
        setFormError(null);
        focusFirstError(fieldErrors);
      } else {
        setFormError((e as Error).message);
      }
    },
  });

  const next = () => {
    if (!checkStep()) return;
    if (step < 3) {
      // Bank holder defaults to the legal name the first time.
      if (step === 2 && !form.holder) set("holder", String(form.legalName ?? ""));
      setStep((s) => (s + 1) as 1 | 2 | 3);
      setErrors({});
    } else {
      mutation.mutate();
    }
  };

  const titles = {
    1: ["Payout details", "Tell us who we're paying. You only do this once."],
    2: ["Contact details", "Needed for tax records and to reach you about payouts."],
    3: [
      "Where should we send money?",
      india
        ? "Choose UPI or a bank account in your name."
        : "Affiliates outside India are paid by bank transfer.",
    ],
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_DIALOG}>
        <DialogHeader>
          <DialogTitle>{titles[step][0]}</DialogTitle>
          <DialogDescription>{titles[step][1]}</DialogDescription>
          <div className="flex gap-1.5 pt-2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-foreground" : "bg-muted")}
              />
            ))}
          </div>
        </DialogHeader>

        <div ref={bodyRef} className="space-y-4">
          {step === 1 && (
            <ChoiceGroup
              label="Where do you live?"
              value={String(form.residency)}
              onChange={(v) => {
                set("residency", v);
                set("method", v === "IN" ? "UPI" : "");
              }}
              options={[
                ["IN", "India", "UPI or bank transfer"],
                ["INTL", "Outside India", "International bank transfer"],
              ]}
            />
          )}
          {step === 2 && (
            <p className="text-[13px] text-muted-foreground">
              Country: <b className="font-medium text-foreground">{country?.name ?? "—"}</b> (
              {country?.dialCode})
            </p>
          )}
          {step === 3 && india && (
            <ChoiceGroup
              label="Payout method"
              value={String(form.method)}
              onChange={(v) => set("method", v)}
              options={[
                ["UPI", "UPI", "Paid to your UPI ID"],
                ["BANK_IN", "Bank account", "NEFT/IMPS to your savings or current account"],
              ]}
            />
          )}

          {fields.map((f, i) => (
            <FieldRow
              key={f.key}
              field={f}
              value={String(form[f.key] ?? "")}
              error={errors[f.key]}
              autoFocus={i === 0 && step !== 1}
              prefix={f.key === "phone" ? country?.dialCode : undefined}
              onChange={(v) => set(f.key, v)}
            />
          ))}

          {step === 3 && (
            <>
              {!india && (
                <p className="text-xs text-muted-foreground">
                  Your bank may charge a fee to receive international transfers.
                </p>
              )}
              <div>
                <label
                  className="flex items-start gap-2.5 text-[13px]"
                  data-field="confirm"
                  tabIndex={-1}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                    checked={!!form.confirm}
                    onChange={(e) => set("confirm", e.target.checked)}
                  />
                  <span>
                    This account is in my name{form.legalName ? ` (${String(form.legalName)})` : ""}{" "}
                    and the details are correct.
                  </span>
                </label>
                {errors.confirm && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    {errors.confirm}
                  </p>
                )}
              </div>
            </>
          )}

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => (s - 1) as 1 | 2))}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button className="max-sm:w-full" disabled={mutation.isPending} onClick={next}>
            {step < 3 ? "Continue" : mutation.isPending ? "Saving…" : "Save payout details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string, string]>;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {options.map(([v, title, sub]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              value === v
                ? "border-foreground bg-muted/50 ring-1 ring-foreground"
                : "hover:bg-muted/40",
            )}
          >
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  error,
  autoFocus,
  prefix,
  onChange,
}: {
  field: Field;
  value: string;
  error?: string;
  autoFocus?: boolean;
  prefix?: string;
  onChange: (v: string) => void;
}) {
  const id = `payout-${field.key}`;
  const common = {
    id,
    "data-field": field.key,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-err` : undefined,
    autoFocus,
  };
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {field.label}
        {field.optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {field.options ? (
        <select
          {...common}
          className={SELECT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          {field.options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex gap-2">
          {prefix && (
            <span className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
              {prefix}
            </span>
          )}
          <Input
            {...common}
            type={field.secret ? "password" : "text"}
            inputMode={field.inputMode}
            autoComplete="off"
            spellCheck={false}
            placeholder={field.placeholder}
            className={cn(field.mono && "font-mono")}
            value={value}
            onChange={(e) => onChange(field.upper ? e.target.value.toUpperCase() : e.target.value)}
          />
        </div>
      )}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}
