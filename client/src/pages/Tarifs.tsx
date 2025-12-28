import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, CalendarCheck } from "lucide-react";
import { Link } from "wouter";
import Footer from "@/components/footer";

export default function Tarifs() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const monthlyPrice = 30;
  const annualPrice = Math.round(monthlyPrice * 12 * 0.85); // 15% discount
  const additionalProfessionalPrice = 15;

  const displayPrice = billingCycle === "monthly" ? monthlyPrice : annualPrice;
  const priceLabel = billingCycle === "monthly" ? "/mois" : "/an";

  const features = [
    "Gestion des rendez-vous",
    "Accès à un tableau de bord simplifié",
    "Rappels automatisés par courriel",
    "Statistiques avancées et rapports personnalisés",
    "1 Soutien administratif",
    "Support",
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <CalendarCheck className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold text-primary">Gobering</h1>
              </div>
            </Link>
            <Link href="/login-professionnel">
              <Button>Se connecter</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-pricing-title">
            Des tarifs simples et transparents
          </h1>
          <p className="text-xl text-muted-foreground">
            Choisissez le plan qui correspond à vos besoins, sans frais cachés ni engagement.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="bg-muted p-1 rounded-lg inline-flex gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md transition-all ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-monthly"
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-6 py-2 rounded-md transition-all ${
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-annual"
            >
              Annuel
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                -15%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="border-2 border-blue-200 hover:border-blue-300 transition-all">
            <CardHeader>
              <CardTitle className="text-xl text-muted-foreground font-normal">Professionnel Solo</CardTitle>
              <CardDescription className="text-sm">La solution idéale pour les petites entreprises</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-primary" data-testid="text-solo-price">
                    ${billingCycle === "monthly" ? "10" : "102"}
                  </span>
                  <span className="text-muted-foreground">
                    {billingCycle === "monthly" ? "/mois" : "/an"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">par professionnel inscrit</p>
                {billingCycle === "annual" && (
                  <p className="text-sm text-green-600 mt-2">vous économisez $18</p>
                )}
              </div>

              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/inscription-professionnel">
                <Button className="w-full" size="lg" data-testid="button-solo-signup">
                  Commencer maintenant
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 hover:border-blue-300 transition-all relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                Populaire
              </span>
            </div>
            <CardHeader>
              <CardTitle className="text-xl text-muted-foreground font-normal">Clinique</CardTitle>
              <CardDescription className="text-sm">Pour les cliniques avec plusieurs professionnels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-primary" data-testid="text-clinic-price">
                    ${displayPrice}
                  </span>
                  <span className="text-muted-foreground">{priceLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">premier professionnel</p>
                <p className="text-sm text-muted-foreground mt-2">
                  + ${billingCycle === "monthly" ? additionalProfessionalPrice : additionalProfessionalPrice * 12} {priceLabel} par professionnel supplémentaire
                </p>
                {billingCycle === "annual" && (
                  <p className="text-sm text-green-600 mt-2">vous économisez 15%</p>
                )}
              </div>

              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Gestion multi-professionnels
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Vue d'ensemble de la clinique
                  </span>
                </li>
              </ul>

              <Link href="/inscription-professionnel">
                <Button className="w-full" size="lg" data-testid="button-clinic-signup">
                  Commencer maintenant
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Des questions sur nos tarifs ?{" "}
            <a href="#contact" className="text-primary hover:underline">
              Contactez-nous
            </a>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
