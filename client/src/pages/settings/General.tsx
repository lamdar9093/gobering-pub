import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Professional } from "@shared/schema";
import SettingsLayout from "./SettingsLayout";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useForm } from "react-hook-form";

export default function GeneralSettings() {
  const { toast } = useToast();

  const { data: professional, isLoading } = useQuery<Professional>({
    queryKey: ["/api/auth/me"],
  });

  const form = useForm({
    values: {
      firstName: professional?.firstName || "",
      lastName: professional?.lastName || "",
      phone: professional?.phone || "",
      email: professional?.email || "",
      description: professional?.description || "",
      specializations: professional?.specializations?.join(", ") || "",
      timezone: professional?.timezone || "America/Toronto",
      language: professional?.language || "fr",
      dateFormat: professional?.dateFormat || "dd/MM/yyyy",
      timeFormat: professional?.timeFormat || "24h",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/professional/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Paramètres enregistrés",
        description: "Vos préférences générales ont été mises à jour.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    // Convert specializations from comma-separated string to array
    const processedData = {
      ...data,
      specializations: data.specializations
        ? (data.specializations as string).split(",").map(s => s.trim()).filter(Boolean)
        : [],
    };
    updateMutation.mutate(processedData);
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
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Paramètres généraux</h2>
            <p className="text-muted-foreground text-xs">
              Informations de profil et préférences générales
            </p>
          </div>
          <Button 
            type="submit" 
            disabled={updateMutation.isPending}
            data-testid="button-save-general"
          >
            {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Profil</CardTitle>
            <CardDescription className="text-xs">
              Informations personnelles affichées publiquement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  {...form.register("firstName")}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  {...form.register("lastName")}
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                {...form.register("phone")}
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                disabled
                className="bg-muted cursor-not-allowed"
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Informations professionnelles</CardTitle>
            <CardDescription className="text-xs">
              Détails affichés dans votre profil public
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Décrivez votre parcours et votre approche..."
                rows={4}
                data-testid="input-description"
              />
              <p className="text-xs text-muted-foreground">
                Partagez votre expérience et votre approche avec vos patients
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="specializations">Spécialisations</Label>
              <Input
                id="specializations"
                {...form.register("specializations")}
                placeholder="Ex: Médecine du sport, Pédiatrie, Femmes enceintes"
                data-testid="input-specializations"
              />
              <p className="text-xs text-muted-foreground">
                Séparez chaque spécialisation par une virgule
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Préférences régionales</CardTitle>
            <CardDescription className="text-xs">
              Fuseau horaire, langue et formats d'affichage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Fuseau horaire</Label>
              <Select 
                value={form.watch("timezone")} 
                onValueChange={(value) => form.setValue("timezone", value)}
              >
                <SelectTrigger id="timezone" data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Toronto">America/Toronto (EST)</SelectItem>
                  <SelectItem value="America/Montreal">America/Montreal (EST)</SelectItem>
                  <SelectItem value="America/Vancouver">America/Vancouver (PST)</SelectItem>
                  <SelectItem value="America/Edmonton">America/Edmonton (MST)</SelectItem>
                  <SelectItem value="America/Winnipeg">America/Winnipeg (CST)</SelectItem>
                  <SelectItem value="America/Halifax">America/Halifax (AST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Langue</Label>
              <Select 
                value={form.watch("language")} 
                onValueChange={(value) => form.setValue("language", value)}
              >
                <SelectTrigger id="language" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Format de date</Label>
                <Select 
                  value={form.watch("dateFormat")} 
                  onValueChange={(value) => form.setValue("dateFormat", value)}
                >
                  <SelectTrigger id="dateFormat" data-testid="select-date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">JJ/MM/AAAA</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/JJ/AAAA</SelectItem>
                    <SelectItem value="yyyy-MM-dd">AAAA-MM-JJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeFormat">Format d'heure</Label>
                <Select 
                  value={form.watch("timeFormat")} 
                  onValueChange={(value) => form.setValue("timeFormat", value)}
                >
                  <SelectTrigger id="timeFormat" data-testid="select-time-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24 heures</SelectItem>
                    <SelectItem value="12h">12 heures (AM/PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </SettingsLayout>
  );
}
