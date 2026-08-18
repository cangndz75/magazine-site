const ISTANBUL = "Europe/Istanbul";

export function formatPublicationDate(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatPublicationDay(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL,
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(value);
}
