/**
 * DESAFIOS: o minigame fora do pino (Fase B do pedido de 15/11/2026). O
 * desafio é entidade própria do mapa (`MapData.desafios`, `types/map.ts`):
 * fica num ponto, num objeto ou em lugar nenhum, e no mapa é um selo de latão.
 *
 * Na mesa ele continua sendo o pino de minigame que o jogador já conhece: o
 * recorte (`lib/fogFilter.ts`) e o host (`net/hostSession.ts`) trabalham com
 * o PINO DERIVADO (`pinoDoDesafio`), de mesmo id. Assim o cartão, o "Pescar",
 * o alcance e o "Quem vê" do jogador seguem idênticos, e o desenho do pino de
 * minigame virou o selo (`pixi/drawPins.ts`).
 */
import type { Desafio, LugarDoDesafio, MapData, Pin, Prop, TipoDoLugarDoDesafio } from '../types/map'
import type { JogoDoMinigame, MinigameDoPino } from '../minigames/tipos'
import { ehJogoDoRegistro, entradaDoMinigame, nomeDoJogoDoDesafio, padraoDoJogo, REGISTRO_DE_MINIGAMES, type EntradaDoDesafio } from '../minigames/registro'
import type { ProgressoDoPuzzle } from '../puzzles/tipos'
import { ALAVANCA_LUGAR_MAX_LENGTH, CONVITE_DA_CENA_ALAVANCA } from '../minigames/alavanca/tipos'
import { FALA_DO_CENARIO_BOLHA, MINIGAME_BOLHA_PADRAO } from '../minigames/bolha/tipos'
import { FALA_MAX_LENGTH, NPC_MAX_LENGTH } from '../minigames/danca/tipos'
import { FLORESTA_MAX_LENGTH } from '../minigames/fogo/tipos'
import { LAGO_MAX_LENGTH } from '../minigames/pesca/tipos'
import { BARRACA_MAX_LENGTH } from '../minigames/tiro/tipos'
import { escalaDoPino, isPinEscala, PIN_ESCALA_MAX, PIN_ESCALA_MIN } from './pins'
import { normalizeRotation } from './roomRotation'

/** Teto do nome do desafio (o mesmo do nome do pino). */
export const DESAFIO_NOME_MAX_LENGTH = 60

export function desafiosDo(map: Pick<MapData, 'desafios'>): readonly Desafio[] {
  return map.desafios ?? []
}

/**
 * O LUGAR NO CONVITE do jogo ("Poço Afogado", "Barraca do Ferrolho", "Mata do
 * Pinheiral", "Portão de Valverde"): o lago da pesca, a barraca do tiro, a
 * floresta do fogo e o lugar da alavanca. A dança, a bolha e o puzzle não têm.
 */
export function lugarDoConvite(minigame: MinigameDoPino): string | null {
  if (minigame.jogo === 'pesca') return minigame.lago
  if (minigame.jogo === 'tiro') return minigame.barraca
  if (minigame.jogo === 'fogo') return minigame.floresta
  if (minigame.jogo === 'alavanca') return minigame.lugar
  return null
}

/**
 * O NOME AUTOMÁTICO (editor de desafio aprovado em 21/11/2026, decisão 2):
 * segue o jogo, a cena da alavanca e quem chama ("Fogo na Floresta com Guarda
 * Florêncio"); sem ninguém, o lugar do convite ("Pesca: Poço Afogado"); o
 * puzzle, o nome dele ("Puzzle: A Fonte"). A alavanca não leva o lugar: o
 * nome da cena já diz onde é.
 */
