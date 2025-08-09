import { Controller } from '@nestjs/common';
import LTIService from './lti.service';

@Controller('lti')
export class LTIController {
  constructor(private ltiService: LTIService) {}
}
