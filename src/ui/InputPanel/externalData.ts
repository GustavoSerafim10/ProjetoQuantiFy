import type { FormField, FormState, ExternalInputData, ExternalDataInspection } from "./types";
import { parseOptionalNumber } from "./parsers";
import { isFormField } from "./fieldGuard";
import { normalizeWarnings } from "./warnings";

/*
 * Estes campos devem ser limpos quando uma nova
 * comparação completa substituir a anterior.
 *
 * Não limpamos:
 *
 * - nomes dos times;
 * - liga;
 * - odds.
 *
 * Eles podem vir de outras fontes ou serem
 * preenchidos manualmente.
 */

const HOME_STAT_FIELDS: FormField[] = [
  "homeRating",
  "homeMatches",
  "homeGoals",
  "homeConceded",
  "homeAssists",
  "homeGoalsPG",
  "homeShotsOnTarget",
  "homeBigChances",
  "homeBigChancesMissed",
  "homePossession",
  "homePasses",
  "homeLongBalls",
  "homeCleanSheets",
  "homeConcededPG",
  "homeInterceptions",
  "homeTackles",
  "homeClearances",
  "homeSaves",
  "homeFouls",
  "homeOffsides",
  "homeThrowIns",
  "homeYellow",
  "homeRed"
];

const AWAY_STAT_FIELDS: FormField[] = [
  "awayRating",
  "awayMatches",
  "awayGoals",
  "awayConceded",
  "awayAssists",
  "awayGoalsPG",
  "awayShotsOnTarget",
  "awayBigChances",
  "awayBigChancesMissed",
  "awayPossession",
  "awayPasses",
  "awayLongBalls",
  "awayCleanSheets",
  "awayConcededPG",
  "awayInterceptions",
  "awayTackles",
  "awayClearances",
  "awaySaves",
  "awayFouls",
  "awayOffsides",
  "awayThrowIns",
  "awayYellow",
  "awayRed"
];

const REQUIRED_EXTERNAL_STAT_FIELDS: FormField[] = [
  "homeMatches",
  "awayMatches",

  "homeGoals",
  "awayGoals",

  "homeConceded",
  "awayConceded",

  "homeGoalsPG",
  "awayGoalsPG",

  "homeConcededPG",
  "awayConcededPG"
];

/* ==========================================
   INSPEÇÃO DOS DADOS EXTERNOS
========================================== */

export function inspectExternalData(
  externalData:
    ExternalInputData | null | undefined
): ExternalDataInspection {
  if (!externalData) {
    return {
      received:
        false,

      partial:
        false,

      missingFields:
        [],

      warnings:
        []
    };
  }

  const missingFields =
    REQUIRED_EXTERNAL_STAT_FIELDS
      .filter(
        field =>
          parseOptionalNumber(
            externalData[field]
          ) === null
      );

  const warnings:
    string[] = [];

  if (
    missingFields.length > 0
  ) {
    warnings.push(
      "EXTERNAL_DATA_PARTIAL"
    );

    for (
      const field of missingFields
    ) {
      warnings.push(
        `MISSING_EXTERNAL_FIELD_${field.toUpperCase()}`
      );
    }
  }

  return {
    received:
      true,

    partial:
      missingFields.length > 0,

    missingFields,

    warnings:
      normalizeWarnings(
        warnings
      )
  };
}

/* ==========================================
   CONVERSÃO DOS DADOS EXTERNOS
========================================== */

export function convertExternalDataToForm(
  externalData:
    ExternalInputData
): FormState {
  const converted:
    FormState = {};

  for (
    const [
      rawKey,
      rawValue
    ] of Object.entries(
      externalData
    )
  ) {
    if (
      !isFormField(
        rawKey
      )
    ) {
      console.warn(
        "IGNORED_UNKNOWN_EXTERNAL_FIELD:",
        rawKey,
        rawValue
      );

      continue;
    }

    if (
      rawKey === "homeTeam" ||
      rawKey === "awayTeam" ||
      rawKey === "league"
    ) {
      const textValue =
        String(
          rawValue ??
          ""
        ).trim();

      if (textValue) {
        converted[rawKey] =
          textValue;
      }

      continue;
    }

    const parsed =
      parseOptionalNumber(
        rawValue
      );

    if (
      parsed !== null
    ) {
      converted[rawKey] =
        String(
          parsed
        );
    }
  }

  return converted;
}

/* ==========================================
   LIMPEZA DO ESTADO ANTERIOR
========================================== */

export function clearPreviousStatisticalFields(
  previous:
    FormState
): FormState {
  const next:
    FormState = {
      ...previous
    };

  const fieldsToClear = [
    ...HOME_STAT_FIELDS,
    ...AWAY_STAT_FIELDS
  ];

  for (
    const field of fieldsToClear
  ) {
    delete next[field];
  }

  return next;
}

/* ==========================================
   ASSINATURA DOS DADOS EXTERNOS
========================================== */

export function createExternalSignature(
  externalData:
    ExternalInputData
): string {
  const sortedEntries =
    Object.entries(
      externalData
    )
      .sort(
        (
          [keyA],
          [keyB]
        ) =>
          keyA.localeCompare(
            keyB
          )
      );

  return JSON.stringify(
    sortedEntries
  );
}
