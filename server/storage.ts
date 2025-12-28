import { type User, type InsertUser, type Professional, type InsertProfessional, type Appointment, type InsertAppointment, type ProfessionalSchedule, type InsertProfessionalSchedule, type ProfessionalBreak, type InsertProfessionalBreak, type ProfessionalService, type InsertProfessionalService, type TimeSlot, type InsertTimeSlot, type Clinic, type InsertClinic, type Patient, type InsertPatient, type ClinicMember, type InsertClinicMember, type TeamInvitation, type InsertTeamInvitation, type SecretaryAssignment, type InsertSecretaryAssignment, type ClinicService, type InsertClinicService, type ProfessionalServiceAssignment, type InsertProfessionalServiceAssignment, type WaitlistEntry, type InsertWaitlistEntry, type WidgetConfiguration, type InsertWidgetConfiguration, type AuditLog, type InsertAuditLog, type DowngradeFeedback, type InsertDowngradeFeedback, users, professionals, appointments, professionalSchedules, professionalBreaks, professionalServices, timeSlots, clinics, patients, clinicMembers, teamInvitations, secretaryAssignments, clinicServices, professionalServiceAssignments, waitlistEntries, widgetConfigurations, auditLogs, downgradeFeedback } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, sql, gte, lte, between, exists, notExists, or, not, inArray, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';

