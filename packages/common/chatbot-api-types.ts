import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInstance,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

/* KEEP UP TO DATE */

export enum DocumentType {
  Inserted = 'inserted_document',
  InsertedLMS = 'inserted_lms_document',
  InsertedQuestion = 'inserted_question',
  PDF = 'pdf',
  PPTX = 'pptx',
  DOCX = 'docx',
  MD = 'md',
  TXT = 'txt',
  CSV = 'csv',
  TSV = 'tsv',
}

export const DocumentTypeDisplayMap = {
  [DocumentType.Inserted]: 'Inserted',
  [DocumentType.InsertedLMS]: 'LMS',
  [DocumentType.InsertedQuestion]: 'Inserted Question',
  [DocumentType.PDF]: 'PDF',
  [DocumentType.PPTX]: 'PPTX',
  [DocumentType.DOCX]: 'DOCX',
  [DocumentType.MD]: 'MD',
  [DocumentType.TXT]: 'TXT',
  [DocumentType.CSV]: 'CSV',
  [DocumentType.TSV]: 'TSV',
}

export const DocumentTypeColorMap = {
  [DocumentType.Inserted]: '#5E60CE',
  [DocumentType.InsertedLMS]: '#4EA8DE',
  [DocumentType.InsertedQuestion]: '#56CFE1',
  [DocumentType.PDF]: '#E63946',
  [DocumentType.PPTX]: '#F77F00',
  [DocumentType.DOCX]: '#457B9D',
  [DocumentType.MD]: '#CA00CA',
  [DocumentType.TXT]: '#00D844',
  [DocumentType.CSV]: '#FFB703',
  [DocumentType.TSV]: '#8338EC',
}

export enum ChatbotQueryTypeEnum {
  DEFAULT = 'default',
  ABSTRACT = 'abstract',
}

export class ChatMessage {
  @IsString()
  type!: string

  @IsString()
  message!: string
}

export class ImageDescription {
  @IsInt()
  imageId!: number

  @IsString()
  description!: string
}

export class Citation {
  @IsString()
  docName!: string

  @IsEnum(DocumentType)
  type!: DocumentType

  @IsString()
  @IsOptional()
  sourceLink?: string

  @IsObject()
  @IsOptional()
  confidences?: Record<number, number>

  @IsArray()
  @Type(() => Number)
  @IsOptional()
  pageNumbers?: number[]

  @IsString()
  documentId!: string

  @IsString()
  questionId!: string

  @IsString()
  @IsOptional()
  aggregateId?: string
}

export class ChatbotAskBody {
  @IsString()
  question!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history!: ChatMessage[]
}

export class ChatbotAskResponse {
  @IsString()
  question!: string

  @IsString()
  answer!: string

  @IsInt()
  courseId!: number

  @IsString()
  questionId!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Citation)
  citations!: Citation[]

  @IsBoolean()
  verified!: boolean

  @IsBoolean()
  isPreviousQuestion!: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDescription)
  imageDescriptions?: ImageDescription[]
}

export class ChatbotQueryBody {
  @IsString()
  query!: string

  @IsEnum(ChatbotQueryTypeEnum)
  type!: ChatbotQueryTypeEnum

  @IsObject()
  @IsOptional()
  params?: Record<string, any>

  @IsInt()
  @IsOptional()
  courseId?: number
}

export class ChatbotProviderResponse {
  @IsString()
  type!: string

  @IsOptional()
  @IsString()
  baseUrl!: string

  @IsString()
  defaultModelName!: string

  @IsString()
  defaultVisionModelName!: string

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>
}

export class ChatbotModelResponse {
  @IsInstance(ChatbotProviderResponse)
  @ValidateNested()
  @Type(() => ChatbotProviderResponse)
  provider!: ChatbotProviderResponse

  @IsString()
  modelName!: string
}

export class ChatbotOrganizationSettings {
  @IsInstance(ChatbotProviderResponse)
  @ValidateNested()
  @Type(() => ChatbotProviderResponse)
  defaultProvider!: ChatbotProviderResponse
}

export class ChatbotCourseSettingsProperties {
  @IsOptional()
  @IsInstance(ChatbotOrganizationSettings)
  @ValidateNested()
  organizationSettings?: ChatbotOrganizationSettings

  @IsOptional()
  @IsInstance(ChatbotModelResponse)
  @ValidateNested()
  model?: ChatbotModelResponse

  @IsOptional()
  @IsString()
  modelName?: string

  @IsString()
  prompt!: string

  @IsNumber()
  similarityThresholdDocuments!: number

