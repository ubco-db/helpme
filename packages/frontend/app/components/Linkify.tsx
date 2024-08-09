import { LinkIt } from 'react-linkify-it'

/**
 * This will automatically replace any links in the text with actual <a> links that users can click.
 * For example, this can be used to replace the link to a lab assignment that's in a queue's notes with an actual link students can click.
 */
const Linkify: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <LinkIt
      component={(url, key) => (
        <a
          href={/^www\./.exec(url) ? `http://${url}` : url}
          target="_blank"
          rel="noopener noreferrer"
          key={key}
        >
          {url}
        </a>
      )}
      regex={
        /(https?:\/\/|www\.)([-\w.]+\/[\p{L}\p{Emoji}\p{Emoji_Component}!#$%&'"()*+,./\\:;=_?@[\]~-]*[^\s'",.;:\b)\]}?]|(([\w-]+\.)+[\w-]+[\w/-]))/u
      }
    >
      {children}
    </LinkIt>
  )
}

export default Linkify
