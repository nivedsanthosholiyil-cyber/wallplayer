import type { IncomingMessage, ServerResponse } from 'node:http'
export function createVisualsHandler(options?: { apiKey?: string; directory?: string; fetchImpl?: typeof fetch }): (request: IncomingMessage, response: ServerResponse, next?: () => void) => Promise<void>
