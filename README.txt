# Infinie — Sous-titres (Netlify)

Ce dossier contient une version ultra simple pour générer des sous-titres avec un front-end statique et une fonction Netlify (serverless) qui proxy l'API de transcription.

## Démarrage éclair (avec Netlify depuis GitHub)
1) Crée un repo GitHub vide (public ou privé).  
2) Upload **tous les fichiers** de ce dossier dans le repo (bouton “Add file” → “Upload files”).  
3) Va sur Netlify → “Add new site” → “Import an existing project” → Connecte GitHub → choisis le repo.  
4) Après la création du site, ouvre **Site settings → Environment variables** et ajoute :  
   - KEY: `OPENAI_API_KEY`  
   - VALUE: ta clé API (à garder secrète)  
5) Déploie (Netlify le fait automatiquement). Ouvre l’URL du site, coche “Mode démo” pour tester, puis décoche et clique Générer avec ta clé.

## Démarrage (CLI, alternative)
- `npm i -g netlify-cli`
- `netlify init` (choisir “Deploy existing project”)
- `netlify env:set OPENAI_API_KEY "ta_cle"`
- `netlify deploy --prod`

## Important
- La fonction `functions/transcribe.js` envoie **tel quel** le `multipart/form-data` à l’API OpenAI `/v1/audio/transcriptions`.  
- Le front demande `response_format=srt`, puis convertit SRT → VTT pour l’affichage dans la balise `<video>`.
- Le **Mode démo** fonctionne sans aucune clé/API.
