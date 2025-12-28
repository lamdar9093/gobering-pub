import { Link, useRoute } from "wouter";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";
import {  
  Settings,
  Bell,
  Lock,
  Building2,
  AlertTriangle,
  CalendarDays,
  Users
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import type { Professional } from "@shared/schema";

const settingsNav = [
  {
    name: "Général",
    href: "/dashboard/parametres/general",
    icon: Settings,
  },
  {
    name: "Réservation",
    href: "/dashboard/parametres/reservation",
    icon: CalendarDays,
  },
  {
    name: "Notifications",
    href: "/dashboard/parametres/notifications",
    icon: Bell,
  },
  {
    name: "Sécurité",
    href: "/dashboard/parametres/securite",
    icon: Lock,
  },
  {
    name: "Clinique",
    href: "/dashboard/parametres/clinique",
    icon: Building2,
    requiresPro: true,
  },
  {
    name: "Liste d'attente",
    href: "/dashboard/parametres/waitlist",
    icon: Users,
    requiresPro: true,
  },
  {
    name: "Zone de danger",
    href: "/dashboard/parametres/danger",
    icon: AlertTriangle,
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsNavItem({ item, isMobile = false }: { item: typeof settingsNav[0], isMobile?: boolean }) {
  const [isActive] = useRoute(item.href);
  const Icon = item.icon;

  return (
    <Link 
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-lg font-medium transition-colors",
        isMobile ? "px-3 py-2 text-xs whitespace-nowrap" : "gap-3 px-3 py-2 text-sm",
        isActive
          ? "bg-primary text-primary-foreground"
          : isMobile 
            ? "text-muted-foreground bg-muted/50" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      data-testid={isMobile ? `nav-mobile-${item.name.toLowerCase().replace(/\s+/g, '-')}` : `nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Icon className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span>{item.name}</span>
    </Link>
  );
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const navContainerRef = useRef<HTMLDivElement>(null);
  const SCROLL_POSITION_KEY = 'settings-nav-scroll-position';

  const { data: professional } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Filter navigation based on plan
  const isFreePlan = professional?.planType === 'free';
  const visibleNav = settingsNav.filter(item => {
    if (item.requiresPro && isFreePlan) {
      return false;
    }
    return true;
  });

  // Restore scroll position on mount
  useEffect(() => {
    const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
    if (savedPosition && navContainerRef.current) {
      navContainerRef.current.scrollLeft = parseInt(savedPosition, 10);
    }
  }, []);

  // Save scroll position when scrolling
  const handleScroll = () => {
    if (navContainerRef.current) {
      sessionStorage.setItem(SCROLL_POSITION_KEY, navContainerRef.current.scrollLeft.toString());
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-page-title">
            Paramètres
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-xs">
            Gérez vos préférences et paramètres de compte
          </p>
        </div>

        {/* Navigation horizontale sur mobile, sidebar sur desktop */}
        <div 
          ref={navContainerRef}
          className="md:hidden -mx-6 px-6 overflow-x-auto"
          onScroll={handleScroll}
        >
          <nav className="flex gap-2 min-w-max pb-2">
            {visibleNav.map((item) => (
              <SettingsNavItem key={item.href} item={item} isMobile={true} />
            ))}
          </nav>
        </div>

        <div className="md:flex md:gap-6">
          {/* Sidebar navigation - Desktop uniquement */}
          <aside className="hidden md:block w-64 space-y-1">
            <nav className="space-y-1">
              {visibleNav.map((item) => (
                <SettingsNavItem key={item.href} item={item} />
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}
