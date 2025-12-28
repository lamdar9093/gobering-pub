import { db } from "./db";
import {
  users,
  professionals,
  appointments,
  patients,
  professionalSchedules,
  professionalBreaks,
  timeSlots,
  professionalServices,
  teamInvitations,
  clinicMembers,
  secretaryAssignments,
  passwordResetTokens,
  waitlistEntries,
  professionalServiceAssignments,
  clinicServices,
} from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function deleteUser() {
  const emailToDelete = "leuz20028@yahoo.fr";

  console.log(`\nRecherche de l'utilisateur avec l'email: ${emailToDelete}`);

  // Trouver l'utilisateur par email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailToDelete));

  if (!user) {
    console.log(`❌ Aucun utilisateur trouvé avec l'email: ${emailToDelete}`);
    return;
  }

  console.log(`✅ Utilisateur trouvé: ${user.id} - ${user.email}`);

  // Trouver le profil professionnel
  const [professional] = await db
    .select()
    .from(professionals)
    .where(eq(professionals.userId, user.id));

  if (!professional) {
    console.log(`❌ Aucun profil professionnel trouvé pour cet utilisateur`);
    return;
  }

  console.log(`✅ Profil professionnel trouvé: ${professional.id}`);

  // Supprimer toutes les données liées dans le bon ordre

  // 1. Supprimer les assignations de secrétaire (où ce professionnel est le secrétaire)
  const deletedSecretaryAssignments = await db
    .delete(secretaryAssignments)
    .where(eq(secretaryAssignments.secretaryId, professional.id))
    .returning();
  console.log(
    `✅ ${deletedSecretaryAssignments.length} assignations de secrétaire supprimées (en tant que secrétaire)`,
  );

  // 2. Supprimer les assignations de secrétaire (où ce professionnel est assigné)
  const deletedAssignedAssignments = await db
    .delete(secretaryAssignments)
    .where(eq(secretaryAssignments.professionalId, professional.id))
    .returning();
  console.log(
    `✅ ${deletedAssignedAssignments.length} assignations de secrétaire supprimées (en tant que professionnel assigné)`,
  );

  // 3. Supprimer les entrées de liste d'attente
  const deletedWaitlistEntries = await db
    .delete(waitlistEntries)
    .where(eq(waitlistEntries.professionalId, professional.id))
    .returning();
  console.log(
    `✅ ${deletedWaitlistEntries.length} entrées de liste d'attente supprimées`,
  );

  // 4. Supprimer les assignations de services professionnels
  const deletedServiceAssignments = await db
    .delete(professionalServiceAssignments)
    .where(eq(professionalServiceAssignments.professionalId, professional.id))
    .returning();
  console.log(
    `✅ ${deletedServiceAssignments.length} assignations de services supprimées`,
  );

  // 5. Supprimer les services de clinique créés par ce professionnel
  if (professional.clinicId) {
    const createdServices = await db
      .select()
      .from(clinicServices)
      .where(eq(clinicServices.createdBy, professional.id));

    for (const service of createdServices) {
      await db
        .delete(professionalServiceAssignments)
        .where(eq(professionalServiceAssignments.clinicServiceId, service.id));
    }

    const deletedClinicServices = await db
      .delete(clinicServices)
      .where(eq(clinicServices.createdBy, professional.id))
      .returning();
    console.log(
      `✅ ${deletedClinicServices.length} services de clinique supprimés`,
    );
  }

  // 6. Supprimer les services professionnels
  const deletedServices = await db
    .delete(professionalServices)
    .where(eq(professionalServices.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedServices.length} services professionnels supprimés`);

  // 7. Supprimer les créneaux horaires
  const deletedSlots = await db
    .delete(timeSlots)
    .where(eq(timeSlots.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedSlots.length} créneaux horaires supprimés`);

  // 8. Supprimer les pauses
  const deletedBreaks = await db
    .delete(professionalBreaks)
    .where(eq(professionalBreaks.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedBreaks.length} pauses supprimées`);

  // 9. Supprimer les horaires
  const deletedSchedules = await db
    .delete(professionalSchedules)
    .where(eq(professionalSchedules.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedSchedules.length} horaires supprimés`);

  // 10. Supprimer les rendez-vous
  const deletedAppointments = await db
    .delete(appointments)
    .where(eq(appointments.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedAppointments.length} rendez-vous supprimés`);

  // 11. Supprimer les patients
  const deletedPatients = await db
    .delete(patients)
    .where(eq(patients.professionalId, professional.id))
    .returning();
  console.log(`✅ ${deletedPatients.length} patients supprimés`);

  // 12. Supprimer les invitations d'équipe (en tant qu'inviteur)
  const deletedInvitations = await db
    .delete(teamInvitations)
    .where(eq(teamInvitations.invitedBy, professional.id))
    .returning();
  console.log(
    `✅ ${deletedInvitations.length} invitations d'équipe supprimées (en tant qu'inviteur)`,
  );

  // 13. Supprimer les invitations d'équipe (en tant qu'invité)
  const deletedInvitationsAsInvitee = await db
    .delete(teamInvitations)
    .where(eq(teamInvitations.professionalId, professional.id))
    .returning();
  console.log(
    `✅ ${deletedInvitationsAsInvitee.length} invitations d'équipe supprimées (en tant qu'invité)`,
  );

  // 14. Supprimer les membres de clinique
  const deletedMemberships = await db
    .delete(clinicMembers)
    .where(eq(clinicMembers.professionalId, professional.id))
    .returning();
  console.log(
    `✅ ${deletedMemberships.length} appartenances à une clinique supprimées`,
  );

  // 15. Supprimer les tokens de réinitialisation de mot de passe
  const deletedTokens = await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))
    .returning();
  console.log(
    `✅ ${deletedTokens.length} tokens de réinitialisation supprimés`,
  );

  // 16. Supprimer le profil professionnel
  await db.delete(professionals).where(eq(professionals.id, professional.id));
  console.log(`✅ Profil professionnel supprimé`);

  // 17. Supprimer l'utilisateur
  await db.delete(users).where(eq(users.id, user.id));
  console.log(`✅ Utilisateur supprimé`);

  console.log(`\n✅ Suppression terminée avec succès pour ${emailToDelete}`);
}

deleteUser()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
