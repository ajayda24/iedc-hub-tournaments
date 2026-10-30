import type { Prompt } from "./prompt";

const API = "https://generativelanguage.googleapis.com/v1beta";

export interface ProviderRequest {
  model: string;
  /** Gemini thinkingConfig.thinkingLevel */
  thinkingLevel?: string;
  prompt: Prompt;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface ProviderReply {
  text: string;
}

/** An error with the HTTP status (429 = rate limited, 5xx = Google's side, 0 = network/timeout). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface Provider {
  readonly name: "gemini" | "mock";
  generate(req: ProviderRequest): Promise<ProviderReply>;
}

/**
 * Google Gemini API over plain REST (no SDK). The key stays on the laptop.
 * Gemma models may refuse a system instruction; then the same text goes in
 * front of the user message (remembered per model).
 */
export class GeminiProvider implements Provider {
  readonly name = "gemini" as const;
  /** models that refused a system instruction */
  readonly noSystem = new Set<string>();

  constructor(private key: () => string | null) {}

  async generate(req: ProviderRequest): Promise<ProviderReply> {
    try {
      return await this.call(req, !this.noSystem.has(req.model));
    } catch (e) {
      if (e instanceof ProviderError && e.status === 400 && /system|instruction|developer/i.test(e.message) && !this.noSystem.has(req.model)) {
        this.noSystem.add(req.model);
        return this.call(req, false);
      }
      throw e;
    }
  }

  private async call(req: ProviderRequest, withSystem: boolean): Promise<ProviderReply> {
    const key = this.key();
    if (!key) throw new ProviderError("No Gemini API key", 401);
    const user = withSystem ? req.prompt.user : `${req.prompt.system}\n\n---\nUser:\n${req.prompt.user}`;
    const body = {
      ...(withSystem ? { systemInstruction: { parts: [{ text: req.prompt.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: req.maxOutputTokens,
        temperature: 0.4,
        ...(req.thinkingLevel ? { thinkingConfig: { thinkingLevel: req.thinkingLevel } } : {}),
      },
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${API}/models/${encodeURIComponent(req.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ProviderError(ctrl.signal.aborted ? "timeout" : `network: ${e instanceof Error ? e.message : e}`, 0);
    } finally {
      clearTimeout(timer);
    }
    const json = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      error?: { message?: string };
    } | null;
    if (!res.ok) throw new ProviderError(json?.error?.message ?? `HTTP ${res.status}`, res.status);
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
    if (!text) throw new ProviderError(`empty answer (${json?.candidates?.[0]?.finishReason ?? "no candidates"})`, 502);
    return { text };
  }

  /** Every model this key can call with generateContent. */
  async listModels(): Promise<{ id: string; label: string; inputTokenLimit?: number }[]> {
    const key = this.key();
    if (!key) throw new ProviderError("No Gemini API key", 401);
    const out: { id: string; label: string; inputTokenLimit?: number }[] = [];
    let pageToken = "";
    do {
      const res = await fetch(`${API}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`, { headers: { "x-goog-api-key": key } });
      const json = (await res.json()) as {
        models?: { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }[];
        nextPageToken?: string;
        error?: { message?: string };
      };
      if (!res.ok) throw new ProviderError(json.error?.message ?? `HTTP ${res.status}`, res.status);
      for (const m of json.models ?? []) {
        if (!m.supportedGenerationMethods?.includes("generateContent")) continue;
        out.push({ id: m.name.replace(/^models\//, ""), label: m.displayName ?? m.name, inputTokenLimit: m.inputTokenLimit });
      }
      pageToken = json.nextPageToken ?? "";
    } while (pageToken);
    return out;
  }
}
