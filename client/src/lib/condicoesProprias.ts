import type { CondicaoPropria, MapData, Token } from '../types/map'
import { parseHexColor } from './tokenColor'
import { CONDITION_INK, type ConditionSymbol, type ConditionSymbolPoint } from './tokenConditions'

/**
 * CONDIÇÃO CRIADA PELO MESTRE (pedido de 09/11/2026): além das cinco de
 * fábrica (`lib/tokenConditions.ts`), o mestre monta as dele — nome, cor e um
 * desenho da biblioteca abaixo — e marca na ficha com um clique. Puro: sem
 * DOM, sem Pixi, sem store.
 *
 * A condição vai INTEIRA dentro da ficha (`Token.condicoesProprias`), e não só
 * o id: o mapa salvo abre em outro computador com as marcas no lugar, e a tela
 * de quem joga desenha a pastilha sem precisar da lista do mestre. A lista do
 * que ele já criou mora em `stores/condicoesPropriasStore.ts`.
 */

/** Os desenhos que o mestre pode pôr na pastilha. */
export type SimboloDeCondicao =
  | 'chama'
  | 'gota'
  | 'raio'
  | 'floco'
  | 'coracao'
  | 'escudo'
  | 'cruz'
  | 'olho'
  | 'alvo'
  | 'rede'
  | 'sobe'
  | 'desce'
  | 'estrela'
  | 'xis'

/** A ordem em que os desenhos aparecem no formulário. */
export const SIMBOLO_ORDEM: readonly SimboloDeCondicao[] = [
  'chama', 'gota', 'raio', 'floco', 'coracao', 'escudo', 'cruz', 'olho', 'alvo', 'rede', 'sobe', 'desce', 'estrela', 'xis',
]

/** O nome que o leitor de tela diz e a dica mostra em cada desenho. */
export const SIMBOLO_NOMES: Record<SimboloDeCondicao, string> = {
  chama: 'Chama',
  gota: 'Gota',
  raio: 'Raio',
  floco: 'Floco de gelo',
  coracao: 'Coração',
  escudo: 'Escudo',
  cruz: 'Cruz',
  olho: 'Olho',
  alvo: 'Alvo',
  rede: 'Rede',
  sobe: 'Seta para cima',
  desce: 'Seta para baixo',
  estrela: 'Estrela',
  xis: 'Xis',
}

export function ehSimboloDeCondicao(value: unknown): value is SimboloDeCondicao {
  return typeof value === 'string' && SIMBOLO_ORDEM.some((simbolo) => simbolo === value)
}

/** Pontos em volta do centro, a partir do alto: o anel do alvo e as pontas da estrela. */
function emVolta(lados: number, raioDe: (indice: number) => number): ConditionSymbolPoint[] {
  return Array.from({ length: lados }, (_, indice) => {
    const angulo = -Math.PI / 2 + (indice * 2 * Math.PI) / lados
    const raio = raioDe(indice)
    return { x: Number((raio * Math.cos(angulo)).toFixed(3)), y: Number((raio * Math.sin(angulo)).toFixed(3)) }
  })
}

type Desenho = Pick<ConditionSymbol, 'strokes' | 'solids' | 'dots'>

/**
 * Os desenhos, no mesmo quadrado -1..1 e no mesmo idioma das pastilhas de
 * fábrica: forma cheia ou traço grosso, sem detalhe que vire borrão em 18 px.
 */
