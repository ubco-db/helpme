import {
  AddDocumentChunkParams,
  AlertDeliveryMode,
  AlertType,
  ANONYMOUS_ANIMAL_AVATAR,
  asyncQuestionStatus,
  asyncQuestionStatusDisplayMap,
  AsyncQuestionUpdatePayload,
  AsyncQuestionUpdateSubtype,
  getAnonAnimal,
  MailServiceType,
  parseThinkBlock,
  Role,
} from '@koh/common';
import { Injectable } from '@nestjs/common';
import { MailService } from 'mail/mail.service';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserModel } from 'profile/user.entity';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import * as Sentry from '@sentry/nestjs';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { SentEmailModel } from '../mail/sent-email.entity';
import { DataSource } from 'typeorm';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { AlertModel } from '../alerts/alerts.entity';

@Injectable()
export class AsyncQuestionService {
  constructor(
    private readonly mailService: MailService,
    private readonly chatbotApiService: ChatbotApiService,
    private dataSource: DataSource,
  ) {}

  /**
   * Calculates perceived brightness of a hex color (0-255 scale).
   * Used to pick black/white text color for contrast on colored pill backgrounds.
   */
  private getBrightness(hexColor: string): number {
    const rgb = parseInt(hexColor.replace('#', ''), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  /**
   * Converts a subset of markdown to email-safe HTML using only inline styles.
   * Handles: headers, bold, italic, code blocks, inline code, links,
   * unordered/ordered lists, blockquotes, horizontal rules, and line breaks.
   *
   * This is purposefully simple — email clients strip <style> tags and class names,
   * so every element gets its styles inlined.
   */
  private markdownToEmailHtml(markdown: string): string {
    if (!markdown) return '';

    let html = markdown;

    // Escape HTML entities (but preserve markdown syntax chars)
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks: ```lang\n...\n```
    html = html.replace(
      /```[\w]*\n([\s\S]*?)```/g,
      (_, code) =>
        `<pre style="background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:12px 16px;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${code.trim()}</pre>`,
    );

    // Inline code: `code`
    html = html.replace(
      /`([^`\n]+)`/g,
      '<code style="background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:3px;padding:1px 4px;font-family:\'Courier New\',Courier,monospace;font-size:0.9em;">$1</code>',
    );

    // Headers: # through ####
    html = html.replace(
      /^#### (.+)$/gm,
      '<p style="font-size:14px;font-weight:700;margin:12px 0 4px 0;">$1</p>',
    );
    html = html.replace(
      /^### (.+)$/gm,
      '<p style="font-size:15px;font-weight:700;margin:12px 0 4px 0;">$1</p>',
    );
    html = html.replace(
      /^## (.+)$/gm,
      '<p style="font-size:16px;font-weight:700;margin:14px 0 4px 0;">$1</p>',
    );
    html = html.replace(
      /^# (.+)$/gm,
      '<p style="font-size:18px;font-weight:700;margin:16px 0 4px 0;">$1</p>',
    );

    // Bold: **text** or __text__
    html = html.replace(
      /\*\*(.+?)\*\*/g,
      '<strong style="font-weight:700;">$1</strong>',
    );
    html = html.replace(
      /__(.+?)__/g,
      '<strong style="font-weight:700;">$1</strong>',
    );

    // Italic: *text* or _text_ (but not inside words)
    html = html.replace(/\*(.+?)\*/g, '<em style="font-style:italic;">$1</em>');
    html = html.replace(
      /(?<!\w)_(.+?)_(?!\w)/g,
      '<em style="font-style:italic;">$1</em>',
    );

    // Links: [text](url)
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:#2563eb;text-decoration:underline;">$1</a>',
    );

    // Blockquotes: > text (multi-line)
    html = html.replace(
      /^&gt; (.+)$/gm,
      '<div style="border-left:3px solid #d1d5db;padding-left:12px;margin:8px 0;color:#6b7280;font-style:italic;">$1</div>',
    );

    // Horizontal rules: --- or *** or ___
    html = html.replace(
      /^(---|___|\*\*\*)$/gm,
      '<hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0;" />',
    );

    // Unordered lists: lines starting with - or *
    html = html.replace(/^[\-\*] (.+)$/gm, (_, item) => {
      return `<li style="margin-left:20px;padding-left:4px;list-style-type:disc;">${item}</li>`;
    });

    // Ordered lists: lines starting with 1. 2. etc.
    html = html.replace(/^\d+\. (.+)$/gm, (_, item) => {
      return `<li style="margin-left:20px;padding-left:4px;list-style-type:decimal;">${item}</li>`;
    });

    // Wrap consecutive <li> in <ul> or <ol> (simplified: all as <ul> since we can't distinguish after the regex)
    html = html.replace(
      /((?:<li[^>]*>.*?<\/li>\s*)+)/g,
      '<ul style="margin:8px 0;padding-left:8px;">$1</ul>',
    );

    // Line breaks: double newline -> paragraph break, single newline -> <br>
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  /**
   * Constructs an email-safe HTML card for an async question.
   * Uses only inline styles (no Tailwind, no class names) for maximum email client compatibility.
   * Layout mirrors the frontend AsyncQuestionCard component.
   */
  private constructAsyncQuestionCard(
    question: AsyncQuestionModel,
    options: {
      /** Show the vote score on the left side of the card. Default: false */
      showVotes?: boolean;
      /**
       * Show the question author.
       * - false: hidden (default)
       * - true: show the real name (question.creator.name)
       * - 'anon-animal': show "Anonymous Sheep", "Anonymous Bat", etc.
       */
      showAuthor?: boolean | 'anon-animal' | 'anon-animal-you';
      /** Show a pill for the question's visibility (Public/Private). Default: false */
      showVisibilityPill?: boolean;
      /** Show a pill for the question's status. Default: false */
      showStatusPill?: boolean;
      /**
       * Show the AI answer (before) and human-edited answer (after) in a before/after diff style.
       * When true, both aiAnswerText and answerText are rendered.
       * When false, only answerText is shown (if present).
       * Default: false
       */
      showAiAnswerBeforeAfter?: boolean;
      /* Just changes the text to say "AI Answer" instead of "Answer" */
      displayAnswerAsAiAnswer?: boolean;
    } = {},
  ): string {
    const {
      showVotes = false,
      showAuthor = false,
      showVisibilityPill = false,
      showStatusPill = false,
      showAiAnswerBeforeAfter = false,
      displayAnswerAsAiAnswer = false,
    } = options;

    // --- Vote column ---
    const voteHtml = showVotes
      ? `<td style="vertical-align:top;text-align:center;padding:16px 12px 16px 16px;width:48px;">
           <div style="font-size:18px;font-weight:700;color:#374151;">
             ${question.votesSum ?? 0}
           </div>
           <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">votes</div>
         </td>`
      : '';

    // --- Author line ---
    let authorHtml = '';
    if (showAuthor && question.creator) {
      let authorName: string;
      if (showAuthor === 'anon-animal') {
        const anonId = this.getAnonId(question.creatorId, question.id);
        authorName = `Anonymous ${getAnonAnimal(anonId)}`;
      } else if (showAuthor === 'anon-animal-you') {
        const anonId = this.getAnonId(question.creatorId, question.id);
        authorName = `Anonymous ${getAnonAnimal(anonId)} <i style="color:#5ca150;">(You)</i>`;
      } else {
        authorName = question.creator.name ?? 'Anonymous';
      }
      authorHtml = `<div style="font-size:13px;color:#6b7280;margin-bottom:6px;">
        <span style="font-weight:600;color:#374151;">${authorName}</span>
      </div>`;
    }

    // --- Question type pills ---
    let questionTypePillsHtml = '';
    if (question.questionTypes?.length > 0) {
      const pills = question.questionTypes
        .map((qt) => {
          const bgColor = qt.color || '#e5e7eb';
          const textColor =
            this.getBrightness(bgColor) < 128 ? '#ffffff' : '#000000';
          return `<span style="display:inline-block;background-color:${bgColor};color:${textColor};border-radius:12px;padding:2px 10px;font-size:12px;margin-right:4px;margin-bottom:4px;">${qt.name}</span>`;
        })
        .join('');
      questionTypePillsHtml = `<div style="margin-bottom:8px;">${pills}</div>`;
    }

    // --- Status pill ---
    let statusPillHtml = '';
    if (showStatusPill) {
      const statusLabel = !question.answerText
        ? 'Awaiting Answer'
        : (asyncQuestionStatusDisplayMap[question.status] ?? question.status);
      const isHumanAnswered =
        question.status === asyncQuestionStatus.HumanAnswered;
      const statusBg = isHumanAnswered ? '#dcfce7' : '#fef9c3';
      const statusColor = isHumanAnswered ? '#166534' : '#854d0e';
      const statusBorder = isHumanAnswered ? '#bbf7d0' : '#fde68a';
      statusPillHtml = `<span style="display:inline-block;background-color:${statusBg};color:${statusColor};border:1px solid ${statusBorder};border-radius:12px;padding:2px 10px;font-size:12px;margin-right:4px;margin-bottom:4px;">${statusLabel}</span>`;
    }

    // --- Visibility pill ---
    let visibilityPillHtml = '';
    if (showVisibilityPill) {
      const isPublic =
        question.staffSetVisible === true ||
        (question.staffSetVisible == null && question.authorSetVisible);
      const visLabel = isPublic ? '👁 Public' : '🔒 Private';
      const visBg = isPublic ? '#dbeafe' : '#f3f4f6';
      const visColor = isPublic ? '#1e40af' : '#6b7280';
      const visBorder = isPublic ? '#bfdbfe' : '#e5e7eb';
      visibilityPillHtml = `<span style="display:inline-block;background-color:${visBg};color:${visColor};border:1px solid ${visBorder};border-radius:12px;padding:2px 10px;font-size:12px;margin-right:4px;margin-bottom:4px;">${visLabel}</span>`;
    }

    // --- Pills row ---
    const pillsHtml =
      questionTypePillsHtml || statusPillHtml || visibilityPillHtml
        ? `<div style="margin-bottom:10px;">${questionTypePillsHtml}${visibilityPillHtml}${statusPillHtml}</div>`
        : '';

    // --- Question abstract ---
    const abstractHtml = question.questionAbstract
      ? `<p style="font-weight:700;font-size:15px;margin:0 0 8px 0;color:#111827;">${question.questionAbstract}</p>`
      : '';

    // --- Question text (markdown-rendered) ---
    const questionTextHtml = question.questionText
      ? `<div style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:12px;">${this.markdownToEmailHtml(question.questionText)}</div>`
      : '';

    // --- Answer section ---
    let answerHtml = '';
    if (
      showAiAnswerBeforeAfter &&
      question.aiAnswerText &&
      question.answerText
    ) {
      // Before/After view: show original AI answer and then the current (edited) answer
      const { cleanAnswer: cleanAiAnswer } = parseThinkBlock(
        question.aiAnswerText,
      );
      const { cleanAnswer: cleanCurrentAnswer } = parseThinkBlock(
        question.answerText,
      );
      answerHtml = `
        <div style="margin-top:12px;">
          <p style="font-weight:700;font-size:14px;margin:0 0 4px 0;color:#111827;">Original AI Answer:</p>
          <div style="font-size:14px;color:#6b7280;line-height:1.6;padding:10px 12px;background-color:#fef9c3;border:1px solid #fde68a;border-radius:6px;margin-bottom:10px;">${this.markdownToEmailHtml(cleanAiAnswer)}</div>
          <p style="font-weight:700;font-size:14px;margin:0 0 4px 0;color:#111827;">Updated Answer:</p>
          <div style="font-size:14px;color:#374151;line-height:1.6;padding:10px 12px;background-color:#dcfce7;border:1px solid #bbf7d0;border-radius:6px;">${this.markdownToEmailHtml(cleanCurrentAnswer)}</div>
        </div>`;
    } else if (question.answerText) {
      const { cleanAnswer } = parseThinkBlock(question.answerText);
      answerHtml = `
        <div style="margin-top:12px;">
          <p style="font-weight:700;font-size:14px;margin:0 0 4px 0;color:#111827;">${displayAnswerAsAiAnswer ? 'AI Answer:' : 'Answer:'}</p>
          <div style="font-size:14px;color:#374151;line-height:1.6;">${this.markdownToEmailHtml(cleanAnswer)}</div>
        </div>`;
    }

    // --- Assemble the card ---
    return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;border-collapse:collapse;margin:12px 0;">
      <tr>
        <td style="padding:0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              ${voteHtml}
              <td style="vertical-align:top;padding:16px ${showVotes ? '16px 16px 8px' : '16px'};">
                ${authorHtml}
                ${pillsHtml}
                ${abstractHtml}
                ${questionTextHtml}
                ${answerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
  }

  /**
   * Constructs a simple email-safe HTML card for a comment.
   * Renders the comment text with basic markdown formatting.
   * @param options.showAuthor - false (default), true (real name), or 'anon-animal' (anonymous animal name)
   */
  private constructCommentCard(
    comment: AsyncQuestionCommentModel,
    options?: {
      showAuthor?: boolean | 'anon-animal' | 'anon-animal-you';
    },
  ): string {
    const { showAuthor = false } = options ?? {};
    const commentHtml = this.markdownToEmailHtml(comment.commentText ?? '');

    let authorHtml = '';
    if (showAuthor) {
      let authorName: string;
      if (showAuthor === 'anon-animal') {
        const anonId = this.getAnonId(comment.creatorId, comment.questionId);
        authorName = `Anonymous ${getAnonAnimal(anonId)}`;
      } else if (showAuthor === 'anon-animal-you') {
        const anonId = this.getAnonId(comment.creatorId, comment.questionId);
        authorName = `Anonymous ${getAnonAnimal(anonId)} <i style="color:#5ca150;">(You)</i>`; // green "(You)"
      } else if (showAuthor === true && comment.creator) {
        authorName = comment.creator.name ?? 'Anonymous';
      } else {
        authorName = 'Anonymous';
      }
      authorHtml = `<div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px;">${authorName}</div>`;
    }

    return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;border-collapse:collapse;margin:6px 0 6px 20px;">
      <tr>
        <td style="padding:10px 14px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
          ${authorHtml}
          <div style="font-size:13px;color:#374151;line-height:1.5;">${commentHtml}</div>
        </td>
      </tr>
    </table>`;
  }

  private shortenedQuestionText(
    question: AsyncQuestionModel,
    maxLength: number = 40,
  ): string {
    const questionText =
      question.questionText ?? question.questionAbstract ?? '';
    return (
      questionText.slice(0, maxLength) +
      (questionText.length > maxLength ? '...' : '')
    );
  }
  private shortenedCommentText(
    comment: AsyncQuestionCommentModel,
    maxLength: number = 150,
  ): string {
    const commentText = comment.commentText ?? '';
    return (
      commentText.slice(0, maxLength) +
      (commentText.length > maxLength ? '...' : '')
    );
  }
  private shortenedAnswerText(
    answerText: string,
    maxLength: number = 150,
  ): string {
    const cleanAnswer = parseThinkBlock(answerText).cleanAnswer;
    return (
      cleanAnswer.slice(0, maxLength) +
      (cleanAnswer.length > maxLength ? '...' : '')
    );
  }

  async sendNewCommentOnMyQuestionEmailAndAlert(
    commenter: UserModel,
    commenterRole: Role,
    question: AsyncQuestionModel,
    comment: AsyncQuestionCommentModel,
  ) {
    if (!question.creator) {
      return;
    }
    const subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: question.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST,
        },
      },
      relations: { service: true },
    });
    if (subscription) {
      const commenterIsStaff =
        commenterRole === Role.TA || commenterRole === Role.PROFESSOR;
      const service = subscription.service;
      // note: not awaiting since it can take a moment to send emails
      this.mailService
        .sendEmail({
          receiverOrReceivers: question.creator.email,
          type: service.serviceType,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on Your Anytime Question`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on your Anytime Question:</b> 
          <br>
                ${this.constructAsyncQuestionCard(question, {
                  showStatusPill: true,
                  showAuthor: !question.isAnonymous ? true : 'anon-animal-you',
                })}
                 <br><p>The new comment:</p>
                ${this.constructCommentCard(comment, {
                  showAuthor:
                    commenterIsStaff || !comment.isAnonymous
                      ? true
                      : 'anon-animal',
                })}
                <br>
                <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre"><b>View and Answer It Here</b></a> <br>`,
        })
        .catch((err) => {
          console.error(
            'Failed to send email Post Comment (on my post) email: ' + err,
          );
          Sentry.captureException(err);
        });
    }

