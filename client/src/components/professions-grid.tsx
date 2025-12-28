import { 
  Calendar, 
  Users, 
  Bell, 
  Globe, 
  BarChart3, 
  Clock,
  Building2,
  Smartphone
} from "lucide-react";

const features = [
  {
    id: "calendrier",
    name: "Calendrier intelligent",
    description: "Gérez tous vos rendez-vous en un seul endroit",
    icon: Calendar,
  },
  {
    id: "clients",
    name: "Gestion des clients",
    description: "Base de données centralisée avec historique complet",
    icon: Users,
  },
  {
    id: "rappels",
    name: "Rappels automatiques",
    description: "Réduisez les absences avec email et SMS",
    icon: Bell,
  },
  {
    id: "widgets",
    name: "Widgets pour votre site",
    description: "Intégrez la réservation sur votre site web",
    icon: Globe,
  },
  {
    id: "statistiques",
    name: "Statistiques détaillées",
    description: "Suivez votre activité et vos revenus",
    icon: BarChart3,
  },
  {
    id: "disponibilites",
    name: "Disponibilités flexibles",
    description: "Définissez vos horaires et pauses facilement",
    icon: Clock,
  },
  {
    id: "clinique",
    name: "Mode multi-clinique",
    description: "Collaborez avec secrétaires et collègues",
    icon: Building2,
  },
  {
    id: "mobile",
    name: "Accès mobile",
    description: "Gérez votre agenda depuis n'importe où",
    icon: Smartphone,
  }
];

export default function ProfessionsGrid() {
  return (
    <section className="relative z-10 -mt-10 sm:-mt-12 md:-mt-16 pt-16 pb-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3" data-testid="features-title">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto" data-testid="features-description">
            Une solution complète pour simplifier votre quotidien professionnel
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.id}
                className="group flex flex-col items-center p-6 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary hover:shadow-xl dark:hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-2 bg-white dark:bg-gray-900"
                data-testid={`card-feature-${feature.id}`}
              >
                <div className="w-14 h-14 bg-blue-verylight dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-3 transition-colors group-hover:bg-primary/10">
                  <IconComponent className="h-7 w-7 text-primary" />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white text-center mb-1" data-testid={`title-${feature.id}`}>
                  {feature.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center hidden sm:block">
                  {feature.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
