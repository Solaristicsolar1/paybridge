/** Display only. The backend owns financial calculations. */

export function formatMoney(
  value: string,
  currency: string,
  locale = "en-US",
): string {
  if (!/^-?\d+(\.\d{1,18})?$/.test(value)) {
    return "Amount unavailable";
  }

  const negative = value.startsWith("-");

  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const minor =
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).resolvedOptions().minimumFractionDigits ?? 2;

    const digits = fraction.replace(/0+$/, "").padEnd(minor, "0");

    const separator =
      new Intl.NumberFormat(locale)
        .formatToParts(1.1)
        .find((part) => part.type === "decimal")?.value ?? ".";

    const integerParts = new Intl.NumberFormat(locale)
      .formatToParts(BigInt(integer))
      .filter((part) => part.type === "integer" || part.type === "group")
      .map((part) => part.value)
      .join("");

    let inserted = false;

    return formatter
      .formatToParts(negative ? -1 : 1)
      .map((part) => {
        if (part.type === "integer") {
          if (inserted) return "";

          inserted = true;

          return integerParts + (digits ? separator + digits : "");
        }

        if (part.type === "group") {
          return "";
        }

        return part.value;
      })
      .join("");
  } catch {
    return `${currency} ${value}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}
