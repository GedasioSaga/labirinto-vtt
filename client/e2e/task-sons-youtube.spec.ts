// E2E do YOUTUBE NA ABA SONS (Sistema 4, sons ao vivo, fatia F6:
// docs/planos/sons-ao-vivo-2026-10-23.md, seção 3 e "F6 medição").
//
// O QUE ESTA RÉGUA COBRA:
//   - "Colar link" recusa o domínio falso com aviso e guarda o link bom como
//     botão, com a prévia só do id (nenhuma chamada ao YouTube ao colar);
//   - nada do YouTube carrega antes do clique no botão do som;
//   - o clique abre o player escondido (fora da tela, sandbox), pede o vídeo
//     do `t=` do link; o ENDED com loop volta ao início do trecho (seekTo);
//     o segundo clique para (pauseVideo);
//   - erro 153 vira aviso claro ("não deixa tocar fora do YouTube") e a aba
//     segue usável.
//
// COMO PROVA, SEM REDE EXTERNA: o player do YouTube (o iframe do
// youtube-nocookie.com/embed/...) é um STUB local servido pelo `page.route`,
// que fala o mesmo protocolo de mensagens do player de verdade e devolve ao
// app, num evento a mais (`stubLog`, que o app ignora), cada comando que
// recebeu. Todo o resto de youtube/google é abortado, e a régua confere que
// nenhuma requisição saiu para fora do vite além do stub. O disco é o de
// mentira dos outros e2e dos sons.
import { test, expect, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'

test.use({ trace: 'off', video: 'off' })

declare global {
  interface Window {
    __comandosDoYoutube?: { func: string; args: unknown[] }[]
  }
}

const AVENTURA = 'Casa do Eco'
const PASTA = 'C:/appdata/maps/map_eco'
const ESPERA = 10_000
const HOST_DO_PLAYER = 'https://www.youtube-nocookie.com'
const VIDEO = 'dQw4w9WgXcQ'
/** O stub dá erro 153 (sem Referer, o caso do webview) para este id. */
const VIDEO_153 = 'erro153abcd'

/** O player de mentira: o protocolo de mensagens do embed, com um vídeo de 1,2 s que acaba sozinho. */
const PLAYER_STUB = `<!doctype html><meta charset="utf-8"><title>stub</title><script>
const origem = new URLSearchParams(location.search).get('origin');
let canal = null, fim = null;
const mandar = (m) => parent.postMessage(JSON.stringify(Object.assign({ id: canal, channel: 'widget' }, m)), origem);
const tocar = () => {
  clearTimeout(fim);
  mandar({ event: 'onStateChange', info: 1 });
  mandar({ event: 'infoDelivery', info: { playerState: 1, duration: 1.2 } });
  fim = setTimeout(() => mandar({ event: 'onStateChange', info: 0 }), 1200);
};
addEventListener('message', (e) => {
  if (e.origin !== origem || typeof e.data !== 'string') return;
  const m = JSON.parse(e.data);
  if (m.event === 'listening') { if (canal === null) { canal = m.id; mandar({ event: 'onReady' }); } return; }
  if (m.event !== 'command') return;
  mandar({ event: 'stubLog', info: { func: m.func, args: m.args } });
  if (m.func === 'loadVideoById') { if (String(m.args[0].videoId).indexOf('erro153') === 0) mandar({ event: 'onError', info: 153 }); else tocar(); }
  if (m.func === 'playVideo') tocar();
  if (m.func === 'pauseVideo') { clearTimeout(fim); mandar({ event: 'onStateChange', info: 2 }); }
});
</script>`

function discoDaAventura(): Record<string, string> {
  const mapa = createEmptyMap('map_eco', AVENTURA, 20, 12, 50)
  const aventura = { version: 1, id: 'adv_eco', name: AVENTURA, startSceneId: 'scene_eco', scenes: [{ id: 'scene_eco', name: 'Salão', file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

/** Na página: guarda cada comando que o stub do player contou (só da origem do player). */
function ouvirOStub(host: string): void {
  const comandos: { func: string; args: unknown[] }[] = []
  window.__comandosDoYoutube = comandos
  window.addEventListener('message', (evento) => {
    if (evento.origin !== host || typeof evento.data !== 'string') return
    const dado: unknown = JSON.parse(evento.data)
    if (typeof dado !== 'object' || dado === null || Reflect.get(dado, 'event') !== 'stubLog') return
    const info: unknown = Reflect.get(dado, 'info')
    if (typeof info !== 'object' || info === null) return
    const args: unknown = Reflect.get(info, 'args')
    comandos.push({ func: String(Reflect.get(info, 'func')), args: Array.isArray(args) ? args : [] })
  })
}

/** O "Rust" de mentira: path e fs com texto e binário na memória (o mesmo de task-sons-aba). */
function discoDeMentira(textosIniciais: Record<string, string>): void {
  const arquivos = new Map<string, Uint8Array>()
  for (const [caminho, texto] of Object.entries(textosIniciais)) arquivos.set(caminho, new TextEncoder().encode(texto))
  const pastas = new Set<string>()
  const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
  const criarPastas = (p: string): void => {
    for (let atual = semBarraFinal(p); atual.includes('/'); atual = atual.slice(0, atual.lastIndexOf('/'))) pastas.add(atual)
  }
  for (const caminho of arquivos.keys()) criarPastas(caminho.slice(0, caminho.lastIndexOf('/')))
  const todos = (): string[] => Array.from(arquivos.keys()).concat(Array.from(pastas))
  const campos = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null && !(valor instanceof Uint8Array) ? Object.fromEntries(Object.entries(valor)) : {})
  const ler = (caminho: string): Uint8Array => {
    const bytes = arquivos.get(caminho)
    if (bytes === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return bytes
  }
  let proximoId = 1
  Object.assign(window, {
    isTauri: true,
    __TAURI_INTERNALS__: {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      convertFileSrc: (caminho: string) => String(caminho),
      transformCallback: () => {
        proximoId += 1
        return proximoId
      },
      invoke: async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
        const a = campos(args)
        switch (cmd) {
          case 'plugin:event|listen':
            return Number(a.handler)
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join':
            return Array.isArray(a.paths) ? a.paths.map(String).join('/') : ''
          case 'plugin:path|dirname': {
            const p = String(a.path)
            return p.slice(0, Math.max(0, p.lastIndexOf('/')))
          }
          case 'plugin:path|basename': {
            const p = String(a.path)
            return p.slice(p.lastIndexOf('/') + 1)
          }
          case 'plugin:fs|exists': {
            const c = semBarraFinal(String(a.path))
            return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
          }
          case 'plugin:fs|mkdir':
            criarPastas(String(a.path))
            return null
          case 'plugin:fs|write_text_file':
          case 'plugin:fs|write_file': {
            const caminho = decodeURIComponent(options?.headers?.path ?? '')
            criarPastas(caminho.slice(0, caminho.lastIndexOf('/')))
            arquivos.set(caminho, args instanceof Uint8Array ? args.slice() : new Uint8Array(0))
            return null
          }
          case 'plugin:fs|read_text_file':
            return Array.from(ler(String(a.path)))
          case 'plugin:fs|read_file':
            return ler(String(a.path)).slice().buffer
          case 'plugin:fs|rename':
            arquivos.set(String(a.newPath), ler(String(a.oldPath)))
            arquivos.delete(String(a.oldPath))
            return null
          case 'plugin:fs|remove':
            arquivos.delete(String(a.path))
            return null
          case 'plugin:fs|stat': {
            const caminho = semBarraFinal(String(a.path))
            const bytes = arquivos.get(caminho)
            if (bytes === undefined && !pastas.has(caminho)) throw new Error(`não existe: ${caminho}`)
            return { isFile: bytes !== undefined, isDirectory: bytes === undefined, isSymlink: false, size: bytes?.length ?? 0, mtime: null, atime: null, birthtime: null, readonly: false }
          }
          case 'plugin:fs|read_dir': {
            const prefixo = `${semBarraFinal(String(a.path))}/`
            if (!pastas.has(semBarraFinal(String(a.path)))) throw new Error(`pasta não existe: ${String(a.path)}`)
            const filhos = new Map<string, boolean>()
            for (const p of todos()) {
              if (p.indexOf(prefixo) !== 0) continue
              const resto = p.slice(prefixo.length)
              if (resto.length === 0) continue
              const corte = resto.indexOf('/')
              filhos.set(corte === -1 ? resto : resto.slice(0, corte), corte !== -1 || pastas.has(p))
            }
            return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
          }
          default:
            return null
        }
      },
    },
  })
}

const paginaSons = (page: Page) => page.getByRole('region', { name: 'Sons' })
const dialogo = (page: Page) => page.getByRole('dialog', { name: 'Som do YouTube' })

async function comandos(page: Page): Promise<{ func: string; args: unknown[] }[]> {
  return page.evaluate(() => [...(window.__comandosDoYoutube ?? [])])
}

async function colarLink(page: Page, link: string, nome: string, repetir: boolean): Promise<void> {
  await paginaSons(page).getByRole('button', { name: 'Colar link' }).click()
  await dialogo(page).getByLabel('Link do vídeo').fill(link)
  await dialogo(page).getByLabel('Nome', { exact: true }).fill(nome)
  if (repetir) await dialogo(page).getByRole('switch', { name: 'Repetir até parar' }).click()
  await dialogo(page).getByRole('button', { name: 'Guardar som' }).click()
  await expect(dialogo(page)).toBeHidden()
}

test('YouTube na aba Sons: colar link, tocar escondido, loop volta ao início, parar e erro 153, sem rede externa', async ({ page, baseURL }) => {
  const externas: string[] = []
  page.on('request', (pedido) => {
    const url = pedido.url()
    if (baseURL !== undefined && url.startsWith(baseURL)) return
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    externas.push(url)
  })
  // Tudo do YouTube e do Google é cortado; só o embed do player cai no stub (a rota registrada por último vence).
  // Pelo HOST: o caminho dos módulos do app (`/src/lib/sons/youtube/...`) também tem "youtube".
  await page.route((url) => /youtube|youtu\.be|ytimg|googlevideo|google|doubleclick|gstatic/.test(url.hostname), (rota) => rota.abort())
  await page.route(`${HOST_DO_PLAYER}/embed/**`, (rota) => rota.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PLAYER_STUB }))
  await page.addInitScript(ouvirOStub, HOST_DO_PLAYER)
  await page.addInitScript(discoDeMentira, discoDaAventura())
  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await page.waitForSelector('canvas')
  const marcador = page.getByRole('complementary', { name: 'Livro da mesa' }).getByRole('tab', { name: 'Sons' })
  await marcador.click()
  await expect(marcador).toHaveAttribute('aria-selected', 'true')

  // 1. Domínio falso: aviso no formulário, Guardar parado.
  await paginaSons(page).getByRole('button', { name: 'Colar link' }).click()
  await expect(dialogo(page).getByText(/precisa de internet/)).toBeVisible()
  const campo = dialogo(page).getByLabel('Link do vídeo')
  await campo.fill(`https://youtube.com.golpe.net/watch?v=${VIDEO}`)
  await campo.blur()
  await expect(dialogo(page).getByRole('alert')).toContainText('não é de um vídeo do YouTube')
  await expect(dialogo(page).getByRole('button', { name: 'Guardar som' })).toBeDisabled()
  // 2. O link bom: a prévia mostra o id e o início do t=, sem chamar o YouTube.
  await campo.fill(`https://youtu.be/${VIDEO}?si=AbCd1234&t=42`)
  await expect(dialogo(page).getByRole('status', { name: 'Prévia do som' })).toContainText(`Vídeo ${VIDEO} · começa em 0:42`)
  await expect(dialogo(page).getByLabel('Começa em')).toHaveValue('0:42')
  await page.keyboard.press('Escape')
  await expect(dialogo(page)).toBeHidden()
  expect(externas).toEqual([])

  await colarLink(page, `https://youtu.be/${VIDEO}?t=42`, 'Bardo', true)
  const bardo = paginaSons(page).getByRole('button', { name: /^Bardo, pelo YouTube/ })
  await expect(bardo).toBeVisible({ timeout: ESPERA })
  // Nada do YouTube carregou antes do clique no som.
  await expect(page.locator('.lb-sons-youtube iframe')).toHaveCount(0)
  expect(externas).toEqual([])

  // 3. Tocar: player escondido, vídeo pedido pelo id e do segundo 42.
  await bardo.click()
  await expect(bardo).toHaveAttribute('aria-pressed', 'true', { timeout: ESPERA })
  const iframe = page.locator('.lb-sons-youtube iframe')
  await expect(iframe).toHaveCount(1)
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
  await expect(iframe).toHaveAttribute('src', new RegExp(`^${HOST_DO_PLAYER.replace(/[.]/g, '[.]')}/embed/${VIDEO}[?]`))
  const caixa = await page.locator('.lb-sons-youtube').boundingBox()
  expect(caixa === null || caixa.x + caixa.width <= 0).toBe(true)
  await expect.poll(async () => (await comandos(page)).find((c) => c.func === 'loadVideoById')?.args[0]).toEqual({ videoId: VIDEO, startSeconds: 42 })

  // 4. O vídeo de 1,2 s acaba: o loop volta ao segundo 42 e o botão segue aceso.
  await expect.poll(async () => (await comandos(page)).some((c) => c.func === 'seekTo' && JSON.stringify(c.args) === '[42,true]'), { timeout: ESPERA }).toBe(true)
  await expect(bardo).toHaveAttribute('aria-pressed', 'true')

  // 5. Parar.
  await bardo.click()
  await expect(bardo).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => (await comandos(page)).some((c) => c.func === 'pauseVideo')).toBe(true)

  // 6. Erro 153: aviso claro, sem travar a aba.
  await colarLink(page, `https://www.youtube.com/watch?v=${VIDEO_153}`, 'Webview', false)
  const webview = paginaSons(page).getByRole('button', { name: /^Webview, pelo YouTube/ })
  await webview.click()
  await expect(page.getByText(/Webview não tocou: este vídeo não deixa tocar fora do YouTube/)).toBeVisible({ timeout: ESPERA })
  await bardo.click()
  await expect(bardo).toHaveAttribute('aria-pressed', 'true', { timeout: ESPERA })
  await bardo.click()

  // Fora do vite, só o embed do stub saiu.
  expect(externas.filter((url) => !url.startsWith(`${HOST_DO_PLAYER}/embed/`))).toEqual([])
})
