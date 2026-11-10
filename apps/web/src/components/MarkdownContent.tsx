import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { client } from "../api/client.js";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
export default function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        urlTransform={(url) =>
          url.startsWith("/api/attachments/")
            ? client.url(url.slice(5))
            : defaultUrlTransform(url)
        }
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
