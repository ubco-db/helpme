'use client'

import { Collapse, Divider } from 'antd'
import QueueHeader from './QueueHeader'
import TagGroupSwitch from './TagGroupSwitch'
import {
  ConfigTasks,
  parseTaskIdsFromQuestionText,
  Question,
  QuestionType,
  QueueConfig,
  StudentAssignmentProgress,
  Task,
  TaskTree,
  QuestionTypeParams,
} from '@koh/common'
import { QuestionTagElement } from '../../../components/QuestionTagElement'
import QuestionCard from './QuestionCard'
import JoinTagGroupButton from './JoinTagGroupButton'
import { useCallback } from 'react'

const Panel = Collapse.Panel

interface QueueQuestionsProps {
  questions: Question[]
  cid: number
  qid: number
  isStaff: boolean
  studentQuestionId?: number
  studentDemoId?: number
  studentAssignmentProgress?: StudentAssignmentProgress
  queueConfig?: QueueConfig
  configTasks?: ConfigTasks
  tagGroupsEnabled: boolean
  setTagGroupsEnabled: (enabled: boolean) => void
  taskTree?: TaskTree
  isDemoQueue: boolean
  questionTypes?: QuestionType[]
  studentQuestion?: Question
  studentDemo?: Question
  createQuestion: (
    text: string | undefined,
    questionTypes: QuestionType[],
    force: boolean,
    isTaskQuestion: boolean,
    location?: string,
  ) => Promise<void>
  finishQuestionOrDemo: (
    text: string,
    questionTypes: QuestionTypeParams[],
    groupable: boolean,
    isTaskQuestion: boolean,
    location: string,
  ) => Promise<void>
  leaveQueue: (isTaskQuestion: boolean) => Promise<void>
  onOpenTagGroupsChange: (key: string | string[]) => void
  openTagGroups: string[]
  staffListLength: number
}

/**
 * This component is the actual "queue" part of the queue page. It holds all the questions
 */
