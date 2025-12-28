import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Cookie } from "lucide-react";
import { Link } from "wouter";

const COOKIE_CONSENT_KEY = "gobering_cookie_consent";

// Helper function to get a cookie value
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// Helper function to set a cookie
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// Check if user has accepted cookies (with fallback to cookie storage)
function hasAcceptedCookies(): boolean {
  // First try localStorage
  try {
    const localStorageValue = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (localStorageValue === "accepted") {
      return true;
    }
  } catch (error) {
    // localStorage might be blocked or unavailable
  }
  
  // Fallback to checking cookies
  return getCookie(COOKIE_CONSENT_KEY) === "accepted";
}

// Save cookie acceptance (with fallback to cookie storage)
function saveAcceptance() {
  // Try localStorage first
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
  } catch (error) {
    console.warn("localStorage unavailable, using cookie storage");
  }
  
  // Always also set a cookie as fallback
  setCookie(COOKIE_CONSENT_KEY, "accepted", 365);
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    if (!hasAcceptedCookies()) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    saveAcceptance();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg"
      data-testid="cookie-consent-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div className="text-sm text-foreground">
              <p className="font-medium mb-1">🍪 Utilisation des cookies</p>
              <p className="text-muted-foreground">
                Gobering utilise uniquement des cookies essentiels pour assurer le bon fonctionnement 
                de la plateforme (connexion, sécurité, préférences). Nous n'utilisons aucun cookie 
                de suivi ou de publicité.{" "}
                <Link 
                  href="/confidentialite"
                  className="underline hover:text-foreground transition-colors"
                  data-testid="link-privacy-policy"
                >
                  En savoir plus
                </Link>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleAccept}
              className="flex-1 sm:flex-none"
              data-testid="button-accept-cookies"
            >
              J'ai compris
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAccept}
              className="flex-shrink-0"
              data-testid="button-close-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
