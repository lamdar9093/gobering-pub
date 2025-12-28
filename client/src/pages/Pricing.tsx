import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { PricingCalculator } from "@/components/PricingCalculator";

export default function Pricing() {
  const [, setLocation] = useLocation();

  const handleSelectPlan = (plan: "free" | "pro", seats: number) => {
    setLocation(`/inscription-professionnel?plan=${plan}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-12 lg:py-20">
        <div className="text-center mb-6 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 md:mb-4 leading-tight">
            Tarification simple et transparente
          </h1>
          <p className="text-base md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-snug">
            Un tarif adapté à la taille de votre équipe. Le plan Pro inclus 21
            jours d'essai gratuit avec accès un illimité a tout.
          </p>
        </div>

        <PricingCalculator onSelectPlan={handleSelectPlan} />

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8 text-center mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Questions fréquentes
          </h2>
          <div className="max-w-3xl mx-auto space-y-6 text-left">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Comment fonctionne la facturation par siège ?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Le plan Gratuit est toujours gratuit pour 1 professionnel. Le
                plan Pro coûte 39$ pour 1 professionnel. Chaque professionnel
                supplémentaire dans votre clinique coûte 15$ de plus par mois.
                Par exemple, une équipe de 3 professionnels avec le plan Pro
                paierait 39$ + (2 × 15$) = 69$/mois.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Que se passe-t-il quand j'ajoute ou retire un membre ?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Votre abonnement est automatiquement ajusté au prorata. Si vous
                ajoutez un membre, vous serez facturé immédiatement pour la
                portion du mois restant. Si vous en retirez un, un crédit sera
                appliqué à votre prochaine facture.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Qu'arrive-t-il après la période d'essai de 21 jours ?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Après 21 jours d'essai PRO, vous devrez choisir entre le plan
                Gratuit (0$/mois avec limites) ou le plan Pro (39$/mois avec
                tout illimité). Pendant l'essai, vous pouvez inviter autant de
                membres que vous voulez gratuitement.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Si je suis membre d'une clinique, dois-je payer ?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Non ! Seul l'administrateur de la clinique paie l'abonnement
                pour toute l'équipe. Si l'admin choisit le plan Gratuit après
                l'essai, la clinique sera limitée à 1 professionnel + 1
                secrétaire et 100 rendez-vous.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Puis-je annuler mon abonnement à tout moment ?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Oui, vous pouvez annuler votre abonnement à tout moment depuis
                vos paramètres. L'accès restera actif jusqu'à la fin de la
                période payée.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Vous avez des questions ?{" "}
            <a href="/contact" className="text-primary hover:underline">
              Contactez-nous
            </a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
