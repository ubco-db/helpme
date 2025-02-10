import { useEffect, useState } from 'react'
import { Button, Col, message, Row, Tag, Tooltip } from 'antd'
import { AsyncQuestion, asyncQuestionStatus, Role } from '@koh/common'
import {
  CheckCircleOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { QuestionTagElement } from '../../components/QuestionTagElement'
import { getAsyncWaitTime } from '@/app/utils/timeFormatUtils'
import TAAsyncQuestionCardButtons from './TAAsyncQuestionCardButtons'
import StudentAsyncQuestionCardButtons from './StudentAsyncQuestionCardButtons'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import MarkdownCustom from '@/app/components/Markdown'
import CommentSection from './CommentSection'
import { getAnonAnimal, getAvatarTooltip } from '../utils/commonAsyncFunctions'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'
import styles from './AsyncQuestionCard.module.css'

const statusDisplayMap = {
  // if the question has no answer text, it will say "awaiting answer"
  [asyncQuestionStatus.AIAnsweredNeedsAttention]:
    'AI Answered, Needs Attention',
  [asyncQuestionStatus.AIAnsweredResolved]: 'AI Answered, Resolved',
  [asyncQuestionStatus.HumanAnswered]: 'Human Verified',
  [asyncQuestionStatus.AIAnswered]: 'Answered by AI',
  [asyncQuestionStatus.TADeleted]: 'Deleted by TA',
  [asyncQuestionStatus.StudentDeleted]: 'Deleted by Student',
}

interface AsyncQuestionCardProps {
  question: AsyncQuestion
  userCourseRole: Role
  userId: number
  courseId: number
  mutateAsyncQuestions: () => void
  showStudents: boolean
}

const AsyncQuestionCard: React.FC<AsyncQuestionCardProps> = ({
  question,
  userCourseRole,
  userId,
  courseId,
  mutateAsyncQuestions,
  showStudents,
}) => {
  const [isExpanded, setIsExpanded] = useState(false) // whether or not the card is expanded (not including comments)
  const [showAllComments, setShowAllComments] = useState(false) // whether or not the comments section is expanded
  const [isExpandable, setIsExpandable] = useState(true) // This only stops isExpanded from toggling. When showAllComments is true, this is set to false to make the card not expandable (first you must minimize comments before you can collapse the rest of the card)
  const [isLockedExpanded, setIsLockedExpanded] = useState(false) // This stops both showAllComments and isExpanded from toggling. This is used to prevent users from collapsing the comments while they are still creating/editing one
  const [truncateText, setTruncateText] = useState(true) // after the max-height transition is finished on expanding the text, truncate it to show a `...`
  const [voteCount, setVoteCount] = useState(question.votesSum)
  const [thisUserThisQuestionVote, setThisUserThisQuestionVote] = useState(
    question.votes?.find((vote) => vote.userId === userId)?.vote,
  )
  const [satisfiedLoading, setSatisfiedLoading] = useState(false)
  const [needsAttentionLoading, setNeedsAttentionLoading] = useState(false)
  const shouldFlash =
    question.status === asyncQuestionStatus.AIAnswered &&
    userId === question.creatorId

  // make the card expanded if it is flashing (so they immediately see their answer)
  useEffect(() => {
    if (shouldFlash) {
      setIsExpanded(true)
      setTruncateText(false)
    }
  }, [shouldFlash])

  const isStaff =
    userCourseRole === Role.TA || userCourseRole === Role.PROFESSOR

  // note: it is assumed that only students are creating questions. Staff creating questions will appear as anonymous (but their comments are not)
  const [isUserShown, setIsUserShown] = useState(isStaff && showStudents)
  useEffect(() => {
    setIsUserShown(isStaff && showStudents)
  }, [isStaff, showStudents])

  const anonId = question.creator.anonId
  const anonAnimal = getAnonAnimal(anonId)

  const handleFeedback = async (resolved: boolean) => {
    const newstatus = resolved
      ? asyncQuestionStatus.AIAnsweredResolved
      : asyncQuestionStatus.AIAnsweredNeedsAttention
    await API.asyncQuestions
      .studentUpdate(question.id, { status: newstatus })
      .then(() => {
        mutateAsyncQuestions()
        message.success(
          `Question has been marked as ${
            resolved ? 'resolved' : 'needing faculty attention'
          }.`,
        )
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to update question status:' + errorMessage)
      })
  }

  const showComments = (show: boolean) => {
    // first expand the card, then after 0.3s (animation), expand the comments
    if (show) {
      setIsExpanded(true)
      setTruncateText(false)
      setIsExpandable(false)
      setTimeout(() => {
        setShowAllComments(true)
      }, 300)
    } else {
      // hide the comments, but don't collapse the card right away
      setShowAllComments(false)
      setIsExpandable(true)
    }
  }

  const handleVote = async (questionId: number, vote: number) => {
    const resp = await API.asyncQuestions.vote(questionId, vote)
    setVoteCount(resp.questionSumVotes)
    setThisUserThisQuestionVote(resp.vote)
  }

  const avatarTooltipTitle = getAvatarTooltip(
    isStaff,
    showStudents,
    userId === question.creatorId ? 'you' : Role.STUDENT,
  )

  return (
    <div
      className={cn(
        'mb-2 mt-2 flex flex-col rounded-lg bg-white px-2 pt-2 shadow-lg',
        isStaff &&
          (question.status === asyncQuestionStatus.AIAnswered ||
            question.status === asyncQuestionStatus.AIAnsweredNeedsAttention ||
            !question.answerText)
          ? 'outline outline-1 outline-offset-1 outline-yellow-500'
          : '',
      )}
      onClick={() => {
        if (isLockedExpanded || !isExpandable) return
        setIsExpanded(!isExpanded)
        // after the max-height transition is finished on expanding the text, truncate it to show a `...`
        // truncating the questionText before the animation is finished will cause the animation to jump
        // Also, this logic is reversed for some reason
        if (isExpanded) {
          //// Collapsing the card
          setTimeout(() => {
            setTruncateText(true)
          }, 300)
        } else {
          //// Expanding the card
          // however, we do want to instantly remove the truncation when expanding the card
          setTruncateText(false)
        }
      }}
    >
      <Row wrap={false}>
        <Col flex="none" className="mr-1 items-center justify-center md:mr-2">
          <Button
            type="text"
            icon={
              <ArrowBigUp
                style={
                  thisUserThisQuestionVote == 1
                    ? { color: 'green' }
                    : { color: 'gray' }
                }
              />
            }
            onClick={(e) => {
              e.stopPropagation() // Prevent card expansion
              if (question.id) {
                handleVote(question.id, 1)
              }
            }}
          />
          <div className="my-1 flex items-center justify-center md:my-2">
            {voteCount}
          </div>
          <Button
            type="text"
            icon={
              <ArrowBigDown
                style={
                  thisUserThisQuestionVote == -1
                    ? { color: 'red' }
                    : { color: 'gray' }
                }
              />
            }
            onClick={(e) => {
              e.stopPropagation() // Prevent card expansion
              if (question.id) {
                handleVote(question.id, -1)
              }
            }}
          />
        </Col>
        <Col flex="auto" className="w-full">
          <div className="mb-1 flex flex-col md:mb-4">
            <div className="mb-1 flex justify-between">
              <div className="flex flex-grow">
                <Tooltip title={avatarTooltipTitle}>
                  <UserAvatar
                    className={
                      'mr-2 hidden md:flex ' + (isStaff ? 'cursor-pointer' : '')
                    }
                    size={40}
                    username={
                      isUserShown ? question.creator.name : 'Anonymous Student'
                    }
                    colour={question.creator.colour}
                    photoURL={
                      isUserShown
                        ? question.creator.photoURL
                        : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${anonAnimal}.png`
                    }
                    anonymous
                    onClick={(e) => {
                      if (isStaff) {
                        e?.stopPropagation()
                        setIsUserShown(!isUserShown)
                      }
                    }}
                  />
                  <UserAvatar
                    className={
                      'mr-2 flex md:hidden ' + (isStaff ? 'cursor-pointer' : '')
                    }
                    size={34}
                    username={
                      isUserShown ? question.creator.name : 'Anonymous Student'
                    }
                    colour={question.creator.colour}
                    photoURL={
                      isUserShown
                        ? question.creator.photoURL
                        : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${anonAnimal}.png`
                    }
                    anonymous
                    onClick={(e) => {
                      if (isStaff) {
                        e?.stopPropagation()
                        setIsUserShown(!isUserShown)
                      }
                    }}
                  />
                </Tooltip>
                <div className="flex flex-grow flex-col justify-between md:flex-row">
                  <div
                    className={`flex-grow text-sm italic text-gray-500 md:pt-2.5`}
                  >
                    <span className="mr-2 font-semibold">
                      {isUserShown ? (
                        question.creator.name
                      ) : (
                        <>
                          Anonymous {getAnonAnimal(anonId)}
                          <span className="font-normal not-italic text-green-500">
                            {userId === question.creatorId ? ' (You)' : ''}{' '}
                          </span>
                        </>
                      )}
                    </span>
                    <span>{getAsyncWaitTime(question.createdAt)} ago</span>
                  </div>
                  <div>
                    {/* If it's the students' question, show a tag to indicate whether it is publicly visible or not */}
                    {(userId === question.creatorId || isStaff) && (
                      <Tooltip
                        title={
                          isStaff
                            ? question.visible
                              ? 'This question was marked public by a staff member and can be seen by all students (they still appear anonymous)'
                              : 'Only you and the question creator can see this question'
                            : question.visible
                              ? "A Staff member liked your question and decided to make it publicly visible. Don't worry! Your name and picture are hidden and you appear as an anonymous student."
                              : 'Only you and staff can see this question.'
                        }
                      >
                        <Tag
                          color={question.visible ? 'blue' : 'default'}
                          icon={
                            question.visible ? null : <EyeInvisibleOutlined />
                          }
                        >
                          {question.visible ? 'Public' : 'Private'}
                        </Tag>
                      </Tooltip>
                    )}
                    <Tag
                      icon={
                        question.verified && (
                          <Tooltip title="This Question's Answer was marked as Verified by Staff">
                            <CheckCircleOutlined />
                          </Tooltip>
                        )
                      }
                      color={
                        question.status === asyncQuestionStatus.HumanAnswered
                          ? 'green'
                          : 'gold'
                      }
                    >
                      {!question.answerText
                        ? 'Awaiting Answer'
                        : statusDisplayMap[question.status]}
                    </Tag>
                  </div>
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation()
                }}
                className="flex items-center"
              >
                {isStaff ? (
                  <TAAsyncQuestionCardButtons
                    question={question}
                    onAsyncQuestionUpdate={mutateAsyncQuestions}
                  />
                ) : userId === question.creatorId ? (
                  <StudentAsyncQuestionCardButtons
                    question={question}
                    onAsyncQuestionUpdate={mutateAsyncQuestions}
                    courseId={courseId}
                  />
                ) : null}
              </div>
            </div>
            <div className="flex-grow">
              <h4 className="font-bold">{question.questionAbstract}</h4>
              {/* When not expanded, show only 1 line of the questionText */}
              <div
                className={cn(
                  'childrenMarkdownFormatted',
                  styles.expandableText,
                  isExpanded ? styles.expanded : '',
                  truncateText ? 'line-clamp-1' : '',
                )}
              >
                {<MarkdownCustom>{question.questionText ?? ''}</MarkdownCustom>}
                {question.answerText && (
                  <>
                    <br />
                    <br />
                    <strong>Answer:</strong>
                    <br />
                    {<MarkdownCustom>{question.answerText}</MarkdownCustom>}
                  </>
                )}
              </div>
              <CommentSection
                className={cn(
                  styles.expandableComments,
                  showAllComments ? styles.expandedComments : '',
                )}
                userCourseRole={userCourseRole}
                question={question}
                setIsLockedExpanded={setIsLockedExpanded}
                showStudents={showStudents}
              />
            </div>
            <div className="flex flex-wrap">
              {question.questionTypes?.map((questionType, index) => (
                <QuestionTagElement
                  key={index}
                  tagName={questionType.name}
                  tagColor={questionType.color}
                />
              ))}
            </div>
          </div>
          {question.status === asyncQuestionStatus.AIAnswered &&
            userId === question.creatorId && (
              <div
                className={cn(
                  'flex justify-center gap-4',
                  shouldFlash ? 'flashing' : '',
                )}
              >
                {/* Students vote on whether they still need faculty help */}
                <Button
                  onClick={async (e) => {
                    e.stopPropagation()
                    setSatisfiedLoading(true)
                    await handleFeedback(true)
                    setSatisfiedLoading(false)
                  }}
                  loading={satisfiedLoading}
                  disabled={needsAttentionLoading}
                >
                  Satisfied
                </Button>
                <Button
                  type="primary"
                  onClick={async (e) => {
                    e.stopPropagation()
                    setNeedsAttentionLoading(true)
                    await handleFeedback(false)
                    setNeedsAttentionLoading(false)
                  }}
                  loading={needsAttentionLoading}
                  disabled={satisfiedLoading}
                >
                  Still need faculty Help
                </Button>
              </div>
            )}
        </Col>
      </Row>
      {!isLockedExpanded && (
        <Row className="justify-around">
          <Button
            className="text-sm"
            type="link"
            onClick={(e) => {
              e.stopPropagation()
              showComments(!showAllComments)
            }}
          >
            {showAllComments
              ? 'Hide Comments'
              : `Comments (${question.comments.length})`}
          </Button>
          <div className="mr-16 flex flex-grow justify-center">
            {!isExpandable ? null : isExpanded ? (
              <UpOutlined />
            ) : (
              <DownOutlined />
            )}
          </div>
        </Row>
      )}
    </div>
  )
}

export default AsyncQuestionCard
