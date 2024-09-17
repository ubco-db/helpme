import React from 'react'
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  coldarkCold,
  dracula,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

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
  return (
    <Markdown
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
              // style={dark}
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
      {children}
    </Markdown>
  )
}

export default MarkdownCustom
