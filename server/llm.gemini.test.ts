import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { invokeLLM, LLMUnavailableError, LLM_UNAVAILABLE_MESSAGE } from "./_core/llm";

const okBody = {
  id: "x",
  created: 1,
  model: "gemini-3.8-flash",
  choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
};
const json = (status: number, body: unknown = okBody) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("invokeLLM (Gemini)", () => {
  beforeEach(() => {
    ENV.geminiApiKey = "test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    ENV.geminiApiKey = "";
  });

  it("calls the Gemini OpenAI-compatible endpoint with the default model and bearer key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeLLM({ messages: [{ role: "user", content: "hello" }] });

    expect(result.choices[0]?.message.content).toBe("hi");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(init.headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(ENV.geminiModel);
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.reasoning_effort).toBe("none");
  });

  it("lets a caller choose a reasoning effort", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200));
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({ messages: [{ role: "user", content: "x" }], reasoning: { effort: "low" } });

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).reasoning_effort).toBe("low");
  });

  it("drops additionalProperties from json_schema response formats", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200));
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      messages: [{ role: "user", content: "x" }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "t",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { a: { type: "object", additionalProperties: false, properties: {} } },
          },
        },
      },
    });

    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(JSON.stringify(sent.response_format)).not.toContain("additionalProperties");
    expect(sent.response_format.json_schema.name).toBe("t");
  });

  it("retries a 503 and then succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(503, { error: "busy" })).mockResolvedValueOnce(json(200));
    vi.stubGlobal("fetch", fetchMock);

    const pending = invokeLLM({ messages: [{ role: "user", content: "x" }] });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ model: "gemini-3.8-flash" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry budget with a friendly error that hides the upstream detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { error: "secret upstream detail" }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = invokeLLM({ messages: [{ role: "user", content: "x" }] });
    const assertion = expect(pending).rejects.toMatchObject({ message: LLM_UNAVAILABLE_MESSAGE });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a client error (400)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(400, { error: "bad request" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLLM({ messages: [{ role: "user", content: "x" }] })).rejects.toBeInstanceOf(LLMUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails with the friendly error when no API key is configured", async () => {
    ENV.geminiApiKey = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLLM({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(LLM_UNAVAILABLE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
