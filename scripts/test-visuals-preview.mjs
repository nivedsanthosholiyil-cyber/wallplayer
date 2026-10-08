import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVisualsHandler } from '../server/visuals.mjs'

// Isolated manual QA fixture. Never used by the real application or production build.
const binary = await readFile(process.env.MUSICWALL_QA_VIDEO || join(tmpdir(), 'musicwall-test-visual.mp4'))
const directory = await mkdtemp(join(tmpdir(), 'musicwall-browser-test-'))
const video = { id: 42, width: 640, height: 360, duration: 2, image: '/images/afterglow-night.png', url: 'https://www.pexels.com', user: { name: 'Controlled QA fixture', url: 'https://www.pexels.com' }, video_files: [{ id: 8, width: 640, height: 360, quality: 'sd', file_type: 'video/mp4', link: 'https://videos.pexels.com/video-files/42/fixture.mp4' }] }
const handler = createVisualsHandler({ apiKey: 'controlled-test-fixture', directory, fetchImpl: async (url) => {
  if (String(url).includes('/search?')) return new Response(JSON.stringify({ videos: [{ ...video, video_files: [{ ...video.video_files[0], link: '/fixture.mp4' }] }], page: 1, per_page: 12, total_results: 1 }))
  if (String(url).includes('/videos/42')) return new Response(JSON.stringify(video))
  return new Response(binary, { headers: { 'Content-Type': 'video/mp4' } })
} })
const server = await createServer({ configFile: false, plugins: [
  { name: 'isolated-visual-fixture', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\','/').endsWith('/services/spotify/auth.ts')) return `const state={status:'connected',message:'',canControl:true,clientId:'test-fixture',configuredByEnv:true}; export const spotifyAuth={getSnapshot:()=>state, subscribe:()=>()=>{}, completeRedirect:async()=>{}, canStream:()=>false, redirectUri:location.origin+'/callback', disconnect:()=>{}, connect:async()=>{}, setClientId:()=>{}};`
    if (id.replaceAll('\\','/').endsWith('/services/spotify/client.ts')) return `export class SpotifyApiError extends Error {}; let position=12; let playing=true; export const spotifyClient={request:async()=>({is_playing:playing,progress_ms:position*1000,item:{type:'track',id:'visual-test-track',name:'Visual Test Fixture',duration_ms:212000,artists:[{id:'test-artist',name:'Controlled QA'}],album:{name:'Local fixture',images:[{url:'/images/afterglow-night.png',width:1280}]}},device:{id:'fixture-device',is_restricted:false,supports_volume:true,volume_percent:70}}),command:async(path)=>{if(path.endsWith('/pause'))playing=false;if(path.endsWith('/play'))playing=true;}};`
    if (id.replaceAll('\\','/').endsWith('/services/lyrics/LyricsService.ts')) return `export const lyricsService={getLyrics:async()=>({synced:true,lines:[{startMs:0,endMs:212000,text:'Visual integration test'}]})};`
  }, configureServer(server) {
    server.middlewares.use('/api/visuals', handler)
    server.middlewares.use('/fixture.mp4', (request, response) => { response.setHeader('Content-Type','video/mp4'); response.setHeader('Content-Length',binary.length); response.end(binary) })
  } }, react(), tailwindcss()
], server: { host: '127.0.0.1', port: 5175, strictPort: true } })
await server.listen()
console.log(`Isolated visual QA: http://127.0.0.1:5175/; storage: ${directory}`)
