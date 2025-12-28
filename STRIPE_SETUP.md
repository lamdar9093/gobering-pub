# Configuration Stripe pour la facturation par siège

## 🔑 Gestion des Environnements (NOUVEAU)

Le système détecte automatiquement l'environnement et utilise les clés appropriées :

### Développement (Test Mode)
Quand `REPLIT_DEPLOYMENT` n'est pas défini OU `NODE_ENV=development` :
- Utilise les variables avec préfixe `TESTING_*`
- Permet de tester sans affecter les données de production
- **Variables requises** :
  - `TESTING_STRIPE_SECRET_KEY` (commence par `sk_test_`)
  - `TESTING_VITE_STRIPE_PUBLIC_KEY` (commence par `pk_test_`)
  - `TESTING_STRIPE_PRO_PRICE_ID` (commence par `price_`)
  - `TESTING_STRIPE_ADDITIONAL_SEAT_PRICE_ID` (commence par `price_`)

### Production (Live Mode)
Quand `REPLIT_DEPLOYMENT=1` OU `NODE_ENV=production` :
- Utilise les variables sans préfixe
- Traite les vrais paiements clients
- **Variables requises** :
  - `STRIPE_SECRET_KEY` (commence par `sk_live_`)
  - `VITE_STRIPE_PUBLIC_KEY` (commence par `pk_live_`)
  - `STRIPE_PRO_PRICE_ID` (commence par `price_`)
  - `STRIPE_ADDITIONAL_SEAT_PRICE_ID` (commence par `price_`)

### Validation au Démarrage
Le système valide automatiquement :
- ✅ Présence de toutes les clés requises
- ✅ Format correct des clés (sk_, pk_, price_)
- ❌ L'application refusera de démarrer si une clé est manquante ou invalide

**Logs de validation** :
```
[STRIPE CONFIG] Environment: DEVELOPMENT
[STRIPE CONFIG] Using test Stripe keys
[STRIPE CONFIG] ✓ All required Stripe keys validated successfully
```

## ⚠️ IMPORTANT : Mise à jour requise

Les prix Stripe actuels doivent être **reconfigurés** pour supporter la facturation par quantité (quantity-based billing).

**Action requise** : 
1. Créez les prix dans Stripe TEST et LIVE (voir instructions ci-dessous)
2. Configurez les 8 variables d'environnement (4 TEST + 4 LIVE)
3. Les anciens prix ne supportent pas `quantity`, le système ne fonctionnera pas correctement sans cette mise à jour

## Vue d'ensemble

Gobering utilise un système de facturation par siège où :
- **Prix par siège** : 15$ CAD par professionnel par mois
- **Calcul du total** :
  - 1 professionnel = 15$ (prix minimum)
  - 2 professionnels = 30$
  - 3 professionnels = 45$
  - etc.

**Note** : Le prix affiché aux utilisateurs inclut un "prix de base" pour simplifier :
- Starter : "29$ + 15$ par siège additionnel" (en réalité : 15$/siège avec minimum)
- Pro : "39$ + 15$ par siège additionnel" (en réalité : 15$/siège avec minimum)

## Configuration requise dans Stripe

### 1. Créer les prix dans le Dashboard Stripe

#### Prix Starter (15$/siège/mois)
1. Allez dans **Products** → **Create product**
2. Nom : "Gobering Starter (par siège)"
3. Pricing model : **Standard pricing**
4. Prix : **15.00 CAD** (ou USD selon votre devise)
5. Billing period : **Monthly**
6. **Important** : Dans les paramètres avancés :
   - `recurring[usage_type]` = `licensed` (active le support de quantity)
7. Copiez le **Price ID** (commence par `price_...`)

#### Prix Pro (15$/siège/mois)
1. Répétez les mêmes étapes
2. Nom : "Gobering Pro (par siège)"
3. Prix : **15.00 CAD** (même prix, différent produit)
4. `recurring[usage_type]` = `licensed`
5. Copiez le **Price ID**

### 2. Configurer les variables d'environnement

Ajoutez ces secrets dans Replit pour **DÉVELOPPEMENT (TEST)** :

```bash
TESTING_STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx           # Clé secrète TEST
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx      # Clé publique TEST
TESTING_STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxx           # Price ID Pro TEST
TESTING_STRIPE_ADDITIONAL_SEAT_PRICE_ID=price_xxxxxxxxxxxxx  # Price ID Siège additionnel TEST
```

