(function () {
  const $file   = document.getElementById('file');
  const $go     = document.getElementById('go');
  const $status = document.getElementById('status');
  const $player = document.getElementById('player');
  const $demo   = document.getElementById('demo');

  let chosen = null;
  let ffmpeg = null;

  const setStatus = (m)=>{ $status && ($status.textContent = m); console.log('[STATUT]', m); };

  // Charge FFmpeg.wasm même si le premier CDN rate
  async function ensureFFmpeg() {
    if (ffmpeg) return;

    async function loadUMD(src){
      await new Promise((resolve, reject)=>{
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = resolve;
        s.onerror = ()=>reject(new Error('CDN bloqué: '+src));
        document.head.appendChild(s);
      });
    }

    // Si la lib n’est pas là, on essaye 2 CDN
    if (!('FFmpeg' in window)) {
      setStatus('Chargement de FFmpeg…');
      try {
        await loadUMD('https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js');
      } catch {
        await loadUMD('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js');
      }
    }
    const FF = window.FFmpeg;
    if (!FF) throw new Error('FFmpeg non chargé');

    // ⚠️ core single-thread (pas de COOP/COEP requis)
    ffmpeg = FF.createFFmpeg({
      log: true,
      corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
    });

    setStatus('Initialisation du moteur (1ère fois ~20–25 Mo)…');
    await ffmpeg.load();
    setStatus('Moteur prêt ✅');
  }

  async function transcodeToSmallMp3(file) {
    await ensureFFmpeg();
    const { fetchFile } = window.FFmpeg;

    // Écrit la vidéo en FS virtuel
    ffmpeg.FS('writeFile', 'in', await fetchFile(file));

    // On descend le bitrate si > ~5.5 Mo (limite ~6 Mo des Functions)
    const bitrates = [64, 48, 32, 24, 16]; // kb/s
    for (const br of bitrates) {
      setStatus(`Compression audio… (${br} kb/s, mono 16 kHz)`);
      try {
        try { ffmpeg.FS('unlink', 'out.mp3'); } catch(e){}
        await ffmpeg.run('-i', 'in', '-vn', '-ac', '1', '-ar', '16000', '-b:a', `${br}k`, 'out.mp3');
        const data = ffmpeg.FS('readFile', 'out.mp3');
        const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
        if (blob.size/1024/1024 <= 5.5) return blob;
        // sinon on ré-essaie à un bitrate plus bas
      } catch (e) { console.warn('Tentative bitrate échouée', br, e); }
    }
    // Dernier recours : renvoie le plus petit obtenu
    const data = ffmpeg.FS('readFile', 'out.mp3');
    return new Blob([data.buffer], { type: 'audio/mpeg' });
  }

  $file.addEventListener('change', (e) => {
    const f = e.target.files?.[0] || null;
    chosen = f; $go.disabled = !f;
    if (f && f.type?.startsWith('video/')) {
      $player.src = URL.createObjectURL(f); $player.load();
    } else { $player.removeAttribute('src'); }
    setStatus(f ? `Fichier sélectionné : ${f.name} (${(f.size/1024/1024).toFixed(1)} Mo)` : 'Aucun fichier sélectionné.');
  });

  $go.addEventListener('click', async () => {
    if (!chosen) { setStatus('Choisis un fichier avant de cliquer sur Générer.'); return; }

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
        attachSRTasVTT(srt); setStatus('Sous-titres démo prêts ✅'); return;
      }

      // 1) Compression locale → audio léger
      const t0 = Date.now();
      const audioBlob = await transcodeToSmallMp3(chosen);
      setStatus(`Audio prêt (${(audioBlob.size/1024/1024).toFixed(2)} Mo). Envoi… (prétraitement ${((Date.now()-t0)/1000).toFixed(1)}s)`);

      // 2) Envoi à la Function Netlify
      const fd = new FormData();
      fd.append('file', audioBlob, 'audio.mp3');
      fd.append('model', 'whisper-1');
      fd.append('response_format', 'srt');
      // fd.append('language','fr'); // décommente si tu veux forcer FR

      const res = await fetch('/.netlify/functions/transcribe', { method: 'POST', body: fd });
      const text = await res.text();

      if (!res.ok) {
        if (text.includes('Missing OPENAI_API_KEY')) throw new Error('Clé absente côté Netlify (ajoute OPENAI_API_KEY + redeploy).');
        if (/payload|too large|413/i.test(text)) throw new Error('Fichier trop lourd pour la Function. Réessaie : la compression va réduire plus.');
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
    track.kind = 'subtitles'; track.label = 'Français'; track.srclang = 'fr';
    track.src = url; track.default = true;
    $player.appendChild(track);
    $player.textTracks[0] && ($player.textTracks[0].mode = 'showing');
  }
})();

