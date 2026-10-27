const indianNumberFormat = new Intl.NumberFormat("en-IN");

export function formatNumber(value: number) {
  return indianNumberFormat.format(value);
}

export function formatKilometres(value: number) {
  return `${indianNumberFormat.format(Math.round(value * 10) / 10)} km`;
}