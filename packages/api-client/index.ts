import {
  CreateAlertParams,
  CreateAlertResponse,
  CreateQuestionParams,
  CreateQuestionResponse,
  InsightParamsType,
  DesktopNotifBody,
  DesktopNotifPartial,
  GetAlertsResponse,
  GetCourseResponse,
  GetInsightOutputResponse,
  GetProfileResponse,
  GetQueueResponse,
  GroupQuestionsParams,
  ListInsightsResponse,
  ListQuestionsResponse,
  EditCourseInfoParams,
  SemesterPartial,
  TACheckinTimesResponse,
  TACheckoutResponse,
  TAUpdateStatusResponse,
  UpdateProfileParams,
  UpdateQuestionParams,
  UpdateQuestionResponse,
  UpdateQueueParams,
  QueuePartial,
  Role,
  GetCourseUserInfoResponse,
  questions,
  CreateAsyncQuestions,
  UpdateAsyncQuestions,
  AsyncQuestion,
  Calendar,
  UpdateOrganizationDetailsParams,
  UpdateOrganizationUserRole,
  ChatbotQuestion,
  ChatBotQuestionParams,
  UpdateOrganizationCourseDetailsParams,
  Interaction,
  OrganizationResponse,
  DocumentParams,
  ChatbotDocument,
  GetLimitedCourseResponse,
  GetOrganizationUserResponse,
  OrganizationCourseResponse,
  OrganizationStatsResponse,
  QuestionTypeParams,
  UBCOuserParam,
  CourseSettingsResponse,
  StudentAssignmentProgress,
  QueueConfig,
  AllStudentAssignmentProgress,
  setQueueConfigResponse,
  QuestionTypeType,
  StudentTaskProgressWithUser,
} from '@koh/common'
import Axios, { AxiosInstance, Method } from 'axios'
import { plainToClass } from 'class-transformer'
import { ClassType } from 'class-transformer/ClassTransformer'

// Return type of array item, if T is an array
type ItemIfArray<T> = T extends (infer I)[] ? I : T

export interface ChatQuestion {
  id: string
  question: string
  answer: string
  user: string
  sourceDocuments: {
    name: string
    type: string
    parts: string[]
  }[]
  suggested: boolean
}

export interface ChatQuestionResponse {
  chatQuestions: ChatQuestion[]
  total: number
}

class APIClient {
  private axios: AxiosInstance

  /**
   * Send HTTP and return data, optionally serialized with class-transformer (helpful for Date serialization)
   * @param method HTTP method
   * @param url URL to send req to
   * @param responseClass Class with class-transformer decorators to serialize response to
   * @param body body to send with req
   */
  private async req<T>(
    method: Method,
    url: string,
    responseClass?: ClassType<ItemIfArray<T>>,
    body?: any,
    params?: any,
  ): Promise<T>
  private async req<T>(
    method: Method,
    url: string,
    responseClass?: ClassType<T>,
    body?: any,
    params?: any,
  ): Promise<T> {
    const res = (await this.axios.request({ method, url, data: body, params }))
      .data
    return responseClass ? plainToClass(responseClass, res) : res
  }

  auth = {
    loginWithGoogle: async (
      organizationId: number,
    ): Promise<{ redirectUri: string }> =>
      this.req('GET', `/api/v1/auth/link/google/${organizationId}`, undefined),
  }
  profile = {
    index: async (): Promise<GetProfileResponse> =>
      this.req('GET', `/api/v1/profile`, GetProfileResponse),
    patch: async (body?: UpdateProfileParams): Promise<GetProfileResponse> =>
      this.req('PATCH', `/api/v1/profile`, undefined, body),
    deleteProfilePicture: async (): Promise<void> =>
      this.req('DELETE', `/api/v1/profile/delete_profile_picture`),
    getAllStudents: async (courseId: number): Promise<any> =>
      this.req('GET', `/api/v1/profile/${courseId}/id`, undefined),
    getStudent: async (sid: number): Promise<any> =>
      this.req('GET', `/api/v1/profile/${sid}/student`, undefined),
    inQueue: async (sid: number): Promise<boolean> =>
      this.req('GET', `/api/v1/profile/${sid}/inQueue`, undefined),
  }

