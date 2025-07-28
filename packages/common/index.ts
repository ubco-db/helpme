import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import 'reflect-metadata'
import { Cache } from 'cache-manager'
import { Ajv } from 'ajv'

export const PROD_URL = 'https://coursehelp.ubc.ca'

// Get domain. works on node and browser
const domain = (): string | false =>
  process.env.DOMAIN ||
  (typeof window !== 'undefined' && window?.location?.origin)
export const getEnv = (): 'production' | 'dev' => {
  switch (domain()) {
    case PROD_URL:
      return 'production'
    default:
      return 'dev'
  }
}
export const isProd = (): boolean => domain() === PROD_URL

// TODO: Clean this up, move it somwhere else, use moment???
// a - b, in minutes
export function timeDiffInMins(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60)
}

/////////////////////////
// API Base Data Types //
/////////////////////////

// NOTE: These are not the DB data types. They are only used for the api

/**
 * Represents a user.
 * @param id - The unique id of the user in our db.
 * @param email - The email string of the user if they provide it (nullable)
 * @param name - The full name of this user: First Last.
 * @param photoURL - The URL string of this user photo. This is pulled from the admin site
 * @param courses - The list of courses that the user is accociated with (as either a 'student', 'ta' or 'professor')
 * @param desktopNotifs - list of endpoints so that frontend can figure out if device is enabled
 */
export class User {
  id!: number
  email!: string
  firstName?: string
  lastName?: string
  name!: string
  photoURL!: string
  defaultMessage?: string
  sid?: number
  includeDefaultMessage!: boolean
  courses!: UserCourse[]
  desktopNotifsEnabled!: boolean
  @Type(() => DesktopNotifPartial)
  desktopNotifs!: DesktopNotifPartial[]
  userRole!: string
  organization?: OrganizationUserPartial
  chat_token!: ChatTokenPartial
  accountType!: AccountType
  emailVerified!: boolean
  readChangeLog!: boolean
}

export class ChatTokenPartial {
  id!: number
  token!: string
  used!: number
  max_uses!: number
}

export class OrganizationResponse {
  id!: number
  name!: string
  logoUrl?: string
  bannerUrl?: string
  websiteUrl?: string
  ssoEnabled?: boolean
  legacyAuthEnabled?: boolean
  googleAuthEnabled?: boolean
  ssoUrl?: string
}

export class DesktopNotifPartial {
  id!: number
  endpoint!: string
  name?: string
  @Type(() => Date)
  createdAt!: Date
}

/**
 * Given by get_users endpoint that returns all users
 */
export interface OrgUser {
  userId: number
  firstName: string
  lastName: string
  email: string
  photoUrl: string | null
  userRole: string
  organizationRole: string
}

/**
 * Contains the partial user info needed by the frontend when nested in a response
 * @param id - The unique id of the user in our db.
 * @param name - The full name of this user: First Last.
 * @param photoURL - The URL string of this user photo. This is pulled from the admin site.
 */
export class UserPartial {
  @IsInt()
  id!: number

  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  photoURL?: string

  @IsInt()
  @IsOptional()
  sid?: number

  @IsOptional()
  @IsString()
  TANotes?: string
}

/**
 * A User with minimal information.
 * Used in AddStudentsToQueueModal, can be used elsewhere.
 */
export type UserTiny = {
  id: number
  name: string
}

/**
 * Represents a partial course data needed on the front end when nested in a response.
 * @param id - The id number of this Course.
 * @param name - The subject and course number of this course. Ex: "CS 2500"
 * @param semesterId - The id of the semester this course is in.
 * @param enabled - Whether this course is enabled or not.
 */
export type CoursePartial = {
  id: number
  name: string
  sectionGroupName?: string
  semesterId?: number
  enabled?: boolean
  favourited?: boolean
}

/**
 * Represents a partial course data used for cloning a course.
 */
export type CourseCloneAttributes = {
  professorIds: number[]
  newSemesterId?: number
  newSection?: string
  associateWithOriginalCourse?: boolean
  toClone: {
    coordinator_email?: boolean
    zoomLink?: boolean
    courseInviteCode?: boolean
    courseFeatureConfig?: boolean
    asyncCentreQuestionTypes?: boolean
    queues?: boolean
    queueInvites?: boolean
    chatbot?: {
      settings?: boolean
      documents?: boolean
      manuallyCreatedChunks?: boolean
      insertedQuestions?: boolean
      insertedLMSData?: boolean
    }
  }
}

export const defaultCourseCloneAttributes: CourseCloneAttributes = {
  professorIds: [],
  associateWithOriginalCourse: true,
  newSemesterId: -1,
  newSection: '',
  toClone: {
    coordinator_email: true,
    zoomLink: false,
    courseInviteCode: false,
    courseFeatureConfig: true,
    asyncCentreQuestionTypes: true,
    queues: true,
    queueInvites: true,
    chatbot: {
      settings: true,
      documents: true,
      manuallyCreatedChunks: true,
      insertedQuestions: true,
      insertedLMSData: false,
    },
  },
}

// The key to the records is the course ids
export type BatchCourseCloneAttributes = Record<number, CourseCloneAttributes>

export type BatchCourseCloneResponse = {
  success: boolean
  message: string
}

export class RegistrationTokenDetails {
  @IsString()
  token!: string
}

export class PasswordRequestResetBody {
  @IsString()
  email!: string

  @IsString()
  recaptchaToken!: string

  @IsInt()
  organizationId!: number
}

export class PasswordRequestResetWithTokenBody {
  @IsString()
  password!: string

  @IsString()
  confirmPassword!: string
}

/**
 * Represents a course that a user is accociated with and their role in that course
 * @param course - The course the user accociated with.
 * @param role - The user's role in the course.
 */
export type UserCourse = {
  course: CoursePartial
  role: Role
  favourited: boolean
  unreadCount?: number
}

export const COURSE_TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

export enum MailServiceType {
  ASYNC_QUESTION_HUMAN_ANSWERED = 'async_question_human_answered',
  ASYNC_QUESTION_FLAGGED = 'async_question_flagged',
  ASYNC_QUESTION_STATUS_CHANGED = 'async_question_status_changed',
  ASYNC_QUESTION_UPVOTED = 'async_question_upvoted',
  ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST = 'async_question_new_comment_on_my_post',
  ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST = 'async_question_new_comment_on_others_post',
  COURSE_CLONE_SUMMARY = 'course_clone_summary',
}
/**
 * Represents one of three possible user roles in a course.
 */
export enum Role {
  STUDENT = 'student',
  TA = 'ta',
  PROFESSOR = 'professor',
}

/**
 * Represents a method of authentication for a user.
 * Legacy account is an account that has been registered with user and password via sign up page.
 */
export enum AccountType {
  LEGACY = 'legacy',
  GOOGLE = 'google',
  SHIBBOLETH = 'shibboleth',
}

// chatbot questions and interactions

export interface UpdateDocumentChunkParams {
  documentText: string
  metadata: {
    name: string
    source: string
  }
}

// comes from helpme db
export interface ChatbotQuestionResponseHelpMeDB {
  id: number
  vectorStoreId: string
  interactionId: number
  questionText: string
  responseText: string
  timestamp: Date
  userScore: number
  suggested: boolean
  isPreviousQuestion: boolean
  correspondingChatbotQuestion?: ChatbotQuestionResponseChatbotDB // used by chatbot_questions page on frontend
  timesAsked?: number // same as above
}

// comes from chatbot db
export interface ChatbotQuestionResponseChatbotDB {
  id: string
  pageContent: string // this is the question
  metadata: {
    answer: string
    timestamp?: string // i found a chatbot question without a timestamp 😭
    courseId: string
    verified: boolean
    sourceDocuments: SourceDocument[]
    suggested: boolean
    inserted?: boolean
  }
  userScoreTotal?: number // NOT returned from db, it's calculated and used by chatbot_questions page on frontend
  timesAsked?: number // same as above
  interactionsWithThisQuestion?: InteractionResponse[] // same as above
  mostRecentlyAskedHelpMeVersion?: ChatbotQuestionResponseHelpMeDB | null // same as above
}

interface Loc {
  pageNumber: number
}

// source document return type (from chatbot db)
export interface SourceDocument {
  id?: string
  metadata?: {
    loc?: Loc
    name: string
    type?: string
    source?: string
    courseId?: string
    fromLMS?: boolean
    apiDocId?: number
  }
  type?: string
  // TODO: is it content or pageContent? since this file uses both. EDIT: It seems to be both/either. Gross.
  content?: string
  pageContent: string
  docName: string
  docId?: string // no idea if this exists in the actual data EDIT: yes it does, sometimes
  pageNumbers?: number[] // same with this, but this might only be for the edit question modal
  pageNumbersString?: string // used only for the edit question modal
  sourceLink?: string
  pageNumber?: number
  key?: string // used for front-end rendering
}

export interface PreDeterminedQuestion {
  id: string
  pageContent: string
  metadata: {
    answer: string
    courseId: string
    inserted: boolean
    sourceDocuments: SourceDocument[]
    suggested: boolean
    verified: boolean
  }
}

export interface Message {
  type: 'apiMessage' | 'userMessage'
  message: string | void
  verified?: boolean
  sourceDocuments?: SourceDocument[]
  questionId?: string
  thinkText?: string | null // used on frontend only
}

export interface ChatbotQueryParams {
  query: string
  type: 'default' | 'abstract'
}

export interface ChatbotAskParams {
  question: string
  history: Message[]
  interactionId?: number
  onlySaveInChatbotDB?: boolean
}

export interface ChatbotAskSuggestedParams {
  question: string
  responseText: string
  vectorStoreId: string
}

export interface AddDocumentChunkParams {
  documentText: string
  metadata: {
    name: string
    type: string
    source?: string
    loc?: Loc
    id?: string
    courseId?: number
  }
  prefix?: string
}

export interface AddDocumentAggregateParams {
  name: string
  source: string
  documentText: string
  metadata?: any
  prefix?: string
}

export interface UpdateDocumentAggregateParams {
  documentText: string
  metadata?: any
  prefix?: string
}

export interface UpdateChatbotQuestionParams {
  id: string
  inserted?: boolean
  sourceDocuments?: SourceDocument[]
  question?: string
  answer?: string
  verified?: boolean
  suggested?: boolean
  selectedDocuments?: {
    docId: string
    pageNumbersString: string
  }[]
}

