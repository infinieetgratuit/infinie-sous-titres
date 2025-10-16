const $file = document.getElementById('file');
const $go = document.getElementById('go');
const $status = document.getElementById('status');
const $player = document.getElementById('player');
const $demo = document.getElementById('demo');

let chosen;

$file.addEventListener('change', (e) => {
  chosen = e.target.files?.[0];
  $go.disabled = !chosen;
  if (chosen && chosen.type.startsWith('video/')) {
    $player.src = URL.createObjectURL(chosen);
    $player.load();
  } else {
    $player.removeAttribute('src');
  }
  $status.textContent = chosen ? `Fichier: ${chosen.name}` : 'Prêt.';
});

$go.addEventListener('click', async () => {
  if (!chosen) return;
  try {
    if ($demo.checked) {
      // Exemple SRT statique pour tester l'UI sans backend
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
      $status.textContent = 'Sous-titres démo prêts ✅';
      return;
    }

    $status.textContent = 'Transcription en cours… (tu peux tester le Mode démo)';
    const fd = new FormData();
    fd.append('file', chosen);
    // Paramètres adaptés à l’API OpenAI-compatible
    fd.append('model', 'whisper-1');
    fd.append('response_format', 'srt');
    // Langue facultative : fd.append('language', 'fr');

    const res = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const srt = await res.text();
    attachSRTasVTT(srt);
    $status.textContent = 'Sous-titres prêts ✅';
  } catch (err) {
    console.error(err);
    $status.textContent = 'Erreur: ' + err.message;
  }
});

function attachSRTasVTT(srt) {
  const vtt = 'WEBVTT\\n\\n' + srt.replace(/\\r+/g,'')
    .split('\\n')
    .map(line => line.replace(/(\\d+)\\,(\\d+)/g, '$1.$2'))
    .join('\\n');

  const blob = new Blob([vtt], { type: 'text/vtt' });
  const url = URL.createObjectURL(blob);

  // Nettoyer ancien track
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