  chatbot = {
    createInteraction: async (body: {
      courseId: number
      userId: number
    }): Promise<Interaction> =>
      this.req('POST', `/api/v1/chatbot/interaction`, undefined, body),

    getQuestions: async (
      questionText: string,
      pageSize: number,
      currentPage: number,
      courseId: number,
    ): Promise<ChatQuestionResponse> =>
      this.req(
        'GET',
        `/api/v1/chatbot/question?questionText=${questionText}&pageSize=${pageSize}&currentPage=${currentPage}&cid=${courseId}`,
        undefined,
      ),

    createQuestion: async (
      body: ChatBotQuestionParams,
    ): Promise<ChatbotQuestion> =>
      this.req('POST', `/api/v1/chatbot/question`, undefined, body),

    editQuestion: async (body: {
      data: ChatBotQuestionParams
      questionId: number
    }): Promise<ChatbotQuestion> =>
      this.req('PATCH', `/api/v1/chatbot/question`, undefined, body),

    deleteQuestion: async (
      body: ChatBotQuestionParams,
    ): Promise<ChatbotQuestion> =>
      this.req('DELETE', `/api/v1/chatbot/question`, undefined, body),

    getDocuments: async (
      courseId: number,
      searchText: string,
      pageSize: number,
      currentPage: number,
    ): Promise<ChatQuestionResponse> =>
      this.req(
        'GET',
        `/api/v1/chatbot/${courseId}/document?searchText=${searchText}&pageSize=${pageSize}&currentPage=${currentPage}`,
        undefined,
      ),

    addDocument: async (body: {
      data: DocumentParams
      courseId: number
    }): Promise<ChatbotDocument> =>
      this.req('POST', `/api/v1/chatbot/document`, undefined, body),

    deleteDocument: async (body: {
      documentId: number
    }): Promise<ChatbotDocument> =>
      this.req('DELETE', `/api/v1/chatbot/document`, undefined, body),
  }