export function nomeAutomatico(desafio: Pick<Desafio, 'minigame'>): string {
  const minigame = desafio.minigame
  const jogo = nomeDoJogoDoDesafio(minigame)
  if (minigame.jogo === 'puzzle') {
    const doPuzzle = typeof minigame.puzzle.nome === 'string' ? minigame.puzzle.nome.trim() : ''
    // O nome que já diz "Puzzle" ("Puzzle novo (Fonte)") não repete a palavra.
    const jaDiz = doPuzzle.toLocaleLowerCase('pt-BR').startsWith(jogo.toLocaleLowerCase('pt-BR'))
    return (doPuzzle === '' ? jogo : jaDiz ? doPuzzle : `${jogo}: ${doPuzzle}`).slice(0, DESAFIO_NOME_MAX_LENGTH)
  }
  const npc = typeof minigame.npc === 'string' ? minigame.npc.trim() : ''
  if (npc !== '') return `${jogo} com ${npc}`.slice(0, DESAFIO_NOME_MAX_LENGTH)
  const lugar = minigame.jogo === 'alavanca' ? '' : (lugarDoConvite(minigame) ?? '').trim()
  return (lugar === '' ? jogo : `${jogo}: ${lugar}`).slice(0, DESAFIO_NOME_MAX_LENGTH)
}

/**
 * OS NOMES DE FÁBRICA de antes do nome automático (migração, NOTAS §5.4): o
 * que "Novo desafio" e a troca de cena davam a cada jogo, com e sem quem
 * desafia. Lista fixa de propósito: é o que os mapas de antes guardam, mude o
 * padrão dos jogos ou não. Um desafio de Fogo chamado "Dança com Dona Ziza"
 * (o bug de 21/11/2026) volta ao automático ao abrir.
 */
const NOMES_DE_FABRICA: ReadonlySet<string> = new Set([
  'Dança com Dona Ziza',
  'Pesca com Bento, o barqueiro',
  'Tiro com Tia Ferrolha',
  'Fogo na Floresta com Guarda Florêncio',
  "Bolha d'Água com Dona Aurélia",
  'Alavanca da ponte',
  'Alavanca do canhão',
  'Puzzle',
  'Dança',
  'Pesca',
  'Tiro',
  'Fogo na Floresta',
  "Bolha d'Água",
])

/**
 * O nome que o desafio grava, pelo texto que veio (o campo do mestre, o
 * arquivo ou o pino ▷): vazio, um nome de fábrica ou o próprio automático =
 * o automático, sem `nomeProprio`; qualquer outro texto é do mestre e fica.
 */
export function nomeDoDesafio(desafio: Pick<Desafio, 'minigame'>, texto: unknown): Pick<Desafio, 'nome' | 'nomeProprio'> {
  const automatico = nomeAutomatico(desafio)
  const limpo = typeof texto === 'string' ? texto.trim().slice(0, DESAFIO_NOME_MAX_LENGTH) : ''
  if (limpo === '' || limpo === automatico || NOMES_DE_FABRICA.has(limpo)) return { nome: automatico }
  return { nome: limpo, nomeProprio: true }
}

/** Teto de quem chama, da fala e do lugar do convite de cada jogo (os mesmos da leitura do disco). */
export const QUEM_CHAMA_MAX_LENGTH = NPC_MAX_LENGTH
export const FALA_DO_CONVITE_MAX_LENGTH = FALA_MAX_LENGTH
export const LUGAR_DO_CONVITE_MAX_LENGTH: Readonly<Record<'pesca' | 'tiro' | 'fogo' | 'alavanca', number>> = {
  pesca: LAGO_MAX_LENGTH,
  tiro: BARRACA_MAX_LENGTH,
  fogo: FLORESTA_MAX_LENGTH,
  alavanca: ALAVANCA_LUGAR_MAX_LENGTH,
}

/** O CONVITE do desafio (decisão 5): quem chama, o que diz e o lugar no convite (`null` = o jogo não tem). */
export interface ConviteDoDesafio {
  npc: string
  fala: string
  lugar: string | null
}

/** O convite gravado no desafio. O puzzle não tem convite: tudo vazio. */
export function conviteDo(minigame: MinigameDoPino): ConviteDoDesafio {
  if (minigame.jogo === 'puzzle') return { npc: '', fala: '', lugar: null }
  return { npc: minigame.npc, fala: minigame.fala, lugar: lugarDoConvite(minigame) }
}

