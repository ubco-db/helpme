import { IsString, MinLength } from 'class-validator';

export class EssayFeedbackRequestDto {
  @IsString()
  @MinLength(1)
  assignment_text!: string;
}
