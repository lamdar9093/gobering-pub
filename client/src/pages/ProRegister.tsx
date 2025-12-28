import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { HEALTH_PROFESSIONS, CANADIAN_PROVINCES } from "@/lib/constants";

const registerSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
  profession: z.string().min(1, "La profession est requise"),
  customProfession: z.string().optional(),
  phone: z.string().min(10, "Numéro de téléphone invalide"),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "Vous devez accepter les conditions d'utilisation",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.profession === "Autre" && !data.customProfession) {
    return false;
  }
  return true;
}, {
  message: "Veuillez préciser votre profession",
  path: ["customProfession"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function ProRegister() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get plan from URL query params (?plan=free or ?plan=pro)
  const urlParams = new URLSearchParams(window.location.search);
  const selectedPlan = urlParams.get('plan') || 'free'; // Default to free

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      profession: "",
      customProfession: "",
      phone: "",
      acceptTerms: false,
    },
  });

  const selectedProfession = form.watch("profession");

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const { confirmPassword, customProfession, acceptTerms, profession, ...registerData } = data;
      // Use customProfession if profession is "Autre", otherwise use profession
      const finalProfession = profession === "Autre" ? customProfession : profession;
      // Only send required fields to backend
      const finalData = { 
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        professions: [finalProfession],
        planType: selectedPlan
      };
      const response = await apiRequest("POST", "/api/auth/register-professional", finalData);
      return await response.json();
    },
    onSuccess: (response: any) => {
      if (response.requiresVerification) {
        // Email verification required - redirect to verification pending page
        toast({
          title: "Inscription réussie !",
          description: "Vérifiez votre email pour activer votre compte.",
        });
        setLocation(`/verify-email-pending?email=${encodeURIComponent(response.email)}`);
      } else {
        // Auto-login (for legacy users or if verification is disabled)
        toast({
          title: "Inscription réussie !",
          description: "Bienvenue dans votre espace professionnel Gobering !",
        });
        setLocation("/dashboard");
      }
    },
    onError: (error: any) => {
      console.error("Registration error details:", error);
      toast({
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Bouton retour au-dessus de la boîte */}
        <Link href="/login-professionnel">
          <Button
            variant="outline"
            className="bg-white hover:bg-primary hover:text-white text-gray-900 border-gray-300 shadow-sm dark:bg-gray-800 dark:hover:bg-primary dark:text-white dark:border-gray-600"
            data-testid="button-back-login"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la connexion
          </Button>
        </Link>
        
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <UserPlus className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Inscription Professionnelle</CardTitle>
            <CardDescription className="text-center">
              Créez votre compte pour rejoindre Gobering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom</FormLabel>
                          <FormControl>
                            <Input placeholder="Jean" {...field} data-testid="input-firstName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom</FormLabel>
                          <FormControl>
                            <Input placeholder="Dupont" {...field} data-testid="input-lastName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email professionnel</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="j.dupont@exemple.ca" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmer le mot de passe</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} data-testid="input-confirmPassword" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="profession"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profession</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-profession">
                              <SelectValue placeholder="Sélectionnez votre profession" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HEALTH_PROFESSIONS.map((prof) => (
                              <SelectItem key={prof} value={prof}>
                                {prof}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedProfession === "Autre" && (
                    <FormField
                      control={form.control}
                      name="customProfession"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Précisez votre profession</FormLabel>
                          <FormControl>
                            <Input placeholder="Homéopathe" {...field} data-testid="input-customProfession" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="514-555-0000" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Message informatif */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Presque terminé !</strong> Vous pourrez compléter votre profil (adresse, description, etc.) après votre connexion dans <strong>Mon Profil</strong>.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/30">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-accept-terms"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          J'accepte les{" "}
                          <a
                            href="/cgu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                            data-testid="link-cgu"
                          >
                            Conditions Générales d'Utilisation
                          </a>
                          {" "}et la{" "}
                          <a
                            href="/confidentialite"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                            data-testid="link-privacy-policy"
                          >
                            Politique de Confidentialité
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-submit-register"
                >
                  {registerMutation.isPending ? "Inscription en cours..." : "Créer mon compte professionnel"}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Vous avez déjà un compte ?</span>
                  {" "}
                  <Link href="/login-professionnel" className="text-primary hover:underline font-medium" data-testid="link-login">
                    Se connecter
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