/**
 * O EXEMPLO DO JOGO (decisão 7): o convite que o desafio novo traz, pela cena
 * da alavanca e pelo cenário da bolha. É o que "Usar o exemplo do jogo" põe e
 * o que a etiqueta "exemplo do jogo" reconhece.
 */
export function exemploDoJogo(minigame: MinigameDoPino): ConviteDoDesafio {
  if (minigame.jogo === 'puzzle') return { npc: '', fala: '', lugar: null }
  if (minigame.jogo === 'alavanca') return { npc: '', fala: CONVITE_DA_CENA_ALAVANCA[minigame.cena].fala, lugar: CONVITE_DA_CENA_ALAVANCA[minigame.cena].lugar }
  if (minigame.jogo === 'bolha') return { npc: MINIGAME_BOLHA_PADRAO.npc, fala: FALA_DO_CENARIO_BOLHA[minigame.cenario], lugar: null }
  return conviteDo(padraoDoJogo(minigame.jogo))
}

/** Alguma parte do convite ainda é o exemplo do jogo (a etiqueta "exemplo do jogo" da ficha). */
export function conviteTemExemplo(minigame: MinigameDoPino): boolean {
  if (minigame.jogo === 'puzzle') return false
  const agora = conviteDo(minigame)
  const exemplo = exemploDoJogo(minigame)
  const mesmo = (a: string | null, b: string | null) => a !== null && b !== null && b !== '' && a === b
  return mesmo(agora.npc, exemplo.npc) || mesmo(agora.fala, exemplo.fala) || mesmo(agora.lugar, exemplo.lugar)
}

/** O desafio com o convite mudado, campo a campo, no teto de cada um. O puzzle não muda. */
export function comConvite(minigame: MinigameDoPino, mudanca: Partial<ConviteDoDesafio>): MinigameDoPino {
  if (minigame.jogo === 'puzzle') return minigame
  const npc = mudanca.npc === undefined ? minigame.npc : mudanca.npc.slice(0, QUEM_CHAMA_MAX_LENGTH)
  const fala = mudanca.fala === undefined ? minigame.fala : mudanca.fala.slice(0, FALA_DO_CONVITE_MAX_LENGTH)
  const lugar = typeof mudanca.lugar === 'string' ? mudanca.lugar : null
  switch (minigame.jogo) {
    case 'pesca':
      return { ...minigame, npc, fala, lago: lugar === null ? minigame.lago : lugar.slice(0, LAGO_MAX_LENGTH) }
    case 'tiro':
      return { ...minigame, npc, fala, barraca: lugar === null ? minigame.barraca : lugar.slice(0, BARRACA_MAX_LENGTH) }
    case 'fogo':
      return { ...minigame, npc, fala, floresta: lugar === null ? minigame.floresta : lugar.slice(0, FLORESTA_MAX_LENGTH) }
    case 'alavanca':
      return { ...minigame, npc, fala, lugar: lugar === null ? minigame.lugar : lugar.slice(0, ALAVANCA_LUGAR_MAX_LENGTH) }
    case 'danca':
      return { ...minigame, npc, fala }
    case 'bolha':
      return { ...minigame, npc, fala }
  }
}

/** O desafio com outro "Como começa". Só a pesca, o tiro, a bolha e a alavanca escolhem; os outros não mudam. */
export function comEntrada(minigame: MinigameDoPino, entrada: EntradaDoDesafio): MinigameDoPino {
  switch (minigame.jogo) {
    case 'pesca':
    case 'tiro':
    case 'bolha':
    case 'alavanca':
      return { ...minigame, entrada }
    default:
      return minigame
  }
}

/** O que ficou guardado de um jogo ao trocar (decisão 3): o desafio do jogo e a porta dele. Só na memória. */
export interface GuardadoDoJogo {
  minigame: MinigameDoPino
  portaLigada?: string
}

