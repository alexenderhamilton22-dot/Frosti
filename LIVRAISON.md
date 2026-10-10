# Frosti V1.2 — Livraison du 9 octobre 2026

## Mise à jour depuis V1.1

1. Arrêter le serveur et sauvegarder le projet/la base.
2. Exécuter toute la migration `005_frosti_v1_2.sql` dans Supabase Frosti. Elle suppose 001 et 004 déjà appliquées ; ne pas les rejouer après 005. Elle ne fusionne ni ne supprime automatiquement aucune donnée existante.
3. Remplacer les sources avec le ZIP V1.2 en conservant `.env.local` et la configuration Git/Vercel.
4. Exécuter `npm ci`, `npm run verify`, `npm run dev`. Vérifier V1.2 dans l'en-tête.

## Corrections V1.2

- Ajout d'équipement accessible au-dessus de la liste en dialogue ; formulaire initial conservé en bas.
- Transferts : cumul avec le lot identique déjà présent dans la destination. Mars reste séparé de Magnum/Snickers, et des lots de dates différentes.
- Doublons déjà créés : Autres actions → Regrouper avec un lot identique. Pour 2 et 4 pièces identiques, le résultat est un lot de 6 pièces.
- Annulations individuelles et groupées, y compris plusieurs sources vers le même lot cible ; versions périmées refusées pour le regroupement manuel.
- Six tests couvrant migrations PostgreSQL, préservation de quantités et variantes, reprise et annulations. Recette mobile du bouton supérieur et du regroupement manuel ; réponses API simulées, aucun accès à la base réelle.

## Fonctions ajoutées

- Stocks : accès directs Équipements, Transférer des produits, Dates et alertes.
- Réglages : raccourcis Équipements / Notifications / Dates et délais.
- Équipements : ajout et renommage ; suppression confirmée uniquement si aucun lot et aucune règle de rangement ne le référence. L'historique est conservé ; les annulations nécessitant l'équipement supprimé sont refusées. L'archivage reste optionnel et dépend de l'adaptation de Mealio.
- Transferts : de 1 à 100 lots d'un équipement vers un autre du même foyer ; sélection individuelle ou globale ; quantité ajustable par produit. Transaction atomique, vérification des versions et reprise sans doublon. Annulation groupée depuis Historique tant que le stock n'a pas changé. Dates, notes et quantités totales conservées.
- Notifications : génération et enregistrement d'un nom de canal Ntfy aléatoire, lien pour s'abonner et bouton de test. Il ne s'agit pas d'une réservation privée du canal sur ntfy.sh. L'abonnement sur le téléphone reste nécessaire.
- Dates : délais par catégorie et type de stockage. Dates indicatives proposées à l'ajout depuis la date d'entrée, case à décocher ; date d'emballage prioritaire. Les rappels sans date commencent au délai exact réglé. Les règles nouvelles ne réécrivent pas les dates des lots existants.
- Configuration Supabase : l'erreur indique désormais le nom de la variable manquante. Une clé sb_secret peut être utilisée dans SUPABASE_SERVICE_ROLE_KEY.

## Vérifications et limites

Les tests SQL utilisent les véritables migrations 001, 004 et 005 dans PostgreSQL embarqué PGlite, sur le schéma fourni. Ils vérifient conservation des quantités et dates indicatives, transfert partiel et entier, atomicité en cas d'erreur, versions périmées, isolation des foyers, reprise idempotente, annulation groupée et refus des suppressions dangereuses. Ces tests ne remplacent pas une recette dans votre Supabase ni un test de charge multi-connexions.

La recette Chromium utilise des réponses API simulées : affichages 320/375/390/1024 px, ajout décimal et date indicative, transfert groupé avec reprise après erreur, création/suppression d'équipement, génération de canal, sauvegarde des délais, inventaire, historique, refus HTTP hors session et contrôle d'origine. Aucun secret réel, aucune écriture Supabase réelle ni aucune notification réelle ne sont utilisés dans ces tests. Les captures figurent dans recette/.

Next.js passe de 16.3.1 à 16.3.8. Les dépendances de production ne présentent aucune alerte selon npm audit --omit=dev lors de la livraison. Cinq alertes élevées restent dans la chaîne ESLint de développement (braces/micromatch/fast-glob/eslint-config-next) ; npm audit ne propose qu'une rétrogradation incompatible comme correction automatique. Ne pas lancer npm audit fix --force. Référence : https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

La connexion familiale et les UUID historiques sont conservés. Mealio peut garder ses accès actuels. Les champs nouveaux sont additifs ; le contrat explique la distinction date_kind declared/estimated. Les écritures absolues de Mealio ne deviennent pas atomiques automatiquement. Les mots de passe historiques restent compatibles et leur migration nécessite une coordination entre applications. Les fonctionnalités hors connexion et la distinction sanitaire DLC/DDM restent hors périmètre.
