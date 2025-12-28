
import { db } from "./db";
import { users, professionals, appointments, patients, timeSlots, professionalBreaks, professionalSchedules, passwordResetTokens, teamInvitations, clinicMembers, professionalServices, secretaryAssignments } from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function deleteUsersByEmail() {
  const emailsToDelete = ["leuz20028@yahoo.fr", "leuz@yahoo.fr"];
  
  console.log("Starting deletion process...");
  
  for (const email of emailsToDelete) {
    console.log(`\nSearching for user with email: ${email}`);
    
    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      console.log(`No user found with email: ${email}`);
      continue;
    }
    
    console.log(`Found user: ${user.id} - ${user.email}`);
    
    // Find professional profile
    const [professional] = await db.select().from(professionals).where(eq(professionals.userId, user.id));
    
    if (professional) {
      console.log(`Found professional profile: ${professional.id}`);
      
      // Delete all related data
      
      // 1. Delete secretary assignments where this professional is the secretary
      const deletedSecretaryAssignments = await db.delete(secretaryAssignments)
        .where(eq(secretaryAssignments.secretaryId, professional.id))
        .returning();
      console.log(`Deleted ${deletedSecretaryAssignments.length} secretary assignments (as secretary)`);
      
      // 2. Delete secretary assignments where this professional is assigned
      const deletedAssignedAssignments = await db.delete(secretaryAssignments)
        .where(eq(secretaryAssignments.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedAssignedAssignments.length} secretary assignments (as assigned professional)`);
      
      // 3. Delete professional services
      const deletedServices = await db.delete(professionalServices)
        .where(eq(professionalServices.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedServices.length} professional services`);
      
      // 4. Delete time slots
      const deletedSlots = await db.delete(timeSlots)
        .where(eq(timeSlots.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedSlots.length} time slots`);
      
      // 5. Delete professional breaks
      const deletedBreaks = await db.delete(professionalBreaks)
        .where(eq(professionalBreaks.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedBreaks.length} professional breaks`);
      
      // 6. Delete professional schedules
      const deletedSchedules = await db.delete(professionalSchedules)
        .where(eq(professionalSchedules.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedSchedules.length} professional schedules`);
      
      // 7. Delete appointments
      const deletedAppointments = await db.delete(appointments)
        .where(eq(appointments.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedAppointments.length} appointments`);
      
      // 8. Delete patients
      const deletedPatients = await db.delete(patients)
        .where(eq(patients.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedPatients.length} patients`);
      
      // 9. Delete team invitations (as inviter)
      const deletedInvitations = await db.delete(teamInvitations)
        .where(eq(teamInvitations.invitedBy, professional.id))
        .returning();
      console.log(`Deleted ${deletedInvitations.length} team invitations (as inviter)`);
      
      // 10. Delete team invitations (as invitee)
      const deletedInvitationsAsInvitee = await db.delete(teamInvitations)
        .where(eq(teamInvitations.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedInvitationsAsInvitee.length} team invitations (as invitee)`);
      
      // 11. Delete clinic memberships
      const deletedMemberships = await db.delete(clinicMembers)
        .where(eq(clinicMembers.professionalId, professional.id))
        .returning();
      console.log(`Deleted ${deletedMemberships.length} clinic memberships`);
      
      // 12. Delete professional profile
      await db.delete(professionals).where(eq(professionals.id, professional.id));
      console.log(`Deleted professional profile`);
    }
    
    // 13. Delete password reset tokens
    const deletedTokens = await db.delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id))
      .returning();
    console.log(`Deleted ${deletedTokens.length} password reset tokens`);
    
    // 14. Finally, delete the user
    await db.delete(users).where(eq(users.id, user.id));
    console.log(`Deleted user: ${user.email}`);
    
    console.log(`\n✅ Successfully deleted all data for ${email}`);
  }
  
  console.log("\n✨ Deletion process completed!");
  process.exit(0);
}

// Run the deletion
deleteUsersByEmail().catch((error) => {
  console.error("Error during deletion:", error);
  process.exit(1);
});
