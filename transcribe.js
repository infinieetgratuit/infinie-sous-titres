export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'Missing OPENAI_API_KEY' };
  }

  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body || '', 'utf8');

  // Proxy vers API de transcription (OpenAI-compatible)
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': contentType
    },
    body
  });

  const text = await resp.text();
  return {
    statusCode: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') || 'text/plain' },
    body: text
  };
}