// this is the response from the backend when new questions are asked
// if question is I don't know, only answer and questionId are returned
export interface ChatbotAskResponse {
  chatbotRepoVersion: ChatbotAskResponseChatbotDB
  helpmeRepoVersion: ChatbotQuestionResponseHelpMeDB | null
}

// comes from /ask from chatbot db
export interface ChatbotAskResponseChatbotDB {
  question: string
  answer: string
  questionId: string
  interactionId: number
  sourceDocuments?: SourceDocument[]
  verified: boolean
  courseId: string
  isPreviousQuestion: boolean
}

export interface AddChatbotQuestionParams {
  question: string
  answer: string
  verified: boolean
  suggested: boolean
  sourceDocuments: SourceDocument[]
}

export interface ChatbotSettings {
  id: string
  AvailableModelTypes: Record<string, string>
  pageContent: string
  metadata: ChatbotSettingsMetadata
}

export interface ChatbotSettingsMetadata {
  modelName: string
  prompt: string
  similarityThresholdDocuments: number
  temperature: number
  topK: number
}
export interface ChatbotSettingsUpdateParams {
  modelName?: string
  prompt?: string
  similarityThresholdDocuments?: number
  temperature?: number
  topK?: number
}

export interface InteractionResponse {
  id: number
  timestamp: Date
  questions?: ChatbotQuestionResponseHelpMeDB[]
}

export class ChatbotDocument {
  id!: number
  name!: number
  type!: string
  subDocumentIds!: string[]
}

export type GetInteractionsAndQuestionsResponse = {
  helpmeDB: InteractionResponse[]
  chatbotDB: ChatbotQuestionResponseChatbotDB[]
}

export type GetChatbotHistoryResponse = {
  history: InteractionResponse[]
}
/**
 * Represents one of two possible roles for the global account
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

/**
 * Represents a user's role in an organization.
 */
export enum OrganizationRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  PROFESSOR = 'professor',
}

/**
 * A Queue that students can join with their tickets.
 * @param id - The unique id number for a Queue.
 * @param course - The course that this office hours queue is for.
 * @param room - The full name of the building + room # that the current office hours queue is in.
 * @param staffList - The list of TA user's that are currently helping at office hours.
 * @param questions - The list of the students questions associated with the queue.
 */
// note: this is apparently not used anywhere
export interface Queue {
  id: number
  course: CoursePartial
  room: string
  staffList: UserPartial[]
  questions: Question[]
  allowQuestions: boolean
}

// Queue location/type for different queues within each course
export type QueueTypes = 'online' | 'hybrid' | 'inPerson'

export enum ExtraTAStatus {
  HELPING_IN_ANOTHER_QUEUE = 'Helping student in another queue',
  HELPING_IN_ANOTHER_COURSE = 'Helping student in another course',
}
export interface StaffMember {
  id: number
  name: string
  helpingStudentInAnotherQueueSince?: Date
  extraStatus?: ExtraTAStatus
  photoURL?: string
  TANotes?: string
}

/**
 * A Queue partial to be shown on the course page. It's like the full Queue object but without the questions.
 * @param id - The unique id number for a Queue.
 * @param room - The full name of the building + room # that the current office hours queue is in.
 * @param staffList - The list of TA user's that are currently helping at office hours.
 * @param config - A JSON object that contains the configuration for the queue. Contains stuff like tags, tasks, etc.
 */
export class QueuePartial {
  id!: number
  room!: string

  @Type(() => UserPartial)
  staffList!: StaffMember[]

  queueSize!: number
  notes?: string

  isDisabled!: boolean

  allowQuestions!: boolean

  type!: QueueTypes

  isProfessorQueue!: boolean

  config?: QueueConfig

  zoomLink?: string

  courseId!: number
}

/**
 * Used when editing QueueInvites
 */
export class QueueInviteParams {
  @IsInt()
  queueId!: number
  @IsBoolean()
  QRCodeEnabled!: boolean
  @IsBoolean()
  isQuestionsVisible!: boolean
  @IsBoolean()
  willInviteToCourse!: boolean
  @IsString()
  inviteCode!: string
  @IsIn(['L', 'M'])
  QRCodeErrorLevel!: 'L' | 'M'
}

/**
 * Returned from getQueueInvites (for displaying all of them in courseSettings)
 */
export type QueueInvite = {
  queueId: number
  room: string
  QRCodeEnabled: boolean
  isQuestionsVisible: boolean
  willInviteToCourse: boolean
  inviteCode: string
  QRCodeErrorLevel: 'L' | 'M'
}

/**
 * This is the queue data that is publicly available for a queue invite page IF they give the right queue invite code
 */
export type PublicQueueInvite = {
  orgId: number
  courseId: number
  queueId: number
  room: string
  QRCodeEnabled: boolean
  isQuestionsVisible: boolean
  willInviteToCourse: boolean
  inviteCode: string // queue invite code
  QRCodeErrorLevel: 'L' | 'M'
  courseInviteCode?: string // course invite code only given if willInviteToCourse is true
  queueAndQuestions?: SSEQueueResponse // only given if isQuestionsVisible is true
  queueSize: number
  staffList: StaffForStaffList[]
  courseName: string
}

export type StaffForStaffList = {
  id: number
  name: string
  photoURL?: string
  questionHelpedAt?: Date
}

// Represents a list of office hours wait times of each hour of the week.
// The first element of the array is the wait time for the first hour of Sunday, UTC.
//   Users of the heatmap should rotate it according to their timezone.
// INVARIANT: Must have 24*7 elements
//
// Wait time = -1 represents no office hours data at that time.
export type Heatmap = Array<number>

/**
 * A Question is created when a student wants help from a TA.
 * @param id - The unique id number for a student question.
 * @param creator - The Student that has created the question.
 * @param text - The text descritipn of what he/she needs help with.
 * @param creatorId - userId of question creator
 * @param createdAt - The date string for the time that the Ticket was created. Ex: "2020-09-12T12:00:00-04:00"
 * @param helpedAt - The date string for the time that the TA began helping the Student.
 * @param closedAt - The date string for the time that the TA finished helping the Student.
 * @param questionTypes - The question types help distinguish questions for TA's and data insights.
 * @param status - The current status of the question in the queue.
 * @param position - The current position of this question in the queue.
 * @param location - The location of the particular student, to help TA's find them.
 */
export class Question {
  id!: number

  @Type(() => UserPartial)
  creator!: UserPartial

  text?: string

  creatorId!: number

  @Type(() => UserPartial)
  taHelped?: UserPartial

  @Type(() => Date)
  createdAt?: Date

  @Type(() => Date)
  helpedAt?: Date

  // in seconds
  helpTime!: number

  @Type(() => Date)
  lastReadyAt?: Date

  // in seconds
  waitTime!: number

  @Type(() => Date)
  closedAt?: Date

  @Type(() => QuestionTypeParams)
  questionTypes?: QuestionType[]

  status!: QuestionStatus

  groupable!: boolean

  location?: QuestionLocations

  isTaskQuestion?: boolean
}

// Type of async question events
export enum asyncQuestionEventType {
  answered = 'answered',
  deleted = 'deleted',
  madeVisible = 'madeVisible',
  created = 'created',
}

export enum OpenQuestionStatus {
  Drafting = 'Drafting',
  Queued = 'Queued',
  Helping = 'Helping',
  PriorityQueued = 'PriorityQueued',
  Paused = 'Paused',
}

/**
 * Limbo statuses are awaiting some confirmation from the student.
 */
export enum LimboQuestionStatus {
  CantFind = 'CantFind', // represents when a student can't be found by a TA
  ReQueueing = 'ReQueueing', // represents when a TA wants to get back to a student later and give them the option to be put into the priority queue
  TADeleted = 'TADeleted', // When a TA deletes a question for a multitude of reasons
}

export enum ClosedQuestionStatus {
  Resolved = 'Resolved',
  DeletedDraft = 'DeletedDraft',
  ConfirmedDeleted = 'ConfirmedDeleted',
  Stale = 'Stale',
  LeftDueToNoStaff = 'LeftDueToNoStaff',
}

/** waitingStatuses are statuses where the student waiting to be helped */
export const waitingStatuses: ReadonlyArray<QuestionStatus> = [
  OpenQuestionStatus.Paused,
  OpenQuestionStatus.Queued,
  OpenQuestionStatus.PriorityQueued,
]

export enum asyncQuestionStatus {
  AIAnsweredNeedsAttention = 'AIAnsweredNeedsAttention', // AI has answered, but the answer is unsatisfactory.
  AIAnsweredResolved = 'AIAnsweredResolved', // AI has answered, and the answer is satisfactory.
  HumanAnswered = 'HumanAnswered', // A human (professor/TA) has provided an answer.
  AIAnswered = 'AIAnswered', // AI has answered
  TADeleted = 'TADeleted',
  StudentDeleted = 'StudentDeleted',
}

export enum resolutionSource {
  AI = 'AI',
  Human = 'Human',
  NotAnswerable = 'NotAnswerable',
}

export const StatusInQueue = [
  OpenQuestionStatus.Drafting,
  OpenQuestionStatus.Queued,
  LimboQuestionStatus.ReQueueing,
]

export const StatusInPriorityQueue = [OpenQuestionStatus.PriorityQueued]

export const StatusSentToCreator = [
  ...StatusInPriorityQueue,
  ...StatusInQueue,
  OpenQuestionStatus.Helping,
  OpenQuestionStatus.Paused,
  LimboQuestionStatus.ReQueueing,
  LimboQuestionStatus.CantFind,
  LimboQuestionStatus.TADeleted,
]

// Ticket Status - Represents a given status of as student's ticket
export type QuestionStatus = keyof typeof QuestionStatusKeys
// an Enum-like constant that contains all the statuses for convenience.
export const QuestionStatusKeys = {
  ...OpenQuestionStatus,
  ...ClosedQuestionStatus,
  ...LimboQuestionStatus,
}

export class QuestionGroup {
  @IsInt()
  id!: number

  @Type(() => Question)
  questions!: Array<Question>

  @Type(() => UserPartial)
  creator!: UserPartial

  //Might want to add a list of students in group so they can be added without a question
}

