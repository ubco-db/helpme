import { useEffect, useReducer, useState } from 'react'
import { Button, Col, message, Row, Tag, Tooltip, Image } from 'antd'
import { AsyncQuestion, asyncQuestionStatus, Role } from '@koh/common'
import {
  CheckCircleOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage, parseThinkBlock } from '@/app/utils/generalUtils'
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
import {
  AsyncQuestionCardUIReducer,
  initialUIState,
} from './AsyncQuestionCardUIReducer'
import SourceLinkCitations from '../../components/chatbot/SourceLinkCitations'

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
  const [uiState, dispatch] = useReducer(
    AsyncQuestionCardUIReducer,
    initialUIState,
  )
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
      dispatch({ type: 'EXPAND_QUESTION' })
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

  const toggleComments = () => {
    // first expand the card, then after 0.3s (animation), expand the comments
    if (uiState.expandedState === 'collapsed') {
      dispatch({ type: 'EXPAND_QUESTION' })
      setTimeout(() => {
        dispatch({
          type: 'SHOW_COMMENTS',
          numOfComments: question.comments.length,
        })
      }, 300)
    } else if (uiState.expandedState === 'expandedNoComments') {
      dispatch({
        type: 'SHOW_COMMENTS',
        numOfComments: question.comments.length,
      })
    } else if (uiState.expandedState === 'expandedWithComments') {
      // hide the comments, but don't collapse the card right away
      dispatch({ type: 'HIDE_COMMENTS' })
    }
  }

  const toggleExpandQuestion = () => {
    if (uiState.expandedState === 'collapsed') {
      dispatch({ type: 'EXPAND_QUESTION' })
    } else if (uiState.expandedState === 'expandedNoComments') {
      // after the max-height transition is finished on expanding the text, truncate it to show a `...`
      // truncating the questionText before the animation is finished will cause the animation to jump
      dispatch({ type: 'COLLAPSE_QUESTION' })
      setTimeout(() => {
        dispatch({ type: 'TRUNCATE_TEXT' })
      }, 300)
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

  const { thinkText, cleanAnswer } = parseThinkBlock(question.answerText ?? '')

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
      onClick={toggleExpandQuestion}
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
                  uiState.expandedState === 'expandedNoComments' ||
                    uiState.expandedState === 'expandedWithComments' ||
                    uiState.expandedState === 'expandedWithCommentsLocked'
                    ? styles.expanded
                    : '',
                  uiState.truncateText ? 'line-clamp-1' : '',
                )}
              >
                {<MarkdownCustom>{question.questionText ?? ''}</MarkdownCustom>}
                {question.images && question.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {question.images.map((image) => (
                      <div
                        key={image.imageId}
                        onClick={(e) => {
                          e.stopPropagation() // stop clicks from expanding card
                        }}
                      >
                        <Image
                          key={image.imageId}
                          width={80}
                          loading="lazy"
                          src={`/api/v1/asyncQuestions/${courseId}/image/${image.imageId}?preview=true`}
                          alt={image.aiSummary || image.originalFileName}
                          preview={{
                            src: `/api/v1/asyncQuestions/${courseId}/image/${image.imageId}`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap">
                  {question.questionTypes?.map((questionType, index) => (
                    <QuestionTagElement
                      key={index}
                      tagName={questionType.name}
                      tagColor={questionType.color}
                    />
                  ))}
                </div>

                {question.answerText && (
                  <>
                    <br />
                    <br />
                    <strong>Answer: </strong>
                    <br />
                    {thinkText && (
                      <Tooltip
                        title={`AI Thoughts: ${thinkText}`}
                        classNames={{
                          body: 'w-96 max-h-[80vh] overflow-y-auto',
                        }}
                      >
                        <span
                          className="mr-1 rounded-lg bg-blue-100 p-0.5 pl-1 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i>Thoughts</i> 🧠
                        </span>
                      </Tooltip>
                    )}
                    <MarkdownCustom>
                      {thinkText ? cleanAnswer : question.answerText}
                    </MarkdownCustom>
                    {question.citations && question.citations.length > 0 && (
                      <SourceLinkCitations
                        sourceDocuments={question.citations}
                        chatbotQuestionType={'Course'}
                      />
                    )}
                  </>
                )}
              </div>
              <CommentSection
                className={cn(
                  styles.expandableComments,
                  uiState.expandedState === 'expandedWithComments' ||
                    uiState.expandedState === 'expandedWithCommentsLocked'
                    ? styles.expandedComments
                    : '',
                )}
                userCourseRole={userCourseRole}
                question={question}
                dispatchUIStateChange={dispatch}
                isPostingComment={uiState.isPostingComment}
                showStudents={showStudents}
              />
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
      {uiState.expandedState !== 'expandedWithCommentsLocked' && (
        <Row className="justify-around">
          <Button
            className={`text-sm `}
            type="link"
            onClick={(e) => {
              e.stopPropagation()
              toggleComments()
            }}
          >
            {uiState.expandedState === 'expandedWithComments'
              ? 'Hide Comments'
              : question.comments.length > 0
                ? `Comments (${question.comments.length})`
                : `Post Comment`}
          </Button>
          <div className="mr-16 flex flex-grow justify-center">
            {uiState.expandedState ===
            'expandedWithComments' ? null : uiState.expandedState ===
              'expandedNoComments' ? (
              <UpOutlined />
            ) : (
              uiState.expandedState === 'collapsed' && <DownOutlined />
            )}
          </div>
        </Row>
      )}
    </div>
  )
}

export default AsyncQuestionCard
