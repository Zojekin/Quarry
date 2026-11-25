import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { client } from "../api/client.js";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
export default function MarkdownContent({ text, preview = false }: { text: string; preview?: boolean }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        components={preview ? { img: ({ alt }) => <span>{alt}</span> } : {}}
        urlTransform={(url) => {
          const id = /^(?:attachment:\/\/|http:\/\/127\.0\.0\.1:\d+\/api\/attachments\/)([^/?#]+)$/.exec(url)?.[1];
          if (id) return client.attachments.url(id);
          if (url.startsWith("/api/attachments/")) return client.url(url.slice(5));
          return defaultUrlTransform(url);
        }}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { errorColor: "var(--error-fg)" }]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