export type AsyncCreator = {
  id?: number
  anonId: number
  name?: string
  photoURL?: string
  email?: string
  courseRole: Role
  isAuthor?: boolean
  colour: string // hex string (generated from nameToRGB())
}

/**
 * This AsyncQuestion is one that is already created and not used for sending data to the server (hence why there's no decorators). Used on frontend.
 */
export type AsyncQuestion = {
  id: number
  creator: AsyncCreator
  questionText?: string
  creatorId?: number
  taHelped?: User
  createdAt: Date
  questionTypes: QuestionType[]
  status: asyncQuestionStatus
  questionAbstract: string
  answerText?: string
  aiAnswerText?: string
  closedAt?: Date
  isAnonymous?: boolean
  staffSetVisible?: boolean
  authorSetVisible?: boolean
  verified: boolean
  votes?: AsyncQuestionVotes[]
  comments: AsyncQuestionComment[]
  votesSum: number
}

/**
 * An async question is created when a student wants help from a TA.
 */
export class AsyncQuestionParams {
  @IsOptional()
  @IsInt()
  id?: number

  @Type(() => UserPartial)
  creator?: UserPartial

  @IsOptional()
  @IsString()
  questionText?: string

  @IsOptional()
  @IsInt()
  creatorId?: number

  @Type(() => User)
  taHelped?: User

  @Type(() => Date)
  createdAt?: Date

  @IsOptional()
  questionTypes?: QuestionTypeParams[]

  @IsOptional()
  @IsString()
  status?: asyncQuestionStatus

  @IsOptional()
  @IsString()
  questionAbstract?: string

  @IsOptional()
  @IsString()
  answerText?: string

  @IsOptional()
  @IsString()
  aiAnswerText?: string

  @Type(() => Date)
  closedAt?: Date

  @IsOptional()
  @IsBoolean()
  staffSetVisible?: boolean

  @IsOptional()
  @IsBoolean()
  authorSetVisible?: boolean

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean

  @IsOptional()
  @IsBoolean()
  verified?: boolean

  votes?: AsyncQuestionVotes[]

  @IsOptional()
  @IsInt()
  votesSum?: number
}
export class AsyncQuestionVotes {
  @IsOptional()
  @IsInt()
  id?: number

  @IsInt()
  questionId!: number

  @IsInt()
  userId!: number

  @IsInt()
  vote!: number
}

export class AsyncQuestionComment {
  id!: number

  questionId!: number

  creator!: AsyncCreator

  commentText!: string

  isAnonymous!: boolean

  @Type(() => Date)
  createdAt!: Date
}

export class AsyncQuestionCommentParams {
  @IsString()
  commentText!: string

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean
}

export class QueueChatPartial {
  // Might be useful for frontend insights on chat (after the fact; won't be sent to chat users)
  @IsOptional()
  @IsInt()
  id?: number

  staff!: QueueChatUserPartial

  student!: QueueChatUserPartial

  questionId!: number

  @IsDate()
  startedAt!: Date

  messages?: QueueChatMessagePartial[]
}

export class QueueChatUserPartial {
  @IsOptional()
  @IsInt()
  id?: number

  @IsString()
  firstName!: string

  @IsString()
  lastName!: string

  @IsString()
  photoURL?: string
}

export class QueueChatMessagePartial {
  @IsBoolean()
  isStaff!: boolean

  @IsString()
  message!: string

  @IsDate()
  timestamp!: Date
}

export class Image {
  @IsOptional()
  @IsInt()
  id?: number
}
// /**
//  * A Semester object, representing a schedule semester term for the purposes of a course.
//  * @param season - The season of this semester.
//  * @param year - The year of this semester.
//  */
// interface Semester {
//   season: Season;
//   year: number;
// }

/**
 * Represents one of the seasons in which a course can take place.
 * From Khoury implementation (not used in newer code or in semester model anymore)
 */
export type Season = string

export type DesktopNotifBody = {
  endpoint: string
  expirationTime?: number
  keys: {
    p256dh: string
    auth: string
  }
  name?: string
}

// =================== API Route Types ===========================
// On backend, validated with https://docs.nestjs.com/techniques/validation
// API route Params and Responses

// Office Hours Response Types
export class GetProfileResponse extends User {}

export class UBCOloginParam {
  @IsString()
  email!: string

  @IsString()
  password!: string

  @IsOptional()
  @IsString()
  recaptchaToken?: string
}
export class UBCOuserParam {
  @IsString()
  email!: string

  @IsInt()
  selected_course!: number

  @IsInt()
  organizationId!: number
}

export enum calendarEventLocationType {
  inPerson = 'in-person',
  online = 'online',
  hybrid = 'hybrid',
}
export function getCalendarEventLocationTypeFormatted(
  locationType: calendarEventLocationType,
): string {
  switch (locationType) {
    case calendarEventLocationType.inPerson:
      return 'In-Person'
    case calendarEventLocationType.online:
      return 'Online'
    case calendarEventLocationType.hybrid:
      return 'Hybrid'
    default:
      return ''
  }
}
export class Calendar {
  @IsInt()
  @IsOptional()
  id?: number

  @IsString()
  title!: string

  @IsDate()
  @Type(() => Date)
  start!: Date

  @IsDate()
  @Type(() => Date)
  end!: Date

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date

  @IsEnum(calendarEventLocationType)
  locationType!: calendarEventLocationType

  @IsString()
  @IsOptional()
  locationOnline?: string

  @IsString()
  @IsOptional()
  locationInPerson?: string

  @IsNumber()
  @IsOptional()
  cid?: number

  @IsArray()
  @IsOptional()
  daysOfWeek?: string[]

  @IsBoolean()
  @IsOptional()
  allDay?: boolean

  @IsString()
  @IsOptional()
  @MaxLength(7)
  color?: string

  @IsArray()
  @IsNumber({}, { each: true })
  staffIds?: number[]

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  staffNames?: string[]
}

export class questions {
  @IsInt()
  id!: number

  @IsInt()
  queueId?: number

  @IsString()
  text?: string

  @IsArray()
  questionTypes?: QuestionTypeParams[]

  @IsDate()
  @Type(() => Date)
  createdAt!: Date

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  helpedAt?: Date

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  closedAt?: Date

  @IsString()
  status?: string

  @IsString()
  location?: string

  @IsString()
  creatorName?: string

  @IsString()
  helpName?: string

  @IsBoolean()
  @IsOptional()
  isTaskQuestion?: boolean
}
export interface KhouryRedirectResponse {
  redirect: string
}

export class UpdateOrganizationUserRole {
  @IsNumber()
  @IsNotEmpty()
  userId!: number

  @IsString()
  @IsNotEmpty()
  organizationRole!: OrganizationRole
}

export class UpdateOrganizationDetailsParams {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  websiteUrl?: string
}

export class UpdateProfileParams {
  @IsBoolean()
  @IsOptional()
  desktopNotifsEnabled?: boolean

  @IsString()
  @IsOptional()
  firstName?: string

  @IsInt()
  @IsOptional()
  sid?: number

  @IsString()
  @IsOptional()
  lastName?: string

  @IsString()
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  defaultMessage?: string

  @IsBoolean()
  @IsOptional()
  includeDefaultMessage?: boolean
}

export class OrganizationPartial {
  id!: number
  name!: string
  logoUrl?: string
  bannerUrl?: string
  websiteUrl?: string
  ssoEnabled?: boolean
  ssoUrl?: string
  semesters?: SemesterPartial[]
}

export class OrganizationUserPartial {
  id!: number
  orgId!: number
  organizationName!: string
  organizationDescription!: string
  organizationLogoUrl!: string
  organizationBannerUrl!: string
  organizationRole!: string
}

export class GetOrganizationResponse {
  id!: number
  name!: string
  semesters!: SemesterPartial[]
  description?: string
  logoUrl?: string
  bannerUrl?: string
  websiteUrl?: string
  ssoEnabled?: boolean
  ssoUrl?: string
}

export type UpsertLMSOrganizationParams = {
  apiPlatform: LMSIntegrationPlatform
  rootUrl: string
}

export type RemoveLMSOrganizationParams = {
  apiPlatform: LMSIntegrationPlatform
}

export type UpsertLMSCourseParams = {
  apiPlatform: LMSIntegrationPlatform
  apiKey: string
  apiKeyExpiry?: Date
  apiKeyExpiryDeleted?: boolean
  apiCourseId: string
}

export type TestLMSIntegrationParams = {
  apiPlatform: LMSIntegrationPlatform
  apiKey: string
  apiCourseId: string
}

export class LMSOrganizationIntegrationPartial {
  organizationId!: number
  apiPlatform!: LMSIntegrationPlatform
  rootUrl!: string
  courseIntegrations!: LMSCourseIntegrationPartial[]
}

export class LMSCourseIntegrationPartial {
  courseId!: number
  course!: CoursePartial
  apiPlatform!: LMSIntegrationPlatform
  apiCourseId!: string
  apiKeyExpiry!: Date
  lmsSynchronize!: boolean
  isExpired!: boolean
  selectedResourceTypes?: LMSResourceType[]
}

export type LMSCourseAPIResponse = {
  name: string
  code: string
  studentCount: number
}

export type LMSAssignment = {
  id: number
  name: string
  description: string
  syncEnabled?: boolean
  due?: Date
  modified?: Date
  uploaded?: Date
}

export type LMSAnnouncement = {
  id: number
  title: string
  message: string
  posted: Date
  syncEnabled?: boolean
  modified?: Date
  uploaded?: Date
}

export type LMSPage = {
  id: number
  title: string
  body: string
  url: string
  frontPage: boolean
  syncEnabled?: boolean
  modified?: Date
  uploaded?: Date
}
export type LMSErrorType = {
  deleteError: "Couldn't remove pre-existing documents"
}

export type LMSFileUploadResponse = {
  id: number
  success: boolean
  documentId?: string
  reason?: LMSErrorType
}

export enum LMSApiResponseStatus {
  None = '',
  InvalidPlatform = 'The specified LMS platform is not registered with the HelpMe system.',
  InvalidKey = 'The specified API key was not valid.',
  InvalidCourseId = 'The specified LMS API course identifier was not valid.',
  InvalidConfiguration = 'The specified LMS configuration was not valid.',
  Error = 'An error occurred, operation with or connection to the LMS API failed.',
  Success = 'Successfully contacted LMS API.',
}

