# V1.3.1 — 10 octobre 2026

- Métadonnées recette, préparation et portions conservées dans les mouvements.
- Dates par défaut appliquées aux ajouts serveur Mealio.
- Unité protégée lorsque le conditionnement est conservé ; retrait explicite du conditionnement autorisé.
- Libellés de dates cohérents avec leur rôle.

# V1.3 — 10 octobre 2026

- Identité officielle d’ingrédient et import du référentiel Mealio.
- Contenu par unité et total explicite ; recherche par ingrédient.
- Nature/origine et dates DLC/DDM/apogée/indicative, sans reclasser l’historique.
- RPC de réception avec fusion stricte et inventaire atomique versionné.
- Métadonnées conservées en transfert/annulation, y compris anciens journaux.
- Opérations Mealio coordonnées protégées d’une annulation isolée.

# Historique des versions

## V1.2 — 9 octobre 2026

- Bouton d'ajout d'équipement au-dessus de la liste avec formulaire en dialogue ; formulaire du bas conservé.
- Transferts individuels/groupés : addition des quantités dans un lot strictement identique de la destination, plutôt que création d'une ligne supplémentaire.
- Action manuelle de regroupement des doublons déjà présents, avec confirmation et historique annulable.
- Conservation des variantes, notes et dates différentes ; conservation des quantités totales.
- Journal regroupé par lot pour permettre l'annulation d'un transfert groupé qui alimente plusieurs fois le même lot cible.
- Migration 005 rejouable, sans fusion automatique des anciennes données.

## V1.1 — 9 octobre 2026

- Accès directs aux équipements, transferts, dates et notifications.
- Suppression contrôlée d'un équipement vide et sans règle de rangement.
- Transfert groupé atomique de 1 à 100 lots, quantités partielles, versions vérifiées, reprise idempotente et annulation groupée.
- Création d'un nom de canal Ntfy aléatoire, enregistrement et lien d'abonnement.
- Dates indicatives par défaut selon catégorie et type de stockage, distinctes des dates saisies ; rappels sans date au délai exact configuré.
- Migration additive 004, champs historiques et accès Mealio conservés.
- Next.js 16.3.8 et dépendances transitives actualisées ; zéro alerte d'audit sur les dépendances de production lors de la recette. Cinq alertes élevées restent dans la chaîne ESLint de développement (`braces`), sans correction compatible proposée par npm audit.

## V1.0 — 9 octobre 2026

Première livraison de la refonte Frosti :

- Navigation mobile Stocks / À utiliser / Réglages et numéro de version visible.
- Ajout rapide, quantités décimales, retrait partiel, duplication avec dates réinitialisées.
- Transferts transactionnels, inventaire par lot et historique annulable.
- Connexion serveur signée, limitation des tentatives et fermeture progressive des accès publics.
- Journal des écritures externes et contrat de transition Mealio.
- Alertes partagées entre écran et cron, notifications contrôlées.
- Purge des anciens caches privés, erreurs explicites, tests SQL et recette mobile.

Compatibilité : mots de passe historiques conservés pour Mealio ; champs stock historiques conservés. L’archivage nécessite que Mealio ignore les équipements archivés.
