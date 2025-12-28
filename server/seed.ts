import { db } from "./db";
import { professionals, professionalSchedules, timeSlots } from "@shared/schema";

const professionalSeedData = [
  // Ostéopathes
  {
    firstName: "Marie",
    lastName: "Dubois",
    profession: "Ostéopathe",
    speciality: "Ostéopathie cranienne et viscérale",
    address: "15 Avenue des Champs-Élysées",
    city: "Paris",
    postalCode: "75001",
    phone: "01 42 86 73 95",
    email: "marie.dubois@osteo-paris.fr",
    description: "Ostéopathe D.O. diplômée depuis 15 ans, spécialisée dans les troubles musculo-squelettiques et les maux de tête. Approche douce adaptée à tous les âges."
  },
  {
    firstName: "Pierre",
    lastName: "Martin",
    profession: "Ostéopathe",
    speciality: "Ostéopathie structurelle",
    address: "23 Rue de la République",
    city: "Lyon",
    postalCode: "69002",
    phone: "04 78 93 56 12",
    email: "pierre.martin@osteo-lyon.fr",
    description: "Expert en biomécanique, spécialisé dans le traitement des sportifs et des troubles du mouvement. Consultation sur rendez-vous uniquement."
  },

  // Chiropraticiens
  {
    firstName: "Sophie",
    lastName: "Bernard",
    profession: "Chiropraticien",
    speciality: "Chiropraxie neurologique",
    address: "8 Boulevard Saint-Germain",
    city: "Paris",
    postalCode: "75005",
    phone: "01 43 54 78 91",
    email: "sophie.bernard@chiro-paris.com",
    description: "Docteur en chiropraxie, membre de l'Association Française de Chiropraxie. Spécialisée dans les troubles neuro-musculaires et les céphalées."
  },
  {
    firstName: "Thomas",
    lastName: "Leroy",
    profession: "Chiropraticien",
    speciality: "Chiropraxie pédiatrique",
    address: "45 Avenue Victor Hugo",
    city: "Marseille",
    postalCode: "13001",
    phone: "04 91 25 37 84",
    email: "thomas.leroy@chiro-marseille.fr",
    description: "Spécialiste de la chiropraxie pédiatrique et familiale. Formation internationale, techniques douces adaptées aux enfants et nourrissons."
  },

  // Masso-kinésithérapeutes
  {
    firstName: "Anne",
    lastName: "Moreau",
    profession: "Masso-kinésithérapeute",
    speciality: "Rééducation orthopédique",
    address: "12 Rue du Faubourg",
    city: "Toulouse",
    postalCode: "31000",
    phone: "05 61 42 88 73",
    email: "anne.moreau@kine-toulouse.fr",
    description: "Kinésithérapeute D.E. spécialisée en rééducation post-opératoire et traumatologie. Cabinet équipé d'un plateau technique moderne."
  },
  {
    firstName: "Laurent",
    lastName: "Petit",
    profession: "Masso-kinésithérapeute",
    speciality: "Kinésithérapie respiratoire",
    address: "67 Place de la Bastille",
    city: "Paris",
    postalCode: "75011",
    phone: "01 48 87 92 45",
    email: "laurent.petit@kine-paris.com",
    description: "Expert en kinésithérapie respiratoire et rééducation périnéale. Formation continue en techniques manuelles et thérapie manuelle."
  },

  // Psychologues
  {
    firstName: "Isabelle",
    lastName: "Roux",
    profession: "Psychologue",
    speciality: "Psychologie clinique",
    address: "34 Rue de Rivoli",
    city: "Paris",
    postalCode: "75004",
    phone: "01 42 77 63 89",
    email: "isabelle.roux@psy-paris.fr",
    description: "Psychologue clinicienne, approche intégrative. Spécialisée dans les troubles anxieux, la dépression et l'accompagnement des adultes."
  },
  {
    firstName: "Jean-Michel",
    lastName: "Garnier",
    profession: "Psychologue",
    speciality: "Psychologie de l'enfant",
    address: "19 Avenue Jean Jaurès",
    city: "Bordeaux",
    postalCode: "33000",
    phone: "05 56 91 44 76",
    email: "jm.garnier@psy-bordeaux.fr",
    description: "Psychologue pour enfants et adolescents. Spécialisé dans les troubles du comportement, difficultés scolaires et thérapie familiale."
  },

  // Kinésithérapeutes
  {
    firstName: "Céline",
    lastName: "Durand",
    profession: "Kinésithérapeute",
    speciality: "Rééducation fonctionnelle",
    address: "28 Rue Nationale",
    city: "Lille",
    postalCode: "59000",
    phone: "03 20 57 82 14",
    email: "celine.durand@kine-lille.fr",
    description: "Kinésithérapeute spécialisée en rééducation neurologique et gériatrique. Prise en charge à domicile possible sur Lille métropole."
  },
  {
    firstName: "Marc",
    lastName: "Blanc",
    profession: "Kinésithérapeute",
    speciality: "Kinésithérapie du sport",
    address: "55 Boulevard des Batignolles",
    city: "Paris",
    postalCode: "75017",
    phone: "01 42 93 67 24",
    email: "marc.blanc@kine-sport-paris.com",
    description: "Kinésithérapeute du sport, diplômé en biomécanique. Suivi des sportifs de haut niveau et rééducation post-traumatique."
  },

  // Orthophonistes
  {
    firstName: "Valérie",
    lastName: "Simon",
    profession: "Orthophoniste",
    speciality: "Troubles du langage",
    address: "41 Rue des Écoles",
    city: "Strasbourg",
    postalCode: "67000",
    phone: "03 88 35 71 92",
    email: "valerie.simon@ortho-strasbourg.fr",
    description: "Orthophoniste certificée en troubles du langage oral et écrit. Spécialisée dans l'accompagnement des enfants dyslexiques et dysphasiques."
  },
  {
    firstName: "Stéphanie",
    lastName: "Lopez",
    profession: "Orthophoniste",
    speciality: "Rééducation vocale",
    address: "17 Place Wilson",
    city: "Nice",
    postalCode: "06000",
    phone: "04 93 85 49 63",
    email: "stephanie.lopez@ortho-nice.fr",
    description: "Spécialiste de la rééducation vocale et de la déglutition. Expérience avec les professionnels de la voix (chanteurs, enseignants)."
  },

  // Nutritionnistes/Diététiciens
  {
    firstName: "Caroline",
    lastName: "Faure",
    profession: "Nutritionniste/Diététicien(ne)",
    speciality: "Nutrition clinique",
    address: "26 Rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    phone: "01 42 61 85 37",
    email: "caroline.faure@nutrition-paris.fr",
    description: "Diététicienne-nutritionniste diplômée d'État. Spécialisée dans la nutrition thérapeutique, diabète, et troubles du comportement alimentaire."
  },
  {
    firstName: "Julien",
    lastName: "Rousseau",
    profession: "Nutritionniste/Diététicien(ne)",
    speciality: "Nutrition sportive",
    address: "73 Cours Lafayette",
    city: "Lyon",
    postalCode: "69003",
    phone: "04 78 62 94 58",
    email: "julien.rousseau@nutrition-sport-lyon.fr",
    description: "Nutritionniste du sport, consultant pour équipes professionnelles. Expertise en optimisation des performances et récupération."
  },

  // Podologues
  {
    firstName: "Nathalie",
    lastName: "Michel",
    profession: "Podologue",
    speciality: "Podologie du sport",
    address: "14 Rue Saint-Honoré",
    city: "Paris",
    postalCode: "75001",
    phone: "01 42 36 74 81",
    email: "nathalie.michel@podo-paris.fr",
    description: "Pédicure-podologue D.E., spécialisée dans les pathologies du pied chez le sportif. Réalisation d'orthèses plantaires sur mesure."
  },
  {
    firstName: "Patrick",
    lastName: "Vidal",
    profession: "Podologue",
    speciality: "Podologie gériatrique",
    address: "38 Avenue de la Liberté",
    city: "Montpellier",
    postalCode: "34000",
    phone: "04 67 58 31 76",
    email: "patrick.vidal@podo-montpellier.fr",
    description: "Podologue spécialisé en soins gérontologiques et diabétologie. Soins à domicile disponibles pour personnes à mobilité réduite."
  }
];

