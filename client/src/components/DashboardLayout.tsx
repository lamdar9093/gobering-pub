import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Users, 
  BarChart3, 
  User, 
  Settings, 
  LogOut,
  Menu,
  X,
  Building2,
  Briefcase,
  ClipboardList,
  Share2,
  Crown,
  MoreHorizontal
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import type { Professional, ClinicMember } from "@shared/schema";
import { ReadOnlyModeDialog } from "@/components/ReadOnlyModeDialog";
import { TrialExpirationDialog } from "@/components/TrialExpirationDialog";
import { TeamCostBadge } from "@/components/TeamCostBadge";
import { OnboardingTour } from "@/components/OnboardingTour";
import { isTrialExpired, getTrialBadgeText } from "@/lib/subscription-utils";

interface DashboardLayoutProps {
  children: ReactNode;
  professionalName?: string;
}

interface NavItem {
  icon: typeof Calendar;
  label: string;
  path: string;
  testId: string;
  requiresRole?: string[];
}

interface BottomNavItem {
  icon: typeof Calendar;
  label: string;
  paths: string[];
  testId: string;
}

export default function DashboardLayout({ children, professionalName }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);

  // Handle menu mounting and animation
  useEffect(() => {
    let enterTimeout: ReturnType<typeof setTimeout> | undefined;
    let exitTimeout: ReturnType<typeof setTimeout> | undefined;

    if (isMobileMenuOpen) {
      // Mount the menu first
      setIsMenuMounted(true);
      // Small delay to trigger CSS transition
      enterTimeout = setTimeout(() => setIsMenuAnimating(true), 10);
    } else {
      // Animate out first
      setIsMenuAnimating(false);
      // Unmount after animation completes (300ms)
      exitTimeout = setTimeout(() => setIsMenuMounted(false), 300);
    }

    // Cleanup function to clear any pending timeouts
    return () => {
      if (enterTimeout) clearTimeout(enterTimeout);
      if (exitTimeout) clearTimeout(exitTimeout);
    };
  }, [isMobileMenuOpen]);

  const { data: professional, isLoading: isProfessionalLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const { data: members = [], isLoading: isMembersLoading } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  const userRole = members.find(m => m.professionalId === professional?.id)?.role || null;

  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      {
        icon: User,
        label: "Profil",
        path: "/dashboard/profil",
        testId: "nav-profil",
      },
      {
        icon: Calendar,
        label: "Calendrier",
        path: "/dashboard",
        testId: "nav-calendar",
      },
      {
        icon: Users,
        label: "Clients",
        path: "/dashboard/clients",
        testId: "nav-clients",
        requiresRole: ["Admin", "Professionnel", "Secrétaire"],
      },
      {
        icon: ClipboardList,
        label: "Liste d'attente",
        path: "/dashboard/liste-attente",
        testId: "nav-liste-attente",
        requiresRole: ["Admin", "Professionnel", "Secrétaire"],
      },
      {
        icon: Building2,
        label: "Gestion Clinique",
        path: "/dashboard/gestion-clinique",
        testId: "nav-gestion-clinique",
        requiresRole: ["Admin"],
      },
      {
        icon: Share2,
        label: "Promouvoir",
        path: "/dashboard/promouvoir",
        testId: "nav-promouvoir",
        requiresRole: ["Admin"],
      },
      {
        icon: BarChart3,
        label: "Statistiques",
        path: "/dashboard/statistiques",
        testId: "nav-statistics",
        requiresRole: ["Admin", "Professionnel"],
      },
      {
        icon: Settings,
        label: "Paramètres",
        path: "/dashboard/parametres",
        testId: "nav-settings",
      },
    ];

    // Wait for queries to finish before showing role-restricted items
    const isLoadingRoleData = isProfessionalLoading || (professional?.clinicId && isMembersLoading);
    
    return baseItems.filter(item => {
      if (!item.requiresRole) return true;
      // Don't show role-restricted items while loading role data
      if (isLoadingRoleData) return false;
      // If no clinic, default to Professionnel permissions
      const effectiveRole = userRole || "Professionnel";
      return item.requiresRole.includes(effectiveRole);
    });
  };

  // Bottom navigation items (mobile only)
  const getBottomNavItems = (): BottomNavItem[] => {
    return [
      {
        icon: Calendar,
        label: "Calendrier",
        paths: ["/dashboard"],
        testId: "bottom-nav-calendar",
      },
      {
        icon: Users,
        label: "Clients",
        paths: ["/dashboard/clients"],
        testId: "bottom-nav-clients",
      },
      {
        icon: BarChart3,
        label: "Stats",
        paths: ["/dashboard/statistiques"],
        testId: "bottom-nav-stats",
      },
      {
        icon: MoreHorizontal,
        label: "Plus",
        paths: ["/dashboard/profil", "/dashboard/liste-attente", "/dashboard/gestion-clinique", "/dashboard/promouvoir", "/dashboard/parametres"],
        testId: "bottom-nav-more",
      },
    ];
  };

  const navItems = getNavItems();
  const bottomNavItems = getBottomNavItems();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      // Clear all query cache to prevent stale data
      queryClient.clear();
      
      // Clear any local storage items if present
      localStorage.clear();
      
      // Force a complete page reload to ensure clean state
      window.location.href = "/login-professionnel";
    },
    onError: () => {
      // Even on error, clear cache and reload to be safe
      queryClient.clear();
      localStorage.clear();
      window.location.href = "/login-professionnel";
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location === path;
    }
    return location.startsWith(path);
  };

  const isBottomNavActive = (paths: string[]) => {
    return paths.some(path => {
      if (path === "/dashboard") {
        return location === path;
      }
      return location.startsWith(path);
    });
  };

  // Get plan type and trial info for mobile badge
  const { data: clinicSubscription } = useQuery<{
    planType: string;
    subscriptionStatus: string;
    trialEndsAt?: string;
    adminName?: string;
  }>({
    queryKey: [`/api/clinics/${professional?.clinicId}/subscription-status`],
    enabled: !!professional?.clinicId,
  });

  const isAdmin = members.find(m => m.professionalId === professional?.id)?.role === 'Admin';
  const planType = professional 
    ? (isAdmin ? (professional.planType || 'legacy') : (clinicSubscription?.planType || 'legacy'))
    : 'legacy';
  const subscriptionStatus = professional
    ? (isAdmin ? professional.subscriptionStatus : clinicSubscription?.subscriptionStatus)
    : undefined;
  const trialEndsAt = professional
    ? (isAdmin ? professional.trialEndsAt : clinicSubscription?.trialEndsAt)
    : undefined;
  const isInTrial = subscriptionStatus === 'trial';
  const trialExpired = isTrialExpired(trialEndsAt);
  const trialBadgeText = getTrialBadgeText(trialEndsAt);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-blue-600 text-white">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-blue-500">
          <h1 className="text-2xl font-bold">Gobering</h1>
          {professional && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-blue-100">
                {professional.firstName} {professional.lastName}
              </p>
              {userRole && (
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                  userRole === 'Admin' 
                    ? 'bg-blue-400 text-blue-950' 
                    : userRole === 'Professionnel'
                    ? 'bg-green-400 text-green-950'
                    : 'bg-amber-400 text-amber-950'
                }`}>
                  {userRole}
                </span>
              )}
            </div>
          )}
          {professional && (
            <div className="mt-3">
              <TeamCostBadge professional={professional} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                data-testid={item.testId}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? "bg-blue-500 text-white"
                    : "text-blue-50 hover:bg-blue-500/50"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-blue-500">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-blue-500/50"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile Top Bar with gradient */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md">
        <div className="p-3 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold">Gobering</h1>
            {professional && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <p className="text-xs text-blue-100">
                  {professional.firstName} {professional.lastName}
                </p>
                {userRole && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                    userRole === 'Admin' 
                      ? 'bg-blue-300 text-blue-950' 
                      : userRole === 'Professionnel'
                      ? 'bg-green-300 text-green-950'
                      : 'bg-amber-300 text-amber-950'
                  }`}>
                    {userRole}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-11 h-11 bg-white/15 rounded-lg flex items-center justify-center active:bg-white/25 active:scale-95 transition-all"
            data-testid="button-mobile-menu"
          >
            <div className="flex flex-col gap-[3px]">
              <span className="w-3.5 h-[2px] bg-white rounded-full"></span>
              <span className="w-3.5 h-[2px] bg-white rounded-full"></span>
              <span className="w-3.5 h-[2px] bg-white rounded-full"></span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Badge - Subtle version below top bar */}
      {professional && planType !== 'legacy' && (
        <div className="lg:hidden fixed top-[62px] left-0 right-0 z-40 bg-white px-5 py-2.5 mt-1">
          <button 
            onClick={() => setLocation('/dashboard/parametres/abonnement')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 active:scale-95 transition-all cursor-pointer"
            data-testid="button-subscription-badge-mobile"
          >
            <User className="h-3.5 w-3.5 text-blue-700" />
            <span className="text-xs font-semibold text-blue-700">
              Plan {planType === 'pro' ? 'PRO' : 'BASIC'}
            </span>
            {isInTrial && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                trialExpired
                  ? 'bg-red-400 text-red-950'
                  : 'bg-emerald-400 text-emerald-950'
              }`}>
                {trialBadgeText}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMenuMounted && (
        <>
          {/* Black semi-transparent overlay with click to close */}
          <div 
            className={`lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
              isMenuAnimating ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
            data-testid="mobile-menu-overlay"
          />
          
          {/* Sliding Sidebar Menu with blue gradient */}
          <div className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[80vw] max-w-sm bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
            isMenuAnimating ? 'translate-x-0' : '-translate-x-full'
          }`}>
            {/* Menu Header */}
            <div className="relative p-4 border-b border-white/15">
              <h2 className="text-xl font-bold mb-1">Menu</h2>
              {professional && (
                <p className="text-xs text-white/90">
                  {professional.firstName} {professional.lastName}
                </p>
              )}
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-3 right-3 w-11 h-11 bg-white/15 rounded-lg flex items-center justify-center active:bg-white/25 transition-colors"
                data-testid="button-close-mobile-menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid={`${item.testId}-mobile`}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      active
                        ? "bg-white/15"
                        : "hover:bg-white/10 active:bg-white/10"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout Button */}
            <div className="p-3 border-t border-white/15">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/15 rounded-lg active:bg-white/25 transition-colors"
                data-testid="button-logout-mobile"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-semibold">Déconnexion</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-[62px] pb-16 lg:pt-0 lg:pb-0">
        <div className={professional && planType !== 'legacy' ? "p-6 lg:p-8 mt-[40px] lg:mt-0" : "p-6 lg:p-8"}>
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-4 gap-1 px-3 py-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isBottomNavActive(item.paths);
            
            return (
              <button
                key={item.testId}
                onClick={() => {
                  // If "Plus" button, only open mobile menu
                  if (item.label === "Plus") {
                    setIsMobileMenuOpen(true);
                  } else {
                    // Navigate to first path in array for other buttons
                    setLocation(item.paths[0]);
                  }
                }}
                data-testid={item.testId}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors ${
                  active ? "bg-blue-50" : ""
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-blue-500" : "text-gray-600"}`} />
                <span className={`text-[10px] font-semibold ${active ? "text-blue-500" : "text-gray-600"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Trial Expiration Choice Dialog */}
      {professional && (
        <TrialExpirationDialog
          isTrialExpired={isTrialExpired(professional.trialEndsAt)}
          subscriptionStatus={professional.subscriptionStatus || undefined}
        />
      )}
      
      {/* Free Plan Limits Dialog - Ne pas afficher si le statut est 'trial' (TrialExpirationDialog s'affiche à la place) */}
      {professional?.subscriptionStatus !== 'trial' && (
        <ReadOnlyModeDialog 
          isReadOnly={!!(professional as any)?.readOnlyMode}
          showFreePlanLimits={!!(professional as any)?.showFreePlanLimits}
          userRole={userRole || undefined}
          clinicId={professional?.clinicId || undefined}
        />
      )}
      
      {/* Onboarding Tour */}
      {professional && (
        <OnboardingTour 
          shouldStart={!professional.hasCompletedOnboarding}
          professionalId={professional.id}
          userRole={userRole}
        />
      )}
    </div>
  );
}
