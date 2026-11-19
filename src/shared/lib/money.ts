export type Currency = "usd" | "egp";

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const egpWholeFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const egpFractionFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CENTS_PER_UNIT = 100;

// Formats an integer amount of cents (usd) or piasters (egp) for display.
export function formatPrice(amount: number, currency: Currency): string {
  const units = amount / CENTS_PER_UNIT;
  if (currency === "usd") return usdFormatter.format(units);
  const hasFraction = amount % CENTS_PER_UNIT !== 0;
  const formatter = hasFraction ? egpFractionFormatter : egpWholeFormatter;
  return `${formatter.format(units)} EGP`;
}

const RATE_HUNDREDTHS_FACTOR = 100;
const RATE_DIVISOR = 10_000;

// USD cents to whole Egyptian pounds, rounded up. Integer math only (D-101).
export function usdCentsToEgpPounds(cents: number, rate: number): number {
  const rateHundredths = Math.round(rate * RATE_HUNDREDTHS_FACTOR);
  return Math.ceil((cents * rateHundredths) / RATE_DIVISOR);
}