export enum LMSResourceType {
  ASSIGNMENTS = 'assignments',
  ANNOUNCEMENTS = 'announcements',
  PAGES = 'pages',
}

export interface CourseResponse {
  courseId: number
  courseName: string
  isEnabled: boolean
  sectionGroupName?: string
  semesterId?: number
  semester: SemesterPartial
}

export class GetCourseResponse {
  id!: number
  name!: string

  @Type(() => QueuePartial)
  queues?: QueuePartial[]

  // The heatmap is false when there havent been any questions asked yet or there havent been any office hours
  heatmap!: Heatmap | false

  coordinator_email?: string

  icalURL?: string

  zoomLink?: string

  selfEnroll!: boolean

  asyncQuestionDisplayTypes?: string[]

  timezone?: string

  semester?: SemesterPartial

  sectionGroupName?: string

  enabled?: boolean

  @Type(() => OrganizationPartial)
  organizationCourse?: OrganizationPartial

  courseInviteCode?: string
}

export class GetLimitedCourseResponse {
  id!: number
  name!: string

  @Type(() => OrganizationPartial)
  organizationCourse?: OrganizationPartial
  courseInviteCode!: string
}

export class GetCourseUserInfoResponse {
  users!: UserPartial[]
  total!: number
}

export class GetOrganizationUsersResponse {
  userId!: number
  userFirstName!: string
  userLastName!: string
  userEmail!: string
  userPhotoUrl!: string
  userOrganizationRole!: string
}

export class OrganizationUser {
  id!: number
  firstName!: string
  lastName!: string
  email!: string
  photoUrl!: string
  fullName!: string
  globalRole!: string
  sid!: number
  accountDeactivated!: boolean
}

export class OrganizationCourse {
  id!: number
  name!: string
  role!: string
}

export class GetOrganizationUserResponse {
  organizationId!: number
  organizationRole!: string
  user!: OrganizationUser
  courses!: OrganizationCourse[]
}

export type OrganizationProfessor = {
  organizationUser: {
    id: number
    name: string
    lacksProfOrgRole?: boolean
  }
  userId: number
}

export class UpdateOrganizationCourseDetailsParams {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  coordinator_email?: string

  @IsString()
  @IsOptional()
  sectionGroupName?: string

  @IsString()
  @IsOptional()
  zoomLink?: string

  @IsString()
  @IsOptional()
  timezone?: string

  @IsInt()
  @IsOptional()
  semesterId?: number

  @IsArray()
  @IsOptional()
  profIds?: Array<number>

  @IsArray()
  @IsOptional()
  courseSettings?: Array<CourseSettingsRequestBody>
}

export class DocumentParams {
  @IsString()
  name?: string

  @IsString()
  type?: string

  @IsArray()
  subDocumentIds?: string[]
}

export class GetQueueResponse extends QueuePartial {}

export class GetCourseQueuesResponse extends Array<QueuePartial> {}

export class GetQueueChatResponse extends QueueChatPartial {}

export class GetQueueChatsResponse extends Array<QueueChatPartial> {}

export class ListQuestionsResponse {
  @Type(() => Question)
  yourQuestions?: Array<Question>

  @Type(() => Question)
  questionsGettingHelp!: Array<Question>

  @Type(() => Question)
  questions!: Array<Question>

  @Type(() => Question)
  priorityQueue!: Array<Question>

  @Type(() => QuestionGroup)
  groups!: Array<QuestionGroup>

  @Type(() => AlertPayload)
  unresolvedAlerts?: Array<AlertPayload>
}

export class GetQuestionResponse extends Question {}

export class GetStudentQuestionResponse extends Question {
  @IsInt()
  queueId!: number
}

export type QuestionLocations = 'Online' | 'In-Person' | 'Unselected'

export class CreateQuestionParams {
  @IsString()
  text!: string

  @IsArray()
  @IsOptional()
  questionTypes?: QuestionTypeParams[]

  @IsBoolean()
  groupable!: boolean

  @IsBoolean()
  isTaskQuestion = false

  @IsInt()
  queueId!: number

  @IsString()
  @IsOptional()
  location?: QuestionLocations

  @IsBoolean()
  force!: boolean
}
export class CreateQuestionResponse extends Question {}

export class UpdateQuestionParams {
  @IsString()
  @IsOptional()
  text?: string

  @IsArray()
  @IsOptional()
  questionTypes?: QuestionTypeParams[]

  @IsBoolean()
  @IsOptional()
  groupable?: boolean

  @IsBoolean()
  @IsOptional()
  isTaskQuestion?: boolean

  @IsInt()
  @IsOptional()
  queueId?: number

  @IsEnum(QuestionStatusKeys)
  @IsOptional()
  status?: QuestionStatus

  @IsString()
  @IsOptional()
  location?: string
}
export class UpdateQuestionResponse extends Question {}

export class GroupQuestionsParams {
  @IsArray()
  @Type(() => Number)
  questionIds!: number[]

  @IsInt()
  queueId!: number
}

export class ResolveGroupParams {
  @IsInt()
  queueId!: number
}

export class CreateAsyncQuestions extends AsyncQuestionParams {}

export class UpdateAsyncQuestions extends AsyncQuestionParams {}

export type TAUpdateStatusResponse = QueuePartial
export type QueueNotePayloadType = {
  notes: string
}

export class TACheckoutResponse {
  // The ID of the queue we checked out of
  queueId!: number
}

export class UpdateQueueParams {
  @IsString()
  @IsOptional()
  type?: QueueTypes

  @IsString()
  @IsOptional()
  notes?: string

  @IsBoolean()
  allowQuestions?: boolean

  @IsString()
  @IsOptional()
  zoomLink?: string
}

export class QuestionTypeParams {
  @IsInt() // when updating a question with new questionTypes, the question type's id is required
  @IsOptional()
  id?: number

  @IsInt()
  @IsOptional()
  cid?: number

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsHexColor()
  @IsNotEmpty()
  color!: string

  @IsInt()
  @IsOptional()
  queueId?: number | null
}

export type QuestionType = {
  id: number
  cid: number
  name: string
  color: string
  queueId: number | null | undefined
}

export class TACheckinTimesResponse {
  @Type(() => TACheckinPair)
  taCheckinTimes!: TACheckinPair[]
}

export class TACheckinPair {
  @IsString()
  name!: string

  @IsDate()
  @Type(() => Date)
  checkinTime!: Date

  @IsDate()
  @Type(() => Date)
  checkoutTime?: Date

  @IsBoolean()
  forced!: boolean

  @IsBoolean()
  inProgress!: boolean

  @IsNumber()
  numHelped!: number
}

export enum AlertType {
  REPHRASE_QUESTION = 'rephraseQuestion',
  EVENT_ENDED_CHECKOUT_STAFF = 'eventEndedCheckoutStaff',
  PROMPT_STUDENT_TO_LEAVE_QUEUE = 'promptStudentToLeaveQueue',
}

export class AlertPayload {}

export class Alert {
  @IsEnum(AlertType)
  alertType!: AlertType

  @IsDate()
  sent!: Date

  @Type(() => AlertPayload)
  payload!: AlertPayload

  @IsInt()
  id!: number
}

export class RephraseQuestionPayload extends AlertPayload {
  @IsInt()
  questionId!: number

  @IsInt()
  queueId!: number

  @IsInt()
  courseId!: number
}

export class PromptStudentToLeaveQueuePayload extends AlertPayload {
  queueId!: number
}

export class OrganizationCourseResponse {
  @IsInt()
  id?: number

  @IsInt()
  organizationId?: number

  @IsInt()
  courseId?: number

  course?: GetCourseResponse

  profIds?: number[]
}

export class OrganizationStatsResponse {
  @IsInt()
  members?: number

  @IsInt()
  courses?: number

  @IsInt()
  membersProfessors?: number
}

export class CreateAlertParams {
  @IsEnum(AlertType)
  alertType!: AlertType

  @IsInt()
  courseId!: number

  @IsObject()
  payload!: AlertPayload

  @IsInt()
  targetUserId!: number
}

export class CreateAlertResponse extends Alert {}

export class GetAlertsResponse {
  @Type(() => Alert)
  alerts!: Alert[]
}

// not used anywhere
export class questionTypeParam {
  @IsInt()
  cid!: number

  @IsString()
  @IsOptional()
  name!: string

  @IsInt()
  @IsOptional()
  queueId?: number
}

// not used anywhere
export class questionTypeResponse {
  @Type(() => questionTypeParam)
  questions!: questionTypeParam[]
}

export class AccountRegistrationParams {
  @IsString()
  firstName!: string

  @IsString()
  lastName!: string

  @IsString()
  email!: string

  @IsString()
  password!: string

  @IsString()
  confirmPassword!: string

  @IsNumber()
  organizationId!: number

  @IsNumber()
  @IsOptional()
  sid?: number

  @IsString()
  recaptchaToken!: string
}

export class EditCourseInfoParams {
  @IsNumber()
  courseId?: number

  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  coordinator_email?: string

  @IsString()
  @IsOptional()
  icalURL?: string

  @IsString()
  @IsOptional()
  zoomLink?: string

  @IsString()
  @IsOptional()
  timezone?: string

  @IsOptional()
  enabled?: boolean

  @IsString()
  @IsOptional()
  questionTimer?: number

  @IsArray()
  @IsOptional()
  asyncQuestionDisplayTypes?: string[]

  @IsString()
  @IsOptional()
  courseInviteCode?: string | null
}

export enum antdTagColor {
  blue = 'blue',
  gold = 'gold',
  green = 'green',
  purple = 'purple',
  red = 'red',
  orange = 'orange',
  yellow = 'yellow',
  lime = 'lime',
  cyan = 'cyan',
  geekblue = 'geekblue',
  magenta = 'magenta',
  volcano = 'volcano',
  blueInverse = 'blue-inverse',
  goldInverse = 'gold-inverse',
  greenInverse = 'green-inverse',
  purpleInverse = 'purple-inverse',
  redInverse = 'red-inverse',
  orangeInverse = 'orange-inverse',
  yellowInverse = 'yellow-inverse',
  limeInverse = 'lime-inverse',
  cyanInverse = 'cyan-inverse',
  geekblueInverse = 'geekblue-inverse',
  magentaInverse = 'magenta-inverse',
  volcanoInverse = 'volcano-inverse',
  success = 'success',
  processing = 'processing',
  error = 'error',
  default = 'default',
  warning = 'warning',
}

