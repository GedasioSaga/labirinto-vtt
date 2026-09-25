import type { MapData, Pin, Region, RegionPoint, Token } from '../types/map'
import * as mapFactory from './mapFactory'
import { normalizeForSearch } from './mapObjects'
import { PIN_HEAD_RADIUS, pinSummary } from './pins'
import { resolvePinTravel, setExitDestination, travelExitsOf, type TravelScene } from './pinTravel'

/**
 * REVISOR DA AVENTURA — as regras puras: sem store, sem DOM, sem Pixi.
 *
 * O mestre escreve dezenas de cenas e não tem como conferir à mão se um texto
 * dele vaza para a mesa, se um pino de viagem ficou sem par ou se um cartão
 * abre vazio. Estas regras correm sobre as cenas já na memória (a aberta pelo
 * mapa vivo, as de fundo pelo cache) e devolvem cada problema com o ponto para
 * o "Ir lá" e, quando existe um conserto seguro, o que fazer num clique.
 *
 * Tudo aqui é lista do MESTRE: nada vai ao jogador.
 */

/** Os três grupos, na ordem em que a janela os mostra: o mais grave primeiro. */
export type GrupoRevisao = 'vaza' | 'quebra' | 'feio'

export const GRUPOS_REVISAO: readonly GrupoRevisao[] = ['vaza', 'quebra', 'feio']

export const TITULO_DO_GRUPO: Record<GrupoRevisao, string> = {
  vaza: 'Vaza ao jogador',
  quebra: 'Quebra o jogo',
  feio: 'Ficou feio',
}

export type RegraRevisao =
  | 'texto-do-mestre'
  | 'nome-com-parenteses'
  | 'cita-outra-cena'
  | 'viagem-sem-destino'
  | 'viagem-sem-par'
  | 'ficha-repetida'
  | 'pino-sob-pino'
  | 'pino-vazio'

/** O conserto de um clique. Cada um é pequeno, reversível pelo Ctrl+Z e não inventa conteúdo. */
export type Conserto =
  | { tipo: 'ocultar-pino'; pinId: string }
  | { tipo: 'texto-para-nota'; regionId: string }
  | { tipo: 'nome-publico'; tokenId: string; publicName: string | null }
  | { tipo: 'desligar-saida'; pinId: string; exitId: string }
  | { tipo: 'afastar-pino'; pinId: string; x: number; y: number }

export interface ProblemaRevisao {
  /** Chave estável: regra, cena e item. */
  id: string
  grupo: GrupoRevisao
  regra: RegraRevisao
  sceneId: string
  sceneName: string
  /** O pino, a ficha ou a sala de onde vem o problema. */
  itemId: string
  /** O que está errado, na língua de quem usa. */
  texto: string
  /** Para onde o "Ir lá" leva, em px de mundo da cena. */
  ponto: RegionPoint
  /** `null` = não há conserto seguro de um clique; só o "Ir lá". */
  conserto: Conserto | null
}

/** Uma cena como o revisor a lê. `map: null` = o arquivo dela não abriu. */
export interface CenaParaRevisar {
  id: string
  name: string
  map: MapData | null
}

export interface RevisaoAventura {
  problemas: ProblemaRevisao[]
  /** Nomes das cenas que não abriram e por isso não foram revisadas. */
  cenasFora: string[]
}

/** "MESTRE:" no começo, com ou sem espaço antes dos dois pontos, qualquer caixa. */
const PREFIXO_DO_MESTRE = /^\s*mestre\s*:/i
/** Nome de cena mais curto que isto ("Um", "Sul") acharia citação em todo texto. */
const NOME_DE_CENA_MINIMO = 4
/** Duas cabeças mais perto que isto se tapam: o toque só acha a de cima (`findPinAt`). */
const DISTANCIA_MINIMA_ENTRE_PINOS = 2 * PIN_HEAD_RADIUS
/** Passo e tentativas da busca de lugar livre para o pino afastado, em anéis de 8 direções. */
const PASSO_DO_AFASTAR = 3 * PIN_HEAD_RADIUS
const ANEIS_DO_AFASTAR = 12

const DIRECOES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
]

export function rotuloDoConserto(conserto: Conserto): string {
  switch (conserto.tipo) {
    case 'ocultar-pino':
      return 'Ocultar dos jogadores'
    case 'texto-para-nota':
      return 'Mover para a nota do mestre'
    case 'nome-publico':
      return conserto.publicName === null ? 'Jogadores não leem o nome' : `Jogadores leem "${conserto.publicName}"`
    case 'desligar-saida':
      return 'Desligar a saída'
    case 'afastar-pino':
      return 'Afastar o pino'
  }
}

