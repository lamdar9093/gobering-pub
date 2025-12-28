import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyEmailPending() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Get email from URL query params (?email=...)
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email') || '';

  const [resendSuccess, setResendSuccess] = useState(false);

  const resendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/resend-verification", { email });
    },
    onSuccess: () => {
      setResendSuccess(true);
      toast({
        title: "Email renvoyé !",
        description: "Un nouveau lien de vérification a été envoyé à votre adresse email.",
      });
      // Reset success state after 5 seconds
      setTimeout(() => setResendSuccess(false), 5000);
    },
    onError: (error: any) => {
      if (error.code === 'ALREADY_VERIFIED') {
        toast({
          title: "Email déjà vérifié",
          description: "Vous pouvez vous connecter à votre compte.",
        });
        setLocation("/connexion-professionnel");
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de renvoyer l'email de vérification",
          variant: "destructive",
        });
      }
    },
  });

  const handleResend = () => {
    resendMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary" data-testid="icon-mail" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-title">
            Vérifiez votre adresse email
          </CardTitle>
          <CardDescription className="text-base" data-testid="text-description">
            Nous avons envoyé un lien de vérification à{" "}
            <strong className="text-gray-900 dark:text-white">{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Prochaines étapes :</strong>
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
              <li>Ouvrez votre boîte de réception</li>
              <li>Cliquez sur le lien dans l'email de Gobering</li>
              <li>Votre compte sera activé et vous pourrez vous connecter</li>
            </ol>
          </div>

          {resendSuccess && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-3" data-testid="alert-resend-success">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Email de vérification renvoyé avec succès !
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Vous n'avez pas reçu l'email ?
            </p>
            <Button
              onClick={handleResend}
              disabled={resendMutation.isPending || resendSuccess}
              variant="outline"
              className="w-full"
              data-testid="button-resend-email"
            >
              {resendMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Renvoyer l'email de vérification
                </>
              )}
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Besoin d'aide ? Contactez-nous à{" "}
              <a
                href="mailto:operations@gobering.com"
                className="text-primary hover:underline"
              >
                operations@gobering.com
              </a>
            </p>
          </div>

          <div className="text-center">
            <Link href="/connexion-professionnel">
              <Button variant="ghost" className="text-sm" data-testid="link-back-login">
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
