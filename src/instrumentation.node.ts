export function registerWarningFilter() {
  // rss-parser (a dependency, not our code) calls the legacy url.parse() API
  // internally, which triggers Node's DEP0169 warning on every feed fetch.
  // It's explicitly non-actionable (no CVEs apply, no newer rss-parser
  // release fixes it) — suppress just this one code, not other warnings.
  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (warning.name === "DeprecationWarning" && (warning as NodeJS.ErrnoException).code === "DEP0169") {
      return;
    }
    console.warn(warning);
  });
}
