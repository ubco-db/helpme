const MarkdownGuideTooltipBody: React.FC = () => {
  return (
    <div className="flex flex-col gap-y-2">
      <p>
        Supports markdown! For example:
        <ul className="list-inside list-disc">
          <li>
            **some text** → <b>some text</b>
          </li>
          <li>
            *some text* → <i>some text</i>
          </li>
          <li>
            [a cool website](https://www.example.com) →{' '}
            <a
              href="https://www.example.com"
              target="_blank"
              rel="noreferrer noopener"
            >
              a cool website
            </a>
          </li>
          <li>
            ![a cool image](https://www.example.com/image.png) →{' '}
            <img
              alt=""
              className="inline"
              src="https://www.example.com/image.png"
            />
          </li>
          <li>
            ```code block``` → <code>code block</code>
          </li>
        </ul>
      </p>
      <p>
        Note: it won&apos;t be rendered here or in the table but it will be
        rendered when a student asks the question
      </p>
    </div>
  )
}

export default MarkdownGuideTooltipBody
