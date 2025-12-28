import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, CalendarCheck, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ProHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const features = [
    { name: "Gestion des rendez-vous", description: "Calendrier intelligent" },
    { name: "Gestion des clients", description: "Base de données centralisée" },
    { name: "Statistiques", description: "Rapports détaillés" },
    { name: "Rappels automatiques", description: "Par email et SMS" },
  ];

  const professions = [
    "Médecins",
    "Ostéopathes",
    "Chiropraticiens",
    "Kinésithérapeutes",
    "Psychologues",
    "Dentistes",
    "Nutritionnistes",
  ];

  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <CalendarCheck className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-primary" data-testid="logo">Gobering</h1>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-200" data-testid="nav-features">
                Fonctionnalités
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                {features.map((feature, index) => (
                  <DropdownMenuItem key={index} className="flex flex-col items-start py-3">
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-xs text-muted-foreground">{feature.description}</div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-200" data-testid="nav-professions">
                Métiers
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                {professions.map((profession, index) => (
                  <DropdownMenuItem key={index}>
                    {profession}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/tarifs">
              <span className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer" data-testid="nav-pricing">
                Tarifs
              </span>
            </Link>

            <a 
              href="#contact" 
              className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors duration-200"
              data-testid="nav-contact"
            >
              Contact
            </a>
          </nav>

          <div className="flex items-center space-x-4">
            <Link href="/login-professionnel">
              <Button 
                className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity duration-200"
                data-testid="button-pro-login"
              >
                Se connecter
              </Button>
            </Link>
            <button 
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-border">
              <div className="py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-2">
                  Fonctionnalités
                </p>
                {features.map((feature, index) => (
                  <a
                    key={index}
                    href="#"
                    className="text-muted-foreground hover:text-foreground block px-3 py-2 text-sm"
                  >
                    {feature.name}
                  </a>
                ))}
              </div>
              <div className="py-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase px-3 mb-2">
                  Métiers
                </p>
                {professions.map((profession, index) => (
                  <a
                    key={index}
                    href="#"
                    className="text-muted-foreground hover:text-foreground block px-3 py-2 text-sm"
                  >
                    {profession}
                  </a>
                ))}
              </div>
              <Link href="/tarifs">
                <span className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium cursor-pointer">
                  Tarifs
                </span>
              </Link>
              <a
                href="#contact"
                className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium"
              >
                Contact
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
