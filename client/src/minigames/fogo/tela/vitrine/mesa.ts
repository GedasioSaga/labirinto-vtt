import { FUNCOES_FOGO, MINIGAME_FOGO_PADRAO } from '../../tipos'
import { criarFogoNoHost, type SaidaDoFogo } from '../../../../net/fogoNoHost'
import { FOGO_REPASSE_MS, parseFogoHostMessage, parseFogoPlayerMessage, type FogoPlayerMessage } from '../../../../net/protocoloDoFogo'
import { criarPonteDoJogo, type PonteDoJogo } from '../ponteDoJogo'
import { URL_DO_JOGO_FOGO } from '../FogoOverlay'

/**
 * MESA DE PROVA DO FOGO (só dev): a prova de ponta a ponta do repasse, sem a
 * rede do Rust. Três cópias do jogo DE VERDADE (iframes, com o robô no lugar
 * de cada pessoa: `?robo-rede=1`), cada uma com a ponte do app
 * (`ponteDoJogo.ts`), falando com o mestre do app (`fogoNoHost.ts`) por uma
 * "rede" que passa toda mensagem pelos parsers do protocolo (como o fio) e
 * atrasa cada uma de 0 a 60 ms, fora de ordem entre aparelhos.
 *
 * Parâmetros: `?n=3` (jogadores), `?dificuldade=normal`, `?semente=1000`
 * (troca a semente do começar, igual para todos, para comparar com a prova
 * do jogo: Normal, 1000, 3 jogadores, atraso 4 = vitória no tique 353).
 * O resultado fica em `window.resultadoDaMesa` e no texto da página.
 */

interface Resultado {
  pronto: boolean
  fins: { id: string; tique: number; hash: number; vitoria: boolean; pontos: number }[]
  hashes: Record<string, Record<number, number>>
  divergencia: unknown
  /** Como o mestre fechou: `fim` com o desfecho do time, ou `encerrada` (divergiu). */
  fase: string | null
  desfecho: unknown
  repasses: number
  erros: string[]
}

declare global {
  interface Window {
    resultadoDaMesa?: Resultado
  }
}

const busca = new URLSearchParams(window.location.search)
const n = Math.min(6, Math.max(1, Number(busca.get('n') ?? 3)))
const dificuldade = busca.get('dificuldade') === 'facil' ? 'facil' : busca.get('dificuldade') === 'extremo' ? 'extremo' : 'normal'
const sementeFixa = busca.has('semente') ? Number(busca.get('semente')) : null
const ATRASO_DA_REDE_MAX_MS = 60

const NOMES = ['ana', 'bia', 'caio', 'davi', 'eva', 'fabio']
const ids = NOMES.slice(0, n)
const resultado: Resultado = { pronto: false, fins: [], hashes: {}, divergencia: null, fase: null, desfecho: null, repasses: 0, erros: [] }
window.resultadoDaMesa = resultado
const relato = document.getElementById('relato')
const quadros = document.getElementById('quadros')

const atrasar = (fazer: () => void) => window.setTimeout(fazer, Math.random() * ATRASO_DA_REDE_MAX_MS)
/** O fio: JSON de ida e volta, como o WebSocket faz. */
const peloFio = (msg: object): unknown => JSON.parse(JSON.stringify(msg))

let seq = 0
const host = criarFogoNoHost({ conexaoDe: (id) => (ids.includes(id) ? id : null), randomId: () => `sessao-${(seq += 1)}` })
const pontes = new Map<string, PonteDoJogo>()
const janelas = new Map<string, HTMLIFrameElement>()

/** Do mestre ao jogador: cada saída pelo fio, com atraso próprio. A ordem por conexão se mantém (como o WebSocket). */
const filaDe = new Map<string, Promise<void>>()
function entregar(saidas: readonly SaidaDoFogo[]) {
  for (const s of saidas) {
    const anterior = filaDe.get(s.clientId) ?? Promise.resolve()
    filaDe.set(
      s.clientId,
      anterior.then(
        () =>
          new Promise<void>((pronto) =>
            atrasar(() => {
              aoJogador(s.clientId, peloFio(s.msg))
              pronto()
            }),
          ),
      ),
    )
  }
}

