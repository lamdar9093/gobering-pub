import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error details for developer (visible in console)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Send error notification to operations team
    this.notifyOperationsTeam(error, errorInfo);
  }

  notifyOperationsTeam = async (error: Error, errorInfo: any) => {
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorMessage: error.message,
          errorStack: error.stack,
          path: window.location.pathname,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (err) {
      // Silently fail - we don't want error logging to crash the app
      console.error('Failed to notify operations team:', err);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl">Une erreur s'est produite</CardTitle>
              <CardDescription>
                Nous sommes désolés pour ce désagrément. Notre équipe a été notifiée et travaille à résoudre le problème.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {import.meta.env.DEV && this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs">
                  <p className="font-semibold text-red-800 mb-1">Détails de l'erreur (visible en développement uniquement) :</p>
                  <p className="text-red-700 font-mono">{this.state.error.message}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  onClick={this.handleReload} 
                  className="flex-1"
                  data-testid="button-reload-page"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recharger la page
                </Button>
                <Button 
                  onClick={this.handleGoHome} 
                  variant="outline"
                  className="flex-1"
                  data-testid="button-go-home"
                >
                  Retour à l'accueil
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