  @IsNumber()
  similarityThresholdQuestions!: number

  @IsNumber()
  temperature!: number

  @IsInt()
  topK!: number
}

export class CreateChatbotCourseSettingsBody extends ChatbotCourseSettingsProperties {}

export class UpdateChatbotCourseSettingsBody {
  @IsOptional()
  @IsInstance(ChatbotOrganizationSettings)
  @ValidateNested()
  organizationSettings?: ChatbotOrganizationSettings

  @IsOptional()
  @IsInstance(ChatbotModelResponse)
  @ValidateNested()
  model?: ChatbotModelResponse

  @IsOptional()
  @IsString()
  modelName?: string

  @IsOptional()
  @IsString()
  prompt?: string

  @IsOptional()
  @IsNumber()
  similarityThresholdDocuments?: number

  @IsOptional()
  @IsNumber()
  similarityThresholdQuestions?: number

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsInt()
  topK?: number
}

export class CreateDocumentAggregateBody {
  @IsString()
  title!: string

  @IsString()
  source!: string

  @IsString()
  documentText!: string

  @IsString()
  @IsOptional()
  lmsDocumentId?: string

  @IsString()
  @IsOptional()
  prefix?: string
}

export class UpdateDocumentAggregateBody {
  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  source?: string

  @IsString()
  @IsOptional()
  documentText?: string

  @IsString()
  @IsOptional()
  lmsDocumentId?: string

  @IsString()
  @IsOptional()
  prefix?: string
}

export class UploadDocumentAggregateBody {
  @IsString()
  source!: string

  @Transform((params) =>
    params.value === 'true'
      ? true
      : params.value === 'false'
        ? false
        : undefined,
  )
  @IsBoolean()
  @IsOptional()
  parseAsPng?: boolean

  @IsString()
  @IsOptional()
  lmsDocumentId?: string

  @IsString()
  @IsOptional()
  prefix?: string
}

export class UploadURLDocumentAggregateBody {
  @IsString()
  url!: string

  @IsString()
  @IsOptional()
  source?: string

  @Transform((params) =>
    params.value === 'true'
      ? true
      : params.value === 'false'
        ? false
        : undefined,
  )
  @IsBoolean()
  @IsOptional()
  parseAsPng?: boolean

  @IsString()
  @IsOptional()
  lmsDocumentId?: string

  @IsString()
  @IsOptional()
  prefix?: string
}

export class CloneCourseDocumentsBody {
  @IsOptional()
  @IsBoolean()
  includeDocuments?: boolean

  @IsOptional()
  @IsBoolean()
  includeInsertedQuestions?: boolean
  @IsOptional()
  @IsBoolean()
  includeInsertedDocuments?: boolean

  @IsObject()
  docIdMap!: Record<string, string>
}

export class CreateDocumentChunkBody {
  @IsString()
  content!: string

  @IsEnum(DocumentType)
  type!: DocumentType

  @IsBoolean()
  @IsOptional()
  disabled?: boolean

  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  source?: string

  @IsArray({ each: true })
  @Type(() => Number)
  @IsOptional()
  lines?: [number, number]

  @IsInt()
  @IsOptional()
  pageNumber?: number

  @IsInt()
  @IsOptional()
  asyncQuestionId?: number

  @IsString()
  @IsOptional()
  aggregateId?: string

  @IsString()
  @IsOptional()
  questionId?: string

  @IsString()
  @IsOptional()
  prefix?: string
}

export class UpdateDocumentChunkBody {
  @IsString()
  @IsOptional()
  content?: string

  @IsEnum(DocumentType)
  @IsOptional()
  type?: DocumentType

  @IsBoolean()
  @IsOptional()
  disabled?: boolean

  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  source?: string

  @IsArray({ each: true })
  @Type(() => Number)
  @IsOptional()
  lines?: [number, number]

  @IsInt()
  @IsOptional()
  pageNumber?: number

  @IsInt()
  @IsOptional()
  asyncQuestionId?: number

  @IsString()
  @IsOptional()
  aggregateId?: string

  @IsString()
  @IsOptional()
  questionId?: string

  @IsString()
  @IsOptional()
  prefix?: string
}

export class CreateQuestionBody {
  @IsString()
  question!: string

  @IsString()
  answer!: string

  @IsArray()
  @Type(() => String)
  @IsOptional()
  @ValidateNested({ each: true })
  sourceDocumentIds?: string[]

  @IsBoolean()
  @IsOptional()
  verified?: boolean

  @IsBoolean()
  @IsOptional()
  suggested?: boolean
}

