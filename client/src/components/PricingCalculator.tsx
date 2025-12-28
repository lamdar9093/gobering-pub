import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Check } from "lucide-react";

interface PricingCalculatorProps {
  onSelectPlan?: (plan: 'free' | 'pro', seats: number) => void;
}

export function PricingCalculator({ onSelectPlan }: PricingCalculatorProps) {
  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const [hasInteractedWithSlider, setHasInteractedWithSlider] = useState(false);

  const calculatePrice = (planType: 'free' | 'pro', seats: number) => {
    const basePrice = planType === 'free' ? 0 : 39;
    if (seats <= 1 || planType === 'free') return basePrice;
    return basePrice + (seats - 1) * 15;
  };

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0];
    setNumberOfSeats(newValue);
    // Si on revient à 1, on réinitialise l'état pour réafficher le texte
    setHasInteractedWithSlider(newValue !== 1);
  };

  const freePrice = calculatePrice('free', 1); // Free plan is always 1 seat
  const proPrice = calculatePrice('pro', numberOfSeats);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Seat Selector */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-8 border border-blue-200 dark:border-blue-800">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-center mb-2">
            Combien de professionnels dans votre clinique ?
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Ajustez le curseur pour voir le tarif adapté à votre équipe
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {numberOfSeats}
              </span>
              <span className="text-muted-foreground">
                {numberOfSeats === 1 ? 'professionnel' : 'professionnels'}
              </span>
            </div>
            
            <Slider
              value={[numberOfSeats]}
              onValueChange={handleSliderChange}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 professionnel</span>
              <span>20 professionnels</span>
            </div>
          </div>

          {numberOfSeats > 1 && (
            <div className="mt-6 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <span className="font-semibold">Tarification par siège :</span> Plan de base + 15$ par professionnel supplémentaire
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Exemple : {numberOfSeats} professionnels = Prix de base + {(numberOfSeats - 1)} × 15$
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl flex flex-col">
          <div className="p-8 flex flex-col flex-grow">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Gratuit</h3>
              <p className="text-sm text-muted-foreground">
                Parfait pour débuter
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">{freePrice}$</span>
                <span className="text-muted-foreground">/mois</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                1 seul professionnel
              </p>
            </div>

            <ul className="space-y-3 mb-6 flex-grow">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">100 rendez-vous / mois</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">1 professionnel + 1 assistant(e)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">1 widget de réservation</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">Notifications par email</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">Profil visible sur Gobering</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">Profil professionnel individuel</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">Support standard</span>
              </li>
            </ul>

            {onSelectPlan && (
              <button
                onClick={() => onSelectPlan('free', 1)}
                className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                data-testid="button-select-free"
              >
                Commencer gratuitement
              </button>
            )}
          </div>
        </Card>

        {/* Pro Plan */}
        <Card className="relative overflow-hidden border-2 border-primary hover:border-primary transition-all duration-300 hover:shadow-xl bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg">
            Recommandé
          </div>
          
          <div className="p-8 flex flex-col flex-grow">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-sm text-muted-foreground">
                Idéal pour les cliniques et équipes
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">{proPrice}$</span>
                <span className="text-muted-foreground">/mois</span>
              </div>
              {!hasInteractedWithSlider && (
                <p className="text-sm text-muted-foreground mt-2">
                  +15$ par professionnel ajouté
                </p>
              )}
              {numberOfSeats > 1 && (
                <p className="text-sm text-muted-foreground mt-1">
                  39$ + {(numberOfSeats - 1)} × 15$ par siège
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-6 flex-grow">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Tout du plan Gratuit, plus :</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Rendez-vous illimités</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Professionnels et assistant(e)s illimités</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Gestion d'équipe avancée</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Widgets de réservation illimités</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Notifications par email et SMS</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Liste d'attente automatique</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Statistiques détaillées</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Support prioritaire</span>
              </li>
            </ul>

            {onSelectPlan && (
              <button
                onClick={() => onSelectPlan('pro', numberOfSeats)}
                className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
                data-testid="button-select-pro"
              >
                Choisir Pro
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Trial Info */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800 text-center">
        <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
          🎉 21 jours d'essai gratuit avec accès PRO complet
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Découvrez toutes les fonctionnalités PRO pendant 21 jours, sans engagement. Choisissez votre plan ensuite.
        </p>
      </div>
    </div>
  );
}
