export function repoListKey(repos: string[]): string {
  return [...repos].sort().join(",");
}
