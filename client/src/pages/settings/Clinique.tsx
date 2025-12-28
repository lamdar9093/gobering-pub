import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Professional, Clinic, ClinicMember, ClinicService } from "@shared/schema";
import SettingsLayout from "./SettingsLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import CreateClinicModal from "@/components/CreateClinicModal";
import ViewClinicDetailsModal from "@/components/ViewClinicDetailsModal";
import { Building2, Users, Briefcase, Globe, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function CliniqueSettings() {
  const [showCreateClinic, setShowCreateClinic] = useState(false);
  const [showClinicDetails, setShowClinicDetails] = useState(false);
  const [, setLocation] = useLocation();

  const { data: professional, isLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  // Redirect free plan users
  useEffect(() => {
    if (!isLoading && professional?.planType === 'free') {
      setLocation("/dashboard/parametres/general");
    }
  }, [isLoading, professional?.planType, setLocation]);

  const { data: clinic } = useQuery<Clinic>({
    queryKey: [`/api/clinics/${professional?.clinicId}`],
    enabled: !!professional?.clinicId,
  });

  // Fetch clinic members for stats
  const { data: members = [] } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  // Get current user's role from clinic members
  const currentUserMember = members.find(m => m.professionalId === professional?.id);
  const currentUserRole = currentUserMember?.role || "Professionnel";

  // Fetch clinic services for stats
  const { data: clinicServices = [] } = useQuery<ClinicService[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/services`],
    enabled: !!professional?.clinicId && currentUserRole === "Admin",
  });

  if (isLoading) {
    return (
      <SettingsLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingAnimation />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Clinique</h2>
          <p className="text-muted-foreground text-sm">
            Informations sur votre clinique
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Gestion de clinique</CardTitle>
            <CardDescription className="text-xs">
              Créez ou rejoignez une clinique pour collaborer avec d'autres professionnels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {professional?.clinicId ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Clinique associée</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-clinic-name">
                      {clinic?.name || `ID: ${professional.clinicId}`}
                    </p>
                    {clinic && (
                      <p className="text-xs text-muted-foreground">
                        {clinic.address}, {clinic.city}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowClinicDetails(true)}
                    data-testid="button-view-clinic"
                  >
                    Voir détails
                  </Button>
                </div>

                {/* Clinic Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{members.length}</p>
                      <p className="text-xs text-muted-foreground">Membres</p>
                    </div>
                  </div>

                  {currentUserRole === "Admin" && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{clinicServices.length}</p>
                        <p className="text-xs text-muted-foreground">Services</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{professional.publiclyVisible ? "Visible" : "Masqué"}</p>
                      <p className="text-xs text-muted-foreground">Visibilité</p>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="pt-4 border-t space-y-2">
                  <h4 className="text-sm font-semibold mb-3">Accès rapide</h4>
                  
                  <Link href="/dashboard/gestion-clinique">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between"
                      data-testid="link-manage-clinic"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>Gestion de clinique</span>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href="/dashboard/promouvoir">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between"
                      data-testid="link-promote"
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Widget de réservation</span>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Créer ou rejoindre une clinique</p>
                  <p className="text-sm text-muted-foreground">
                    Collaborez avec d'autres professionnels
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateClinic(true)}
                  data-testid="button-create-clinic"
                >
                  Configurer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateClinicModal
        open={showCreateClinic}
        onClose={() => setShowCreateClinic(false)}
      />

      {professional?.clinicId && (
        <ViewClinicDetailsModal
          open={showClinicDetails}
          onClose={() => setShowClinicDetails(false)}
          clinicId={professional.clinicId}
          clinic={clinic}
        />
      )}
    </SettingsLayout>
  );
}
