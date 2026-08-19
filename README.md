# Anime Stream

Site de streaming anime personnel utilisant l'API de `w16.french-manga.net`.

## Fonctionnalités

- Accueil avec contenu récent (VF / VOSTFR)
- Recherche d'animes
- Lecteur vidéo avec choix VF/VOSTFR, épisodes et lecteurs (Vidzy / LuluVid)
- Navigation entre saisons

## Lancer le projet

```bash
npm install
npm run dev
```

- Frontend : http://localhost:5173
- API proxy : http://localhost:3001

## Production

```bash
npm run build
npm start
```

Le serveur Express sert le build React et proxy les appels vers french-manga.net.

## Configuration

Variable d'environnement optionnelle :

```bash
API_BASE=https://w16.french-manga.net
PORT=3001
```
# anime
# anime
