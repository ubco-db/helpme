import { IsString, MinLength } from 'class-validator';

export class EssayFeedbackRequestDto {
  @IsString()
  @MinLength(1)
  essay_text!: string;
}