export class UpdateQuestionBody extends CreateQuestionBody {
  @IsString()
  @IsOptional()
  question!: string

  @IsString()
  @IsOptional()
  answer!: string
}

export class SuggestedQuestionResponse {
  @IsString()
  id!: string

  @IsInt()
  courseId!: number

  @IsString()
  question!: string

  @IsString()
  answer!: string

  @IsDate()
  askedAt!: Date

  @IsBoolean()
  verified!: boolean

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Citation)
  citations!: Citation[]
}

export class ChatbotCourseSettingsResponse extends ChatbotCourseSettingsProperties {
  @IsInt()
  courseId!: number
}

export class ChatbotDocumentAggregateResponse {
  @IsString()
  id!: string

  @IsInt()
  courseId!: number

  @IsString()
  title!: string

  @IsEnum(DocumentType)
  type!: DocumentType

  @IsString()
  source!: string

  @IsString()
  @IsOptional()
  lmsDocumentId?: string

  @IsArray()
  @Type(() => ChatbotDocumentResponse)
  @ValidateNested({ each: true })
  subDocuments!: ChatbotDocumentResponse[]
}

export class ChatbotQuestionResponse {
  @IsString()
  id!: string

  @IsInt()
  courseId!: number

  @IsString()
  question!: string

  @IsString()
  answer!: string

  @IsDate()
  @Transform((params) => new Date(params.value))
  askedAt!: Date

  @IsBoolean()
  inserted!: boolean

  @IsBoolean()
  suggested!: boolean

  @IsBoolean()
  verified!: boolean

  @IsArray()
  @Type(() => ChatbotDocumentResponse)
  insertedDocuments!: ChatbotDocumentResponse[]

  @IsArray()
  @Type(() => ChatbotCitationResponse)
  @ValidateNested({ each: true })
  citations!: ChatbotCitationResponse[]
}

export class ChatbotDocumentResponse {
  @IsString()
  id!: string

  @IsInt()
  courseId!: number

  @IsString()
  content!: string

  @IsEnum(DocumentType)
  type!: DocumentType

  @IsBoolean()
  disabled!: boolean

  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  source?: string

  @IsArray()
  @Type(() => Number)
  @ValidateNested({ each: true })
  lines?: [number, number]

  @IsInt()
  @IsOptional()
  pageNumber?: number

  @IsInt()
  @IsOptional()
  asyncQuestionId?: number

  @IsDate()
  @Transform((params) => new Date(params.value))
  firstInsertedAt!: Date

  @IsArray()
  @Type(() => ChatbotDocumentQueryResponse)
  @ValidateNested({ each: true })
  queries!: ChatbotDocumentQueryResponse[]

  @IsArray()
  @Type(() => ChatbotCitationResponse)
  @ValidateNested({ each: true })
  citations!: ChatbotCitationResponse[]

  @IsString()
  @IsOptional()
  aggregateId?: string

  @IsString()
  @IsOptional()
  questionId?: string

  @IsInstance(ChatbotQuestionResponse)
  @IsOptional()
  parentQuestion?: ChatbotQuestionResponse

  @IsInstance(ChatbotDocumentAggregateResponse)
  @IsOptional()
  aggregate?: ChatbotDocumentAggregateResponse
}

export class ChatbotDocumentQueryResponse {
  @IsString()
  id!: string

  @IsString()
  documentId!: string

  @IsString()
  query!: string

  @IsInstance(ChatbotDocumentResponse)
  document!: ChatbotDocumentResponse
}

export class ChatbotCitationResponse {
  @IsString()
  documentId!: string

  @IsString()
  questionId!: string

  @IsDate()
  citedAt!: Date

  @IsNumber()
  @IsOptional()
  confidence?: number

  @IsInstance(ChatbotQuestionResponse)
  question!: ChatbotQuestionResponse

  @IsInstance(ChatbotDocumentResponse)
  document!: ChatbotDocumentResponse
}

export class ChatbotDocumentListResponse {
  @IsString()
  @IsOptional()
  aggregateId?: string

  @IsString()
  type!: 'aggregate' | 'chunk'

  @IsString()
  title!: string

  @IsArray()
  @Type(() => ChatbotDocumentResponse)
  @ValidateNested({ each: true })
  documents!: ChatbotDocumentResponse[]
}

export class GenerateDocumentQueryBody {
  @IsBoolean()
  @IsOptional()
  deleteOld?: boolean
}

export class UpsertDocumentQueryBody {
  @IsString()
  query!: string
}