export class SemesterPartial {
  @IsOptional()
  @IsInt()
  id?: number

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  startDate!: Date

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  endDate!: Date

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(antdTagColor)
  color!: antdTagColor
}

export class SSEQueueResponse {
  queue?: GetQueueResponse
  queueQuestions?: ListQuestionsResponse
  queueChats?: QueueChatPartial[] // just the metadata for the chats, not the messages
}

export class SSEQueueChatResponse {
  queueChat?: GetQueueChatResponse
}

export const InsightCategories = [
  'Dashboard',
  'Tool_Usage_Statistics',
  'Questions',
  'Queues',
  'Chatbot',
  'Staff',
]

export enum InsightType {
  Value = 'Value',
  Chart = 'Chart',
  Table = 'Table',
  GanttChart = 'GanttChart',
  MultipleGanttChart = 'MultipleGanttChart',
}

export type InsightCategory = (typeof InsightCategories)[number]

export type InsightSerial = {
  active?: boolean
  category: InsightCategory
  type: InsightType
}

export type InsightDetail = { [key: string]: InsightSerial }

export type InsightDashboardPartial = {
  name: string
  insights: InsightDetail
}

export type GetInsightOutputResponse = InsightOutput

export type ListInsightsResponse = Record<string, InsightDisplayInfo>

export const InsightFilterOptions = [
  'courseId',
  'timeframe',
  'students',
  'queues',
  'staff',
] as const
export type InsightFilterOption = (typeof InsightFilterOptions)[number]

export type InsightDisplayInfo = {
  displayName: string
  description: string
  insightType: InsightType
  insightCategory: InsightCategory
  allowedFilters?: InsightFilterOption[]
}

export interface InsightObject {
  displayName: string
  description: string
  roles: Role[]
  insightType: InsightType
  insightCategory: InsightCategory
  allowedFilters?: InsightFilterOption[]
  compute: ({
    insightFilters,
    cacheManager,
  }: {
    insightFilters: any
    cacheManager: Cache
  }) => Promise<PossibleOutputTypes>
}

export interface InsightOutput {
  title: string
  description: string
  allowedFilters?: string[]
  outputType: InsightType
  output: PossibleOutputTypes
}

export function numToWeekday(num: number) {
  num = parseInt(num as unknown as string)
  switch (num) {
    case 0:
      return 'Sunday'
    case 1:
      return 'Monday'
    case 2:
      return 'Tuesday'
    case 3:
      return 'Wednesday'
    case 4:
      return 'Thursday'
    case 5:
      return 'Friday'
    case 6:
      return 'Saturday'
    default:
      return ''
  }
}

export type PossibleOutputTypes =
  | ValueOutputType
  | ChartOutputType
  | TableOutputType
  | GanttChartOutputType
  | MultipleGanttChartOutputType

export type ChartOutputType = {
  data: StringMap<any>[]
  xKey: string
  yKeys: string[]
  label: string
  xType?: 'numeric' | 'category'
  yType?: 'numeric' | 'category'
  yFills?: StringMap<string>
}

export type GanttChartOutputType = {
  data: StringMap<any>[]
  xKey: string
  yKey: string
  zKey?: string
  label: string
  numCategories: number
}

export type MultipleGanttChartOutputType = GanttChartOutputType[]

export type ValueOutputType = number | string

export type TableOutputType = {
  data: StringMap<string>[]
  headerRow: string[]
}

export type StringMap<T> = {
  [key: string]: T
}

export type DateRangeType = {
  start: string
  end: string
}

export type InsightParamsType = {
  start?: string
  end?: string
  limit?: number
  offset?: number
  students?: string
  queues?: string
  staff?: string
}

export type sendEmailParams = {
  receiver: string
  subject: string
  type: MailServiceType
  content?: string
}

export type MailServiceWithSubscription = {
  id: number
  mailType: OrganizationRole
  name: string
  isSubscribed: boolean
}

export type UserMailSubscription = {
  serviceId: number
  userId: number
  isSubscribed: boolean
}

export class CourseSettingsResponse {
  @IsInt()
  courseId!: number

  @IsBoolean()
  chatBotEnabled!: boolean

  @IsBoolean()
  asyncQueueEnabled!: boolean

  @IsBoolean()
  adsEnabled!: boolean

  @IsBoolean()
  queueEnabled!: boolean

  @IsBoolean()
  scheduleOnFrontPage!: boolean

  @IsBoolean()
  asyncCentreAIAnswers!: boolean

  @IsBoolean()
  asyncCentreDefaultAnonymous!: boolean

  @IsBoolean()
  asyncCentreAuthorPublic!: boolean

  @IsOptional()
  @IsBoolean()
  settingsFound?: boolean = true //this is mostly just for debugging purposes by viewing network responses

  constructor(init?: Partial<CourseSettingsResponse>) {
    Object.assign(this, init)
  }
}

export const validFeatures = [
  'chatBotEnabled',
  'asyncQueueEnabled',
  'adsEnabled',
  'queueEnabled',
  'scheduleOnFrontPage',
  'asyncCentreAIAnswers',
  'asyncCentreDefaultAnonymous',
  'asyncCentreAuthorPublic',
]

export class CourseSettingsRequestBody {
  @IsBoolean()
  value!: boolean

  @IsIn(validFeatures)
  feature!: string

  static isValidFeature(feature: string): boolean {
    return validFeatures.includes(feature)
  }
}

export class OrganizationSettingsResponse {
  @IsInt()
  organizationId!: number

  @IsBoolean()
  allowProfCourseCreate!: boolean

  @IsOptional()
  @IsBoolean()
  settingsFound?: boolean

  constructor(init?: Partial<OrganizationSettingsResponse>) {
    Object.assign(this, init)
  }
}

export const validOrganizationSettings = ['allowProfCourseCreate']

export const OrganizationSettingsDefaults = {
  allowProfCourseCreate: true,
}

export class OrganizationSettingsRequestBody {
  @IsBoolean()
  value!: boolean

  @IsIn(validOrganizationSettings)
  setting!: string

  static isValidSetting(setting: string): boolean {
    return validOrganizationSettings.includes(setting)
  }
}

export enum OrgRoleChangeReason {
  manualModification = 'manualModification',
  joinedOrganizationMember = 'joinedOrganizationMember',
  joinedOrganizationProfessor = 'joinedOrganizationProfessor',
  unknown = 'unknown',
}

export enum OrgRoleChangeReasonMap {
  manualModification = 'Role was manually modified by an organization member with sufficient permissions.',
  joinedOrganizationMember = 'User joined the organization and gained the member role.',
  joinedOrganizationProfessor = 'User joined the organization and gained the professor role.',
  unknown = '',
}

export class OrgRoleHistory {
  @IsNumber()
  id!: number

  @IsDate()
  timestamp!: Date

  @IsEnum(OrganizationRole)
  fromRole!: OrganizationRole

  @IsEnum(OrganizationRole)
  toRole!: OrganizationRole

  @IsObject()
  byUser!: OrgUser

  @IsObject()
  toUser!: OrgUser

  changeReason!: string
}

export class OrganizationRoleHistoryFilter {
  @IsString()
  @IsOptional()
  search?: string

  @IsEnum(OrganizationRole)
  @IsOptional()
  fromRole?: OrganizationRole

  @IsEnum(OrganizationRole)
  @IsOptional()
  toRole?: OrganizationRole

  @IsDate()
  @IsOptional()
  minDate?: Date

  @IsDate()
  @IsOptional()
  maxDate?: Date

  constructor(init?: Partial<OrganizationRoleHistoryFilter>) {
    Object.assign(this, init)
  }
}

export type OrganizationRoleHistoryResponse = {
  totalHistory: number
  history: OrgRoleHistory[]
}

/**
 * used to display what question types were created/deleted/updated from editing the queue
 */
export interface setQueueConfigResponse {
  questionTypeMessages: string[]
}

export type CronJob = {
  id: string
  cronTime: string | Date
  running: boolean
  nextDates: Date[]
  lastDate?: Date
  lastExecution?: Date
  runOnce: boolean
}

/**
 * This is the queue config that stores settings that the TA can set/edit for the queue.
 * NOTE: tags (aka questionTypes) in this are NOT necessarily going to be the same as the questionType entities for the queue (or at least for now).
 * Therefore, when building front-end components, map over all the questionType entities and NOT all the tags in the queue config
 */
export interface QueueConfig {
  fifo_queue_view_enabled?: boolean
  tag_groups_queue_view_enabled?: boolean
  default_view?: 'fifo' | 'tag_groups'
  minimum_tags?: number
  tags?: {
    [tagKey: string]: {
      display_name: string
      color_hex: string
    }
  }
  assignment_id?: string
  tasks?: ConfigTasks
}

/**
 *
 * Essentially this:
 * ```
 * {
 *   "task1": {
 *       "display_name": "Task 1",
 *       "short_display_name": "1",
 *       "blocking": false,
 *       "color_hex": "#ffedb8",
 *       "precondition": null
 *   },
 *   "task2": {
 *       "display_name": "Task 2",
 *       "short_display_name": "2",
 *       "blocking": false,
 *       "color_hex": "#fadf8e",
 *       "precondition": "task1"
 *   },
 *   "task3": {
 *       "display_name": "Task 3",
 *       "short_display_name": "3",
 *       "blocking": true,
 *       "color_hex": "#f7ce52",
 *       "precondition": "task2"
 *   }
 * }
 * ```
 */
export interface ConfigTasks {
  [taskKey: string]: {
    display_name: string
    short_display_name: string
    blocking?: boolean
    color_hex: string
    precondition: string | null
  }
}

/**
 * Essentially this:
 * ```
 * {
 *   "task1": { "isDone": true },
 *   "task2": { "isDone": false }, <- not guaranteed for all tasks to be here
 *   "task3": { "isDone": false },
 * }
 * ```
 */
export interface StudentAssignmentProgress {
  [taskKey: string]: {
    isDone: boolean
  } | null
}

