# Interface Frosti / Mealio — version 1.2, transition compatible

## Ce qui reste inchangé

Chaque application garde son `app_users.id`. Le foyer est résolu par le même `username`, avec respect de la casse actuelle. Les lectures de `items` et `freezers`, les noms de champs et les unités historiques sont conservés. Les clés de service restent serveur. Les fonctions historiques de `household-server.tsx` peuvent toujours lire et écrire directement les tables, sous réserve de respecter les contrôles ci-dessous. La fonction fournie n’est pas modifiée dans ce ZIP.

## Contrôles maintenant assurés en base

- Un lot nouveau ou modifié doit avoir un foyer et un emplacement appartenant à ce foyer.
- Quantité numérique finie et non négative ; les créations via la fonction métier exigent une quantité strictement positive.
- Toute écriture de lot incrémente `version` et produit un journal avant/après. Une suppression est également journalisée.
- Un nouvel ajout, déplacement ou réassort dans un équipement archivé est refusé.
- La propriété d’un lot ne peut pas être changée par UPDATE.
- `storage_routing_rules.freezer_id`, lorsqu’il est renseigné, doit appartenir au foyer de la règle. Le lien des ingrédients reste inter-base et ne devient pas une FK locale.

Les règles de rangement déjà en base sont conservées. Les équipements archivés doivent être exclus des destinations disponibles dans Mealio : `.is('archived_at', null)` pour les lectures de `freezers`. Réaffecter également les règles visant une destination archivée. Tant que cette adaptation n’est pas faite, éviter l’archivage dans Frosti.

## Point d’entrée recommandé pour les prochains changements Mealio

RPC `public.frosti_stock_action(p_user uuid, p_operation uuid, p_action text, p_item uuid, p_payload jsonb)` accessible uniquement au rôle de service. Le serveur appelant doit authentifier son utilisateur et résoudre son UUID Frosti ; cette fonction ne prend pas un UUID depuis le navigateur sans vérification.

| Action        | p_item      | p_payload                                                                             |
| ------------- | ----------- | ------------------------------------------------------------------------------------- |
| add           | null        | produit, categorie, qte, unite, congelo_id, date_entree, date_peremption, notes       |
| use / discard | UUID du lot | amount                                                                                |
| transfer      | UUID du lot | amount, congelo_id cible                                                              |
| inventory     | UUID du lot | qte réelle, version observée                                                          |
| edit          | UUID du lot | produit, categorie, qte, unite, date_entree, date_peremption, notes, version observée |
| undo          | null        | operation_id original                                                                 |

Le RPC renvoie le lot résultant (quantité zéro si retiré complètement) ou l’identifiant d’annulation. Le lot épuisé est supprimé de `items`, tandis que le journal conserve le snapshot. Le résultat d’une reprise idempotente est celui de l’opération d’origine, pas une nouvelle lecture du stock après d’autres mouvements.

Générer **un UUID d’opération par intention métier**, le conserver dans le journal Mealio et réutiliser exactement ce même UUID et la même demande à chaque reprise. La même clé avec un contenu différent est refusée. Les décréments sont calculés depuis la quantité verrouillée en base. Inventaire et modification absolue exigent la version obtenue lors de la lecture, pas une version recherchée juste avant l’écriture.

Exemple côté serveur Mealio, après résolution du foyer :

```ts
const { data, error } = await frostiServerDb.rpc("frosti_stock_action", {
  p_user: household.frostiUserId,
  p_operation: savedOperationId,
  p_action: "use",
  p_item: stockItem.id,
  p_payload: { amount: 0.25 },
});
```

Ce contrat reste simple : aucune API HTTP inter-app supplémentaire n’est obligatoire. Il s’appuie sur la base source comme propriétaire des mouvements.

## Limites importantes de la transition

Les écritures **directes** de Mealio sont désormais contrôlées et journalisées, mais ses UPDATE de quantités absolues restent susceptibles d’écraser une modification concurrente tant que ses appelants n’adoptent pas le RPC ou une vérification de version. Le verrouillage dans Frosti ne transforme pas automatiquement un ancien UPDATE absolu de Mealio en décrément atomique.

Le RPC Frosti ne rend pas une transaction inter-bases atomique : conserver le journal de reprise Mealio pour l’ensemble du rangement, avec une clé d’opération stable par écriture dans la base source. Cellio ne dispose pas de ces fonctions à la livraison de ce ZIP ; ses changements doivent faire l’objet d’une migration équivalente sur son schéma réel.

Un mouvement direct est marqué `mealio_ou_externe`, sans déduction de consommation : seuls les appels `use` portent explicitement ce motif. Les repas passés estimés depuis le planning restent statistiques ; aucun décrément de stock supplémentaire n’est déclenché par Frosti.

Annuler dans Frosti ne corrige pas les journaux et objets métier de Mealio. Prévoir une compensation coordonnée pour les futurs parcours inter-app.

Enfin, le passage du mot de passe partagé à un hash est différé jusqu’à adaptation de toutes les connexions qui le vérifient. Les UUID et le nom du foyer restent inchangés.

## Ajouts V1.1

- `items.date_kind` distingue `declared` (date saisie) et `estimated` (date indicative calculée). Le champ historique `date_peremption` reste la date utilisée pour les rappels. Mealio devrait afficher « Date indicative » pour `estimated`, et envoyer `date_kind=declared` s'il remplace cette date par une date d'emballage. Les écritures historiques sans ce nouveau champ restent compatibles ; les dates par défaut sont proposées dans Frosti, elles ne sont pas automatiquement appliquées aux ajouts directs de Mealio.
- `alert_rules.fridge_default_days` et `freezer_default_days` sont facultatifs. Les champs `fridge_days`/`freezer_days` conservent les délais des rappels sans date.
- `frosti_transfer_batch(p_user,p_operation,p_source,p_target,p_lots)` est réservé à service_role. `p_lots` est un tableau `{id,amount,version}` de 1 à 100 lots, tous issus du même équipement. Le groupe est atomique, idempotent et journalisé sous une seule opération.
- Suppression d'équipement via `frosti_equipment_action(...,'delete',...)` : refuse tout lot encore rattaché, ainsi que toute règle dans storage_defaults/storage_routing_rules. Les anciennes annulations nécessitant un équipement supprimé sont refusées.

## Ajouts V1.2

`transfer` et `frosti_transfer_batch` fusionnent uniquement avec un lot cible dont produit/catégorie/unité/date_entree/date_peremption/date_kind/notes sont strictement identiques. L'UUID cible est conservé, la quantité est incrémentée atomiquement ; une source entièrement déplacée est supprimée. Le résultat d'un transfert fusionné décrit le lot cible. Les écritures directes de Mealio ne fusionnent pas automatiquement. Les fonctions stock de Frosti sérialisent leurs modifications par foyer ; les mises à jour externes restent protégées par les verrous de lignes et contraintes habituelles, sans garantie de déduplication d'une insertion directe simultanée.

L'action `merge` regroupe un lot avec un autre identique dans le même équipement. Elle exige `p_payload.version`, ne change pas la quantité totale et est journalisée/annulable. Le journal d'un transfert groupé conserve un seul couple avant/après par lot, même quand plusieurs sources alimentent le même lot cible.
