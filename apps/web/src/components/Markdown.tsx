import { lazy, Suspense } from "react";
const Content = lazy(() => import("./MarkdownContent.js"));
export function Markdown({ text, preview = false }: { text: string; preview?: boolean }) {
  return (
    <Suspense fallback={<span>{text}</span>}>
      <Content text={text} preview={preview} />
    </Suspense>
  );
}