  course = {
    addStudent: async (courseId: number, sid: number): Promise<void> =>
      this.req(
        'POST',
        `/api/v1/courses/${courseId}/add_student/${sid}`,
        undefined,
      ),
    enrollByInviteCode: async (student: UBCOuserParam, courseCode: string) =>
      this.req(
        'POST',
        `/api/v1/courses/enroll_by_invite_code/${courseCode}`,
        undefined,
        student,
      ),
    getOrganizationCourses: async (organizationId: number) =>
      this.req('GET', `/api/v1/courses/${organizationId}/organization_courses`),
    getAsyncQuestions: async (cid: number): Promise<AsyncQuestion[]> =>
      this.req('GET', `/api/v1/courses/${cid}/asyncQuestions`, undefined),
    get: async (courseId: number) =>
      this.req('GET', `/api/v1/courses/${courseId}`, GetCourseResponse),
    getUserInfo: async (
      courseId: number,
      page: number,
      role?: Role,
      search?: string,
    ): Promise<GetCourseUserInfoResponse> =>
      this.req(
        'GET',
        `/api/v1/courses/${courseId}/get_user_info/${page}/${role}${
          search ? `?search=${search}` : ''
        }`,
      ),
    withdrawCourse: async (courseId: number): Promise<void> =>
      this.req(
        'DELETE',
        `/api/v1/courses/${courseId}/withdraw_course`,
        undefined,
      ),
    editCourseInfo: async (
      courseId: number,
      params: EditCourseInfoParams,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/courses/${courseId}/edit_course`,
        undefined,
        params,
      ),
    getTACheckinTimes: async (
      courseId: number,
      startDate: string,
      endDate: string,
    ): Promise<TACheckinTimesResponse> =>
      this.req(
        'GET',
        `/api/v1/courses/${courseId}/ta_check_in_times`,
        TACheckinTimesResponse,
        {},
        { startDate, endDate },
      ),
    getLimitedCourseResponse: async (
      courseId: number,
      code: string,
    ): Promise<GetLimitedCourseResponse> =>
      this.req(
        'GET',
        `/api/v1/courses/limited/${courseId}/${code}`,
        GetLimitedCourseResponse,
      ),
    updateUserRole: async (
      courseId: number,
      userId: number,
      role: string,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/courses/${courseId}/update_user_role/${userId}/${role}`,
      ),
    setCourseFeature: async (
      courseId: number,
      feature: string,
      value: boolean,
    ): Promise<void> =>
      this.req('PATCH', `/api/v1/courses/${courseId}/features`, undefined, {
        feature,
        value,
      }),
    getCourseFeatures: async (
      courseId: number,
    ): Promise<CourseSettingsResponse> =>
      this.req('GET', `/api/v1/courses/${courseId}/features`),
  }
  studentTaskProgress = {
    getAssignmentProgress: async (
      userId: number,
      courseId: number,
      assignmentName: string,
    ): Promise<StudentAssignmentProgress> =>
      this.req(
        'GET',
        `/api/v1/studentTaskProgress/student/${userId}/${courseId}/${assignmentName}`,
      ),
    getAllAssignmentProgressForQueue: async (
      queueId: number,
      courseId: number,
      assignmentName: string,
    ): Promise<AllStudentAssignmentProgress> =>
      this.req(
        'GET',
        `/api/v1/studentTaskProgress/queue/${queueId}/${courseId}/${assignmentName}`,
      ),
    getAllTaskProgressForCourse: async (
      courseId: number,
    ): Promise<StudentTaskProgressWithUser[]> =>
      this.req('GET', `/api/v1/studentTaskProgress/course/${courseId}`),
  }
  taStatus = {
    checkIn: async (
      courseId: number,
      room: string,
    ): Promise<TAUpdateStatusResponse> =>
      this.req('POST', `/api/v1/courses/${courseId}/ta_location/${room}`),
    checkOut: async (
      courseId: number,
      room: string,
    ): Promise<TACheckoutResponse> =>
      this.req('DELETE', `/api/v1/courses/${courseId}/ta_location/${room}`),
  }
  asyncQuestions = {
    create: async (body: CreateAsyncQuestions, cid: number) =>
      this.req('POST', `/api/v1/asyncQuestions/${cid}`, AsyncQuestion, body),
    update: async (qid: number, body: UpdateAsyncQuestions) =>
      this.req('PATCH', `/api/v1/asyncQuestions/${qid}`, AsyncQuestion, body),
    vote: async (
      qid: number,
      vote: number,
    ): Promise<{ questionSumVotes: number; vote: number }> =>
      this.req('POST', `/api/v1/asyncQuestions/${qid}/${vote}`, undefined, {
        vote,
      }),
  }
  questions = {
    index: async (queueId: number) =>
      this.req<ListQuestionsResponse>(
        'GET',
        `/api/v1/queues/${queueId}/questions`,
        ListQuestionsResponse,
      ),
    create: async (params: CreateQuestionParams) =>
      this.req('POST', `/api/v1/questions`, CreateQuestionResponse, params),
    TAcreate: async (params: CreateQuestionParams, userId: number) =>
      this.req(
        'POST',
        `/api/v1/questions/TAcreate/${userId}`,
        CreateQuestionResponse,
        params,
      ),
    getAllQuestions: async (cid: number): Promise<questions[]> =>
      this.req('GET', `/api/v1/questions/allQuestions/${cid}`, undefined),
    update: async (questionId: number, params: UpdateQuestionParams) =>
      this.req(
        'PATCH',
        `/api/v1/questions/${questionId}`,
        UpdateQuestionResponse,
        params,
      ),
    notify: async (questionId: number): Promise<void> =>
      this.req('POST', `/api/v1/questions/${questionId}/notify`),
  }
  questionType = {
    getQuestionTypes: async (
      courseId: number,
      queueId: number | null,
    ): Promise<QuestionTypeType[]> => {
      try {
        return await this.req(
          'GET',
          `/api/v1/questionType/${courseId}/${queueId}`,
          undefined,
        )
      } catch (error) {
        return []
      }
    },
    addQuestionType: async (
      courseId: number,
      body: QuestionTypeParams,
    ): Promise<string> =>
      this.req('POST', `/api/v1/questionType/${courseId}`, undefined, body),
    deleteQuestionType: async (
      courseId: number,
      questionTypeId: number,
    ): Promise<string> =>
      this.req('DELETE', `/api/v1/questionType/${courseId}/${questionTypeId}`),
  }
  calendar = {
    addCalendar: async (body: Calendar): Promise<Calendar> =>
      this.req('POST', `/api/v1/calendar`, undefined, body),
    getEvents: async (cid: number): Promise<Calendar[]> =>
      this.req('GET', `/api/v1/calendar/${cid}`),
    deleteEvent: async (eventId: number): Promise<Calendar> =>
      this.req('DELETE', `/api/v1/calendar/${eventId}/delete`),
  }
  queues = {
    get: async (queueId: number): Promise<GetQueueResponse> =>
      this.req('GET', `/api/v1/queues/${queueId}`, GetQueueResponse),
    update: async (queueId: number, params: UpdateQueueParams) =>
      this.req(
        'PATCH',
        `/api/v1/queues/${queueId}`,
        UpdateQuestionResponse,
        params,
      ),
    clean: async (queueId: number): Promise<void> =>
      this.req('POST', `/api/v1/queues/${queueId}/clean`),
    disable: async (queueId: number): Promise<void> =>
      this.req('DELETE', `/api/v1/queues/${queueId}`),
    updateConfig: async (
      queueId: number,
      config: QueueConfig,
    ): Promise<setQueueConfigResponse> =>
      this.req('PATCH', `/api/v1/queues/${queueId}/config`, undefined, config),
    createQueue: async (
      courseId: number,
      room: string,
      isProfessorQueue: boolean,
      notes: string,
      config: QueueConfig,
    ): Promise<TAUpdateStatusResponse> =>
      this.req(
        'POST',
        `/api/v1/courses/${courseId}/create_queue/${room}`,
        QueuePartial,
        { notes, isProfessorQueue, config },
      ),
  }
  notif = {
    desktop: {
      credentials: async (): Promise<string> =>
        this.req('GET', '/api/v1/notifications/desktop/credentials'),
      register: async (
        payload: DesktopNotifBody,
      ): Promise<DesktopNotifPartial> =>
        this.req(
          'POST',
          `/api/v1/notifications/desktop/device`,
          DesktopNotifPartial,
          payload,
        ),
      unregister: async (deviceId: number): Promise<string> =>
        this.req(
          'DELETE',
          `/api/v1/notifications/desktop/device/${deviceId}`,
          undefined,
        ),
    },
  }
  seeds = {
    delete: async () => this.req('GET', `/api/v1/seeds/delete`),
    create: async () => this.req('GET', `/api/v1/seeds/create`),
    fillQueue: async () => this.req('GET', `/api/v1/seeds/fill_queue`),
  }
  semesters = {
    get: async (): Promise<SemesterPartial[]> =>
      this.req('GET', `/api/v1/semesters`),
  }
  insights = {
    get: async (
      courseId: number,
      insightName: string,
      params: InsightParamsType,
    ): Promise<GetInsightOutputResponse> => {
      return this.req(
        'GET',
        `/api/v1/insights/${courseId}/${insightName}`,
        undefined,
        undefined,
        params,
      )
    },
    list: async (): Promise<ListInsightsResponse> =>
      this.req('GET', `/api/v1/insights/list`),
    toggleOn: async (insightName: string): Promise<void> =>
      this.req('PATCH', `/api/v1/insights`, undefined, { insightName }),
    toggleOff: async (insightName: string): Promise<void> =>
      this.req('DELETE', `/api/v1/insights`, undefined, { insightName }),
  }
  alerts = {
    get: async (courseId: number): Promise<GetAlertsResponse> =>
      this.req('GET', `/api/v1/alerts/${courseId}`),
    create: async (params: CreateAlertParams): Promise<CreateAlertResponse> =>
      this.req('POST', `/api/v1/alerts`, CreateAlertResponse, params),
    close: async (alertId: number): Promise<void> =>
      this.req('PATCH', `/api/v1/alerts/${alertId}`),
  }

