import { db } from "../db";
import { users, professionals } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { LAMDAA_EMAILS } from "./lamdaa-accounts";

export async function syncLamdaaAccounts(): Promise<void> {
  if (LAMDAA_EMAILS.length === 0) {
    console.log("[LAMDAA] No LAMDAA emails configured");
    return;
  }

  console.log(`[LAMDAA] Syncing ${LAMDAA_EMAILS.length} LAMDAA accounts...`);

  const normalizedEmails = LAMDAA_EMAILS.map(e => e.toLowerCase().trim());

  const lamdaaUsers = await db
    .select({ id: users.id, email: users.email, isLamdaaAccount: users.isLamdaaAccount })
    .from(users)
    .where(inArray(users.email, normalizedEmails));

  let usersUpdated = 0;
  let professionalsUpdated = 0;

  for (const user of lamdaaUsers) {
    if (!user.isLamdaaAccount) {
      await db.update(users)
        .set({ isLamdaaAccount: true })
        .where(eq(users.id, user.id));
      usersUpdated++;
    }

    const [professional] = await db
      .select()
      .from(professionals)
      .where(eq(professionals.userId, user.id));

    if (professional && (professional.subscriptionStatus !== 'active' || professional.trialEndsAt !== null)) {
      await db.update(professionals)
        .set({
          planType: 'pro',
          subscriptionStatus: 'active',
          intendedPlan: 'pro',
          trialEndsAt: null,
        })
        .where(eq(professionals.id, professional.id));
      professionalsUpdated++;
    }
  }

  const nonLamdaaUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.isLamdaaAccount, true));

  let removedFromLamdaa = 0;
  let professionalsDowngraded = 0;
  for (const user of nonLamdaaUsers) {
    if (!normalizedEmails.includes(user.email.toLowerCase().trim())) {
      await db.update(users)
        .set({ isLamdaaAccount: false })
        .where(eq(users.id, user.id));
      removedFromLamdaa++;

      // Also downgrade the professional's subscription
      const [professional] = await db
        .select()
        .from(professionals)
        .where(eq(professionals.userId, user.id));

      if (professional) {
        await db.update(professionals)
          .set({
            subscriptionStatus: 'expired',
            intendedPlan: 'free',
          })
          .where(eq(professionals.id, professional.id));
        professionalsDowngraded++;
        console.log(`[LAMDAA] Downgraded ${user.email} from LAMDAA - now expired`);
      }
    }
  }

  console.log(`[LAMDAA] Sync complete: ${usersUpdated} users marked as LAMDAA, ${professionalsUpdated} professionals upgraded, ${removedFromLamdaa} removed from LAMDAA, ${professionalsDowngraded} professionals downgraded`);
}
