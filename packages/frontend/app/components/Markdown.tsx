import React from 'react'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  coldarkCold,
  dracula,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkMath from 'remark-math'
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
    .replace(/\\\((.*?)\\\)/g, (_, expr) => `$${expr}$`) // Inline LaTeX expressions
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
      remarkPlugins={[remarkMath]} // parses LaTeX math expressions in markdown
      rehypePlugins={[rehypeKatex]} // renders LaTex math expressions using KaTeX
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
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
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
      }}
    >
      {preprocessedText}
    </Markdown>
  )
}

export default MarkdownCustom
