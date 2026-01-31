# 🐳 Déploiement Docker - Gobering

Guide complet pour déployer Gobering dans un environnement containerisé avec Docker.

## 📋 Prérequis

- **Docker** version 20.10 ou supérieure
- **Docker Compose** version 2.0 ou supérieure
- **Au moins 2GB de RAM** disponible
- **Ports disponibles**: 5000 (app), 5432 (PostgreSQL), 8080 (pgAdmin optionnel)

## 🚀 Démarrage Rapide

### 1. Configuration des variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier .env avec vos valeurs
nano .env  # ou vim, code, etc.
```

**Variables essentielles à modifier:**
- `POSTGRES_PASSWORD` - Mot de passe sécurisé pour PostgreSQL
- `SESSION_SECRET` - Clé secrète pour les sessions (32+ caractères)
- `RESEND_API_KEY` - Clé API Resend pour l'envoi d'emails
- `APP_URL` - URL de votre application en production
- `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLIC_KEY` - Clés API Stripe pour les paiements
- `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID` - IDs des prix Stripe
- `STRIPE_WEBHOOK_SECRET` - Secret pour vérifier les webhooks Stripe
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Credentials Twilio pour les SMS

### 2. Lancer l'application

```bash
# Construire et démarrer tous les services
docker-compose up -d --build

# Vérifier les logs
docker-compose logs -f app

# Vérifier le statut
docker-compose ps
```

**Important:** Assurez-vous que `VITE_STRIPE_PUBLIC_KEY` est défini dans votre `.env` **avant** de construire l'image, car cette variable est nécessaire lors de la compilation du frontend.

L'application sera accessible sur **http://localhost:5000**

### 3. Initialiser la base de données

Les migrations Drizzle se font automatiquement au démarrage. Si vous devez les forcer:

```bash
# Exécuter les migrations manuellement
docker-compose exec app npm run db:push
```

## 📁 Structure des services

### Services principaux

- **app** - Application Gobering (Node.js + Express + React)
- **postgres** - Base de données PostgreSQL 16
- **pgadmin** - Interface de gestion PostgreSQL (optionnel)

### Volumes persistants

- `postgres_data` - Données de la base de données
- `uploads` - Fichiers uploadés par les utilisateurs
- `pgadmin_data` - Configuration pgAdmin

## 🔧 Commandes utiles

### Gestion des conteneurs

```bash
# Démarrer les services
docker-compose up -d

# Arrêter les services
docker-compose down

# Redémarrer un service
docker-compose restart app

# Voir les logs en temps réel
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f app
docker-compose logs -f postgres
```

### Accès aux conteneurs

```bash
# Accéder au shell de l'application
docker-compose exec app sh

# Accéder à PostgreSQL
docker-compose exec postgres psql -U gobering -d gobering

# Exécuter une commande npm
docker-compose exec app npm run db:push
```

### Sauvegarde et restauration

```bash
# Sauvegarder la base de données
docker-compose exec postgres pg_dump -U gobering gobering > backup.sql

# Restaurer depuis une sauvegarde
docker-compose exec -T postgres psql -U gobering -d gobering < backup.sql

# Sauvegarder les volumes
docker run --rm -v gobering_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

## 🛠️ Utiliser pgAdmin (optionnel)

Pour lancer pgAdmin avec les autres services:

```bash
# Lancer avec le profile tools
docker-compose --profile tools up -d

# Accéder à pgAdmin
# URL: http://localhost:8080
# Email: admin@gobering.local (voir .env)
# Password: admin (voir .env)
```

**Connexion à la base de données dans pgAdmin:**
- Host: `postgres`
- Port: `5432`
- Database: `gobering`
- Username: `gobering`
- Password: (voir POSTGRES_PASSWORD dans .env)

## 🔒 Sécurité en production

### Bonnes pratiques

1. **Variables d'environnement sensibles**
   ```bash
   # Générer un SESSION_SECRET sécurisé
   openssl rand -base64 32
   
   # Générer un mot de passe PostgreSQL fort
   openssl rand -base64 24
   ```

2. **Firewall et ports**
   - N'exposez que le port 5000 publiquement
   - Fermez les ports 5432 et 8080 au public
   - Utilisez un reverse proxy (Nginx/Traefik) avec SSL

3. **Volumes et backups**
   - Sauvegardez régulièrement `postgres_data`
   - Configurez des snapshots automatiques
   - Testez vos restaurations

4. **Mises à jour**
   ```bash
   # Mettre à jour les images
   docker-compose pull
   
   # Reconstruire l'application
   docker-compose build --no-cache
   
   # Redémarrer avec les nouvelles images
   docker-compose up -d
   ```

