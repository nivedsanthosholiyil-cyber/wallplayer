import type { IncomingMessage, ServerResponse } from 'node:http'
export function createLyricsHandler(options?: { apiUrl?: string; apiKey?: string; fetchImpl?: typeof fetch }): (request: IncomingMessage, response: ServerResponse) => Promise<void>
