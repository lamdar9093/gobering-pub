import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Lock, Mail, ArrowLeft, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ProLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return await response.json();
    },
    onSuccess: async (data) => {
      // Clear and prefetch /api/auth/me to ensure fresh professional data is loaded
      // This prevents stale hasCompletedOnboarding values from triggering the tour incorrectly
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.prefetchQuery({ 
        queryKey: ["/api/auth/me"],
        staleTime: 0 
      });
      
      if (data.requirePasswordChange) {
        setShowPasswordChangeModal(true);
      } else {
        toast({
          title: "Connexion réussie",
          description: "Bienvenue dans votre espace professionnel",
        });
        setLocation("/dashboard");
      }
    },
    onError: (error: any) => {
      // Check if email is unverified
      if (error.status === 'unverified' || error.code === 'EMAIL_NOT_VERIFIED') {
        toast({
          title: "Email non vérifié",
          description: "Veuillez vérifier votre adresse email pour vous connecter",
          variant: "destructive",
        });
        // Redirect to verification pending page with email
        if (error.email) {
          setLocation(`/verify-email-pending?email=${encodeURIComponent(error.email)}`);
        }
      } else {
        toast({
          title: "Erreur de connexion",
          description: error.message || "Email ou mot de passe incorrect",
          variant: "destructive",
        });
      }
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (newPasswordData: { newPassword: string }) => {
      const response = await apiRequest("PATCH", "/api/auth/first-login-password", newPasswordData);
      return await response.json();
    },
    onSuccess: async () => {
      // Clear and prefetch /api/auth/me to ensure fresh professional data is loaded
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.prefetchQuery({ 
        queryKey: ["/api/auth/me"],
        staleTime: 0 
      });
      
      toast({
        title: "Mot de passe changé",
        description: "Votre mot de passe a été changé avec succès. Bienvenue!",
      });
      setShowPasswordChangeModal(false);
      setNewPassword("");
      setConfirmPassword("");
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de changer le mot de passe",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Mots de passe différents",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({ newPassword });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Bouton retour au-dessus de la boîte */}
        <Link href="/">
          <Button
            variant="outline"
            className="bg-white hover:bg-primary hover:text-white text-gray-900 border-gray-300 shadow-sm dark:bg-gray-800 dark:hover:bg-primary dark:text-white dark:border-gray-600"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Link>
        
        <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <UserCircle className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Espace Professionnel</CardTitle>
          <CardDescription className="text-center">
            Connectez-vous pour accéder à votre tableau de bord
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email professionnel</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="j.dupont@exemple.ca"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-submit-login"
            >
              {loginMutation.isPending ? "Connexion..." : "Se connecter"}
            </Button>

            <div className="mt-3 text-center text-sm">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline" data-testid="link-forgot-password">
                Mot de passe oublié ?
              </Link>
            </div>
            
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Pas encore de compte professionnel ?</span>
              {" "}
              <Link href="/pricing" className="text-primary hover:underline font-medium" data-testid="link-register">
                M'enregistrer
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>

      {/* Password Change Modal */}
      <Dialog open={showPasswordChangeModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-md p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <DialogTitle className="text-center">Changement de mot de passe requis</DialogTitle>
            <DialogDescription className="text-center">
              Vous devez changer votre mot de passe temporaire avant de continuer. Choisissez un mot de passe sécurisé d'au moins 6 caractères.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNewPassword ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}
                  aria-pressed={showNewPassword}
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? "Masquer la confirmation du mot de passe" : "Afficher la confirmation du mot de passe"}
                  aria-pressed={showConfirmPassword}
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Changement..." : "Changer le mot de passe"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
