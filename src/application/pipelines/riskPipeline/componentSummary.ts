import type {
  RiskComponent,
  RiskComponentCategory
} from "./types";

/* ==========================================
   SOMATÓRIO DOS COMPONENTES
========================================== */

export function sumComponentsByCategory(
  components: RiskComponent[],
  category:
    RiskComponentCategory
): number {
  return components
    .filter(
      component =>
        component.category ===
        category
    )
    .reduce(
      (
        total,
        component
      ) =>
        total +
        component.adjustment,

      0
    );
}
