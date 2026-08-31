export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerWarningFilter } = await import("./instrumentation.node");
    registerWarningFilter();
  }
}
