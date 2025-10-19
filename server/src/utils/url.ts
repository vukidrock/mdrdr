export function normaliseMediumUrl(raw: string) {
  return raw.replace(/^https?:\/\//, "https://").split("?")[0];
}
export function buildFreediumUrl(mediumUrl: string) {
  return `https://freedium.cfd/${mediumUrl}`;
}
export function buildJinaUrl(url: string) {
  return `https://r.jina.ai/${url}`;
}