/**
 * TROCAR DE JOGO (decisões 3 e 4 do editor de 21/11/2026): o jogo novo volta
 * como ficou guardado, ou nasce com o exemplo dele. Do desafio passa só o que
 * é do desafio: o lugar no mapa (fica, não está no patch), o nome que o
 * mestre escreveu (`nomeProprio`, idem) e quem chama, se o mestre escolheu
 * (não é o exemplo do jogo de antes). Fala, lugar do convite, regras, prêmio e
 * porta são do jogo; `atualizarDesafio` tira o progresso do puzzle.
 */
export function patchDaTrocaDeJogo(desafio: Pick<Desafio, 'minigame' | 'quem'>, jogo: JogoDoMinigame, guardado: GuardadoDoJogo | undefined): PatchDoDesafio {
  const base: MinigameDoPino = guardado !== undefined && guardado.minigame.jogo === jogo ? structuredClone(guardado.minigame) : padraoDoJogo(jogo)
  const antes = desafio.minigame
  // Escolhido = uma ficha (`quem`) ou um nome que não é o exemplo do jogo de antes.
  const escolhido = antes.jogo !== 'puzzle' && (desafio.quem !== undefined || antes.npc !== exemploDoJogo(antes).npc)
  const minigame = escolhido ? comConvite(base, { npc: antes.npc }) : base
  return { minigame, portaLigada: guardado?.portaLigada }
}

/** O nome que o desafio ganha: o do pino (ou do puzzle de "Meus puzzles"), se veio um, ou o automático. */
export function nomePadraoDoDesafio(minigame: MinigameDoPino, nomeDoPino?: string): string {
  return nomeDoDesafio({ minigame }, nomeDoPino).nome
}

/**
 * Um pino ▷ vira desafio NO MESMO LUGAR, com o mesmo id, o mesmo jogo e a
 * mesma porta. O pino inteiro fica em `eraPino` (menos o desafio, que agora
 * mora em `minigame`): nada se perde, e o jogador recebe o mesmo cartão.
 */
export function desafioDoPino(pin: Pin): Desafio {
  const { minigame, minigameVisivel: _soDoRecorte, ...resto } = pin
  const jogo = minigame ?? padraoDoJogo('danca')
  return {
    id: pin.id,
    // O nome do pino é do mestre: fica (`nomeProprio`); pino sem nome ganha o automático.
    ...nomeDoDesafio({ minigame: jogo }, pin.nome),
    lugar: { tipo: 'ponto', x: pin.x, y: pin.y },
    minigame: jogo,
    ...(pin.portaLigada === undefined ? {} : { portaLigada: pin.portaLigada }),
    ...(pin.piso === undefined ? {} : { piso: pin.piso }),
    eraPino: resto,
  }
}

/**
 * MIGRAÇÃO ao abrir: todo pino de minigame do mapa vira desafio, e o tipo ▷
 * sai da lista de pinos. Mapa sem pino de minigame volta o mesmo objeto.
 * Pino cujo id já é de um desafio (arquivo editado à mão) não duplica.
 */
export function comPinosDeMinigameComoDesafios(map: MapData): MapData {
  if (!map.pins.some((pin) => pin.kind === 'minigame')) return map
  const existentes = new Set(desafiosDo(map).map((desafio) => desafio.id))
  const novos = map.pins.filter((pin) => pin.kind === 'minigame' && !existentes.has(pin.id)).map(desafioDoPino)
  return { ...map, pins: map.pins.filter((pin) => pin.kind !== 'minigame'), desafios: [...desafiosDo(map), ...novos] }
}

/** Quantos desafios deste mapa vieram de pinos ▷ (o aviso da página Jogos). */
export function desafiosMigrados(map: Pick<MapData, 'desafios'>): readonly Desafio[] {
  return desafiosDo(map).filter((desafio) => desafio.eraPino !== undefined)
}

interface PontoDoDesafio {
  x: number
  y: number
  piso?: number
}

