import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActivityLog } from 'src/modules/activity-log/entities/activity-log.entity';
import { Booking } from 'src/modules/booking/entities/booking.entity';
import { BookingService as BookingServiceEntity } from 'src/modules/booking/entities/booking-service.entity';
import { BookingSource } from 'src/modules/booking/enums/booking-source.enum';
import { BookingStatus } from 'src/modules/booking/enums/booking-status.enum';
import { Branch } from 'src/modules/branch/entities/branch.entity';
import { BranchStaff } from 'src/modules/branch/entities/branch-staff.entity';
import { StaffPosition } from 'src/modules/branch/enums/staff-position.enum';
import { StaffStatus } from 'src/modules/branch/enums/staff-status.enum';
import { BranchService } from 'src/modules/branch-service/entities/branch-service.entity';
import { BranchInventory } from 'src/modules/inventory/entities/branch-inventory.entity';
import { InventoryTransaction } from 'src/modules/inventory/entities/inventory-transaction.entity';
import { InventoryTransactionType } from 'src/modules/inventory/enums/inventory-transaction-type.enum';
import { LoyaltyAccount } from 'src/modules/loyalty/entities/loyalty-account.entity';
import { LoyaltyTransaction } from 'src/modules/loyalty/entities/loyalty-transaction.entity';
import { LoyaltyTransactionType } from 'src/modules/loyalty/enums/loyalty-transaction-type.enum';
import { Notification, NotificationChannel, NotificationStatus } from 'src/modules/notification/entities/notification.entity';
import { PaymentTransaction } from 'src/modules/payment/domain/entities/payment-transaction.entity';
import { PaymentProvider } from 'src/modules/payment/domain/enums/payment-provider.enum';
import { PaymentTransactionStatus } from 'src/modules/payment/domain/enums/payment-transaction-status.enum';
import { PaymentTransactionType } from 'src/modules/payment/domain/enums/payment-transaction-type.enum';
import { Payment } from 'src/modules/payment/entities/payment.entity';
import { PaymentMethod } from 'src/modules/payment/enums/payment-method.enum';
import { PaymentStatus } from 'src/modules/payment/enums/payment-status.enum';
import { PaymentType } from 'src/modules/payment/enums/payment-type.enum';
import { BranchDailyAggregate } from 'src/modules/report/entities/branch-daily-aggregate.entity';
import { ScheduleRequest } from 'src/modules/schedule/entities/schedule-request.entity';
import { StaffSchedule } from 'src/modules/schedule/entities/staff-schedule.entity';
import { ApprovalStatus } from 'src/modules/schedule/enums/approval-status.enum';
import { ScheduleRequestType } from 'src/modules/schedule/enums/schedule-request-type.enum';
import { ScheduleStatus } from 'src/modules/schedule/enums/schedule-status.enum';
import { ScheduleType } from 'src/modules/schedule/enums/schedule-type.enum';
import { User } from 'src/modules/user/entities/user.entity';
import { AuthProvider } from 'src/modules/user/enums/auth-provider.enum';
import { Gender } from 'src/modules/user/enums/gender.enum';
import { UserRole } from 'src/modules/user/enums/user-role.enum';
import { UserStatus } from 'src/modules/user/enums/user-status.enum';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OperationalDemoSeeder {
  private readonly logger = new Logger(OperationalDemoSeeder.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingServiceEntity) private readonly bookingServiceRepo: Repository<BookingServiceEntity>,
    @InjectRepository(BranchService) private readonly branchServiceRepo: Repository<BranchService>,
    @InjectRepository(BranchStaff) private readonly branchStaffRepo: Repository<BranchStaff>,
    @InjectRepository(BranchInventory) private readonly branchInventoryRepo: Repository<BranchInventory>,
    @InjectRepository(InventoryTransaction) private readonly inventoryTransactionRepo: Repository<InventoryTransaction>,
    @InjectRepository(LoyaltyAccount) private readonly loyaltyAccountRepo: Repository<LoyaltyAccount>,
    @InjectRepository(LoyaltyTransaction) private readonly loyaltyTransactionRepo: Repository<LoyaltyTransaction>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(ActivityLog) private readonly activityLogRepo: Repository<ActivityLog>,
    @InjectRepository(BranchDailyAggregate) private readonly aggregateRepo: Repository<BranchDailyAggregate>,
    @InjectRepository(PaymentTransaction) private readonly paymentTransactionRepo: Repository<PaymentTransaction>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ScheduleRequest) private readonly scheduleRequestRepo: Repository<ScheduleRequest>,
    @InjectRepository(StaffSchedule) private readonly staffScheduleRepo: Repository<StaffSchedule>,
  ) {}

  async seed(): Promise<void> {
    const [branches, owner, originalCustomers] = await Promise.all([
      this.branchRepo.find({ order: { id: 'ASC' } }),
      this.userRepo.findOne({ where: { role: UserRole.Owner } }),
      this.userRepo.find({ where: { role: UserRole.Customer }, order: { id: 'ASC' } }),
    ]);

    await this.seedDistributedCustomerBookings(branches, originalCustomers);
    await this.seedDailyShowcase(branches, originalCustomers, owner?.id ?? null);

    const [customers, users, bookings] = await Promise.all([
      this.userRepo.find({ where: { role: UserRole.Customer }, order: { id: 'ASC' } }),
      this.userRepo.find({ order: { id: 'ASC' } }),
      this.bookingRepo.find({ order: { id: 'ASC' } }),
    ]);

    await this.seedLoyalty(customers);
    await this.seedNotifications(customers, users, branches);
    await this.seedActivityLogs(users, branches, bookings);
    if (owner) await this.seedInventoryHistory(owner.id);
    await this.seedOperationalRevenue(bookings);
    await this.seedPaymentTransactions(bookings);
    await this.seedBranchAggregates(branches);

    this.logger.log('Professional operational demo data is ready');
  }

  /**
   * Creates a rolling, presentation-friendly workload for every branch.
   * Markers include the Vietnam calendar date, so rerunning is idempotent on
   * the same day while a new run on another day refreshes the demo horizon.
   */
  private async seedDailyShowcase(branches: Branch[], customers: User[], reviewedBy: string | null): Promise<void> {
    if (branches.length === 0 || customers.length === 0) return;

    const curatedCustomers = await this.ensureShowcaseCustomers();
    const demoCustomers = curatedCustomers.length > 0 ? curatedCustomers : customers;

    const [branchServices, technicians, markedBookings, markedRequests] = await Promise.all([
      this.branchServiceRepo.find({ where: { isEnabled: true }, relations: ['service'], order: { id: 'ASC' } }),
      this.branchStaffRepo.find({
        where: { position: StaffPosition.Technician, status: StaffStatus.Active },
        order: { staffCode: 'ASC' },
      }),
      this.bookingRepo.createQueryBuilder('b').where("b.notes LIKE 'showcase:%'").getMany(),
      this.scheduleRequestRepo.createQueryBuilder('sr').where("sr.reason LIKE 'showcase:%'").getMany(),
    ]);

    const servicesByBranch = new Map<string, BranchService[]>();
    for (const service of branchServices) {
      const rows = servicesByBranch.get(service.branchId) ?? [];
      rows.push(service);
      servicesByBranch.set(service.branchId, rows);
    }
    const techniciansByBranch = new Map<string, BranchStaff[]>();
    for (const technician of technicians) {
      const rows = techniciansByBranch.get(technician.branchId) ?? [];
      rows.push(technician);
      techniciansByBranch.set(technician.branchId, rows);
    }

    const existingBookingsByMarker = new Map(
      markedBookings.filter((booking) => booking.notes).map((booking) => [booking.notes as string, booking]),
    );
    const existingShiftMarkers = new Set(markedRequests.map((request) => request.reason).filter(Boolean));
    const nowInVietnam = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const baseDate = new Date(Date.UTC(
      nowInVietnam.getUTCFullYear(),
      nowInVietnam.getUTCMonth(),
      nowInVietnam.getUTCDate(),
    ));
    const dateKey = (offset: number) => new Date(baseDate.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
    const atVietnamTime = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

    const statusPlan: BookingStatus[][] = [
      [
        BookingStatus.Completed,
        BookingStatus.Completed,
        BookingStatus.ServiceCompleted,
        BookingStatus.CheckedIn,
        BookingStatus.InService,
        BookingStatus.Confirmed,
        BookingStatus.PendingPayment,
        BookingStatus.Confirmed,
      ],
      [
        BookingStatus.Confirmed,
        BookingStatus.Confirmed,
        BookingStatus.PendingPayment,
        BookingStatus.Confirmed,
        BookingStatus.Confirmed,
        BookingStatus.Confirmed,
      ],
      [BookingStatus.Confirmed, BookingStatus.PendingPayment, BookingStatus.Confirmed, BookingStatus.Confirmed],
    ];
    const slotTimes = ['08:00', '09:15', '10:30', '11:45', '13:00', '14:15', '15:30', '16:45'];
    const roomNames = ['Phòng Standard 01', 'Phòng Standard 02', 'Phòng Deluxe 01', 'Phòng VIP 01'];

    let createdBookings = 0;
    let createdShifts = 0;
    for (const [branchIndex, branch] of branches.entries()) {
      const availableServices = servicesByBranch.get(branch.id) ?? [];
      const availableTechnicians = techniciansByBranch.get(branch.id) ?? [];
      if (availableServices.length === 0 || availableTechnicians.length === 0) continue;

      for (let dayOffset = 0; dayOffset < statusPlan.length; dayOffset++) {
        const day = dateKey(dayOffset);

        for (const technician of availableTechnicians) {
          const shiftMarker = `showcase:shift:${day}:${branch.id}:${technician.userId}`;
          if (existingShiftMarkers.has(shiftMarker)) continue;
          const request = await this.scheduleRequestRepo.save(
            this.scheduleRequestRepo.create({
              staffId: technician.userId,
              branchId: branch.id,
              requestType: ScheduleRequestType.WorkShift,
              requestedStart: atVietnamTime(day, '07:30'),
              requestedEnd: atVietnamTime(day, '20:30'),
              status: ApprovalStatus.Approved,
              reason: shiftMarker,
              reviewedBy,
              reviewedAt: new Date(),
            }),
          );
          await this.staffScheduleRepo.save(
            this.staffScheduleRepo.create({
              staffId: technician.userId,
              branchId: branch.id,
              startTime: request.requestedStart,
              endTime: request.requestedEnd,
              scheduleType: ScheduleType.Working,
              status: ScheduleStatus.Active,
              sourceRequestId: request.id,
              createdBy: reviewedBy,
            }),
          );
          existingShiftMarkers.add(shiftMarker);
          createdShifts++;
        }

        for (const [slotIndex, status] of statusPlan[dayOffset].entries()) {
          const marker = `showcase:booking:${day}:${branch.id}:${slotIndex}`;
          const customer = demoCustomers[(branchIndex * 11 + dayOffset * 7 + slotIndex) % demoCustomers.length];
          const existingBooking = existingBookingsByMarker.get(marker);
          if (existingBooking) {
            if (existingBooking.customerId !== customer.id) {
              await this.bookingRepo.update(existingBooking.id, { customerId: customer.id });
            }
            continue;
          }

          const service = availableServices[(branchIndex + slotIndex) % availableServices.length];
          const technician = availableTechnicians[slotIndex % availableTechnicians.length];
          const durationMinutes = service.durationMinutesOverride ?? service.service?.defaultDurationMinutes ?? 60;
          const unitPrice = Number(service.priceOverride ?? service.service?.defaultPrice ?? 850000);
          const startTime = atVietnamTime(day, slotTimes[slotIndex]);
          const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
          const hasArrived = [BookingStatus.CheckedIn, BookingStatus.InService, BookingStatus.ServiceCompleted, BookingStatus.Completed].includes(status);
          const serviceFinished = [BookingStatus.ServiceCompleted, BookingStatus.Completed].includes(status);
          const isPaid = status === BookingStatus.Completed;

          const booking = await this.bookingRepo.save(
            this.bookingRepo.create({
              customerId: customer.id,
              branchId: branch.id,
              technicianId: technician.userId,
              startTime,
              endTime,
              status,
              source: slotIndex % 3 === 0 ? BookingSource.WalkIn : BookingSource.Online,
              subtotalAmount: unitPrice,
              discountAmount: 0,
              depositRequiredAmount: status === BookingStatus.PendingPayment ? Math.round(unitPrice * 0.3) : 0,
              paidAmount: isPaid ? unitPrice : 0,
              remainingAmount: isPaid ? 0 : unitPrice,
              room: hasArrived ? roomNames[slotIndex % roomNames.length] : null,
              notes: marker,
              checkedInAt: hasArrived ? startTime : null,
              completedAt: serviceFinished ? endTime : null,
              createdBy: slotIndex % 3 === 0 ? technician.userId : customer.id,
            }),
          );
          await this.bookingServiceRepo.save(
            this.bookingServiceRepo.create({
              bookingId: booking.id,
              serviceId: service.serviceId,
              quantity: 1,
              durationMinutes,
              unitPrice,
              discountAmount: 0,
              finalAmount: unitPrice,
            }),
          );
          existingBookingsByMarker.set(marker, booking);
          createdBookings++;
        }
      }
    }

    this.logger.log(`Showcase horizon ready: ${createdBookings} booking(s), ${createdShifts} shift(s) created`);
  }

  private async ensureShowcaseCustomers(): Promise<User[]> {
    // Unicode escapes keep demo names stable even when a deployment shell or
    // source checkout uses a non-UTF-8 code page.
    const names = [
      'Nguy\u1ec5n Minh Anh',
      'Tr\u1ea7n Ng\u1ecdc Lan',
      'L\u00ea Ho\u00e0ng Ph\u00fac',
      'Ph\u1ea1m Th\u1ea3o Nguy\u00ean',
      'V\u00f5 Qu\u1ed1c B\u1ea3o',
      '\u0110\u1eb7ng Kh\u00e1nh Linh',
      'B\u00f9i Gia H\u00e2n',
      'Ho\u00e0ng Tu\u1ea5n Ki\u1ec7t',
      'Ng\u00f4 Thanh Mai',
      'D\u01b0\u01a1ng H\u1ea3i \u0110\u0103ng',
      'Mai Qu\u1ef3nh Trang',
      'Cao Thi\u00ean An',
      'L\u00fd B\u1ea3o Ng\u1ecdc',
      'Phan Ho\u00e0ng Long',
      'V\u0169 Thanh Tr\u00fac',
      'H\u00e0 Ng\u1ecdc \u00c1nh',
      'Tr\u01b0\u01a1ng Gia H\u00e2n',
      '\u0110\u1ed7 Kh\u00e1nh An',
      'T\u1ea1 Ng\u1ecdc Di\u1ec7p',
      'L\u00ea \u0110\u1ee9c Th\u1ecbnh',
    ];
    const phones = names.map((_, index) => `0397${String(index + 1).padStart(6, '0')}`);
    const existing = await this.userRepo.find({ where: { phone: In(phones) } });
    const byPhone = new Map(existing.map((customer) => [customer.phone, customer]));
    const result: User[] = [];

    for (const [index, fullName] of names.entries()) {
      const phone = phones[index];
      let customer = byPhone.get(phone);
      if (customer) {
        if (customer.fullName !== fullName) {
          customer.fullName = fullName;
          customer = await this.userRepo.save(customer);
        }
      } else {
        customer = await this.userRepo.save(
          this.userRepo.create({
            email: null,
            phone,
            passwordHash: null,
            role: UserRole.Customer,
            status: UserStatus.Active,
            authProvider: AuthProvider.Email,
            providerUserId: null,
            fullName,
            avatarUrl: null,
            gender: index % 3 === 0 ? Gender.Male : Gender.Female,
            dateOfBirth: null,
            address: 'Kh\u00e1ch h\u00e0ng showcase AuraSpa',
            isActive: false,
            notificationEnabled: true,
          }),
        );
      }
      result.push(customer);
    }

    return result;
  }

  private async seedDistributedCustomerBookings(branches: Branch[], originalCustomers: User[]): Promise<void> {
    if (branches.length === 0) return;

    const [branchServices, technicians, currentBookings] = await Promise.all([
      this.branchServiceRepo.find({ where: { isEnabled: true }, relations: ['service'], order: { id: 'ASC' } }),
      this.branchStaffRepo.find({
        where: { position: StaffPosition.Technician, status: StaffStatus.Active },
        order: { id: 'ASC' },
      }),
      this.bookingRepo.find({ order: { id: 'ASC' } }),
    ]);
    const existingMarkers = new Set(currentBookings.map((booking) => booking.notes).filter(Boolean));
    const customersWithBookings = new Set(currentBookings.map((booking) => booking.customerId));
    const servicesByBranch = new Map<string, BranchService[]>();
    const techniciansByBranch = new Map<string, BranchStaff[]>();

    for (const branchService of branchServices) {
      const rows = servicesByBranch.get(branchService.branchId) ?? [];
      rows.push(branchService);
      servicesByBranch.set(branchService.branchId, rows);
    }
    for (const technician of technicians) {
      const rows = techniciansByBranch.get(technician.branchId) ?? [];
      rows.push(technician);
      techniciansByBranch.set(technician.branchId, rows);
    }

    const walkInNames = [
      'Nguyá»…n Thá»‹ Thanh Mai',
      'Tráº§n Minh KhÃ´i',
      'LÃª Ngá»c HÃ¢n',
      'Pháº¡m Gia Báº£o',
      'HoÃ ng ThÃ¹y Linh',
      'VÃµ Anh ThÆ°',
      'Äáº·ng Quang Huy',
      'BÃ¹i PhÆ°Æ¡ng Nhi',
      'Äá»— KhÃ¡nh An',
      'HÃ  Tuáº¥n Kiá»‡t',
      'Nguyá»…n Diá»‡u Anh',
      'TrÆ°Æ¡ng Nháº­t Nam',
      'LÃ½ Báº£o Ngá»c',
      'Phan HoÃ ng Long',
      'VÅ© Thanh TrÃºc',
      'NgÃ´ Minh ChÃ¢u',
      'DÆ°Æ¡ng Háº£i ÄÄƒng',
      'Mai Quá»³nh Trang',
      'Cao Tuáº¥n Anh',
      'Táº¡ Ngá»c Diá»‡p',
      'Nguyá»…n HoÃ ng PhÃºc',
      'Tráº§n Yáº¿n Nhi',
      'LÃª Äá»©c Thá»‹nh',
      'Pháº¡m Tháº£o Vy',
      'HoÃ ng Báº£o TrÃ¢m',
      'VÃµ Minh Triáº¿t',
      'Äáº·ng ThÃ¹y DÆ°Æ¡ng',
      'BÃ¹i Quá»‘c Báº£o',
      'Äá»— Thanh HÃ ',
      'HÃ  Ngá»c Ánh',
      'TrÆ°Æ¡ng Gia HÃ¢n',
      'LÃ½ Minh QuÃ¢n',
      'Phan Tháº£o NguyÃªn',
      'VÅ© KhÃ¡nh Ly',
      'NgÃ´ Anh Khoa',
    ];

    const bookingSeeds: Array<{ customer: User; branch: Branch; source: BookingSource; marker: string; sequence: number }> = [];
    for (const [branchIndex, branch] of branches.entries()) {
      for (let customerIndex = 0; customerIndex < 5; customerIndex++) {
        const sequence = branchIndex * 5 + customerIndex;
        const phone = `0388${String(sequence + 1).padStart(6, '0')}`;
        let customer = await this.userRepo.findOne({ where: { phone } });
        if (!customer) {
          customer = await this.userRepo.save(
            this.userRepo.create({
              email: null,
              phone,
              passwordHash: null,
              role: UserRole.Customer,
              status: UserStatus.Active,
              authProvider: AuthProvider.Email,
              providerUserId: null,
              fullName: walkInNames[sequence],
              avatarUrl: null,
              gender: sequence % 4 === 1 ? Gender.Male : Gender.Female,
              dateOfBirth: null,
              address: branch.name,
              isActive: false,
              notificationEnabled: true,
            }),
          );
        }
        bookingSeeds.push({
          customer,
          branch,
          source: BookingSource.WalkIn,
          marker: `professional-demo-walk-in:${phone}`,
          sequence,
        });
      }
    }

    const unbookedOriginalCustomers = originalCustomers.filter((customer) => !customersWithBookings.has(customer.id));
    for (const [index, customer] of unbookedOriginalCustomers.entries()) {
      bookingSeeds.push({
        customer,
        branch: branches[index % branches.length],
        source: BookingSource.Online,
        marker: `professional-demo-distributed:${customer.id}`,
        sequence: walkInNames.length + index,
      });
    }

    let seededBookings = 0;
    for (const seed of bookingSeeds) {
      if (existingMarkers.has(seed.marker)) continue;
      const availableServices = servicesByBranch.get(seed.branch.id) ?? [];
      const availableTechnicians = techniciansByBranch.get(seed.branch.id) ?? [];
      if (availableServices.length === 0 || availableTechnicians.length === 0) continue;

      const branchService = availableServices[seed.sequence % availableServices.length];
      const technician = availableTechnicians[seed.sequence % availableTechnicians.length];
      const durationMinutes = branchService.durationMinutesOverride ?? branchService.service?.defaultDurationMinutes ?? 60;
      const unitPrice = Number(branchService.priceOverride ?? branchService.service?.defaultPrice ?? 850000);
      const statusCycle =
        seed.source === BookingSource.WalkIn
          ? [BookingStatus.Completed, BookingStatus.Completed, BookingStatus.Completed, BookingStatus.Completed, BookingStatus.Cancelled]
          : [BookingStatus.Completed, BookingStatus.Completed, BookingStatus.Completed, BookingStatus.Confirmed, BookingStatus.Cancelled];
      const status = statusCycle[seed.sequence % statusCycle.length];
      const isFuture = status === BookingStatus.Confirmed;
      const dayOffset = isFuture ? (seed.sequence % 7) + 1 : -((seed.sequence % 27) + 1);
      const startTime = new Date(Date.now() + dayOffset * DAY_MS);
      startTime.setHours(9 + (seed.sequence % 8), seed.sequence % 2 === 0 ? 0 : 30, 0, 0);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      const isCompleted = status === BookingStatus.Completed;
      const isCancelled = status === BookingStatus.Cancelled;

      const booking = await this.bookingRepo.save(
        this.bookingRepo.create({
          customerId: seed.customer.id,
          branchId: seed.branch.id,
          technicianId: technician.userId,
          discountCodeId: null,
          startTime,
          endTime,
          status,
          source: seed.source,
          subtotalAmount: unitPrice,
          discountAmount: 0,
          depositRequiredAmount: 0,
          paidAmount: 0,
          remainingAmount: isCancelled ? 0 : unitPrice,
          room: null,
          notes: seed.marker,
          cancelReason: isCancelled ? 'KhÃ¡ch thay Ä‘á»•i káº¿ hoáº¡ch cÃ¡ nhÃ¢n' : null,
          transferredFromBranchId: null,
          rescheduledFromBookingId: null,
          createdBy: seed.source === BookingSource.WalkIn ? technician.userId : seed.customer.id,
          checkedInAt: isCompleted ? startTime : null,
          completedAt: isCompleted ? endTime : null,
          cancelledAt: isCancelled ? new Date(startTime.getTime() - 2 * 60 * 60 * 1000) : null,
        }),
      );

      await this.bookingServiceRepo.save(
        this.bookingServiceRepo.create({
          bookingId: booking.id,
          serviceId: branchService.serviceId,
          quantity: 1,
          durationMinutes,
          unitPrice,
          discountAmount: 0,
          finalAmount: unitPrice,
        }),
      );
      existingMarkers.add(seed.marker);
      seededBookings++;
    }

    this.logger.log(`Seeded distributed bookings for ${seededBookings} customer(s) across ${branches.length} branches`);
  }

  private async seedLoyalty(customers: User[]): Promise<void> {
    for (const [index, customer] of customers.entries()) {
      let account = await this.loyaltyAccountRepo.findOne({ where: { customerId: customer.id } });
      const lifetimePoints = 350 + ((index * 470) % 5200);
      const pointsBalance = 100 + ((index * 215) % Math.max(250, lifetimePoints));
      const tier = lifetimePoints >= 4000 ? 'Aura Diamond' : lifetimePoints >= 1800 ? 'Aura Gold' : 'Aura Member';

      if (!account) {
        account = await this.loyaltyAccountRepo.save(
          this.loyaltyAccountRepo.create({ customerId: customer.id, tier, pointsBalance, lifetimePoints }),
        );
      }

      const source = 'professional-demo-opening-balance';
      const transaction = await this.loyaltyTransactionRepo.findOne({ where: { accountId: account.id, source } });
      if (!transaction) {
        await this.loyaltyTransactionRepo.save(
          this.loyaltyTransactionRepo.create({
            accountId: account.id,
            customerId: customer.id,
            bookingId: null,
            paymentId: null,
            type: LoyaltyTransactionType.Adjust,
            points: pointsBalance,
            source,
            description: 'Số dư điểm thành viên dùng cho môi trường demo chuyên nghiệp',
          }),
        );
      }
    }
  }

  private async seedNotifications(customers: User[], users: User[], branches: Branch[]): Promise<void> {
    const existing = await this.notificationRepo.count({ where: { notificationType: 'demo.welcome' } });
    if (existing > 0) return;

    const now = Date.now();
    const customerNotifications = customers.slice(0, 20).flatMap((customer, index) => [
      this.notificationRepo.create({
        recipientUserId: customer.id,
        recipientRole: UserRole.Customer,
        notificationType: 'demo.welcome',
        message: `Chào ${customer.fullName}, Aura Spa tặng bạn 100 điểm thành viên cho lần trải nghiệm tiếp theo.`,
        status: NotificationStatus.Sent,
        channel: NotificationChannel.InApp,
        relatedEntityType: 'loyalty_account',
        relatedEntityId: customer.id,
        readAt: index % 3 === 0 ? new Date(now - index * DAY_MS) : null,
        sentAt: new Date(now - (index + 1) * DAY_MS),
      }),
      this.notificationRepo.create({
        recipientUserId: customer.id,
        recipientRole: UserRole.Customer,
        notificationType: 'demo.care_tip',
        message: 'Mẹo từ Aura: uống đủ nước và dưỡng ẩm đều đặn để duy trì hiệu quả sau liệu trình.',
        status: NotificationStatus.Sent,
        channel: NotificationChannel.InApp,
        relatedEntityType: null,
        relatedEntityId: null,
        readAt: null,
        sentAt: new Date(now - index * 12 * 60 * 60 * 1000),
      }),
    ]);

    const managers = users.filter((user) => user.role === UserRole.Manager || user.role === UserRole.Owner);
    const managementNotifications = managers.map((user, index) =>
      this.notificationRepo.create({
        recipientUserId: user.id,
        recipientRole: user.role,
        notificationType: 'demo.daily_summary',
        message: `Báo cáo vận hành ${branches[index % Math.max(1, branches.length)]?.name ?? 'toàn hệ thống'} đã sẵn sàng.`,
        status: NotificationStatus.Sent,
        channel: NotificationChannel.InApp,
        relatedEntityType: 'branch',
        relatedEntityId: branches[index % Math.max(1, branches.length)]?.id ?? null,
        readAt: index % 2 === 0 ? new Date(now - index * 60 * 60 * 1000) : null,
        sentAt: new Date(now - index * 60 * 60 * 1000),
      }),
    );

    await this.notificationRepo.save([...customerNotifications, ...managementNotifications], { chunk: 100 });
  }

  private async seedActivityLogs(users: User[], branches: Branch[], bookings: Booking[]): Promise<void> {
    const marker = await this.activityLogRepo.findOne({ where: { action: 'system.demo_seed' } });
    if (marker || users.length === 0) return;

    const actions = ['auth.login', 'booking.view', 'booking.update', 'inventory.view', 'report.export', 'customer.consult'];
    const rows = Array.from({ length: 72 }, (_, index) => {
      const user = users[index % users.length];
      const branch = branches[index % Math.max(1, branches.length)];
      const booking = bookings[index % Math.max(1, bookings.length)];
      return this.activityLogRepo.create({
        userId: user.id,
        userRole: user.role,
        branchId: branch?.id ?? null,
        action: index === 0 ? 'system.demo_seed' : actions[index % actions.length],
        entityType: booking && index % 3 !== 0 ? 'booking' : 'dashboard',
        entityId: booking && index % 3 !== 0 ? booking.id : null,
        metadata: { demo: true, channel: index % 2 === 0 ? 'web' : 'mobile', sequence: index + 1 },
        ipAddress: `10.0.${Math.floor(index / 250)}.${(index % 250) + 1}`,
        occurredAt: new Date(Date.now() - index * 6 * 60 * 60 * 1000),
      });
    });
    await this.activityLogRepo.save(rows, { chunk: 100 });
  }

  private async seedInventoryHistory(ownerId: string): Promise<void> {
    const markerReason = 'Nhập kho định kỳ đầu tháng - professional demo';
    const marker = await this.inventoryTransactionRepo.findOne({ where: { reason: markerReason } });
    if (marker) return;
    const stocks = await this.branchInventoryRepo.find({ order: { id: 'ASC' } });
    const rows = stocks.flatMap((stock, index) => {
      const currentQuantity = Number(stock.currentQuantity);
      return [
        this.inventoryTransactionRepo.create({
          branchId: stock.branchId,
          inventoryItemId: stock.inventoryItemId,
          transactionType: InventoryTransactionType.Import,
          quantityDelta: Math.max(10, Math.round(currentQuantity * 1.4)),
          quantityAfter: Math.max(10, Math.round(currentQuantity * 1.4)),
          bookingId: null,
          serviceId: null,
          staffId: null,
          reason: markerReason,
          createdBy: ownerId,
          createdAt: new Date(Date.now() - (30 + (index % 10)) * DAY_MS),
        }),
        this.inventoryTransactionRepo.create({
          branchId: stock.branchId,
          inventoryItemId: stock.inventoryItemId,
          transactionType: InventoryTransactionType.Consume,
          quantityDelta: -Math.max(1, Math.round(currentQuantity * 0.4)),
          quantityAfter: currentQuantity,
          bookingId: null,
          serviceId: null,
          staffId: null,
          reason: 'Tổng hợp tiêu hao dịch vụ trong tháng - professional demo',
          createdBy: ownerId,
          createdAt: new Date(Date.now() - (index % 10) * DAY_MS),
        }),
      ];
    });
    await this.inventoryTransactionRepo.save(rows, { chunk: 100 });
  }

  private async seedOperationalRevenue(bookings: Booking[]): Promise<void> {
    const completedBookings = bookings.filter((booking) => booking.status === BookingStatus.Completed);
    if (completedBookings.length === 0) return;

    const existingPayments = await this.paymentRepo.find({
      where: {
        bookingId: In(completedBookings.map((booking) => booking.id)),
        status: In([PaymentStatus.Paid, PaymentStatus.PartiallyRefunded]),
      },
    });
    const paidBookingIds = new Set(existingPayments.map((payment) => payment.bookingId).filter(Boolean));
    const unpaidCompletedBookings = completedBookings.filter((booking) => !paidBookingIds.has(booking.id));
    if (unpaidCompletedBookings.length === 0) return;

    const realisticServicePrices = [850000, 1100000, 1350000, 1600000, 2200000];
    const paymentMethods = [PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.BankTransfer, PaymentMethod.EWallet];
    const payments: Payment[] = [];

    for (const [index, booking] of unpaidCompletedBookings.entries()) {
      const subtotal = Number(booking.subtotalAmount) || 0;
      const discount = Number(booking.discountAmount) || 0;
      const amount = Math.max(subtotal - discount, realisticServicePrices[index % realisticServicePrices.length]);
      const paidAt = booking.completedAt ?? booking.endTime;

      await this.bookingRepo.update(booking.id, {
        subtotalAmount: amount + discount,
        paidAmount: amount,
        remainingAmount: 0,
      });

      payments.push(
        this.paymentRepo.create({
          invoiceId: null,
          bookingId: booking.id,
          customerId: booking.customerId,
          branchId: booking.branchId,
          paymentType: PaymentType.FullPayment,
          paymentMethod: paymentMethods[index % paymentMethods.length],
          status: PaymentStatus.Paid,
          amount,
          paidAt,
          receivedBy: booking.technicianId,
          refundedAmount: 0,
          refundReason: null,
        }),
      );
    }

    await this.paymentRepo.save(payments, { chunk: 100 });
    this.logger.log(`Seeded ${payments.length} completed-booking payment(s) with realistic revenue`);
  }

  private async seedPaymentTransactions(bookings: Booking[]): Promise<void> {
    const marker = await this.paymentTransactionRepo.findOne({ where: { referenceCode: 'DEMO000001' } });
    if (marker) return;
    const existingTransactions = await this.paymentTransactionRepo.find();
    const occupiedBookingIds = new Set(existingTransactions.map((transaction) => transaction.bookingId));
    const selected = bookings.filter((booking) => !occupiedBookingIds.has(booking.id)).slice(0, 12);
    const statuses = [
      PaymentTransactionStatus.Paid,
      PaymentTransactionStatus.Paid,
      PaymentTransactionStatus.Pending,
      PaymentTransactionStatus.Expired,
      PaymentTransactionStatus.Failed,
      PaymentTransactionStatus.Cancelled,
    ];
    const rows = selected.map((booking, index) => {
      const status = statuses[index % statuses.length];
      const amount = Number(booking.depositRequiredAmount) || Math.round(Number(booking.subtotalAmount) * 0.3);
      const createdAt = new Date(Date.now() - (selected.length - index) * DAY_MS);
      return this.paymentTransactionRepo.create({
        bookingId: booking.id,
        branchId: booking.branchId,
        customerId: booking.customerId,
        provider: index % 4 === 0 ? PaymentProvider.Manual : PaymentProvider.SePay,
        transactionType: PaymentTransactionType.Deposit,
        status,
        amount: Math.max(100000, amount),
        currency: 'VND',
        referenceCode: `DEMO${String(index + 1).padStart(6, '0')}`,
        sepayTransactionId: status === PaymentTransactionStatus.Paid ? `900000${index + 1}` : null,
        bankReferenceCode: status === PaymentTransactionStatus.Paid ? `AURA-DEMO-${index + 1}` : null,
        transferContent: `Thanh toan coc Aura Spa DEMO${String(index + 1).padStart(6, '0')}`,
        rawWebhookPayload: status === PaymentTransactionStatus.Paid ? { demo: true, verified: true } : null,
        qrImageUrl: null,
        expiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000),
        paidAt: status === PaymentTransactionStatus.Paid ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
        createdAt,
      });
    });
    await this.paymentTransactionRepo.save(rows);
  }

  private async seedBranchAggregates(branches: Branch[]): Promise<void> {
    if ((await this.aggregateRepo.count()) > 0 || branches.length === 0) return;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rows: BranchDailyAggregate[] = [];
    for (const [branchIndex, branch] of branches.entries()) {
      for (let daysAgo = 179; daysAgo >= 0; daysAgo--) {
        const date = new Date(today.getTime() - daysAgo * DAY_MS);
        const weekday = date.getUTCDay();
        const season = 1 + Math.sin((daysAgo / 180) * Math.PI * 2) * 0.12;
        const weekendBoost = weekday === 0 || weekday === 6 ? 1.35 : 1;
        const totalBookings = Math.max(3, Math.round((8 + ((daysAgo + branchIndex * 3) % 11)) * weekendBoost));
        const cancelledBookings = (daysAgo + branchIndex) % 13 === 0 ? 2 : (daysAgo + branchIndex) % 7 === 0 ? 1 : 0;
        const noShowBookings = (daysAgo + branchIndex * 2) % 29 === 0 ? 1 : 0;
        const completedBookings = Math.max(0, totalBookings - cancelledBookings - noShowBookings);
        const averageTicket = 720000 + branchIndex * 45000 + ((daysAgo * 17000) % 280000);
        rows.push(
          this.aggregateRepo.create({
            branchId: branch.id,
            aggregateDate: date.toISOString().slice(0, 10),
            totalBookings,
            completedBookings,
            cancelledBookings,
            noShowBookings,
            totalRevenue: Math.round(completedBookings * averageTicket * season),
            avgServiceDurationMinutes: 60 + ((daysAgo + branchIndex) % 4) * 15,
            newCustomers: (daysAgo + branchIndex) % 4,
          }),
        );
      }
    }
    await this.aggregateRepo.save(rows, { chunk: 200 });
  }
}
