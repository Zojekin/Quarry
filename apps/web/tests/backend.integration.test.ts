import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { createSqliteDatabase } from "../../../packages/database/src/index.js";
import { createQuarryServer } from "../../../packages/server/src/app.js";
import { BackendClient } from "../src/api/client.js";
let db: Awaited<ReturnType<typeof createSqliteDatabase>>;
let api: BackendClient;
beforeEach(async () => {
  db = await createSqliteDatabase(":memory:");
  const app = createQuarryServer({ db: db.db });
  api = new BackendClient("http://localhost", (url, init) =>
    app.request(String(url), init),
  );
});
afterEach(async () => {
  await db.destroy();
});
async function content() {
  const folder = await api.folders.create({ name: "Folder" });
  const bank = await api.banks.create({ name: "Bank", folder_id: folder.id });
  const source = await api.questions.create({
    owner_id: bank.id,
    owner_type: "question_bank",
    type: "single_choice",
    content: "Question",
    explanation: "Secret solution",
    max_score: 3,
    options: [
      { id: crypto.randomUUID(), content: "A", is_correct: true },
      { id: crypto.randomUUID(), content: "B", is_correct: false },
    ],
  });
  const paper = await api.papers.create({
    name: "Paper",
    folder_id: folder.id,
  });
  await api.papers.addItem(paper.id, { source_question_id: source.id });
  return { folder, bank, source, paper };
}
describe("BackendClient against the real Hono API and SQLite", () => {
  it("changes a question type without leaking old variant fields or changing its identity", async () => {
    const { source, paper } = await content();
    const session = await api.sessions.start(paper.id, "practice");
    const changed = await api.questions.update(source.id, {
      type: "subjective",
      reference_answer: "Reference",
      content: "Explain",
    } as never);
    expect(changed.id).toBe(source.id);
    expect(changed.version).toBe(2);
    expect(changed).not.toHaveProperty("options");
    expect((await api.sessions.get(session.id)).items[0]!.question.type).toBe(
      "single_choice",
    );
  });
  it("returns immutable paper metadata for exam timing after editing the live paper", async () => {
    const { paper } = await content();
    await api.papers.update(paper.id, {
      name: "Original",
      time_limit_seconds: 60,
    });
    const session = await api.sessions.start(paper.id, "exam");
    await api.papers.update(paper.id, {
      name: "Changed",
      time_limit_seconds: 600,
    });
    expect(await api.sessions.get(session.id)).toMatchObject({
      paper_name: "Original",
      time_limit_seconds: 60,
    });
  });
  it("restores drafts without statistics, locks submission and retains new attempts", async () => {
    const { paper } = await content();
    const session = await api.sessions.start(paper.id, "practice");
    const q = session.items[0]!.question;
    expect(q.explanation).toBeUndefined();
    const answer = { kind: "choice" as const, option_ids: [q.options![0]!.id] };
    await api.sessions.saveDraft(session.id, {
      current_index: 0,
      question_id: q.id,
      user_answer: answer,
    });
    expect((await api.sessions.get(session.id)).draft_answers[q.id]).toEqual(
      answer,
    );
    expect((await api.analytics.getDashboard()).total_questions_answered).toBe(
      0,
    );
    await api.sessions.submitQuestion(session.id, {
      question_id: q.id,
      answer,
      attempt_index: 1,
    });
    await expect(
      api.sessions.saveDraft(session.id, {
        question_id: q.id,
        user_answer: answer,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await api.sessions.submitQuestion(session.id, {
      question_id: q.id,
      answer,
      attempt_index: 2,
    });
    const complete = await api.sessions.finishPractice(session.id);
    expect(complete.records).toHaveLength(2);
    expect(complete.status).toBe("completed");
  });
  it("conceals exam solutions, persists answers and grades on submission", async () => {
    const { paper } = await content();
    const session = await api.sessions.start(paper.id, "exam");
    const q = session.items[0]!.question;
    const answer = { kind: "choice" as const, option_ids: [q.options![0]!.id] };
    await api.sessions.saveDraft(session.id, {
      question_id: q.id,
      user_answer: answer,
    });
    const restored = await api.sessions.get(session.id);
    expect(restored.records).toEqual([]);
    expect(restored.items[0]!.question.options![0]).not.toHaveProperty(
      "is_correct",
    );
    await api.sessions.pause(session.id);
    expect((await api.sessions.resume(session.id)).status).toBe("in_progress");
    await api.sessions.submitExam(session.id, [{ question_id: q.id, answer }]);
    expect(
      (await api.sessions.get(session.id)).items[0]!.question.explanation,
    ).toBe("Secret solution");
  });
  it("uses historical filters and saves exactly the selected mistakes into a paper", async () => {
    const { paper, folder } = await content();
    const session = await api.sessions.start(paper.id, "practice");
    await api.sessions.submitQuestion(session.id, {
      question_id: session.items[0]!.question.id,
      answer: { kind: "choice", option_ids: [] },
      attempt_index: 1,
    });
    expect(await api.mistakes.list({ types: [] })).toEqual([]);
    const mistakes = await api.mistakes.list({
      folder_ids: [folder.id],
      source_paper_ids: [paper.id],
    });
    expect(mistakes).toHaveLength(1);
    const review = await api.mistakes.createPaper(
      mistakes.map((m) => m.id),
      "Review",
    );
    expect(review.sections.flatMap((s) => s.items)).toHaveLength(1);
    await api.mistakes.mastery(mistakes[0]!.id, "mastered");
    expect(await api.mistakes.list({ mastery_status: "reviewing" })).toEqual(
      [],
    );
  });
  it("persists namespace-isolated colors and restores deleted folders", async () => {
    const file = await api.tags.create({ name: "Shared", target_type: "file" });
    const question = await api.tags.create({
      name: "Shared",
      target_type: "question",
    });
    await api.tags.updateColor(file.id, "#123456");
    expect((await api.tags.list("question"))[0]!.color).toBeNull();
    expect((await api.tags.list("file"))[0]!.color).toBe("#123456");
    const folder = await api.folders.create({ name: "Trash folder" });
    await api.folders.delete(folder.id);
    expect((await api.trash.list()).some((t) => t.id === folder.id)).toBe(true);
    await api.trash.restore("folders", folder.id);
    expect((await api.folders.get(folder.id)).name).toBe("Trash folder");
  });
});
