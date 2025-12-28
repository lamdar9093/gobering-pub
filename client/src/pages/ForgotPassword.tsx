import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const requestResetMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest("POST", "/api/auth/request-password-reset", { email });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre boîte de réception pour réinitialiser votre mot de passe",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestResetMutation.mutate(email);
  };

  if (submitted) {
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
          <CardHeader className="space-y-3">
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Email envoyé</CardTitle>
            <CardDescription className="text-center leading-relaxed pt-2">
              Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation dans quelques instants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground text-center space-y-3">
              <p className="leading-relaxed">Vérifiez votre boîte de réception et vos spams.</p>
              <p className="leading-relaxed">Le lien sera valide pendant 1 heure.</p>
            </div>
            <Link href="/connexion-professionnel">
              <Button className="w-full" data-testid="button-back-to-login">
                Retour à la connexion
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
              <Mail className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Mot de passe oublié</CardTitle>
          <CardDescription className="text-center">
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe
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
            <Button
              type="submit"
              className="w-full"
              disabled={requestResetMutation.isPending}
              data-testid="button-submit"
            >
              {requestResetMutation.isPending ? "Envoi en cours..." : "Envoyer le lien de réinitialisation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
