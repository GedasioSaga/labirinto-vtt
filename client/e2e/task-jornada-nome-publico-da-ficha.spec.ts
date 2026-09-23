// JORNADA DO NOME PÚBLICO DA FICHA (nome-publico-da-ficha, backlog da
// simulação de 7 jogadores) — escrita para SAIR VERMELHA no código de hoje. É
// a régua do conserto, não o conserto.
//
// O DEFEITO: o nome de trabalho que o mestre dá à ficha de um NPC ("Capataz
// traidor") chega cru ao jogador. O pedido: no painel da ficha, "Nome para os
// jogadores" com "O mesmo | Outro | Nenhum"; o recorte do jogador troca o nome;
// o DONO da ficha sempre vê o nome real; ficha sem o campo (mapa antigo) fica
// em "O mesmo".
//
// ONDE ISSO MORRE HOJE:
//   - client/src/components/TokenNameControls.tsx:11-24 — o painel da ficha só
//     tem o campo "Nome"; não existe "Nome para os jogadores";
//   - client/src/types/map.ts:413-416 — `Token` só tem `name`, sem nome público;
//   - client/src/lib/fogFilter.ts:650-652 — o recorte copia o token visível
//     inteiro (`sanitizeTokenPhoto` só limpa a foto): `name` vai como está;
//   - client/src/player/PlayerView.tsx:291 — a tela do jogador pinta `token.name`
//     embaixo de cada ficha que recebe.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-entrada-jogador.spec.ts e task-jornada-viagem-do-jogador.spec.ts):
//   DUAS TELAS DE VERDADE. O mestre é o app inteiro em modo Tauri (disco de
//   mentira de helpers/tauriFsStub.ts); Duda é o `player.html` inteiro no
//   próprio contexto de navegador. Só o TRANSPORTE Rust é falsificado: o que
//   Duda manda pelo WebSocket roteado vira `net:message` no mestre, e o
//   `net_send` do mestre volta ao socket dela por `exposeFunction` — cada texto
//   entregue fica anotado em `frames` (é exatamente o que chega à tela dela).
//   GESTO REAL: fichas criadas pelo "Adicionar token" do painel, nome digitado
//   tecla a tecla, clique no controle, "Atribuir Arco" na aba Jogo, Duda digita
//   código e nome e clica Entrar. Os únicos `evaluate` são o do transporte.
//   PROVA: o nome acessível na tela (controle do mestre, "Centralizar em Arco"
//   no painel da Duda) e o texto que chegou ao WebSocket DELA. O nome embaixo
//   da ficha é texto do Pixi (sem DOM); o que ele pinta é o `name` do token
//   que chegou no fio — por isso o vazamento é lido no fio, como o aceite pede
//   ("'traidor' não aparece no WS dela"). Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o controle fica no painel da ficha SELECIONADA (aba Mapa), é um grupo de
//     rádios (`radiogroup`) OU uma lista (`combobox`) de nome acessível
//     "Nome para os jogadores", com as opções "O mesmo", "Outro" e "Nenhum";
//   - com "Outro", aparece uma caixa de texto cujo nome acessível fala de
//     "jogadores" ou "Outro nome" (não é o campo "Nome" de sempre); o valor vale
//     ao sair da caixa (Tab);
//   - ficha recém-criada pelo painel nasce sem o campo — é o mesmo caso do
//     mapa antigo, e tem de mostrar "O mesmo".
//
// CONTROLE POSITIVO (verde hoje): teste 1 — Duda entra, recebe Arco e o fio
// dela traz "Capataz traidor". Sem ele, o vermelho dos testes 2 a 5 poderia
// ser o fio mudo. Os testes 2 a 5 morrem hoje no controle "Nome para os
// jogadores", que não existe.
import { test, expect, type Browser, type BrowserContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { installTauriFsStub } from './helpers/tauriFsStub'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const CODIGO = 'NOME01'
const DUDA = 'Duda'
const FICHA_DUDA = 'Arco'
const NPC = 'Capataz traidor'
/** Pedaço do nome de trabalho que não pode chegar ao jogador de jeito nenhum. */
const SEGREDO = 'traidor'
const PUBLICO = 'Estivador'
const MASCARA = 'Mascarado'
const NOME_PARA_JOGADORES = 'Nome para os jogadores'
const CAIXA_DO_OUTRO = /jogadores|outro nome/i

const TELA = { width: 1280, height: 800 }
/** Espera curta: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Folga para o recorte chegar ao fio depois do último gesto do mestre. */
const ESPERA_FIO = 10_000

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __labParaJogador: (clientId: string, texto: string) => void
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
  }
}

