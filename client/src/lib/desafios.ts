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
import type { Desafio, LugarDoDesafio, MapData, Pin, Prop } from '../types/map'
import type { JogoDoMinigame, MinigameDoPino } from '../minigames/tipos'
import { entradaDoMinigame, nomeDoJogoDoDesafio, padraoDoJogo, type EntradaDoDesafio } from '../minigames/registro'
import type { ProgressoDoPuzzle } from '../puzzles/tipos'
import { escalaDoPino, isPinEscala, PIN_ESCALA_MAX, PIN_ESCALA_MIN } from './pins'
import { normalizeRotation } from './roomRotation'

/** Teto do nome do desafio (o mesmo do nome do pino). */
export const DESAFIO_NOME_MAX_LENGTH = 60

export function desafiosDo(map: Pick<MapData, 'desafios'>): readonly Desafio[] {
  return map.desafios ?? []
}

/** O nome que o desafio ganha: o do pino, ou "Pesca com Bento" (o jogo com quem desafia), ou só o jogo. */
export function nomePadraoDoDesafio(minigame: MinigameDoPino, nomeDoPino?: string): string {
  const nome = typeof nomeDoPino === 'string' ? nomeDoPino.trim() : ''
  if (nome !== '') return nome.slice(0, DESAFIO_NOME_MAX_LENGTH)
  const npc = minigame.npc.trim()
  const jogo = nomeDoJogoDoDesafio(minigame)
  return (npc === '' ? jogo : `${jogo} com ${npc}`).slice(0, DESAFIO_NOME_MAX_LENGTH)
}

/**
 * A alavanca que troca de cena troca o nome que ainda é o padrão da cena de
 * antes ("Alavanca da ponte" vira "Alavanca do canhão"); o nome que o mestre
 * escreveu fica. Fora isso, o nome de sempre.
 */
function nomeNaCenaNova(atual: Desafio, minigame: MinigameDoPino): string {
  if (atual.minigame.jogo !== 'alavanca' || minigame.jogo !== 'alavanca' || atual.minigame.cena === minigame.cena) return atual.nome
  return atual.nome === nomePadraoDoDesafio(atual.minigame) ? nomePadraoDoDesafio(minigame) : atual.nome
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
    nome: nomePadraoDoDesafio(jogo, pin.nome),
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

/** Um desafio novo, com o padrão do jogo e o nome dele. */
export function novoDesafio(id: string, jogo: JogoDoMinigame, lugar: LugarDoDesafio = { tipo: 'nenhum' }): Desafio {
  const minigame = padraoDoJogo(jogo)
  return { id, nome: nomePadraoDoDesafio(minigame), lugar, minigame }
}

export type PatchDoDesafio = Partial<Pick<Desafio, 'nome' | 'lugar' | 'minigame' | 'portaLigada' | 'piso' | 'tamanho' | 'angulo'>>

const CHAVES_DO_PATCH: readonly (keyof PatchDoDesafio)[] = ['nome', 'lugar', 'minigame', 'portaLigada', 'piso', 'tamanho', 'angulo']

export function adicionarDesafio(map: MapData, desafio: Desafio): MapData {
  return { ...map, desafios: [...desafiosDo(map), desafio] }
}

/** Mudança num desafio. Nada muda (id que não existe, mesmos valores) = o mesmo mapa. */
export function atualizarDesafio(map: MapData, id: string, patch: PatchDoDesafio): MapData {
  const lista = desafiosDo(map)
  const i = lista.findIndex((desafio) => desafio.id === id)
  const atual = lista[i]
  if (atual === undefined) return map
  const chaves = CHAVES_DO_PATCH.filter((chave) => chave in patch)
  if (chaves.every((chave) => JSON.stringify(atual[chave]) === JSON.stringify(patch[chave]))) return map
  const novo: Desafio = { ...atual, ...patch }
  if (patch.minigame !== undefined && patch.nome === undefined) novo.nome = nomeNaCenaNova(atual, patch.minigame)
  if (patch.portaLigada === undefined && 'portaLigada' in patch) delete novo.portaLigada
  if (patch.tamanho === undefined && 'tamanho' in patch) delete novo.tamanho
  if (patch.angulo === undefined && 'angulo' in patch) delete novo.angulo
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

/** Como o desafio começa de verdade: sem lugar no mapa, ninguém tem onde encostar. */
export function entradaDoDesafio(desafio: Pick<Desafio, 'lugar' | 'minigame'>): EntradaDoDesafio {
  return desafio.lugar.tipo === 'nenhum' ? 'mestre' : entradaDoMinigame(desafio.minigame)
}

/** O que falta para o desafio aparecer no mapa (a etiqueta da lista), ou `null`. */
export function faltaNoLugar(desafio: Pick<Desafio, 'lugar'>, props: readonly Prop[]): string | null {
  const lugar = desafio.lugar
  if (lugar.tipo !== 'objeto') return null
  return props.some((p) => p.id === lugar.propId) ? null : 'O objeto foi apagado'
}

/** "num ponto do mapa", "num objeto", "sem lugar no mapa": a linha da lista. */
export function textoDoLugar(desafio: Pick<Desafio, 'lugar'>, props: readonly Prop[]): string {
  const lugar = desafio.lugar
  if (lugar.tipo === 'ponto') return 'num ponto do mapa'
  if (lugar.tipo === 'nenhum') return 'sem lugar no mapa'
  const prop = props.find((p) => p.id === lugar.propId)
  if (prop === undefined) return 'num objeto que foi apagado'
  const rotulo = typeof prop.playerLabel === 'string' ? prop.playerLabel.trim() : ''
  return rotulo === '' ? 'num objeto' : `em ${rotulo}`
}
