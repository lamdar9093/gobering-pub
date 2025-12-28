import React, { useState } from 'react';
import { CreditCard, Check, Calendar, Download, ChevronRight, AlertCircle, Crown, Zap } from 'lucide-react';

export default function SubscriptionPage() {
  const [currentPlan, setCurrentPlan] = useState('pro');
  const [showChangePlan, setShowChangePlan] = useState(false);

  // Données d'exemple (à remplacer par tes vraies données)
  const subscription = {
    plan: 'pro',
    status: 'trial',
    trialEndDate: '7 novembre 2025',
    nextBillingDate: '7 novembre 2025',
    amount: 39,
    professionals: 1,
    costPerSeat: 15,
    paymentMethod: {
      type: 'visa',
      last4: '4242',
      expiryMonth: '12',
      expiryYear: '2026'
    }
  };

  const invoices = [
    { id: '1', date: '1 Oct 2025', amount: 39, status: 'paid', invoiceNumber: 'INV-001' },
    { id: '2', date: '1 Sep 2025', amount: 39, status: 'paid', invoiceNumber: 'INV-002' },
    { id: '3', date: '1 Aoû 2025', amount: 39, status: 'paid', invoiceNumber: 'INV-003' },
  ];

  const plans = [
    {
      id: 'starter',
      name: 'Plan Starter',
      price: 29,
      features: [
        'Jusqu\'à 100 rendez-vous/mois',
        '1 professionnel',
        'Calendrier de base',
        'Support par email',
        'Rappels SMS de base'
      ],
      color: 'from-blue-400 to-blue-600'
    },
    {
      id: 'pro',
      name: 'Plan Pro',
      price: 39,
      popular: true,
      features: [
        'Rendez-vous illimités',
        'Services illimités',
        'Multi-professionnels',
        'Support prioritaire',
        'Widgets personnalisables',
        'Rappels SMS avancés',
        'Statistiques détaillées'
      ],
      color: 'from-indigo-500 to-blue-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Abonnement</h1>
          <p className="text-slate-600 mt-2">Gérez votre plan et votre facturation</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Colonne principale - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Plan actuel */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Crown className="w-6 h-6" />
                      <h2 className="text-2xl font-bold">Plan Pro</h2>
                    </div>
                    <p className="text-blue-100">Votre abonnement actuel</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-sm font-semibold">Essai gratuit</span>
                  </div>
                </div>
                
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-bold">{subscription.amount}$</span>
                  <span className="text-blue-100">/mois</span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Période d'essai */}
                {subscription.status === 'trial' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900">Période d'essai en cours</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Votre essai se termine le <span className="font-semibold">{subscription.trialEndDate}</span>. 
                        Votre première facturation débutera après cette date.
                      </p>
                    </div>
                  </div>
                )}

                {/* Stats rapides */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-900">∞</p>
                    <p className="text-sm text-slate-600 mt-1">Rendez-vous</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-900">∞</p>
                    <p className="text-sm text-slate-600 mt-1">Services</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-2xl font-bold text-slate-900">{subscription.professionals}</p>
                    <p className="text-sm text-slate-600 mt-1">Widget</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowChangePlan(!showChangePlan)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Changer de plan
                  </button>
                  <button className="px-6 py-3 border-2 border-slate-200 hover:border-slate-300 rounded-xl font-semibold text-slate-700 transition-all">
                    Annuler l'abonnement
                  </button>
                </div>
              </div>
            </div>

            {/* Comparaison des plans */}
            {showChangePlan && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Choisissez votre plan</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id}
                      className={`relative rounded-2xl border-2 p-6 transition-all ${
                        plan.popular 
                          ? 'border-blue-500 shadow-lg shadow-blue-100' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                            POPULAIRE
                          </span>
                        </div>
                      )}
                      
                      <div className="text-center mb-6">
                        <h4 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h4>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-slate-900">{plan.price}$</span>
                          <span className="text-slate-600">/mois</span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button 
                        className={`w-full py-3 rounded-xl font-semibold transition-all ${
                          currentPlan === plan.id
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : plan.popular
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
                              : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                        }`}
                        disabled={currentPlan === plan.id}
                      >
                        {currentPlan === plan.id ? 'Plan actuel' : 'Choisir ce plan'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Facturation par siège */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Facturation par professionnel</h3>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-slate-600">Professionnels actifs dans votre clinique</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{subscription.professionals}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Coût par professionnel</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{subscription.costPerSeat}$</p>
                  </div>
                </div>
                <div className="border-t border-blue-200 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Calcul: Prix de base ({subscription.amount - subscription.professionals * subscription.costPerSeat}$) + {subscription.professionals} × {subscription.costPerSeat}$</span>
                    <span className="text-2xl font-bold text-slate-900">{subscription.amount}$/mois</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Le coût augmente automatiquement de {subscription.costPerSeat}$/mois par professionnel additionnel ajouté.
              </p>
            </div>

            {/* Historique des factures */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Historique de facturation</h3>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-slate-600">{invoice.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{invoice.amount}$</p>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Payé
                        </span>
                      </div>
                      <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
                        <Download className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - 1/3 */}
          <div className="space-y-6">
            
            {/* Méthode de paiement */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Moyen de paiement</h3>
              
              {subscription.paymentMethod ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
                    <div className="flex items-start justify-between mb-8">
                      <CreditCard className="w-8 h-8" />
                      <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">
                        {subscription.paymentMethod.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="font-mono text-lg">•••• •••• •••• {subscription.paymentMethod.last4}</p>
                      <p className="text-sm text-slate-400">
                        Expire {subscription.paymentMethod.expiryMonth}/{subscription.paymentMethod.expiryYear}
                      </p>
                    </div>
                  </div>
                  
                  <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Modifier la carte
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 text-sm mb-4">Aucune carte enregistrée</p>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-semibold transition-all">
                    Ajouter une carte
                  </button>
                </div>
              )}
            </div>

            {/* Prochaine facturation */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-slate-900">Prochaine facturation</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">{subscription.nextBillingDate}</p>
              <p className="text-sm text-slate-600">
                Montant: <span className="font-semibold text-blue-600">{subscription.amount}$</span>
              </p>
            </div>

            {/* Support */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-3">Besoin d'aide?</h3>
              <p className="text-sm text-slate-600 mb-4">
                Notre équipe est là pour vous aider avec toutes vos questions sur la facturation.
              </p>
              <button className="w-full bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                Contacter le support
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}