/**
 * Essentially this:
 * ```
 * {
 *     "lab1": {
 *         "lastEditedQueueId": 2,
 *         "assignmentProgress": {
 *             "task1": { "isDone": true },
 *             "task2": { "isDone": true },
 *             "task3": { "isDone": true }
 *         }
 *     },
 *     "lab2": {
 *         "lastEditedQueueId": 1,
 *         "assignmentProgress": {
 *             "task1": { "isDone": true },
 *             "task2": { "isDone": false }
 *         }
 *     }
 * }
 * ```
 */
export interface StudentTaskProgress {
  [assignmentKey: string]: {
    lastEditedQueueId: number
    assignmentProgress: StudentAssignmentProgress
  }
}

export interface StudentTaskProgressWithUser {
  userDetails: UserPartial
  taskProgress: StudentTaskProgress
}

export interface AssignmentProgressWithUser {
  userDetails: UserPartial
  assignmentProgress: StudentAssignmentProgress
}

export interface AllStudentAssignmentProgress {
  [userId: number]: AssignmentProgressWithUser
}

/**
 * Parses the task ids from the question text.
 * @param questionText question text (comes in as `Mark "part1" "part2"`)
 * @returns an array of task ids (e.g. ["part1", "part2"])
 */
export function parseTaskIdsFromQuestionText(
  questionText: string | undefined,
): string[] {
  return questionText?.match(/"(.*?)"/g)?.map((task) => task.slice(1, -1)) || []
}

/**
 * This function is used both on the backend and frontend to check if there are any errors (total is 24 different errors) in the queue config.
 *
 * Returns an empty string if there's no errors
 */
export function validateQueueConfigInput(obj: any): string {
  //
  // first manual check the JSON
  //
  const MAX_JSON_SIZE = 10240 // 10KB
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  const validAttributes = [
    'fifo_queue_view_enabled',
    'tag_groups_queue_view_enabled',
    'default_view',
    'minimum_tags',
    'tags',
    'assignment_id',
    'tasks',
  ]
  const validTagAttributes = ['display_name', 'color_hex']
  const validTaskAttributes = [
    'display_name',
    'short_display_name',
    'blocking',
    'color_hex',
    'precondition',
  ]

  if (!obj) {
    return 'Queue config is null or undefined'
  }
  if (typeof obj !== 'object') {
    return 'Queue config must be an object'
  }
  if (
    obj.fifo_queue_view_enabled !== undefined &&
    typeof obj.fifo_queue_view_enabled !== 'boolean'
  ) {
    return 'fifo_queue_view_enabled must be a boolean'
  }
  if (
    obj.tag_groups_queue_view_enabled !== undefined &&
    typeof obj.tag_groups_queue_view_enabled !== 'boolean'
  ) {
    return 'tag_groups_queue_view_enabled must be a boolean'
  }
  if (
    obj.fifo_queue_view_enabled === false &&
    obj.tag_groups_queue_view_enabled === false
  ) {
    return 'At least one of fifo_queue_view_enabled and tag_groups_queue_view_enabled must be enabled'
  }
  if (obj.fifo_queue_view_enabled === false && obj.default_view === 'fifo') {
    return 'default_view cannot be fifo if the fifo view is disabled'
  }
  if (
    obj.tag_groups_queue_view_enabled === false &&
    obj.default_view === 'tag_groups'
  ) {
    return 'default_view cannot be tag_groups if tag groups view is disabled'
  }
  if (
    obj.default_view !== undefined &&
    !['fifo', 'tag_groups'].includes(obj.default_view)
  ) {
    return "default_view must be 'fifo' or 'tag_groups'"
  }
  if (obj.minimum_tags !== undefined && typeof obj.minimum_tags !== 'number') {
    return 'minimum_tags must be a number'
  }
  if (obj.tags !== undefined) {
    if (typeof obj.tags !== 'object') {
      return 'tags must be an object'
    }
    // checks for each tag
    for (const tagKey in obj.tags) {
      if (
        !obj.tags[tagKey].display_name ||
        typeof obj.tags[tagKey].display_name !== 'string'
      ) {
        return `Tag ${tagKey} must have a display_name of type string`
      }
      if (
        !obj.tags[tagKey].color_hex ||
        typeof obj.tags[tagKey].color_hex !== 'string' ||
        !hexColorRegex.test(obj.tags[tagKey].color_hex)
      ) {
        return `Tag ${tagKey} must have a valid color_hex (e.g. #A23F31) of type string`
      }
      for (const key in obj.tags[tagKey]) {
        if (!validTagAttributes.includes(key)) {
          return `Unknown attribute "${key}" in tag "${tagKey}"`
        }
      }
    }
    // no duplicate tag display names
    const tagDisplayNames = Object.values(obj.tags).map(
      (tag: any) => tag.display_name,
    )
    if (tagDisplayNames.length !== new Set(tagDisplayNames).size) {
      const duplicateDisplayName = tagDisplayNames.find(
        (item, index, arr) => arr.indexOf(item) !== index,
      )
      return `Tag display names must be unique. Duplicate display name found: "${duplicateDisplayName}"`
    }
  }
  if (obj.assignment_id !== undefined) {
    if (typeof obj.assignment_id !== 'string') {
      return 'assignment_id must be a string'
    }
    if (obj.assignment_id.includes(' ')) {
      return 'assignment_id must not contain spaces'
    }
  }
  if (obj.tasks !== undefined) {
    if (typeof obj.tasks !== 'object') {
      return 'tasks must be an object'
    }
    // checks for each task
    for (const taskKey in obj.tasks) {
      if (taskKey.includes(' ')) {
        return `Task key ${taskKey} must not contain spaces`
      }
      if (
        !obj.tasks[taskKey].display_name ||
        typeof obj.tasks[taskKey].display_name !== 'string'
      ) {
        return `Task ${taskKey} must have a display_name of type string`
      }
      if (
        !obj.tasks[taskKey].short_display_name ||
        typeof obj.tasks[taskKey].short_display_name !== 'string'
      ) {
        return `Task ${taskKey} must have a short_display_name of type string`
      }
      if (
        obj.tasks[taskKey].blocking !== undefined &&
        typeof obj.tasks[taskKey].blocking !== 'boolean'
      ) {
        return `Task ${taskKey} blocking must be a boolean`
      }
      if (
        !obj.tasks[taskKey].color_hex ||
        typeof obj.tasks[taskKey].color_hex !== 'string' ||
        !hexColorRegex.test(obj.tasks[taskKey].color_hex)
      ) {
        return `Task ${taskKey} must have a valid color_hex (e.g. "#ff0000")`
      }
      if (
        obj.tasks[taskKey].precondition === undefined ||
        (obj.tasks[taskKey].precondition !== null &&
          !(obj.tasks[taskKey].precondition in obj.tasks))
      ) {
        return `Task ${taskKey} precondition must be null or the key of another task`
      }
      for (const key in obj.tasks[taskKey]) {
        if (!validTaskAttributes.includes(key)) {
          return `Unknown attribute "${key}" in task "${taskKey}"`
        }
      }
    }
  }
  if (obj.tasks !== undefined && obj.assignment_id === undefined) {
    return 'Config also needs an assignment_id field if tasks are defined'
  }
  if (obj.assignment_id !== undefined && obj.tasks === undefined) {
    return 'Config also needs a tasks field if assignment_id is defined'
  }
  for (const key in obj) {
    if (!validAttributes.includes(key)) {
      return `Unknown attribute "${key}"`
    }
  }
  if (new TextEncoder().encode(JSON.stringify(obj)).length > MAX_JSON_SIZE) {
    return 'The JSON object is too large. Maximum size is 10KB.'
  }
  //
  // then validate the json with ajv (in case the above checks don't catch everything)
  //
  const ajv = new Ajv()
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      fifo_queue_view_enabled: { type: 'boolean' },
      tag_groups_queue_view_enabled: { type: 'boolean' },
      default_view: { enum: ['fifo', 'tag_groups'] },
      minimum_tags: { type: 'number' },
      tags: {
        type: 'object',
        patternProperties: {
          '^[^ ]+$': {
            type: 'object',
            properties: {
              display_name: { type: 'string' },
              color_hex: {
                type: 'string',
                pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
              },
            },
            required: ['display_name', 'color_hex'],
            additionalProperties: false,
          },
        },
      },
      assignment_id: { type: 'string', pattern: '^[^ ]*$' },
      tasks: {
        type: 'object',
        patternProperties: {
          '^[^ ]+$': {
            type: 'object',
            properties: {
              display_name: { type: 'string' },
              short_display_name: { type: 'string' },
              blocking: { type: 'boolean' },
              color_hex: {
                type: 'string',
                pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
              },
              precondition: { type: ['string', 'null'] },
            },
            required: [
              'display_name',
              'short_display_name',
              'color_hex',
              'precondition',
            ],
            additionalProperties: false,
          },
        },
      },
    },
    required: [],
    additionalProperties: false,
  }
  const validate = ajv.compile(schema)
  const valid = validate(obj)
  if (!valid) {
    return (
      validate.errors
        ?.map((e) => `${e.instancePath} ${e.message}`)
        .join(', ') || 'Unknown error'
    )
  }
  return ''
}

/**
 * Detects if there are cycles in the tasks and returns true if there are.
 *
 * Used in both frontend and backend
 */
export function isCycleInTasks(
  tasks: ConfigTasks,
  taskKey?: string,
  visited: string[] = [],
  currentlyVisiting: string[] = [],
): boolean {
  // If no taskKey is provided, get the first key from the tasks object
  if (!taskKey) {
    const keys = Object.keys(tasks)
    if (keys.length === 0) {
      return false // No tasks to check
    }
    taskKey = keys[0] // Pick the first task
  }

  if (currentlyVisiting.includes(taskKey)) {
    return true // Cycle detected
  }

  if (visited.includes(taskKey)) {
    return false // Already checked this task
  }

  currentlyVisiting.push(taskKey) // Mark this task as currently visiting
  visited.push(taskKey) // Mark this task as visited

  const task = tasks[taskKey]

  // Check precondition if it exists
  if (task.precondition !== null) {
    const hasCycle = isCycleInTasks(
      tasks,
      task.precondition,
      visited,
      currentlyVisiting,
    )
    if (hasCycle) {
      return true // Propagate cycle detection result up
    }
  }

  currentlyVisiting.pop() // Unmark this task from currently visiting
  return false // No cycle found
}

