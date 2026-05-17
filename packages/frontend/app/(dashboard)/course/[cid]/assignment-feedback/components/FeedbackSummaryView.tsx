import type { OverallFeedback } from '../assignmentFeedbackTypes'

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="summary-section">
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export default function FeedbackSummaryView({
  overall,
}: {
  overall: OverallFeedback
}) {
  return (
    <div className="summary-card">
      {overall.summary ? (
        <section className="summary-section">
          <h4>Overall Summary</h4>
          <p>{overall.summary}</p>
        </section>
      ) : null}
      <SummaryList title="Priority Issues" items={overall.priority_issues} />
      <SummaryList title="Next Steps" items={overall.next_steps} />
      <SummaryList
        title="Reflection Questions"
        items={overall.reflection_questions}
      />
    </div>
  )
}