const DESENHOS: Record<SimboloDeCondicao, Desenho> = {
  // Labareda com o miolo vazado.
  chama: {
    strokes: [],
    solids: [
      [
        { x: 0.05, y: -0.95 },
        { x: 0.3, y: -0.5 },
        { x: 0.62, y: -0.05 },
        { x: 0.66, y: 0.35 },
        { x: 0.45, y: 0.7 },
        { x: 0.1, y: 0.88 },
        { x: -0.25, y: 0.85 },
        { x: -0.55, y: 0.6 },
        { x: -0.66, y: 0.25 },
        { x: -0.55, y: -0.1 },
        { x: -0.3, y: -0.35 },
        { x: -0.22, y: 0.02 },
        { x: -0.05, y: -0.3 },
      ],
    ],
    dots: [{ x: 0.02, y: 0.42, r: 0.2, hole: true }],
  },
  // A mesma gota do veneno: com a cor do mestre vira sangue, água, ácido.
  gota: {
    strokes: [],
    solids: [
      [
        { x: 0, y: -0.95 },
        { x: 0.52, y: -0.05 },
        { x: 0.6, y: 0.25 },
        { x: 0.52, y: 0.55 },
        { x: 0.3, y: 0.77 },
        { x: 0, y: 0.85 },
        { x: -0.3, y: 0.77 },
        { x: -0.52, y: 0.55 },
        { x: -0.6, y: 0.25 },
        { x: -0.52, y: -0.05 },
      ],
    ],
  },
  raio: {
    strokes: [],
    solids: [
      [
        { x: 0.25, y: -0.95 },
        { x: -0.55, y: 0.1 },
        { x: -0.05, y: 0.1 },
        { x: -0.3, y: 0.95 },
        { x: 0.55, y: -0.2 },
        { x: 0.05, y: -0.2 },
      ],
    ],
  },
  // Três traços cruzados no centro.
  floco: {
    strokes: [
      { points: [{ x: 0, y: -0.9 }, { x: 0, y: 0.9 }] },
      { points: [{ x: -0.78, y: -0.45 }, { x: 0.78, y: 0.45 }] },
      { points: [{ x: -0.78, y: 0.45 }, { x: 0.78, y: -0.45 }] },
    ],
  },
  coracao: {
    strokes: [],
    solids: [
      [
        { x: 0, y: -0.35 },
        { x: 0.22, y: -0.68 },
        { x: 0.52, y: -0.75 },
        { x: 0.8, y: -0.52 },
        { x: 0.85, y: -0.15 },
        { x: 0.6, y: 0.3 },
        { x: 0, y: 0.88 },
        { x: -0.6, y: 0.3 },
        { x: -0.85, y: -0.15 },
        { x: -0.8, y: -0.52 },
        { x: -0.52, y: -0.75 },
        { x: -0.22, y: -0.68 },
      ],
    ],
  },
  escudo: {
    strokes: [],
    solids: [
      [
        { x: 0, y: -0.9 },
        { x: 0.7, y: -0.62 },
        { x: 0.7, y: 0.05 },
        { x: 0.5, y: 0.5 },
        { x: 0, y: 0.92 },
        { x: -0.5, y: 0.5 },
        { x: -0.7, y: 0.05 },
        { x: -0.7, y: -0.62 },
      ],
    ],
  },
  cruz: {
    strokes: [
      { points: [{ x: 0, y: -0.75 }, { x: 0, y: 0.75 }] },
      { points: [{ x: -0.75, y: 0 }, { x: 0.75, y: 0 }] },
    ],
  },
  olho: {
    strokes: [
      {
        points: [
          { x: -0.9, y: 0 },
          { x: -0.45, y: -0.5 },
          { x: 0, y: -0.62 },
          { x: 0.45, y: -0.5 },
          { x: 0.9, y: 0 },
          { x: 0.45, y: 0.5 },
          { x: 0, y: 0.62 },
          { x: -0.45, y: 0.5 },
        ],
        closed: true,
      },
    ],
    dots: [{ x: 0, y: 0, r: 0.26 }],
  },
  alvo: {
    strokes: [{ points: emVolta(16, () => 0.78), closed: true }],
    dots: [{ x: 0, y: 0, r: 0.3 }],
  },
  // Jogo da velha: a rede que prende.
  rede: {
    strokes: [
      { points: [{ x: -0.32, y: -0.8 }, { x: -0.32, y: 0.8 }] },
      { points: [{ x: 0.32, y: -0.8 }, { x: 0.32, y: 0.8 }] },
      { points: [{ x: -0.8, y: -0.32 }, { x: 0.8, y: -0.32 }] },
      { points: [{ x: -0.8, y: 0.32 }, { x: 0.8, y: 0.32 }] },
    ],
  },
  sobe: {
    strokes: [
      { points: [{ x: 0, y: 0.8 }, { x: 0, y: -0.7 }] },
      { points: [{ x: -0.5, y: -0.2 }, { x: 0, y: -0.75 }, { x: 0.5, y: -0.2 }] },
    ],
  },
  // Sem a linha do chão, que é do "Caído" de fábrica.
  desce: {
    strokes: [
      { points: [{ x: 0, y: -0.8 }, { x: 0, y: 0.7 }] },
      { points: [{ x: -0.5, y: 0.2 }, { x: 0, y: 0.75 }, { x: 0.5, y: 0.2 }] },
    ],
  },
  estrela: {
    strokes: [],
    solids: [emVolta(10, (indice) => (indice % 2 === 0 ? 0.95 : 0.4))],
  },
  xis: {
    strokes: [
      { points: [{ x: -0.65, y: -0.65 }, { x: 0.65, y: 0.65 }] },
      { points: [{ x: -0.65, y: 0.65 }, { x: 0.65, y: -0.65 }] },
    ],
  },
}

