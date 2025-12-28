import { UserPlus, Settings, Share2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "1",
    icon: UserPlus,
    title: "Créez votre compte",
    description:
      "Inscription gratuite en 2 minutes. Aucune carte de crédit requise.",
  },
  {
    number: "2",
    icon: Settings,
    title: "Configurez vos services",
    description:
      "Ajoutez vos services, définissez vos disponibilités et personnalisez vos rappels.",
  },
  {
    number: "3",
    icon: Share2,
    title: "Partagez votre lien",
    description:
      "Envoyez votre lien de réservation à vos clients ou intégrez-le sur votre site web.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2
            className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3"
            data-testid="how-it-works-title"
          >
            Comment ça marche ?
          </h2>
          <p
            className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
            data-testid="how-it-works-description"
          >
            Démarrez en 3 étapes simples et commencez à recevoir des
            réservations dès aujourd'hui
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 max-w-5xl mx-auto mb-12">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <div
                key={step.number}
                className="relative flex flex-col items-center text-center"
                data-testid={`step-${step.number}`}
              >
                {/* Connector line for desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/30 to-primary/10" />
                )}

                {/* Step number badge */}
                <div className="relative mb-4">
                  <div className="w-20 h-20 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center">
                    <IconComponent className="h-9 w-9 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {step.number}
                  </div>
                </div>

                <h3
                  className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                  data-testid={`step-title-${step.number}`}
                >
                  {step.title}
                </h3>
                <p
                  className="text-sm text-gray-600 dark:text-gray-400 max-w-xs"
                  data-testid={`step-description-${step.number}`}
                >
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/inscription-professionnel"
            data-testid="link-register-bottom"
          >
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 py-4 text-base font-semibold min-h-[48px] shadow-lg hover:shadow-xl transition-all group"
              data-testid="button-start-now"
            >
              Commencer maintenant
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
