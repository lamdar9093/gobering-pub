import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OnboardingTourProps {
  shouldStart: boolean;
  professionalId: string;
  userRole: string | null;
}

export function OnboardingTour({ shouldStart, professionalId, userRole }: OnboardingTourProps) {
  const hasStartedRef = useRef(false);
  
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/professionals/${professionalId}/complete-onboarding`, {});
    },
    onSuccess: () => {
      // Invalidate the auth/me query used by DashboardLayout
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  useEffect(() => {
    // Ne démarrer qu'une seule fois
    if (hasStartedRef.current) return;
    
    // Ne pas démarrer le tour tant que le rôle n'est pas chargé
    if (!shouldStart || userRole === null) return;
    
    // Marquer comme démarré pour éviter les doubles lancements
    hasStartedRef.current = true;

    // Lazy load driver.js uniquement quand nécessaire
    let driverObj: any;
    
    const initTour = async () => {
      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css")
      ]);

      // Détecter si on est sur mobile ou desktop
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;

      // Définir les étapes selon le rôle et le type d'appareil
      const getStepsForRole = (role: string, mobile: boolean) => {
        const effectiveRole = role;
        
        // Étapes pour desktop (sidebar navigation)
        const desktopSteps = [
          {
            popover: {
              title: "Bienvenue sur Gobering! 🎉",
              description: "Nous sommes ravis de vous accueillir. Laissez-nous vous faire découvrir rapidement les principales fonctionnalités de votre tableau de bord. Vous pouvez passer ce tour à tout moment.",
            },
          },
          {
            element: '[data-testid="nav-profil"]',
            popover: {
              title: "👤 Profil",
              description: "Complétez votre profil professionnel avec vos informations, votre photo et votre description. C'est ce que vos patients verront quand ils rechercheront un professionnel.",
              side: "right" as const,
              align: "start" as const,
            },
          },
          {
            element: '[data-testid="nav-calendar"]',
            popover: {
              title: "📅 Calendrier",
              description: "Visualisez et gérez votre emploi du temps. C'est ici que vous configurez vos disponibilités hebdomadaires, créez des rendez-vous et gérez vos horaires de travail.",
              side: "right" as const,
              align: "start" as const,
            },
          },
          {
            element: '[data-testid="nav-clients"]',
            popover: {
              title: "👥 Clients",
              description: "Gérez votre liste de patients. Consultez leurs informations, leur historique de rendez-vous et ajoutez des notes importantes.",
              side: "right" as const,
              align: "start" as const,
            },
            roles: ["Admin", "Professionnel", "Secrétaire"],
          },
          {
            element: '[data-testid="nav-liste-attente"]',
            popover: {
              title: "📋 Liste d'attente",
              description: "Gérez votre liste d'attente pour offrir des créneaux aux patients lorsqu'une annulation se produit ou qu'un nouveau créneau se libère.",
              side: "right" as const,
              align: "start" as const,
            },
            roles: ["Admin", "Professionnel", "Secrétaire"],
          },
          {
            element: '[data-testid="nav-gestion-clinique"]',
            popover: {
              title: "🏥 Gestion Clinique",
              description: "Gérez votre équipe : invitez des professionnels et des secrétaires à rejoindre votre clinique pour collaborer efficacement.",
              side: "right" as const,
              align: "start" as const,
            },
            roles: ["Admin"],
          },
          {
            element: '[data-testid="nav-promouvoir"]',
            popover: {
              title: "📢 Promouvoir",
              description: "Obtenez votre lien de réservation personnalisé et un widget à intégrer sur votre site web pour permettre à vos patients de prendre rendez-vous facilement.",
              side: "right" as const,
              align: "start" as const,
            },
            roles: ["Admin"],
          },
          {
            element: '[data-testid="nav-statistics"]',
            popover: {
              title: "📊 Statistiques",
              description: "Suivez l'évolution de votre activité : nombre de rendez-vous, revenus, taux d'annulation et autres métriques importantes pour votre pratique.",
              side: "right" as const,
              align: "start" as const,
            },
            roles: ["Admin", "Professionnel"],
          },
          {
            element: '[data-testid="nav-settings"]',
            popover: {
              title: "⚙️ Paramètres",
              description: "Personnalisez votre expérience : configurez vos notifications, vos horaires de travail, vos services et gérez votre abonnement.",
              side: "right" as const,
              align: "start" as const,
            },
          },
          {
            popover: {
              title: "C'est parti! 🚀",
              description: "Vous êtes maintenant prêt à utiliser Gobering. N'hésitez pas à explorer les différentes sections. Si vous avez des questions, notre équipe est là pour vous aider!",
            },
          },
        ];

        // Étapes pour mobile (bottom navigation + hamburger menu)
        const mobileSteps = [
          {
            popover: {
              title: "Bienvenue sur Gobering! 🎉",
              description: "Découvrez rapidement les fonctionnalités de votre tableau de bord. Vous pouvez passer ce tour à tout moment.",
            },
          },
          {
            element: '[data-testid="bottom-nav-calendar"]',
            popover: {
              title: "📅 Calendrier",
              description: "Gérez votre emploi du temps et vos disponibilités.",
              side: "top" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-testid="bottom-nav-clients"]',
            popover: {
              title: "👥 Clients",
              description: "Accédez à votre liste de patients et leur historique.",
              side: "top" as const,
              align: "center" as const,
            },
            roles: ["Admin", "Professionnel", "Secrétaire"],
          },
          {
            element: '[data-testid="bottom-nav-stats"]',
            popover: {
              title: "📊 Statistiques",
              description: "Suivez vos rendez-vous et vos revenus.",
              side: "top" as const,
              align: "center" as const,
            },
            roles: ["Admin", "Professionnel"],
          },
          {
            element: '[data-testid="bottom-nav-more"]',
            popover: {
              title: "⋯ Plus",
              description: "Accédez à votre profil, la liste d'attente, les paramètres et plus encore via ce menu.",
              side: "top" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-testid="button-mobile-menu"]',
            popover: {
              title: "☰ Menu complet",
              description: "Ouvrez le menu pour accéder à toutes les fonctionnalités de Gobering.",
              side: "bottom" as const,
              align: "end" as const,
            },
          },
          {
            popover: {
              title: "C'est parti! 🚀",
              description: "Vous êtes prêt à utiliser Gobering. Explorez les différentes sections!",
            },
          },
        ];

        // Filtrer les étapes selon le rôle
        const allSteps = mobile ? mobileSteps : desktopSteps;
        return allSteps.filter(step => {
          // Si l'étape n'a pas de restriction de rôle, l'inclure
          if (!('roles' in step)) return true;
          // Sinon, vérifier si le rôle actuel est autorisé
          return step.roles?.includes(effectiveRole);
        });
      };

      const steps = getStepsForRole(userRole, isMobile);

      driverObj = driver({
        showProgress: true,
        showButtons: ["next", "previous", "close"],
        nextBtnText: "Suivant",
        prevBtnText: "Précédent",
        doneBtnText: "Terminer",
        progressText: "{{current}} sur {{total}}",
        popoverClass: "driverjs-theme",
        onDestroyStarted: () => {
          // Marquer comme complété même si l'utilisateur passe le tour
          completeOnboardingMutation.mutate();
          driverObj.destroy();
        },
        steps,
      });

      // Démarrer le tour après un délai plus long pour s'assurer que tout est chargé et éviter le flash
      setTimeout(() => {
        // Vérifier que les éléments du DOM sont présents avant de démarrer
        const hasRequiredElements = steps.every(step => {
          if (!('element' in step)) return true;
          return document.querySelector(step.element as string) !== null;
        });

        if (hasRequiredElements) {
          driverObj.drive();
        } else {
          // Si certains éléments ne sont pas encore présents, réessayer après un court délai
          setTimeout(() => {
            driverObj.drive();
          }, 500);
        }
      }, 1000);
    };

    initTour();

    return () => {
      if (driverObj) {
        driverObj.destroy();
      }
    };
  }, [shouldStart, professionalId, userRole]);

  return null;
}