function centroDaSala(region: Region): RegionPoint {
  const xs = region.points.map((p) => p.x)
  const ys = region.points.map((p) => p.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

/** O nome que a mesa lê embaixo da ficha (`tokenAsSeenByPlayer`, para quem não é o dono). */
function nomeParaAMesa(token: Token): string {
  if (token.publicName === null) return ''
  return typeof token.publicName === 'string' ? token.publicName : token.name
}

/** O nome sem o que está entre parênteses. Nada sobrou = a ficha sai sem rótulo. */
function semParenteses(nome: string): string | null {
  const limpo = nome.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  return limpo === '' ? null : limpo
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Um nome de cena e o teste de "o texto cita esta cena", palavra inteira, sem caixa nem acento. */
interface NomeCitavel {
  sceneId: string
  nome: string
  teste: RegExp
}

function nomesCitaveis(cenas: readonly CenaParaRevisar[]): NomeCitavel[] {
  const nomes: NomeCitavel[] = []
  for (const cena of cenas) {
    const normal = normalizeForSearch(cena.name.trim())
    if (normal.length < NOME_DE_CENA_MINIMO) continue
    nomes.push({ sceneId: cena.id, nome: cena.name.trim(), teste: new RegExp(`(^|[^\\p{L}\\p{N}])${escaparRegex(normal)}($|[^\\p{L}\\p{N}])`, 'u') })
  }
  return nomes
}

/** A primeira OUTRA cena que o texto cita, ou `null`. */
function cenaCitada(texto: string, aqui: string, nomes: readonly NomeCitavel[]): string | null {
  if (texto.trim() === '') return null
  const normal = normalizeForSearch(texto)
  return nomes.find((n) => n.sceneId !== aqui && n.teste.test(normal))?.nome ?? null
}

function citaPino(pin: Pin): string {
  return `"${pinSummary(pin)}"`
}

/** Um lugar a partir do pino onde nenhuma outra cabeça o tapa, ou `null` se o entorno está cheio. */
function lugarLivre(pin: Pin, outros: readonly Pin[]): RegionPoint | null {
  const livre = (x: number, y: number) => outros.every((o) => Math.hypot(o.x - x, o.y - y) >= DISTANCIA_MINIMA_ENTRE_PINOS)
  for (let anel = 1; anel <= ANEIS_DO_AFASTAR; anel++) {
    for (const [dx, dy] of DIRECOES) {
      const x = Math.round(pin.x + dx * anel * PASSO_DO_AFASTAR)
      const y = Math.round(pin.y + dy * anel * PASSO_DO_AFASTAR)
      if (livre(x, y)) return { x, y }
    }
  }
  return null
}

type Novo = Omit<ProblemaRevisao, 'id' | 'sceneId' | 'sceneName'>

/** "Vaza ao jogador": texto do mestre, nome com parênteses e citação de outra cena. */
function vazamentos(cena: CenaParaRevisar, map: MapData, nomes: readonly NomeCitavel[]): Novo[] {
  const achados: Novo[] = []
  const base = { grupo: 'vaza' as const }
  for (const pin of map.pins) {
    if (pin.secret === true) continue
    if (PREFIXO_DO_MESTRE.test(pin.description)) {
      achados.push({ ...base, regra: 'texto-do-mestre', itemId: pin.id, ponto: { x: pin.x, y: pin.y }, conserto: { tipo: 'ocultar-pino', pinId: pin.id }, texto: `O pino ${citaPino(pin)} começa com MESTRE: e os jogadores leem o cartão.` })
    }
  }
  for (const region of map.regions) {
    const room = region.room
    if (room === undefined || region.secret === true) continue
    if (PREFIXO_DO_MESTRE.test(room.textoAoEntrar ?? '')) {
      const nome = room.name.trim() === '' ? 'sem nome' : `"${room.name.trim()}"`
      achados.push({ ...base, regra: 'texto-do-mestre', itemId: region.id, ponto: centroDaSala(region), conserto: { tipo: 'texto-para-nota', regionId: region.id }, texto: `O texto ao entrar da sala ${nome} começa com MESTRE: e o jogador o lê ao entrar.` })
    }
  }
  for (const token of map.tokens) {
    if (token.secret === true || token.publicName !== undefined) continue
    if (!/\(.*\)/.test(token.name)) continue
    achados.push({ ...base, regra: 'nome-com-parenteses', itemId: token.id, ponto: { x: token.x, y: token.y }, conserto: { tipo: 'nome-publico', tokenId: token.id, publicName: semParenteses(token.name) }, texto: `A ficha "${token.name.trim()}" mostra à mesa o que está entre parênteses.` })
  }
  // Citação de outra cena: o jogador nunca deveria ler o nome de um lugar onde não está.
  for (const pin of map.pins) {
    if (pin.secret === true) continue
    const citada = cenaCitada(pin.description, cena.id, nomes)
    if (citada !== null) achados.push({ ...base, regra: 'cita-outra-cena', itemId: pin.id, ponto: { x: pin.x, y: pin.y }, conserto: null, texto: `O pino ${citaPino(pin)} cita a cena "${citada}".` })
  }
  for (const region of map.regions) {
    const room = region.room
    if (room === undefined || region.secret === true) continue
    const nomeVisivel = room.nameHiddenFromPlayers === true ? '' : room.name
    const citada = cenaCitada(nomeVisivel, cena.id, nomes) ?? cenaCitada(room.textoAoEntrar ?? '', cena.id, nomes)
    if (citada !== null) achados.push({ ...base, regra: 'cita-outra-cena', itemId: region.id, ponto: centroDaSala(region), conserto: null, texto: `A sala "${room.name.trim()}" cita a cena "${citada}".` })
  }
  for (const token of map.tokens) {
    if (token.secret === true) continue
    const citada = cenaCitada(nomeParaAMesa(token), cena.id, nomes)
    if (citada !== null) achados.push({ ...base, regra: 'cita-outra-cena', itemId: token.id, ponto: { x: token.x, y: token.y }, conserto: null, texto: `A ficha "${token.name.trim()}" cita a cena "${citada}".` })
  }
  return achados
}

/** "Quebra o jogo" dentro de uma cena: pino de viagem sem destino ou sem par, e pino tapado por outro. */
function quebrasDaCena(cena: CenaParaRevisar, map: MapData, lookup: (sceneId: string) => TravelScene | null): Novo[] {
  const achados: Novo[] = []
  const base = { grupo: 'quebra' as const }
  for (const pin of map.pins) {
    if (pin.kind !== 'viagem') continue
    const ponto = { x: pin.x, y: pin.y }
    const saidas = travelExitsOf(pin)
    if (saidas.length === 0) {
      achados.push({ ...base, regra: 'viagem-sem-destino', itemId: pin.id, ponto, conserto: null, texto: `O pino de viagem ${citaPino(pin)} não leva a lugar nenhum.` })
      continue
    }
    for (const saida of saidas) {
      // Cena que não abriu não dá para julgar: o par pode estar lá, certinho.
      if (resolvePinTravel(pin, cena.id, lookup, saida.id).status !== 'sem-destino') continue
      const destino = lookup(saida.destino.sceneId)
      const porque = destino === null ? 'leva a uma cena que não existe mais' : 'leva a um pino que não traz de volta'
      const qual = saidas.length > 1 ? ` (saída "${saida.rotulo === '' ? saida.id : saida.rotulo}")` : ''
      achados.push({ ...base, regra: 'viagem-sem-par', itemId: pin.id, ponto, conserto: { tipo: 'desligar-saida', pinId: pin.id, exitId: saida.id }, texto: `O pino de viagem ${citaPino(pin)}${qual} ${porque}.` })
    }
  }
  // Só os pinos que chegam ao jogador se tapam na tela dele.
  const publicos = map.pins.filter((p) => p.secret !== true && p.soChegada !== true)
  for (let i = 0; i < publicos.length; i++) {
    const baixo = publicos[i]
    const cima = publicos.slice(i + 1).find((p) => Math.hypot(p.x - baixo.x, p.y - baixo.y) < DISTANCIA_MINIMA_ENTRE_PINOS)
    if (cima === undefined) continue
    const outros = map.pins.filter((p) => p.id !== baixo.id)
    const lugar = lugarLivre(baixo, outros)
    achados.push({
      ...base,
      regra: 'pino-sob-pino',
      itemId: baixo.id,
      ponto: { x: baixo.x, y: baixo.y },
      conserto: lugar === null ? null : { tipo: 'afastar-pino', pinId: baixo.id, x: lugar.x, y: lugar.y },
      texto: `O pino ${citaPino(baixo)} está debaixo de ${citaPino(cima)}: o jogador só abre o de cima.`,
    })
  }
  return achados
}

/** "Ficou feio": cartão que abre vazio. */
function feiurasDaCena(map: MapData): Novo[] {
  const achados: Novo[] = []
  for (const pin of map.pins) {
    if (pin.kind === 'viagem' || pin.secret === true) continue
    if (pin.description.trim() !== '' || pin.image !== null) continue
    achados.push({ grupo: 'feio', regra: 'pino-vazio', itemId: pin.id, ponto: { x: pin.x, y: pin.y }, conserto: null, texto: `O pino ${citaPino(pin)} abre um cartão vazio para o jogador.` })
  }
  return achados
}

/**
 * Revisa a aventura inteira. A ordem é a dos grupos (vaza, quebra, feio) e,
 * dentro de cada um, a das cenas. Ficha repetida é da aventura, não da cena:
 * a primeira aparição fica, as seguintes são apontadas.
 */
export function revisarAventura(cenas: readonly CenaParaRevisar[]): RevisaoAventura {
  const porId = new Map(cenas.map((c) => [c.id, c]))
  const lookup = (sceneId: string): TravelScene | null => {
    const cena = porId.get(sceneId)
    return cena === undefined ? null : { name: cena.name, map: cena.map }
  }
  const nomes = nomesCitaveis(cenas)
  const todos: ProblemaRevisao[] = []
  const primeiraFicha = new Map<string, string>()
  const cenasFora: string[] = []
  const chaves = new Map<string, number>()

  for (const cena of cenas) {
    const map = cena.map
    if (map === null) {
      cenasFora.push(cena.name)
      continue
    }
    const achados: Novo[] = [...vazamentos(cena, map, nomes), ...quebrasDaCena(cena, map, lookup), ...feiurasDaCena(map)]
    for (const token of map.tokens) {
      const onde = primeiraFicha.get(token.id)
      if (onde === undefined) {
        primeiraFicha.set(token.id, cena.name)
        continue
      }
      achados.push({ grupo: 'quebra', regra: 'ficha-repetida', itemId: token.id, ponto: { x: token.x, y: token.y }, conserto: null, texto: `A ficha "${token.name.trim()}" também está em "${onde}", com o mesmo id: ela pode aparecer nas duas.` })
    }
    for (const achado of achados) {
      // Chave estável entre revisões (o React não remonta a linha que ficou); a
      // segunda saída sem par do mesmo pino ganha um sufixo.
      const base = `${achado.regra}:${cena.id}:${achado.itemId}`
      const repeticoes = chaves.get(base) ?? 0
      chaves.set(base, repeticoes + 1)
      todos.push({ ...achado, id: repeticoes === 0 ? base : `${base}:${repeticoes}`, sceneId: cena.id, sceneName: cena.name })
    }
  }
  const ordem = (grupo: GrupoRevisao) => GRUPOS_REVISAO.indexOf(grupo)
  // `sort` é estável: dentro do grupo fica a ordem das cenas e das regras.
  const problemas = todos.sort((a, b) => ordem(a.grupo) - ordem(b.grupo))
  return { problemas, cenasFora }
}

function comNomePublico(map: MapData, tokenId: string, publicName: string | null): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined || token.publicName === publicName) return map
  return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, publicName } : t)) }
}