/**
 * note: this "Task" is only for frontend components (TaskSelector, TaskDeletionSelector, and in Queue)
 */
export interface Task {
  taskId: string
  isDone?: boolean
  checked?: boolean
  display_name: string
  short_display_name: string
  color_hex: string
  blocking?: boolean
  precondition?: Task | null
  [key: string]: any // Tasks can have any number of additional properties (for expandability, might remove later)
}

/**
 * Also only used in frontend components
 */
export interface TaskTree {
  [taskId: string]: Task
}

export type ConfigTasksWithAssignmentProgress = {
  [K in keyof ConfigTasks]: ConfigTasks[K] & { isDone?: boolean }
}

/**
 * Transforms a configuration object of tasks into a tree structure where each task has a reference to its prerequisite task.
 * This enables the implementation of task dependencies in the UI. Note that this function mutates the `remainingTasks` object.
 *
 * @param {Object} remainingTasks - The configTasks object to be transformed
 *
 * Example input (`remainingTasks`):
 * ```
 * {
 *   "task1": {
 *     ...
 *     "precondition": null
 *   },
 *   "task2": {
 *     ...
 *     "precondition": "task1"
 *   },
 *   "task3": {
 *     ...
 *     "precondition": "task2"
 *   }
 * }
 * ```
 *
 * Example output (transformed `remainingTasks`):
 * ```
 * {
 *   "task1": {
 *     ...
 *     precondition: null
 *   },
 *   "task2": {
 *     ...
 *     precondition: [Object reference to task1]
 *   },
 *   "task3": {
 *     ...
 *     precondition: [Object reference to task2]
 *   }
 * }
 * ```
 * @param taskTree
 * @param precondition
 */
export function transformIntoTaskTree(
  remainingTasks: ConfigTasksWithAssignmentProgress,
  taskTree: TaskTree = {},
  precondition: string | null = null,
): TaskTree {
  // Object.entries is like a fancy for loop. Filter is a function that takes in a subfunction; if the subfunction returns false, the element is removed from the array.
  const tasksToAdd = Object.entries(remainingTasks).filter(
    ([, taskValue]) => taskValue.precondition === precondition,
  )

  tasksToAdd.forEach(([taskKey, taskValue]) => {
    taskTree[taskKey] = {
      ...taskValue,
      taskId: taskKey,
      checked: false,
      precondition:
        precondition && !taskValue.isDone && !taskTree[precondition].isDone
          ? taskTree[precondition]
          : null,
    }

    // Now that the task has been added to the tree, we can remove the task from the remainingTasks so that it doesn't keep getting cycled through (optimization)
    delete remainingTasks[taskKey]

    // Merge the current taskTree with the taskTree created from the recursive call
    Object.assign(
      taskTree,
      transformIntoTaskTree(remainingTasks, taskTree, taskKey),
    )
  })

  return taskTree
}

