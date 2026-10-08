import { cleanPlayerName } from '../../lib/chat'
import { SAVED_EXPLORATION_VERSION, SAVED_TABLE_VERSION, type SavedExploration, type SavedSceneMemory, type SavedTable } from '../../lib/savedTable'
import { tokenFillColor } from '../../lib/tokenColor'
import type { MapData, Token } from '../../types/map'
import type { ToastSink } from '../avisosDaPonte'
import { createHostBridge, type HostBridge, type HostBridgeDeps } from '../hostBridge'
import type { HostWorld } from '../hostSession'
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../protocol'
import { criarAvisosDeTeste, type AvisosDeTeste } from './avisosDeTeste'
import type { Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import { lerMensagemDaJanela, type MensagemDaJanela, type MensagemDoHost } from './protocoloDoCanal'
import { sementeDosAssentos, type SementeDoDono } from './semente'
import type { FichaParaTeste } from './tipos'
import { criarTransporteLocal, type TransporteLocal } from './transporteLocal'

/**
 * VISÃO DE JOGADOR — o controlador, na janela principal.
 *
 * O host de teste roda AQUI: uma segunda ponte (`createHostBridge`), só para
 * o jogador de teste, lendo o mesmo mundo vivo do editor e falando com a
 * janela de teste por um transporte falso (`transporteLocal.ts`) sobre o
 * canal. A janela de teste é só o cliente do jogador.
 *
 * Nada do teste toca o jogo de verdade: esta ponte não tem escritor de store
 * (mover, porta e o resto não fazem nada nesta entrega: o modo Olhar não age),
 * não grava mesa, explorado nem chat, não tem sala real nem jogadores reais, e
 * os avisos dela passam pelo filtro do teste (`avisosDeTeste.ts`). Este
 * módulo não importa store nenhuma: o mundo entra por `getMap`/`getWorld`.
 *
 * A MEMÓRIA DO DONO entra só por leitura (`lerSementeDoDono`): com a sala
 * aberta, da ponte da sala, que só expõe aqui o que lê (`seatSeedFor`); com
 * ela fechada, da mesa e do explorado gravados. O teste começa com o que o
 * dono já explorou, o raio e o fator dele; "Esquecer tudo" zera a memória do
 * jogador de TESTE, e o dono de verdade continua lembrando de tudo.
 *
 * Uma janela por vez. Escolher outra ficha (no painel, no "Trocar ficha" da
 * janela ou no "Ver tela" do Grupo) recomeça a ponte de teste com a ficha nova
 * na MESMA janela: a névoa passa a ser a dela. Ponte nova a cada troca é uma
 * GERAÇÃO; a janela sabe pela `geracao` do `config` que deve largar a conexão
 * de antes.
 */

/** O host pergunta se a janela está viva a cada… */
export const PING_DA_VISAO_MS = 2_000
/** …e sem resposta por este tempo dá a janela por morta (recarregar a janela no meio continua a sessão). */
export const PRAZO_SEM_RESPOSTA_MS = 10_000
/** Antes da primeira resposta, o prazo é maior: a janela nova ainda está carregando o app. */
export const PRAZO_DA_PRIMEIRA_RESPOSTA_MS = 30_000

/** Nome do jogador de teste quando nem o dono nem a ficha dão um nome que sirva no `join`. */
export const NOME_PADRAO_DO_TESTE = 'Teste'

/** Letras do código da sala que o Rust sorteia (sem I, L, O, 0 e 1): a mesa-semente o aceita de volta. */
const LETRAS_DO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const TAMANHO_DO_CODIGO = 6

export interface EstadoDaVisao {
  aberta: boolean
  /** A ficha olhada agora; `null` com a janela fechada. */
  ficha: FichaParaTeste | null
}

export const VISAO_FECHADA: EstadoDaVisao = { aberta: false, ficha: null }

/**
 * O que o teste pode pedir à ponte da sala de verdade: só a leitura. O tipo é
 * a cerca: daqui não se alcança nenhum método que mande ou grave algo.
 */
export type LeituraDaSala = Pick<HostBridge, 'room' | 'seatSeedFor'>

/** De onde vem a memória do dono. Ausentes = o teste começa do zero. */
export interface FontesDaSemente {
  /** A ponte da sala de verdade (aberta ou não); `null` = nenhuma ainda. */
  ponteDaSala?: () => LeituraDaSala | null
  /** A mesa gravada desta aventura (a do disco), para quando a sala está fechada. */
  mesaGuardada?: () => SavedTable | null
  /** O explorado gravado desta aventura, junto com a mesa. */
  exploradoGuardado?: () => SavedExploration | null
}

export interface DepsDaVisao extends FontesDaSemente {
  /** O mundo vivo do editor: os mesmos da ponte da sala. */
  getMap: () => MapData
  getWorld: () => HostWorld
  getTurn?: HostBridgeDeps['getTurn']
  getClock?: HostBridgeDeps['getClock']
  /** A pilha de avisos do editor: os do teste entram nela marcados "Teste ·". */
  avisos: ToastSink
  abrirCanal: () => Canal
  criarJanela: (aoFecharPorFora: () => void) => JanelaDeTeste
  novaSessao?: () => string
  novoCodigo?: () => string
  agora?: () => number
}

export interface ControladorDaVisao {
  /** Mesma referência enquanto nada muda: serve de `getSnapshot`. */
  estado(): EstadoDaVisao
  assinar(ouvinte: () => void): () => void
  /** Escolheu a ficha na lista: abre a janela com ela, ou troca a ficha da janela já aberta. */
  abrir(tokenId: string): void
  /**
   * "Ver tela" do Grupo: abre a janela (ou troca a da janela aberta) na
   * `ficha` dada, que pode estar numa cena de fundo, fora da lista do painel.
   */
  verTela(ficha: FichaParaTeste): void
  /** Traz a janela aberta para a frente. */
  mostrar(): void
  /** Fecha o teste inteiro: ponte, avisos, canal e janela. Idempotente. */
  fechar(): void
  /** As fichas da lista (a cena aberta no editor) e a selecionada no mapa: a barra da janela acompanha. */
  definirFichas(fichas: readonly FichaParaTeste[], fichaSelecionadaId: string | null): void
  /** A ponte de teste viva, para o editor avisar as mudanças do mundo; `null` sem teste. */
  ponte(): HostBridge | null
}

interface Sessao {
  id: string
  canal: Canal
  pararDeOuvir: () => void
  janela: JanelaDeTeste
  tokenId: string
  geracao: number
  ponte: HostBridge | null
  transporte: TransporteLocal | null
  /** Os avisos da ponte da geração atual: saem da tela junto com ela. */
  avisos: AvisosDeTeste | null
  /**
   * "Esquecer tudo" já foi pedido para esta ficha: recarregar a janela não
   * devolve a memória do dono. Trocar de ficha zera.
   */
  semMemoria: boolean
  /** A janela já falou alguma vez (o app dela carregou). */
  respondeu: boolean
  ultimaResposta: number
  relogio: ReturnType<typeof setInterval>
}

/** A ponte de teste não grava nada no mapa nesta entrega: o modo Olhar não age, e a guarda do socket garante. */
const SEM_EFEITO = (): void => {}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function codigoAleatorio(): string {
  const sorteio = crypto.getRandomValues(new Uint32Array(TAMANHO_DO_CODIGO))
  return Array.from(sorteio, (n) => LETRAS_DO_CODIGO[n % LETRAS_DO_CODIGO.length]).join('')
}

/** Corta por letra (nunca no meio de um emoji) no teto do nome do `join`. */
function cortarNome(nome: string): string {
  let cortado = ''
  for (const letra of nome) {
    if (cortado.length + letra.length > NAME_MAX_LENGTH) break
    cortado += letra
  }
  return cortado.trim()
}

/** Com que nome o jogador de teste entra: o do dono da ficha, senão o da ficha. */
export function nomeDoJogadorDeTeste(ficha: FichaParaTeste): string {
  const nome = cortarNome(cleanPlayerName(ficha.dono ?? ficha.nome))
  return nome.length >= NAME_MIN_LENGTH ? nome : NOME_PADRAO_DO_TESTE
}

/** Quem tem ficha: um jogador da sala aberta ou um assento da mesa guardada. */
interface DonoDeFichas {
  name: string
  tokenIds: readonly string[]
}

/** O dono de cada ficha (`tokenId` -> nome): os jogadores da sala aberta ou, com ela fechada, os assentos da mesa guardada. */
export function donosDasFichas(donos: readonly DonoDeFichas[]): Map<string, string> {
  const porFicha = new Map<string, string>()
  for (const dono of donos) {
    for (const tokenId of dono.tokenIds) if (!porFicha.has(tokenId)) porFicha.set(tokenId, dono.name)
  }
  return porFicha
}

/** Uma ficha na Visão de jogador. O retrato é só a cópia embutida (`imageData`), nunca o caminho do disco do mestre. */
export function fichaParaTeste(token: Token, dono: string | null): FichaParaTeste {
  return {
    id: token.id,
    nome: token.name,
    retrato: token.imageData ?? null,
    cor: `#${tokenFillColor(token).toString(16).padStart(6, '0')}`,
    dono,
    npc: token.npc === true,
  }
}

/** A lista da Visão de jogador: as fichas da cena aberta no editor. */
export function fichasParaTeste(tokens: readonly Token[], donos: ReadonlyMap<string, string>): FichaParaTeste[] {
  return tokens.map((token) => fichaParaTeste(token, donos.get(token.id) ?? null))
}

/** A ficha `tokenId` em qualquer cena que o host serve (a do "Ver tela" pode estar numa de fundo); `null` = sumiu. */
export function fichaDoMundo(world: HostWorld, tokenId: string, dono: string | null): FichaParaTeste | null {
  for (const cena of [world.open, ...world.background]) {
    const token = cena.map.tokens.find((t) => t.id === tokenId)
    if (token !== undefined) return fichaParaTeste(token, dono)
  }
  return null
}

/** As duas listas mostram o mesmo (a ficha andar no mapa não muda nada da lista): dá para manter a de antes. */
export function mesmasFichas(a: readonly FichaParaTeste[], b: readonly FichaParaTeste[]): boolean {
  if (a.length !== b.length) return false
  return a.every((ficha, i) => {
    const outra = b[i]
    return (
      outra !== undefined &&
      ficha.id === outra.id &&
      ficha.nome === outra.nome &&
      ficha.retrato === outra.retrato &&
      ficha.cor === outra.cor &&
      ficha.dono === outra.dono &&
      ficha.npc === outra.npc
    )
  })
}

/**
 * A mesa-semente da ponte de teste: um assento só, com a ficha e o raio do
 * dono. É o caminho de "Retomar a mesa": quem entra com o nome do assento pega
 * a ficha (e a memória de `exploradoSemente`) sem pedir a ninguém.
 */
export function mesaSemente(codigo: string, nome: string, tokenId: string, world: HostWorld, semente: SementeDoDono | null): SavedTable {
  const cena = [world.open, ...world.background].find((scene) => scene.map.tokens.some((token) => token.id === tokenId))
  const visionRadius = semente === null ? null : semente.visionRadius
  return { version: SAVED_TABLE_VERSION, code: codigo, seats: [{ name: nome, tokenIds: [tokenId], visionRadius, sceneKey: cena?.map.id ?? null }] }
}

/**
 * O explorado-semente: a memória do dono no assento do jogador de teste. Vai
 * com o nome de TESTE (não o do dono): é por ele que a sessão de teste acha o
 * assento. Sem cena nenhuma, `null` (a névoa começa do zero).
 */
export function exploradoSemente(nome: string, cenas: readonly SavedSceneMemory[]): SavedExploration | null {
  if (cenas.length === 0) return null
  return { version: SAVED_EXPLORATION_VERSION, seats: [{ name: nome, scenes: [...cenas] }] }
}

/**
 * A memória do dono da ficha, só LENDO. Com a sala aberta, a sessão viva é a
 * verdade (o disco pode estar atrás dela): se ela não conhece dono, não há
 * dono. Com a sala fechada, a mesa e o explorado gravados desta aventura. Sem
 * dono, `null`: o teste começa do zero.
 */
export function lerSementeDoDono(fontes: FontesDaSemente, tokenId: string): SementeDoDono | null {
  const sala = fontes.ponteDaSala === undefined ? null : fontes.ponteDaSala()
  if (sala !== null && sala.room() !== null) return sala.seatSeedFor(tokenId)
  const mesa = fontes.mesaGuardada === undefined ? null : fontes.mesaGuardada()
  if (mesa === null) return null
  const explorado = fontes.exploradoGuardado === undefined ? null : fontes.exploradoGuardado()
  // O fator de visão não vai para o disco: com a sala fechada, o teste usa o de fábrica.
  return sementeDosAssentos(mesa.seats, explorado === null ? [] : explorado.seats, tokenId, null)
}

export function criarControladorDaVisao(deps: DepsDaVisao): ControladorDaVisao {
  // Lido na hora (e não `Date.now` guardado): o relógio de quem testa vale a partir de quando ligar.
  const agora = deps.agora ?? (() => Date.now())
  const novaSessao = deps.novaSessao ?? (() => crypto.randomUUID())
  const novoCodigo = deps.novoCodigo ?? codigoAleatorio
  let fichas: readonly FichaParaTeste[] = []
  let fichaSelecionadaId: string | null = null
  let sessao: Sessao | null = null
  let estadoAtual: EstadoDaVisao = VISAO_FECHADA
  const ouvintes = new Set<() => void>()
  /** Erros da própria janela (não abriu, não fechou): ficam na tela depois de o teste acabar, para o mestre ler. */
  const avisosDaJanela = criarAvisosDeTeste(deps.avisos)

  const mudarEstado = (proximo: EstadoDaVisao) => {
    if (proximo.aberta === estadoAtual.aberta && proximo.ficha === estadoAtual.ficha) return
    estadoAtual = proximo
    for (const ouvinte of [...ouvintes]) ouvinte()
  }

  const enviar = (s: Sessao, mensagem: MensagemDoHost) => s.canal.enviar(mensagem)

  /** A ficha `tokenId` da lista; fora dela (o mestre a apagou ou trocou de cena), a que a janela já mostrava. */
  const fichaDe = (tokenId: string): FichaParaTeste | null =>
    fichas.find((ficha) => ficha.id === tokenId) ?? (estadoAtual.ficha?.id === tokenId ? estadoAtual.ficha : null)

  /** Larga a ponte da geração atual. `avisarJanela` falso: a janela não vê o "sala encerrada" de uma troca de ficha. */
  const encerrarPonte = (s: Sessao, avisarJanela: boolean) => {
    const { ponte, transporte, avisos } = s
    s.ponte = null
    s.transporte = null
    s.avisos = null
    if (!avisarJanela) transporte?.desligar()
    // O `room.closed` sai já, dentro do `stop`: o transporte só desliga depois.
    const parada = ponte?.stop() ?? Promise.resolve()
    transporte?.desligar()
    avisos?.dispensarTodos()
    // O que a ponte ainda puser enquanto fecha também sai.
    const dispensar = () => avisos?.dispensarTodos()
    void parada.then(dispensar, dispensar)
  }

  /** (Re)começa a ponte de teste com a ficha da sessão: uma geração nova. */
  const iniciarGeracao = (s: Sessao) => {
    const daLista = fichaDe(s.tokenId)
    if (daLista === null) return
    encerrarPonte(s, false)
    s.geracao += 1
    const geracao = s.geracao
    const codigo = novoCodigo()
    // Lida a cada geração: abrir, recarregar a janela e trocar de ficha começam com a memória de AGORA do dono.
    const semente = lerSementeDoDono(deps, daLista.id)
    // A barra diz de quem é a ficha sempre que o dono é conhecido, mesmo quando a lista não sabia.
    const ficha = daLista.dono === null && semente !== null ? { ...daLista, dono: semente.nome } : daLista
    const nome = nomeDoJogadorDeTeste(ficha)
    const cenas = semente === null || s.semMemoria ? [] : semente.cenas
    // O fator não vai na mesa: entra quando o jogador de teste pegar a ficha, uma vez por geração.
    let fatorPendente = semente === null ? null : semente.visionFactor
    const transporte = criarTransporteLocal({ sessao: s.id, geracao, codigo, enviar: (mensagem) => enviar(s, mensagem) })
    const avisos = criarAvisosDeTeste(deps.avisos)
    const ponte = createHostBridge({
      invoke: transporte.invoke,
      listen: transporte.listen,
      getMap: deps.getMap,
      getWorld: deps.getWorld,
      getTurn: deps.getTurn,
      getClock: deps.getClock,
      applyMove: SEM_EFEITO,
      applyDoor: SEM_EFEITO,
      loadTable: () => mesaSemente(codigo, nome, ficha.id, deps.getWorld(), semente),
      loadExploration: () => exploradoSemente(nome, cenas),
      onPlayersChange: (jogadores) => {
        if (fatorPendente === null) return
        const jogador = jogadores.find((j) => j.tokenIds.includes(ficha.id))
        if (jogador === undefined) return
        const fator = fatorPendente
        fatorPendente = null
        ponte.setVisionFactor(jogador.playerId, fator)
      },
      toasts: avisos,
    })
    s.ponte = ponte
    s.transporte = transporte
    s.avisos = avisos
    ponte.start({ resume: true }).then(
      () => {
        if (sessao !== s || s.geracao !== geracao) return
        enviar(s, { de: 'host', tipo: 'config', sessao: s.id, geracao, codigo, nome, ficha, fichas: [...fichas], fichaSelecionadaId })
      },
      () => {
        // A ponte já pôs o motivo no aviso do teste ("Teste · Não foi possível abrir a sala").
      },
    )
  }

  const aoMensagem = (s: Sessao, mensagem: MensagemDaJanela) => {
    s.respondeu = true
    s.ultimaResposta = agora()
    switch (mensagem.tipo) {
      case 'ola':
        // Janela nova ou recarregada: a conexão de antes morreu com a página, então a ponte recomeça.
        iniciarGeracao(s)
        return
      case 'pong':
        return
      case 'trocar-ficha': {
        const ficha = fichaDe(mensagem.tokenId)
        if (ficha !== null) trocarFicha(s, ficha)
        return
      }
      case 'esquecer':
        esquecerTudo(s)
        return
      case 'pedir-fechar':
        fechar()
        return
      default:
        s.transporte?.receber(mensagem)
    }
  }

  const trocarFicha = (s: Sessao, ficha: FichaParaTeste) => {
    if (ficha.id === s.tokenId) return
    s.tokenId = ficha.id
    // A ficha nova começa com a memória do dono dela: o "Esquecer tudo" era da outra.
    s.semMemoria = false
    mudarEstado({ aberta: true, ficha })
    // Janela ainda carregando: o `ola` dela já começa com a ficha nova.
    if (s.respondeu) iniciarGeracao(s)
  }

  /** "Esquecer tudo": só o jogador de TESTE esquece (a ponte de teste só tem ele); a névoa da janela muda na hora. */
  const esquecerTudo = (s: Sessao) => {
    s.semMemoria = true
    const ponte = s.ponte
    if (ponte === null) return
    for (const jogador of ponte.players()) ponte.forgetPlayerMemory(jogador.playerId)
  }

  const conferirVida = (s: Sessao) => {
    if (sessao !== s) return
    enviar(s, { de: 'host', tipo: 'ping', sessao: s.id })
    const prazo = s.respondeu ? PRAZO_SEM_RESPOSTA_MS : PRAZO_DA_PRIMEIRA_RESPOSTA_MS
    if (agora() - s.ultimaResposta > prazo) fechar()
  }

  function fechar(): void {
    const s = sessao
    if (s === null) return
    sessao = null
    clearInterval(s.relogio)
    s.pararDeOuvir()
    encerrarPonte(s, true)
    enviar(s, { de: 'host', tipo: 'encerrar', sessao: s.id })
    s.canal.fechar()
    s.janela.fechar().then(
      () => s.janela.desligar(),
      (error: unknown) => {
        s.janela.desligar()
        avisosDaJanela.push('error', `Não deu para fechar a janela da Visão de jogador: ${errorText(error)}`)
      },
    )
    mudarEstado(VISAO_FECHADA)
  }

  const abrirSessao = (ficha: FichaParaTeste) => {
    const id = novaSessao()
    const canal = deps.abrirCanal()
    const s: Sessao = {
      id,
      canal,
      pararDeOuvir: () => {},
      janela: deps.criarJanela(() => {
        if (sessao === s) fechar()
      }),
      tokenId: ficha.id,
      geracao: 0,
      ponte: null,
      transporte: null,
      avisos: null,
      semMemoria: false,
      respondeu: false,
      ultimaResposta: agora(),
      relogio: setInterval(() => conferirVida(s), PING_DA_VISAO_MS),
    }
    s.pararDeOuvir = canal.ouvir((dado) => {
      if (sessao !== s) return
      const mensagem = lerMensagemDaJanela(dado, id)
      if (mensagem !== null) aoMensagem(s, mensagem)
    })
    sessao = s
    mudarEstado({ aberta: true, ficha })
    s.janela.abrir(id).catch((error: unknown) => {
      if (sessao !== s) return
      avisosDaJanela.push('error', `Não deu para abrir a janela da Visão de jogador: ${errorText(error)}`)
      fechar()
    })
  }

  /** Uma janela por vez: com ela aberta, troca a ficha e a traz para a frente; fechada, abre. */
  const abrirNaFicha = (ficha: FichaParaTeste) => {
    const s = sessao
    if (s === null) {
      abrirSessao(ficha)
      return
    }
    trocarFicha(s, ficha)
    void s.janela.mostrar()
  }

  return {
    estado: () => estadoAtual,
    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    abrir(tokenId) {
      const ficha = fichaDe(tokenId)
      if (ficha !== null) abrirNaFicha(ficha)
    },
    verTela: abrirNaFicha,
    mostrar() {
      const s = sessao
      if (s === null) return
      void s.janela.mostrar().then((existe) => {
        // O Rust (ou o navegador) diz que a janela não existe mais: o teste acabou junto.
        if (!existe && sessao === s) fechar()
      })
    },
    fechar,
    definirFichas(novas, selecionada) {
      fichas = novas
      fichaSelecionadaId = selecionada
      const s = sessao
      if (s === null) return
      const atual = novas.find((ficha) => ficha.id === s.tokenId)
      // Nome ou retrato da ficha olhada mudou no editor: o painel mostra o de agora.
      if (atual !== undefined) mudarEstado({ aberta: true, ficha: atual })
      if (s.respondeu) enviar(s, { de: 'host', tipo: 'fichas', sessao: s.id, fichas: [...novas], fichaSelecionadaId: selecionada })
    },
    ponte: () => sessao?.ponte ?? null,
  }
}
