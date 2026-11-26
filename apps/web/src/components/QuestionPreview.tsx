import type { QuestionView } from "../api/client.js";
import { Markdown } from "./Markdown.js";

export function QuestionPreview({
  question,
  reveal = false,
}: {
  question: QuestionView;
  reveal?: boolean;
}) {
  const reference =
    question.reference_answer ??
    question.options
      ?.filter((option) => option.is_correct)
      .map((option) => option.content)
      .join("；") ??
    question.blanks
      ?.map((blank) => blank.valid_answers?.join(" / "))
      .join("；");

  return (
    <div className="space-y-3">
      {question.material && (
        <div className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground/90">
          <Markdown text={question.material} />
        </div>
      )}
      <div className="question-stem [--question-size-offset:-3px] font-serif leading-[1.7] font-normal text-foreground">
        <Markdown text={question.content} />
      </div>
      {question.options && (
        <div className="space-y-1.5 text-[13.5px]">
          {question.options.map((option, index) => (
            <div key={option.id} className="flex items-baseline gap-2.5 text-foreground/90">
              <span className="min-w-4 font-bold text-foreground/75">
                {String.fromCharCode(65 + index)}
              </span>
              <Markdown text={option.content} />
            </div>
          ))}
        </div>
      )}
      {reveal && (
        <div className="space-y-2 rounded-lg bg-(--answer-bg) px-3.5 py-3 text-[13px] leading-relaxed">
          <div>
            <div className="font-semibold text-primary">参考答案</div>
            <div className="mt-0.5 text-foreground/90">
              <Markdown text={reference || "暂无参考答案。"} />
            </div>
          </div>
          <div className="pt-1">
            <div className="font-semibold text-foreground/80">解析</div>
            <div className="mt-0.5 text-muted-foreground">
              <Markdown text={question.explanation || "暂无解析。"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