export function generateTagIdFromName(name: string): string {
  // Sanitize the name by removing illegal characters
  const sanitized = name.replace(/[\{\}"\:\,]/g, '')

  // Generate a couple of random digits
  const randomDigits = Math.floor(Math.random() * 100) // Generates a number between 0 and 99

  // Append the random digits to the sanitized name (to prevent the edge case where two tags have different names but the same tag ids)
  return `${sanitized}_${randomDigits}`
}

export function encodeBase64(str: string) {
  return Buffer.from(str, 'utf-8').toString('base64')
}

export function decodeBase64(str: string) {
  return Buffer.from(str, 'base64').toString('utf-8')
}

// TODO: Delete these old pfp colours on a new semester. They are only left here so that people's current colour won't randomly change
export const classicPFPColours = [
  '#1abc9c',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#34495e',
  '#16a085',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
  '#2c3e50',
  '#f1c40f',
  '#e67e22',
  '#e74c3c',
  '#95a5a6',
  '#f39c12',
  '#d35400',
  '#c0392b',
  '#bdc3c7',
  '#7f8c8d',
]

// colours pallet extended with names courtesy of o1
const extendedPFPColours = [
  '#1abc9c', // Turquoise
  '#2ecc71', // Emerald
  '#3498db', // Peter River
  '#9b59b6', // Amethyst
  '#34495e', // Wet Asphalt
  '#16a085', // Green Sea
  '#27ae60', // Nephritis
  '#2980b9', // Belize Hole
  '#8e44ad', // Wisteria
  '#2c3e50', // Midnight Blue
  '#f1c40f', // Sun Flower
  '#e67e22', // Carrot
  '#e74c3c', // Alizarin
  '#95a5a6', // Concrete
  '#f39c12', // Orange
  '#d35400', // Pumpkin
  '#c0392b', // Pomegranate
  '#bdc3c7', // Silver
  '#7f8c8d', // Asbestos
  '#6C3483', // Dark Purple
  '#154360', // Deep Navy
  '#7D6608', // Dark Gold
  '#6E2C00', // Brown
  '#4A235A', // Purple
  '#512E5F', // Grape
  '#4D5656', // Slate Gray
  '#5D6D7E', // Grayish Blue
  '#2E4053', // Grayish Navy
  '#78281F', // Dark Red
  '#9C640C', // Dark Ochre
  '#145A32', // Forest Green
  '#21618C', // Steel Blue
  '#9B1B1B', // Maroon
  '#7A613E', // Cocoa
  '#5B2C6F', // Dark Orchid
  '#1B4F72', // Navy Teal
  '#873600', // Burnt Orange
  '#7B241C', // Earth Red
  '#943126', // Redwood
  '#239B56', // Jade
  '#17202A', // Carbon
  '#1F618D', // Dusk Blue
  '#2E86C1', // Cerulean
  '#85C1E9', // Light Cerulean
  '#F5B041', // Light Orange
  '#B7950B', // Mustard
  '#7E5109', // Toffee
  '#A93226', // Crimson
  '#5A2E2E', // Ruby Brown
  '#0097A7', // Dark Teal
]

export function nameToRGB(
  str: string,
  colors: string[] = extendedPFPColours,
): string {
  if (!str) {
    throw new Error('Input string cannot be empty')
  }

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length]
}

export type UnreadAsyncQuestionResponse = {
  count: number
}

export enum LMSIntegrationPlatform {
  None = 'None',
  Canvas = 'Canvas',
}

export function parseThinkBlock(answer: string) {
  // Look for <think>...</think> (the "s" flag lets it match across multiple lines)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/
  const match = answer.match(thinkRegex)

  if (!match) {
    // No <think> block, return the text unchanged
    return { thinkText: null, cleanAnswer: answer }
  }

  const thinkText = match[1].trim()
  const cleanAnswer = answer.replace(thinkRegex, '').trim()

  return { thinkText, cleanAnswer }
}

export const ERROR_MESSAGES = {
  common: {
    pageOutOfBounds: "Can't retrieve out of bounds page.",
  },
  questionService: {
    getDBClient: 'Error getting DB client',
    queueChatUpdateFailure: 'Error updating queue chat',
  },
  calendarEvent: {
    invalidEvent:
      'Invalid calendar event: Events must either have daysOfWeek.length > 0 and startDate and endDate or have daysOfWeek.length === 0 and startDate and endDate are both null',
    dateInPast:
      'Event date is in the past. No AutoCheckout will occur. Please unassign staff from event.',
    invalidRecurringEvent: 'Recurring events must have a start and end date',
  },
  organizationController: {
    notEnoughDiskSpace: 'Not enough disk space to upload file',
    userAlreadyInOrganization: 'User is already in organization',
    courseAlreadyInOrganization: 'Course is already in organization',
    organizationNotFound: 'Organization not found',
    organizationNameTooShort: 'Organization name must be at least 3 characters',
    noFileUploaded: 'No file uploaded',
    organizationDescriptionTooShort:
      'Organization description must be at least 10 characters',
    organizationUrlTooShortOrInValid:
      'Organization URL must be at least 4 characters and be a valid URL',
    userNotFoundInOrganization: 'User not found in organization',
    cannotRemoveAdminRole: 'Cannot remove admin role from user',
    cannotGetAdminUser: 'Information about this user account is restricted',
    notAllowedToCreateCourse: (role: OrganizationRole) =>
      `Members with role ${role} are not allowed to create courses`,
  },
  organizationService: {
    cannotCreateOrgNotFound:
      'Organization settings could not be created; organization not found.',
  },
  courseController: {
    checkIn: {
      cannotCheckIntoMultipleQueues:
        'Cannot check into multiple queues at the same time',
    },
    queueLimitReached: 'Queue limit per course reached',
    roleInvalid: 'Role must be a valid role',
    semesterYearInvalid: 'Semester year must be a valid year',
    semesterNameFormat:
      'Semester must be in the format "season,year". E.g. Fall,2021',
    semesterNameTooShort: 'Semester name must be at least 2 characters',
    invalidInviteCode: 'Invalid invite code',
    semesterNotFound: 'Semester not found',
    courseNameTooShort: 'Course name must be at least 1 character',
    coordinatorEmailTooShort: 'Coordinator email must be at least 1 character',
    sectionGroupNameTooShort: 'Section group name must be at least 1 character',
    courseAlreadyRegistered: 'One or more of the courses is already registered',
    courseNotFound: 'The course was not found',
    sectionGroupNotFound: 'One or more of the section groups was not found',
    courseOfficeHourError: "Unable to find a course's office hours",
    courseHeatMapError: "Unable to get course's cached heatmap",
    courseModelError: 'User not in course',
    noUserFound: 'No user found with given email',
    noSemesterFound: 'No semester exists for the submitted course',
    updatedQueueError: 'Error updating a course queue',
    queuesNotFound: 'Queues not found',
    queueNotFound: 'Queue not found',
    queueAlreadyExists: 'Queue already exists.',
    queueNotAuthorized: 'Unable to join this professor queue as a TA',
    saveQueueError: 'Unable to save queue',
    clearQueueError: 'Unable to determine if queue can be cleared',
    createEventError: 'An error occurred while creating an event',
    icalCalendarUpdate: 'Unable to update calendar',
    checkInTime: 'Unable to get TA check in times',
    removeCourse: 'Error occurred while trying to remove a course',
    createCourse: 'Error occurred while trying to create a course',
    updateCourse: 'Error occurred while trying to update a course',
    createCourseMappings: 'Unable to create a course mappings',
    updateProfLastRegistered:
      "Unable to update professor's last registered semester",
    invalidApplyURL:
      'You are unauthorized to submit an application. Please email help@khouryofficehours.com for the correct URL.',
    crnAlreadyRegistered: (crn: number, courseId: number): string =>
      `The CRN ${crn} already exists for another course with course id ${courseId}`,
    organizationNotFound: 'Course has no related organization',
    orgIntegrationNotFound: 'Course organization has no LMS integrations',
    lmsIntegrationNotFound: 'Course has no related LMS integrations',
    newSectionOrSemesterMissing:
      'One of semester or section fields must be set',
    sectionSame:
      'The section you set for the clone is the same as the original course. Clone process aborted.',
    semesterSame:
      'The semester you set for the clone is the same as the original course. Clone process aborted.',
  },
  asyncQuestionController: {
    comments: {
      commentNotFound: 'Comment not found',
      forbiddenUpdate: 'Only you can update your own comment',
      forbiddenDelete: 'Only you can delete your own comment (or staff)',
    },
  },
  questionController: {
    createQuestion: {
      invalidQueue: 'Posted to an invalid queue',
      noNewQuestions: 'Queue not allowing new questions',
      closedQueue: 'Queue is closed',
      oneQuestionAtATime: "You can't create more than one question at a time.",
      oneDemoAtATime: "You can't create more than one demo at a time.",
      invalidQuestionType: 'Invalid question type',
    },
    updateQuestion: {
      fsmViolation: (
        role: string,
        questionStatus: string,
        bodyStatus: string,
      ): string =>
        `${role} cannot change status from ${questionStatus} to ${bodyStatus}`,
      taOnlyEditQuestionStatus:
        'TA/Professors can only edit question status, text, and tags',
      otherTAHelping: 'Another TA is currently helping with this question',
      otherTAResolved: 'Another TA has already resolved this question',
      taHelpingOther: 'TA is already helping someone else',
      loginUserCantEdit: 'Logged-in user does not have edit access',
    },
    studentTaskProgress: {
      invalidAssignmentName:
        'No assignment name set. Please set an assignment name in the queue config.',
      invalidTaskName: (taskid: string): string =>
        `Task ${taskid} does not exist in this queue.`,
      queueDoesNotExist: 'Queue does not exist',
      configDoesNotExist: 'Queue config does not exist',
      assignmentDoesNotExist: 'Assignment does not exist',
      notTaskQuestion: 'Question is not a task question',
      taskParseError: 'No tasks parsed',
      taskNotInConfig: 'Task does not exist in the config',
    },
    groupQuestions: {
      notGroupable: 'One or more of the questions is not groupable',
    },
    saveQError: 'Unable to save a question',
    deleteQError: 'Unable to delete a question',
    notFound: 'Question not found',
    unableToNotifyUser: 'Unable to notify user',
  },
  loginController: {
    receiveDataFromKhoury: 'Invalid request signature',
    invalidPayload: 'The decoded JWT payload is invalid',
    invalidTempJWTToken: 'Error occurred while signing a JWT token',
    addUserFromKhoury:
      'Error occurred while translating account from Khoury to Office Hours',
  },
  questionRoleGuard: {
    questionNotFound: 'Question not found',
    queueOfQuestionNotFound: 'Cannot find queue of question',
    queueDoesNotExist: 'This queue does not exist!',
  },
  queueController: {
    getQueue: 'An error occurred while trying to retrieve a Queue',
    getQuestions: 'Unable to get questions from queue',
    saveQueue: 'Unable to save queue',
    cleanQueue: 'Unable to clean queue',
    cannotCloseQueue: 'Unable to close professor queue as a TA',
    missingStaffList: 'Stafflist relation not present on Queue',
    cycleInTasks: 'Cycle detected in task preconditions',
  },
  queueChatsController: {
    chatNotFound: 'Chat not found',
    failureToClearChat: 'Unable to clear chat',
    failureToCreateChat: 'Unable to create chat',
    failureToSendMessage: 'Unable to send message',
    chatNotAuthorized: 'User is not allowed to retrieve requested chat data',
    sendNotAuthorized: 'User is not allowed to send messages to this chat',
    internalSendError: 'Error occurred while sending message',
    chatAlreadyExists: 'Chat already exists',
    staffNotFound: 'This staff member does not exist or is not in this course',
    queueNotFound: 'This queue does not exist',
    questionNotFound: 'This question does not exist or is not in this queue',
    questionNotAuthorized:
      'Students cannot create chats for questions they did not create',
  },
  queueRoleGuard: {
    queueNotFound: 'Queue not found',
  },
  insightsController: {
    dashboardUnauthorized: 'User is not authorized to manage dashboards',
    insightUnathorized: 'User is not authorized to view this insight',
    insightNameNotFound: 'The insight requested was not found',
    insightsDisabled: 'Insights are currently unavailable, sorry :(',
    invalidDateRange: 'Invalid date range. Start and End must be valid dates',
    invalidStudentID:
      'Invalid student ID provided. Student IDs must be numeric',
    invalidQueueID: 'Invalid queue ID provided. Queue IDs must be numeric.',
    invalidStaffID: 'Invalid staff ID provided. Staff IDs must be numeric.',
  },
  roleGuard: {
    notLoggedIn: 'Must be logged in',
    noCourseIdFound: 'No courseId found',
    notInCourse: 'Not In This Course',
    notAuthorized: "You don't have permissions to perform this action",
    userNotInOrganization: 'User not in organization',
    mustBeRoleToAccess: (roles: string[]): string =>
      `You must have one of roles [${roles.join(
        ', ',
      )}] to access this information`,
    mustBeRoleToAccessExtended: (
      courseRoles: string[],
      orgRoles: string[],
    ): string =>
      `You must have one of the Course roles [${courseRoles.join(
        ', ',
      )}] or Organization roles [${orgRoles.join(
        ', ',
      )}] to access this information`,
    mustBeRoleToJoinCourse: (roles: string[]): string =>
      `You must have one of roles [${roles.join(', ')}] to access this course`,
  },
  mailService: {
    mailFailed: 'Mail was not sent to user',
  },
  profileController: {
    emailAlreadyInDb: 'Email already in database',
    sidAlreadyInDb: 'Student ID already in database',
    cannotUpdateEmail: 'Email cannot be updated',
    accountNotAvailable:
      'The user either does not exist or does not have a chat token',
    userResponseNotFound: 'The user response was not found',
    accountDeactivated: 'The user account is deactivated',
    firstNameTooShort: 'First name must be at least 1 characters',
    lastNameTooShort: 'Last name must be at least 1 characters',
    emailTooShort: 'Email must be at least 1 characters',
    sidInvalid: 'Student ID must be a number and greater than 0',
    noProfilePicture: "User doesn't have a profile picture",
    noCoursesToDelete: "User doesn't have any courses to delete",
    emailInUse: 'Email is already in use',
    noDiskSpace:
      'There is no disk space left to store an image. Please immediately contact your course staff and let them know. They will contact the HelpMe team as soon as possible.',
  },
  alertController: {
    duplicateAlert: 'This alert has already been sent',
    notActiveAlert: "This is not an alert that's open for the current user",
    incorrectPayload: 'The payload provided was not of the correct type',
  },
  sseService: {
    getSubClient: 'Unable to get the redis subscriber client',
    getDBClient: 'Unable to get the redis database client',
    getPubClient: 'Unable to get publisher client',
    moduleDestroy: 'Unable to destroy the redis module',
    cleanupConnection: 'Unable to cleanup the connection',
    clientIdSubscribe: 'Client ID not found during subscribing to client',
    subscribe: 'Unable to subscribe to the client',
    unsubscribe: 'Unable to unsubscribe from the client',
    removeFromRoom: 'Error removing from redis room',
    directConnections: 'Unable to cleanup direct connections',
    roomMembers: 'Unable to get room members',
    serialize: 'Unable to serialize payload',
    publish: 'Publisher client is unable to publish',
    clientIdNotFound: 'Client ID not found during subscribing to client',
  },
  resourcesService: {
    noDiskSpace:
      'There is no disk space left to store a iCal file. Please immediately contact your course staff and let them know. They will contact the Khoury Office Hours team as soon as possible.',
    saveCalError: 'There was an error saving an iCal to disk',
  },
  questionType: {
    questionTypeNotFound: 'Question type not found',
  },
  lmsController: {
    noLMSIntegration:
      'The course has no registered LMS integration, or its registered LMS integration is invalid.',
    noAssignmentsSaved:
      'There are no assignments from the course LMS that have been persisted to the database.',
    invalidDocumentType:
      'Failed to upload or delete any LMS documents to/from the chatbot, invalid document type specified.',
    failedToUpload: 'Failed to upload any LMS documents to the chatbot.',
    organizationCourseNotFound: 'Course has no associated organization.',
    orgLmsIntegrationNotFound:
      'Learning Management System integration was not found',
    lmsIntegrationInvalidPlatform: 'The specified API platform was invalid',
    lmsIntegrationUrlRequired: 'Root URL is required for LMS integrations',
    lmsIntegrationProtocolIncluded:
      'Root URL should not include protocol (https/http)',
    orgIntegrationNotFound: 'Course organization has no LMS integrations',
    courseLmsIntegrationNotFound: 'Course has no related LMS integration',
    syncDisabled: 'LMS synchronization has not been enabled.',
    failedToSync: 'Failed to synchronize course with LMS equivalent.',
    failedToSyncOne: 'Failed to synchronize document from LMS equivalent.',
    failedToClear: 'Failed to clear documents from HelpMe database.',
    failedToClearOne: 'Failed to clear document from HelpMe database.',
    lmsDocumentNotFound: 'Document was not found.',
    cannotSyncDocumentWhenSyncDisabled:
      'Cannot synchronize a document when synchronization is disabled.',
    resourceDisabled:
      "The resource type of the document you're trying to operate on is disabled.",
  },
  semesterController: {
    notAllowedToCreateSemester: (role: OrganizationRole) =>
      `Members with role ${role} are not allowed to create semesters`,
    notAllowedToUpdateSemester: (role: OrganizationRole) =>
      `Members with role ${role} are not allowed to alter semesters`,
    notAllowedToDeleteSemester: (role: OrganizationRole) =>
      `Members with role ${role} are not allowed to delete semesters`,
  },
}
