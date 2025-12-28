import { db } from "./db";
import { professionals, professionalSchedules, timeSlots } from "@shared/schema";

const professionalSeedData = [
  // Ostéopathes
  {
    firstName: "Marie",
    lastName: "Dubois",
    profession: "Ostéopathe",
    speciality: "Ostéopathie cranienne et viscérale",
    address: "1250 Rue Sainte-Catherine O",
    city: "Montréal",
    postalCode: "H3G 1P1",
    phone: "+1 514-842-7395",
    email: "marie.dubois@osteo-mtl.ca",
    description: "Ostéopathe D.O. diplômée depuis 15 ans, spécialisée dans les troubles musculo-squelettiques et les maux de tête. Approche douce adaptée à tous les âges."
  },
  {
    firstName: "Pierre",
    lastName: "Martin",
    profession: "Ostéopathe",
    speciality: "Ostéopathie structurelle",
    address: "88 Avenue Yorkville",
    city: "Toronto",
    postalCode: "M5R 1B9",
    phone: "+1 416-789-5612",
    email: "pierre.martin@osteo-to.ca",
    description: "Expert en biomécanique, spécialisé dans le traitement des sportifs et des troubles du mouvement. Consultation sur rendez-vous uniquement."
  },

  // Chiropraticiens
  {
    firstName: "Sophie",
    lastName: "Bernard",
    profession: "Chiropraticien",
    speciality: "Chiropraxie neurologique",
    address: "1055 Rue du Square-Victoria",
    city: "Montréal",
    postalCode: "H2Z 2B1",
    phone: "+1 514-354-7891",
    email: "sophie.bernard@chiro-mtl.ca",
    description: "Docteur en chiropraxie, membre de l'Association Chiropratique Canadienne. Spécialisée dans les troubles neuro-musculaires et les céphalées."
  },
  {
    firstName: "Thomas",
    lastName: "Leroy",
    profession: "Chiropraticien",
    speciality: "Chiropraxie pédiatrique",
    address: "1200 Burrard Street",
    city: "Vancouver",
    postalCode: "V6Z 2C7",
    phone: "+1 604-912-5384",
    email: "thomas.leroy@chiro-van.ca",
    description: "Spécialiste de la chiropraxie pédiatrique et familiale. Formation internationale, techniques douces adaptées aux enfants et nourrissons."
  },

  // Masso-kinésithérapeutes
  {
    firstName: "Anne",
    lastName: "Moreau",
    profession: "Masso-kinésithérapeute",
    speciality: "Rééducation orthopédique",
    address: "350 Sparks Street",
    city: "Ottawa",
    postalCode: "K1R 7S8",
    phone: "+1 613-614-8873",
    email: "anne.moreau@kine-ottawa.ca",
    description: "Kinésithérapeute spécialisée en rééducation post-opératoire et traumatologie. Cabinet équipé d'un plateau technique moderne."
  },
  {
    firstName: "Laurent",
    lastName: "Petit",
    profession: "Masso-kinésithérapeute",
    speciality: "Kinésithérapie respiratoire",
    address: "225 King Street W",
    city: "Toronto",
    postalCode: "M5V 3M2",
    phone: "+1 416-488-9245",
    email: "laurent.petit@kine-to.ca",
    description: "Expert en kinésithérapie respiratoire et rééducation périnéale. Formation continue en techniques manuelles et thérapie manuelle."
  },

  // Psychologues
  {
    firstName: "Isabelle",
    lastName: "Roux",
    profession: "Psychologue",
    speciality: "Psychologie clinique",
    address: "3700 Rue Saint-Denis",
    city: "Montréal",
    postalCode: "H2W 2M2",
    phone: "+1 514-427-6389",
    email: "isabelle.roux@psy-mtl.ca",
    description: "Psychologue clinicienne, approche intégrative. Spécialisée dans les troubles anxieux, la dépression et l'accompagnement des adultes."
  },
  {
    firstName: "Jean-Michel",
    lastName: "Garnier",
    profession: "Psychologue",
    speciality: "Psychologie de l'enfant",
    address: "1420 8th Avenue SW",
    city: "Calgary",
    postalCode: "T2R 1J6",
    phone: "+1 403-569-4476",
    email: "jm.garnier@psy-calgary.ca",
    description: "Psychologue pour enfants et adolescents. Spécialisé dans les troubles du comportement, difficultés scolaires et thérapie familiale."
  },

  // Kinésithérapeutes
  {
    firstName: "Céline",
    lastName: "Durand",
    profession: "Kinésithérapeute",
    speciality: "Rééducation fonctionnelle",
    address: "5455 Avenue de Gaspé",
    city: "Montréal",
    postalCode: "H2T 3B3",
    phone: "+1 514-320-8214",
    email: "celine.durand@kine-mtl.ca",
    description: "Kinésithérapeute spécialisée en rééducation neurologique et gériatrique. Prise en charge à domicile possible sur Montréal métropole."
  },
  {
    firstName: "Marc",
    lastName: "Blanc",
    profession: "Kinésithérapeute",
    speciality: "Kinésithérapie du sport",
    address: "777 Dunsmuir Street",
    city: "Vancouver",
    postalCode: "V7Y 1K4",
    phone: "+1 604-429-6724",
    email: "marc.blanc@kine-sport-van.ca",
    description: "Kinésithérapeute du sport, diplômé en biomécanique. Suivi des sportifs de haut niveau et rééducation post-traumatique."
  },

  // Orthophonistes
  {
    firstName: "Valérie",
    lastName: "Simon",
    profession: "Orthophoniste",
    speciality: "Troubles du langage",
    address: "2020 Rue University",
    city: "Montréal",
    postalCode: "H3A 2A5",
    phone: "+1 514-335-7192",
    email: "valerie.simon@ortho-mtl.ca",
    description: "Orthophoniste certifiée en troubles du langage oral et écrit. Spécialisée dans l'accompagnement des enfants dyslexiques et dysphasiques."
  },
  {
    firstName: "Stéphanie",
    lastName: "Lopez",
    profession: "Orthophoniste",
    speciality: "Rééducation vocale",
    address: "1255 Bay Street",
    city: "Toronto",
    postalCode: "M5R 2A9",
    phone: "+1 416-938-4963",
    email: "stephanie.lopez@ortho-to.ca",
    description: "Spécialiste de la rééducation vocale et de la déglutition. Expérience avec les professionnels de la voix (chanteurs, enseignants)."
  },

  // Nutritionnistes/Diététiciens
  {
    firstName: "Caroline",
    lastName: "Faure",
    profession: "Nutritionniste/Diététicien(ne)",
    speciality: "Nutrition clinique",
    address: "1155 René-Lévesque Blvd W",
    city: "Montréal",
    postalCode: "H3B 3V2",
    phone: "+1 514-261-8537",
    email: "caroline.faure@nutrition-mtl.ca",
    description: "Diététicienne-nutritionniste diplômée. Spécialisée dans la nutrition thérapeutique, diabète, et troubles du comportement alimentaire."
  },
  {
    firstName: "Julien",
    lastName: "Rousseau",
    profession: "Nutritionniste/Diététicien(ne)",
    speciality: "Nutrition sportive",
    address: "102 Avenue Road",
    city: "Toronto",
    postalCode: "M5R 2H2",
    phone: "+1 416-762-9458",
    email: "julien.rousseau@nutrition-sport-to.ca",
    description: "Nutritionniste du sport, consultant pour équipes professionnelles. Expertise en optimisation des performances et récupération."
  },

  // Podologues
  {
    firstName: "Nathalie",
    lastName: "Michel",
    profession: "Podologue",
    speciality: "Podologie du sport",
    address: "1501 McGill College Avenue",
    city: "Montréal",
    postalCode: "H3A 3M8",
    phone: "+1 514-236-7481",
    email: "nathalie.michel@podo-mtl.ca",
    description: "Podiatre spécialisée dans les pathologies du pied chez le sportif. Réalisation d'orthèses plantaires sur mesure."
  },
  {
    firstName: "Patrick",
    lastName: "Vidal",
    profession: "Podologue",
    speciality: "Podologie gériatrique",
    address: "1130 West Pender Street",
    city: "Vancouver",
    postalCode: "V6E 4A4",
    phone: "+1 604-675-3176",
    email: "patrick.vidal@podo-van.ca",
    description: "Podiatre spécialisé en soins gérontologiques et diabétologie. Soins à domicile disponibles pour personnes à mobilité réduite."
  }
];