/**
 * Onde o selo fica: o ponto marcado, ou o MEIO do objeto ligado (o mesmo
 * ponto de um pino posto em cima dele: o alcance passa a ser o contorno do
 * objeto, `lib/obstaculosDeObjeto.ts`). `null` = sem lugar no mapa, ou o
 * objeto ligado foi apagado.
 */
export function pontoDoDesafio(desafio: Pick<Desafio, 'lugar' | 'piso'>, props: readonly Prop[]): PontoDoDesafio | null {
  const lugar = desafio.lugar
  if (lugar.tipo === 'ponto') return desafio.piso === undefined ? { x: lugar.x, y: lugar.y } : { x: lugar.x, y: lugar.y, piso: desafio.piso }
  if (lugar.tipo === 'nenhum') return null
  const prop = props.find((p) => p.id === lugar.propId)
  if (prop === undefined) return null
  return prop.piso === undefined ? { x: prop.x, y: prop.y } : { x: prop.x, y: prop.y, piso: prop.piso }
}

/**
 * Para quem é o pino derivado: o `mestre` vê o nome do desafio ao lado do
 * selo; a `mesa` (recorte do jogador e host) leva só o nome que o pino de
 * antes já levava ao jogador, nunca o nome do mestre.
 */
export type ParaQuem = 'mestre' | 'mesa'

/**
 * O PINO DE MINIGAME DERIVADO do desafio, de mesmo id: o que o recorte, o host
 * e o desenho usam. Desafio migrado sai com tudo do pino de antes (descrição,
 * só de perto, marco, segredo, camada...); desafio novo, com o mínimo de um
 * pino sem texto. `null` = o desafio não tem lugar no mapa.
 */
export function pinoDoDesafio(desafio: Desafio, props: readonly Prop[], paraQuem: ParaQuem): Pin | null {
  const ponto = pontoDoDesafio(desafio, props)
  if (ponto === null) return null
  const base: Pin = desafio.eraPino ?? { id: desafio.id, x: ponto.x, y: ponto.y, kind: 'minigame', description: '', image: null }
  const tamanho = tamanhoDoSelo(desafio)
  const angulo = anguloDoSelo(desafio)
  const pino: Pin = {
    ...base,
    id: desafio.id,
    kind: 'minigame',
    x: ponto.x,
    y: ponto.y,
    piso: ponto.piso,
    minigame: desafio.minigame,
    portaLigada: desafio.portaLigada,
    minigameVisivel: undefined,
    // O selo não segue ficha: o lugar é o do desafio (o arrasto do selo muda o desafio, `patchDoSeloMovido`).
    presoA: undefined,
    // O tamanho do selo é o do pino derivado: o desenho, o toque e o recorte do jogador já o leem (`Pin.escala`).
    escala: tamanho === 1 ? undefined : tamanho,
    anguloDoSelo: angulo === 0 ? undefined : angulo,
  }
  if (paraQuem === 'mestre') pino.nome = desafio.nome
  return pino
}

/**
 * O TAMANHO DO SELO (pedido de 21/11/2026: "aumentar e diminuir de tamanho"),
 * em vezes o padrão. Ausente (o mapa de antes) ou torto: o do pino ▷ de que o
 * desafio veio, ou 1 — o selo abre do tamanho de sempre.
 */
export function tamanhoDoSelo(desafio: Pick<Desafio, 'tamanho' | 'eraPino'>): number {
  return isPinEscala(desafio.tamanho) ? desafio.tamanho : escalaDoPino(desafio.eraPino ?? {})
}

/**
 * O tamanho na faixa do tamanho do pino (50% a 300%, `PIN_ESCALA_MIN`..`MAX`),
 * de centésimo em centésimo (a alça não grava 1,2345678). Não-número: 1.
 */
export function tamanhoDoSeloNaFaixa(tamanho: number): number {
  if (!Number.isFinite(tamanho)) return 1
  return Math.round(Math.min(PIN_ESCALA_MAX, Math.max(PIN_ESCALA_MIN, tamanho)) * 100) / 100
}

