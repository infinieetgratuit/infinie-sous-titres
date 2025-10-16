(function () {
  const $file   = document.getElementById('file');
  const $go     = document.getElementById('go');
  const $status = document.getElementById('status');
  const $player = document.getElementById('player');
  const $demo   = document.getElementById('demo');

  function setStatus(msg){ if($status) $status.textContent = msg; console.log('[STATUT]', msg); }

  let chosen = null;
  let ffmpeg = null;

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
    setStatus(chosen ? `Fichier sélectionné : ${chosen.name} (${(chosen.size/1024/1024).toFixed(1)} Mo)` : 'Aucun fichier sélectionné.');
  });

  async function ensureFFmpeg() {
    if (ffmpeg) return;
    if (!window.FFmpeg) throw new Error('FFmpeg non chargé');
    const { createFFmpeg, fetchFile } = window.FFmpeg;
    ffmpeg = createFFmpeg({
      log: true,
      corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js",
    });
    setStatus('Chargement du moteur (1ère fois, ~20 Mo)…');
    await ffmpeg.load();
    setStatus('Moteur prêt ✅');
  }

  // Essaie plusieurs bitrates pour rester < ~5.5 Mo (limite Functions ~6 Mo)
  async function transcodeToSmallMp3(file) {
    await ensureFFmpeg();
    const { fetchFile } = window.FFmpeg;

    // Écris la vidéo source dans le FS virtuel
    ffmpeg.FS('writeFile', 'in', await fetchFile(file));

    const bitrates = [64, 48, 32, 24, 16]; // kbps
    for (const br of bitrates) {
      setStatus(`Compression audio… (${br} kb/s, mono 16 kHz)`);
      try {
        // Nettoie une éventuelle sortie précédente
        try { ffmpeg.FS('unlink', 'out.mp3'); } catch(e){}
        // -vn = no video, -ac 1 = mono, -ar 16000 = 16 kHz, -b:a = bitrate audio
        await ffmpeg.run('-i', 'in', '-vn', '-ac', '1', '-ar', '16000', '-b:a', `${br}k`, 'out.mp3');
        const data = ffmpeg.FS('readFile', 'out.mp3');
        const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
        const sizeMB = blob.size/1024/1024;
        setStatus(`Audio compressé: ${sizeMB.toFixed(2)} Mo`);
        if (sizeMB <= 5.5) return blob; // OK → on envoie
      } catch (e) {
        console.warn('Échec tentative bitrate', br, e);
      }
    }
    // Dernier recours : on renvoie quand même le plus petit obtenu
    const data = ffmpeg.FS('readFile', 'out.mp3');
    return new Blob([data.buffer], { type: 'audio/mpeg' });
  }

  $go.addEventListener('click', async () => {
    if (!chosen) {
      setStatus('Choisis un fichier avant de cliquer sur Générer.');
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

      // *** NOUVEAU : on envoie l'AUDIO compressé, pas la vidéo ***
      const t0 = Date.now();
      const audioBlob = await transcodeToSmallMp3(chosen);
      const after = ((Date.now()-t0)/1000).toFixed(1);
      setStatus(`Audio prêt (${(audioBlob.size/1024/1024).toFixed(2)} Mo). Envoi… (prétraitement ${after}s)`);

      const fd = new FormData();
      fd.append('file', audioBlob, 'audio.mp3');
      fd.append('model', 'whisper-1');
      fd.append('response_format', 'srt');
      // fd.append('language', 'fr'); // décommente si tu veux forcer FR

      const res = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: fd });
      const text = await res.text();

      if (!res.ok) {
        if (text.includes('Missing OPENAI_API_KEY')) throw new Error('Clé absente côté Netlify (ajoute OPENAI_API_KEY, puis redeploy).');
        if (/payload|too large|413/i.test(text)) throw new Error('Fichier trop lourd côté function. Réessaie avec une vidéo plus courte, ou laisse la compression réessayer.');
        throw new Error(text || 'Erreur inconnue de la fonction.');
      }

      attachSRTasVTT(text);
      setStatus('Sous-titres prêts ✅');
    } catch (err) {
      console.error(err);
      alert('Erreur : ' + (err?.message || err));
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

