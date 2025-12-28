# 🔧 Migration : Vérification d'email pour utilisateurs existants

## 📋 Contexte

Le système de vérification d'email a été ajouté récemment. Tous les **nouveaux utilisateurs** doivent vérifier leur email avant de se connecter.

**Problème :** Les utilisateurs existants (créés avant cette mise à jour) ont `emailVerified = false` et ne peuvent plus se connecter.

**Solution :** Ce script marque tous les utilisateurs existants comme vérifiés automatiquement.

---

## ✅ Exécution du script en PRODUCTION

### Étape 1 : Accéder à la base de données de production

1. Ouvrez votre projet Replit
2. Cliquez sur **"Database"** dans le panneau latéral gauche
3. Sélectionnez votre **base de données de production** dans les paramètres
4. Cliquez sur **"SQL Runner"**

### Étape 2 : Copier et exécuter le script

Copiez et collez le script SQL suivant dans le SQL Runner :

```sql
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    -- Mettre à jour tous les utilisateurs qui ne sont PAS encore vérifiés
    UPDATE users
    SET 
        email_verified = true,
        verification_method = 'migrated',
        verification_token = NULL,
        verification_token_expires_at = NULL
    WHERE email_verified = false;
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Migration terminée : % utilisateurs marqués comme vérifiés', affected_count;
    
    -- Afficher un résumé
    RAISE NOTICE '';
    RAISE NOTICE '📊 Résumé de la migration :';
    RAISE NOTICE '- Utilisateurs migrés (verification_method=migrated) : %', 
        (SELECT COUNT(*) FROM users WHERE verification_method = 'migrated');
    RAISE NOTICE '- Utilisateurs vérifiés par email : %', 
        (SELECT COUNT(*) FROM users WHERE verification_method = 'email');
    RAISE NOTICE '- Total utilisateurs vérifiés : %', 
        (SELECT COUNT(*) FROM users WHERE email_verified = true);
    RAISE NOTICE '- Utilisateurs non vérifiés : %', 
        (SELECT COUNT(*) FROM users WHERE email_verified = false);
    
END $$;
```

### Étape 3 : Cliquer sur "Execute"

Le script affichera un résumé de la migration :
- Nombre d'utilisateurs migrés
- Total d'utilisateurs vérifiés
- Utilisateurs non vérifiés restants (devrait être 0 pour les anciens comptes)

---

## 🔍 Vérification post-migration

Exécutez cette requête pour vérifier que tout s'est bien passé :

```sql
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN email_verified = true THEN 1 ELSE 0 END) as verified_users,
    SUM(CASE WHEN verification_method = 'migrated' THEN 1 ELSE 0 END) as migrated_users,
    SUM(CASE WHEN email_verified = false THEN 1 ELSE 0 END) as unverified_users
FROM users;
```

**Résultat attendu :**
- `verified_users` = nombre total de vos utilisateurs existants
- `migrated_users` = nombre d'utilisateurs qui étaient là avant cette mise à jour
- `unverified_users` = 0 (pour les anciens comptes)

---

## 📌 Après la migration

✅ **Tous vos utilisateurs existants peuvent maintenant se reconnecter sans problème**

- Ils n'auront PAS besoin de vérifier leur email
- Leur compte est marqué avec `verification_method = 'migrated'`
- Seuls les **nouveaux utilisateurs** (créés après aujourd'hui) devront vérifier leur email

---

## ⚠️ Sécurité

Ce script est **idempotent** : il peut être exécuté plusieurs fois sans danger.
- Il ne modifie QUE les utilisateurs avec `email_verified = false`
- Les utilisateurs déjà vérifiés ne sont pas touchés
- Pas de suppression de données
