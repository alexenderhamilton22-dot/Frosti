# Contrat Frosti V1.3.1 / Mealio V1.3.1

Le foyer est résolu par username dans chaque app_users ; chaque base conserve son UUID propre. Accès serveur avec clé de service, jamais depuis le navigateur. Les lectures de items restent compatibles et incluent désormais version, ingredient_id/ingredient_name, content_quantity/content_unit, product_type, preparation_origin, date_role, date_fabrication et les métadonnées vin.

Écritures : `frosti_stock_action(p_user uuid,p_operation uuid,p_action text,p_item uuid,p_payload jsonb)` ; actions add/edit/inventory/use/discard/transfer/merge/undo. Mealio utilise origin=mealio ; use déduit un amount de la quantité courante ; version fournie doit correspondre. add peut recevoir merge_exact=true et ne fusionne que les identités de lot identiques. Le même p_operation avec le même payload retourne son reçu ; un payload différent est rejeté.

Inventaire : `frosti_inventory_batch(p_user uuid,p_operation uuid,p_rows jsonb)` ; chaque ligne contient id/qte/unite/version. Validation et écriture dans une transaction unique par base.

Le référentiel ingredient_catalog est un miroir serveur de Mealio official_ingredients(id,nom). Aucun FK entre les bases. Un ingrédient seul n’autorise pas une fusion de lots distincts. La préparation/réservation et le journal de coordination restent dans Mealio ecosystem_jobs. Aucune transaction ni annulation globale n’est prétendue.

Nouveaux champs : preparation_id, recipe_id, portions_per_unit. La fusion compare aussi ces champs. apply_default_expiry=true demande une date indicative selon les règles du foyer, uniquement à la création sans date explicite et hors vin. Le reçu est recherché avant ce calcul ; une reprise ne change pas la date. Une unité conditionnée ne se change pas implicitement dans l’inventaire.
