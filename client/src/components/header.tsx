import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, UserCircle, CalendarCheck } from "lucide-react";
import { Link } from "wouter";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 md:h-16">
          <Link href="/">
            <div className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
              <CalendarCheck className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold text-primary" data-testid="logo">Gobering</h1>
            </div>
          </Link>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link href="/connexion-professionnel">
              <Button 
                className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity duration-200 flex items-center gap-1.5 md:gap-2 text-sm md:text-base px-3 md:px-4 py-1.5 md:py-2"
                data-testid="button-pro-access"
              >
                <UserCircle className="h-4 w-4 md:h-5 md:w-5" />
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
              <Link href="/connexion-professionnel">
                <span className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium cursor-pointer">
                  Se connecter
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