export async function seedCanadianDatabase() {
  console.log("🍁 Début du seeding de la base de données canadienne...");
  
  try {
    // Supprimer les anciennes données
    console.log("🗑️  Nettoyage des anciennes données...");
    await db.delete(timeSlots);
    await db.delete(professionalSchedules);
    await db.delete(professionals);
    
    // Insérer les professionnels canadiens
    await db.insert(professionals).values(professionalSeedData);
    console.log(`✅ ${professionalSeedData.length} professionnels canadiens ajoutés`);
    
    // Récupérer les professionnels créés
    const createdProfessionals = await db.select().from(professionals);
    
    // Créer des horaires pour chaque professionnel
    const scheduleData = [];
    for (const professional of createdProfessionals) {
      // Horaires : Lundi (1) à Vendredi (5), 8h00-18h00
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
          dayOfWeek: 6,
          startTime: "09:00",
          endTime: "13:00",
          isAvailable: true
        });
      }
    }
    
    await db.insert(professionalSchedules).values(scheduleData);
    console.log(`✅ ${scheduleData.length} créneaux horaires ajoutés`);
    
    // Créer des créneaux disponibles pour la semaine prochaine
    const timeSlotData = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    
    for (const professional of createdProfessionals) {
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + dayOffset);
        const dayOfWeek = currentDate.getDay();
        
        const hasSchedule = scheduleData.some(s => 
          s.professionalId === professional.id && s.dayOfWeek === dayOfWeek
        );
        
        if (hasSchedule) {
          const startHour = dayOfWeek === 6 ? 9 : 8;
          const endHour = dayOfWeek === 6 ? 13 : 18;
          
          for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
              if (Math.random() > 0.3) {
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
    
    console.log("🍁 Seeding canadien terminé avec succès !");
    
  } catch (error) {
    console.error("❌ Erreur lors du seeding:", error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCanadianDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
