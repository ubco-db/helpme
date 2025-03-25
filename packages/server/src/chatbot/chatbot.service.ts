import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InteractionModel } from './interaction.entity';
import { ChatbotQuestionModel } from './question.entity';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';

@Injectable()
export class ChatbotService {
  // Could rename 'documents' to 'resources' for more accurate wording when its not only PDFs
  // filePath currently relative

  async createInteraction(
    courseId: number,
    userId: number,
  ): Promise<InteractionModel> {
    const course = await CourseModel.findOne({
      where: {
        id: courseId,
      },
    });
    const user = await UserModel.findOne({
      where: {
        id: userId,
      },
    });

    if (!course) {
      throw new HttpException(
        'Course not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!user) {
      throw new HttpException(
        'User not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }

    const interaction = InteractionModel.create({
      course,
      user,
      timestamp: new Date(),
    });

    return await interaction.save();
  }

  async createQuestion(data: {
    questionText: string;
    responseText: string;
    vectorStoreId: string;
    suggested: boolean;
    isPreviousQuestion: boolean;
    interactionId: number;
  }): Promise<ChatbotQuestionModel> {
    if (!data.questionText || !data.responseText || !data.vectorStoreId) {
      const missingFields = [];
      if (!data.questionText) missingFields.push('questionText');
      if (!data.responseText) missingFields.push('responseText');
      if (!data.vectorStoreId) missingFields.push('vectorStoreId');

      throw new HttpException(
        `Missing required question properties: ${missingFields.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const interaction = await InteractionModel.findOne({
      where: {
        id: data.interactionId,
      },
    });
    if (!interaction) {
      throw new HttpException(
        'Interaction not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }

    const question = ChatbotQuestionModel.create({
      interaction,
      questionText: data.questionText,
      responseText: data.responseText,
      suggested: data.suggested,
      timestamp: new Date(),
      vectorStoreId: data.vectorStoreId,
      isPreviousQuestion: data.isPreviousQuestion,
    });

    await question.save();

    return question;
  }

  // Unused, but going to leave here since it's not unlikely it will be used again in the future
  async editQuestion(data: any): Promise<ChatbotQuestionModel> {
    const question = await ChatbotQuestionModel.findOne({
      where: {
        id: data.id,
      },
    });
    if (!question) {
      throw new HttpException(
        'Question not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }
    Object.assign(question, data);
    if (data.interactionId) {
      const tempInteraction = await InteractionModel.findOne({
        where: {
          id: data.interactionId,
        },
      });
      if (!tempInteraction) {
        throw new HttpException(
          'Interaction not found based on the provided ID.',
          HttpStatus.NOT_FOUND,
        );
      }
      question.interaction = tempInteraction;
    }
    await question.save();
    return question;
  }

  async deleteQuestion(questionId: number) {
    const chatQuestion = await ChatbotQuestionModel.findOne({
      where: {
        id: questionId,
      },
    });

    if (!chatQuestion) {
      throw new HttpException(
        'Question not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }

    return await chatQuestion.remove();
  }

  async getInteractionsAndQuestions(
    courseId: number,
  ): Promise<InteractionModel[]> {
    const course = await CourseModel.findOne({
      // i hate how i have to do this
      where: {
        id: courseId,
      },
    });
    const interactions = await InteractionModel.find({
      where: { course: course },
      relations: {
        questions: true,
      },
    });

    return interactions;
  }

  async updateQuestionUserScore(questionId: number, userScore: number) {
    const question = await ChatbotQuestionModel.findOne({
      where: {
        id: questionId,
      },
    });
    if (!question) {
      throw new HttpException(
        'Question not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }
    question.userScore = userScore;
    await question.save();
    return question;
  }
}
