import { MessageSquare, TrendingUp, Shield } from "lucide-react";

const features = [
  {
    id: "sms-reminders",
    title: "Rappels SMS & Email",
    description: "Réduisez les absences de 70% grâce aux rappels automatiques personnalisés",
    icon: MessageSquare,
  },
  {
    id: "business-growth",
    title: "Développez votre activité",
    description: "Gagnez du temps sur l'administratif et concentrez-vous sur vos patients",
    icon: TrendingUp,
  },
  {
    id: "secure-data",
    title: "Données sécurisées",
    description: "Hébergement conforme aux normes de confidentialité des données de santé",
    icon: Shield,
  }
];

export default function FeaturesSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 section-gradient-blue dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.id}
                className="text-center"
                data-testid={`feature-${feature.id}`}
              >
                <div className="inline-flex items-center justify-center w-[60px] h-[60px] bg-blue-verylight dark:bg-blue-900/30 rounded-xl mb-4">
                  <IconComponent className="h-[30px] w-[30px] text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2" data-testid={`title-${feature.id}`}>
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400" data-testid={`description-${feature.id}`}>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