Ajoutez ces secrets dans Replit pour **PRODUCTION (LIVE)** :

```bash
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx                   # Clé secrète LIVE
VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx              # Clé publique LIVE
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxx                   # Price ID Pro LIVE
STRIPE_ADDITIONAL_SEAT_PRICE_ID=price_xxxxxxxxxxxxx       # Price ID Siège additionnel LIVE
```

**Note importante** : Vous devez créer les prix séparément dans Stripe TEST et LIVE, car ils auront des Price IDs différents.

### 3. Alternative : Configuration via API

Si vous préférez créer les prix programmatiquement :

```bash
# Créer le prix Starter
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_KEY: \
  -d "product"="prod_YOUR_PRODUCT_ID" \
  -d "unit_amount"=1500 \
  -d "currency"="cad" \
  -d "recurring[interval]"="month" \
  -d "recurring[usage_type]"="licensed"

# Créer le prix Pro  
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_KEY: \
  -d "product"="prod_YOUR_PRODUCT_ID" \
  -d "unit_amount"=1500 \
  -d "currency"="cad" \
  -d "recurring[interval]"="month" \
  -d "recurring[usage_type]"="licensed"
```

## Comment ça fonctionne

### Au checkout
- Le système compte automatiquement les membres de la clinique
- Passe `quantity: nombreDeMembres` à Stripe
- Stripe facture : `15$ × nombreDeMembres`

**Exemple** : Une clinique avec 3 professionnels sur le plan Pro :
- Checkout créé avec `quantity: 3`
- Stripe facture : `15$ × 3 = 45$/mois`

### Ajout/Suppression de membres

Quand un membre est ajouté ou supprimé :
1. La fonction `updateSubscriptionQuantity()` est appelée
2. Elle met à jour `subscription.items[0].quantity`
3. Stripe ajuste automatiquement la facturation au prorata

**Proration automatique** :
- **Ajout** : Facturation immédiate de la portion du mois restant
- **Suppression** : Crédit appliqué à la prochaine facture

## Webhooks Stripe

Configurez le webhook pour recevoir les événements :

**URL du webhook** : `https://votre-domaine.replit.app/api/webhooks/stripe`

**Événements à écouter** :
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Vérification

Pour vérifier que tout fonctionne :

1. **Testez le checkout** :
   - Créez une clinique avec 1 professionnel → Devrait facturer 15$
   - Créez une clinique avec 3 professionnels → Devrait facturer 45$

2. **Testez l'ajout de membre** :
   - Invitez un nouveau membre
   - Vérifiez dans Stripe que la quantity a augmenté
   - Vérifiez qu'une facture prorata a été créée

3. **Testez la suppression** :
   - Supprimez un membre
   - Vérifiez que la quantity a diminué
   - Vérifiez qu'un crédit a été appliqué

## Affichage des prix

Le système affiche les prix comme suit :
- **1 professionnel** : 29$ (Starter) ou 39$ (Pro)
- **2 professionnels** : 29$ + 15$ = 44$ (Starter) ou 39$ + 15$ = 54$ (Pro)
- **3 professionnels** : 29$ + 30$ = 59$ (Starter) ou 39$ + 30$ = 69$ (Pro)
- ...et ainsi de suite

**Formule** : `Prix de base + (nombre de membres actifs - 1) × 15$`

### Comptage des sièges

**Sièges comptés** :
- Membres actifs avec rôle Admin ou Professionnel
- Membres qui ont accepté leur invitation et rejoint la clinique

**Sièges NON comptés** :
- Rôle Secrétaire (ne compte jamais)
- Invitations en attente (non acceptées)
- Invitations expirées ou annulées

**Pourquoi les invitations en attente ne comptent pas** :
1. Stripe facture les sièges utilisés, pas les invitations
2. Les invitations peuvent être refusées ou expirer
3. Transparence : le badge affiche le coût réel actuel

**Mise à jour automatique** :
- Quand un membre accepte une invitation → la quantité Stripe est automatiquement mise à jour
- Quand un membre est supprimé → la quantité Stripe diminue automatiquement

## Support

En cas de problème :
1. Vérifiez que `recurring[usage_type]=licensed` est bien configuré
2. Vérifiez les logs du webhook dans Stripe Dashboard
3. Consultez les logs de l'application pour voir les appels à `updateSubscriptionQuantity()`
