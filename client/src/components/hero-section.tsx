import { CalendarCheck, ArrowRight, Play } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative gradient-bg py-10 sm:py-16 md:min-h-[65vh] lg:min-h-[70vh] px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl translate-y-1/2"></div>
      
      {/* Top Bar - Logo and Pro Button - Positioned absolutely at top */}
      <div className="absolute top-4 sm:top-6 left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8 z-20 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Link href="/" data-testid="link-home">
            <div className="bg-white rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-md">
              <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              <h1 className="text-sm sm:text-base font-bold text-primary" data-testid="logo">Gobering</h1>
            </div>
          </Link>
          
          <Link href="/connexion-professionnel" data-testid="link-login">
            <Button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary rounded-full px-4 sm:px-5 text-xs sm:text-sm font-semibold min-h-[44px] min-w-[44px] py-2 sm:py-2.5 transition-all" data-testid="button-login">
              <span className="hidden sm:inline">Se connecter</span>
              <span className="sm:hidden">Connexion</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto relative z-10 flex items-center justify-center min-h-[inherit]">
        <div className="max-w-4xl w-full text-center">
          <h2 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 leading-tight" data-testid="hero-title">
            Simplifiez la gestion de vos rendez-vous
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-white/90 mb-8 sm:mb-10 max-w-2xl mx-auto">
            La plateforme tout-en-un pour les professionnels de santé au Québec. 
            Réservation en ligne, rappels automatiques, gestion client.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link href="/inscription-professionnel" data-testid="link-register">
              <Button 
                size="lg"
                className="bg-white text-primary hover:bg-white/90 rounded-full px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-semibold min-h-[48px] shadow-lg hover:shadow-xl transition-all group"
                data-testid="button-start-free"
              >
                Commencer gratuitement
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            
            <Link href="/pro" data-testid="link-learn-more">
              <Button 
                variant="ghost"
                size="lg"
                className="text-white hover:bg-white/20 hover:text-white rounded-full px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium min-h-[48px] transition-all group"
                data-testid="button-learn-more"
              >
                <Play className="mr-2 h-4 w-4" />
                Découvrir les fonctionnalités
              </Button>
            </Link>
          </div>

          {/* Trust badge */}
          <p className="mt-8 sm:mt-10 text-white/80 text-xs sm:text-sm">
            Rejoignez des milliers de professionnels qui simplifient leur pratique avec Gobering
          </p>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-[-1px] left-0 w-full h-12 sm:h-16 md:h-24" aria-hidden="true">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <path
            d="M0,0 C150,100 350,0 600,50 C850,100 1050,0 1200,50 L1200,120 L0,120 Z"
            fill="white"
            className="dark:fill-gray-950"
          />
        </svg>
      </div>
    </section>
  );
}
