import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AsyncQuestionModel } from './asyncQuestion.entity';

@Entity('async_question_image_model')
export class AsyncQuestionImageModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  imageId: number;

  @Column()
  asyncQuestionId: number;

  @ManyToOne((type) => AsyncQuestionModel, (question) => question.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'asyncQuestionId' })
  asyncQuestion: AsyncQuestionModel;

  @Column()
  originalFileName: string;

  @Column()
  newFileName: string;

  @Column({ type: 'bytea', select: false }) // don't include these in select statements unless you specifically ask for them
  imageBuffer: Buffer;

  @Column({ type: 'bytea', select: false })
  previewImageBuffer: Buffer;

  @Column({ default: 0 })
  imageSizeBytes: number;

  @Column({ default: 0 })
  previewImageSizeBytes: number;
}
