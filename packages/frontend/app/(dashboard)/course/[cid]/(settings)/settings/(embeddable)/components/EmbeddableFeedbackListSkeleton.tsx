import { useCallback, useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { EmbeddableFeedback, Role, UserPartial } from '@koh/common'
import { Button, Divider } from 'antd'
import { CornerDownLeftIcon } from 'lucide-react'
import { DownOutlined } from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'
import GradeEmbeddableFeedbackModal
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/GradeEmbeddableFeedbackModal'
import SelectStudentsModal from '@/app/(dashboard)/course/[cid]/components/SelectStudentsModal'

type EmbeddableFeedbackSkeletonProps = {
  children: React.ReactNode,
  courseId: number,
  mode: 'question' | 'assignment',
  students: UserPartial[],
  setStudents: React.Dispatch<React.SetStateAction<UserPartial[]>>,
  totalStudents: number,
  setTotalStudents: React.Dispatch<React.SetStateAction<number>>,
  editingAnswer?: EmbeddableFeedback,
  setEditingAnswer: React.Dispatch<React.SetStateAction<EmbeddableFeedback | undefined>>,
  selectedStudents: number[],
  setSelectedStudents: React.Dispatch<React.SetStateAction<number[]>>,
  retrieveAnswers: () => void,
}

const EmbeddableFeedbackListSkeleton: React.FC<EmbeddableFeedbackSkeletonProps> = ({
  children,
  courseId,
  mode,
  students,
  setStudents,
  totalStudents,
  setTotalStudents,
  editingAnswer,
  setEditingAnswer,
  selectedStudents,
  setSelectedStudents,
  retrieveAnswers,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const returnPath = useMemo(() => {
    const splits = pathname.split('/').slice(0,-1)
    return splits.join('/')
  }, [pathname])
  
  const [studentPage, setStudentPage] = useState<number>(1)
  const [studentSearch, setStudentSearch] = useState<string>()

  const [selectStudentsOpen, setSelectStudentsOpen] = useState(false)

  const retrieveStudents = useCallback(async () => {
    await API.course.getUserInfo(
      courseId,
      studentPage,
      Role.STUDENT,
      studentSearch,
    ).then(({ users, total }) => {
      setStudents(users)
      setTotalStudents(total)
    })
  }, [courseId, setStudents, setTotalStudents, studentPage, studentSearch])

  useEffect(() => {
    retrieveStudents().then()
  }, [retrieveStudents])
  
  return (
    <>
      <div className={'flex w-full items-center justify-between'}>
        <Button
          className={'font-bold text-lg'}
          icon={<div className={'flex items-center justify-center'}><CornerDownLeftIcon /></div>} type={'link'}
          onClick={() => router.push(returnPath)}
        >
          {mode == 'question' ? 'Question' : 'Assessment'} List
        </Button>
        <div className={'flex justify-end gap-2'}>
          <Button onClick={() => setSelectStudentsOpen(true)}>
            Selected Students ({selectedStudents.length == 0 ? 'All' : selectedStudents.length})
            <DownOutlined color={'@White 65%'} />
          </Button>
        </div>
      </div>
      <Divider className="my-3" />
      {children}
      <GradeEmbeddableFeedbackModal
        courseId={courseId}
        record={editingAnswer}
        setRecord={setEditingAnswer}
        onSaveCallback={() => retrieveAnswers()}
        mode={mode}
      />
      <SelectStudentsModal
        open={selectStudentsOpen}
        onClose={() => setSelectStudentsOpen(false)}
        page={studentPage}
        setPage={setStudentPage}
        students={students}
        totalStudents={totalStudents}
        selectedStudents={selectedStudents}
        setSelectedStudents={setSelectedStudents}
        setFullSearch={(val) => {
          setStudentSearch(val)
          setStudentPage(0)
        }}
        updateSelectedStudents={(id: number) => setSelectedStudents((prev) => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])}
      />
    </>
  )
}

export default EmbeddableFeedbackListSkeleton