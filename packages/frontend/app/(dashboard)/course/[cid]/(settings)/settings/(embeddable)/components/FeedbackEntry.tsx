import React from 'react'
import ExpandableAIResponse from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ExpandableAIResponse'
import FeedbackGrade from './FeedbackGrade'

type FeedbackEntryProps = {
  feedback?: string
  grade?: number
  showNAGrade?: boolean
  expandableFeedback?: boolean
  gradeSize?: 'small' | 'default'
  showIsAI?: boolean
}

const FeedbackEntry: React.FC<FeedbackEntryProps> = ({
  feedback,
  grade,
  showNAGrade = false,
  expandableFeedback = false,
  gradeSize = 'default',
  showIsAI = false,
}) => {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-zinc-700">{showIsAI ? 'AI ' : ''}Feedback</p>
      <div className={'flex gap-2'}>
        <div className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 w-full">
          {!feedback ? (
            <i className={'text-zinc-400'}>No verbal feedback was left</i>
          ) : (expandableFeedback
              ? (<ExpandableAIResponse response={feedback} />)
              : feedback
          )}
        </div>
        {showNAGrade && (
          <GradeDisplay grade={grade} size={gradeSize}/>
        ) || (grade != undefined && (
          <GradeDisplay grade={grade} size={gradeSize}/>
        ))}
      </div>
    </div>
  )
}

function GradeDisplay({ grade, size }: { grade?: number, size: 'small' | 'default' }) {
  return (
    <div className={'w-1/8'}>
      <FeedbackGrade grade={grade} size={size} />
    </div>
  )
}

export default FeedbackEntry