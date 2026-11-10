import { lazy, Suspense } from "react";
const Content = lazy(() => import("./MarkdownContent.js"));
export function Markdown({ text }: { text: string }) {
  return (
    <Suspense fallback={<span>{text}</span>}>
      <Content text={text} />
    </Suspense>
  );
}
