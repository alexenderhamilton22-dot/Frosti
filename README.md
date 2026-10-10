# Frosti V1.3.1

Projet complet de l’écosystème Frosti / Cellio / Mealio. Lire **GUIDE_ECOSYSTEME.md** avant installation : migrations selon votre version actuelle, configuration, vérifications et limites de reprise.

Depuis la version précédemment livrée : `migrations/006_frosti_v1_3.sql puis 007_frosti_v1_3_1.sql`. Si la première migration est déjà appliquée, ne passer que la seconde. Conserver votre configuration et ne pas rejouer les SQL historiques en bloc.

Contrôles : `npm ci`, puis `npm run verify`. Les transferts entre apps et les préparations sont dans Mealio → Écosystème ; les transferts internes restent ici.
