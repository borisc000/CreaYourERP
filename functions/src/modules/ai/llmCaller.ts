/**
 * LLM provider HTTP caller.
 * Supports OpenAI, Anthropic, and Google Gemini.
 */

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallResult {
  ok: boolean;
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  error?: string;
  raw?: unknown;
}

export interface LLMProviderConfig {
  providerType: string;
  apiKey: string;
  apiBaseUrl?: string;
  defaultModel?: string;
  timeoutSeconds?: number;
}

export async function callLLM(
  config: LLMProviderConfig,
  messages: LLMMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<LLMCallResult> {
  const type = config.providerType.toLowerCase();
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 1024;
  const timeoutMs = (config.timeoutSeconds || 30) * 1000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (type === "openai" || type === "openai_compatible") {
      return await callOpenAI(config, messages, temperature, maxTokens, controller.signal);
    }
    if (type === "anthropic") {
      return await callAnthropic(config, messages, temperature, maxTokens, controller.signal);
    }
    if (type === "google" || type === "gemini") {
      return await callGemini(config, messages, temperature, maxTokens, controller.signal);
    }
    return { ok: false, text: "", error: `Unsupported provider type: ${config.providerType}` };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { ok: false, text: "", error: "LLM request timed out" };
    }
    return { ok: false, text: "", error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  config: LLMProviderConfig,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<LLMCallResult> {
  const url = config.apiBaseUrl || "https://api.openai.com/v1/chat/completions";
  const model = config.defaultModel || "gpt-4o-mini";

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
  };

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, text: "", error: data?.error?.message || `HTTP ${res.status}`, raw: data };
  }

  const text = String(data.choices?.[0]?.message?.content ?? "").trim();
  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      }
    : undefined;

  return { ok: true, text, usage, raw: data };
}

async function callAnthropic(
  config: LLMProviderConfig,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<LLMCallResult> {
  const url = config.apiBaseUrl || "https://api.anthropic.com/v1/messages";
  const model = config.defaultModel || "claude-3-5-sonnet-20241022";

  const systemMsg = messages.find((m) => m.role === "system");
  const otherMsgs = messages.filter((m) => m.role !== "system");

  const body: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: otherMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, text: "", error: data?.error?.message || `HTTP ${res.status}`, raw: data };
  }

  const text = String(data.content?.[0]?.text ?? "").trim();
  const usage = data.usage
    ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      }
    : undefined;

  return { ok: true, text, usage, raw: data };
}

async function callGemini(
  config: LLMProviderConfig,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<LLMCallResult> {
  const model = config.defaultModel || "gemini-1.5-flash-latest";
  const url =
    config.apiBaseUrl ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  const parts = messages.map((m) => ({ text: `[${m.role.toUpperCase()}]\n${m.content}` }));

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, text: "", error: data?.error?.message || `HTTP ${res.status}`, raw: data };
  }

  const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  const usage = data.usageMetadata
    ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      }
    : undefined;

  return { ok: true, text, usage, raw: data };
}
