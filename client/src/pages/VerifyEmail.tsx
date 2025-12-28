import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('Token de vérification manquant');
        return;
      }

      try {
        const response = await fetch(`/api/verify-email/${token}`, {
          method: 'GET',
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          toast({
            title: "Email vérifié !",
            description: "Votre compte a été activé avec succès.",
          });
          // Redirect to login after 3 seconds
          setTimeout(() => {
            setLocation("/connexion-professionnel");
          }, 3000);
        } else {
          if (data.code === 'TOKEN_EXPIRED') {
            setStatus('expired');
            setUserEmail(data.email || '');
            setErrorMessage(data.error || 'Ce lien de vérification a expiré');
          } else {
            setStatus('error');
            setErrorMessage(data.error || 'Erreur lors de la vérification');
          }
          toast({
            title: "Erreur de vérification",
            description: data.error,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setErrorMessage('Erreur de connexion au serveur');
        toast({
          title: "Erreur",
          description: "Impossible de vérifier l'email pour le moment",
          variant: "destructive",
        });
      }
    };

    verifyEmail();
  }, [token, toast, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            {status === 'loading' && (
              <Loader2 className="h-8 w-8 text-primary animate-spin" data-testid="icon-loading" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" data-testid="icon-success" />
            )}
            {(status === 'error' || status === 'expired') && (
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" data-testid="icon-error" />
            )}
          </div>
          
          <CardTitle className="text-2xl" data-testid="text-title">
            {status === 'loading' && "Vérification en cours..."}
            {status === 'success' && "Email vérifié !"}
            {status === 'expired' && "Lien expiré"}
            {status === 'error' && "Erreur de vérification"}
          </CardTitle>
          
          {status === 'success' && (
            <CardDescription data-testid="text-description-success">
              Votre adresse email a été vérifiée avec succès. Vous allez être redirigé vers la page de connexion.
            </CardDescription>
          )}
          {status === 'expired' && (
            <CardDescription data-testid="text-description-expired">
              {errorMessage}
            </CardDescription>
          )}
          {status === 'error' && (
            <CardDescription data-testid="text-description-error">
              {errorMessage}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-700 dark:text-green-300 text-center">
                ✨ Bienvenue chez Gobering ! Vous pouvez maintenant vous connecter à votre compte professionnel.
              </p>
            </div>
          )}

          {status === 'expired' && userEmail && (
            <div className="space-y-3">
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
                  Votre lien de vérification a expiré. Demandez un nouveau lien pour continuer.
                </p>
              </div>
              <Link href={`/verify-email-pending?email=${encodeURIComponent(userEmail)}`}>
                <Button className="w-full" data-testid="button-request-new-link">
                  <Mail className="h-4 w-4 mr-2" />
                  Demander un nouveau lien
                </Button>
              </Link>
            </div>
          )}

          <div className="text-center pt-4">
            <Link href="/connexion-professionnel">
              <Button variant="ghost" className="text-sm" data-testid="link-back-login">
                {status === 'success' ? 'Se connecter maintenant' : 'Retour à la connexion'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
