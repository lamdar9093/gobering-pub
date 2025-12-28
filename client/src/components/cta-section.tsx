import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Gift } from "lucide-react";

export default function CTASection() {
  const [, navigate] = useLocation();

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 gradient-bg">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 mb-6">
          <Gift className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-medium">21 jours d'essai gratuit</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4" data-testid="cta-title">
          Prêt à simplifier votre quotidien ?
        </h2>
        <p className="text-base md:text-lg text-white/90 mb-8 max-w-2xl mx-auto" data-testid="cta-description">
          Rejoignez les professionnels de santé qui font confiance à Gobering pour gérer leurs rendez-vous
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            onClick={() => navigate('/inscription-professionnel')}
            className="bg-white text-primary hover:bg-gray-50 rounded-full px-8 py-6 text-base font-semibold shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all group"
            data-testid="button-professional-signup"
          >
            Créer mon compte gratuit
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button 
            variant="ghost"
            size="lg" 
            onClick={() => navigate('/pricing')}
            className="text-white hover:bg-white/20 hover:text-white rounded-full px-6 py-6 text-base font-medium transition-all"
            data-testid="button-view-pricing"
          >
            Voir les tarifs
          </Button>
        </div>
      </div>
    </section>
  );
}
