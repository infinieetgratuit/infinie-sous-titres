(function () {
  const $file   = document.getElementById('file');
  const $go     = document.getElementById('go');
  const $status = document.getElementById('status');
  const $player = document.getElementById('player');
  const $demo   = document.getElementById('demo');

  function setStatus(msg){ if($status) $status.textContent = msg; console.log('[STATUT]', msg); }
  window.onerror = (m,s,l,c,e)=>{ setStatus('Erreur JS: '+(m||e?.message||'inconnue')); };

  // Vérifie que le HTML contient bien les bons IDs
  const missing = ['file','go','status','player','demo'].filter(id => !document.getElementById(id));
  if (missing.length) {
    alert('IDs manquants dans index.html: '+missing.join(', '));
    setStatus('IDs manquants: '+missing.join(', '));
    return;
  }

  let chosen = null;

  $file.addEventListener('change', (e) => {
    const files = e.target.files;
    chosen = (files && files.length) ? files[0] : null;

    $go.disabled = !chosen;
    if (chosen && chosen.type?.startsWith('video/')) {
      $player.src = URL.createObjectURL(chosen);
      $player.load();
    } else {
      $player.removeAttribute('src');
    }
    setStatus(chosen ? `Fichier sélectionné : ${chosen.name}` : 'Aucun fichier sélectionné.');
  });

  $go.addEventListener('click', async () => {
    if (!chosen) {
      setStatus('Choisis un fichier vidéo/audio avant de cliquer sur Générer.');
      return;
    }

    try {
      if ($demo && $demo.checked) {
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

      setStatus('Transcription en cours…');
      const fd = new FormData();
      fd.append('file', chosen);
      fd.append('model', 'whisper-1');
      fd.append('response_format', 'srt');

      const res = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: fd });
      const text = await res.text();

      if (!res.ok) {
        if (text.includes('Missing OPENAI_API_KEY')) {
          throw new Error('Clé absente côté Netlify. Active “Mode démo” OU ajoute OPENAI_API_KEY dans Site settings → Environment variables, puis redeploy.');
        }
        throw new Error(text || 'Erreur inconnue de la fonction.');
      }

      attachSRTasVTT(text);
      setStatus('Sous-titres prêts ✅');
    } catch (err) {
      console.error(err);
      setStatus('Erreur : ' + (err?.message || err));
      alert('Erreur : ' + (err?.message || err));
    }
  });

  function attachSRTasVTT(srt) {
    const vtt = 'WEBVTT\n\n' + srt.replace(/\r+/g,'')
      .split('\n')
      .map(line => line.replace(/(\d+)\,(\d+)/g, '$1.$2'))
      .join('\n');

    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);

    [...$player.querySelectorAll('track')].forEach(t => t.remove());
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'Français';
    track.srclang = 'fr';
    track.src = url;
    track.default = true;
    $player.appendChild(track);
    $player.textTracks[0] && ($player.textTracks[0].mode = 'showing');
  }
})();

