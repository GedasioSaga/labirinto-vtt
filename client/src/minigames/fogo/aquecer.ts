import { ROTA_DO_FOGO, URL_DO_JOGO_FOGO, urlDoJogoFogoPara } from './tela/FogoOverlay'

/**
 * AQUECER O JOGO DO FOGO: quando o mapa do jogador tem um pino do Fogo na
 * Floresta, o navegador começa a baixar o jogo (10 MB em gzip, quase tudo o
 * motor) com a página ociosa, antes de alguém tocar em "Apagar o fogo" ou de o
 * mestre chamar. O que chega fica no cache do navegador; quando o convite
 * abre, o iframe do jogo só confere o `ETag` com a sala (resposta 304, sem
 * corpo) e carrega do disco.
 *
 * Só aquece quem pode jogar e não vai sentir: aparelho com mouse (o jogo não
 * tem toque), sem "economia de dados" e fora de rede 2G; uma vez por página,
 * um arquivo de cada vez e em prioridade baixa, para não disputar a rede com
 * as imagens do mapa. Nas janelas do próprio app (a Visão de jogador) o jogo
 * vem do disco do mestre pelo protocolo `minigame`: não há o que aquecer.
 */

/** Na ordem em que o jogo pede; o motor (`index.wasm`) por último, é quase todo o peso. */
const ARQUIVOS_DO_JOGO = ['index.html', 'index.js', 'index.pck', 'index.wasm'] as const
/** Depois de uma tentativa que não chegou ao fim (o mestre ainda sem o pacote, rede que caiu), só tenta de novo passado isto. */
export const AQUECER_DE_NOVO_MS = 60_000

/** O mundo de fora; o teste troca por um falso. */
export interface AmbienteDoAquecimento {
  local: Pick<Location, 'protocol' | 'hostname'>
  buscar(url: string, opcoes: RequestInit): Promise<Response>
  /** Roda `fazer` quando a página estiver ociosa. */
  quandoOcioso(fazer: () => void): void
  agora(): number
  /** Este aparelho joga (mouse) e a rede aguenta 10 MB sem a pessoa pedir. */
  valeAquecer(): boolean
}

interface ConexaoDoNavegador {
  saveData?: boolean
  effectiveType?: string
}

function valeAquecerNoNavegador(): boolean {
  // Sem `matchMedia` (navegador muito antigo, ambiente de teste) não dá para saber se há mouse: não aquece.
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: fine)').matches) return false
  const conexao = (navigator as Navigator & { connection?: ConexaoDoNavegador }).connection
  return conexao?.saveData !== true && conexao?.effectiveType !== '2g' && conexao?.effectiveType !== 'slow-2g'
}

/** Folga depois de a página ficar ociosa: o mapa acabou de chegar e ainda monta. */
const ESPERA_PARA_AQUECER_MS = 3000

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

/** Lê o corpo até o fim sem guardar (são 38 MB descompactados): o cache do navegador é quem fica com ele. */
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
    // `priority` é só um pedido ao navegador (o Chromium atende); onde não existe, é ignorado.
    const resposta = await amb.buscar(`${ROTA_DO_FOGO}${nome}`, { priority: 'low', credentials: 'same-origin' })
    // 404 = o mestre ainda não baixou o jogo: nada a guardar por enquanto.
    if (!resposta.ok) return false
    await baixarAteOFim(resposta)
  }
  return true
}

/**
 * Chamado quando o mapa do jogador tem um pino do Fogo na Floresta. Pode ser
 * chamado quantas vezes for: só a primeira (ou a seguinte a uma que não deu,
 * depois de `AQUECER_DE_NOVO_MS`) faz alguma coisa. Nunca rejeita nem avisa
 * na tela: se não der, o convite carrega o jogo como sempre.
 */
export function aquecerJogoDoFogo(amb: AmbienteDoAquecimento = ambienteDoNavegador()): void {
  if (estado.tipo !== 'parado') return
  if (estado.ultima !== null && amb.agora() - estado.ultima < AQUECER_DE_NOVO_MS) return
  if (urlDoJogoFogoPara(amb.local) !== URL_DO_JOGO_FOGO || !amb.valeAquecer()) return
  estado = { tipo: 'andando' }
  amb.quandoOcioso(() => {
    aquecer(amb)
      .catch(() => false)
      .then((chegou) => {
        estado = chegou ? { tipo: 'feito' } : { tipo: 'parado', ultima: amb.agora() }
      })
  })
}

/** Só para teste: volta ao estado de página recém-aberta. */
export function esquecerAquecimentoDoFogo(): void {
  estado = { tipo: 'parado', ultima: null }
}
