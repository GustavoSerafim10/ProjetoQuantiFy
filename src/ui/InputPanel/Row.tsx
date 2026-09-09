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

  /*
   * Barra de proporção casa x fora (Fase 2 do redesign visual,
   * 2026-09-09) — puramente derivada dos valores que o usuário já
   * digitou, nunca inventa número novo. Sem os dois valores, cai
   * pra 50/50 (neutro), sem indicar vantagem nenhuma.
   */
  const totalMagnitude =
    bothValuesExist
      ? Math.abs(homeValue) + Math.abs(awayValue)
      : 0;

  const homeShare =
    totalMagnitude > 0
      ? (Math.abs(homeValue ?? 0) / totalMagnitude) * 100
      : 50;

  const awayShare =
    totalMagnitude > 0
      ? (Math.abs(awayValue ?? 0) / totalMagnitude) * 100
      : 50;

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-3 px-3 rounded-xl hover:bg-white/5">

      <div className="space-y-1.5">
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
                ? "border-quantify-green"
                : ""
            }`
          }
        />

        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className={
              `h-full ml-auto rounded-full transition-all ${
                homeBetter
                  ? "bg-quantify-green"
                  : "bg-white/20"
              }`
            }
            style={{ width: `${homeShare}%` }}
          />
        </div>
      </div>

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
                    ? "text-quantify-green"
                    : "text-quantify-red"
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

      <div className="space-y-1.5">
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
                ? "border-quantify-cyan"
                : ""
            }`
          }
        />

        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className={
              `h-full rounded-full transition-all ${
                awayBetter
                  ? "bg-quantify-cyan"
                  : "bg-white/20"
              }`
            }
            style={{ width: `${awayShare}%` }}
          />
        </div>
      </div>

    </div>
  );
}