/**
 * A paleta do formulário. Tons claros e chapados, na família das pastilhas de
 * fábrica, para o desenho escuro ler por cima; "Outra cor" aceita qualquer uma.
 */
export const CORES_DE_CONDICAO: readonly { valor: string; nome: string }[] = [
  { valor: '#ff8a5c', nome: 'Laranja' },
  { valor: '#ef6f6c', nome: 'Vermelho' },
  { valor: '#f29ac2', nome: 'Rosa' },
  { valor: '#b39ddb', nome: 'Roxo' },
  { valor: '#7fb8f0', nome: 'Azul' },
  { valor: '#5fd0c5', nome: 'Turquesa' },
  { valor: '#8fd28a', nome: 'Verde' },
  { valor: '#c9a27a', nome: 'Terra' },
]

/** Desenho claro por cima de cor escura ("Outra cor" deixa o mestre escolher preto). */
const TINTA_CLARA = '#f4f1e8'
/** Abaixo desta claridade (0 a 1) o desenho escuro some na pastilha, e a tinta vira a clara. */
const CLARIDADE_MINIMA_DA_TINTA_ESCURA = 0.4

function tintaSobre(cor: number): string {
  const vermelho = (cor >> 16) & 0xff
  const verde = (cor >> 8) & 0xff
  const azul = cor & 0xff
  const claridade = (0.2126 * vermelho + 0.7152 * verde + 0.0722 * azul) / 255
  return claridade < CLARIDADE_MINIMA_DA_TINTA_ESCURA ? TINTA_CLARA : CONDITION_INK
}

/** A pastilha desta condição, no formato que o mapa e o painel já desenham (`ConditionSymbol`). */
export function simboloDaCondicaoPropria(condicao: Pick<CondicaoPropria, 'cor' | 'simbolo'>): ConditionSymbol {
  const desenho = ehSimboloDeCondicao(condicao.simbolo) ? DESENHOS[condicao.simbolo] : DESENHOS.alvo
  const cor = parseHexColor(condicao.cor)
  if (cor === null) return { ...desenho, fill: CORES_DE_CONDICAO[0].valor }
  return { ...desenho, fill: condicao.cor, ink: tintaSobre(cor) }
}

/** Teto do nome: cabe no chip do painel e na lista de quem joga. */
export const CONDICAO_NOME_MAX = 20
/** Quantas condições criadas uma ficha leva: com as cinco de fábrica, o leque ainda cabe na metade de cima do disco. */
export const CONDICOES_POR_FICHA_MAX = 6
/** Teto da lista do mestre. */
export const CATALOGO_MAX = 40

const ID_VALIDO = /^[\w-]{1,64}$/

/** O nome como é gravado: espaços enxugados e no teto. Qualquer coisa que não seja texto vira vazio. */
export function limparNomeDeCondicao(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, CONDICAO_NOME_MAX) : ''
}

function campoDe(value: object, chave: string): unknown {
  return Reflect.get(value, chave)
}

/**
 * Guarda de leitura, campo a campo. A entrada real é `unknown`: mapa lido do
 * disco, lista lida do `localStorage`, ficha que chega pela rede. Sem id, sem
 * nome, com cor que não é `#rrggbb` ou com desenho fora da biblioteca, não
 * vira marca. A cor sai sempre em minúsculas.
 */
export function lerCondicaoPropria(value: unknown): CondicaoPropria | null {
  if (typeof value !== 'object' || value === null) return null
  const id = campoDe(value, 'id')
  const nome = limparNomeDeCondicao(campoDe(value, 'nome'))
  const cor = parseHexColor(campoDe(value, 'cor'))
  const simbolo = campoDe(value, 'simbolo')
  if (typeof id !== 'string' || !ID_VALIDO.test(id) || nome === '' || cor === null || !ehSimboloDeCondicao(simbolo)) return null
  return { id, nome, cor: `#${cor.toString(16).padStart(6, '0')}`, simbolo }
}

