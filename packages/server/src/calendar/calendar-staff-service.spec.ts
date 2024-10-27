// import { Test, TestingModule } from '@nestjs/testing';
// import { CalendarService } from './calendar.service';
// import { CalendarStaffRedisService } from './calendar-staff-redis.service';
// import { CalendarStaffModel } from './calendar-staff.entity';
// import { UserModel } from 'profile/user.entity';
// import { CalendarModel } from './calendar.entity';
// import { getRepositoryToken } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { NotFoundException } from '@nestjs/common';

// describe('CalendarService', () => {
//   let service: CalendarService;
//   let calendarStaffRedisService: CalendarStaffRedisService;
//   let calendarStaffRepository: Repository<CalendarStaffModel>;
//   let userRepository: Repository<UserModel>;
//   let calendarRepository: Repository<CalendarModel>;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         CalendarService,
//         CalendarStaffRedisService,
//         {
//           provide: getRepositoryToken(CalendarStaffModel),
//           useClass: Repository,
//         },
//         {
//           provide: getRepositoryToken(UserModel),
//           useClass: Repository,
//         },
//         {
//           provide: getRepositoryToken(CalendarModel),
//           useClass: Repository,
//         },
//       ],
//     }).compile();

//     service = module.get<CalendarService>(CalendarService);
//     calendarStaffRedisService = module.get<CalendarStaffRedisService>(CalendarStaffRedisService);
//     calendarStaffRepository = module.get<Repository<CalendarStaffModel>>(getRepositoryToken(CalendarStaffModel));
//     userRepository = module.get<Repository<UserModel>>(getRepositoryToken(UserModel));
//     calendarRepository = module.get<Repository<CalendarModel>>(getRepositoryToken(CalendarModel));
//   });

//   describe('initializeCache', () => {
//     it('should initialize the cache with calendar staff data', async () => {
//       const calendarStaffData = [
//         {
//           userId: 1,
//           calendarId: 1,
//           username: 'John Doe',
//           startDate: new Date(),
//           endDate: new Date(),
//           startTime: new Date(),
//           endTime: new Date(),
//         },
//       ];

//       jest.spyOn(calendarStaffRepository, 'createQueryBuilder').mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         addSelect: jest.fn().mockReturnThis(),
//         leftJoin: jest.fn().mockReturnThis(),
//         getRawMany: jest.fn().mockResolvedValue(calendarStaffData),
//       } as any);

//       jest.spyOn(calendarStaffRedisService, 'setAllCalendarStaff').mockResolvedValue(undefined);

//       const result = await service.initializeCache();

//       expect(result).toEqual(calendarStaffData);
//       expect(calendarStaffRedisService.setAllCalendarStaff).toHaveBeenCalledWith('calendar-staff', calendarStaffData);
//     });
//   });

//   describe('createCalendarStaff', () => {
//     it('should create calendar staff and store in redis', async () => {
//       const userId = 1;
//       const calendarId = 1;
//       const user = { username: 'John Doe' };
//       const calendar = {
//         startDate: new Date(),
//         endDate: new Date(),
//         startTime: new Date(),
//         endTime: new Date(),
//       };

//       jest.spyOn(userRepository, 'createQueryBuilder').mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         where: jest.fn().mockReturnThis(),
//         getRawOne: jest.fn().mockResolvedValue(user),
//       } as any);

//       jest.spyOn(calendarRepository, 'createQueryBuilder').mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         where: jest.fn().mockReturnThis(),
//         getRawOne: jest.fn().mockResolvedValue(calendar),
//       } as any);

//       jest.spyOn(calendarStaffRepository, 'create').mockReturnValue({
//         save: jest.fn().mockResolvedValue(undefined),
//       } as any);

//       jest.spyOn(calendarStaffRedisService, 'setCalendarStaff').mockResolvedValue(undefined);

//       await service.createCalendarStaff(userId, calendarId, {} as any);

//       expect(calendarStaffRepository.create).toHaveBeenCalledWith({ userId, calendarId });
//       expect(calendarStaffRedisService.setCalendarStaff).toHaveBeenCalledWith('calendar-staff', {
//         userId,
//         calendarId,
//         username: user.username,
//         startDate: calendar.startDate,
//         endDate: calendar.endDate,
//         startTime: calendar.startTime,
//         endTime: calendar.endTime,
//       });
//     });

//     it('should throw NotFoundException if user not found', async () => {
//       const userId = 1;
//       const calendarId = 1;

//       jest.spyOn(userRepository, 'createQueryBuilder').mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         where: jest.fn().mockReturnThis(),
//         getRawOne: jest.fn().mockResolvedValue(null),
//       } as any);

//       await expect(service.createCalendarStaff(userId, calendarId, {} as any)).rejects.toThrow(NotFoundException);
//     });

//     it('should throw NotFoundException if calendar not found', async () => {
//       const userId = 1;
//       const calendarId = 1;
//       const user = { username: 'John Doe' };

//       jest.spyOn(userRepository, 'createQueryBuilder').mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         where: jest.fn().mockReturnThis(),
//         getRawOne: jest.fn().mockResolvedValue(user),
//       } as any);

//       jest.spyOn(calendarRepository, 'createQueryBuilder').mockReturnValue({
//         select: jest.fn().mockReturnThis(),
//         where: jest.fn().mockReturnThis(),
//         getRawOne: jest.fn().mockResolvedValue(null),
//       } as any);

//       await expect(service.createCalendarStaff(userId, calendarId, {} as any)).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('deleteCalendarStaff', () => {
//     it('should delete calendar staff and remove from redis', async () => {
//       const userId = 1;
//       const calendarId = 1;

//       jest.spyOn(calendarStaffRepository, 'delete').mockResolvedValue(undefined);
//       jest.spyOn(calendarStaffRedisService, 'deleteCalendarStaff').mockResolvedValue(undefined);

//       await service.deleteCalendarStaff(userId, calendarId);

//       expect(calendarStaffRepository.delete).toHaveBeenCalledWith({ userId, calendarId });
//       expect(calendarStaffRedisService.deleteCalendarStaff).toHaveBeenCalledWith('calendar-staff', userId, calendarId);
//     });
//   });

//   describe('autoCheckOutStaff', () => {
//     it('should re-initialize cache if redis count is 0', async () => {
//       jest.spyOn(calendarStaffRedisService, 'getKeyCount').mockResolvedValue(0);
//       jest.spyOn(service, 'initializeCache').mockResolvedValue(undefined);

//       await service.autoCheckOutStaff();

//       expect(service.initializeCache).toHaveBeenCalled();
//     });

//     it('should perform auto-checkout logic if redis count is greater than 0', async () => {
//       const calendarStaffData = [
//         {
//           userId: 1,
//           calendarId: 1,
//           username: 'John Doe',
//           startDate: new Date(),
//           endDate: new Date(),
//           startTime: new Date(),
//           endTime: new Date(),
//         },
//       ];

//       jest.spyOn(calendarStaffRedisService, 'getKeyCount').mockResolvedValue(1);
//       jest.spyOn(calendarStaffRedisService, 'getCalendarStaff').mockResolvedValue(calendarStaffData);

//       await service.autoCheckOutStaff();

//       expect(calendarStaffRedisService.getCalendarStaff).toHaveBeenCalledWith('calendar-staff');
//       // Add your auto-checkout logic assertions here
//     });
//   });
// });
