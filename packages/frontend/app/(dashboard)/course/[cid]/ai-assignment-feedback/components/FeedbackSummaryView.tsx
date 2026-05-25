import type { OverallFeedback } from '../assignmentFeedbackTypes'

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section>
      <h4 className="mb-1.5 mt-3 text-sm text-stone-500">{title}</h4>
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
    <div>
      {overall.summary ? (
        <section>
          <h4 className="mb-1.5 mt-3 text-sm text-stone-500">
            Overall Summary
          </h4>
          <p>{overall.summary}</p>
        </section>
      ) : null}
      <SummaryList
        title="Priority Issues"
        items={overall.priority_issues ?? []}
      />
      <SummaryList title="Next Steps" items={overall.next_steps ?? []} />
      <SummaryList
        title="Reflection Questions"
        items={overall.reflection_questions ?? []}
      />
    </div>
  )
}