function lerLista(cru: unknown, teto: number): CondicaoPropria[] {
  if (!Array.isArray(cru)) return []
  const vistas = new Set<string>()
  const lista: CondicaoPropria[] = []
  for (const item of cru) {
    const condicao = lerCondicaoPropria(item)
    if (condicao === null || vistas.has(condicao.id)) continue
    vistas.add(condicao.id)
    lista.push(condicao)
    if (lista.length === teto) break
  }
  return lista
}

/** As condições criadas que valem numa ficha: limpas, sem repetir e no teto. Mesmo contrato de `tokenConditionsOf`. */
export function condicoesPropriasOf(token: { condicoesProprias?: unknown } | undefined): CondicaoPropria[] {
  return lerLista(token?.condicoesProprias, CONDICOES_POR_FICHA_MAX)
}

/** A lista do mestre como veio do armazenamento: limpa, sem repetir e no teto. */
export function lerCatalogoDeCondicoes(cru: unknown): CondicaoPropria[] {
  return lerLista(cru, CATALOGO_MAX)
}

/** O que o formulário entrega: tudo menos o id. */
export type RascunhoDeCondicao = Pick<CondicaoPropria, 'nome' | 'cor' | 'simbolo'>

/** Condição nova a partir do formulário; `null` quando o rascunho não passa na leitura (nome vazio, cor torta). */
export function criarCondicaoPropria(rascunho: RascunhoDeCondicao, id: string = `cond_${crypto.randomUUID()}`): CondicaoPropria | null {
  return lerCondicaoPropria({ ...rascunho, id })
}

/** A ficha com exatamente estas condições criadas. Lista vazia APAGA o campo, como em `conditions`. */
function comCondicoesProprias(token: Token, lista: readonly CondicaoPropria[]): Token {
  const { condicoesProprias: _antigas, ...semCondicoes } = token
  return lista.length === 0 ? semCondicoes : { ...semCondicoes, condicoesProprias: [...lista] }
}

/**
 * Marca a condição na ficha se ela não está lá, desmarca se está — o clique do
 * painel. Devolve o MESMO mapa quando nada muda (ficha inexistente, condição
 * que não passa na leitura, ficha já no teto), para quem chama não gastar
 * entrada de histórico à toa.
 */
export function alternarCondicaoPropria(map: MapData, tokenId: string, condicao: CondicaoPropria): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  const limpa = lerCondicaoPropria(condicao)
  if (index === -1 || limpa === null) return map
  const token = map.tokens[index]
  const atuais = condicoesPropriasOf(token)
  const marcada = atuais.some((c) => c.id === limpa.id)
  if (!marcada && atuais.length >= CONDICOES_POR_FICHA_MAX) return map
  const tokens = map.tokens.slice()
  tokens[index] = comCondicoesProprias(token, marcada ? atuais.filter((c) => c.id !== limpa.id) : [...atuais, limpa])
  return { ...map, tokens }
}

/** Passa por toda ficha que tem condição criada; `trocar` devolve a lista nova ou `null` para deixar a ficha como está. */
function nasFichas(map: MapData, trocar: (atuais: CondicaoPropria[]) => CondicaoPropria[] | null): MapData {
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const atuais = condicoesPropriasOf(token)
    const novas = atuais.length === 0 ? null : trocar(atuais)
    if (novas === null) return token
    mudou = true
    return comCondicoesProprias(token, novas)
  })
  return mudou ? { ...map, tokens } : map
}

function mesmaCondicao(a: CondicaoPropria, b: CondicaoPropria): boolean {
  return a.id === b.id && a.nome === b.nome && a.cor === b.cor && a.simbolo === b.simbolo
}

/** O mestre editou a condição: as fichas desta cena que a levam passam a mostrar o nome, a cor e o desenho novos. */
export function trocarCondicaoPropriaNasFichas(map: MapData, condicao: CondicaoPropria): MapData {
  const limpa = lerCondicaoPropria(condicao)
  if (limpa === null) return map
  return nasFichas(map, (atuais) =>
    atuais.some((c) => c.id === limpa.id && !mesmaCondicao(c, limpa)) ? atuais.map((c) => (c.id === limpa.id ? limpa : c)) : null,
  )
}

/** O mestre excluiu a condição: ela sai de toda ficha desta cena. */
export function tirarCondicaoPropriaDasFichas(map: MapData, condicaoId: string): MapData {
  return nasFichas(map, (atuais) => (atuais.some((c) => c.id === condicaoId) ? atuais.filter((c) => c.id !== condicaoId) : null))
}
