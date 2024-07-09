import { Injectable } from '@nestjs/common';
import { SemesterModel } from './semester.entity';
import { CourseModel } from '../course/course.entity';

@Injectable()
export class SemesterService {
  async toggleActiveSemester(
    semester: SemesterModel,
    enable: boolean,
  ): Promise<void> {
    const enableList = await CourseModel.find({
      where: { semester: semester },
    });

    enableList.map((course) => {
      course.enabled = enable;
    });

    try {
      await CourseModel.save(enableList);
    } catch (err) {
      console.log(err);
    }
  }
}
