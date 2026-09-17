export type HealthStatus = {
  ok: boolean;
  service: "nmsarchive";
  error?: string;
};

export async function checkHealth(
  ping: () => Promise<unknown>,
): Promise<{ status: number; body: HealthStatus }> {
  try {
    await ping();
    return { status: 200, body: { ok: true, service: "nmsarchive" } };
  } catch (error) {
    return {
      status: 503,
      body: {
        ok: false,
        service: "nmsarchive",
        error: error instanceof Error ? error.message : "database unavailable",
      },
    };
  }
}
