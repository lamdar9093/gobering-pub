import { Facebook, Twitter, Linkedin, Mail } from "lucide-react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-black text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h4 className="text-2xl font-bold mb-4" data-testid="footer-logo">
              Gobering
            </h4>
            <p
              className="text-gray-400 mb-6 max-w-md leading-relaxed"
              data-testid="footer-description"
            >
              La plateforme de gestion de rendez-vous conçue pour les professionnels de santé au Québec. 
              Simplifiez votre pratique au quotidien.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors duration-200"
                data-testid="link-facebook"
              >
                <Facebook className="h-6 w-6" />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors duration-200"
                data-testid="link-twitter"
              >
                <Twitter className="h-6 w-6" />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors duration-200"
                data-testid="link-linkedin"
              >
                <Linkedin className="h-6 w-6" />
              </a>
            </div>
          </div>

          <div>
            <h5
              className="text-base font-semibold mb-4"
              data-testid="footer-product-title"
            >
              Produit
            </h5>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/pro"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-features"
                >
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link 
                  href="/pricing"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-pricing"
                >
                  Tarifs
                </Link>
              </li>
              <li>
                <Link 
                  href="/inscription-professionnel"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-signup"
                >
                  Inscription
                </Link>
              </li>
              <li>
                <Link 
                  href="/connexion-professionnel"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-login"
                >
                  Connexion
                </Link>
              </li>
            </ul>
          </div>

          <div id="contact">
            <h5
              className="text-base font-semibold mb-4"
              data-testid="footer-contact-title"
            >
              Contact
            </h5>
            <ul className="space-y-3">
              <li>
                <Link href="/contact">
                  <span className="text-gray-400 hover:text-white transition-colors text-sm cursor-pointer" data-testid="link-contact-form">
                    Écrivez-nous
                  </span>
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <a
                  href="mailto:operations@gobering.com"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-email"
                >
                  operations@gobering.com
                </a>
              </li>
              <li>
                <a
                  href="/cgu"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-terms"
                >
                  CGU
                </a>
              </li>
              <li>
                <a
                  href="/confidentialite"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  data-testid="link-privacy"
                >
                  Confidentialité
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400 text-sm" data-testid="footer-copyright">
            © {new Date().getFullYear()} Gobering. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