// Enhanced storage interface for complete application functionality
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyUserPassword(username: string, password: string): Promise<User | null>;
  verifyUserPasswordByEmail(email: string, password: string): Promise<User | null>;
  
  // Clinic operations
  getClinic(id: string): Promise<Clinic | undefined>;
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  getAllClinics(): Promise<Clinic[]>;
  
  // Professional operations
  getProfessional(id: string): Promise<Professional | undefined>;
  getProfessionalByUserId(userId: string): Promise<Professional | undefined>;
  getAllProfessionals(): Promise<Professional[]>;
  searchProfessionals(profession?: string, city?: string, province?: string): Promise<Professional[]>;
  createProfessional(professional: InsertProfessional): Promise<Professional>;
  updateProfessional(id: string, professional: Partial<InsertProfessional>): Promise<Professional>;
  
  // Clinic member operations
  getClinicMembers(clinicId: string): Promise<ClinicMember[]>;
  addClinicMember(clinicMember: InsertClinicMember): Promise<ClinicMember>;
  removeClinicMember(clinicId: string, professionalId: string): Promise<void>;
  updateClinicMemberRole(clinicId: string, professionalId: string, role: string): Promise<ClinicMember>;
  getProfessionalClinic(professionalId: string): Promise<Clinic | undefined>;
  deleteClinicMemberCompletely(clinicId: string, professionalId: string): Promise<void>;
  restoreClinicMember(professionalId: string): Promise<void>;
  permanentlyDeleteExpiredMembers(): Promise<number>;
  
  // Patient operations
  getPatient(id: string): Promise<Patient | undefined>;
  getPatientByEmail(email: string): Promise<Patient | undefined>;
  getProfessionalPatients(professionalId: string): Promise<Patient[]>;
  getProfessionalPatientsWithAppointments(professionalId: string): Promise<any[]>;
  getClinicPatients(clinicId: string): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: string, patient: Partial<InsertPatient>): Promise<Patient>;
  searchPatients(professionalId: string, search: string): Promise<Patient[]>;
  findOrCreatePatient(professionalId: string, email: string | null | undefined, firstName: string, lastName: string, phone: string | null | undefined, clinicId?: string): Promise<Patient>;
  getPatientWithAppointments(patientId: string): Promise<any>;
  getClinicPatientsWithProfessionals(clinicId: string): Promise<any[]>;
  getProfessionalPatientsWithInfo(professionalId: string): Promise<any[]>;
  
  // Appointment operations
  getAppointment(id: string): Promise<Appointment | undefined>;
  getUserAppointments(userId: string): Promise<Appointment[]>;
  getProfessionalAppointments(professionalId: string): Promise<Appointment[]>;
  getClinicAppointments(clinicId: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  updateAppointmentStatus(id: string, status: string): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  createAppointmentWithSlot(appointmentData: Omit<InsertAppointment, 'professionalId' | 'appointmentDate'>): Promise<Appointment>;
  checkAppointmentConflict(professionalId: string, date: Date, startTime: string, endTime: string): Promise<Appointment[]>;
  
  // Availability operations
  getProfessionalSchedules(professionalId: string): Promise<ProfessionalSchedule[]>;
  getProfessionalSchedule(id: string): Promise<ProfessionalSchedule | undefined>;
  createProfessionalSchedule(schedule: InsertProfessionalSchedule): Promise<ProfessionalSchedule>;
  updateProfessionalSchedule(id: string, schedule: Partial<InsertProfessionalSchedule>): Promise<ProfessionalSchedule>;
  deleteProfessionalSchedule(id: string): Promise<void>;
  getProfessionalBreaks(professionalId: string): Promise<ProfessionalBreak[]>;
  getProfessionalBreak(id: string): Promise<ProfessionalBreak | undefined>;
  createProfessionalBreak(breakData: InsertProfessionalBreak): Promise<ProfessionalBreak>;
  updateProfessionalBreak(id: string, breakData: Partial<InsertProfessionalBreak>): Promise<ProfessionalBreak>;
  deleteProfessionalBreak(id: string): Promise<void>;
  getProfessionalServices(professionalId: string): Promise<ProfessionalService[]>;
  getProfessionalService(id: string): Promise<ProfessionalService | undefined>;
  createProfessionalService(service: InsertProfessionalService): Promise<ProfessionalService>;
  updateProfessionalService(id: string, service: Partial<InsertProfessionalService>): Promise<ProfessionalService>;
  deleteProfessionalService(id: string): Promise<void>;
  getAvailableTimeSlots(professionalId: string, fromDate?: Date, toDate?: Date): Promise<TimeSlot[]>;
  getTimeSlot(id: string): Promise<TimeSlot | undefined>;
  createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot>;
  markTimeSlotAsBooked(timeSlotId: string): Promise<void>;
  searchProfessionalsWithAvailability(profession?: string, city?: string, province?: string, availableAfter?: Date): Promise<Professional[]>;
  
  // Team invitation operations
  createInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation>;
  getInvitation(id: string): Promise<TeamInvitation | undefined>;
  getInvitationByToken(token: string): Promise<TeamInvitation | undefined>;
  getClinicInvitations(clinicId: string): Promise<TeamInvitation[]>;
  getPendingInvitationByEmail(clinicId: string, email: string): Promise<TeamInvitation | undefined>;
  updateInvitationStatus(id: string, status: string, professionalId?: string): Promise<TeamInvitation>;
  deleteInvitation(id: string): Promise<void>;
  getInvitedProfessionals(clinicId: string): Promise<Professional[]>;
  
  // Secretary assignment operations
  createSecretaryAssignment(assignment: InsertSecretaryAssignment): Promise<SecretaryAssignment>;
  getSecretaryAssignments(secretaryId: string): Promise<SecretaryAssignment[]>;
  getProfessionalSecretaries(professionalId: string): Promise<SecretaryAssignment[]>;
  deleteSecretaryAssignment(secretaryId: string, professionalId: string): Promise<void>;
  getAssignedProfessionals(secretaryId: string): Promise<Professional[]>;
  
  // Clinic service operations (admin only)
  getClinicServices(clinicId: string): Promise<ClinicService[]>;
  getClinicService(id: string): Promise<ClinicService | undefined>;
  createClinicService(service: InsertClinicService): Promise<ClinicService>;
  updateClinicService(id: string, service: Partial<InsertClinicService>): Promise<ClinicService>;
  countAppointmentsForClinicService(clinicServiceId: string): Promise<number>;
  deleteClinicService(id: string): Promise<void>;
  
  // Professional service assignment operations (admin assigns services to professionals)
  getProfessionalAssignedServices(professionalId: string): Promise<any[]>; // Returns clinic services assigned to professional
  getClinicServiceAssignments(clinicServiceId: string): Promise<ProfessionalServiceAssignment[]>;
  createServiceAssignment(assignment: InsertProfessionalServiceAssignment): Promise<ProfessionalServiceAssignment>;
  deleteServiceAssignment(clinicServiceId: string, professionalId: string): Promise<void>;
  updateServiceAssignmentVisibility(id: string, isVisible: boolean): Promise<ProfessionalServiceAssignment>;
  
  // Waitlist operations
  createWaitlistEntry(entry: InsertWaitlistEntry & { token: string; status: string; notifiedAt?: Date | null; expiresAt?: Date | null }): Promise<WaitlistEntry>;
  getWaitlistEntry(id: string): Promise<WaitlistEntry | undefined>;
  getWaitlistEntryByToken(token: string): Promise<WaitlistEntry | undefined>;
  getProfessionalWaitlistEntries(professionalId: string, status?: string): Promise<WaitlistEntry[]>;
  findMatchingWaitlistEntries(professionalId: string, serviceId: string | null, date: Date): Promise<WaitlistEntry[]>;
  updateWaitlistEntryStatus(id: string, status: string, notifiedAt?: Date, expiresAt?: Date, availableDate?: Date, availableStartTime?: string, availableEndTime?: string): Promise<WaitlistEntry>;
  deleteWaitlistEntry(id: string): Promise<void>;
  expireStaleWaitlistEntries(): Promise<number>; // Returns number of entries expired
  
  // Widget configuration operations
  createWidget(widget: InsertWidgetConfiguration): Promise<WidgetConfiguration>;
  getWidget(id: string): Promise<WidgetConfiguration | undefined>;
  getWidgetBySlug(slug: string): Promise<WidgetConfiguration | undefined>;
  getWidgetByProfessional(professionalId: string): Promise<WidgetConfiguration | undefined>;
  getWidgetByClinic(clinicId: string): Promise<WidgetConfiguration | undefined>;
  updateWidget(id: string, widget: Partial<InsertWidgetConfiguration>): Promise<WidgetConfiguration>;
  deleteWidget(id: string): Promise<void>;
  checkSlugAvailability(slug: string): Promise<boolean>;
  
  // Subscription operations
  updateProfessionalSubscription(
    professionalId: string, 
    data: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
      planType?: string;
      trialEndsAt?: Date | null;
      subscriptionEndsAt?: Date | null;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<Professional>;
  getActiveProfessionals(): Promise<Professional[]>;
  getAllLegacyProfessionals(): Promise<Professional[]>;
  getClinicSubscriptionStatus(clinicId: string): Promise<{
    subscriptionStatus: string;
    planType: string;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    adminName: string;
  } | undefined>;
  
  // Audit logging operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { professionalId?: string; action?: string; resourceType?: string; limit?: number }): Promise<AuditLog[]>;
  
  // Downgrade feedback operations
  saveDowngradeFeedback(feedback: InsertDowngradeFeedback): Promise<DowngradeFeedback>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword
      })
      .returning();
    return user;
  }

  async verifyUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }
    
    return user;
  }

  async verifyUserPasswordByEmail(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }
    
    return user;
  }

  // Professional operations
  async getProfessional(id: string): Promise<Professional | undefined> {
    const [professional] = await db.select().from(professionals).where(eq(professionals.id, id));
    return professional || undefined;
  }

  async getProfessionalByUserId(userId: string): Promise<Professional | undefined> {
    const [professional] = await db.select().from(professionals).where(eq(professionals.userId, userId));
    return professional || undefined;
  }

  async getAllProfessionals(): Promise<Professional[]> {
    return await db.select().from(professionals).where(isNull(professionals.deletedAt));
  }

  async searchProfessionals(profession?: string, city?: string, province?: string): Promise<Professional[]> {
    const conditions = [];
    
    // Only show publicly visible and not deleted professionals in search results
    conditions.push(eq(professionals.publiclyVisible, true));
    conditions.push(isNull(professionals.deletedAt));
    
    // Exclude secretaries from search results - only show actual professionals
    // Secretaries work for professionals but don't offer services themselves
    // Use SQL NOT EXISTS to exclude secretaries (only active, non-cancelled memberships)
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM clinic_members cm 
        WHERE cm.professional_id = ${professionals.id} 
        AND cm.role = 'Secrétaire'
        AND cm.cancelled = false
      )`
    );
    
    if (profession) {
      // Search in professions array (using ANY operator), firstName, or lastName
      // Use unaccent() to make search accent-insensitive (osteopathe matches Ostéopathe)
      conditions.push(
        or(
          sql`unaccent(${profession}) ILIKE ANY(SELECT unaccent(p) FROM unnest(${professionals.professions}) p)`,
          sql`EXISTS (SELECT 1 FROM unnest(${professionals.professions}) AS p WHERE unaccent(p) ILIKE unaccent(${`%${profession}%`}))`,
          sql`unaccent(${professionals.firstName}) ILIKE unaccent(${`%${profession}%`})`,
          sql`unaccent(${professionals.lastName}) ILIKE unaccent(${`%${profession}%`})`
        )
      );
    }
    if (city) {
      conditions.push(ilike(professionals.city, `%${city}%`));
    }
    if (province) {
      conditions.push(eq(professionals.province, province));
    }
    
    return await db.select()
      .from(professionals)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async createProfessional(insertProfessional: InsertProfessional): Promise<Professional> {
    const [professional] = await db
      .insert(professionals)
      .values(insertProfessional)
      .returning();
    return professional;
  }

  async updateProfessional(id: string, professionalUpdate: Partial<InsertProfessional>): Promise<Professional> {
    const [updated] = await db
      .update(professionals)
      .set(professionalUpdate)
      .where(eq(professionals.id, id))
      .returning();
    return updated;
  }

  // Clinic operations
  async getClinic(id: string): Promise<Clinic | undefined> {
    const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
    return clinic || undefined;
  }

  async createClinic(insertClinic: InsertClinic): Promise<Clinic> {
    const [clinic] = await db
      .insert(clinics)
      .values(insertClinic)
      .returning();
    return clinic;
  }

  async getAllClinics(): Promise<Clinic[]> {
    return await db.select().from(clinics);
  }

  // Clinic member operations
  async getClinicMembers(clinicId: string): Promise<ClinicMember[]> {
    return await db.select().from(clinicMembers).where(
      and(
        eq(clinicMembers.clinicId, clinicId),
        eq(clinicMembers.cancelled, false)
      )
    );
  }

  async addClinicMember(insertClinicMember: InsertClinicMember): Promise<ClinicMember> {
    const [member] = await db
      .insert(clinicMembers)
      .values(insertClinicMember)
      .returning();
    return member;
  }

  async removeClinicMember(clinicId: string, professionalId: string): Promise<void> {
    await db
      .delete(clinicMembers)
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.professionalId, professionalId)
        )
      );
  }

  async updateClinicMemberRole(clinicId: string, professionalId: string, role: string): Promise<ClinicMember> {
    const [updated] = await db
      .update(clinicMembers)
      .set({ role })
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.professionalId, professionalId)
        )
      )
      .returning();
    return updated;
  }

  async getProfessionalClinic(professionalId: string): Promise<Clinic | undefined> {
    const [professional] = await db
      .select()
      .from(professionals)
      .where(eq(professionals.id, professionalId));
    
    if (!professional || !professional.clinicId) {
      return undefined;
    }

    return await this.getClinic(professional.clinicId);
  }

  async deleteClinicMemberCompletely(clinicId: string, professionalId: string): Promise<void> {
    // Soft delete: mark professional as deleted instead of physically deleting
    await db
      .update(professionals)
      .set({ deletedAt: new Date() })
      .where(eq(professionals.id, professionalId));

    // Also mark clinic membership as cancelled
    await db
      .update(clinicMembers)
      .set({ cancelled: true })
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.professionalId, professionalId)
        )
      );
  }

  async restoreClinicMember(professionalId: string): Promise<void> {
    // Restore professional from soft delete
    await db
      .update(professionals)
      .set({ deletedAt: null })
      .where(eq(professionals.id, professionalId));

    // Also restore clinic membership
    const [membership] = await db
      .select()
      .from(clinicMembers)
      .where(eq(clinicMembers.professionalId, professionalId))
      .limit(1);

    if (membership) {
      await db
        .update(clinicMembers)
        .set({ cancelled: false })
        .where(eq(clinicMembers.id, membership.id));
    }
  }

  async permanentlyDeleteExpiredMembers(): Promise<number> {
    // Find professionals deleted more than 48 hours ago
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    const expiredProfessionals = await db
      .select()
      .from(professionals)
      .where(
        and(
          not(isNull(professionals.deletedAt)),
          lte(professionals.deletedAt, fortyEightHoursAgo)
        )
      );

    let deletedCount = 0;

    for (const professional of expiredProfessionals) {
      try {
        // Delete from clinic_members first (foreign key constraint)
        await db
          .delete(clinicMembers)
          .where(eq(clinicMembers.professionalId, professional.id));

        // Delete the professional record
        await db
          .delete(professionals)
          .where(eq(professionals.id, professional.id));

        deletedCount++;
        console.log(`[PERMANENT DELETE] Deleted professional ${professional.id} (${professional.firstName} ${professional.lastName}) - deleted since ${professional.deletedAt}`);
      } catch (error) {
        console.error(`[PERMANENT DELETE] Error deleting professional ${professional.id}:`, error);
      }
    }

    return deletedCount;
  }

  // Patient operations
  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient || undefined;
  }

  async getPatientByEmail(email: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.email, email));
    return patient || undefined;
  }

  async getProfessionalPatients(professionalId: string): Promise<Patient[]> {
    return await db.select().from(patients).where(eq(patients.professionalId, professionalId));
  }

  async getProfessionalPatientsWithAppointments(professionalId: string): Promise<any[]> {
    const patientsList = await db.select().from(patients).where(eq(patients.professionalId, professionalId));
    
    // For each patient, get their next upcoming appointment and last completed appointment
    const patientsWithAppointments = await Promise.all(
      patientsList.map(async (patient) => {
        // Get all next appointments (future) - only confirmed ones
        const nextAppts = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              eq(appointments.status, 'confirmed'),
              or(
                sql`${appointments.appointmentDate} > CURRENT_DATE`,
                and(
                  sql`${appointments.appointmentDate} = CURRENT_DATE`,
                  sql`${appointments.startTime} >= CURRENT_TIME`
                )
              )
            )
          )
          .orderBy(appointments.appointmentDate, appointments.startTime);
        
        // Get last completed/past appointment
        const [lastAppt] = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              not(eq(appointments.status, 'cancelled')),
              or(
                sql`${appointments.appointmentDate} < CURRENT_DATE`,
                and(
                  sql`${appointments.appointmentDate} = CURRENT_DATE`,
                  sql`${appointments.startTime} < CURRENT_TIME`
                )
              )
            )
          )
          .orderBy(sql`${appointments.appointmentDate} DESC, ${appointments.startTime} DESC`)
          .limit(1);
        
        return {
          ...patient,
          nextAppointments: nextAppts, // All future appointments
          nextAppointment: nextAppts[0] || null, // Keep for backward compatibility
          lastAppointment: lastAppt || null,
        };
      })
    );
    
    return patientsWithAppointments;
  }

  async getClinicPatients(clinicId: string): Promise<Patient[]> {
    return await db.select().from(patients).where(eq(patients.clinicId, clinicId));
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const [patient] = await db
      .insert(patients)
      .values(insertPatient)
      .returning();
    return patient;
  }

  async updatePatient(id: string, patientUpdate: Partial<InsertPatient>): Promise<Patient> {
    const [updated] = await db
      .update(patients)
      .set(patientUpdate)
      .where(eq(patients.id, id))
      .returning();
    return updated;
  }

  async searchPatients(professionalId: string, search: string): Promise<Patient[]> {
    return await db.select()
      .from(patients)
      .where(
        and(
          eq(patients.professionalId, professionalId),
          sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName}, ' ', ${patients.email}) ILIKE ${`%${search}%`}`
        )
      );
  }

  async getPatientWithAppointments(patientId: string): Promise<any> {
    const patient = await this.getPatient(patientId);
    if (!patient) return null;

    // Get all appointments for the patient
    const allAppointmentRecords = await db
      .select({
        appointment: appointments,
        serviceName: professionalServices.name,
        professionalFirstName: professionals.firstName,
        professionalLastName: professionals.lastName,
        professionalProfessions: professionals.professions,
      })
      .from(appointments)
      .leftJoin(professionalServices, eq(appointments.professionalServiceId, professionalServices.id))
      .leftJoin(professionals, eq(appointments.professionalId, professionals.id))
      .where(eq(appointments.patientId, patientId));

    // Separate future and past appointments
    const now = new Date();
    const futureAppointments: typeof allAppointmentRecords = [];
    const pastAppointments: typeof allAppointmentRecords = [];

    for (const record of allAppointmentRecords) {
      const apptDate = new Date(record.appointment.appointmentDate);
      const [hours, minutes] = (record.appointment.startTime || '00:00').split(':').map(Number);
      apptDate.setHours(hours, minutes, 0, 0);

      if (apptDate >= now) {
        futureAppointments.push(record);
      } else {
        pastAppointments.push(record);
      }
    }

    // Sort future appointments ASC (soonest first)
    futureAppointments.sort((a, b) => {
      const dateA = new Date(a.appointment.appointmentDate).getTime();
      const dateB = new Date(b.appointment.appointmentDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.appointment.startTime || '').localeCompare(b.appointment.startTime || '');
    });

    // Sort past appointments DESC (most recent first)
    pastAppointments.sort((a, b) => {
      const dateA = new Date(a.appointment.appointmentDate).getTime();
      const dateB = new Date(b.appointment.appointmentDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return (b.appointment.startTime || '').localeCompare(a.appointment.startTime || '');
    });

    // Combine: future appointments first, then past
    const appointmentRecords = [...futureAppointments, ...pastAppointments];

    return {
      ...patient,
      appointments: appointmentRecords.map(r => ({
        ...r.appointment,
        serviceName: r.serviceName,
        professionalFirstName: r.professionalFirstName,
        professionalLastName: r.professionalLastName,
        professionalProfession: r.professionalProfession,
      })),
    };
  }

  async findOrCreatePatient(
    professionalId: string, 
    email: string | null | undefined, 
    firstName: string, 
    lastName: string, 
    phone: string | null | undefined,
    clinicId?: string
  ): Promise<Patient> {
    // Only search for existing patient if we have at least email or phone
    const hasContactInfo = (email && email.trim() !== '') || (phone && phone.trim() !== '');
    
    if (hasContactInfo) {
      // If clinic context exists, search for patient across entire clinic by email OR phone
      if (clinicId) {
        const conditions = [];
        if (email && email.trim() !== '') {
          conditions.push(eq(patients.email, email));
        }
        if (phone && phone.trim() !== '') {
          conditions.push(eq(patients.phone, phone));
        }

        const [existingPatient] = await db.select()
          .from(patients)
          .where(
            and(
              eq(patients.clinicId, clinicId),
              or(...conditions)
            )
          );

        if (existingPatient) {
          // Check if it's the same person (same first name AND last name)
          const isSamePerson = 
            existingPatient.firstName.toLowerCase() === firstName.toLowerCase() && 
            existingPatient.lastName.toLowerCase() === lastName.toLowerCase();

          if (isSamePerson) {
            // Same person - update contact info if changed
            if (existingPatient.email !== email || existingPatient.phone !== phone) {
              return await this.updatePatient(existingPatient.id, {
                email: email || null,
                phone: phone || null,
              });
            }
            return existingPatient;
          } else {
            // Different person with same contact - create new patient
            console.log(`⚠️ Potential duplicate: Found patient ${existingPatient.firstName} ${existingPatient.lastName} with same email/phone as new patient ${firstName} ${lastName}. Creating new record.`);
            // Fall through to create new patient
          }
        }
      } else {
        // For solo professionals, search by professional + email/phone
        const conditions = [];
        if (email && email.trim() !== '') {
          conditions.push(eq(patients.email, email));
        }
        if (phone && phone.trim() !== '') {
          conditions.push(eq(patients.phone, phone));
        }

        const [existingPatient] = await db.select()
          .from(patients)
          .where(
            and(
              eq(patients.professionalId, professionalId),
              or(...conditions)
            )
          );

        if (existingPatient) {
          // Check if it's the same person (same first name AND last name)
          const isSamePerson = 
            existingPatient.firstName.toLowerCase() === firstName.toLowerCase() && 
            existingPatient.lastName.toLowerCase() === lastName.toLowerCase();

          if (isSamePerson) {
            // Same person - update contact info if changed
            if (existingPatient.email !== email || existingPatient.phone !== phone) {
              return await this.updatePatient(existingPatient.id, {
                email: email || null,
                phone: phone || null,
              });
            }
            return existingPatient;
          } else {
            // Different person with same contact - create new patient
            console.log(`⚠️ Potential duplicate: Found patient ${existingPatient.firstName} ${existingPatient.lastName} with same email/phone as new patient ${firstName} ${lastName}. Creating new record.`);
            // Fall through to create new patient
          }
        }
      }
    }

    // If no existing patient found, or different person with same contact, or no contact info provided, create new one
    const [newPatient] = await db
      .insert(patients)
      .values({
        professionalId,
        clinicId: clinicId || null,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        dateOfBirth: null,
        address: null,
        city: null,
        postalCode: null,
        notes: null,
      })
      .returning();

    return newPatient;
  }

  async getClinicPatientsWithProfessionals(clinicId: string): Promise<any[]> {
    const results = await db
      .select({
        id: patients.id,
        professionalId: patients.professionalId,
        clinicId: patients.clinicId,
        firstName: patients.firstName,
        lastName: patients.lastName,
        email: patients.email,
        phone: patients.phone,
        dateOfBirth: patients.dateOfBirth,
        address: patients.address,
        city: patients.city,
        postalCode: patients.postalCode,
        notes: patients.notes,
        createdAt: patients.createdAt,
        professionalFirstName: professionals.firstName,
        professionalLastName: professionals.lastName,
        professionalProfessions: professionals.professions,
      })
      .from(patients)
      .leftJoin(professionals, eq(patients.professionalId, professionals.id))
      .where(eq(patients.clinicId, clinicId));
    
    // For each patient, get their next upcoming appointment and last completed appointment
    const patientsWithAppointments = await Promise.all(
      results.map(async (patient) => {
        // Get all next appointments (future) - only confirmed ones
        const nextAppts = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              eq(appointments.status, 'confirmed'),
              or(
                sql`${appointments.appointmentDate} > CURRENT_DATE`,
                and(
                  sql`${appointments.appointmentDate} = CURRENT_DATE`,
                  sql`${appointments.startTime} >= CURRENT_TIME`
                )
              )
            )
          )
          .orderBy(appointments.appointmentDate, appointments.startTime);
        
        // Get last completed/past appointment
        const [lastAppt] = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              not(eq(appointments.status, 'cancelled')),
              or(
                sql`${appointments.appointmentDate} < CURRENT_DATE`,
                and(
                  sql`${appointments.appointmentDate} = CURRENT_DATE`,
                  sql`${appointments.startTime} < CURRENT_TIME`
                )
              )
            )
          )
          .orderBy(sql`${appointments.appointmentDate} DESC, ${appointments.startTime} DESC`)
          .limit(1);
        
        return {
          ...patient,
          nextAppointments: nextAppts, // All future appointments
          nextAppointment: nextAppts[0] || null, // Keep for backward compatibility
          lastAppointment: lastAppt || null,
        };
      })
    );
    
    return patientsWithAppointments;
  }

  async getProfessionalPatientsWithInfo(professionalId: string): Promise<any[]> {
    const results = await db
      .select({
        id: patients.id,
        professionalId: patients.professionalId,
        clinicId: patients.clinicId,
        firstName: patients.firstName,
        lastName: patients.lastName,
        email: patients.email,
        phone: patients.phone,
        dateOfBirth: patients.dateOfBirth,
        address: patients.address,
        city: patients.city,
        postalCode: patients.postalCode,
        notes: patients.notes,
        createdAt: patients.createdAt,
        professionalFirstName: professionals.firstName,
        professionalLastName: professionals.lastName,
        professionalProfessions: professionals.professions,
      })
      .from(patients)
      .leftJoin(professionals, eq(patients.professionalId, professionals.id))
      .where(eq(patients.professionalId, professionalId));
    
    // For each patient, get their next upcoming appointment and last completed appointment
    const patientsWithAppointments = await Promise.all(
      results.map(async (patient) => {
        // Get all next appointments (future) - only confirmed ones
        const nextAppts = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              eq(appointments.status, 'confirmed'),
              or(
                sql`${appointments.appointmentDate} > CURRENT_DATE`,
                and(
                  sql`${appointments.appointmentDate} = CURRENT_DATE`,
                  sql`${appointments.startTime} >= CURRENT_TIME`
                )
              )
            )
          )
          .orderBy(appointments.appointmentDate, appointments.startTime);
        
        // Get last completed/past appointment
        const [lastAppt] = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              not(eq(appointments.status, 'cancelled')),
              or(
                sql`${appointments.appointmentDate} < CURRENT_DATE`,
                and(
                  sql`${appointments.appointmentDate} = CURRENT_DATE`,
                  sql`${appointments.startTime} < CURRENT_TIME`
                )
              )
            )
          )
          .orderBy(sql`${appointments.appointmentDate} DESC, ${appointments.startTime} DESC`)
          .limit(1);
        
        return {
          ...patient,
          nextAppointments: nextAppts, // All future appointments
          nextAppointment: nextAppts[0] || null, // Keep for backward compatibility
          lastAppointment: lastAppt || null,
        };
      })
    );
    
    return patientsWithAppointments;
  }

  // Appointment operations
  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment || undefined;
  }

  async getUserAppointments(userId: string): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.userId, userId));
  }

  async getProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    const results = await db
      .select({
        appointment: appointments,
        serviceName: professionalServices.name,
      })
      .from(appointments)
      .leftJoin(professionalServices, eq(appointments.professionalServiceId, professionalServices.id))
      .where(eq(appointments.professionalId, professionalId));
    
    return results.map(r => ({
      ...r.appointment,
      serviceName: r.serviceName || undefined,
    })) as Appointment[];
  }

  async getClinicAppointments(clinicId: string): Promise<Appointment[]> {
    const clinicProfessionals = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(eq(professionals.clinicId, clinicId));
    
    const professionalIds = clinicProfessionals.map(p => p.id);
    
    if (professionalIds.length === 0) {
      return [];
    }

    const results = await db
      .select({
        appointment: appointments,
        serviceName: professionalServices.name,
      })
      .from(appointments)
      .leftJoin(professionalServices, eq(appointments.professionalServiceId, professionalServices.id))
      .where(sql`${appointments.professionalId} IN ${professionalIds}`);
    
    return results.map(r => ({
      ...r.appointment,
      serviceName: r.serviceName || undefined,
    })) as Appointment[];
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    // First, atomically check and increment the counter for Free plan limit enforcement
    const professional = await db.query.professionals.findFirst({
      where: eq(professionals.id, insertAppointment.professionalId),
    });
    
    if (!professional) {
      throw new Error("Professional not found");
    }
    
    // For Free plan, enforce 100 appointment limit atomically
    if (professional.planType === 'free') {
      const updateResult = await db
        .update(professionals)
        .set({ 
          totalAppointmentsCreated: sql`${professionals.totalAppointmentsCreated} + 1` 
        })
        .where(
          and(
            eq(professionals.id, insertAppointment.professionalId),
            sql`${professionals.totalAppointmentsCreated} < 100`
          )
        )
        .returning();
      
      if (updateResult.length === 0) {
        // Counter update failed - limit reached
        throw new Error("APPOINTMENT_LIMIT_REACHED");
      }
    } else {
      // For other plans, just increment without limit check
      await db
        .update(professionals)
        .set({ 
          totalAppointmentsCreated: sql`${professionals.totalAppointmentsCreated} + 1` 
        })
        .where(eq(professionals.id, insertAppointment.professionalId));
    }
    
    // Now create the appointment (counter already incremented)
    const [appointment] = await db
      .insert(appointments)
      .values(insertAppointment)
      .returning();
    
    return appointment;
  }

  async updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment> {
    const [updated] = await db
      .update(appointments)
      .set(appointment as any)
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  }

  async updateAppointmentStatus(id: string, status: string): Promise<Appointment> {
    // Get the appointment to find its time slot
    const appointment = await this.getAppointment(id);
    
    // Update the appointment status
    const [updated] = await db
      .update(appointments)
      .set({ status })
      .where(eq(appointments.id, id))
      .returning();
    
    // If status is changed to cancelled, free up the time slot
    if (status === 'cancelled' && appointment?.timeSlotId) {
      await db
        .update(timeSlots)
        .set({ isBooked: false })
        .where(eq(timeSlots.id, appointment.timeSlotId));
    }
    
    return updated;
  }

  async deleteAppointment(id: string): Promise<void> {
    // Get the appointment to find its time slot and reschedule chain
    const appointment = await this.getAppointment(id);
    
    // Preserve reschedule lineage: re-point child appointments to this appointment's parent
    // This maintains the historical chain even after deletion
    await db
      .update(appointments)
      .set({ rescheduledFromId: appointment?.rescheduledFromId || null })
      .where(eq(appointments.rescheduledFromId, id));
    
    // Delete the appointment
    await db
      .delete(appointments)
      .where(eq(appointments.id, id));
    
    // If the appointment had a time slot, mark it as available again
    if (appointment?.timeSlotId) {
      await db
        .update(timeSlots)
        .set({ isBooked: false })
        .where(eq(timeSlots.id, appointment.timeSlotId));
    }
  }

  async getAppointmentByToken(token: string): Promise<Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.cancellationToken, token));
    return appointment || undefined;
  }

  async getAppointmentService(appointment: Appointment): Promise<{ id: string; name: string } | null> {
    if (appointment.professionalServiceAssignmentId) {
      const assignment = await this.getServiceAssignmentById(appointment.professionalServiceAssignmentId);
      if (assignment) {
        const clinicService = await this.getClinicService(assignment.clinicServiceId);
        return clinicService ? { id: assignment.id, name: clinicService.name } : null;
      }
    } else if (appointment.professionalServiceId) {
      const service = await this.getProfessionalService(appointment.professionalServiceId);
      return service ? { id: service.id, name: service.name } : null;
    }
    return null;
  }

  async cancelAppointmentByClient(id: string): Promise<Appointment> {
    const appointment = await this.getAppointment(id);
    
    const [updated] = await db
      .update(appointments)
      .set({
        status: 'cancelled',
        cancelledBy: 'client',
        cancelledAt: new Date(),
        cancellationToken: null, // Invalidate token to prevent reuse
      })
      .where(eq(appointments.id, id))
      .returning();
    
    if (appointment?.timeSlotId) {
      await db
        .update(timeSlots)
        .set({ isBooked: false })
        .where(eq(timeSlots.id, appointment.timeSlotId));
    }
    
    return updated;
  }

  async cancelAppointmentByProfessional(id: string): Promise<Appointment> {
    const appointment = await this.getAppointment(id);
    
    const [updated] = await db
      .update(appointments)
      .set({
        status: 'cancelled',
        cancelledBy: 'professional',
        cancelledAt: new Date(),
        cancellationToken: null, // Invalidate token to prevent reuse
      })
      .where(eq(appointments.id, id))
      .returning();
    
    if (appointment?.timeSlotId) {
      await db
        .update(timeSlots)
        .set({ isBooked: false })
        .where(eq(timeSlots.id, appointment.timeSlotId));
    }
    
    return updated;
  }

  async checkAppointmentConflict(professionalId: string, date: Date, startTime: string, endTime: string): Promise<Appointment[]> {
    // Format the date to YYYY-MM-DD for comparison
    const dateStr = date.toISOString().split('T')[0];
    
    // Filter out expired draft appointments (older than 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Check for overlapping appointments that are confirmed or pending (not cancelled, draft, rescheduled, or old drafts)
    const allConflicts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.professionalId, professionalId),
          sql`DATE(${appointments.appointmentDate}) = ${dateStr}`,
          not(eq(appointments.status, 'cancelled')),
          not(eq(appointments.status, 'draft')),
          not(eq(appointments.status, 'rescheduled')),
          or(
            // New appointment starts during existing appointment
            and(
              sql`${appointments.startTime} < ${endTime}`,
              sql`${appointments.endTime} > ${startTime}`
            )
          )
        )
      );
    
    // Filter out expired draft appointments
    const conflicts = allConflicts.filter(apt => {
      if (apt.status === 'draft' && apt.createdAt) {
        return new Date(apt.createdAt) > fifteenMinutesAgo;
      }
      return true;
    });
    
    return conflicts;
  }

  async createAppointmentWithSlot(appointmentData: Omit<InsertAppointment, 'professionalId' | 'appointmentDate'>): Promise<Appointment> {
    // Perform atomic booking operation in a transaction
    return await db.transaction(async (tx) => {
      // Get and lock the time slot
      let [timeSlot] = await tx
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, appointmentData.timeSlotId!))
        .for('update');

      // If slot doesn't exist, check if it's a dynamic slot and create it
      if (!timeSlot) {
        const slotId = appointmentData.timeSlotId!;
        const parts = slotId.split('-');
        
        // Check if this is a dynamic slot ID (format: professionalId-date-time)
        // Need at least 4 parts: uuid parts (5), date (3), time (2)
        if (parts.length >= 8) {
          try {
            // Extract professional ID (first 5 parts joined with -)
            const professionalId = parts.slice(0, 5).join('-');
            // Extract date (next 3 parts joined with -)
            const dateStr = parts.slice(5, 8).join('-');
            // Extract start time (remaining parts joined with :)
            const startTime = parts.slice(8).join(':');
            
            // Parse the date and time in the local timezone (default to America/Toronto for Canada)
            // fromZonedTime expects a date that represents the local date/time as if it were in the specified timezone
            const timezone = 'America/Toronto'; // TODO: Get from professional or clinic settings
            const [hours, minutes] = startTime.split(':').map(Number);
            
            // Parse the date string to get year, month, day
            const [year, month, day] = dateStr.split('-').map(Number);
            
            // Create two dates:
            // 1. slotDate - date at midnight in the local timezone, converted to UTC (for appointmentDate field)
            // 2. slotDateTime - full date+time for validation
            
            // Date at midnight local time, converted to UTC for storage
            const naiveDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            const slotDate = fromZonedTime(naiveDate, timezone);
            
            // Full date+time for "is in the past" validation
            const naiveDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
            const slotDateTime = fromZonedTime(naiveDateTime, timezone);
            
            if (isNaN(slotDate.getTime()) || isNaN(slotDateTime.getTime())) {
              throw new Error('Invalid date in slot ID');
            }
            
            // Validate slot is not in the past
            const now = new Date();
            
            if (slotDateTime < now) {
              console.log(`[DEBUG] Slot ${slotId} is in the past: ${slotDateTime} < ${now}`);
              throw new Error('Cannot book appointments in the past');
            }
            
            // Get professional to access appointmentDuration
            const prof = await tx.select().from(professionals).where(eq(professionals.id, professionalId));
            let slotDuration = prof[0]?.appointmentDuration || 30;
            
            // If a service is selected, use its duration
            if (appointmentData.professionalServiceId) {
              const service = await tx.select().from(professionalServices).where(eq(professionalServices.id, appointmentData.professionalServiceId));
              if (service[0] && service[0].duration) {
                slotDuration = service[0].duration;
              }
            }
            
            // Calculate end time based on professional's appointment duration
            const startMinutes = hours * 60 + minutes;
            const endMinutes = startMinutes + slotDuration;
            const endHours = Math.floor(endMinutes / 60);
            const endMins = endMinutes % 60;
            const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
            
            // Validate the slot is within professional's schedule
            // Use naiveDateTime (local time with hours) to get the correct day of week
            const dayOfWeek = naiveDateTime.getDay();
            const schedules = await tx
              .select()
              .from(professionalSchedules)
              .where(
                and(
                  eq(professionalSchedules.professionalId, professionalId),
                  eq(professionalSchedules.dayOfWeek, dayOfWeek),
                  eq(professionalSchedules.isAvailable, true)
                )
              );
            
            const timeToMinutes = (time: string) => {
              const [h, m] = time.split(':').map(Number);
              return h * 60 + m;
            };
            
            const isWithinSchedule = schedules.some(schedule => {
              const schedStart = timeToMinutes(schedule.startTime);
              const schedEnd = timeToMinutes(schedule.endTime);
              return startMinutes >= schedStart && endMinutes <= schedEnd;
            });
            
            if (!isWithinSchedule) {
              throw new Error('Time slot is outside professional working hours');
            }
            
            // Check if slot overlaps with any breaks
            const breaks = await tx
              .select()
              .from(professionalBreaks)
              .where(
                and(
                  eq(professionalBreaks.professionalId, professionalId),
                  eq(professionalBreaks.dayOfWeek, dayOfWeek)
                )
              );
            
            const isDuringBreak = breaks.some(b => {
              const breakStart = timeToMinutes(b.startTime);
              const breakEnd = timeToMinutes(b.endTime);
              return startMinutes < breakEnd && endMinutes > breakStart;
            });
            
            if (isDuringBreak) {
              throw new Error('Time slot overlaps with professional break');
            }
            
            // Check if slot overlaps with existing appointments (exclude cancelled and expired draft appointments)
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            
            const existingAppointments = await tx
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.professionalId, professionalId),
                  eq(appointments.appointmentDate, slotDate),
                  not(eq(appointments.status, 'cancelled'))
                )
              );
            
            // Filter out expired draft appointments
            const activeAppointments = existingAppointments.filter(apt => {
              if (apt.status === 'draft' && apt.createdAt) {
                return new Date(apt.createdAt) > fifteenMinutesAgo;
              }
              return true;
            });
            
            const hasConflict = activeAppointments.some(apt => {
              if (!apt.startTime || !apt.endTime) return false;
              const aptStart = timeToMinutes(apt.startTime);
              const aptEnd = timeToMinutes(apt.endTime);
              return startMinutes < aptEnd && endMinutes > aptStart;
            });
            
            if (hasConflict) {
              throw new Error('Time slot conflicts with existing appointment');
            }
            
            // Try to insert the dynamic slot
            try {
              [timeSlot] = await tx
                .insert(timeSlots)
                .values({
                  id: slotId,
                  professionalId,
                  slotDate,
                  startTime,
                  endTime,
                  isBooked: false,
                })
                .onConflictDoNothing()
                .returning();
              
              // If insert was skipped due to conflict, the slot already exists
              // Fetch it to continue - the final conflict check will validate availability
              if (!timeSlot) {
                [timeSlot] = await tx
                  .select()
                  .from(timeSlots)
                  .where(eq(timeSlots.id, slotId));
                
                if (!timeSlot) {
                  throw new Error('Time slot not found after conflict');
                }
                console.log(`[DEBUG] Dynamic slot ${slotId} already exists, will validate via appointment check`);
              } else {
                console.log(`[DEBUG] Created new dynamic slot ${slotId}`);
              }
            } catch (error) {
              console.error('Error with dynamic time slot:', error);
              throw error instanceof Error ? error : new Error('Time slot creation failed');
            }
          } catch (error) {
            console.error('Error validating/creating dynamic time slot:', error);
            throw error instanceof Error ? error : new Error('Time slot not found');
          }
        } else {
          throw new Error('Time slot not found');
        }
      }

      if (!timeSlot) {
        throw new Error('Time slot not found');
      }

      console.log(`[DEBUG] TimeSlot ${timeSlot.id}: isBooked=${timeSlot.isBooked}, date=${timeSlot.slotDate}, time=${timeSlot.startTime}`);

      // Get professional info to access clinicId
      const professionalData = await tx
        .select()
        .from(professionals)
        .where(eq(professionals.id, timeSlot.professionalId));
      
      const professional = professionalData[0];

      // Find or create patient - inline logic to work within transaction
      const existingPatientData = await tx.select()
        .from(patients)
        .where(
          and(
            eq(patients.professionalId, timeSlot.professionalId),
            eq(patients.email, appointmentData.email)
          )
        );

      let patient = existingPatientData[0];

      if (!patient) {
        // Create new patient
        const newPatientData = await tx
          .insert(patients)
          .values({
            professionalId: timeSlot.professionalId,
            clinicId: professional?.clinicId || null,
            firstName: appointmentData.firstName,
            lastName: appointmentData.lastName,
            email: appointmentData.email,
            phone: appointmentData.phone,
            dateOfBirth: null,
            address: null,
            city: null,
            postalCode: null,
            notes: null,
          })
          .returning();
        
        patient = newPatientData[0];
      }

      // CRITICAL: Re-check for conflicts just before creating appointment to prevent race conditions
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const finalConflictCheck = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.professionalId, timeSlot.professionalId),
            eq(appointments.appointmentDate, timeSlot.slotDate),
            not(eq(appointments.status, 'cancelled'))
          )
        );
      
      // Filter out expired draft appointments for final check
      const activeFinalAppointments = finalConflictCheck.filter(apt => {
        if (apt.status === 'draft' && apt.createdAt) {
          return new Date(apt.createdAt) > fifteenMinutesAgo;
        }
        return true;
      });
      
      const timeToMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };
      
      const startMinutes = timeToMinutes(timeSlot.startTime);
      const endMinutes = timeToMinutes(timeSlot.endTime);
      
      const hasFinalConflict = activeFinalAppointments.some(apt => {
        if (!apt.startTime || !apt.endTime) return false;
        const aptStart = timeToMinutes(apt.startTime);
        const aptEnd = timeToMinutes(apt.endTime);
        return startMinutes < aptEnd && endMinutes > aptStart;
      });
      
      if (hasFinalConflict) {
        throw new Error('Time slot is already booked');
      }

      // Create the appointment with patientId
      const [appointment] = await tx
        .insert(appointments)
        .values({
          ...appointmentData,
          professionalId: timeSlot.professionalId,
          appointmentDate: timeSlot.slotDate,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          patientId: patient.id,
        })
        .returning();

      // Mark the time slot as booked AFTER successful appointment creation
      await tx
        .update(timeSlots)
        .set({ isBooked: true })
        .where(eq(timeSlots.id, appointmentData.timeSlotId!));

      console.log(`[DEBUG] Successfully created appointment ${appointment.id} and marked slot ${appointmentData.timeSlotId} as booked`);

      return appointment;
    });
  }

  // Availability operations
  async getProfessionalSchedules(professionalId: string): Promise<ProfessionalSchedule[]> {
    return await db.select().from(professionalSchedules).where(eq(professionalSchedules.professionalId, professionalId));
  }

  async getProfessionalSchedule(id: string): Promise<ProfessionalSchedule | undefined> {
    const [schedule] = await db.select().from(professionalSchedules).where(eq(professionalSchedules.id, id));
    return schedule || undefined;
  }

  async createProfessionalSchedule(insertSchedule: InsertProfessionalSchedule): Promise<ProfessionalSchedule> {
    const [schedule] = await db
      .insert(professionalSchedules)
      .values(insertSchedule)
      .returning();
    return schedule;
  }

  async updateProfessionalSchedule(id: string, scheduleUpdate: Partial<InsertProfessionalSchedule>): Promise<ProfessionalSchedule> {
    const [updated] = await db
      .update(professionalSchedules)
      .set(scheduleUpdate)
      .where(eq(professionalSchedules.id, id))
      .returning();
    return updated;
  }

  async deleteProfessionalSchedule(id: string): Promise<void> {
    await db.delete(professionalSchedules).where(eq(professionalSchedules.id, id));
  }

  async getProfessionalBreaks(professionalId: string): Promise<ProfessionalBreak[]> {
    return await db.select().from(professionalBreaks).where(eq(professionalBreaks.professionalId, professionalId));
  }

  async getProfessionalBreak(id: string): Promise<ProfessionalBreak | undefined> {
    const [breakData] = await db.select().from(professionalBreaks).where(eq(professionalBreaks.id, id));
    return breakData || undefined;
  }

  async createProfessionalBreak(insertBreak: InsertProfessionalBreak): Promise<ProfessionalBreak> {
    const [breakData] = await db
      .insert(professionalBreaks)
      .values(insertBreak)
      .returning();
    return breakData;
  }

  async updateProfessionalBreak(id: string, breakUpdate: Partial<InsertProfessionalBreak>): Promise<ProfessionalBreak> {
    const [updated] = await db
      .update(professionalBreaks)
      .set(breakUpdate)
      .where(eq(professionalBreaks.id, id))
      .returning();
    return updated;
  }

  async deleteProfessionalBreak(id: string): Promise<void> {
    await db.delete(professionalBreaks).where(eq(professionalBreaks.id, id));
  }

  async getProfessionalServices(professionalId: string): Promise<ProfessionalService[]> {
    // Check if professional belongs to a clinic (uses new system)
    const professional = await this.getProfessional(professionalId);
    
    // First try to get from new system (clinic services + assignments)
    const assignedServices = await this.getProfessionalAssignedServices(professionalId);
    
    if (assignedServices.length > 0) {
      return assignedServices as ProfessionalService[];
    }
    
    // Only fallback to old professionalServices table if professional doesn't have a clinic
    // This prevents showing old services when all clinic services have been deleted
    if (professional?.clinicId) {
      // Professional has a clinic but no assigned services - return empty array
      return [];
    }
    
    // Fallback to old professionalServices table for backwards compatibility (professionals without clinic)
    const services = await db
      .select()
      .from(professionalServices)
      .where(eq(professionalServices.professionalId, professionalId))
      .orderBy(professionalServices.displayOrder);
    return services;
  }

  async getProfessionalService(id: string): Promise<ProfessionalService | undefined> {
    // First try to find in old professionalServices table (for backwards compatibility)
    const [oldService] = await db
      .select()
      .from(professionalServices)
      .where(eq(professionalServices.id, id));
    
    if (oldService) {
      return oldService;
    }
    
    // Try to find in professional_service_assignments (new system)
    const [assignment] = await db
      .select({
        id: professionalServiceAssignments.id,
        professionalId: professionalServiceAssignments.professionalId,
        name: clinicServices.name,
        duration: clinicServices.duration,
        price: clinicServices.price,
        description: clinicServices.description,
        bufferTime: clinicServices.bufferTime,
        isVisible: professionalServiceAssignments.isVisible,
        clinicServiceId: clinicServices.id,
        displayOrder: professionalServiceAssignments.displayOrder,
        category: clinicServices.category,
        color: clinicServices.color,
      })
      .from(professionalServiceAssignments)
      .leftJoin(clinicServices, eq(professionalServiceAssignments.clinicServiceId, clinicServices.id))
      .where(eq(professionalServiceAssignments.id, id));
    
    // Only return if the clinic service exists (JOIN succeeded)
    // If clinic service was deleted, clinicServiceId will be null
    // Note: duration can be null intentionally to use professional defaults
    if (assignment && assignment.clinicServiceId !== null) {
      return assignment as any;
    }
    
    // If not found, try to find in new clinicServices table
    const [clinicService] = await db
      .select()
      .from(clinicServices)
      .where(eq(clinicServices.id, id));
    
    // Return in ProfessionalService-compatible format
    if (clinicService) {
      return {
        id: clinicService.id,
        professionalId: clinicService.createdBy, // Use createdBy as professionalId for compatibility
        name: clinicService.name,
        duration: clinicService.duration,
        price: clinicService.price,
        description: clinicService.description,
        bufferTime: clinicService.bufferTime,
        isVisible: true, // clinic services are always visible
        displayOrder: clinicService.displayOrder || 1,
        category: clinicService.category,
        color: clinicService.color,
      } as ProfessionalService;
    }
    
    return undefined;
  }

  async createProfessionalService(service: InsertProfessionalService): Promise<ProfessionalService> {
    const [created] = await db.insert(professionalServices).values(service).returning();
    return created;
  }

  async updateProfessionalService(id: string, service: Partial<InsertProfessionalService>): Promise<ProfessionalService> {
    const [updated] = await db
      .update(professionalServices)
      .set(service)
      .where(eq(professionalServices.id, id))
      .returning();
    return updated;
  }

  async deleteProfessionalService(id: string): Promise<void> {
    // First, set professionalServiceId to null in appointments that reference this service
    await db
      .update(appointments)
      .set({ professionalServiceId: null })
      .where(eq(appointments.professionalServiceId, id));
    
    // Set professionalServiceId to null in waitlist entries that reference this service
    await db
      .update(waitlistEntries)
      .set({ professionalServiceId: null })
      .where(eq(waitlistEntries.professionalServiceId, id));
    
    // Now delete the service
    await db.delete(professionalServices).where(eq(professionalServices.id, id));
  }

  async getAvailableTimeSlots(professionalId: string, fromDate?: Date, toDate?: Date, excludeAppointmentId?: string, professionalServiceId?: string, skipMinimumAdvanceBooking?: boolean): Promise<TimeSlot[]> {
    if (!fromDate) {
      fromDate = new Date();
    }
    if (!toDate) {
      const defaultToDate = new Date(fromDate);
      defaultToDate.setDate(defaultToDate.getDate() + 14);
      toDate = defaultToDate;
    }

    // Get professional to access appointmentDuration and bufferTime
    const professional = await this.getProfessional(professionalId);
    if (!professional) {
      return [];
    }
    
    // If a service is selected, use its duration and bufferTime, otherwise use defaults
    let slotDuration = professional.appointmentDuration || 30;
    let bufferTime = professional.bufferTime !== undefined && professional.bufferTime !== null ? professional.bufferTime : 5;
    
    if (professionalServiceId) {
      const service = await this.getProfessionalService(professionalServiceId);
      if (service) {
        if (service.duration) {
          slotDuration = service.duration;
        }
        // Use service's bufferTime if defined, otherwise keep professional's bufferTime
        if (service.bufferTime !== undefined && service.bufferTime !== null) {
          bufferTime = service.bufferTime;
        }
      }
    }
    
    // Calculate DTS (Durée Totale du Slot) = service duration + buffer time
    const totalSlotDuration = slotDuration + bufferTime;

    const schedules = await db.select()
      .from(professionalSchedules)
      .where(
        and(
          eq(professionalSchedules.professionalId, professionalId),
          eq(professionalSchedules.isAvailable, true)
        )
      );

    const breaks = await db.select()
      .from(professionalBreaks)
      .where(eq(professionalBreaks.professionalId, professionalId));

    // Fetch appointments, excluding cancelled and rescheduled ones
    // Also exclude draft appointments older than 15 minutes (expired drafts)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const allAppointments = await db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.professionalId, professionalId),
          gte(appointments.appointmentDate, fromDate),
          lte(appointments.appointmentDate, toDate),
          not(eq(appointments.status, 'cancelled')),
          not(eq(appointments.status, 'rescheduled'))
        )
      );
    
    // Filter out expired draft appointments and excluded appointment
    const appointmentsList = allAppointments.filter(apt => {
      // Exclude specific appointment if provided (for rescheduling)
      if (excludeAppointmentId && apt.id === excludeAppointmentId) {
        return false;
      }
      // Exclude expired drafts
      if (apt.status === 'draft' && apt.createdAt) {
        return new Date(apt.createdAt) > fifteenMinutesAgo;
      }
      return true;
    });

    // CRITICAL: Fetch existing time slots that are marked as booked
    // This prevents showing slots that are locked but don't have appointments yet
    const bookedTimeSlots = await db.select()
      .from(timeSlots)
      .where(
        and(
          eq(timeSlots.professionalId, professionalId),
          eq(timeSlots.isBooked, true),
          gte(timeSlots.slotDate, fromDate),
          lte(timeSlots.slotDate, toDate)
        )
      );

    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const minutesToTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const slots: TimeSlot[] = [];
    const slotIds = new Set<string>();
    const currentDate = new Date(fromDate);
    
    // Get current date/time in Toronto timezone for comparison
    const nowInToronto = toZonedTime(new Date(), 'America/Toronto');
    const todayStrToronto = formatInTimeZone(nowInToronto, 'America/Toronto', 'yyyy-MM-dd');
    
    while (currentDate <= toDate) {
      // Get current date as string in Toronto timezone for comparison
      const currentDateStr = formatInTimeZone(currentDate, 'America/Toronto', 'yyyy-MM-dd');
      
      // Skip dates that are before today (in Toronto timezone)
      if (currentDateStr < todayStrToronto) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      const dayOfWeek = currentDate.getDay();
      const isToday = currentDateStr === todayStrToronto;
      
      const daySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek);
      
      for (const schedule of daySchedules) {
        const scheduleStart = timeToMinutes(schedule.startTime);
        const scheduleEnd = timeToMinutes(schedule.endTime);
        
        for (let slotStartMinutes = scheduleStart; slotStartMinutes < scheduleEnd; slotStartMinutes += totalSlotDuration) {
          const slotEndMinutes = slotStartMinutes + slotDuration;
          
          if (slotEndMinutes > scheduleEnd) break;
          
          const slotStart = minutesToTime(slotStartMinutes);
          const slotEnd = minutesToTime(slotEndMinutes);
          
          // For today's slots, skip if time has already passed or is within 15 minutes
          // This ensures clients have enough time to complete the booking process
          // skipMinimumAdvanceBooking can be used during booking validation to allow slots that are being actively booked
          if (isToday && !skipMinimumAdvanceBooking) {
            const nowMinutes = nowInToronto.getHours() * 60 + nowInToronto.getMinutes();
            const bufferMinutes = 15; // Minimum advance booking time
            if (slotStartMinutes <= nowMinutes + bufferMinutes) {
              continue;
            }
          }
          
          const isDuringBreak = breaks.some(b => {
            if (b.dayOfWeek !== dayOfWeek) return false;
            const breakStart = timeToMinutes(b.startTime);
            const breakEnd = timeToMinutes(b.endTime);
            return slotStartMinutes < breakEnd && slotEndMinutes > breakStart;
          });
          
          if (isDuringBreak) continue;
          
          const isBooked = appointmentsList.some(apt => {
            const aptDate = new Date(apt.appointmentDate);
            if (aptDate.toDateString() !== currentDate.toDateString()) return false;
            if (!apt.startTime || !apt.endTime) return false;
            const aptStart = timeToMinutes(apt.startTime);
            const aptEnd = timeToMinutes(apt.endTime);
            return slotStartMinutes < aptEnd && slotEndMinutes > aptStart;
          });
          
          if (isBooked) continue;

          // Generate slot ID for checking
          const slotId = `${professionalId}-${currentDate.toISOString().split('T')[0]}-${slotStart}`;
          
          // CRITICAL: Also check if this time slot is already marked as booked in the database
          const isSlotMarkedBooked = bookedTimeSlots.some(slot => {
            if (slot.id === slotId) return true;
            // Also check by date and time in case of non-standard IDs
            const slotDate = new Date(slot.slotDate);
            return slotDate.toDateString() === currentDate.toDateString() &&
                   slot.startTime === slotStart &&
                   slot.endTime === slotEnd;
          });

          if (isSlotMarkedBooked) continue;
          if (slotIds.has(slotId)) continue;
          
          slotIds.add(slotId);
          slots.push({
            id: slotId,
            professionalId,
            slotDate: new Date(currentDate),
            startTime: slotStart,
            endTime: slotEnd,
            isBooked: false,
            createdAt: new Date(),
          });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return slots;
  }

  async getTimeSlot(id: string): Promise<TimeSlot | undefined> {
    const [timeSlot] = await db.select().from(timeSlots).where(eq(timeSlots.id, id));
    return timeSlot || undefined;
  }

  async createTimeSlot(insertTimeSlot: InsertTimeSlot): Promise<TimeSlot> {
    const [timeSlot] = await db
      .insert(timeSlots)
      .values(insertTimeSlot)
      .returning();
    return timeSlot;
  }

  async markTimeSlotAsBooked(timeSlotId: string): Promise<void> {
    await db
      .update(timeSlots)
      .set({ isBooked: true })
      .where(eq(timeSlots.id, timeSlotId));
  }

  async searchProfessionalsWithAvailability(profession?: string, city?: string, province?: string, availableAfter?: Date): Promise<Professional[]> {
    // Build all filter conditions
    const conditions = [];
    
    // Only show publicly visible and not deleted professionals in search results
    conditions.push(eq(professionals.publiclyVisible, true));
    conditions.push(isNull(professionals.deletedAt));
    
    // Exclude secretaries from search results - only show actual professionals
    // Secretaries work for professionals but don't offer services themselves
    // Use SQL NOT EXISTS to exclude secretaries (only active, non-cancelled memberships)
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM clinic_members cm 
        WHERE cm.professional_id = ${professionals.id} 
        AND cm.role = 'Secrétaire'
        AND cm.cancelled = false
      )`
    );
    
    if (profession) {
      // Search in professions array (using ANY operator), firstName, or lastName
      // Use unaccent() to make search accent-insensitive (osteopathe matches Ostéopathe)
      conditions.push(
        or(
          sql`unaccent(${profession}) ILIKE ANY(SELECT unaccent(p) FROM unnest(${professionals.professions}) p)`,
          sql`EXISTS (SELECT 1 FROM unnest(${professionals.professions}) AS p WHERE unaccent(p) ILIKE unaccent(${`%${profession}%`}))`,
          sql`unaccent(${professionals.firstName}) ILIKE unaccent(${`%${profession}%`})`,
          sql`unaccent(${professionals.lastName}) ILIKE unaccent(${`%${profession}%`})`
        )
      );
    }
    if (city) {
      conditions.push(ilike(professionals.city, `%${city}%`));
    }
    if (province) {
      conditions.push(eq(professionals.province, province));
    }

    // If availability is required, add EXISTS subquery to avoid duplication
    if (availableAfter) {
      conditions.push(
        exists(
          db.select()
            .from(timeSlots)
            .where(
              and(
                eq(timeSlots.professionalId, professionals.id),
                eq(timeSlots.isBooked, false),
                gte(timeSlots.slotDate, availableAfter)
              )
            )
        )
      );
    }

    return await db.select()
      .from(professionals)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  // Team invitation operations
  async createInvitation(insertInvitation: InsertTeamInvitation): Promise<TeamInvitation> {
    const [invitation] = await db
      .insert(teamInvitations)
      .values(insertInvitation)
      .returning();
    return invitation;
  }

  async getInvitation(id: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, id));
    return invitation || undefined;
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.token, token));
    return invitation || undefined;
  }

  async getClinicInvitations(clinicId: string): Promise<TeamInvitation[]> {
    return await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.clinicId, clinicId));
  }

  async getPendingInvitationByEmail(clinicId: string, email: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.clinicId, clinicId),
          eq(teamInvitations.email, email),
          eq(teamInvitations.status, 'pending')
        )
      );
    return invitation || undefined;
  }

  async updateInvitationStatus(id: string, status: string, professionalId?: string): Promise<TeamInvitation> {
    const updateData: any = { status };
    if (professionalId) {
      updateData.professionalId = professionalId;
      updateData.acceptedAt = new Date();
    }
    
    const [updated] = await db
      .update(teamInvitations)
      .set(updateData)
      .where(eq(teamInvitations.id, id))
      .returning();
    return updated;
  }

  async deleteInvitation(id: string): Promise<void> {
    await db
      .delete(teamInvitations)
      .where(eq(teamInvitations.id, id));
  }

  async getInvitedProfessionals(clinicId: string): Promise<Professional[]> {
    // Get all accepted invitations for this clinic
    const invitations = await db
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.clinicId, clinicId),
          eq(teamInvitations.status, 'accepted')
        )
      );

    if (invitations.length === 0) {
      return [];
    }

    // Get the professional IDs from the invitations
    const professionalIds = invitations
      .map(inv => inv.professionalId)
      .filter((id): id is string => id !== null);

    if (professionalIds.length === 0) {
      return [];
    }

    // Get all the professionals
    return await db
      .select()
      .from(professionals)
      .where(sql`${professionals.id} IN ${professionalIds}`);
  }

  // Secretary assignment operations
  async createSecretaryAssignment(assignment: InsertSecretaryAssignment): Promise<SecretaryAssignment> {
    const [created] = await db
      .insert(secretaryAssignments)
      .values(assignment)
      .returning();
    return created;
  }

  async getSecretaryAssignments(secretaryId: string): Promise<SecretaryAssignment[]> {
    return await db
      .select()
      .from(secretaryAssignments)
      .where(eq(secretaryAssignments.secretaryId, secretaryId));
  }

  async getProfessionalSecretaries(professionalId: string): Promise<SecretaryAssignment[]> {
    return await db
      .select()
      .from(secretaryAssignments)
      .where(eq(secretaryAssignments.professionalId, professionalId));
  }

  async deleteSecretaryAssignment(secretaryId: string, professionalId: string): Promise<void> {
    await db
      .delete(secretaryAssignments)
      .where(
        and(
          eq(secretaryAssignments.secretaryId, secretaryId),
          eq(secretaryAssignments.professionalId, professionalId)
        )
      );
  }

  async getAssignedProfessionals(secretaryId: string): Promise<Professional[]> {
    const assignments = await db
      .select()
      .from(secretaryAssignments)
      .where(eq(secretaryAssignments.secretaryId, secretaryId));

    if (assignments.length === 0) {
      return [];
    }

    const professionalIds = assignments.map(a => a.professionalId);

    return await db
      .select()
      .from(professionals)
      .where(inArray(professionals.id, professionalIds));
  }

  // Clinic service operations (admin only)
  async getClinicServices(clinicId: string): Promise<ClinicService[]> {
    return await db
      .select()
      .from(clinicServices)
      .where(eq(clinicServices.clinicId, clinicId))
      .orderBy(clinicServices.displayOrder);
  }

  async getClinicService(id: string): Promise<ClinicService | undefined> {
    const [service] = await db
      .select()
      .from(clinicServices)
      .where(eq(clinicServices.id, id));
    return service || undefined;
  }

  async createClinicService(service: InsertClinicService): Promise<ClinicService> {
    const [created] = await db
      .insert(clinicServices)
      .values(service)
      .returning();
    return created;
  }

  async updateClinicService(id: string, service: Partial<InsertClinicService>): Promise<ClinicService> {
    const [updated] = await db
      .update(clinicServices)
      .set(service)
      .where(eq(clinicServices.id, id))
      .returning();
    return updated;
  }

  async countAppointmentsForClinicService(clinicServiceId: string): Promise<number> {
    // Get all assignments for this clinic service
    const assignments = await db
      .select({ id: professionalServiceAssignments.id })
      .from(professionalServiceAssignments)
      .where(eq(professionalServiceAssignments.clinicServiceId, clinicServiceId));
    
    if (assignments.length === 0) {
      return 0;
    }
    
    // Count appointments that reference any of these assignments
    const assignmentIds = assignments.map(a => a.id);
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(inArray(appointments.professionalServiceAssignmentId, assignmentIds));
    
    return result?.count || 0;
  }

  async deleteClinicService(id: string): Promise<void> {
    // First delete all assignments
    await db
      .delete(professionalServiceAssignments)
      .where(eq(professionalServiceAssignments.clinicServiceId, id));
    
    // Then delete the service
    await db
      .delete(clinicServices)
      .where(eq(clinicServices.id, id));
  }

  // Professional service assignment operations
  async getProfessionalAssignedServices(professionalId: string): Promise<any[]> {
    // Join assignments with clinic services to get full service details
    // Return in ProfessionalService-compatible format for backwards compatibility
    const result = await db
      .select({
        id: professionalServiceAssignments.id, // Use assignment ID as main ID (this is what appointments table expects)
        professionalId: professionalServiceAssignments.professionalId,
        name: clinicServices.name,
        duration: clinicServices.duration,
        price: clinicServices.price,
        description: clinicServices.description,
        bufferTime: clinicServices.bufferTime,
        isVisible: professionalServiceAssignments.isVisible,
        // Additional fields from new system
        clinicServiceId: clinicServices.id,
        displayOrder: professionalServiceAssignments.displayOrder,
        category: clinicServices.category,
        color: clinicServices.color,
      })
      .from(professionalServiceAssignments)
      .leftJoin(clinicServices, eq(professionalServiceAssignments.clinicServiceId, clinicServices.id))
      .where(eq(professionalServiceAssignments.professionalId, professionalId))
      .orderBy(professionalServiceAssignments.displayOrder);
    
    return result;
  }

  async getClinicServiceAssignments(clinicServiceId: string): Promise<ProfessionalServiceAssignment[]> {
    return await db
      .select()
      .from(professionalServiceAssignments)
      .where(eq(professionalServiceAssignments.clinicServiceId, clinicServiceId));
  }

  async getServiceAssignmentById(assignmentId: string): Promise<ProfessionalServiceAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(professionalServiceAssignments)
      .where(eq(professionalServiceAssignments.id, assignmentId));
    return assignment || undefined;
  }

  async createServiceAssignment(assignment: InsertProfessionalServiceAssignment): Promise<ProfessionalServiceAssignment> {
    const [created] = await db
      .insert(professionalServiceAssignments)
      .values(assignment)
      .returning();
    return created;
  }

  async deleteServiceAssignment(clinicServiceId: string, professionalId: string): Promise<void> {
    await db
      .delete(professionalServiceAssignments)
      .where(
        and(
          eq(professionalServiceAssignments.clinicServiceId, clinicServiceId),
          eq(professionalServiceAssignments.professionalId, professionalId)
        )
      );
  }

  async updateServiceAssignmentVisibility(id: string, isVisible: boolean): Promise<ProfessionalServiceAssignment> {
    const [updated] = await db
      .update(professionalServiceAssignments)
      .set({ isVisible })
      .where(eq(professionalServiceAssignments.id, id))
      .returning();
    return updated;
  }

  // Waitlist operations
  async createWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const [created] = await db
      .insert(waitlistEntries)
      .values(entry)
      .returning();
    return created;
  }

  async getWaitlistEntry(id: string): Promise<WaitlistEntry | undefined> {
    const [entry] = await db
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.id, id));
    return entry || undefined;
  }

  async getWaitlistEntryByToken(token: string): Promise<WaitlistEntry | undefined> {
    const [entry] = await db
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.token, token));
    return entry || undefined;
  }

  async getProfessionalWaitlistEntries(professionalId: string, status?: string): Promise<WaitlistEntry[]> {
    if (status) {
      return await db
        .select()
        .from(waitlistEntries)
        .where(
          and(
            eq(waitlistEntries.professionalId, professionalId),
            eq(waitlistEntries.status, status)
          )
        )
        .orderBy(waitlistEntries.createdAt);
    }
    
    return await db
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.professionalId, professionalId))
      .orderBy(waitlistEntries.createdAt);
  }

  async findMatchingWaitlistEntries(professionalId: string, serviceId: string | null, date: Date): Promise<WaitlistEntry[]> {
    // Find waitlist entries that match the professional and service
    // Client should be notified if their preferred date is on or before the cancelled appointment date
    // (within a 14-day window to avoid notifying very old entries)
    const dateStr = date.toISOString().split('T')[0];
    
    // Calculate date 14 days before the cancelled appointment
    const fourteenDaysBefore = new Date(date);
    fourteenDaysBefore.setDate(fourteenDaysBefore.getDate() - 14);
    const fourteenDaysBeforeStr = fourteenDaysBefore.toISOString().split('T')[0];
    
    const conditions = [
      eq(waitlistEntries.professionalId, professionalId),
      eq(waitlistEntries.status, 'pending'),
      // Client's preferred date should be <= cancelled appointment date (they want that date or earlier)
      sql`DATE(${waitlistEntries.preferredDate}) <= ${dateStr}`,
      // AND >= 14 days before the cancelled date (to avoid notifying very old entries)
      sql`DATE(${waitlistEntries.preferredDate}) >= ${fourteenDaysBeforeStr}`
    ];
    
    // If serviceId is provided, filter by service
    // If serviceId is null, match entries that also have null serviceId OR any service
    if (serviceId) {
      conditions.push(
        sql`(${waitlistEntries.professionalServiceId} = ${serviceId} OR ${waitlistEntries.professionalServiceId} IS NULL)`
      );
    } else {
      // If cancelled appointment has no service, only match waitlist entries with no service
      conditions.push(sql`${waitlistEntries.professionalServiceId} IS NULL`);
    }
    
    return await db
      .select()
      .from(waitlistEntries)
      .where(and(...conditions))
      .orderBy(waitlistEntries.createdAt); // FIFO order
  }

  async updateWaitlistEntryStatus(
    id: string, 
    status: string, 
    notifiedAt?: Date, 
    expiresAt?: Date,
    availableDate?: Date,
    availableStartTime?: string,
    availableEndTime?: string
  ): Promise<WaitlistEntry> {
    const updateData: any = { status };
    
    if (notifiedAt) {
      updateData.notifiedAt = notifiedAt;
    }
    
    if (expiresAt) {
      updateData.expiresAt = expiresAt;
    }

    if (availableDate) {
      updateData.availableDate = availableDate;
    }

    if (availableStartTime) {
      updateData.availableStartTime = availableStartTime;
    }

    if (availableEndTime) {
      updateData.availableEndTime = availableEndTime;
    }
    
    const [updated] = await db
      .update(waitlistEntries)
      .set(updateData)
      .where(eq(waitlistEntries.id, id))
      .returning();
    return updated;
  }

  async deleteWaitlistEntry(id: string): Promise<void> {
    await db
      .delete(waitlistEntries)
      .where(eq(waitlistEntries.id, id));
  }

  async expireStaleWaitlistEntries(): Promise<number> {
    // Expire entries that are in 'notified' status and past their expiration time
    const now = new Date();
    
    const expiredEntries = await db
      .update(waitlistEntries)
      .set({ status: 'expired' })
      .where(
        and(
          eq(waitlistEntries.status, 'notified'),
          lte(waitlistEntries.expiresAt, now)
        )
      )
      .returning();
    
    return expiredEntries.length;
  }

  // Widget configuration operations
  async createWidget(widget: InsertWidgetConfiguration): Promise<WidgetConfiguration> {
    const [created] = await db
      .insert(widgetConfigurations)
      .values(widget)
      .returning();
    return created;
  }

  async getWidget(id: string): Promise<WidgetConfiguration | undefined> {
    const [widget] = await db
      .select()
      .from(widgetConfigurations)
      .where(eq(widgetConfigurations.id, id));
    return widget || undefined;
  }

  async getWidgetBySlug(slug: string): Promise<WidgetConfiguration | undefined> {
    const [widget] = await db
      .select()
      .from(widgetConfigurations)
      .where(eq(widgetConfigurations.slug, slug));
    return widget || undefined;
  }

  async getWidgetByProfessional(professionalId: string): Promise<WidgetConfiguration | undefined> {
    const [widget] = await db
      .select()
      .from(widgetConfigurations)
      .where(eq(widgetConfigurations.professionalId, professionalId));
    return widget || undefined;
  }

  async getWidgetByClinic(clinicId: string): Promise<WidgetConfiguration | undefined> {
    const [widget] = await db
      .select()
      .from(widgetConfigurations)
      .where(eq(widgetConfigurations.clinicId, clinicId));
    return widget || undefined;
  }

  async updateWidget(id: string, widget: Partial<InsertWidgetConfiguration>): Promise<WidgetConfiguration> {
    const [updated] = await db
      .update(widgetConfigurations)
      .set({ ...widget, updatedAt: new Date() })
      .where(eq(widgetConfigurations.id, id))
      .returning();
    return updated;
  }

  async deleteWidget(id: string): Promise<void> {
    await db.delete(widgetConfigurations).where(eq(widgetConfigurations.id, id));
  }

  async checkSlugAvailability(slug: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(widgetConfigurations)
      .where(eq(widgetConfigurations.slug, slug));
    return !existing;
  }

  // Subscription operations
  async updateProfessionalSubscription(
    professionalId: string,
    data: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
      planType?: string;
      trialEndsAt?: Date | null;
      subscriptionEndsAt?: Date | null;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<Professional> {
    // LAMDAA account protection: prevent any downgrades or plan changes
    const professional = await this.getProfessional(professionalId);
    if (professional?.userId) {
      const user = await this.getUser(professional.userId);
      if (user?.isLamdaaAccount) {
        // LAMDAA accounts have permanent Pro access - block any downgrade attempts
        // Only allow updates that maintain Pro status
        const isDowngrade = 
          (data.planType && data.planType !== 'pro') || // Any planType change away from 'pro'
          (data.subscriptionStatus && !['active', 'legacy'].includes(data.subscriptionStatus)); // Status change to non-active/legacy
        
        if (isDowngrade) {
          console.warn(
            `[LAMDAA PROTECTION] Blocked subscription change for LAMDAA account ${professional.email}. ` +
            `Attempted: planType=${data.planType}, status=${data.subscriptionStatus}. ` +
            `LAMDAA accounts have permanent Pro access.`
          );
          throw new Error('Cannot modify subscription for LAMDAA accounts - they have permanent Pro access');
        }
        console.log(`[LAMDAA PROTECTION] Allowing subscription update for LAMDAA account ${professional.email} (maintains Pro status)`);
      }
    }
    
    const [updated] = await db
      .update(professionals)
      .set(data)
      .where(eq(professionals.id, professionalId))
      .returning();
    return updated;
  }

  async getActiveProfessionals(): Promise<Professional[]> {
    return await db
      .select()
      .from(professionals)
      .where(
        and(
          eq(professionals.isActive, true),
          or(
            eq(professionals.subscriptionStatus, 'legacy'),
            eq(professionals.subscriptionStatus, 'trial'),
            eq(professionals.subscriptionStatus, 'active')
          )
        )
      );
  }

  async getAllLegacyProfessionals(): Promise<Professional[]> {
    return await db
      .select()
      .from(professionals)
      .where(eq(professionals.planType, 'legacy'));
  }

  async getClinicSubscriptionStatus(clinicId: string): Promise<{
    subscriptionStatus: string;
    planType: string;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    adminName: string;
  } | undefined> {
    const result = await db
      .select({
        subscriptionStatus: professionals.subscriptionStatus,
        planType: professionals.planType,
        trialEndsAt: professionals.trialEndsAt,
        subscriptionEndsAt: professionals.subscriptionEndsAt,
        firstName: professionals.firstName,
        lastName: professionals.lastName,
      })
      .from(clinicMembers)
      .innerJoin(professionals, eq(clinicMembers.professionalId, professionals.id))
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.role, 'Admin')
        )
      )
      .limit(1);

    if (!result || result.length === 0) {
      return undefined;
    }

    const admin = result[0];
    return {
      subscriptionStatus: admin.subscriptionStatus || 'legacy',
      planType: admin.planType || 'legacy',
      trialEndsAt: admin.trialEndsAt || null,
      subscriptionEndsAt: admin.subscriptionEndsAt || null,
      adminName: `${admin.firstName} ${admin.lastName}`,
    };
  }

  // Audit logging operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(log).returning();
    return auditLog;
  }

  async getAuditLogs(filters?: { professionalId?: string; action?: string; resourceType?: string; limit?: number }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    
    const conditions = [];
    if (filters?.professionalId) {
      conditions.push(eq(auditLogs.professionalId, filters.professionalId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.resourceType) {
      conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(filters?.limit || 100);
    
    return results;
  }

  // Downgrade feedback operations
  async saveDowngradeFeedback(feedback: InsertDowngradeFeedback): Promise<DowngradeFeedback> {
    const [savedFeedback] = await db.insert(downgradeFeedback).values(feedback).returning();
    return savedFeedback;
  }
}

export const storage = new DatabaseStorage();
