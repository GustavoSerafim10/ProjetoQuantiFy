import type {
  RiskComponent,
  MonteCarloMetadata
} from "./types";

import { RISK_POLICY } from "./policy";

/* ==========================================
   QUALIDADE DA SIMULAÇÃO
========================================== */

export function addSimulationQualityComponents({
  components,
  metadata
}: {
  components: RiskComponent[];
  metadata: MonteCarloMetadata;
}) {
  if (metadata.valid === false) {
    components.push({
      source: "SIMULATION_QUALITY_INVALID",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.monteCarloInvalid,
      warning: "MONTE_CARLO_INVALID_FOR_RISK",
      metadata: {
        warnings: metadata.warnings
      }
    });

    return;
  }

  if (metadata.converged === false) {
    components.push({
      source: "SIMULATION_QUALITY_NOT_CONVERGED",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.monteCarloNotConverged,
      warning: "MONTE_CARLO_NOT_CONVERGED_FOR_RISK"
    });
  }

  if (
    metadata.simulationQuality === "LOW" ||
    metadata.simulationQuality === "POOR" ||
    metadata.simulationQuality === "WEAK"
  ) {
    components.push({
      source: "SIMULATION_QUALITY_LOW",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.lowSimulationQuality,
      warning: "LOW_SIMULATION_QUALITY_INCREASES_RISK",
      metadata: {
        simulationQuality: metadata.simulationQuality
      }
    });
  } else if (
    metadata.simulationQuality === "MEDIUM" ||
    metadata.simulationQuality === "MODERATE"
  ) {
    components.push({
      source: "SIMULATION_QUALITY_MEDIUM",
      category: "SIMULATION_QUALITY",
      adjustment: RISK_POLICY.mediumSimulationQuality,
      warning: "MEDIUM_SIMULATION_QUALITY_INCREASES_RISK",
      metadata: {
        simulationQuality: metadata.simulationQuality
      }
    });
  }
}
