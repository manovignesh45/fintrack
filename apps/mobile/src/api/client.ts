const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

type HealthCheckResult = {
  ok: boolean;
  status: number;
  body: string;
};

export async function checkHealth(): Promise<HealthCheckResult> {
  if (!API_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL in mobile .env');
  }

  const response = await fetch(`${API_BASE_URL}/health`);
  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}
