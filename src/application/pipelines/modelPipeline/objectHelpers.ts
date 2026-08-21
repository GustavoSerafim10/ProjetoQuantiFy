/* ==========================================
   HELPERS DE OBJETO
========================================== */

export function isObjectRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value
    )
  );
}

export function getObjectValue(
  value: unknown,
  key: string
): unknown {
  if (
    !isObjectRecord(
      value
    )
  ) {
    return undefined;
  }

  return value[key];
}
