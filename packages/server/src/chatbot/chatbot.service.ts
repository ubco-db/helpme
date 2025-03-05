import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InteractionModel } from './interaction.entity';
import { ChatbotQuestionModel } from './question.entity';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';
import { ChatbotQuestion, InteractionParams } from '@koh/common';

export interface ChatbotResponse {
  answer: string;
  sourceDocuments: {
    [key: string]: Set<string>;
  };
  similarDocuments: {
    [key: string]: Set<string>;
  };
  similarQuestions: any[]; // TODO: Find correct datatype
}

export interface ChatQuestion {
  id: string;
  question: string;
  answer: string;
  user: string;
  sourceDocuments: {
    name: string;
    type: string;
    parts: string[];
  }[];
  suggested: boolean;
}

export interface ChatDocument {
  id: string;
  name: string;
  type: string;
  subDocumentIds: string[];
}

@Injectable()
export class ChatbotService {
  // Could rename 'documents' to 'resources' for more accurate wording when its not only PDFs
  // filePath currently relative

  async createInteraction(data: InteractionParams): Promise<InteractionModel> {
    const course = await CourseModel.findOne({
      where: {
        id: data.courseId,
      },
    });
    const user = await UserModel.findOne({
      where: {
        id: data.userId,
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

  async createQuestion(data: ChatbotQuestion): Promise<ChatbotQuestionModel> {
    if (!data.questionText || !data.responseText || !data.vectorStoreId) {
      throw new HttpException(
        'Missing question properties.',
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

  async editQuestion(data: ChatbotQuestion): Promise<ChatbotQuestionModel> {
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
      const tempInteraction = await InteractionModel.findOne(
        data.interactionId,
      );
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
    const interactions = await InteractionModel.find({
      where: { course: courseId },
      relations: ['questions'],
    });

    return interactions;
  }
}