/** Mudar o tamanho do selo: o tamanho de antes (o do pino ▷, ou 1) sai do arquivo, o campo é opcional. */
export function patchDoTamanhoDoSelo(desafio: Pick<Desafio, 'eraPino'>, tamanho: number): PatchDoDesafio {
  const novo = tamanhoDoSeloNaFaixa(tamanho)
  return { tamanho: novo === escalaDoPino(desafio.eraPino ?? {}) ? undefined : novo }
}

/** O GIRO DO SELO em graus, na faixa (−180°, 180°]. Ausente ou torto: 0. */
export function anguloDoSelo(desafio: Pick<Desafio, 'angulo'>): number {
  return normalizeRotation(desafio.angulo ?? 0)
}

/** Girar o selo (a alça de girar no mapa): grau inteiro na faixa; o 0 sai do arquivo, o campo é opcional. */
export function patchDoAnguloDoSelo(graus: number): PatchDoDesafio {
  const angulo = normalizeRotation(Math.round(graus))
  return { angulo: angulo === 0 ? undefined : angulo }
}

/**
 * ARRASTAR O SELO (pedido de 21/11/2026: "não consigo mudar de lugar"): ele
 * vai para o ponto `(x, y)` do piso `piso`, em px inteiros, como o "Marcar no
 * mapa" (`marcarDesafioNoClique`). Só o selo posto num ponto se arrasta.
 */
export function patchDoSeloMovido(x: number, y: number, piso: number): PatchDoDesafio {
  return { lugar: { tipo: 'ponto', x: Math.round(x), y: Math.round(y) }, piso: piso === 0 ? undefined : piso }
}

/**
 * Os pinos derivados dos desafios com lugar no mapa. `objetoChega` (o
 * recorte do jogador): o desafio posto num objeto que não chega ao jogador
 * também não chega — o selo contaria que o objeto existe.
 */
export function pinosDosDesafios(map: Pick<MapData, 'desafios' | 'props'>, paraQuem: ParaQuem, objetoChega?: (propId: string) => boolean): Pin[] {
  const pinos: Pin[] = []
  for (const desafio of desafiosDo(map)) {
    if (objetoChega !== undefined && desafio.lugar.tipo === 'objeto' && !objetoChega(desafio.lugar.propId)) continue
    const pino = pinoDoDesafio(desafio, map.props, paraQuem)
    if (pino !== null) pinos.push(pino)
  }
  return pinos
}

/**
 * O pino de minigame `id` deste mapa, como o host o confere: o derivado do
 * desafio, ou um pino ▷ que ainda não passou pela migração (mapa montado sem
 * passar pelo disco). `undefined` = não há minigame com este id aqui.
 */
export function pinoDeMinigameDoMapa(map: Pick<MapData, 'desafios' | 'props' | 'pins'>, id: string): Pin | undefined {
  const desafio = desafiosDo(map).find((d) => d.id === id)
  if (desafio !== undefined) return pinoDoDesafio(desafio, map.props, 'mesa') ?? undefined
  return map.pins.find((pin) => pin.id === id && pin.kind === 'minigame')
}

/**
 * O desafio `id`, com ou sem lugar no mapa, como o CONVITE do mestre o
 * confere: sem lugar ele ainda começa pelo convite. Vem como pino derivado
 * (no ponto 0,0 quando não tem lugar): é o que os convites de hoje leem.
 */
export function pinoDoConvite(map: Pick<MapData, 'desafios' | 'props' | 'pins'>, id: string): Pin | undefined {
  const desafio = desafiosDo(map).find((d) => d.id === id)
  if (desafio === undefined) return map.pins.find((pin) => pin.id === id && pin.kind === 'minigame')
  return pinoDoDesafio(desafio, map.props, 'mesa') ?? pinoDoDesafio({ ...desafio, lugar: { tipo: 'ponto', x: 0, y: 0 } }, map.props, 'mesa') ?? undefined
}