interface Rede {
  mestre: Page
  sockets: Map<string, WebSocketRoute>
  enviados: Map<string, string[]>
  fila: Promise<void>
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri, disco de mentira e transporte de mentira
// ───────────────────────────────────────────────────────────────────────────

async function mestreNoEditor(mestre: Page): Promise<Rede> {
  const rede: Rede = { mestre, sockets: new Map(), enviados: new Map(), fila: Promise.resolve() }
  await mestre.exposeFunction('__labParaJogador', (clientId: string, texto: string) => {
    rede.enviados.get(clientId)?.push(texto)
    rede.sockets.get(clientId)?.send(texto)
  })
  await installTauriFsStub(mestre)
  await mestre.addInitScript((codigo: string) => {
    const alvo = window as unknown as JanelaDoMestre
    const internals = alvo.__TAURI_INTERNALS__
    const base = internals.invoke.bind(internals)
    const callbacks = new Map<number, HandlerTauri>()
    const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
    let proximoId = 1
    alvo.isTauri = true
    alvo.__emitTauri = (event, payload) => {
      for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
    }
    internals.transformCallback = (cb: HandlerTauri) => {
      const id = proximoId
      proximoId += 1
      callbacks.set(id, cb)
      return id
    }
    internals.invoke = async (cmd, args, options) => {
      const a = (args ?? {}) as Record<string, unknown>
      switch (cmd) {
        case 'net_start_room':
          return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
        case 'net_send':
          alvo.__labParaJogador(String(a.clientId), JSON.stringify(a.msg))
          return null
        case 'net_kick':
        case 'net_stop_room':
          return null
        case 'plugin:event|listen': {
          const id = Number(a.handler)
          const cb = callbacks.get(id)
          if (cb) ouvintes.set(id, { event: String(a.event), handler: cb })
          return id
        }
        case 'plugin:event|unlisten':
          ouvintes.delete(Number(a.eventId))
          return null
        default:
          return base(cmd, args, options)
      }
    }
  }, CODIGO)
  await mestre.goto('/')
  await mestre.getByRole('button', { name: 'Criar Mapas' }).click()
  await mestre.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await mestre.waitForSelector('canvas')
  return rede
}

/** "Adicionar token" do painel, nome digitado: a ficha nasce no centro da vista, já selecionada. */
async function mestreAdicionaFicha(mestre: Page, nome: string): Promise<void> {
  await mestre.getByRole('button', { name: 'Adicionar token' }).click()
  const campo = mestre.getByLabel('Nome do novo token')
  await campo.click()
  await campo.pressSequentially(nome, { delay: 15 })
  await mestre.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(mestre.getByRole('button', { name: 'Apagar token selecionado' }), `a ficha "${nome}" não entrou no mapa`).toBeVisible({ timeout: ESPERA })
  await expect(mestre.locator('#lb-token-name'), `o painel deveria estar na ficha "${nome}"`).toHaveValue(nome)
}

/** O controle "Nome para os jogadores" da ficha selecionada, na forma que ele tiver (rádios ou lista). */
async function controleDoNomePublico(mestre: Page): Promise<Locator> {
  const controle = mestre.getByRole('radiogroup', { name: NOME_PARA_JOGADORES }).or(mestre.getByRole('combobox', { name: NOME_PARA_JOGADORES }))
  await expect(
    controle.first(),
    `o painel da ficha selecionada deveria ter "${NOME_PARA_JOGADORES}" (O mesmo | Outro | Nenhum); hoje só há o campo "Nome" (TokenNameControls.tsx:11-24)`,
  ).toBeVisible({ timeout: ESPERA })
  return controle.first()
}

async function mestreEscolheNomePublico(mestre: Page, opcao: 'O mesmo' | 'Outro' | 'Nenhum', outro?: string): Promise<void> {
  const controle = await controleDoNomePublico(mestre)
  if ((await controle.getAttribute('role')) === 'radiogroup') await controle.getByRole('radio', { name: opcao, exact: true }).click()
  else await controle.selectOption({ label: opcao })
  if (outro === undefined) return
  const caixa = mestre.getByRole('textbox', { name: CAIXA_DO_OUTRO }).first()
  await expect(caixa, `com "Outro", deveria aparecer a caixa do nome que os jogadores veem`).toBeVisible({ timeout: ESPERA })
  await caixa.click()
  await caixa.pressSequentially(outro, { delay: 15 })
  await mestre.keyboard.press('Tab')
}

async function mestreAbreSala(mestre: Page): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  await mestre.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(mestre.getByText(CODIGO).first()).toBeVisible()
}

