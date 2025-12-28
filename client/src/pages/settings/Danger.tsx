import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SettingsLayout from "./SettingsLayout";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import { useQuery } from "@tanstack/react-query";
import type { Professional, ClinicMember } from "@shared/schema";

export default function DangerSettings() {
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const { data: professional, isLoading: isProfessionalLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const { data: members = [], isLoading: isMembersLoading } = useQuery<ClinicMember[]>({
    queryKey: [`/api/clinics/${professional?.clinicId}/members`],
    enabled: !!professional?.clinicId,
  });

  const userRole = members.find(m => m.professionalId === professional?.id)?.role || null;
  const isLoading = isProfessionalLoading || (professional?.clinicId && isMembersLoading);
  
  // Allow deletion if:
  // 1. User is not in a clinic (solo practitioner)
  // 2. User is Admin in their clinic
  const canDeleteAccount = !professional?.clinicId || userRole === "Admin";

  return (
    <SettingsLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-destructive">Zone de danger</h2>
          <p className="text-muted-foreground text-sm">
            Actions irréversibles sur votre compte
          </p>
        </div>

        {!isLoading && canDeleteAccount && (
          <Card className="border-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-destructive">Actions destructives</CardTitle>
              <CardDescription className="text-xs">
                Ces actions sont définitives et ne peuvent pas être annulées
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Supprimer mon compte</p>
                  <p className="text-sm text-muted-foreground">
                    Cette action supprimera définitivement votre compte et toutes vos données
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteAccount(true)}
                  data-testid="button-delete-account"
                >
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !canDeleteAccount && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Suppression de compte</CardTitle>
              <CardDescription className="text-xs">
                Contactez l'administrateur de votre clinique pour supprimer votre compte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                En tant que membre invité, seul l'administrateur de la clinique peut supprimer votre compte.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <DeleteAccountModal
        open={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
      />
    </SettingsLayout>
  );
}
