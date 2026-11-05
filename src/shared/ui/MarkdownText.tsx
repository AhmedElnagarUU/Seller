import Markdown, { type Components } from "react-markdown";

type MarkdownTextProps = {
  children: string;
};

// Headings start at level 3 because the page already has an h1 and h2 sections. Raw HTML is not rendered.
const COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="font-heading text-text text-xl font-bold">{children}</h3>,
  h2: ({ children }) => <h3 className="font-heading text-text text-lg font-bold">{children}</h3>,
  h3: ({ children }) => <h4 className="font-heading text-text text-base font-bold">{children}</h4>,
  p: ({ children }) => <p className="text-text text-base">{children}</p>,
  ul: ({ children }) => <ul className="text-text list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="text-text list-decimal space-y-1 pl-6">{children}</ol>,
  a: ({ href, children }) => (
    <a href={href} rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="bg-surface rounded-sm px-1 font-mono text-sm">{children}</code>,
  pre: ({ children }) => <pre className="bg-surface overflow-x-auto rounded-md p-3 font-mono text-sm">{children}</pre>,
};

export function MarkdownText({ children }: MarkdownTextProps) {
  return (
    <div className="flex flex-col gap-4">
      <Markdown components={COMPONENTS}>{children}</Markdown>
    </div>
  );
}