function aoJogador(id: string, dado: unknown) {
  const msg = parseFogoHostMessage(dado)
  const ponte = pontes.get(id)
  if (msg === null || ponte === undefined) {
    resultado.erros.push(`mensagem do mestre recusada para ${id}`)
    return
  }
  if (msg.type === 'fogo.comecar') ponte.iniciar({ ...msg, semente: sementeFixa ?? msg.semente, eu: id })
  else if (msg.type === 'fogo.entradas') ponte.entradasDosColegas(msg.lotes)
  else if (msg.type === 'fogo.sair') ponte.sair(msg.id, msg.depoisDe)
}

/** Do jogador ao mestre: pelo parser do host, como `protocol.ts` faz. */
function aoMestre(id: string, msg: FogoPlayerMessage) {
  atrasar(() => {
    const lida = parseFogoPlayerMessage(peloFio(msg))
    if (lida === null) {
      resultado.erros.push(`mensagem de ${id} recusada pelo mestre`)
      return
    }
    if (lida.type === 'fogo.entradas') entregar(host.entradas(id, lida))
    else if (lida.type === 'fogo.hash') {
      ;(resultado.hashes[id] ??= {})[lida.tique] = lida.hash
      entregar(host.hash(id, lida))
    } else if (lida.type === 'fogo.fim') {
      ;(resultado.hashes[id] ??= {})[lida.tique] = lida.hash
      resultado.fins.push({ id, tique: lida.tique, hash: lida.hash, vitoria: lida.placar.vitoria, pontos: lida.placar.pontos })
      entregar(host.fim(id, lida))
    }
    const aoVivo = host.aoVivo()
    resultado.divergencia = aoVivo?.divergencia ?? null
    resultado.fase = aoVivo?.fase ?? null
    resultado.desfecho = aoVivo?.desfecho ?? null
  })
}

const convidados = ids.map((id, i) => ({ playerId: id, nome: id, funcao: FUNCOES_FOGO[i % FUNCOES_FOGO.length] }))
const { resultado: convite } = host.convidar({ pinId: 'mesa', minigame: { ...MINIGAME_FOGO_PADRAO } }, 'equipe', convidados)
if (!convite.ok) throw new Error('convite recusado')
const sessao = convite.sessao
let carregados = 0

for (const id of ids) {
  const quadro = document.createElement('iframe')
  quadro.title = `jogo de ${id}`
  quadro.src = `${URL_DO_JOGO_FOGO}?robo-rede=1`
  quadros?.append(quadro)
  janelas.set(id, quadro)
  const ponte = criarPonteDoJogo({
    janela: () => quadro.contentWindow,
    enviar: (texto) => quadro.contentWindow?.postMessage(texto, window.location.origin),
    saida: {
      entradas: (de, lista) => (aoMestre(id, { type: 'fogo.entradas', sessao, de, lista }), true),
      hash: (tique, hash) => (aoMestre(id, { type: 'fogo.hash', sessao, tique, hash }), true),
      fim: (tique, hash, placar) => (aoMestre(id, { type: 'fogo.fim', sessao, tique, hash, placar }), true),
    },
    repassarMinhas: true,
    aoMudar: (estado, erro) => {
      if (erro !== undefined) resultado.erros.push(`${id}: ${erro}`)
      // Todos carregados: todos "Pronto", e o mestre começa.
      if (estado === 'esperando' && (carregados += 1) === ids.length) {
        for (const c of convidados) host.pronto(c.playerId, { type: 'fogo.pronto', sessao, funcao: c.funcao })
        entregar(host.comecar(dificuldade) ?? [])
        resultado.pronto = true
      }
    },
  })
  pontes.set(id, ponte)
}

window.addEventListener('message', (ev) => {
  for (const ponte of pontes.values()) ponte.receber({ source: ev.source, data: ev.data })
})
window.setInterval(() => {
  for (const ponte of pontes.values()) ponte.repassar()
  const saidas = host.repassar()
  if (saidas.length > 0) resultado.repasses += 1
  entregar(saidas)
  if (relato !== null) relato.textContent = JSON.stringify({ ...resultado, hashes: undefined, hashesPorJogador: Object.fromEntries(Object.entries(resultado.hashes).map(([k, v]) => [k, Object.keys(v).length])) }, null, 1)
}, FOGO_REPASSE_MS)
