import React from 'react'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  coldarkCold,
  dracula,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

/**
 * Preprocesses the text to wrap LaTeX expressions with dollar signs.
 * - Uses regular expressions to find LaTeX expressions wrapped in \( and \) or \[ and \] and replaces them with $ and $$ respectively.
 * - text.replace(/\\\((.*?)\\\)/g, (_, expr) => `$${expr}$`) replaces inline LaTeX expressions \( ... \) with $ ... $.
 * - text.replace(/\\\[(.*?)\\\]/gs, (_, expr) => `$$${expr}$$`) replaces block LaTeX expressions \[ ... \] with $$ ... $$.
 * - The use of capture groups ensures that only the LaTeX expression content is replaced.
 */
const preprocessText = (text: string): string => {
  return text
    .replace(/\\\((.*?)\\\)/g, (_, expr) => `$$${expr}$$`) // Inline LaTeX expressions
    .replace(/\\\[(.*?)\\\]/gs, (_, expr) => `$$${expr}$$`) // Block LaTeX expressions
}

interface MarkdownCustomProps {
  children: string
  variant?: 'white' | 'blue' | 'lightblue'
}

/**
 * Just a simple Markdown component from react-markdown with syntax highlighting.
 * Ignore the errors. This code is from some example code and idk why the errors are there.
 */
const MarkdownCustom: React.FC<MarkdownCustomProps> = ({
  children,
  variant = 'white',
}) => {
  const preprocessedText = preprocessText(children)

  return (
    <Markdown
      remarkPlugins={[
        // parses LaTeX math expressions in markdown
        [remarkMath, { singleDollarTextMath: false }],
        remarkBreaks, // parses line breaks in markdown (used for turning \n into <br> instead of spaces)
        remarkGfm, // parses GitHub Flavored Markdown (used for autolinks, footnotes, strikethrough, tables, and tasklist)
      ]}
      rehypePlugins={[rehypeKatex]} // renders LaTex math expressions using KaTeX
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <>
              {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
              {/* @ts-expect-error Server Component */}
              <SyntaxHighlighter
                style={
                  variant === 'blue'
                    ? dracula
                    : variant === 'lightblue'
                      ? coldarkCold
                      : oneLight
                }
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
        ul: ({ children }) => (
          <ul className="ml-6 list-disc space-y-1">{children}</ul>
        ), // Custom styling for ordered and unordered lists
        ol: ({ children }) => (
          <ol className="ml-6 list-decimal space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="text-gray-700">{children}</li>,
        hr: () => <hr className="my-6 border-gray-300" />, // Custom styling for horizontal rule ('***' in markdown)
      }}
    >
      {preprocessedText}
    </Markdown>
  )
}

export default MarkdownCustom
