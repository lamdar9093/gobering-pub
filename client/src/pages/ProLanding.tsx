import { Button } from "@/components/ui/button";
import {
  Calendar,
  CalendarCheck,
  Users,
  BarChart3,
  Bell,
  Check,
  Zap,
  Globe,
  ListChecks,
  Sparkles,
  Building2,
  Gift,
  Clock,
  Smartphone,
} from "lucide-react";
import { Link } from "wouter";

export default function ProLanding() {
  const features = [
    {
      icon: Calendar,
      title: "Gestion des rendez-vous",
      description:
        "Calendrier intelligent pour gérer tous vos rendez-vous en un seul endroit",
    },
    {
      icon: Users,
      title: "Gestion des clients",
      description:
        "Base de données centralisée pour tous vos patients avec historique complet",
    },
    {
      icon: BarChart3,
      title: "Statistiques avancées",
      description:
        "Rapports détaillés sur votre activité et vos revenus en temps réel",
    },
    {
      icon: Bell,
      title: "Rappels automatiques",
      description: "Notifications par email et SMS pour réduire les absences",
    },
    {
      icon: Globe,
      title: "Widgets personnalisables",
      description:
        "Intégrez la prise de rendez-vous directement sur votre site web",
    },
    {
      icon: ListChecks,
      title: "Liste d'attente intelligente",
      description: "Système automatique pour remplir vos créneaux annulés",
    },
    {
      icon: Building2,
      title: "Gestion multi-clinique",
      description:
        "Collaborez avec votre équipe : secrétaires, professionnels, admins",
    },
    {
      icon: Sparkles,
      title: "Réservation pour bénéficiaires",
      description:
        "Vos patients peuvent réserver pour leurs enfants ou proches",
    },
  ];

  const benefits = [
    "Réduisez les absences avec les rappels automatiques par email et SMS",
    "Gagnez du temps sur la gestion administrative",
    "Améliorez l'expérience de vos patients avec la réservation en ligne 24/7",
    "Accédez à vos données partout, à tout moment",
    "Widgets personnalisables pour votre site web",
    "Liste d'attente automatique pour optimiser votre planning",
  ];

  const trialFeatures = [
    "Accès complet PRO pendant 21 jours",
    "Configuration en 5 minutes",
    "Support prioritaire",
    "Migration de données gratuite",
    "Annulation à tout moment",
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-gray-950 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div
                className="flex items-center gap-2 cursor-pointer"
                data-testid="link-home"
              >
                <CalendarCheck className="h-7 w-7 text-primary" />
                <h1 className="text-2xl font-bold text-primary">Gobering</h1>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-[15px] font-medium"
                data-testid="link-features"
              >
                Fonctionnalités
              </a>
              <Link href="/tarifs">
                <span
                  className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-[15px] font-medium cursor-pointer"
                  data-testid="link-pricing"
                >
                  Tarifs
                </span>
              </Link>
              <Link href="/">
                <span
                  className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-[15px] font-medium cursor-pointer"
                  data-testid="link-search"
                >
                  Rechercher un professionnel
                </span>
              </Link>
              <Link href="/connexion-professionnel">
                <Button
                  className="gradient-button hover:opacity-90 transition-opacity shadow-md"
                  data-testid="button-login"
                >
                  Se connecter
                </Button>
              </Link>
            </div>
            <div className="md:hidden">
              <Link href="/connexion-professionnel">
                <Button size="sm" data-testid="button-login-mobile">
                  Connexion
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative section-gradient-blue dark:bg-gray-900 py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight"
            data-testid="text-hero-title"
          >
            Simplifiez la gestion de votre pratique
          </h1>
          <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 mb-10 leading-relaxed max-w-2xl mx-auto">
            Gobering est la solution de prise de rendez-vous en ligne conçue
            pour les professionnels de la santé et du bien-être au Québec.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inscription-professionnel">
              <Button
                size="lg"
                className="text-base px-8 sm:px-12 py-6 font-semibold text-white gradient-button hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                data-testid="button-start-free"
              >
                Commencer gratuitement
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 sm:px-12 py-6 font-semibold border-2 border-primary text-primary bg-white dark:bg-gray-900 hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-all"
                data-testid="button-view-pricing"
              >
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Free Platform Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary px-4 py-2 rounded-full mb-6">
            <Gift className="h-5 w-5" />
            <span className="font-semibold text-sm"> Gobering </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Bénéficiez gratuitement d'une plateforme professionnelle pour gérer
            vos rendez-vous
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Commencez immédiatement avec tous les outils essentiels : calendrier
            intelligent, notifications automatiques, widgets personnalisables et
            bien plus.
          </p>
          <Link href="/inscription-professionnel">
            <Button
              size="lg"
              className="text-base px-10 py-6 font-semibold text-white gradient-button hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              data-testid="button-start-free-platform"
            >
              Démarrer gratuitement
            </Button>
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Aucune carte de crédit requise
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">
              Une plateforme complète pour gérer votre pratique efficacement
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-900 p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary hover:shadow-xl dark:hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-2"
                  data-testid={`feature-card-${index}`}
                >
                  <div className="w-[60px] h-[60px] bg-blue-verylight dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-5">
                    <Icon className="h-[30px] w-[30px] text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 section-gradient-blue dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Pourquoi choisir Gobering ?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <ul className="space-y-6">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                    </div>
                    <span className="text-base sm:text-lg text-gray-800 dark:text-gray-200 font-medium">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/inscription-professionnel">
                  <Button
                    size="lg"
                    className="gradient-button hover:opacity-90 transition-all shadow-lg"
                    data-testid="button-get-started"
                  >
                    Démarrer maintenant
                  </Button>
                </Link>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 shadow-2xl">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Essai gratuit de 21 jours
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Aucune carte de crédit requise
              </p>
              <ul className="space-y-4 mb-8">
                {trialFeatures.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <Check className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 gradient-bg text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Prêt à transformer votre pratique ?
          </h2>
          <p className="text-lg sm:text-xl mb-10 opacity-95">
            Rejoignez des centaines de professionnels de santé qui utilisent
            Gobering
          </p>
          <Link href="/inscription-professionnel">
            <Button
              size="lg"
              className="text-base sm:text-lg px-6 sm:px-12 py-6 sm:py-7 bg-white text-primary hover:bg-gray-50 transition-all shadow-2xl hover:shadow-3xl hover:-translate-y-1 font-bold w-full sm:w-auto"
              data-testid="button-cta-signup"
            >
              Créer mon compte gratuitement
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CalendarCheck className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-bold">Gobering</h3>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                La plateforme de référence pour la prise de rendez-vous en ligne
                avec vos professionnels santé et bien-être.
              </p>
            </div>
            <div>
              <h4 className="text-base font-semibold mb-4">Liens rapides</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/tarifs">
                    <span
                      className="text-gray-400 hover:text-white transition-colors text-sm cursor-pointer"
                      data-testid="footer-link-pricing"
                    >
                      Tarifs
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/inscription-professionnel">
                    <span
                      className="text-gray-400 hover:text-white transition-colors text-sm cursor-pointer"
                      data-testid="footer-link-register"
                    >
                      Inscription professionnel
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/connexion-professionnel">
                    <span
                      className="text-gray-400 hover:text-white transition-colors text-sm cursor-pointer"
                      data-testid="footer-link-login"
                    >
                      Connexion
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/">
                    <span
                      className="text-gray-400 hover:text-white transition-colors text-sm cursor-pointer"
                      data-testid="footer-link-search"
                    >
                      Rechercher un professionnel
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-base font-semibold mb-4">Contact</h4>
              <ul className="space-y-3">
                <li className="text-gray-400 text-sm">Québec, Canada</li>
                <li className="text-gray-400 text-sm">support@gobering.com</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800">
            <p className="text-center text-gray-400 text-sm">
              © {new Date().getFullYear()} Gobering. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
