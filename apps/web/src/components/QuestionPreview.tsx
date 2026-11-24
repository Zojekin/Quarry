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
    <>
      {question.material && <Markdown text={question.material} />}
      <div className="question-text">
        <Markdown text={question.content} />
      </div>
      {question.options && (
        <div className="preview-options">
          {question.options.map((option, index) => (
            <div key={option.id}>
              <span>{String.fromCharCode(65 + index)}</span>
              <Markdown text={option.content} />
            </div>
          ))}
        </div>
      )}
      {reveal && (
        <div className="analysis">
          <b>参考答案</b>
          <Markdown text={reference || "暂无参考答案。"} />
          <b>解析</b>
          <Markdown text={question.explanation || "暂无解析。"} />
        </div>
      )}
    </>
  );
}
