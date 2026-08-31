const DISABLED_FEEDS_COOKIE = "wire-disabled-feeds";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function setDisabledFeedsCookie(sourceIds: string[]) {
  document.cookie = `${DISABLED_FEEDS_COOKIE}=${sourceIds.join(",")}; path=/; max-age=${ONE_YEAR_SECONDS}`;
}
