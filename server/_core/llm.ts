import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    // Manus-only content type; the Gemini endpoint cannot fetch arbitrary file URLs.
    throw new Error("file_url message content is not supported by the Gemini endpoint");
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

// Each attempt gets its own timeout; retries cover rate limits, upstream errors and network failures.
const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 8_000;

/** Shown to members when the AI cannot answer; details stay in the server log. */
export const LLM_UNAVAILABLE_MESSAGE =
  "Sally is taking a short break. Please try again in a moment.";

export class LLMUnavailableError extends Error {
  constructor(public readonly detail: string) {
    super(LLM_UNAVAILABLE_MESSAGE);
    this.name = "LLMUnavailableError";
  }
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff.
const computeBackoffDelay = (attempt: number, retryAfterMs?: number): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

/**
 * Gemini's schema dialect rejects `additionalProperties`, which several callers
 * set. Dropping it keeps the call working; `strict` is likewise not honoured.
 */
const stripUnsupportedSchemaKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUnsupportedSchemaKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key === "additionalProperties") continue;
      out[key] = stripUnsupportedSchemaKeys(inner);
    }
    return out;
  }
  return value;
};

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

async function postWithRetry(url: string, init: FetchInit): Promise<Response> {
  let lastDetail = "unknown error";

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    let retryAfterMs: number | undefined;
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return response;

      const body = await response.text().catch(() => "");
      lastDetail = `HTTP ${response.status} ${body.slice(0, 300)}`;
      if (!isRetryableStatus(response.status)) {
        throw new LLMUnavailableError(lastDetail);
      }
      retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    } catch (error) {
      if (error instanceof LLMUnavailableError) throw error;
      lastDetail =
        error instanceof Error && error.name === "TimeoutError"
          ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `network error: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (attempt < RETRY_MAX_RETRIES) {
      console.warn(`[LLM] retry ${attempt + 1}/${RETRY_MAX_RETRIES} (${lastDetail})`);
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    }
  }

  throw new LLMUnavailableError(lastDetail);
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    console.error("[LLM] GEMINI_API_KEY is not configured");
    throw new LLMUnavailableError("GEMINI_API_KEY is not configured");
  }

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    reasoning,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    model: model || ENV.geminiModel,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  // Hidden "thinking" tokens count against max_tokens and truncate JSON answers, and make every
  // call slower. Turn thinking off unless a caller asks for a specific effort.
  const requestedEffort = (reasoning as { effort?: unknown } | undefined)?.effort;
  payload.reasoning_effort = typeof requestedEffort === "string" ? requestedEffort : "none";

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format =
      normalizedResponseFormat.type === "json_schema"
        ? {
            type: "json_schema",
            json_schema: {
              ...normalizedResponseFormat.json_schema,
              schema: stripUnsupportedSchemaKeys(normalizedResponseFormat.json_schema.schema),
            },
          }
        : normalizedResponseFormat;
  }

  let response: Response;
  try {
    response = await postWithRetry(`${GEMINI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.geminiApiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof LLMUnavailableError) {
      console.error(`[LLM] request failed: ${error.detail}`);
    }
    throw error;
  }

  return (await response.json()) as InvokeResult;
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  if (!ENV.geminiApiKey) throw new LLMUnavailableError("GEMINI_API_KEY is not configured");
  const response = await postWithRetry(`${GEMINI_BASE_URL}/models`, {
    method: "GET",
    headers: { authorization: `Bearer ${ENV.geminiApiKey}` },
  });
  return (await response.json()) as ModelsResponse;
}
