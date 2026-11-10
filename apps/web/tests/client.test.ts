import { describe, it, expect, vi } from "vitest";
import { BackendClient, BackendError } from "../src/api/client.js";
function harness() {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: { id: "saved" } }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  return { fetcher, api: new BackendClient("http://localhost:48123", fetcher) };
}
describe("BackendClient HTTP contracts", () => {
  it("preserves explicit empty filters and comma separated OR values", () => {
    const { api } = harness();
    const url = new URL(
      api.url("mistakes", {
        types: [],
        tag_ids: ["a", "b"],
        date_from: "2026-11-01",
      }),
    );
    expect(url.searchParams.get("types")).toBe("");
    expect(url.searchParams.get("tag_ids")).toBe("a,b");
    expect(url.searchParams.has("folder_ids")).toBe(false);
  });
  it("serializes draft position and answer without submitting", async () => {
    const { api, fetcher } = harness();
    const input = {
      current_index: 2,
      question_id: "q",
      user_answer: { kind: "choice" as const, option_ids: ["stable-option"] },
    };
    await api.sessions.saveDraft("session", input);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:48123/api/sessions/session/draft",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
  it("uses the distinct complete practice endpoint", async () => {
    const { api, fetcher } = harness();
    await api.sessions.finishPractice("s");
    expect(fetcher.mock.calls[0]?.[0]).toContain("/sessions/s/complete");
  });
  it("sends selected mistake IDs to create-paper", async () => {
    const { api, fetcher } = harness();
    await api.mistakes.createPaper(["m1", "m2"], "复习");
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      ids: ["m1", "m2"],
      name: "复习",
    });
  });
  it("exposes structured server errors", async () => {
    const { api, fetcher } = harness();
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Submission is locked",
            details: { question: "q" },
          },
        }),
        { status: 409 },
      ),
    );
    await expect(api.sessions.saveDraft("s", {})).rejects.toMatchObject({
      status: 409,
      code: "INVALID_STATE",
      message: "Submission is locked",
    });
  });
  it("uploads multipart without overriding its boundary", async () => {
    const { api, fetcher } = harness();
    await api.attachments.upload(new File(["image"], "a.png"));
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.body).toBeInstanceOf(FormData);
    expect(request?.headers).toBeUndefined();
  });
  it("downloads binary archives without parsing JSON", async () => {
    const { api, fetcher } = harness();
    fetcher.mockResolvedValue(new Response(new Blob(["zip"])));
    expect(await (await api.backup.export("folder", "f")).text()).toBe("zip");
    expect(fetcher.mock.calls[0]?.[0]).toContain(
      "/export/folder/f?format=quarry",
    );
  });
  it("updates tag colors through PUT", async () => {
    const { api, fetcher } = harness();
    await api.tags.updateColor("t", "#123456");
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:48123/api/tags/t",
      expect.objectContaining({ method: "PUT", body: '{"color":"#123456"}' }),
    );
    expect(new BackendClient().attachments.url("a")).toContain(
      "/api/attachments/a",
    );
  });
});