async function mestreAtribui(mestre: Page, jogador: string, ficha: string): Promise<void> {
  await mestre.getByRole('tab', { name: 'Jogo' }).click()
  const card = mestre.locator('#lb-rail-panel-room .lb-field').filter({ hasText: `${jogador} —` })
  await card.getByRole('button', { name: `Atribuir ${ficha}` }).click()
  await expect(card.getByRole('button', { name: `Remover ${ficha}` }), `${jogador} deveria ficar com ${ficha}`).toBeVisible()
  await mestre.getByRole('tab', { name: 'Mapa' }).click()
}

// ───────────────────────────────────────────────────────────────────────────
// Duda: player.html inteiro, no próprio navegador
// ───────────────────────────────────────────────────────────────────────────

interface Jogador {
  page: Page
  frames: string[]
}

const contextosDeJogador: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contextosDeJogador.splice(0).map((contexto) => contexto.close()))
})

async function dudaEntra(browser: Browser, baseURL: string, rede: Rede): Promise<Jogador> {
  const clientId = 'c1'
  const contexto = await browser.newContext({ baseURL, viewport: TELA })
  contextosDeJogador.push(contexto)
  const page = await contexto.newPage()
  const frames: string[] = []
  rede.enviados.set(clientId, frames)
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      rede.sockets.set(clientId, ws)
      ws.onMessage((bruto) => {
        const texto = typeof bruto === 'string' ? bruto : bruto.toString('utf8')
        rede.fila = rede.fila
          .then(() =>
            rede.mestre.evaluate(
              ({ c, t }) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) as unknown }),
              { c: clientId, t: texto },
            ),
          )
          .catch(() => undefined)
      })
    },
  )
  await page.goto('/player.html')
  const codigo = page.getByLabel('Código da sala')
  await codigo.click()
  await codigo.pressSequentially(CODIGO, { delay: 20 })
  const campoNome = page.getByLabel('Seu nome')
  await campoNome.click()
  await campoNome.pressSequentially(DUDA, { delay: 20 })
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/, { timeout: 10_000 })
  return { page, frames }
}

/** Nomes das fichas no ÚLTIMO mapa que chegou ao fio da Duda — é o que a tela dela pinta embaixo de cada ficha. */
function nomesNoUltimoMapa(frames: string[]): string[] | null {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const msg = JSON.parse(frames[i]) as { type?: string; map?: { tokens?: { name?: unknown }[] } }
    if ((msg.type === 'snapshot' || msg.type === 'delta') && Array.isArray(msg.map?.tokens)) return msg.map.tokens.map((t) => String(t.name ?? ''))
  }
  return null
}

