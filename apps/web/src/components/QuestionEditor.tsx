import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { QuestionSchema } from "@quarry/shared";
import { client } from "../api/client.js";
import type { QuestionView, Tag } from "../api/client.js";
import { Button, IconButton, Modal, tagColorStyle, types } from "./ui.js";
import { Badge } from "./ui/badge.js";
import { Checkbox } from "./ui/checkbox.js";
import { Input, Textarea } from "./ui/input.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select.js";
import { Switch } from "./ui/switch.js";
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
      className="w-[min(680px,calc(100vw-2rem))]"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="default" disabled={busy} onClick={() => void save()}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5 text-[13px] font-medium">
          <span>共用材料</span>
          <Textarea
            className="min-h-16"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-[13px] font-medium">
            <span id="q-type-label">题型</span>
            <Select
              value={type}
              onValueChange={(value) => setType(value as typeof type)}
            >
              <SelectTrigger aria-label="题型" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!["subjective", "free_fill_in_blank"].includes(type) && (
            <label className="block space-y-1.5 text-[13px] font-medium">
              <span>分值</span>
              <Input
                type="number"
                min="1"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </label>
          )}
        </div>

        <label className="block space-y-1.5 text-[13px] font-medium">
          <span>题干</span>
          <Textarea
            data-autofocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>

        {content && (
          <div className="rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 text-[13.5px]">
            <Markdown text={content} />
          </div>
        )}

        <div>
          <label className="file-input-button inline-flex h-8.5 items-center gap-2 rounded-md border border-input bg-card px-3 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(23,27,25,0.04)] hover:bg-muted/70">
            <ImagePlus className="size-4 text-muted-foreground" />
            <span>插入图片附件</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void client.attachments
                    .upload(file)
                    .then((a) =>
                      setContent(
                        (value) => value + `\n![图片](attachment://${a.id})\n`,
                      ),
                    )
                    .catch((e) => setError(e.message));
                }
              }}
            />
          </label>
        </div>

        {type.includes("choice") && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
            <span className="text-[13px] font-medium">固定选项顺序</span>
            <Switch
              aria-label="固定选项顺序"
              checked={fixed}
              onCheckedChange={setFixed}
            />
          </div>
        )}

        {[
          "multiple_choice",
          "indefinite_choice",
          "strict_fill_in_blank",
        ].includes(type) && (
          <div className="space-y-1.5 text-[13px] font-medium">
            <span>判分规则</span>
            <Select value={scoreMode} onValueChange={setScoreMode}>
              <SelectTrigger aria-label="判分规则" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_or_nothing">完全匹配得分</SelectItem>
                <SelectItem value="proportional">按正确比例得分</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {type.includes("choice") ? (
          <div className="space-y-2.5">
            <h3 className="m-0 text-[13.5px] font-semibold">选项与答案</h3>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div className="flex items-center gap-2.5" key={o.id}>
                  <Checkbox
                    aria-label={`正确选项 ${i + 1}`}
                    checked={!!o.is_correct}
                    onCheckedChange={(checked) =>
                      setOptions(
                        options.map((v) =>
                          v.id === o.id ? { ...v, is_correct: !!checked } : v,
                        ),
                      )
                    }
                  />
                  <span className="w-5 text-center text-[13px] font-bold text-foreground/75" aria-hidden="true">
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
                    variant="destructiveGhost"
                    label={`删除选项 ${i + 1}`}
                    onClick={() =>
                      setOptions(options.filter((v) => v.id !== o.id))
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setOptions([
                  ...options,
                  { id: crypto.randomUUID(), content: "", is_correct: false },
                ])
              }
            >
              添加选项
            </Button>
          </div>
        ) : type === "strict_fill_in_blank" ? (
          <label className="block space-y-1.5 text-[13px] font-medium">
            <span>每行一空，备选答案用 | 分隔</span>
            <Textarea
              value={blanks}
              onChange={(e) => setBlanks(e.target.value)}
            />
          </label>
        ) : (
          <label className="block space-y-1.5 text-[13px] font-medium">
            <span>参考答案</span>
            <Textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        )}

        <label className="block space-y-1.5 text-[13px] font-medium">
          <span>解析</span>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>

        <label className="block space-y-1.5 text-[13px] font-medium">
          <span>题目标签（英文逗号分隔）</span>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        {error && (
          <p role="alert" className="text-[13px] text-destructive">
            {error}
          </p>
        )}
      </div>
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
  const matched = tags.filter((tag) => ids.includes(tag.id));
  if (!matched.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {matched.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={`${chips ? "tag-chip" : "pill"} tag-color`}
          style={tagColorStyle(tag.color, tag.name)}
        >
          {tag.name}
        </Badge>
      ))}
    </span>
  );
}