/** `pinoDoConvite` na primeira cena que tem o desafio (os convites do mestre valem para qualquer cena aberta). */
export function pinoDoConviteEmQualquerCena(cenas: readonly { map: Pick<MapData, 'desafios' | 'props' | 'pins'> }[], id: string): Pin | undefined {
  for (const cena of cenas) {
    const pino = pinoDoConvite(cena.map, id)
    if (pino !== undefined) return pino
  }
  return undefined
}

/** Um desafio novo, com o padrão do jogo e o nome automático. */
export function novoDesafio(id: string, jogo: JogoDoMinigame, lugar: LugarDoDesafio = { tipo: 'nenhum' }): Desafio {
  const minigame = padraoDoJogo(jogo)
  return { id, nome: nomeAutomatico({ minigame }), lugar, minigame }
}

export type PatchDoDesafio = Partial<Pick<Desafio, 'nome' | 'lugar' | 'minigame' | 'portaLigada' | 'piso' | 'tamanho' | 'angulo' | 'quem'>>

const CHAVES_DO_PATCH: readonly (keyof PatchDoDesafio)[] = ['nome', 'lugar', 'minigame', 'portaLigada', 'piso', 'tamanho', 'angulo', 'quem']

export function adicionarDesafio(map: MapData, desafio: Desafio): MapData {
  return { ...map, desafios: [...desafiosDo(map), desafio] }
}

/**
 * Mudança num desafio. Nada muda (id que não existe, mesmos valores) = o mesmo mapa.
 *
 * O NOME (decisão 2 do editor de 21/11/2026): o `nome` do patch é o que o
 * mestre escreveu — vazio volta ao automático, texto vira nome dele
 * (`nomeDoDesafio`). Sem nome no patch, o nome automático é refeito: segue o
 * jogo, a cena e quem chama. TROCAR DE JOGO tira a porta e o progresso do
 * puzzle do jogo de antes (decisão 4): a porta ligada só volta se o patch a
 * trouxer, e o Ctrl+Z da troca devolve os dois.
 */
export function atualizarDesafio(map: MapData, id: string, patch: PatchDoDesafio): MapData {
  const lista = desafiosDo(map)
  const i = lista.findIndex((desafio) => desafio.id === id)
  const atual = lista[i]
  if (atual === undefined) return map
  const chaves = CHAVES_DO_PATCH.filter((chave) => chave in patch)
  if (chaves.every((chave) => JSON.stringify(atual[chave]) === JSON.stringify(patch[chave]))) return map
  const novo: Desafio = { ...atual, ...patch }
  const trocouDeJogo = patch.minigame !== undefined && patch.minigame.jogo !== atual.minigame.jogo
  if (trocouDeJogo) {
    if (!('portaLigada' in patch)) delete novo.portaLigada
    delete novo.progressoDoPuzzle
  }
  // Quem chama de ficha só vale com o mesmo nome no convite: o jogo novo que não o levou (puzzle) o perde.
  if (novo.quem !== undefined && (novo.minigame.jogo === 'puzzle' || novo.minigame.npc !== novo.quem.nome)) delete novo.quem
  for (const chave of ['portaLigada', 'piso', 'tamanho', 'angulo', 'quem'] as const) {
    if (chave in patch && patch[chave] === undefined) delete novo[chave]
  }
  const nome = 'nome' in patch ? nomeDoDesafio(novo, patch.nome) : novo.nomeProprio === true ? { nome: novo.nome, nomeProprio: true as const } : { nome: nomeAutomatico(novo) }
  novo.nome = nome.nome
  if (nome.nomeProprio === true) novo.nomeProprio = true
  else delete novo.nomeProprio
  if (JSON.stringify(novo) === JSON.stringify(atual)) return map
  return { ...map, desafios: lista.map((desafio, j) => (j === i ? novo : desafio)) }
}