function textoParaNota(map: MapData, regionId: string): MapData {
  const room = map.regions.find((r) => r.id === regionId)?.room
  const texto = room?.textoAoEntrar ?? ''
  if (room === undefined || texto.trim() === '') return map
  const antiga = room.notaDoMestre ?? ''
  const nota = antiga.trim() === '' ? texto : `${antiga}\n\n${texto}`
  return mapFactory.setRoomTexts(map, regionId, { textoAoEntrar: undefined, notaDoMestre: nota })
}

/**
 * Aplica o conserto num mapa. Devolve o MESMO mapa quando nada muda (o item
 * sumiu, ou o conserto já foi feito), para quem grava não sujar a cena à toa.
 */
export function aplicarConserto(map: MapData, conserto: Conserto): MapData {
  switch (conserto.tipo) {
    case 'ocultar-pino':
      return mapFactory.setItemSecret(map, 'pin', conserto.pinId, true)
    case 'texto-para-nota':
      return textoParaNota(map, conserto.regionId)
    case 'nome-publico':
      return comNomePublico(map, conserto.tokenId, conserto.publicName)
    case 'desligar-saida': {
      const pin = map.pins.find((p) => p.id === conserto.pinId)
      if (pin === undefined) return map
      return mapFactory.updatePin(map, pin.id, setExitDestination(pin, conserto.exitId, null))
    }
    case 'afastar-pino':
      return mapFactory.setPinPosition(map, conserto.pinId, conserto.x, conserto.y)
  }
}
