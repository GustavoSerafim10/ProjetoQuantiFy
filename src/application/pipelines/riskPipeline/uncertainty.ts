import type { RiskComponent } from "./types";

import { RISK_POLICY, STRUCTURE_THRESHOLDS } from "./policy";

import { roundNumber } from "./helpers";

/* ==========================================
   INCERTEZA ESTATÍSTICA
========================================== */

export function addUncertaintyComponents({
  components,

  samplingError,

  modelSimulationDivergence,

  goalExpectationScore
}: {
  components:
    RiskComponent[];

  samplingError:
    number | null;

  modelSimulationDivergence:
    number | null;

  goalExpectationScore:
    number | null;
}) {
  if (
    samplingError === null
  ) {
    components.push({
      source:
        "UNCERTAINTY_MISSING_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .missingSamplingError,

      warning:
        "MISSING_MONTE_CARLO_SAMPLING_ERROR"
    });
  } else if (
    samplingError >=
    STRUCTURE_THRESHOLDS
      .extremeSamplingError
  ) {
    components.push({
      source:
        "UNCERTAINTY_EXTREME_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .extremeSamplingError,

      warning:
        "EXTREME_MONTE_CARLO_SAMPLING_ERROR",

      metadata: {
        samplingError:
          roundNumber(
            samplingError
          )
      }
    });
  } else if (
    samplingError >=
    STRUCTURE_THRESHOLDS
      .highSamplingError
  ) {
    components.push({
      source:
        "UNCERTAINTY_HIGH_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .highSamplingError,

      warning:
        "HIGH_MONTE_CARLO_SAMPLING_ERROR",

      metadata: {
        samplingError:
          roundNumber(
            samplingError
          )
      }
    });
  } else if (
    samplingError >=
    STRUCTURE_THRESHOLDS
      .moderateSamplingError
  ) {
    components.push({
      source:
        "UNCERTAINTY_MODERATE_MONTE_CARLO_ERROR",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .moderateSamplingError,

      warning:
        "MODERATE_MONTE_CARLO_SAMPLING_ERROR",

      metadata: {
        samplingError:
          roundNumber(
            samplingError
          )
      }
    });
  }

  if (
    modelSimulationDivergence === null
  ) {
    components.push({
      source:
        "UNCERTAINTY_MISSING_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .missingModelSimulationDivergence,

      warning:
        "MISSING_MODEL_SIMULATION_DIVERGENCE"
    });
  } else if (
    modelSimulationDivergence >=
    STRUCTURE_THRESHOLDS
      .extremeModelSimulationDivergence
  ) {
    components.push({
      source:
        "UNCERTAINTY_EXTREME_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .extremeModelSimulationDivergence,

      warning:
        "EXTREME_MODEL_SIMULATION_DIVERGENCE",

      metadata: {
        modelSimulationDivergence:
          roundNumber(
            modelSimulationDivergence
          )
      }
    });
  } else if (
    modelSimulationDivergence >=
    STRUCTURE_THRESHOLDS
      .highModelSimulationDivergence
  ) {
    components.push({
      source:
        "UNCERTAINTY_HIGH_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .highModelSimulationDivergence,

      warning:
        "HIGH_MODEL_SIMULATION_DIVERGENCE",

      metadata: {
        modelSimulationDivergence:
          roundNumber(
            modelSimulationDivergence
          )
      }
    });
  } else if (
    modelSimulationDivergence >=
    STRUCTURE_THRESHOLDS
      .moderateModelSimulationDivergence
  ) {
    components.push({
      source:
        "UNCERTAINTY_MODERATE_MODEL_SIMULATION_DIVERGENCE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .moderateModelSimulationDivergence,

      warning:
        "MODERATE_MODEL_SIMULATION_DIVERGENCE",

      metadata: {
        modelSimulationDivergence:
          roundNumber(
            modelSimulationDivergence
          )
      }
    });
  }

  if (
    goalExpectationScore === null
  ) {
    components.push({
      source:
        "UNCERTAINTY_MISSING_GOAL_EXPECTATION_SCORE",

      category:
        "UNCERTAINTY",

      adjustment:
        RISK_POLICY
          .missingGoalExpectationScore,

      warning:
        "MISSING_OFFICIAL_GOAL_EXPECTATION_SCORE"
    });
  }
}
