import {
  AddChatbotQuestionParams,
  AddDocumentChunkParams,
  AllStudentAssignmentProgress,
  AsyncQuestion,
  AsyncQuestionComment,
  AsyncQuestionCommentParams,
  AsyncQuestionParams,
  BatchCourseCloneAttributes,
  Calendar,
  ChatbotAskParams,
  ChatbotAskResponse,
  ChatbotAskSuggestedParams,
  ChatbotQueryParams,
  ChatbotProvider,
  ChatbotQuestionResponseChatbotDB,
  ChatbotQuestionResponseHelpMeDB,
  ChatbotServiceProvider,
  ChatbotServiceType,
  ChatbotSettings,
  ChatbotSettingsUpdateParams,
  CourseChatbotSettings,
  CourseChatbotSettingsForm,
  CourseCloneAttributes,
  CourseResponse,
  CourseSettingsResponse,
  CreateAlertParams,
  CreateAlertResponse,
  CreateAsyncQuestions,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  CreateOrganizationChatbotSettingsBody,
  CreateQuestionParams,
  CreateQuestionResponse,
  CronJob,
  DesktopNotifBody,
  DesktopNotifPartial,
  EditCourseInfoParams,
  GetAlertsResponse,
  GetAvailableModelsBody,
  GetChatbotHistoryResponse,
  GetCourseResponse,
  GetCourseUserInfoResponse,
  GetInsightOutputResponse,
  GetInteractionsAndQuestionsResponse,
  GetLimitedCourseResponse,
  GetOrganizationUserResponse,
  GetProfileResponse,
  GetQueueChatResponse,
  GetQueueChatsResponse,
  GetQueueResponse,
  InsightDashboardPartial,
  InsightDetail,
  InsightParamsType,
  ListInsightsResponse,
  ListQuestionsResponse,
  LLMType,
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSFile,
  LMSOrganizationIntegrationPartial,
  LMSPage,
  LMSQuiz,
  LMSQuizAccessLevel,
  MailServiceWithSubscription,
  OllamaLLMType,
  OrganizationChatbotSettings,
  OrganizationChatbotSettingsDefaults,
  OrganizationCourseResponse,
  OrganizationProfessor,
  OrganizationResponse,
  OrganizationRoleHistoryFilter,
  OrganizationRoleHistoryResponse,
  OrganizationSettingsResponse,
  OrganizationStatsResponse,
  OrgUser,
  PreDeterminedQuestion,
  PublicQueueInvite,
  questions,
  QuestionType,
  QuestionTypeParams,
  QueueChatPartial,
  QueueConfig,
  QueueInvite,
  QueueInviteParams,
  QueuePartial,
  QueueTypes,
  ExtraTAStatus,
  RemoveLMSOrganizationParams,
  Role,
  SemesterPartial,
  setQueueConfigResponse,
  SourceDocument,
  StudentAssignmentProgress,
  StudentTaskProgressWithUser,
  TACheckinTimesResponse,
  TACheckoutResponse,
  TAUpdateStatusResponse,
  TestLMSIntegrationParams,
  UBCOuserParam,
  UnreadAsyncQuestionResponse,
  UpdateAsyncQuestions,
  UpdateChatbotProviderBody,
  UpdateChatbotQuestionParams,
  UpdateDocumentChunkParams,
  UpdateLLMTypeBody,
  UpdateOrganizationCourseDetailsParams,
  UpdateOrganizationDetailsParams,
  UpdateOrganizationUserRole,
  UpdateProfileParams,
  UpdateQuestionParams,
  UpdateQuestionResponse,
  UpdateQueueParams,
  UpsertCourseChatbotSettings,
  UpsertLMSCourseParams,
  UpsertLMSOrganizationParams,
  UserMailSubscription,
  LMSSyncDocumentsResult,
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
   * @param params any query parameters to include in req URL
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
    readChangelog: async (): Promise<void> =>
      this.req('PATCH', `/api/v1/profile/read_changelog`, undefined),
  }

  chatbot = {
    studentsOrStaff: {
      // these endpoints are the main endpoints that students and staff use
      queryChatbot: async (
        courseId: number,
        body: ChatbotQueryParams,
      ): Promise<string> =>
        this.req('POST', `/api/v1/chatbot/query/${courseId}`, undefined, body),
      askQuestion: async (
        courseId: number,
        body: ChatbotAskParams,
      ): Promise<ChatbotAskResponse> =>
        this.req('POST', `/api/v1/chatbot/ask/${courseId}`, undefined, body),
      askSuggestedQuestion: async (
        courseId: number,
        body: ChatbotAskSuggestedParams,
      ): Promise<ChatbotQuestionResponseHelpMeDB> =>
        this.req(
          'POST',
          `/api/v1/chatbot/askSuggested/${courseId}`,
          undefined,
          body,
        ),
      getSuggestedQuestions: async (
        courseId: number,
      ): Promise<PreDeterminedQuestion[]> =>
        this.req('GET', `/api/v1/chatbot/question/suggested/${courseId}`),
      updateUserScore: async (
        courseId: number,
        questionId: number,
        userScore: number,
      ): Promise<ChatbotQuestionResponseHelpMeDB> =>
        this.req(
          'PATCH',
          `/api/v1/chatbot/questionScore/${courseId}/${questionId}`,
          undefined,
          { userScore },
        ),
      getChatHistory: async (): Promise<GetChatbotHistoryResponse> =>
        this.req('GET', `/api/v1/chatbot/history`),
    },
    staffOnly: {
      // these endpoints are more for management of chatbot questions
      getInteractionsAndQuestions: async (
        courseId: number,
      ): Promise<GetInteractionsAndQuestionsResponse> =>
        this.req('GET', `/api/v1/chatbot/question/all/${courseId}`),
      addQuestion: async (
        courseId: number,
        questionData: AddChatbotQuestionParams,
      ): Promise<ChatbotQuestionResponseHelpMeDB> =>
        this.req(
          'POST',
          `/api/v1/chatbot/question/${courseId}`,
          undefined,
          questionData,
        ),
      updateQuestion: async (
        courseId: number,
        body: UpdateChatbotQuestionParams,
      ): Promise<ChatbotQuestionResponseChatbotDB> =>
        this.req(
          'PATCH',
          `/api/v1/chatbot/question/${courseId}`,
          undefined,
          body,
        ),
      deleteQuestion: async (
        courseId: number,
        vectorStoreId: string,
      ): Promise<{ success: boolean }> =>
        this.req(
          'DELETE',
          `/api/v1/chatbot/question/${courseId}/${vectorStoreId}`,
        ),
      // deleteAllQuestions: async (courseId: number): Promise<{ success: boolean }> =>
      //   this.req('DELETE', `/api/v1/chatbot/question/all/${courseId}`), Unused
      // resetCourse: async (courseId: number): Promise<{ success: boolean }> =>
      //   this.req('DELETE', `/api/v1/chatbot/resetCourse/${courseId}`), Unused, resets all chatbot data for the course
      getAllAggregateDocuments: async (
        courseId: number,
      ): Promise<SourceDocument[]> =>
        this.req('GET', `/api/v1/chatbot/aggregateDocuments/${courseId}`),
      getAllDocumentChunks: async (
        courseId: number,
      ): Promise<SourceDocument[]> =>
        this.req('GET', `/api/v1/chatbot/documentChunks/${courseId}`),
      addDocumentChunk: async (
        courseId: number,
        body: AddDocumentChunkParams,
      ): Promise<SourceDocument[]> =>
        this.req(
          'POST',
          `/api/v1/chatbot/documentChunks/${courseId}`,
          undefined,
          body,
        ),
      updateDocumentChunk: async (
        courseId: number,
        docId: string,
        body: UpdateDocumentChunkParams,
      ): Promise<SourceDocument[]> =>
        this.req(
          'PATCH',
          `/api/v1/chatbot/documentChunks/${courseId}/${docId}`,
          undefined,
          body,
        ),
      deleteDocumentChunk: async (
        courseId: number,
        docId: string,
      ): Promise<{ success: boolean }> =>
        this.req(
          'DELETE',
          `/api/v1/chatbot/documentChunks/${courseId}/${docId}`,
        ),
      deleteDocument: async (
        courseId: number,
        docId: string,
      ): Promise<{ success: boolean }> =>
        this.req('DELETE', `/api/v1/chatbot/document/${courseId}/${docId}`),
      uploadDocument: async (
        courseId: number,
        body: FormData,
      ): Promise<{ success: boolean; documentId?: string }> =>
        this.req(
          'POST',
          `/api/v1/chatbot/document/${courseId}/upload`,
          undefined,
          body,
        ),
      addDocumentFromGithub: async (
        courseId: number,
        url: string,
      ): Promise<{ success: boolean; documentId?: string }> =>
        this.req(
          'POST',
          `/api/v1/chatbot/document/${courseId}/github`,
          undefined,
          { url },
        ),
      getCourseOrganizationProviders: async (
        courseId: number,
      ): Promise<ChatbotProvider[]> =>
        this.req('GET', `/api/v1/chatbot/course/${courseId}/provider`),
      getCourseSettings: async (
        courseId: number,
      ): Promise<CourseChatbotSettings> =>
        this.req('GET', `/api/v1/chatbot/course/${courseId}`),
      getCourseServiceType: async (
        courseId: number,
      ): Promise<ChatbotServiceType> =>
        this.req('GET', `/api/v1/chatbot/course/${courseId}/service`),
      upsertCourseSettings: async (
        courseId: number,
        params: UpsertCourseChatbotSettings,
      ): Promise<CourseChatbotSettings> =>
        this.req(
          'POST',
          `/api/v1/chatbot/course/${courseId}`,
          undefined,
          params,
        ),
      resetCourseSettings: async (
        courseId: number,
      ): Promise<CourseChatbotSettings> =>
        this.req('PATCH', `/api/v1/chatbot/course/${courseId}/reset`),
      getCourseSettingsDefaults: async (
        courseId: number,
      ): Promise<CourseChatbotSettingsForm> =>
        this.req('GET', `/api/v1/chatbot/course/${courseId}/default`),
      legacy: {
        getModels: async (courseId: number): Promise<Record<string, string>> =>
          this.req('GET', `/api/v1/chatbot/models/${courseId}`),
        getSettings: async (courseId: number): Promise<ChatbotSettings> =>
          this.req('GET', `/api/v1/chatbot/settings/${courseId}`),
        updateSettings: async (
          courseId: number,
          settings: ChatbotSettingsUpdateParams,
        ): Promise<{ success: boolean }> =>
          this.req(
            'PATCH',
            `/api/v1/chatbot/settings/${courseId}`,
            undefined,
            settings,
          ),
        resetSettings: async (
          courseId: number,
        ): Promise<{ success: boolean }> =>
          this.req('PATCH', `/api/v1/chatbot/settings/${courseId}/reset`),
      },
    },
    adminOnly: {
      getOrganizationSettings: async (
        organizationId: number,
      ): Promise<OrganizationChatbotSettings> =>
        this.req('GET', `/api/v1/chatbot/organization/${organizationId}`),
      createOrganizationSettings: async (
        organizationId: number,
        params: CreateOrganizationChatbotSettingsBody,
      ): Promise<OrganizationChatbotSettings> =>
        this.req(
          'POST',
          `/api/v1/chatbot/organization/${organizationId}`,
          undefined,
          params,
        ),
      updateOrganizationSettings: async (
        organizationId: number,
        params: OrganizationChatbotSettingsDefaults,
      ): Promise<OrganizationChatbotSettings> =>
        this.req(
          'PATCH',
          `/api/v1/chatbot/organization/${organizationId}`,
          undefined,
          params,
        ),
      deleteOrganizationSettings: async (
        organizationId: number,
      ): Promise<void> =>
        this.req('DELETE', `/api/v1/chatbot/organization/${organizationId}`),
      getOrganizationCourseSettings: async (
        organizationId: number,
      ): Promise<CourseChatbotSettings[]> =>
        this.req(
          'GET',
          `/api/v1/chatbot/organization/${organizationId}/course`,
        ),
      getOrganizationProviders: async (
        organizationId: number,
      ): Promise<ChatbotProvider[]> =>
        this.req(
          'GET',
          `/api/v1/chatbot/organization/${organizationId}/provider`,
        ),
      createChatbotProvider: async (
        organizationId: number,
        params: CreateChatbotProviderBody,
      ): Promise<ChatbotProvider> =>
        this.req(
          'POST',
          `/api/v1/chatbot/organization/${organizationId}/provider`,
          undefined,
          params,
        ),
      updateChatbotProvider: async (
        organizationId: number,
        providerId: number,
        params: UpdateChatbotProviderBody,
      ): Promise<ChatbotProvider> =>
        this.req(
          'PATCH',
          `/api/v1/chatbot/organization/${organizationId}/provider/${providerId}`,
          undefined,
          params,
        ),
      deleteChatbotProvider: async (
        organizationId: number,
        providerId: number,
      ): Promise<void> =>
        this.req(
          'DELETE',
          `/api/v1/chatbot/organization/${organizationId}/provider/${providerId}`,
        ),
      createLLMType: async (
        organizationId: number,
        params: CreateLLMTypeBody,
      ): Promise<LLMType> =>
        this.req(
          'POST',
          `/api/v1/chatbot/organization/${organizationId}/model`,
          undefined,
          params,
        ),
      updateLLMType: async (
        organizationId: number,
        modelId: number,
        params: UpdateLLMTypeBody,
      ): Promise<LLMType> =>
        this.req(
          'PATCH',
          `/api/v1/chatbot/organization/${organizationId}/model/${modelId}`,
          undefined,
          params,
        ),
      deleteLLMType: async (
        organizationId: number,
        modelId: number,
      ): Promise<LLMType> =>
        this.req(
          'DELETE',
          `/api/v1/chatbot/organization/${organizationId}/model/${modelId}`,
        ),
      getAvailableModels: async <T extends LLMType>(
        providerType: ChatbotServiceProvider,
        organizationId: number,
        params: GetAvailableModelsBody,
      ): Promise<T[]> =>
        this.req(
          'POST',
          `/api/v1/chatbot/organization/${organizationId}/${providerType}`,
          undefined,
          params,
        ),
      getProviderAvailableModels: async <T extends LLMType>(
        organizationId: number,
        providerId: number,
      ): Promise<T[]> =>
        this.req(
          'GET',
          `/api/v1/chatbot/organization/${organizationId}/provider/${providerId}/models`,
          undefined,
        ),
    },
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
    get: async (courseId: number) =>
      this.req('GET', `/api/v1/courses/${courseId}`, GetCourseResponse),
    getUserInfo: async (
      courseId: number,
      page: number,
      role?: Role | 'staff',
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
    setCourseInviteRedirectCookie: async (
      courseId: number,
      code: string,
    ): Promise<void> =>
      this.req('POST', `/api/v1/courses/redirect_cookie/${courseId}/${code}`),
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
    getAllStudentsNotInQueue: async (
      courseId: number,
      withATaskQuestion?: boolean,
    ): Promise<{ name: string; id: number }[]> =>
      this.req(
        'GET',
        `/api/v1/courses/${courseId}/students_not_in_queue?with_a_task_question=${!!withATaskQuestion}`,
        undefined,
      ),
    getAllQuestionTypes: async (courseId: number): Promise<QuestionType[]> =>
      this.req('GET', `/api/v1/courses/${courseId}/question_types`),
    getAllQueueInvites: async (courseId: number): Promise<QueueInvite[]> =>
      this.req('GET', `/api/v1/courses/${courseId}/queue_invites`),
    getIntegration: async (
      courseId: number,
    ): Promise<LMSCourseIntegrationPartial> =>
      this.req('GET', `/api/v1/courses/${courseId}/lms_integration`),
    upsertIntegration: async (
      courseId: number,
      props: {
        apiPlatform: any
        apiKey: string
        apiKeyExpiry?: Date
        apiKeyExpiryDeleted?: boolean
        apiCourseId: string
      },
    ): Promise<string | undefined> =>
      this.req(
        'POST',
        `/api/v1/courses/${courseId}/lms_integration/upsert`,
        undefined,
        props,
      ),
    removeIntegration: async (
      courseId: number,
      props: { apiPlatform: any },
    ): Promise<string | undefined> =>
      this.req(
        'DELETE',
        `/api/v1/courses/${courseId}/lms_integration/remove`,
        undefined,
        props,
      ),
    updateTANotes: async (courseId: number, TAid: number, notes: string) =>
      this.req(
        'PATCH',
        `/api/v1/courses/${courseId}/set_ta_notes/${TAid}`,
        undefined,
        {
          notes,
        },
      ),
    createClone: async (courseId: number, toClone: CourseCloneAttributes) => {
      return this.req(
        'POST',
        `/api/v1/courses/${courseId}/clone_course`,
        undefined,
        toClone,
      )
    },
    toggleFavourited: async (courseId: number) => {
      return this.req('PATCH', `/api/v1/courses/${courseId}/toggle_favourited`)
    },
  }
  emailNotification = {
    get: async (): Promise<MailServiceWithSubscription[]> =>
      this.req('GET', `/api/v1/mail-services`),
    update: async (
      mailServiceId: number,
      isSubscribed: boolean,
    ): Promise<UserMailSubscription> => {
      return this.req(
        'PATCH',
        `/api/v1/mail-services/${mailServiceId}`,
        undefined,
        { isSubscribed },
      )
    },
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
    checkMeIn: async (
      courseId: number,
      qid: number,
    ): Promise<TAUpdateStatusResponse> =>
      this.req('POST', `/api/v1/courses/${courseId}/checkin/${qid}`),
    checkMeOut: async (
      courseId: number,
      qid?: number,
    ): Promise<TACheckoutResponse> => {
      if (qid) {
        return this.req('DELETE', `/api/v1/courses/${courseId}/checkout/${qid}`)
      } else {
        return this.req('DELETE', `/api/v1/courses/${courseId}/checkout_all`)
      }
    },
    setExtraStatus: async (
      courseId: number,
      qid: number,
      status: ExtraTAStatus | null,
    ): Promise<TAUpdateStatusResponse> =>
      this.req(
        'PATCH',
        `/api/v1/courses/${courseId}/ta_status/${qid}`,
        undefined,
        { status },
      ),
  }
  asyncQuestions = {
    get: async (cid: number): Promise<AsyncQuestion[]> =>
      this.req('GET', `/api/v1/asyncQuestions/${cid}`, undefined),
    create: async (body: CreateAsyncQuestions, cid: number) =>
      this.req(
        'POST',
        `/api/v1/asyncQuestions/${cid}`,
        AsyncQuestionParams,
        body,
      ),
    studentUpdate: async (qid: number, body: UpdateAsyncQuestions) =>
      this.req(
        'PATCH',
        `/api/v1/asyncQuestions/student/${qid}`,
        AsyncQuestionParams,
        body,
      ),
    facultyUpdate: async (qid: number, body: UpdateAsyncQuestions) =>
      this.req(
        'PATCH',
        `/api/v1/asyncQuestions/faculty/${qid}`,
        AsyncQuestionParams,
        body,
      ),
    vote: async (
      qid: number,
      vote: number,
    ): Promise<{ questionSumVotes: number; vote: number }> =>
      this.req(
        'POST',
        `/api/v1/asyncQuestions/vote/${qid}/${vote}`,
        undefined,
        {
          vote,
        },
      ),
    comment: async (
      questionId: number,
      body: AsyncQuestionCommentParams,
    ): Promise<AsyncQuestionComment[]> =>
      this.req(
        'POST',
        `/api/v1/asyncQuestions/comment/${questionId}`,
        undefined,
        body,
      ),
    deleteComment: async (
      questionId: number,
      commentId: number,
    ): Promise<AsyncQuestionComment> =>
      this.req(
        'DELETE',
        `/api/v1/asyncQuestions/comment/${questionId}/${commentId}`,
        AsyncQuestionComment,
      ),
    updateComment: async (
      questionId: number,
      commentId: number,
      body: AsyncQuestionCommentParams,
    ): Promise<AsyncQuestionComment[]> =>
      this.req(
        'PATCH',
        `/api/v1/asyncQuestions/comment/${questionId}/${commentId}`,
        undefined,
        body,
      ),
    getUnreadAsyncCount: async (
      courseId: number,
    ): Promise<UnreadAsyncQuestionResponse> =>
      this.req('GET', `/api/v1/asyncQuestions/unread_async_count/${courseId}`),
    updateUnreadAsyncCount: async (courseId: number): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/asyncQuestions/unread_async_count/${courseId}`,
      ),
  }
  questions = {
    index: async (queueId: number) =>
      this.req<ListQuestionsResponse>(
        'GET',
        `/api/v1/queues/${queueId}/questions`,
        ListQuestionsResponse,
      ),
    create: async (params: CreateQuestionParams, queueId: number) =>
      this.req(
        'POST',
        `/api/v1/questions/${queueId}`,
        CreateQuestionResponse,
        params,
      ),
    TAcreate: async (
      params: CreateQuestionParams,
      queueId: number,
      userId: number,
    ) =>
      this.req(
        'POST',
        `/api/v1/questions/TAcreate/${queueId}/${userId}`,
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
    ): Promise<QuestionType[]> => {
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
    updateQuestionType: async (
      courseId: number,
      questionTypeId: number,
      body: QuestionTypeParams,
    ): Promise<string> =>
      this.req(
        'PATCH',
        `/api/v1/questionType/${courseId}/${questionTypeId}`,
        undefined,
        body,
      ),
  }
  calendar = {
    addCalendar: async (body: Calendar, cid: number): Promise<Calendar> =>
      this.req('POST', `/api/v1/calendar/${cid}`, undefined, body),
    getEvents: async (cid: number): Promise<Calendar[]> =>
      this.req('GET', `/api/v1/calendar/${cid}`),
    deleteEvent: async (eventId: number, cid: number): Promise<Calendar> =>
      this.req('DELETE', `/api/v1/calendar/${eventId}/${cid}/delete`),
    patchEvent: async (
      eventId: number,
      body: Partial<Calendar>,
      cid: number,
    ): Promise<Calendar> =>
      this.req('PATCH', `/api/v1/calendar/${eventId}/${cid}`, undefined, body),
    resetCronJobs: async (orgId: number): Promise<void> =>
      this.req('POST', `/api/v1/calendar/reset_cron_jobs/${orgId}`),
  }

  queues = {
    get: async (queueId: number): Promise<GetQueueResponse> =>
      this.req('GET', `/api/v1/queues/${queueId}`, GetQueueResponse),
    update: async (queueId: number, params: UpdateQueueParams) =>
      this.req('PATCH', `/api/v1/queues/${queueId}`, undefined, params),
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
      type: QueueTypes,
      isProfessorQueue: boolean,
      notes: string,
      config: QueueConfig,
    ): Promise<TAUpdateStatusResponse> =>
      this.req(
        'POST',
        `/api/v1/courses/${courseId}/create_queue/${room}`,
        QueuePartial,
        { notes, type, isProfessorQueue, config },
      ),
  }

  queueInvites = {
    create: async (queueId: number): Promise<void> =>
      this.req('POST', `/api/v1/queueInvites/${queueId}`),
    delete: async (queueId: number): Promise<void> =>
      this.req('DELETE', `/api/v1/queueInvites/${queueId}`),
    update: async (queueId: number, body: QueueInviteParams): Promise<void> =>
      this.req('PATCH', `/api/v1/queueInvites/${queueId}`, undefined, body),
    get: async (queueId: number, code: string): Promise<PublicQueueInvite> =>
      this.req('GET', `/api/v1/queueInvites/${queueId}/${code}`),
    getQuestions: async (
      queueId: number,
      code: string,
    ): Promise<ListQuestionsResponse> =>
      this.req('GET', `/api/v1/queueInvites/${queueId}/${code}/questions`),
    getQueue: async (
      queueId: number,
      code: string,
    ): Promise<GetQueueResponse> =>
      this.req('GET', `/api/v1/queueInvites/${queueId}/${code}/queue`),
  }

  queueChats = {
    get: async (
      queueId: number,
      questionId: number,
      staffId: number,
    ): Promise<GetQueueChatResponse> =>
      this.req(
        'GET',
        `/api/v1/queueChats/${queueId}/${questionId}/${staffId}`,
        GetQueueChatResponse,
      ),
    startQueueChat: async (
      queueId: number,
      questionId: number,
      staffId: number,
    ): Promise<QueueChatPartial> =>
      this.req(
        'POST',
        `/api/v1/queueChats/${queueId}/${questionId}/${staffId}`,
        QueueChatPartial,
      ),
    getMyQueueChats: async (queueId: number): Promise<GetQueueChatsResponse> =>
      this.req('GET', `/api/v1/queueChats/${queueId}`),
    sendMessage: async (
      queueId: number,
      questionId: number,
      staffId: number,
      message: string,
    ): Promise<void> => {
      this.req(
        'PATCH',
        `/api/v1/queueChats/${queueId}/${questionId}/${staffId}`,
        undefined,
        { message },
      )
    },
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
    get: async (oid: number): Promise<SemesterPartial[]> =>
      this.req('GET', `/api/v1/semesters/${oid}`),
    create: async (
      oid: number,
      body: SemesterPartial,
    ): Promise<SemesterPartial> =>
      this.req('POST', `/api/v1/semesters/${oid}`, SemesterPartial, body),
    edit: async (
      oid: number,
      semesterId: number,
      body: SemesterPartial,
    ): Promise<void> =>
      this.req(
        'PATCH',
        `/api/v1/semesters/${oid}/${semesterId}`,
        undefined,
        body,
      ),
    delete: async (oid: number, semesterId: number): Promise<void> =>
      this.req('DELETE', `/api/v1/semesters/${oid}/${semesterId}`),
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
    getPresets: async (courseId: number): Promise<InsightDashboardPartial[]> =>
      this.req(
        'GET',
        `/api/v1/insights/${courseId}/dashboard`,
        undefined,
        undefined,
      ),
    createOrUpdatePreset: async (
      courseId: number,
      insights: InsightDetail,
      name?: string,
    ): Promise<InsightDashboardPartial[]> =>
      this.req(
        'POST',
        `/api/v1/insights/${courseId}/dashboard/create`,
        undefined,
        { name, insights },
      ),
    removePreset: async (
      courseId: number,
      name?: string,
    ): Promise<InsightDashboardPartial[]> =>
      this.req(
        'DELETE',
        `/api/v1/insights/${courseId}/dashboard/remove`,
        undefined,
        {
          name,
        },
      ),
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
    ): Promise<OrgUser[]> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_users/${page}${
          search ? `?search=${search}` : ''
        }`,
      ),
    getCourses: async (
      organizationId: number,
      page?: number,
      search?: string,
    ): Promise<CourseResponse[]> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_courses/${page ?? -1}${
          search ? `?search=${search}` : ''
        }`,
      ),
    getProfessors: async (
      organizationId: number,
      courseId?: number,
    ): Promise<OrganizationProfessor[]> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/get_professors/${courseId ?? '0'}`,
      ),
    getCronJobs: async (organizationId: number): Promise<CronJob[]> =>
      this.req('GET', `/api/v1/organization/${organizationId}/cronjobs`),
    batchCloneCourses: async (
      organizationId: number,
      body: BatchCourseCloneAttributes,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/organization/${organizationId}/clone_courses`,
        undefined,
        body,
      ),
    getOrganizationSettings: async (
      organizationId: number,
    ): Promise<OrganizationSettingsResponse> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/settings`,
        undefined,
        undefined,
      ),
    setOrganizationSetting: async (
      organizationId: number,
      setting: string,
      value: boolean,
    ): Promise<OrganizationSettingsResponse> =>
      this.req(
        'PATCH',
        `/api/v1/organization/${organizationId}/settings`,
        undefined,
        {
          setting,
          value,
        },
      ),
    getOrganizationRoleHistory: async (
      organizationId: number,
      page: number,
      searchFilters: OrganizationRoleHistoryFilter,
    ): Promise<OrganizationRoleHistoryResponse> =>
      this.req(
        'GET',
        `/api/v1/organization/${organizationId}/role_history/${page}`,
        undefined,
        undefined,
        searchFilters,
      ),
  }

  lmsIntegration = {
    getOrganizationIntegrations: async (
      organizationId: number,
    ): Promise<LMSOrganizationIntegrationPartial[]> =>
      this.req('GET', `/api/v1/lms/org/${organizationId}`),
    upsertOrganizationIntegration: async (
      organizationId: number,
      props: UpsertLMSOrganizationParams,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/org/${organizationId}/upsert`,
        undefined,
        props,
      ),
    removeOrganizationIntegration: async (
      organizationId: number,
      props: RemoveLMSOrganizationParams,
    ): Promise<string> =>
      this.req(
        'DELETE',
        `/api/v1/lms/org/${organizationId}/remove`,
        undefined,
        props,
      ),
    getCourseOrganizationIntegrations: async (
      courseId: number,
    ): Promise<LMSOrganizationIntegrationPartial[]> =>
      this.req('GET', `/api/v1/lms/course/${courseId}/integrations`),
    getCourseIntegration: async (
      courseId: number,
    ): Promise<LMSCourseIntegrationPartial> =>
      this.req('GET', `/api/v1/lms/course/${courseId}`),
    upsertCourseIntegration: async (
      courseId: number,
      props: UpsertLMSCourseParams,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/course/${courseId}/upsert`,
        undefined,
        props,
      ),
    removeCourseIntegration: async (
      courseId: number,
    ): Promise<string | undefined> =>
      this.req('DELETE', `/api/v1/lms/course/${courseId}/remove`),
    getCourse: async (courseId: number): Promise<LMSCourseAPIResponse> =>
      this.req('GET', `/api/v1/lms/${courseId}`),
    getStudents: async (courseId: number): Promise<string[]> =>
      this.req('GET', `/api/v1/lms/${courseId}/students`),
    getAssignments: async (courseId: number): Promise<LMSAssignment[]> =>
      this.req('GET', `/api/v1/lms/${courseId}/assignments`),
    getAnnouncements: async (courseId: number): Promise<LMSAnnouncement[]> =>
      this.req('GET', `/api/v1/lms/${courseId}/announcements`),
    getPages: async (courseId: number): Promise<LMSPage[]> =>
      this.req('GET', `/api/v1/lms/${courseId}/pages`),
    getFiles: async (courseId: number): Promise<LMSFile[]> =>
      this.req('GET', `/api/v1/lms/${courseId}/files`),
    getQuizzes: async (courseId: number): Promise<LMSQuiz[]> =>
      this.req('GET', `/api/v1/lms/${courseId}/quizzes`),
    toggleSync: async (courseId: number): Promise<string> =>
      this.req('POST', `/api/v1/lms/${courseId}/sync`),
    forceSync: async (courseId: number): Promise<LMSSyncDocumentsResult> =>
      this.req('POST', `/api/v1/lms/${courseId}/sync/force`),
    clearDocuments: async (courseId: number): Promise<string> =>
      this.req('DELETE', `/api/v1/lms/${courseId}/sync/clear`),
    toggleSyncAssignment: async (
      courseId: number,
      assignmentId: number,
      assignment: LMSAssignment,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/${courseId}/sync/assignment/${assignmentId}/toggle`,
        undefined,
        assignment,
      ),
    toggleSyncAnnouncement: async (
      courseId: number,
      announcementId: number,
      announcement: LMSAnnouncement,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/${courseId}/sync/announcement/${announcementId}/toggle`,
        undefined,
        announcement,
      ),
    toggleSyncPage: async (
      courseId: number,
      pageId: number,
      page: LMSPage,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/${courseId}/sync/page/${pageId}/toggle`,
        undefined,
        page,
      ),
    toggleSyncFile: async (
      courseId: number,
      fileId: number,
      file: LMSFile,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/${courseId}/sync/file/${fileId}/toggle`,
        undefined,
        file,
      ),
    toggleSyncQuiz: async (
      courseId: number,
      quizId: number,
      quiz: LMSQuiz,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/${courseId}/sync/quiz/${quizId}/toggle`,
        undefined,
        quiz,
      ),
    updateQuizAccessLevel: async (
      courseId: number,
      quizId: number,
      accessLevel: LMSQuizAccessLevel,
    ): Promise<string> =>
      this.req(
        'POST',
        `/api/v1/lms/${courseId}/quiz/${quizId}/access-level`,
        undefined,
        { accessLevel },
      ),
    getQuizContentPreview: async (
      courseId: number,
      quizId: number,
      accessLevel: LMSQuizAccessLevel,
    ): Promise<{ content: string }> =>
      this.req(
        'GET',
        `/api/v1/lms/${courseId}/quiz/${quizId}/preview/${accessLevel}`,
      ),
    bulkUpdateQuizSync: async (
      courseId: number,
      action: 'enable' | 'disable',
      quizIds?: number[],
    ): Promise<string> =>
      this.req('POST', `/api/v1/lms/${courseId}/quizzes/bulk-sync`, undefined, {
        action,
        quizIds,
      }),
    updateSelectedResourceTypes: async (
      courseId: number,
      selectedResourceTypes: string[],
    ): Promise<string> =>
      this.req('POST', `/api/v1/lms/course/${courseId}/resources`, undefined, {
        selectedResourceTypes,
      }),
    testIntegration: async (
      courseId: number,
      props: TestLMSIntegrationParams,
    ): Promise<LMSApiResponseStatus> =>
      this.req('POST', `/api/v1/lms/${courseId}/test`, undefined, props),
  }

  constructor(baseURL = '') {
    this.axios = Axios.create({ baseURL: baseURL })
  }
}

/**
 * This is our main "API" that basically has function calls for all the endpoints in our backend.
 * TODO: Some of the ones here are old and should be removed, others are missing types, and the other Api files should be merged with this one.
 */
export const API = new APIClient(process.env.NEXT_PUBLIC_API_URL)