export async function seedDatabase() {
  console.log("🌱 Début du seeding de la base de données...");
  
  try {
    // Récupérer les professionnels existants
    let createdProfessionals = await db.select().from(professionals);
    
    // Si aucun professionnel n'existe, les créer
    if (createdProfessionals.length === 0) {
      await db.insert(professionals).values(professionalSeedData);
      console.log(`✅ ${professionalSeedData.length} professionnels ajoutés avec succès`);
      createdProfessionals = await db.select().from(professionals);
    } else {
      console.log(`📋 ${createdProfessionals.length} professionnels déjà présents dans la base`);
    }
    
    console.log(`📋 Création des horaires pour ${createdProfessionals.length} professionnels`);
    
    // Vérifier si des horaires existent déjà
    const existingSchedules = await db.select().from(professionalSchedules);
    if (existingSchedules.length > 0) {
      console.log(`📅 ${existingSchedules.length} horaires déjà présents, création des créneaux uniquement`);
    } else {
      // Créer des horaires pour chaque professionnel (Lundi à Vendredi, 8h-18h)
      const scheduleData = [];
        for (const professional of createdProfessionals) {
          // Horaires de travail : Lundi (1) à Vendredi (5), 8h00-18h00
          for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
            scheduleData.push({
              professionalId: professional.id,
              dayOfWeek,
              startTime: "08:00",
              endTime: "18:00",
              isAvailable: true
            });
          }
          // Samedi matin pour certains professionnels
          if (Math.random() > 0.5) {
            scheduleData.push({
              professionalId: professional.id,
              dayOfWeek: 6, // Samedi
              startTime: "09:00",
              endTime: "13:00",
              isAvailable: true
            });
          }
        }
        
        await db.insert(professionalSchedules).values(scheduleData);
        console.log(`✅ ${scheduleData.length} créneaux horaires ajoutés`);
      }
    
    // Créer des créneaux disponibles pour la semaine prochaine
    const existingTimeSlots = await db.select().from(timeSlots);
    if (existingTimeSlots.length > 0) {
      console.log(`⏰ ${existingTimeSlots.length} créneaux déjà présents, pas de création supplémentaire`);
    } else {
      const timeSlotData = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1); // Commencer demain
      
      // Récupérer tous les horaires pour générer les créneaux
      const allSchedules = await db.select().from(professionalSchedules);
      
      for (const professional of createdProfessionals) {
        // Générer des créneaux pour les 7 prochains jours
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(currentDate.getDate() + dayOffset);
          const dayOfWeek = currentDate.getDay();
          
          // Vérifier si le professionnel travaille ce jour-là
          const hasSchedule = allSchedules.some(s => 
            s.professionalId === professional.id && s.dayOfWeek === dayOfWeek
          );
          
          if (hasSchedule) {
          // Créer des créneaux de 30 minutes de 8h à 18h
          const startHour = dayOfWeek === 6 ? 9 : 8; // Samedi commence à 9h
          const endHour = dayOfWeek === 6 ? 13 : 18; // Samedi finit à 13h
          
          for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
              // Ajouter un peu d'aléatoire pour simuler des créneaux déjà pris
              if (Math.random() > 0.3) { // 70% de chance d'être disponible
                const slotTime = new Date(currentDate);
                slotTime.setHours(hour, minute, 0, 0);
                
                const endTime = new Date(slotTime);
                endTime.setMinutes(endTime.getMinutes() + 30);
                
                timeSlotData.push({
                  professionalId: professional.id,
                  slotDate: slotTime,
                  startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                  endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
                  isBooked: false
                });
              }
            }
          }
        }
      }
    }
    
      if (timeSlotData.length > 0) {
        await db.insert(timeSlots).values(timeSlotData);
        console.log(`✅ ${timeSlotData.length} créneaux de rendez-vous créés`);
      }
    }
    
    console.log("🎉 Seeding terminé avec succès !");
    
  } catch (error) {
    console.error("❌ Erreur lors du seeding:", error);
    throw error;
  }
}

// Exécuter le seeding si ce fichier est lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}