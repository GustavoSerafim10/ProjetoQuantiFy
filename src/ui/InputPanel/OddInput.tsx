import type { ChangeEvent } from "react";

import type { FormField, FormState } from "./types";

/* ==========================================
   ODD INPUT
========================================== */

export function OddInput({
  name,
  placeholder,
  form,
  onChange
}: {
  name: FormField;
  placeholder: string;
  form: FormState;

  onChange: (
    event:
      ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="1.01"
      name={name}
      value={
        form[name] ??
        ""
      }
      placeholder={
        placeholder
      }
      onChange={
        onChange
      }
      className="inputElite"
    />
  );
}
