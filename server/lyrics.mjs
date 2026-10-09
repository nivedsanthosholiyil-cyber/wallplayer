// The upstream is operator configuration, never a request-supplied URL.
export function createLyricsHandler({ apiUrl = 'https://lrclib.net/api', apiKey = '', fetchImpl = fetch } = {}) {
  const base = new URL(apiUrl)
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('LYRICS_API_URL must be an HTTPS provider base URL without credentials, query, or fragment.')
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    const query = new URL(request.url || '/', 'http://localhost')
    const route = query.pathname.replace(/^\/api\/lyrics/, '')
    if (!['/get', '/search'].includes(route)) { response.writeHead(404); response.end('{"error":"Not found"}'); return }
    if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }); response.end(); return }
    if (request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
      response.writeHead(403); response.end(); return
    }
    const upstream = new URL(`${base.href.replace(/\/$/, '')}${route}`)
    for (const key of ['artist_name', 'track_name', 'album_name', 'duration']) {
      if (query.searchParams.has(key)) upstream.searchParams.set(key, query.searchParams.get(key).slice(0, 500))
    }
    try {
      const result = await fetchImpl(upstream, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, redirect: 'error', signal: AbortSignal.timeout(10000) })
      let size = 0
      const chunks = []
      if (result.body) for await (const chunk of result.body) {
        size += chunk.length
        if (size > 2 * 1024 * 1024) throw new Error('Lyrics response too large')
        chunks.push(Buffer.from(chunk))
      }
      response.statusCode = result.status
      response.end(Buffer.concat(chunks))
    } catch { response.writeHead(502); response.end('{"error":"Lyrics provider unavailable"}') }
  }
}
