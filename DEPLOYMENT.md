# Déploiement Gobering sur VPS

Guide complet pour migrer Gobering de Replit vers un VPS avec Docker.

## Prérequis VPS

- Ubuntu 22.04+ ou Debian 12+
- Docker 24+ et Docker Compose v2
- 2 GB RAM minimum (4 GB recommandé)
- 20 GB stockage
- Ports 80, 443, 5000 ouverts

## Étape 1 : Préparer le VPS

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Se reconnecter pour appliquer les groupes
exit
# Reconnectez-vous en SSH

# Créer le répertoire de l'application
sudo mkdir -p /opt/gobering
sudo chown $USER:$USER /opt/gobering
cd /opt/gobering
```

## Étape 2 : Exporter les données de Replit

Dans la console Replit, exécutez :

```bash
# Rendre le script exécutable
chmod +x scripts/export-database.sh

# Exporter la base de données
./scripts/export-database.sh
```

Téléchargez le fichier `backups/gobering_backup_XXXXXX.sql.gz`.

## Étape 3 : Transférer les fichiers sur le VPS

Depuis votre machine locale :

```bash
# Cloner le repo (ou transférer les fichiers)
cd /opt/gobering
git clone https://github.com/VOTRE-USERNAME/gobering.git .

# Transférer le backup de la base de données
scp gobering_backup_XXXXXX.sql.gz user@votre-vps:/opt/gobering/backups/
```

## Étape 4 : Configurer l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer avec vos vraies valeurs
nano .env
```

**Variables OBLIGATOIRES à modifier :**

```bash
# Mot de passe PostgreSQL (générez-en un fort)
POSTGRES_PASSWORD=VotreSuperMotDePasse123!

# Secret de session (générez-le avec: openssl rand -base64 32)
SESSION_SECRET=votre-secret-genere-ici

# URL de production
APP_URL=https://gobering.com

# Clés Stripe PRODUCTION (pas les clés test!)
STRIPE_SECRET_KEY=sk_live_xxxxx
VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_ADDITIONAL_SEAT_PRICE_ID=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Autres services
RESEND_API_KEY=re_xxxxx
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1xxxxx
OPENAI_API_KEY=sk-xxxxx
OPERATIONS_EMAIL=operations@gobering.com
```

## Étape 5 : Démarrer PostgreSQL et importer les données

```bash
# Démarrer uniquement PostgreSQL
docker compose up -d postgres

# Attendre qu'il soit prêt (environ 10 secondes)
sleep 10

# Importer les données de Replit
chmod +x scripts/import-database.sh
./scripts/import-database.sh backups/gobering_backup_XXXXXX.sql.gz
```

## Étape 6 : Construire et lancer l'application

```bash
# Construire et démarrer tout
docker compose up -d --build

# Vérifier le statut
docker compose ps

# Voir les logs
docker compose logs -f app
```

L'application sera accessible sur `http://VOTRE-IP:5000`.

## Étape 7 : Configurer HTTPS avec Nginx

Installez Nginx comme reverse proxy :

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Créer la configuration
sudo nano /etc/nginx/sites-available/gobering
```

Contenu du fichier :

```nginx
server {
    listen 80;
    server_name gobering.com www.gobering.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts pour les uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Taille max des uploads (photos profil)
        client_max_body_size 10M;
    }
}
```

Activer et obtenir le certificat SSL :

```bash
sudo ln -s /etc/nginx/sites-available/gobering /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtenir le certificat SSL
sudo certbot --nginx -d gobering.com -d www.gobering.com
```

## Étape 8 : Configurer le Webhook Stripe

Dans le [dashboard Stripe](https://dashboard.stripe.com/webhooks) :

1. Ajoutez un nouveau endpoint : `https://gobering.com/api/webhooks/stripe`
2. Sélectionnez les événements :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
3. Copiez le "Signing secret" dans votre `.env` comme `STRIPE_WEBHOOK_SECRET`
4. Redémarrez l'app : `docker compose restart app`

## Étape 9 : Configurer GitHub Actions (CI/CD automatique)

### Secrets GitHub requis

Dans votre repo GitHub > Settings > Secrets and variables > Actions :

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Adresse IP ou domaine de votre VPS |
| `VPS_USER` | Utilisateur SSH (ex: `ubuntu`) |
| `VPS_SSH_KEY` | Clé SSH privée pour se connecter |
| `VPS_PORT` | Port SSH (ex: `22`) |
| `GH_PAT` | Personal Access Token GitHub avec permission `read:packages` |
| `VITE_STRIPE_PUBLIC_KEY` | Clé publique Stripe pour le build |

### Générer une clé SSH pour GitHub Actions

```bash
# Sur le VPS, générer une nouvelle clé
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Ajouter la clé publique aux authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Copier la clé PRIVÉE (à mettre dans VPS_SSH_KEY sur GitHub)
cat ~/.ssh/github_actions
```

### Workflow automatique

Chaque push sur `main` déclenchera :
1. Build de l'image Docker
2. Push vers GitHub Container Registry
3. Pull et redémarrage sur le VPS

## Commandes utiles

```bash
# Voir les logs en temps réel
docker compose logs -f app

# Redémarrer l'application
docker compose restart app

# Reconstruire après modification du code
docker compose up -d --build app

# Voir l'état des containers
docker compose ps

# Backup manuel de la base de données
docker compose exec postgres pg_dump -U gobering gobering > backup_$(date +%Y%m%d).sql

# Accéder au shell PostgreSQL
docker compose exec postgres psql -U gobering gobering

# Lancer pgAdmin (interface web pour la DB)
docker compose --profile tools up -d pgadmin
# Accessible sur http://VOTRE-IP:8080
```

## Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs
docker compose logs app

# Vérifier que PostgreSQL est accessible
docker compose exec app node -e "console.log(process.env.DATABASE_URL)"
```

### Problèmes de connexion à la base de données

```bash
# Vérifier que PostgreSQL est prêt
docker compose exec postgres pg_isready

# Tester la connexion
docker compose exec postgres psql -U gobering -c "SELECT 1"
```

### Erreur de migration Drizzle

```bash
# Exécuter la migration manuellement
docker compose exec app npm run db:push
```

### Port 5000 déjà utilisé

```bash
# Voir ce qui utilise le port
sudo lsof -i :5000

# Changer le port dans .env
APP_PORT=5001
```

## Maintenance

### Mises à jour

```bash
cd /opt/gobering
git pull
docker compose up -d --build app
```

### Sauvegardes automatiques (recommandé)

Créez un cron job pour les backups quotidiens :

```bash
crontab -e
```

Ajoutez :

```
0 3 * * * cd /opt/gobering && docker compose exec -T postgres pg_dump -U gobering gobering | gzip > /opt/gobering/backups/daily_$(date +\%Y\%m\%d).sql.gz
```

### Nettoyage des anciennes images Docker

```bash
# Supprimer les images non utilisées
docker image prune -a -f
```
