import { buttonVariants } from "./ui/button.js";
import { Input, NativeSelect, Textarea } from "./ui/form.js";
import { useState } from "react";
import { QuestionSchema } from "@quarry/shared";
import { client } from "../api/client.js";
import type { QuestionView, Tag } from "../api/client.js";
import { Button, IconButton, Modal, tagColorStyle, types } from "./ui.js";
import { Markdown } from "./Markdown.js";
export function QuestionEditor({
  question,
  ownerId,
  paper,
  availableTags = [],
  onSaved,
  onClose,
}: {
  question?: QuestionView;
  ownerId: string;
  paper: boolean;
  availableTags?: Tag[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [type, setType] = useState(question?.type ?? "single_choice");
  const [content, setContent] = useState(question?.content ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [options, setOptions] = useState(
    question?.options ?? [
      { id: crypto.randomUUID(), content: "", is_correct: true },
      { id: crypto.randomUUID(), content: "", is_correct: false },
    ],
  );
  const [reference, setReference] = useState(question?.reference_answer ?? "");
  const [blanks, setBlanks] = useState(
    question?.blanks?.map((b) => b.valid_answers?.join("|") ?? "").join("\n") ??
      "",
  );
  const [score, setScore] = useState(question?.max_score ?? 1);
  const [tags, setTags] = useState(
    availableTags
      .filter((t) => question?.tag_ids.includes(t.id))
      .map((t) => t.name)
      .join(", "),
  );
  const [material, setMaterial] = useState(question?.material ?? "");
  const [fixed, setFixed] = useState(question?.options_order_fixed ?? false);
  const [scoreMode, setScoreMode] = useState(
    question?.score_mode ?? "all_or_nothing",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const all = await client.tags.list("question");
      const ids: string[] = [];
      for (const name of tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)) {
        const tag =
          all.find((t) => t.name === name) ??
          (await client.tags.create({ name, target_type: "question" }));
        if (!ids.includes(tag.id)) ids.push(tag.id);
      }
      const base = {
        owner_id: ownerId,
        owner_type: paper ? "paper" : "question_bank",
        type,
        content,
        explanation,
        tag_ids: ids,
      };
      const value = {
        ...base,
        ...(type.includes("choice")
          ? {
              options,
              options_order_fixed: fixed,
              max_score: score,
              ...(type === "single_choice" ? {} : { score_mode: scoreMode }),
            }
          : type === "strict_fill_in_blank"
            ? {
                blanks: blanks.split("\n").map((line, i) => ({
                  id: question?.blanks?.[i]?.id ?? crypto.randomUUID(),
                  valid_answers: line.split("|"),
                })),
                max_score: score,
                score_mode: scoreMode,
              }
            : { reference_answer: reference }),
      };
      const parsed = {
        ...QuestionSchema.parse({
          ...value,
          id: question?.id ?? crypto.randomUUID(),
          version: question?.version ?? 1,
        }),
        material: material || null,
      };
      if (question) await client.questions.update(question.id, parsed);
      else if (paper)
        await client.papers.addItem(ownerId, { question: parsed });
      else await client.questions.create(parsed);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={question ? "编辑题目" : "新增题目"}
      onClose={onClose}
      className="question-editor-modal"
      actions={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="default" disabled={busy} onClick={() => void save()}>
            保存
          </Button>
        </>
      }
    >
      <label className="field">
        <span>共用材料</span>
        <Textarea
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
        />
      </label>
      <label className="field">
        <span>题型</span>
        <NativeSelect
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="field">
        <span>题干</span>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <Markdown text={content} />
      <label className={buttonVariants({ className: "file-input-button" })}>
        插入图片附件
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void client.attachments
                .upload(file)
                .then((a) =>
                  setContent(
                    (value) => value + `\n![图片](attachment://${a.id})\n`,
                  ),
                )
                .catch((e) => setError(e.message));
          }}
        />
      </label>
      {type.includes("choice") && (
        <label className="editor-switch-line">
          <span>固定选项顺序</span>
          <input
            type="checkbox"
            role="switch"
            className="switch-control"
            checked={fixed}
            onChange={(e) => setFixed(e.target.checked)}
          />
        </label>
      )}
      {[
        "multiple_choice",
        "indefinite_choice",
        "strict_fill_in_blank",
      ].includes(type) && (
        <label className="field">
          <span>判分规则</span>
          <NativeSelect
            value={scoreMode}
            onChange={(e) => setScoreMode(e.target.value)}
          >
            <option value="all_or_nothing">完全匹配得分</option>
            <option value="proportional">按正确比例得分</option>
          </NativeSelect>
        </label>
      )}
      {type.includes("choice") ? (
        <>
          <h3>选项与答案</h3>
          <div className="choice-editor-rows">
            {options.map((o, i) => (
              <div className="choice-editor-row" key={o.id}>
                <input
                  aria-label={`正确选项 ${i + 1}`}
                  type="checkbox"
                  checked={!!o.is_correct}
                  onChange={(e) =>
                    setOptions(
                      options.map((v) =>
                        v.id === o.id
                          ? { ...v, is_correct: e.target.checked }
                          : v,
                      ),
                    )
                  }
                />
                <span className="serif" aria-hidden="true">
                  {String.fromCharCode(65 + i)}
                </span>
                <Input
                  data-option-text
                  aria-label={`选项 ${i + 1}`}
                  value={o.content}
                  onChange={(e) =>
                    setOptions(
                      options.map((v) =>
                        v.id === o.id ? { ...v, content: e.target.value } : v,
                      ),
                    )
                  }
                />
                <IconButton
                  icon="trash"
                  label={`删除选项 ${i + 1}`}
                  onClick={() =>
                    setOptions(options.filter((v) => v.id !== o.id))
                  }
                />
              </div>
            ))}
          </div>
          <Button
            onClick={() =>
              setOptions([
                ...options,
                { id: crypto.randomUUID(), content: "", is_correct: false },
              ])
            }
          >
            添加选项
          </Button>
        </>
      ) : type === "strict_fill_in_blank" ? (
        <label className="field">
          <span>每行一空，备选答案用 | 分隔</span>
          <Textarea
            value={blanks}
            onChange={(e) => setBlanks(e.target.value)}
          />
        </label>
      ) : (
        <label className="field">
          <span>参考答案</span>
          <Textarea
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
      )}
      <label className="field">
        <span>解析</span>
        <Textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </label>
      {!["subjective", "free_fill_in_blank"].includes(type) && (
        <label className="field">
          <span>分值</span>
          <Input
            type="number"
            min="1"
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
          />
        </label>
      )}
      <label className="field">
        <span>题目标签（英文逗号分隔）</span>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <p role="alert">{error}</p>
    </Modal>
  );
}
export function TagPills({
  ids,
  tags,
  chips = false,
}: {
  ids: string[];
  tags: Tag[];
  chips?: boolean;
}) {
  return (
    <span className="tag-list">
      {tags
        .filter((tag) => ids.includes(tag.id))
        .map((tag) => (
          <span
            className={`${chips ? "tag-chip" : "pill"} tag-color`}
            style={tagColorStyle(tag.color, tag.name)}
            key={tag.id}
          >
            {tag.name}
          </span>
        ))}
    </span>
  );
}
