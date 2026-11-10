import { AQUECER_DE_NOVO_MS, type AmbienteDoAquecimento } from '../fogo/aquecer'
import { ROTA_DA_BOLHA, URL_DO_JOGO_BOLHA, urlDoJogoBolhaPara } from './tela/BolhaOverlay'

/**
 * AQUECER A BOLHA D'ÁGUA: o mesmo do Fogo na Floresta (`minigames/fogo/aquecer.ts`),
 * para o outro jogo. Quando o mapa do jogador tem um pino da bolha, o navegador
 * começa a baixar o jogo (quase tudo o motor, `index.wasm`) com a página
 * ociosa, antes do "Apagar com bolhas" ou do convite do mestre; quando o
 * convite abre, o iframe carrega do cache.
 *
 * Só aquece quem pode jogar e não vai sentir: aparelho com mouse (o jogo se
 * mira com o mouse), sem "economia de dados" e fora de 2G; uma vez por página,
 * um arquivo de cada vez e em prioridade baixa. Nas janelas do próprio app o
 * jogo vem do disco do mestre (protocolo `minigame`): não há o que aquecer.
 *
 * Cópia do fogo, e não generalização: o do fogo guarda o estado no módulo e
 * não exporta o ambiente do navegador; mexer nele ficou fora desta entrega.
 */

/** Na ordem em que o jogo pede; o motor por último, é quase todo o peso. */
const ARQUIVOS_DO_JOGO = ['index.html', 'index.js', 'index.pck', 'index.wasm'] as const
/** Folga depois de a página ficar ociosa: o mapa acabou de chegar e ainda monta. */
const ESPERA_PARA_AQUECER_MS = 3000

function valeAquecerNoNavegador(): boolean {
  // Sem `matchMedia` não dá para saber se há mouse: não aquece.
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: fine)').matches) return false
  // `navigator.connection` só existe no Chromium (e não está no lib.dom): lido sem confiar no formato.
  if (!('connection' in navigator)) return true
  const conexao = navigator.connection
  if (typeof conexao !== 'object' || conexao === null) return true
  const economia = 'saveData' in conexao && conexao.saveData === true
  const lenta = 'effectiveType' in conexao && (conexao.effectiveType === '2g' || conexao.effectiveType === 'slow-2g')
  return !economia && !lenta
}

const ambienteDoNavegador = (): AmbienteDoAquecimento => ({
  local: window.location,
  buscar: (url, opcoes) => fetch(url, opcoes),
  quandoOcioso: (fazer) => {
    const depois = () => window.setTimeout(fazer, ESPERA_PARA_AQUECER_MS)
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(depois, { timeout: 10_000 })
    else depois()
  },
  agora: () => Date.now(),
  valeAquecer: valeAquecerNoNavegador,
})

type Estado = { tipo: 'parado'; ultima: number | null } | { tipo: 'andando' } | { tipo: 'feito' }
let estado: Estado = { tipo: 'parado', ultima: null }

/** Lê o corpo até o fim sem guardar: o cache do navegador é quem fica com ele. */
async function baixarAteOFim(resposta: Response): Promise<void> {
  const leitor = resposta.body?.getReader()
  if (leitor === undefined) return
  for (;;) {
    const { done } = await leitor.read()
    if (done) return
  }
}

async function aquecer(amb: AmbienteDoAquecimento): Promise<boolean> {
  for (const nome of ARQUIVOS_DO_JOGO) {
    const resposta = await amb.buscar(`${ROTA_DA_BOLHA}${nome}`, { priority: 'low', credentials: 'same-origin' })
    // 404 = o mestre ainda não baixou o jogo: nada a guardar por enquanto.
    if (!resposta.ok) return false
    await baixarAteOFim(resposta)
  }
  return true
}

/**
 * Chamado quando o mapa do jogador tem um pino da Bolha d'Água. Pode ser
 * chamado quantas vezes for: só a primeira (ou a seguinte a uma que não deu,
 * depois de `AQUECER_DE_NOVO_MS`) faz alguma coisa. Nunca rejeita nem avisa.
 */
export function aquecerJogoDaBolha(amb: AmbienteDoAquecimento = ambienteDoNavegador()): void {
  if (estado.tipo !== 'parado') return
  if (estado.ultima !== null && amb.agora() - estado.ultima < AQUECER_DE_NOVO_MS) return
  if (urlDoJogoBolhaPara(amb.local) !== URL_DO_JOGO_BOLHA || !amb.valeAquecer()) return
  estado = { tipo: 'andando' }
  amb.quandoOcioso(() => {
    aquecer(amb)
      .catch(() => false)
      .then((chegou) => {
        estado = chegou ? { tipo: 'feito' } : { tipo: 'parado', ultima: amb.agora() }
      })
  })
}