## 🌐 Déploiement en production

### Avec reverse proxy (Nginx)

```nginx
# /etc/nginx/sites-available/gobering
server {
    listen 80;
    server_name votre-domaine.com;
    
    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;
    
    # Certificats SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;
    
    # Proxy vers Docker
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Avec Traefik (recommandé)

```yaml
# docker-compose.prod.yml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gobering.rule=Host(`votre-domaine.com`)"
      - "traefik.http.routers.gobering.entrypoints=websecure"
      - "traefik.http.routers.gobering.tls.certresolver=letsencrypt"
```

### Variables d'environnement production

```bash
# .env (production)
NODE_ENV=production
APP_URL=https://votre-domaine.com
SESSION_SECRET=votre-cle-secrete-ultra-securisee-32-caracteres
POSTGRES_PASSWORD=mot-de-passe-postgres-ultra-securise

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_STARTER_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 📊 Monitoring et santé

### Health checks

L'application expose un endpoint de santé:

```bash
# Vérifier la santé de l'app
curl http://localhost:5000/api/health

# Vérifier avec Docker
docker-compose ps
# ✔ Healthy = tout fonctionne
```

### Logs et debugging

```bash
# Logs détaillés
docker-compose logs -f --tail=100 app

# Erreurs uniquement
docker-compose logs app | grep ERROR

# Suivre les requêtes
docker-compose logs -f app | grep "GET\|POST"
```

## 🐛 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs
docker-compose logs app

# Vérifier la connexion à la base
docker-compose exec app node -e "require('pg').Client({connectionString: process.env.DATABASE_URL}).connect().then(() => console.log('✓ DB OK')).catch(e => console.error('✗ DB Error:', e))"

# Reconstruire complètement
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Les emails ne sont pas envoyés (Resend)

```bash
# Vérifier que la clé API est correcte
docker-compose exec app env | grep RESEND

# Vérifier les logs pour les erreurs Resend
docker-compose logs app | grep -i resend
```

**Points à vérifier:**
- Votre domaine est vérifié sur [resend.com](https://resend.com)
- La clé API commence par `re_`
- Vous n'êtes pas en mode sandbox (limitait à votre email uniquement)

### Les SMS Twilio ne fonctionnent pas

```bash
# Vérifier les credentials Twilio
docker-compose exec app env | grep TWILIO

# Vérifier les logs pour les erreurs Twilio
docker-compose logs app | grep -i twilio
```

**Points à vérifier:**
- Votre numéro est au format international (+1234567890)
- Votre compte Twilio est actif et a des crédits
- Les permissions d'envoi de SMS sont activées

### Les paiements Stripe échouent

```bash
# Vérifier les clés Stripe
docker-compose exec app env | grep STRIPE

# Tester le webhook localement
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

**Points à vérifier:**
- Utilisez `sk_test_...` pour le développement, `sk_live_...` pour la production
- Les `PRICE_ID` correspondent aux prix créés dans votre dashboard Stripe
- Le webhook est configuré sur `https://votre-domaine.com/api/webhooks/stripe`
- Le `WEBHOOK_SECRET` correspond à celui de votre webhook Stripe

### Erreurs de base de données

```bash
# Réinitialiser la base (⚠️ perte de données)
docker-compose down -v
docker volume rm gobering_postgres_data
docker-compose up -d

# Forcer les migrations
docker-compose exec app npm run db:push
```

### Port déjà utilisé

```bash
# Trouver le processus utilisant le port 5000
lsof -i :5000
# ou
netstat -tulpn | grep 5000

# Changer le port dans .env
APP_PORT=5001
```

## 🔄 Mise à jour de l'application

```bash
# 1. Récupérer les dernières modifications
git pull origin main

# 2. Reconstruire l'image (important: --build pour passer les variables de build)
docker-compose build --no-cache app

# 3. Redémarrer avec la nouvelle version
docker-compose up -d app

# 4. Vérifier les logs
docker-compose logs -f app
```

**Note:** Si vous modifiez `VITE_STRIPE_PUBLIC_KEY` dans votre `.env`, vous devez reconstruire l'image avec `--build` pour que le frontend soit recompilé avec la nouvelle clé.

## 📞 Support

Pour toute question ou problème:
- Consultez les logs: `docker-compose logs`
- Vérifiez les variables d'environnement dans `.env`
- Assurez-vous que tous les ports requis sont disponibles
- Vérifiez que Docker dispose de suffisamment de ressources

---

**Note**: Ce guide suppose une installation sur Linux/macOS. Pour Windows, utilisez WSL2 ou adaptez les commandes en conséquence.