const QueueQuestions: React.FC<QueueQuestionsProps> = ({
  questions,
  cid,
  qid,
  isStaff,
  studentQuestionId,
  studentDemoId,
  studentAssignmentProgress,
  queueConfig,
  configTasks,
  tagGroupsEnabled,
  setTagGroupsEnabled,
  taskTree,
  isDemoQueue,
  questionTypes,
  studentQuestion,
  studentDemo,
  createQuestion,
  finishQuestionOrDemo,
  leaveQueue,
  onOpenTagGroupsChange,
  openTagGroups,
  staffListLength,
}) => {
  const isTaskJoinable = useCallback(
    (
      task: Task,
      isFirst = true,
      studentDemoText: string | undefined,
    ): boolean => {
      // Goal: Before joining, for the task's preconditions, make sure there are no blocking tasks that are not done (this is done recursively)
      if (task.blocking && !task.isDone && !isFirst) {
        return false
      }
      // Goal: Before joining, all the task's preconditions must be in the student's demo (this is also done recursively)
      if (
        !(
          !task.precondition ||
          studentDemoText?.includes(` "${task.precondition.taskId}"`)
        )
      ) {
        return false
      }
      // Goal: Before leaving, the student's demo must not have any tasks that depend on this task
      if (isFirst) {
        if (
          taskTree &&
          Object.entries(taskTree).some(([, tempTask]) => {
            return (
              tempTask.precondition?.taskId === task.taskId &&
              studentDemoText?.includes(` "${tempTask.taskId}"`)
            )
          })
        ) {
          return false
        }
      }
      // If there's a precondition, recursively check it, marking it as not the first task
      if (task.precondition) {
        return isTaskJoinable(task.precondition, false, studentDemoText)
      }
      // If none of the above conditions are met, the task is valid
      return true
    },
    [taskTree],
  )

  // TODO: this does still needs to be updated to the newest version of Collapse from antd, where it uses the 'items' prop instead of Collapse.Panel.
  // This will help with all the console deprecation warnings.
  // However, this is kind of a difficult task as the Divider will need to be separate and there will likely need to be two Collapse components instead, which may mess with things.
  return (
    <div>
      <div className="flex items-center justify-between">
        {questions?.length === 0 ? (
          <div className="text-xl font-medium text-gray-900">
            There are no questions in the queue
          </div>
        ) : (
          <QueueHeader
            text={tagGroupsEnabled ? 'Queue Groups By Tag' : 'Queue'}
            visibleOnDesktopOrMobile="desktop"
          />
        )}
        {!(
          queueConfig?.fifo_queue_view_enabled === false ||
          queueConfig?.tag_groups_queue_view_enabled === false
        ) ? (
          <TagGroupSwitch
            tagGroupsEnabled={tagGroupsEnabled}
            setTagGroupsEnabled={setTagGroupsEnabled}
            mobile={false}
          />
        ) : null}
      </div>
      {tagGroupsEnabled ? (
        <Collapse
          onChange={onOpenTagGroupsChange}
          className="border-none"
          defaultActiveKey={openTagGroups}
        >
          {/* tasks (for demos/TaskQuestions) */}
          {taskTree &&
            Object.entries(taskTree).map(([taskKey, task]) => {
              const filteredQuestions = questions?.filter(
                (question: Question) => {
                  const tasks = question.isTaskQuestion
                    ? parseTaskIdsFromQuestionText(question.text)
                    : []
                  return question.isTaskQuestion && tasks.includes(taskKey)
                },
              )
              return (
                filteredQuestions &&
                ((isStaff && filteredQuestions.length > 0) || !isStaff) && (
                  <Panel
                    className="tag-group mb-3 rounded bg-white shadow-lg"
                    key={taskKey}
                    header={
                      <div className="flex justify-between">
                        <div>
                          <QuestionTagElement
                            tagName={task.display_name}
                            tagColor={task.color_hex}
                          />
                          <span className=" ml-2 text-gray-700">
                            {filteredQuestions.length > 1
                              ? `${filteredQuestions.length} Students`
                              : filteredQuestions.length == 1
                                ? `${filteredQuestions.length} Student`
                                : ''}
                          </span>
                        </div>
                        <div className="row flex">
                          {task.blocking && (
                            <span className="mr-2 text-gray-400">blocking</span>
                          )}
                          {!isStaff && (
                            <JoinTagGroupButton
                              studentQuestion={studentQuestion}
                              studentDemo={studentDemo}
                              createQuestion={createQuestion}
                              updateQuestion={finishQuestionOrDemo}
                              leaveQueue={leaveQueue}
                              isDone={task.isDone}
                              taskId={taskKey}
                              disabled={
                                !isTaskJoinable(
                                  task,
                                  true,
                                  studentDemo?.text,
                                ) || staffListLength < 1
                              }
                            />
                          )}
                        </div>
                      </div>
                    }
                  >
                    {filteredQuestions.map((question: Question) => {
                      const isMyQuestion = question.id === studentDemoId
                      const background_color = isMyQuestion
                        ? 'bg-teal-200/25'
                        : 'bg-white'
                      return (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          cid={cid}
                          qid={qid}
                          isStaff={isStaff}
                          configTasks={configTasks}
                          studentAssignmentProgress={studentAssignmentProgress}
                          isMyQuestion={isMyQuestion}
                          className={background_color}
                        />
                      )
                    })}
                  </Panel>
                )
              )
            })}
          {isDemoQueue && (
            <Divider
              className="-mx-4 my-2 w-[calc(100%+2rem)] border-[#cfd6de]"
              key="DIVIDER"
            />
          )}
          {/* questionTypes/tags (for regular questions) */}
          {questionTypes?.map((tag) => {
            // naming this "tags" to make some code slightly easier to follow
            const filteredQuestions = questions?.filter((question: Question) =>
              question.questionTypes?.some(
                (questionType) => questionType.name === tag.name,
              ),
            )
            return (
              filteredQuestions &&
              ((isStaff && filteredQuestions.length > 0) || !isStaff) && (
                <Panel
                  className="tag-group mb-3 rounded bg-white shadow-lg"
                  key={tag.id.toString()}
                  header={
                    <div className="flex justify-between">
                      <div>
                        <QuestionTagElement
                          tagName={tag.name}
                          tagColor={tag.color}
                        />
                        <span className=" ml-2 text-gray-700">
                          {filteredQuestions.length > 1
                            ? `${filteredQuestions.length} Students`
                            : filteredQuestions.length == 1
                              ? `${filteredQuestions.length} Student`
                              : ''}
                        </span>
                      </div>
                      {!isStaff && (
                        <JoinTagGroupButton
                          studentQuestion={studentQuestion}
                          studentDemo={studentDemo}
                          createQuestion={createQuestion}
                          updateQuestion={finishQuestionOrDemo}
                          leaveQueue={leaveQueue}
                          questionType={tag}
                          disabled={staffListLength < 1}
                        />
                      )}
                    </div>
                  }
                >
                  {filteredQuestions.map((question: Question) => {
                    const isMyQuestion = question.id === studentQuestionId
                    const background_color = isMyQuestion
                      ? 'bg-teal-200/25'
                      : 'bg-white'
                    return (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        cid={cid}
                        qid={qid}
                        isStaff={isStaff}
                        configTasks={configTasks}
                        studentAssignmentProgress={studentAssignmentProgress}
                        isMyQuestion={isMyQuestion}
                        className={background_color}
                      />
                    )
                  })}
                </Panel>
              )
            )
          })}
        </Collapse>
      ) : (
        questions?.map((question: Question) => {
          const isMyQuestion =
            question.id === studentQuestionId || question.id === studentDemoId
          const background_color = isMyQuestion ? 'bg-teal-200/25' : 'bg-white'
          return (
            <QuestionCard
              key={question.id}
              question={question}
              cid={cid}
              qid={qid}
              isStaff={isStaff}
              configTasks={configTasks}
              studentAssignmentProgress={studentAssignmentProgress}
              isMyQuestion={isMyQuestion}
              className={background_color}
            />
          )
        })
      )}
    </div>
  )
}

export default QueueQuestions
