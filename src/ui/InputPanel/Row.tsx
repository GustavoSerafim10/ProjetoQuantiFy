import type { ChangeEvent } from "react";

import type { FormField, FormState } from "./types";
import { parseOptionalNumber } from "./parsers";

interface RowProps {
  label: string;

  home:
    FormField;

  away:
    FormField;

  form:
    FormState;

  handleChange: (
    event:
      ChangeEvent<HTMLInputElement>
  ) => void;

  integer?: boolean;
  percentage?: boolean;
}

/* ==========================================
   LINHA COMPARATIVA
========================================== */

export function Row({
  label,
  home,
  away,
  form,
  handleChange,
  integer = false,
  percentage = false
}: RowProps) {
  const homeValue =
    parseOptionalNumber(
      form[home]
    );

  const awayValue =
    parseOptionalNumber(
      form[away]
    );

  const bothValuesExist =
    homeValue !== null &&
    awayValue !== null;

  const homeBetter =
    bothValuesExist &&
    homeValue >
      awayValue;

  const awayBetter =
    bothValuesExist &&
    awayValue >
      homeValue;

  const difference =
    bothValuesExist &&
    awayValue !== 0
      ? (
          (
            homeValue -
            awayValue
          ) /
          Math.abs(
            awayValue
          )
        ) * 100
      : 0;

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-3 px-3 rounded-xl hover:bg-white/5">

      <input
        type="number"
        inputMode={
          integer
            ? "numeric"
            : "decimal"
        }
        step={
          integer
            ? "1"
            : "any"
        }
        min="0"
        max={
          percentage
            ? "100"
            : undefined
        }
        name={home}
        value={
          form[home] ??
          ""
        }
        onChange={
          handleChange
        }
        aria-label={`${label} do mandante`}
        className={
          `inputElite ${
            homeBetter
              ? "border-green-500"
              : ""
          }`
        }
      />

      <div className="text-center">
        <div className="text-xs text-zinc-400">
          {label}
        </div>

        {bothValuesExist &&
          Math.abs(
            difference
          ) > 0.01 && (
            <div
              className={
                `text-[11px] mt-1 font-semibold ${
                  difference > 0
                    ? "text-green-400"
                    : "text-red-400"
                }`
              }
            >
              {difference > 0
                ? "↑"
                : "↓"}{" "}

              {Math.abs(
                difference
              ).toFixed(0)}
              %
            </div>
          )}
      </div>

      <input
        type="number"
        inputMode={
          integer
            ? "numeric"
            : "decimal"
        }
        step={
          integer
            ? "1"
            : "any"
        }
        min="0"
        max={
          percentage
            ? "100"
            : undefined
        }
        name={away}
        value={
          form[away] ??
          ""
        }
        onChange={
          handleChange
        }
        aria-label={`${label} do visitante`}
        className={
          `inputElite ${
            awayBetter
              ? "border-green-500"
              : ""
          }`
        }
      />

    </div>
  );
}
