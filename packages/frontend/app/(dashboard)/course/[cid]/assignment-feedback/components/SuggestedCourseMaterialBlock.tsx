import type { Annotation } from '../assignmentFeedbackTypes'
import { getSuggestedCourseMaterialSource } from '../suggestedCourseMaterial'

export default function SuggestedCourseMaterialBlock({
  annotation,
}: {
  annotation: Annotation
}) {
  const { label, url } = getSuggestedCourseMaterialSource(annotation)

  return (
    <aside
      className="border-fb-teal-mid mt-3 rounded-lg border border-dashed bg-gradient-to-br from-teal-700/[0.06] to-teal-700/[0.02] px-3 py-2.5"
      aria-label="Suggested course material"
    >
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-teal-700">
        Suggested course material
      </div>
      <p className="mb-1.5 text-xs leading-[1.45] text-stone-500">
        Review this lesson before revising:
      </p>
      <p className="m-0 break-words text-[13px] leading-normal">
        {url && url.length > 0 ? (
          <a
            className="font-semibold text-teal-700 underline underline-offset-2"
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </a>
        ) : (
          <span className="font-semibold text-stone-900">{label}</span>
        )}
      </p>
    </aside>
  )
}
