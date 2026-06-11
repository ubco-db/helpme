import { Controller, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}
}