  organizations = {
    getOrganizations: async (): Promise<OrganizationResponse[]> =>
      this.req('GET', `/api/v1/organization`),
    updateCourse: async (
      organizationId: number,
      courseId: number,
      body: UpdateOrganizationCourseDetailsParams,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizationId}/update_course/${courseId}`,
        undefined,
        body,
      ),
    createCourse: async (
      oid: number,
      body: UpdateOrganizationCourseDetailsParams,
    ): Promise<void> =>
      this.req(
        'POST',
        `/api/v1/organization/${oid}/create_course`,
        undefined,
        body,
      ),
    getCourse: async (
      organizationId: number,
      courseId: number,
    ): Promise<OrganizationCourseResponse> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_course/${courseId}`,
      ),
    updateCourseAccess: async (
      organizationId: number,
      courseId: number,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizationId}/update_course_access/${courseId}`,
      ),
    updateAccess: async (
      organizationId: number,
      userId: number,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizationId}/update_account_access/${userId}`,
      ),
    dropUserCourses: async (
      organizationId: number,
      userId: number,
      body: number[],
    ): Promise<void> =>
      this.req(
        'DELETE',
        `/api/v1/organization/${organizationId}/drop_user_courses/${userId}`,
        undefined,
        body,
      ),
    deleteProfilePicture: async (
      organizationId: number,
      userId: number,
    ): Promise<void> =>
      this.req(
        'DELETE',
        `/api/v1/organization/${organizationId}/delete_profile_picture/${userId}`,
      ),
    patchUserInfo: async (
      organizatonId: number,
      userId: number,
      body: UpdateProfileParams,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizatonId}/edit_user/${userId}`,
        undefined,
        body,
      ),
    addMember: async (userId: number, organizationId: number): Promise<void> =>
      this.req(
        'POST',
        `/api/v1/organization/${organizationId}/add_member/${userId}`,
      ),
    updateOrganizationUserRole: async (
      organizationId: number,
      body: UpdateOrganizationUserRole,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizationId}/update_user_role`,
        undefined,
        body,
      ),
    patch: async (
      organizationId: number,
      body: UpdateOrganizationDetailsParams,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizationId}/update`,
        undefined,
        body,
      ),
    getStats: async (
      organizationId: number,
    ): Promise<OrganizationStatsResponse> =>
      this.req('GET', `/api/v1/organization/${organizationId}/stats`),
    get: async (organizationId: number): Promise<any> =>
      this.req('GET', `/api/v1/organization/${organizationId}`),
    getUser: async (
      organizationId: number,
      userId: number,
    ): Promise<GetOrganizationUserResponse> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_user/${userId}`,
      ),
    getUsers: async (
      organizationId: number,
      page: number,
      search?: string,
    ): Promise<any> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_users/${page}${
          search ? `?search=${search}` : ''
        }`,
      ),
    getCourses: async (
      organizationId: number,
      page: number,
      search?: string,
    ): Promise<any> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_courses/${page}${
          search ? `?search=${search}` : ''
        }`,
      ),
    getProfessors: async (organizationId: number): Promise<any> =>
      this.req('GET', `/api/v1/organization/${organizationId}/get_professors`),
  }

  constructor(baseURL = '') {
    this.axios = Axios.create({ baseURL: baseURL })
  }
}

export const API = new APIClient(process.env.NEXT_PUBLIC_API_URL)
