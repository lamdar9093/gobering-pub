import { useState, useEffect } from "react";
import { useLocation, Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const [, params] = useRoute("/reset-password/:token");
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const token = params?.token;

  useEffect(() => {
    if (!token) {
      toast({
        title: "Lien invalide",
        description: "Le lien de réinitialisation est invalide ou a expiré",
        variant: "destructive",
      });
      setLocation("/connexion-professionnel");
    }
  }, [token, setLocation, toast]);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      return await apiRequest("POST", "/api/auth/reset-password", data);
    },
    onSuccess: () => {
      setSuccess(true);
      toast({
        title: "Mot de passe modifié",
        description: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Le lien est invalide ou a expiré",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive",
      });
      return;
    }

    if (token) {
      resetPasswordMutation.mutate({ token, newPassword: password });
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Link href="/connexion-professionnel">
          <Button
            variant="ghost"
            className="absolute top-4 left-4"
            data-testid="button-back-login"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la connexion
          </Button>
        </Link>
        
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Mot de passe modifié</CardTitle>
            <CardDescription className="text-center">
              Votre mot de passe a été réinitialisé avec succès
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            </div>
            <Link href="/connexion-professionnel">
              <Button className="w-full" data-testid="button-go-to-login">
                Se connecter
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Link href="/connexion-professionnel">
        <Button
          variant="ghost"
          className="absolute top-4 left-4"
          data-testid="button-back-login"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la connexion
        </Button>
      </Link>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Nouveau mot de passe</CardTitle>
          <CardDescription className="text-center">
            Choisissez un nouveau mot de passe pour votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                  data-testid="input-password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={resetPasswordMutation.isPending}
              data-testid="button-submit"
            >
              {resetPasswordMutation.isPending ? "Modification en cours..." : "Réinitialiser le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
