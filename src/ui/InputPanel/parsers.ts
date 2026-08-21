import type { FormField, FormState } from "./types";

/* ==========================================
   PARSERS
========================================== */

export function readNumber(
  form:
    FormState,

  key:
    FormField
): number | null {
  return parseOptionalNumber(
    form[key]
  );
}

export function parseOptionalNumber(
  value:
    unknown
): number | null {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const normalized =
    String(
      value
    )
      .replace(
        ",",
        "."
      )
      .trim();

  if (
    normalized === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      normalized
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}
