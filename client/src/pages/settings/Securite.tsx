import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SettingsLayout from "./SettingsLayout";
import ChangePasswordModal from "@/components/ChangePasswordModal";

export default function SecuriteSettings() {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <SettingsLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Sécurité</h2>
          <p className="text-muted-foreground text-xs">
            Gérez la sécurité de votre compte
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Authentification</CardTitle>
            <CardDescription className="text-xs">
              Paramètres de sécurité de votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Mot de passe</p>
                <p className="text-sm text-muted-foreground">
                  Modifiez votre mot de passe régulièrement
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowChangePassword(true)}
                data-testid="button-change-password"
              >
                Modifier
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Authentification à deux facteurs</p>
                <p className="text-sm text-muted-foreground">
                  Sécurisez votre compte avec 2FA
                </p>
              </div>
              <Button 
                variant="outline" 
                disabled
                data-testid="button-enable-2fa"
              >
                Bientôt disponible
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </SettingsLayout>
  );
}
