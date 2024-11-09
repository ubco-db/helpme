import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  PauseOutlined,
  QuestionOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  AlertType,
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  parseTaskIdsFromQuestionText,
  Question,
  QuestionStatus,
  RephraseQuestionPayload,
} from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import CircleButton from './CircleButton'
import { useCourse } from '@/app/hooks/useCourse'
import { useQuestions } from '@/app/hooks/useQuestions'
import { isCheckedIn } from '../../../utils/commonCourseFunctions'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { API } from '@/app/api'

const PRORITY_QUEUED_MESSAGE_TEXT =
  'This student has been temporarily removed from the queue. They must select to rejoin the queue and will then be placed where they were before'

interface TAQuestionCardButtonsProps {
  courseId: number
  queueId: number
  question: Question
  hasUnresolvedRephraseAlert: boolean
  tasksSelectedForMarking: string[]
  className?: string
}

const TAQuestionCardButtons: React.FC<TAQuestionCardButtonsProps> = ({
  courseId,
  queueId,
  question,
  hasUnresolvedRephraseAlert,
  tasksSelectedForMarking,
  className,
}) => {
  const { course } = useCourse(courseId)
  const { mutateQuestions } = useQuestions(queueId)
  const { userInfo } = useUserInfo()
  const staffList = course?.queues?.find((q) => q.id === queueId)?.staffList
  const isUserCheckedIn = isCheckedIn(staffList, userInfo.id)
  // loading states for buttons
  const [helpButtonLoading, setHelpButtonLoading] = useState(false)
  const [rephraseButtonLoading, setRephraseButtonLoading] = useState(false)
  const [deleteButtonLoading, setDeleteButtonLoading] = useState(false)
  const [finishHelpingButtonLoading, setFinishHelpingButtonLoading] =
    useState(false)
  const [cantFindButtonLoading, setCantFindButtonLoading] = useState(false)
  const [requeueButtonLoading, setRequeueButtonLoading] = useState(false)
  const [pauseButtonLoading, setPauseButtonLoading] = useState(false)

  // let timerCheckout=useRef(null);
  const changeStatus = useCallback(
    async (status: QuestionStatus) => {
      await API.questions
        .update(question.id, {
          status,
        })
        .then((responseQuestion) => {
          mutateQuestions()
          if (status === ClosedQuestionStatus.Resolved) {
            if (responseQuestion.isTaskQuestion) {
              const tasksMarkedDone =
                responseQuestion.text
                  ?.match(/"(.*?)"/g)
                  ?.map((task) => task.slice(1, -1)) || []
              if (tasksMarkedDone.length == 0) {
                message.warning('No tasks marked done')
              } else {
                message.success(
                  'Marked ' + tasksMarkedDone.join(', ') + ' as done',
                )
              }
            } else {
              message.success('Your Question has ended')
            }
          }
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error('Failed to update question status: ' + errorMessage)
        })
      // if (status===LimboQuestionStatus.CantFind||status===ClosedQuestionStatus.Resolved){
      // timerCheckout.current = setTimeout(() => {
      //     message.warning("You are checked out due to inactivity");
      //     checkOutTA();
      //  }, 1000*20);
      // }
    },
    [question.id, mutateQuestions],
  )

  const markSelected = useCallback(async () => {
    const newQuestionText = `Mark ${tasksSelectedForMarking
      .map((task) => `"${task}"`)
      .join(' ')}`
    try {
      const responseQuestion = await API.questions.update(question.id, {
        status: ClosedQuestionStatus.Resolved,
        text: newQuestionText,
      })
      await mutateQuestions()
      const tasksMarkedDone = parseTaskIdsFromQuestionText(
        responseQuestion.text,
      )
      if (tasksMarkedDone.length == 0) {
        message.warning('No tasks marked done')
      } else {
        message.success(
          'Marked ' + tasksSelectedForMarking.join(', ') + ' as done',
        )
      }
    } catch (e) {
      message.error('Failed to mark tasks as done')
    }
  }, [question.id, mutateQuestions, tasksSelectedForMarking])

  // const checkOutTA = async ()=>{
  //     // await API.taStatus.checkOut(courseId, queue?.room);
  //     // mutateCourse();
  // }
  // function setCheckOutTimer() {
  //     timerCheckout.current = setTimeout(() => {
  //         message.warning("You are checked out due to inactivity");
  //         checkOutTA();
  //      }, 1000*20);
  // }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sendRephraseAlert = async () => {
    setRephraseButtonLoading(true)
    const payload: RephraseQuestionPayload = {
      queueId,
      questionId: question.id,
      courseId,
    }
    try {
      await API.alerts.create({
        alertType: AlertType.REPHRASE_QUESTION,
        courseId,
        payload,
        targetUserId: question.creatorId,
      })
      await mutateQuestions()
      message.success('Successfully asked student to rephrase their question.')
    } catch (e: any) {
      if (
        e.response?.data?.message ===
        ERROR_MESSAGES.alertController.duplicateAlert
      ) {
        message.error(
          'This student has already been asked to rephrase their question',
        )
      }
    } finally {
      setRephraseButtonLoading(false)
    }
  }

  const helpStudent = () => {
    setHelpButtonLoading(true)
    changeStatus(OpenQuestionStatus.Helping).then(() => {
      setHelpButtonLoading(false)
    })
    //delete inactive timer
    // editing: shouldn't log students out after 15 minutes
    // reset timer if help another student

    if (course?.questionTimer) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
      let questionTimer = setTimeout(
        () => {
          changeStatus(ClosedQuestionStatus.Resolved)
        },
        course.questionTimer * 60 * 1000,
      )
    }
  }
  const deleteQuestion = async () => {
    setDeleteButtonLoading(true)
    await changeStatus(
      question.status === OpenQuestionStatus.Drafting
        ? ClosedQuestionStatus.DeletedDraft
        : LimboQuestionStatus.TADeleted,
    ).then(() => {
      setDeleteButtonLoading(false)
    })
    await API.questions.notify(question.id)
  }

  const [isFinishHelpingTooltipVisible, setIsFinishHelpingTooltipVisible] =
    useState(false)
  const [previousTasksSelectedForMarking, setPreviousTasksSelectedForMarking] =
    useState<number>(0)
  // show the isFinishHelpingToolTip for 2 seconds when tasksSelectedForMarking changes
  useEffect(() => {
    if (
      previousTasksSelectedForMarking - tasksSelectedForMarking.length !==
      0
    ) {
      setIsFinishHelpingTooltipVisible(true)
      setPreviousTasksSelectedForMarking(tasksSelectedForMarking.length)
    }
    const timer = setTimeout(() => {
      setIsFinishHelpingTooltipVisible(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [tasksSelectedForMarking, previousTasksSelectedForMarking])

  if (
    question.status === OpenQuestionStatus.Helping ||
    question.status === OpenQuestionStatus.Paused
  ) {
    return (
      <div className={className}>
        <Popconfirm
          title="Are you sure you want to send this student back to the queue?"
          okText="Yes"
          cancelText="No"
          onConfirm={async () => {
            setRequeueButtonLoading(true)
            await changeStatus(LimboQuestionStatus.ReQueueing).then(() => {
              message.success(PRORITY_QUEUED_MESSAGE_TEXT, 3)
              setRequeueButtonLoading(false)
            })
          }}
        >
          <Tooltip title="Requeue Student">
            <CircleButton
              icon={<UndoOutlined />}
              loading={requeueButtonLoading}
              disabled={
                pauseButtonLoading ||
                cantFindButtonLoading ||
                finishHelpingButtonLoading
              }
            />
          </Tooltip>
        </Popconfirm>
        <Popconfirm
          title="Are you sure you can't find this student?"
          okText="Yes"
          cancelText="No"
          onConfirm={async () => {
            setCantFindButtonLoading(true)
            await changeStatus(LimboQuestionStatus.CantFind).then(async () => {
              message.success(PRORITY_QUEUED_MESSAGE_TEXT, 3)
              setCantFindButtonLoading(false)
              await API.questions.notify(question.id)
            })
          }}
        >
          <Tooltip title="Can't Find">
            <CircleButton
              variant="red"
              icon={<CloseOutlined />}
              loading={cantFindButtonLoading}
              disabled={
                pauseButtonLoading ||
                requeueButtonLoading ||
                finishHelpingButtonLoading
              }
            />
          </Tooltip>
        </Popconfirm>
        {question.status !== OpenQuestionStatus.Paused && (
          <Tooltip
            title={
              question.isTaskQuestion
                ? tasksSelectedForMarking.length > 0
                  ? 'Mark ' + tasksSelectedForMarking.join(', ') + ' as Done'
                  : 'Mark All as Done'
                : 'Finish Helping'
            }
            open={isFinishHelpingTooltipVisible}
          >
            <CircleButton
              onMouseEnter={() => setIsFinishHelpingTooltipVisible(true)}
              onMouseLeave={() => setIsFinishHelpingTooltipVisible(false)}
              variant="green"
              icon={<CheckOutlined />}
              loading={finishHelpingButtonLoading}
              disabled={
                cantFindButtonLoading ||
                requeueButtonLoading ||
                pauseButtonLoading
              }
              onClick={() => {
                // setCheckOutTimer()
                setFinishHelpingButtonLoading(true)
                if (
                  question.isTaskQuestion &&
                  tasksSelectedForMarking.length > 0
                ) {
                  markSelected().then(() => {
                    setFinishHelpingButtonLoading(false)
                  })
                } else {
                  changeStatus(ClosedQuestionStatus.Resolved).then(() => {
                    setFinishHelpingButtonLoading(false)
                  })
                }
              }}
            />
          </Tooltip>
        )}
        {question.status === OpenQuestionStatus.Paused ? (
          <Tooltip title="Resume Helping">
            <CircleButton
              variant="green"
              icon={<Play size={22} className="shrink-0 pl-1" />}
              loading={pauseButtonLoading}
              disabled={
                cantFindButtonLoading ||
                requeueButtonLoading ||
                finishHelpingButtonLoading
              }
              onClick={() => {
                setPauseButtonLoading(true)
                changeStatus(OpenQuestionStatus.Helping).then(() =>
                  setPauseButtonLoading(false),
                )
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip title="Pause Helping">
            <CircleButton
              variant="gray"
              icon={<PauseOutlined />}
              loading={pauseButtonLoading}
              disabled={
                cantFindButtonLoading ||
                requeueButtonLoading ||
                finishHelpingButtonLoading
              }
              onClick={() => {
                setPauseButtonLoading(true)
                changeStatus(OpenQuestionStatus.Paused).then(() =>
                  setPauseButtonLoading(false),
                )
              }}
            />
          </Tooltip>
        )}
      </div>
    )
  } else {
    const [canHelp, helpTooltip] = ((): [boolean, string] => {
      if (!isUserCheckedIn) {
        return [false, 'You must check in to help students!']
      } else {
        return [true, 'Help Student']
      }
    })()
    const [canRephrase, rephraseTooltip] = ((): [boolean, string] => {
      if (!isUserCheckedIn) {
        return [
          false,
          'You must check in to ask this student to rephrase their question',
        ]
      } else if (hasUnresolvedRephraseAlert) {
        return [
          false,
          'The student has already been asked to rephrase their question',
        ]
      } else if (question.status === OpenQuestionStatus.Drafting) {
        return [
          false,
          'The student must finish drafting before they can be asked to rephrase their question',
        ]
      } else {
        return [true, 'Ask the student to add more detail to their question']
      }
    })()
    return (
      <>
        <div className={className}>
          <Popconfirm
            title="Are you sure you want to delete this question from the queue?"
            disabled={
              !isUserCheckedIn ||
              question.status === LimboQuestionStatus.ReQueueing
            }
            okText="Yes"
            cancelText="No"
            onConfirm={async () => {
              await deleteQuestion()
            }}
          >
            <Tooltip
              className={`${!isUserCheckedIn || question.status === LimboQuestionStatus.ReQueueing ? 'cursor-not-allowed' : ''}`}
              title={
                isUserCheckedIn
                  ? 'Remove From Queue'
                  : 'You must check in to remove students from the queue'
              }
            >
              <span>
                {/* This span is a workaround for tooltip-on-disabled-button 
              https://github.com/ant-design/ant-design/issues/9581#issuecomment-599668648 */}
                <CircleButton
                  variant="red"
                  icon={<DeleteOutlined />}
                  disabled={
                    !isUserCheckedIn ||
                    helpButtonLoading ||
                    rephraseButtonLoading ||
                    question.status === LimboQuestionStatus.ReQueueing
                  }
                  loading={deleteButtonLoading}
                />
              </span>
            </Tooltip>
          </Popconfirm>
          {!question.isTaskQuestion && (
            // TODO: add new buttons for task questions
            <Tooltip
              className={`${!isUserCheckedIn || question.status === LimboQuestionStatus.ReQueueing ? 'cursor-not-allowed' : ''}`}
              title={rephraseTooltip}
            >
              <span>
                <CircleButton
                  variant="orange"
                  icon={<QuestionOutlined />}
                  onClick={sendRephraseAlert}
                  disabled={
                    !canRephrase ||
                    helpButtonLoading ||
                    deleteButtonLoading ||
                    question.status === LimboQuestionStatus.ReQueueing
                  }
                  loading={rephraseButtonLoading}
                />
              </span>
            </Tooltip>
          )}
          <Tooltip
            className={`${!isUserCheckedIn || question.status === LimboQuestionStatus.ReQueueing ? 'cursor-not-allowed' : ''}`}
            title={helpTooltip}
          >
            <span>
              <CircleButton
                variant="primary"
                icon={<Play size={22} className="shrink-0 pl-1" />}
                onClick={() => {
                  // message.success("timer cleared")
                  // clearTimeout(timerCheckout.current);
                  helpStudent()
                }}
                disabled={
                  !canHelp ||
                  rephraseButtonLoading ||
                  deleteButtonLoading ||
                  question.status === LimboQuestionStatus.ReQueueing
                }
                className="flex items-center justify-center"
                loading={helpButtonLoading}
              />
            </span>
          </Tooltip>
        </div>
      </>
    )
  }
}

export default TAQuestionCardButtons