    const commenterIsStaff =
      commenterRole === Role.TA || commenterRole === Role.PROFESSOR;
    await AlertModel.create({
      alertType: AlertType.ASYNC_QUESTION_UPDATE,
      deliveryMode: AlertDeliveryMode.FEED,
      userId: question.creator.id,
      courseId: question.courseId,
      payload: {
        courseId: question.courseId,
        questionId: question.id,
        subtype: AsyncQuestionUpdateSubtype.COMMENT_ON_MY_POST,
        summary: `${commenterIsStaff ? commenter.name : 'Someone'} commented "${this.shortenedCommentText(comment)}" on your Anytime Question "${this.shortenedQuestionText(question)}"`,
      } satisfies AsyncQuestionUpdatePayload,
    }).save();
  }

  /*send emails out to all users that have posted a comment on this question.
      Note that updatedQuestion must have comments and comments.creator relations
      */
  async sendNewCommentOnOtherQuestionEmailAndAlert(
    commenter: UserModel,
    commenterRole: Role,
    questionCreatorId: number,
    updatedQuestion: AsyncQuestionModel,
    comment: AsyncQuestionCommentModel,
  ) {
    // first make a list of userIds of all users that have posted a comment on this question (excluding the user that just posted the comment and the question creator)
    const userIds = updatedQuestion.comments
      .filter(
        (comment) =>
          comment.creator.id !== commenter.id &&
          comment.creator.id !== questionCreatorId,
      )
      .map((comment) => comment.creator.id);
    if (userIds.length === 0) {
      return;
    }
    // Now get subscriptions for these users
    const subscriptions = await UserSubscriptionModel.createQueryBuilder(
      'subscription',
    )
      .innerJoinAndSelect('subscription.user', 'user')
      .innerJoinAndSelect('subscription.service', 'service')
      .where('subscription.userId IN (:...userIds)', { userIds })
      .andWhere('service.serviceType = :serviceType', {
        serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
      })
      .andWhere('subscription.isSubscribed = true')
      .getMany();
    // Send emails in parallel
    const commenterIsStaff =
      commenterRole === Role.TA || commenterRole === Role.PROFESSOR;
    // note: not awaiting since it can take a moment to send emails
    Promise.allSettled(
      subscriptions.map((sub) =>
        this.mailService.sendEmail({
          receiverOrReceivers: sub.user.email,
          type: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
          subject: `HelpMe - ${commenterIsStaff ? commenter.name : 'Someone'} Commented on an Anytime Question You Commented on`,
          content: `<br> <b>${commenterIsStaff ? commenter.name : 'Someone'} has commented on an Anytime Question you previously commented on. The Anytime Question:</b>
                    <br>
                    ${this.constructAsyncQuestionCard(updatedQuestion, {
                      showStatusPill: true,
                      showAuthor: !updatedQuestion.isAnonymous
                        ? true
                        : 'anon-animal',
                    })}
                    <br>
                    <p>The new comment:</p>
                    ${this.constructCommentCard(comment, { showAuthor: commenterIsStaff || !comment.isAnonymous ? true : 'anon-animal' })}
                    <br>
                    <br> Note: Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View and Reply Here</a> <br>`,
        }),
      ),
    ).then((sendEmailResults) => {
      // Capture any email failures in Sentry
      sendEmailResults.forEach((result) => {
        if (result.status === 'rejected') {
          Sentry.captureException(result.reason);
        }
      });
    });
    // FEED alerts to all participants who commented (excluding current commenter and creator), regardless of email subscriptions
    const participantIds = Array.from(
      new Set(
        updatedQuestion.comments
          .map((c) => c.creator.id)
          .filter((id) => id !== commenter.id && id !== questionCreatorId),
      ),
    );
    await Promise.all(
      participantIds.map((uid) =>
        AlertModel.create({
          alertType: AlertType.ASYNC_QUESTION_UPDATE,
          deliveryMode: AlertDeliveryMode.FEED,
          userId: uid,
          courseId: updatedQuestion.courseId,
          payload: {
            courseId: updatedQuestion.courseId,
            questionId: updatedQuestion.id,
            subtype: AsyncQuestionUpdateSubtype.COMMENT_ON_OTHERS_POST,
            summary: `${commenterIsStaff ? commenter.name : 'Someone'} commented "${this.shortenedCommentText(comment)}" on the Anytime Question: ${this.shortenedQuestionText(updatedQuestion)}`,
          } satisfies AsyncQuestionUpdatePayload,
        }).save(),
      ),
    );
  }

  async sendNeedsAttentionEmail(question: AsyncQuestionModel) {
    // Step 1: Get all staff members in the course
    const usersInCourse = await UserCourseModel.createQueryBuilder('userCourse')
      .select('userCourse.userId')
      .where('userCourse.courseId = :courseId', { courseId: question.courseId })
      .andWhere('userCourse.role IN (:...roles)', {
        roles: [Role.PROFESSOR, Role.TA],
      })
      .getMany();

    const userIds = usersInCourse.map((uc) => uc.userId);
    if (userIds.length === 0) {
      return;
    }

    // Step 2: Get subscriptions for these users
    const subscriptions = await UserSubscriptionModel.createQueryBuilder(
      'subscription',
    )
      .innerJoinAndSelect('subscription.user', 'user')
      .innerJoinAndSelect('subscription.service', 'service')
      .where('subscription.userId IN (:...userIds)', { userIds })
      .andWhere('service.serviceType = :serviceType', {
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      })
      .andWhere('subscription.isSubscribed = true')
      .getMany();

    // Send emails in parallel
    // note: not awaiting since it can take a moment to send emails

    if (subscriptions.length == 0) return;

    this.mailService
      .sendEmail({
        receiverOrReceivers: subscriptions.map((s) => s.user.email),
        type: MailServiceType.ASYNC_QUESTION_FLAGGED,
        subject: 'HelpMe - New Question Marked as Needing Attention',
        content: `<br> <b>A new question has been posted on the Anytime Question Hub and has been marked as needing attention:</b> 
                    <br>
                    ${this.constructAsyncQuestionCard(question, {
                      showStatusPill: true,
                      showAuthor: true,
                      showVisibilityPill: true,
                      displayAnswerAsAiAnswer: true,
                    })}
                    <br>
                    <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View and Answer It Here</a> <br>`,
        track: true,
        metadata: {
          asyncQuestionId: question.id,
        },
      })
      .catch((err) => Sentry.captureException(err));
  }

  async sendQuestionAnsweredEmails(question: AsyncQuestionModel) {
    await this.sendQuestionAnsweredFollowup(question).catch((err) => {
      console.error(err);
      Sentry.captureException(err);
    });

    const subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: question.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
        },
      },
      relations: { service: true },
    });

    if (subscription) {
      const service = subscription.service;

      this.mailService
        .sendEmail({
          receiverOrReceivers: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Answered',
          content: `<br> <b>Your question on the Anytime Question Hub has been answered or verified by staff.</b> 
              <br>
              ${this.constructAsyncQuestionCard(question, {
                showStatusPill: true,
                showAuthor: true,
                showVisibilityPill: true,
                showAiAnswerBeforeAfter: true,
              })}
              <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Human Answered email: ' + err);
          Sentry.captureException(err);
        });
      await AlertModel.create({
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        deliveryMode: AlertDeliveryMode.FEED,
        userId: question.creator.id,
        courseId: question.courseId,
        payload: {
          courseId: question.courseId,
          questionId: question.id,
          subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
          summary: `"${this.shortenedQuestionText(question)}" has been answered by staff: ${this.shortenedAnswerText(question.answerText)}`,
        } satisfies AsyncQuestionUpdatePayload,
      }).save();
    }
  }

  async sendQuestionAnsweredFollowup(question: AsyncQuestionModel) {
    const needsAttentionEmails = await SentEmailModel.createQueryBuilder('se')
      .select()
      .where('se.serviceType = :serviceType', {
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      })
      .andWhere('se.metadata @> :metadata', {
        metadata: { asyncQuestionId: question.id },
      })
      .getMany();

    if (needsAttentionEmails.length > 0) {
      Promise.allSettled([
        needsAttentionEmails.map(async (email) =>
          this.mailService.replyToSentEmail(
            email,
            `<br> <b>This is a follow-up notice. The anytime question referenced by the previous email has now received an answer.</b>
           <br> No further intervention is required at this time.
           <br> 
           ${this.constructAsyncQuestionCard(question, {
             showStatusPill: true,
             showAuthor: true,
             showVisibilityPill: true,
             showAiAnswerBeforeAfter: true,
           })}
           <br>
           <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View It Here</a> <br>`,
          ),
        ),
      ]).then((results) => {
        for (const result of results) {
          if (result.status == 'rejected') {
            Sentry.captureException(result.reason);
          }
        }
      });
    }
  }

  /* Not really used right now since the only status that staff can change is changing it to "Human Answered" */
  async sendGenericStatusChangeEmailAndAlert(
    question: AsyncQuestionModel,
    status: string,
  ) {
    //send generic your async question changed.
    const statusChangeSubscription = await UserSubscriptionModel.findOne({
      where: {
        userId: question.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
        },
      },
      relations: { service: true },
    });

    if (statusChangeSubscription) {
      const service = statusChangeSubscription.service;
      // note: not awaiting since it can take a moment to send emails
      this.mailService
        .sendEmail({
          receiverOrReceivers: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Status Has Changed',
          content: `<br> <b>The status of your question on the Anytime Question Hub has been updated by a staff member.</b> 
                  <br><br> New status: "${status}"
                  <br>
                  ${this.constructAsyncQuestionCard(question, {
                    showStatusPill: true,
                  })}
                  <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Status Changed email: ' + err);
          Sentry.captureException(err);
        });
      await AlertModel.create({
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        deliveryMode: AlertDeliveryMode.FEED,
        userId: question.creator.id,
        courseId: question.courseId,
        payload: {
          courseId: question.courseId,
          questionId: question.id,
          subtype: AsyncQuestionUpdateSubtype.STATUS_CHANGED,
          summary: `Your Anytime Question "${this.shortenedQuestionText(question)}" had its status changed to "${status}".`,
        } satisfies AsyncQuestionUpdatePayload,
      }).save();
    }
  }

  async sendUpvotedEmailAndAlert(updatedQuestion: AsyncQuestionModel) {
    const subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: updatedQuestion.creator.id,
        isSubscribed: true,
        service: {
          serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
        },
      },
      relations: { service: true },
    });

    if (subscription) {
      const service = subscription.service;
      // note: not awaiting since it can take a moment to send emails
      this.mailService
        .sendEmail({
          receiverOrReceivers: updatedQuestion.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Upvoted',
          content: `<br> <b>Your question on the Anytime Question Hub has received an upvote.</b> 
        <br>
        ${this.constructAsyncQuestionCard(updatedQuestion, {
          showStatusPill: true,
          showVisibilityPill: true,
          showVotes: true,
        })}
          <br> <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View Here</a> <br>`,
        })
        .catch((err) => {
          console.error('Failed to send email Vote Question email: ' + err);
          Sentry.captureException(err);
        });
      await AlertModel.create({
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        deliveryMode: AlertDeliveryMode.FEED,
        userId: updatedQuestion.creator.id,
        courseId: updatedQuestion.courseId,
        payload: {
          courseId: updatedQuestion.courseId,
          questionId: updatedQuestion.id,
          subtype: AsyncQuestionUpdateSubtype.UPVOTED,
          summary: `"${this.shortenedQuestionText(updatedQuestion)}" received an upvote! ${updatedQuestion.votesSum > 1 ? ` Total votes: ${updatedQuestion.votesSum}` : ``}`,
        } satisfies AsyncQuestionUpdatePayload,
      }).save();
    }
  }

  async createUnreadNotificationsForQuestion(question: AsyncQuestionModel) {
    const usersInCourse = await UserCourseModel.find({
      where: { courseId: question.courseId },
    });

    if (usersInCourse?.length) {
      await UnreadAsyncQuestionModel.createQueryBuilder()
        .insert()
        .into(UnreadAsyncQuestionModel)
        .values(
          usersInCourse.map((userCourse) => ({
            userId: userCourse.userId,
            courseId: question.courseId,
            asyncQuestion: question,
            readLatest:
              userCourse.userId === question.creatorId ||
              userCourse.role === Role.STUDENT, // if you're the creator or a student, don't mark as unread because not yet visible
          })),
        )
        .execute();
    }
  }

  async markUnreadForRoles(
    question: AsyncQuestionModel,
    roles: Role[],
    userToNotNotifyId: number,
  ) {
    await UnreadAsyncQuestionModel.createQueryBuilder()
      .update(UnreadAsyncQuestionModel)
      .set({ readLatest: false })
      .where('asyncQuestionId = :asyncQuestionId', {
        asyncQuestionId: question.id,
      })
      .andWhere('userId != :userId', { userId: userToNotNotifyId }) // don't notify me (person who called endpoint)
      // Use a subquery to filter by roles
      .andWhere(
        `"userId" IN (
           SELECT "user_course_model"."userId"
           FROM "user_course_model"
           WHERE "user_course_model"."role" IN (:...roles)
        )`,
        { roles }, // notify all specified roles
      )
      .execute();
  }

  async markUnreadForAll(
    question: AsyncQuestionModel,
    userToNotNotifyId: number,
  ) {
    await UnreadAsyncQuestionModel.createQueryBuilder()
      .update(UnreadAsyncQuestionModel)
      .set({ readLatest: false })
      .where('asyncQuestionId = :asyncQuestionId', {
        asyncQuestionId: question.id,
      })
      .andWhere(
        `userId != :userId`,
        { userId: userToNotNotifyId }, // don't notify me (person who called endpoint)
      )
      .execute();
  }

  async markUnreadForCreator(question: AsyncQuestionModel) {
    await UnreadAsyncQuestionModel.createQueryBuilder()
      .update(UnreadAsyncQuestionModel)
      .set({ readLatest: false })
      .where('asyncQuestionId = :asyncQuestionId', {
        asyncQuestionId: question.id,
      })
      .andWhere(
        `userId = :userId`,
        { userId: question.creatorId }, // notify ONLY question creator
      )
      .execute();
  }

  /*
   */
  async upsertQAToChatbotChunk(
    question: AsyncQuestionModel,
    courseId: number,
    userToken: string,
  ) {
    // Since the name can take up quite a bit of space, no more than 40 characters (show ... if longer)
    const chunkName = `Previously Asked Anytime Question: ${(question.questionAbstract ?? question.questionText).slice(0, 40)}${(question.questionAbstract ?? question.questionText).length > 40 ? '...' : ''}`;
    const chunkParams: AddDocumentChunkParams = {
      documentText: `${this.formatQuestionTextForChatbot(question)}\n\nAnswer: ${question.answerText}`,
      metadata: {
        name: chunkName,
        type: 'inserted_question',
        asyncQuestionId: question.id,
        source: `/course/${courseId}/async_centre`,
        courseId: courseId,
      },
    };
    // Note that because the chunk splitter will split big chunks into multiple,
    // we must first delete any existing chunks with the async question ID and then re-add them.
    await this.chatbotApiService.deleteDocumentChunksByAsyncQuestionId(
      question.id,
      courseId,
      userToken,
    );
    await this.chatbotApiService.addDocumentChunk(
      chunkParams,
      courseId,
      userToken,
    );
  }

  /* Just for formatting the details of the question for sending to the chatbot (for getting image summaries) or for a chunk. 
  Does stuff like if there's only an abstract, the abstract will just be called "Question" instead of having "Question Abstract" and "Question Text"
  */
  formatQuestionTextForChatbot(question: AsyncQuestionModel) {
    return `${question.questionText ? `Question Abstract: ${question.questionAbstract}` : `Question: ${question.questionAbstract}`}
  ${question.questionText ? `Question Text: ${question.questionText}` : ''}
  ${question.questionTypes && question.questionTypes.length > 0 ? `Question Types: ${question.questionTypes.map((questionType) => questionType.name).join(', ')}` : ''}
  `;
    // TODO: once images are added, add this: ${`Question Image Descriptions: ${question.images.map((image, idx) => `Image ${idx + 1}: ${image.aiSummary}`).join('\n')}`}
  }

  /**
   * Takes in a userId and async questionId and hashes them to return a random index
   * into ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES.
   */
  getAnonId(userId: number, questionId: number) {
    const hash = userId + questionId;
    return hash % ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES.length;
  }

  async isVisible(
    asyncQuestion: AsyncQuestionModel,
    courseSettings?: CourseSettingsModel,
  ) {
    if (!courseSettings) {
      courseSettings = await CourseSettingsModel.findOne({
        where: { courseId: asyncQuestion.id },
      });
    }
    return (courseSettings?.asyncCentreAuthorPublic ?? false)
      ? (asyncQuestion.staffSetVisible == null &&
          asyncQuestion.authorSetVisible) ||
          asyncQuestion.staffSetVisible
      : asyncQuestion.staffSetVisible;
  }

  /**
   * Returns a map of userId -> number of staff-endorsed comments for that user
   * in the given course. Uses a single aggregate query rather than a stored counter.
   */
  async getEndorsedCountByCourse(
    courseId: number,
  ): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .createQueryBuilder(AsyncQuestionCommentModel, 'c')
      .innerJoin('c.question', 'q', 'q.courseId = :courseId', { courseId })
      .select('c.creatorId', 'creatorId')
      .addSelect('COUNT(*)', 'count')
      .where('c.endorsedById IS NOT NULL')
      .groupBy('c.creatorId')
      .getRawMany<{ creatorId: number; count: string }>();
    return new Map(rows.map((r) => [r.creatorId, parseInt(r.count, 10)]));
  }
}
