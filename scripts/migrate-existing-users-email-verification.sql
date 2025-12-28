-- Migration pour marquer tous les utilisateurs existants comme vérifiés
-- À exécuter dans Database > SQL Runner de Replit (PRODUCTION)
-- Ce script est idempotent (peut être exécuté plusieurs fois sans danger)

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
