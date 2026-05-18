'use client'

import { Button, Divider } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import { useUserInfo } from '@/app/contexts/userContext'
import { useState } from 'react'
import ExportEmbeddableFeedbackModal
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/ExportEmbeddableFeedbackModal'
import { EmbeddableAssignment, EmbeddableQuestion } from '@koh/common'

type AnswersPageLayoutSkeletonProps = {
  children: React.ReactNode,
  mode: 'assignment' | 'question',
  item?: EmbeddableQuestion | EmbeddableAssignment,
  courseId: number,
  questions?: EmbeddableQuestion[],
  assignments?: EmbeddableAssignment[],
}

const AnswersPageLayoutSkeleton: React.FC<AnswersPageLayoutSkeletonProps> = ({
  children,
  mode,
  item,
  courseId,
  assignments,
  questions,
}) => {
  const { userInfo } = useUserInfo()
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <>
      <ExportEmbeddableFeedbackModal
        open={exportOpen}
        setOpen={setExportOpen}
        courseId={courseId}
        mode={mode}
        questions={questions}
        assignments={assignments}
        focusAssignment={item && mode === 'assignment' ? item as unknown as EmbeddableAssignment : undefined}
        focusQuestion={item && mode === 'question' ? item as unknown as EmbeddableQuestion : undefined}
      />
      <div className="md:mr-2">
        <title>{`HelpMe | Viewing ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} Embeddable ${mode == 'question' ? 'Question' : 'Assessment'} Answers`}</title>
        {/* Tailwind color classes used (this will ensure the tailwind parser sees these classes being used and doesn't remove them):
          bg-green-100 bg-green-200 bg-green-300 bg-green-400 bg-green-500 bg-green-600 bg-green-700 bg-green-800
          bg-red-100 bg-red-200 bg-red-300 bg-red-400 bg-red-500 bg-red-600 bg-red-700 bg-red-800
      */}
        <div className="flex w-full items-center justify-between">
          <div className="flex-1">
            {item ? (
              <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
                <span className={'font-bold'}>{item.name}</span>
              </h3>
            ) : (
              <>
                <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
                  View Embeddable {mode == 'question' ? 'Question' : 'Assessment'} Answers
                </h3>
                <h4 className="text-[16px] font-medium text-gray-600">
                  View and manage the answers to your course&#39;s embeddable {mode == 'question' ? 'questions' : 'assessments'}, including feedback and
                  preliminary grades.
                </h4>
              </>
            )}
          </div>
          <div>
            <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>Export Results</Button>
          </div>
        </div>
        <Divider className={'my-2'} />
        {children}
      </div>
    </>
  )
}

export default AnswersPageLayoutSkeleton