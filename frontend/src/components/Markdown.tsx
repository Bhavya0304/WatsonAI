import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders model markdown safely: react-markdown never injects raw HTML. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
