import { db } from "./db";
import { users, professionals } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function linkProfessionalsToUsers() {
  console.log("Linking professionals to user accounts...");

  // Get all professionals without userId
  const allProfessionals = await db.select().from(professionals);
  
  for (const professional of allProfessionals) {
    if (professional.userId) {
      console.log(`✓ ${professional.firstName} ${professional.lastName} already has a user account`);
      continue;
    }

    // Create a user account for this professional
    const email = professional.email || `${professional.firstName.toLowerCase()}.${professional.lastName.toLowerCase()}@gobering.com`;
    const username = email;
    const password = "gobering123"; // Default password - professionals should change this
    
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const [user] = await db.insert(users).values({
        username,
        email,
        password: hashedPassword,
        firstName: professional.firstName,
        lastName: professional.lastName,
      }).returning();

      // Link professional to user
      await db.update(professionals)
        .set({ userId: user.id })
        .where(eq(professionals.id, professional.id));

      console.log(`✓ Created user account for ${professional.firstName} ${professional.lastName} (${email})`);
    } catch (error: any) {
      if (error.code === '23505') {
        // User already exists, try to link
        const [existingUser] = await db.select().from(users).where(eq(users.email, email));
        if (existingUser) {
          await db.update(professionals)
            .set({ userId: existingUser.id })
            .where(eq(professionals.id, professional.id));
          console.log(`✓ Linked ${professional.firstName} ${professional.lastName} to existing user`);
        }
      } else {
        console.error(`✗ Error for ${professional.firstName} ${professional.lastName}:`, error.message);
      }
    }
  }

  console.log("\nAll professionals have been linked to user accounts!");
  console.log("Default password for all accounts: gobering123");
  process.exit(0);
}

linkProfessionalsToUsers().catch(console.error);