/** Mesa: Arco e o NPC criados (a ficha escolhida por `ajuste` ajustada ANTES da sala abrir), Duda entra e recebe Arco. */
async function mesa(
  browser: Browser,
  mestre: Page,
  baseURL: string,
  ajuste: 'nenhum' | { ficha: string; opcao: 'Outro' | 'Nenhum'; outro?: string },
): Promise<Jogador> {
  const rede = await mestreNoEditor(mestre)
  // A ficha ajustada é criada por último: é ela que fica selecionada no painel.
  const ordem = ajuste !== 'nenhum' && ajuste.ficha === FICHA_DUDA ? [NPC, FICHA_DUDA] : [FICHA_DUDA, NPC]
  for (const nome of ordem) await mestreAdicionaFicha(mestre, nome)
  if (ajuste !== 'nenhum') await mestreEscolheNomePublico(mestre, ajuste.opcao, ajuste.outro)
  await mestreAbreSala(mestre)
  const duda = await dudaEntra(browser, baseURL, rede)
  await mestreAtribui(mestre, DUDA, FICHA_DUDA)
  await expect(duda.page.getByRole('button', { name: `Centralizar em ${FICHA_DUDA}` }), `o painel da Duda deveria mostrar a ficha "${FICHA_DUDA}"`).toBeVisible({
    timeout: ESPERA_FIO,
  })
  await expect.poll(() => nomesNoUltimoMapa(duda.frames)?.length ?? 0, { timeout: ESPERA_FIO, message: 'o mapa com as duas fichas não chegou ao fio da Duda' }).toBe(2)
  return duda
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: Duda entra, recebe Arco, e o fio dela traz hoje o nome de trabalho do NPC', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const duda = await mesa(browser, page, baseURL ?? '', 'nenhum')
  expect(nomesNoUltimoMapa(duda.frames)?.sort(), 'as duas fichas chegam com o nome que o mestre digitou').toEqual([FICHA_DUDA, NPC].sort())
})

test('2. a ficha sem nome público (mapa antigo, ficha recém-criada) mostra "O mesmo" marcado', async ({ page }) => {
  test.setTimeout(240_000)
  await mestreNoEditor(page)
  await mestreAdicionaFicha(page, NPC)
  const controle = await controleDoNomePublico(page)
  if ((await controle.getAttribute('role')) === 'radiogroup') {
    await expect(controle.getByRole('radio', { name: 'O mesmo', exact: true }), 'ficha sem o campo deveria estar em "O mesmo"').toBeChecked()
  } else {
    await expect(controle.locator('option:checked'), 'ficha sem o campo deveria estar em "O mesmo"').toHaveText('O mesmo')
  }
})

test('3. "Outro: Estivador" no NPC: Duda recebe "Estivador" e "traidor" não aparece no fio dela', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const duda = await mesa(browser, page, baseURL ?? '', { ficha: NPC, opcao: 'Outro', outro: PUBLICO })
  expect(nomesNoUltimoMapa(duda.frames)?.sort(), `Duda deveria ver o NPC como "${PUBLICO}"`).toEqual([FICHA_DUDA, PUBLICO].sort())
  const vazados = duda.frames.filter((f) => f.includes(SEGREDO)).map((f) => f.slice(0, 160))
  expect(vazados, `"${SEGREDO}" não pode chegar ao WebSocket da Duda`).toEqual([])
})

test('4. "Nenhum" no NPC: a ficha chega à Duda sem rótulo e sem o nome de trabalho', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const duda = await mesa(browser, page, baseURL ?? '', { ficha: NPC, opcao: 'Nenhum' })
  expect(nomesNoUltimoMapa(duda.frames)?.sort(), 'o NPC deveria chegar com nome vazio (sem rótulo embaixo da ficha)').toEqual(['', FICHA_DUDA].sort())
  expect(duda.frames.filter((f) => f.includes(SEGREDO)).length, `"${SEGREDO}" não pode chegar ao WebSocket da Duda`).toBe(0)
})

test('5. a dona vê o nome real: "Outro: Mascarado" em Arco não muda a ficha no painel da Duda', async ({ browser, page, baseURL }) => {
  test.setTimeout(240_000)
  const duda = await mesa(browser, page, baseURL ?? '', { ficha: FICHA_DUDA, opcao: 'Outro', outro: MASCARA })
  await expect(duda.page.getByRole('button', { name: `Centralizar em ${MASCARA}` }), 'a dona não pode ver a máscara no lugar do nome').toHaveCount(0)
  expect(nomesNoUltimoMapa(duda.frames), 'a ficha da Duda chega a ela com o nome real').toContain(FICHA_DUDA)
})
