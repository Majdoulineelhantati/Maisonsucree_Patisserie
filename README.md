# Maison Sucrée — E-commerce + Administration

Projet prêt à lancer avec **React + Vite**, **Node.js + Express** et **SQLite**. Aucun PostgreSQL et aucun Docker ne sont nécessaires.

## Fonctionnalités boutique
- Catalogue produits
- Stock affiché en temps réel
- Promotions visibles avec ancien/nouveau prix
- Panier et quantités
- Commande client avec nom, téléphone et adresse
- Décrément automatique du stock lors d'une commande

## Fonctionnalités admin
Ouvrir : `http://localhost:5173/admin`

Identifiants de démonstration :
- Utilisateur : `admin`
- Mot de passe : `admin123`

Ils peuvent être modifiés dans `backend/.env`.

L'administration permet de :
- Voir toutes les commandes
- Consulter le détail d'une commande
- Changer le statut : En attente, Confirmée, En préparation, En livraison, Livrée, Annulée
- Conserver l'historique des changements de statut
- Remettre automatiquement le stock si une commande est annulée
- Ajouter, modifier et archiver des produits
- Restaurer un produit archivé
- Modifier le stock de chaque produit
- Voir les alertes de stock faible
- Activer une promotion avec pourcentage et libellé
- Voir un tableau de bord avec commandes actives, produits, stock faible et CA

> La suppression d'un produit est volontairement un **archivage** pour conserver l'intégrité des anciennes commandes.

## 1. Lancer le backend
Dans un terminal :

```bash
cd backend
npm install
npm start
```

API : `http://localhost:4000`

Test : `http://localhost:4000/api/health`

## 2. Lancer le frontend
Dans un deuxième terminal :

```bash
cd frontend
npm install
npm run dev
```

Boutique : `http://localhost:5173`

Admin : `http://localhost:5173/admin`

## Réinitialiser la base de démonstration
Dans `backend` :

```bash
npm run reset-db
```

Cela efface les commandes et remet les 6 produits de démonstration.

## Base de données
Le fichier est :

`backend/database.sqlite`

Tables principales :
- `products`
- `orders`
- `order_items`
- `order_status_history`