/**
 * O PROGRESSO DO PUZZLE `id`, gravado pelo caminho do jogador
 * (`net/playerChanges.ts`), fora do Ctrl+Z do mestre. Fica fora do patch do
 * desafio (`CHAVES_DO_PATCH`) de propósito: editar a cópia ou desfazer não o
 * apagam. Pura e reaplicável: entra no mapa E em todo passo do desfazer da
 * cena; num passo em que o desafio não existe, ou ainda não é puzzle, devolve
 * o próprio mapa, como devolve quando o progresso é o mesmo.
 */
export function mapaComProgressoDoPuzzle(map: MapData, id: string, progresso: ProgressoDoPuzzle): MapData {
  const lista = desafiosDo(map)
  const i = lista.findIndex((desafio) => desafio.id === id)
  const atual = lista[i]
  if (atual === undefined || atual.minigame.jogo !== 'puzzle') return map
  if (JSON.stringify(atual.progressoDoPuzzle) === JSON.stringify(progresso)) return map
  const novo: Desafio = { ...atual, progressoDoPuzzle: progresso }
  return { ...map, desafios: lista.map((desafio, j) => (j === i ? novo : desafio)) }
}

export function removerDesafio(map: MapData, id: string): MapData {
  const lista = desafiosDo(map)
  if (!lista.some((desafio) => desafio.id === id)) return map
  const resto = lista.filter((desafio) => desafio.id !== id)
  if (resto.length > 0) return { ...map, desafios: resto }
  const { desafios: _ultimo, ...semLista } = map
  return semLista
}

/** Onde o desafio deste jogo pode ficar (o registro); jogo desconhecido (versão futura) = qualquer lugar. */
function lugaresDoJogo(jogo: string): readonly TipoDoLugarDoDesafio[] {
  return ehJogoDoRegistro(jogo) ? REGISTRO_DE_MINIGAMES[jogo].lugares : ['ponto', 'objeto', 'nenhum']
}

/** Como o desafio começa de verdade: sem lugar no mapa, ninguém tem onde encostar. */
export function entradaDoDesafio(desafio: Pick<Desafio, 'lugar' | 'minigame'>): EntradaDoDesafio {
  return desafio.lugar.tipo === 'nenhum' ? 'mestre' : entradaDoMinigame(desafio.minigame)
}

/**
 * O que falta para o desafio aparecer no mapa (a etiqueta da lista), ou
 * `null`. O jogo que não vive fora do mapa (o puzzle: ninguém tem onde
 * encostar) acusa a falta do lugar. Sem `minigame` (o papel da página
 * Documentos), só o objeto apagado conta.
 */
export function faltaNoLugar(desafio: Pick<Desafio, 'lugar'> & { minigame?: Pick<MinigameDoPino, 'jogo'> }, props: readonly Prop[]): string | null {
  const lugar = desafio.lugar
  if (lugar.tipo === 'nenhum') return desafio.minigame !== undefined && !lugaresDoJogo(desafio.minigame.jogo).includes('nenhum') ? 'Falta o lugar no mapa' : null
  if (lugar.tipo !== 'objeto') return null
  return props.some((p) => p.id === lugar.propId) ? null : 'O objeto foi apagado'
}

/** "num ponto do mapa", "num objeto", "sem lugar no mapa" (ou o `semLugar` de quem chama): a linha da lista. */
export function textoDoLugar(desafio: Pick<Desafio, 'lugar'>, props: readonly Prop[], semLugar = 'sem lugar no mapa'): string {
  const lugar = desafio.lugar
  if (lugar.tipo === 'ponto') return 'num ponto do mapa'
  if (lugar.tipo === 'nenhum') return semLugar
  const prop = props.find((p) => p.id === lugar.propId)
  if (prop === undefined) return 'num objeto que foi apagado'
  const rotulo = typeof prop.playerLabel === 'string' ? prop.playerLabel.trim() : ''
  return rotulo === '' ? 'num objeto' : `em ${rotulo}`
}
