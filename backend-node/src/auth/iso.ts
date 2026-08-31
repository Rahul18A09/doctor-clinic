/** Match Django naive-UTC `datetime.isoformat()` used by UserSerializer. */
export function toDjangoIso(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const iso = value.toISOString().replace("Z", "");
  const [head, fraction = ""] = iso.split(".");
  if (!head) {
    return null;
  }
  const micros = fraction.padEnd(6, "0").slice(0, 6);
  if (micros === "000000") {
    return head;
  }
  return `${head}.${micros}`;
}
