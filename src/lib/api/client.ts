import { ApiErrorSchema } from "@/lib/api/schemas";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ApiClientError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiRequest<T>(path: string, schema: { parse: (value: unknown) => T }, init?: RequestInit): Promise<T> {
  if (!baseUrl) throw new ApiClientError("Research API is not configured.", "API_NOT_CONFIGURED", 0);
  const response = await fetch(new URL(path, baseUrl), { ...init, headers: { Accept: "application/json", ...init?.headers } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    throw new ApiClientError(parsed.success ? parsed.data.message : "The research service returned an error.", parsed.success ? parsed.data.code : "API_ERROR", response.status);
  }
  return schema.parse(payload);
}
