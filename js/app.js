const $file = document.getElementById('file');
const $go = document.getElementById('go');
const $status = document.getElementById('status');
const $player = document.getElementById('player');
const $demo = document.getElementById('demo');

let chosen;

// Petit helper pour afficher un message bien visible
function setStatus(msg) {
  $status.textContent = msg;
  console.log('[STATUT]', msg);
}

$file.addEventListener('change', (e) => {
  chosen = e.target.files?.[0];
  $go.disabled = !chosen;
  if (chosen && chosen.type?.startsWith('video/')) {
    $player.src = URL.createObjectURL(chosen);
    $player.load();
  } else if (chosen && chosen.type?.startsWith('audio/')) {
    // audio choisi : pas d’aperçu vidéo, c’est normal
    $player.removeAttribute('src');
  } else {
    $player.removeAttribute('src');
  }
  setStatus(chosen ? `Fichier sélectionné : ${chosen.name}` : 'Aucun fichier sélectionné.');
});

$go.addEventListener('click', async () => {
  // 1) Pas de fichier -> on le dit clairement
  if (!chosen) {
    setStatus('Choisis un fichier vidéo/audio avant de cliquer sur Générer.');
    return;
  }

  try {
    // 2) MODE DÉMO : pas d’API, toujours OK
    if ($demo?.checked) {
      const srt = `1
00:00:00,000 --> 00:00:01,200
BONJOUR, BIENVENUE SUR INFINIE

2
00:00:01,300 --> 00:00:02,800
OUTILS GRATUITS, SANS LIMITES

3
00:00:02,900 --> 00:00:04,800
GÉNÉRONS DES SOUS-TITRES !`;
      attachSRTasVTT(srt);
      setStatus('Sous-titres démo prêts ✅');
      return;
    }

    // 3) VRAIE TRANSCRIPTION : il faut la clé côté Netlify
    setStatus('Transcription en cours…');
    const fd = new FormData();
    fd.append('file', chosen);
    fd.append('model', 'whisper-1');
    fd.append('response_format', 'srt');

    const res = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: fd });

    // On lit le texte quoi qu’il arrive pour afficher une erreur claire
    const bodyText = await res.text();
    if (!res.ok) {
      if (bodyText.includes('Missing OPENAI_API_KEY')) {
        throw new Error('Clé absente côté Netlify. Active “Mode démo” OU ajoute OPENAI_API_KEY dans Site settings → Environment variables, puis redeploy.');
      }
      throw new Error(bodyText || 'Erreur inconnue de la fonction.');
    }

    attachSRTasVTT(bodyText);
    setStatus('Sous-titres prêts ✅');
  } catch (err) {
    console.error(err);
    setStatus('Erreur : ' + (err?.message || err));
  }
});

function attachSRTasVTT(srt) {
  const vtt = 'WEBVTT\n\n' + srt.replace(/\r+/g,'')
    .split('\n')
    .map(line => line.replace(/(\d+)\,(\d+)/g, '$1.$2'))
    .join('\n');

  const blob = new Blob([vtt], { type: 'text/vtt' });
  const url = URL.createObjectURL(blob);

  // Nettoyage ancien track
  [...$player.querySelectorAll('track')].forEach(t => t.remove());

  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = 'Français';
  track.srclang = 'fr';
  track.src = url;
  track.default = true;
  $player.appendChild(track);
  $player.textTracks[0]?.mode = 'showing';
}

