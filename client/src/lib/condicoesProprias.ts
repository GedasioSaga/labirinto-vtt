import type { CondicaoPropria, MapData, Token } from '../types/map'
import { lerPecasDaCondicao, lerPrazoDaCondicao, lerSaidasDaCondicao, lerTipoDaCondicao } from './condicoes/leitura'
import { chaveDaCondicao, CONFIRA_DA_CONDICAO_MAX, ehIdDeCondicao } from './condicoes/modelo'
import { gatilhoLido } from './itens/pecasDoItem'
import { parseHexColor } from './tokenColor'
import { CONDITION_INK, TOKEN_CONDITION_SYMBOLS, type ConditionSymbol, type ConditionSymbolPoint } from './tokenConditions'

/**
 * CONDIÇÃO CRIADA PELO MESTRE (pedido de 09/11/2026): além das cinco de
 * fábrica (`lib/tokenConditions.ts`), o mestre monta as dele — nome, cor e um
 * símbolo: um desenho da biblioteca abaixo, ou uma letra, um número ou um
 * emoji que ele digita — e marca na ficha com um clique. Puro: sem DOM, sem
 * Pixi, sem store.
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

// ───────────────────────────────────────────────────────────────────────────
// OS 10 DESENHOS NOVOS (rework das condições, PLANO.md §2, E1; decisão 11 do protótipo)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Os desenhos que entraram no rework das condições. Moram no campo `desenho` da condição, e o
 * `simbolo` guarda um dos 14 de antes como RESERVA (`RESERVA_DO_DESENHO`): o app de antes, o mapa aberto
 * noutro computador e a tela de quem joga ainda sem a versão nova desenham a reserva, e a pastilha não
 * some (o leitor de antes recusa símbolo fora da biblioteca dele).
 */
export type DesenhoNovoDeCondicao = 'caveira' | 'raiz' | 'ampulheta' | 'calado' | 'espiral' | 'olhoRiscado' | 'lua' | 'bomba' | 'onda' | 'fantasma'

/** A ordem dos desenhos novos no formulário (depois dos 14 de antes). */
export const DESENHO_NOVO_ORDEM: readonly DesenhoNovoDeCondicao[] = ['caveira', 'raiz', 'ampulheta', 'calado', 'espiral', 'olhoRiscado', 'lua', 'bomba', 'onda', 'fantasma']

/** O nome que o leitor de tela diz e a dica mostra em cada desenho novo. */
export const DESENHO_NOVO_NOMES: Record<DesenhoNovoDeCondicao, string> = {
  caveira: 'Caveira',
  raiz: 'Raiz',
  ampulheta: 'Ampulheta',
  calado: 'Boca calada',
  espiral: 'Espiral',
  olhoRiscado: 'Olho riscado',
  lua: 'Lua',
  bomba: 'Bomba',
  onda: 'Onda',
  fantasma: 'Fantasma',
}

/** O desenho de antes que vai no `simbolo` de cada desenho novo: o mais parecido na biblioteca dos 14. */
export const RESERVA_DO_DESENHO: Record<DesenhoNovoDeCondicao, SimboloDeCondicao> = {
  caveira: 'xis',
  raiz: 'rede',
  ampulheta: 'desce',
  calado: 'xis',
  espiral: 'estrela',
  olhoRiscado: 'olho',
  lua: 'estrela',
  bomba: 'chama',
  onda: 'gota',
  fantasma: 'olho',
}

export function ehDesenhoNovoDeCondicao(value: unknown): value is DesenhoNovoDeCondicao {
  return typeof value === 'string' && DESENHO_NOVO_ORDEM.some((desenho) => desenho === value)
}

/** Qualquer desenho da pastilha: os 14 de antes e os 10 novos. */
export type DesenhoDeCondicao = SimboloDeCondicao | DesenhoNovoDeCondicao

/** Os 24 na ordem do formulário (`DESENHOS` do protótipo). */
export const DESENHO_ORDEM: readonly DesenhoDeCondicao[] = [...SIMBOLO_ORDEM, ...DESENHO_NOVO_ORDEM]

/** O nome de qualquer desenho. */
export function nomeDoDesenho(desenho: DesenhoDeCondicao): string {
  return ehDesenhoNovoDeCondicao(desenho) ? DESENHO_NOVO_NOMES[desenho] : SIMBOLO_NOMES[desenho]
}

/** O desenho que a condição mostra: o novo, se o app o conhece; senão o `simbolo`; senão o alvo (o mesmo de `simboloDaCondicaoPropria`). */
export function desenhoDaCondicao(condicao: Pick<CondicaoPropria, 'simbolo' | 'desenho'>): DesenhoDeCondicao {
  if (ehDesenhoNovoDeCondicao(condicao.desenho)) return condicao.desenho
  return ehSimboloDeCondicao(condicao.simbolo) ? condicao.simbolo : 'alvo'
}

/**
 * Os campos que gravam um desenho: o novo vai no `desenho`, com a reserva no `simbolo`; o de antes vai
 * só no `simbolo` (sem `desenho`). Uma regra só para o editor, a fábrica e "Usar como modelo".
 */
export function camposDoDesenho(desenho: DesenhoDeCondicao): { simbolo: SimboloDeCondicao; desenho?: DesenhoNovoDeCondicao } {
  return ehDesenhoNovoDeCondicao(desenho) ? { simbolo: RESERVA_DO_DESENHO[desenho], desenho } : { simbolo: desenho }
}

// ───────────────────────────────────────────────────────────────────────────
// SÍMBOLO DIGITADO: letra, número ou emoji no lugar do desenho
// ───────────────────────────────────────────────────────────────────────────

/** Quantos caracteres o símbolo digitado leva, contados como a pessoa os vê (grafemas). */
export const SIMBOLO_DIGITADO_MAX = 2
/**
 * Teto em unidades de código: um emoji de família tem 11, uma bandeira 4. Dois
 * emojis compostos cabem com folga; o que passa disto é pilha de acentos, não símbolo.
 */
const SIMBOLO_DIGITADO_UNIDADES_MAX = 40

/** O que a pessoa enxerga: letra, número, pontuação ou símbolo (o emoji é símbolo). */
const TEM_O_QUE_VER = /[\p{L}\p{N}\p{P}\p{S}]/u
/** Controle, metade solta de par e quebra de linha: nunca entram num símbolo. */
const NAO_ENTRA = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u
/**
 * Branco que passa por letra ou por símbolo e não deixa tinta: os ignoráveis do
 * Unicode (preenchedores de hangul como U+3164, largura zero, seletores), todo
 * espaço, o braille em branco (U+2800) e a nota musical vazia (U+1D159).
 */
const SEM_TINTA = /[\p{Default_Ignorable_Code_Point}\p{White_Space}⠀\u{1D159}]/gu

/**
 * O grafema deixa tinta na pastilha? Tirados os brancos, tem de sobrar o que
 * ver. O emoji composto leva seletor e junção invisíveis por dentro e passa: o
 * que não passa é o grafema feito SÓ de branco, que dava pastilha vazia.
 */
function temTinta(grafema: string): boolean {
  return TEM_O_QUE_VER.test(grafema.replace(SEM_TINTA, ''))
}

let separador: Intl.Segmenter | null = null

/**
 * O texto partido como a pessoa o lê: "👨‍👩‍👧" é UM caractere, embora tenha 8
 * unidades de código. Navegador sem `Intl.Segmenter` (Firefox antigo, na tela
 * de quem joga) não sabe partir: o texto conta como um só, e vale o teto em
 * unidades de código.
 */
function grafemasDe(texto: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return texto === '' ? [] : [texto]
  separador ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(separador.segment(texto), (parte) => parte.segment)
}

/**
 * O símbolo digitado como é gravado: sem espaço, só o que se enxerga, no
 * máximo `SIMBOLO_DIGITADO_MAX` caracteres. Vazio = não há símbolo digitado
 * (vale o desenho). Serve ao campo do formulário, que corta enquanto o mestre
 * digita, e à leitura do disco e da rede.
 */
export function limparSimboloDigitado(value: unknown): string {
  if (typeof value !== 'string') return ''
  const visiveis = grafemasDe(value.replace(/\s+/gu, '')).filter((grafema) => temTinta(grafema) && !NAO_ENTRA.test(grafema))
  let limpo = visiveis.slice(0, SIMBOLO_DIGITADO_MAX)
  while (limpo.length > 0 && limpo.join('').length > SIMBOLO_DIGITADO_UNIDADES_MAX) limpo = limpo.slice(0, -1)
  return limpo.join('')
}

/** Quantos caracteres o símbolo tem, para o encaixe na pastilha (um ocupa o disco; dois dividem a largura). */
export function caracteresDoSimbolo(texto: string): number {
  return grafemasDe(texto).length
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

/** Pontos num arco de círculo, de `de` a `ate` graus (0 = leste, 90 = para baixo, como o y da tela), inclusive. */
function arco(cx: number, cy: number, raio: number, de: number, ate: number, passos: number): ConditionSymbolPoint[] {
  return Array.from({ length: passos + 1 }, (_, indice) => {
    const angulo = ((de + ((ate - de) * indice) / passos) * Math.PI) / 180
    return { x: Number((cx + raio * Math.cos(angulo)).toFixed(3)), y: Number((cy + raio * Math.sin(angulo)).toFixed(3)) }
  })
}

/** A espiral que abre do centro: `voltas` voltas, do raio `de` ao `ate`. */
function espiral(voltas: number, de: number, ate: number, passos: number): ConditionSymbolPoint[] {
  return Array.from({ length: passos + 1 }, (_, indice) => {
    const parte = indice / passos
    const angulo = parte * voltas * 2 * Math.PI
    const raio = de + (ate - de) * parte
    return { x: Number((raio * Math.cos(angulo)).toFixed(3)), y: Number((raio * Math.sin(angulo)).toFixed(3)) }
  })
}

/** Uma onda deitada na altura `y`, de ponta a ponta do quadrado, com uma volta e meia. */
function linhaDeOnda(y: number): ConditionSymbolPoint[] {
  const passos = 12
  return Array.from({ length: passos + 1 }, (_, indice) => ({
    x: Number((-0.9 + (1.8 * indice) / passos).toFixed(3)),
    y: Number((y - 0.15 * Math.sin((indice * Math.PI) / 4)).toFixed(3)),
  }))
}

/** O desenho de uma pastilha de fábrica, sem a cor nem a tinta (o fantasma e a ampulheta já existem lá). */
function soODesenho(simbolo: ConditionSymbol): Desenho {
  return { strokes: simbolo.strokes, ...(simbolo.solids === undefined ? {} : { solids: simbolo.solids }), ...(simbolo.dots === undefined ? {} : { dots: simbolo.dots }) }
}

/**
 * Os 10 desenhos novos, no mesmo quadrado e no mesmo idioma dos 14 (forma cheia ou traço grosso). O
 * fantasma e a ampulheta são os das pastilhas de fábrica do Invisível e do Lento: um desenho só.
 */
const DESENHOS_NOVOS: Record<DesenhoNovoDeCondicao, Desenho> = {
  // Crânio cheio com os olhos vazados (sem os dentes: viravam borrão em 18 px).
  caveira: {
    strokes: [],
    solids: [[...arco(0, -0.16, 0.74, 140, 400, 14), { x: 0.45, y: 0.42 }, { x: 0.45, y: 0.8 }, { x: -0.45, y: 0.8 }, { x: -0.45, y: 0.42 }]],
    dots: [
      { x: -0.27, y: -0.1, r: 0.2, hole: true },
      { x: 0.27, y: -0.1, r: 0.2, hole: true },
    ],
  },
  // O caule que se abre em três raízes, com as duas folhas no alto.
  raiz: {
    strokes: [
      { points: [{ x: 0, y: -0.9 }, { x: 0, y: 0 }] },
      { points: [{ x: 0, y: 0 }, { x: -0.12, y: 0.35 }, { x: -0.38, y: 0.6 }, { x: -0.68, y: 0.84 }] },
      { points: [{ x: 0, y: 0 }, { x: 0.12, y: 0.35 }, { x: 0.38, y: 0.6 }, { x: 0.68, y: 0.84 }] },
      { points: [{ x: 0, y: 0 }, { x: 0, y: 0.9 }] },
      { points: [{ x: -0.42, y: -0.58 }, { x: -0.15, y: -0.47 }, { x: 0, y: -0.32 }, { x: 0.15, y: -0.47 }, { x: 0.42, y: -0.58 }] },
    ],
  },
  ampulheta: soODesenho(TOKEN_CONDITION_SYMBOLS.lento),
  // A boca fechada (o contorno e a linha dos lábios), riscada.
  calado: {
    strokes: [
      {
        points: [
          { x: -0.74, y: 0.05 },
          { x: -0.42, y: -0.2 },
          { x: 0, y: -0.3 },
          { x: 0.42, y: -0.2 },
          { x: 0.74, y: 0.05 },
          { x: 0.42, y: 0.3 },
          { x: 0, y: 0.4 },
          { x: -0.42, y: 0.3 },
        ],
        closed: true,
      },
      { points: [{ x: -0.55, y: 0.05 }, { x: 0.55, y: 0.05 }] },
      { points: [{ x: -0.8, y: -0.8 }, { x: 0.8, y: 0.8 }] },
    ],
  },
  espiral: { strokes: [{ points: espiral(2.25, 0.06, 0.86, 30) }] },
  // O mesmo olho do "olho", sem a pupila e riscado.
  olhoRiscado: { strokes: [...DESENHOS.olho.strokes, { points: [{ x: -0.8, y: -0.75 }, { x: 0.8, y: 0.75 }] }] },
  // Lua crescente cheia: o disco menos o disco deslocado para o alto e a direita.
  lua: { strokes: [], solids: [[...arco(0, 0, 0.85, 270, 0, 18), ...arco(0.32, -0.32, 0.62, 31, 239, 12)]] },
  // A bomba redonda, com o brilho vazado e o pavio.
  bomba: {
    strokes: [{ points: [{ x: 0.3, y: -0.28 }, { x: 0.5, y: -0.55 }, { x: 0.78, y: -0.72 }] }],
    dots: [
      { x: -0.14, y: 0.24, r: 0.66 },
      { x: -0.36, y: 0.04, r: 0.13, hole: true },
      { x: 0.84, y: -0.78, r: 0.09 },
    ],
  },
  onda: { strokes: [{ points: linhaDeOnda(-0.3) }, { points: linhaDeOnda(0.3) }] },
  fantasma: soODesenho(TOKEN_CONDITION_SYMBOLS.invisivel),
}

/**
 * A paleta do formulário. Tons claros e chapados, na família das pastilhas de
 * fábrica, para o desenho escuro ler por cima; "Outra cor" aceita qualquer uma.
 */
export const CORES_DE_CONDICAO: readonly { valor: string; nome: NomeDaCorDeCondicao }[] = [
  { valor: '#ff8a5c', nome: 'Laranja' },
  { valor: '#ef6f6c', nome: 'Vermelho' },
  { valor: '#f29ac2', nome: 'Rosa' },
  { valor: '#b39ddb', nome: 'Roxo' },
  { valor: '#7fb8f0', nome: 'Azul' },
  { valor: '#5fd0c5', nome: 'Turquesa' },
  { valor: '#8fd28a', nome: 'Verde' },
  { valor: '#c9a27a', nome: 'Terra' },
  // Rework das condições (decisão 11 do protótipo): as duas que faltavam ao Eletrocutado, ao Aéreo e ao Cego.
  { valor: '#f0d35c', nome: 'Amarelo' },
  { valor: '#b9b1a3', nome: 'Cinza' },
]

/** O nome de uma cor da paleta. */
export type NomeDaCorDeCondicao = 'Laranja' | 'Vermelho' | 'Rosa' | 'Roxo' | 'Azul' | 'Turquesa' | 'Verde' | 'Terra' | 'Amarelo' | 'Cinza'

/** O `#rrggbb` de uma cor da paleta pelo nome (a fábrica escreve "Verde", não o número). */
export function corDaPaleta(nome: NomeDaCorDeCondicao): string {
  return CORES_DE_CONDICAO.find((cor) => cor.nome === nome)?.valor ?? CORES_DE_CONDICAO[0].valor
}

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

const SEM_DESENHO: Desenho = { strokes: [] }

/**
 * A pastilha desta condição, no formato que o mapa e o painel já desenham
 * (`ConditionSymbol`). Com símbolo digitado, ele vai no lugar do desenho; a
 * tinta é a mesma nos dois casos, escolhida contra a cor da pastilha.
 */
export function simboloDaCondicaoPropria(condicao: Pick<CondicaoPropria, 'cor' | 'simbolo' | 'texto' | 'desenho'>): ConditionSymbol {
  const digitado = typeof condicao.texto === 'string' && condicao.texto !== '' ? condicao.texto : null
  // Rework das condições: o desenho novo vence a reserva do `simbolo` (`desenhoDaCondicao`).
  const qual = desenhoDaCondicao(condicao)
  const desenho = digitado !== null ? SEM_DESENHO : ehDesenhoNovoDeCondicao(qual) ? DESENHOS_NOVOS[qual] : DESENHOS[qual]
  const marca = digitado === null ? desenho : { ...desenho, texto: digitado }
  const cor = parseHexColor(condicao.cor)
  if (cor === null) return { ...marca, fill: CORES_DE_CONDICAO[0].valor }
  return { ...marca, fill: condicao.cor, ink: tintaSobre(cor) }
}

/** Teto do nome, em unidades de código: cabe no chip do painel e na lista de quem joga. */
export const CONDICAO_NOME_MAX = 20
/** Quantas condições criadas uma ficha leva: com as cinco de fábrica, o leque ainda cabe na metade de cima do disco. */
export const CONDICOES_POR_FICHA_MAX = 6
/** Teto da lista do mestre. */
export const CATALOGO_MAX = 40

/** Metade solta de par (arquivo editado à mão): não é texto, e chega torta a quem joga. */
const METADE_SOLTA = /\p{Cs}/gu

/**
 * O texto um caractere por vez, como a pessoa o lê, sem partir o texto inteiro
 * (quem corta para no teto). Sem `Intl.Segmenter` (Firefox antigo, na tela de
 * quem joga) vai por ponto de código, que ao menos nunca separa as duas
 * metades de um emoji.
 */
function* caracteresDe(texto: string): Generator<string> {
  if (typeof Intl.Segmenter !== 'function') {
    yield* texto
    return
  }
  separador ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  for (const parte of separador.segment(texto)) yield parte.segment
}

/**
 * O nome no teto, cortado só ENTRE caracteres: o que não cabe inteiro fica de
 * fora. O `slice` deixava metade de um emoji no fim, e ela chegava a quem joga.
 * Não enxuga espaço: é o corte do campo do formulário, enquanto o mestre ainda
 * digita a palavra seguinte.
 */
export function cortarNomeDeCondicao(texto: string): string {
  let nome = ''
  for (const caractere of caracteresDe(texto)) {
    if (nome.length + caractere.length > CONDICAO_NOME_MAX) break
    nome += caractere
  }
  return nome
}

/** O nome como é gravado: espaços enxugados, sem metade solta de par e no teto. Qualquer coisa que não seja texto vira vazio. */
export function limparNomeDeCondicao(value: unknown): string {
  if (typeof value !== 'string') return ''
  return cortarNomeDeCondicao(value.replace(METADE_SOLTA, '').replace(/\s+/g, ' ').trim()).trimEnd()
}

function campoDe(value: object, chave: string): unknown {
  return Reflect.get(value, chave)
}

/**
 * Guarda de leitura, campo a campo. A entrada real é `unknown`: mapa lido do
 * disco, lista lida do arquivo da pasta ou do `localStorage`, ficha que chega
 * pela rede. Sem id, sem nome, com cor que não é `#rrggbb` ou com desenho fora
 * da biblioteca, não vira marca. A cor sai sempre em minúsculas. O símbolo
 * digitado que não passa na limpeza só some: a marca fica, com o desenho.
 */
export function lerCondicaoPropria(value: unknown): CondicaoPropria | null {
  if (typeof value !== 'object' || value === null) return null
  const id = campoDe(value, 'id')
  const nome = limparNomeDeCondicao(campoDe(value, 'nome'))
  const cor = parseHexColor(campoDe(value, 'cor'))
  const simbolo = campoDe(value, 'simbolo')
  if (!ehIdDeCondicao(id) || nome === '' || cor === null || !ehSimboloDeCondicao(simbolo)) return null
  const texto = limparSimboloDigitado(campoDe(value, 'texto'))
  const lida: CondicaoPropria = { id, nome, cor: `#${cor.toString(16).padStart(6, '0')}`, simbolo }
  if (texto !== '') lida.texto = texto
  const comRegra = comRegraLida(lida, campoDe(value, 'regra'), campoDe(value, 'n'))
  // Pedido de 26/11: o gatilho "depois de X turnos". Ausente ou torto = sem gatilho.
  const gatilho = gatilhoLido(campoDe(value, 'gatilho'))
  return comCamposDoRework(gatilho === undefined ? comRegra : { ...comRegra, gatilho }, value)
}

/**
 * Rework das condições (E1): o tipo, o desenho novo, as peças, o prazo, as saídas e o "Confira", cada um
 * pelo leitor estrito (`lib/condicoes/leitura.ts`). Ausente fica ausente (a condição de antes volta byte
 * a byte; as peças dela a leitura monta depois, em `montadaDaAntiga`, sem gravar). Torto: a condição
 * fica com o nome e a pastilha; as peças e as saídas ficam vazias (não remontam da `regra`), o prazo e o
 * tipo voltam ao padrão, e o `confira` diz o que ficou de fora.
 */
function comCamposDoRework(lida: CondicaoPropria, cru: object): CondicaoPropria {
  const comCampos: CondicaoPropria = { ...lida }
  const deFora: string[] = []
  const tipo = campoDe(cru, 'tipo')
  if (tipo !== undefined) {
    const tipoLido = lerTipoDaCondicao(tipo)
    if (tipoLido === null) deFora.push('o tipo')
    else comCampos.tipo = tipoLido
  }
  const desenho = campoDe(cru, 'desenho')
  // Desenho que este app não conhece só some: a pastilha fica com a reserva do `simbolo`.
  if (ehDesenhoNovoDeCondicao(desenho)) comCampos.desenho = desenho
  const pecas = campoDe(cru, 'pecas')
  if (pecas !== undefined) {
    const pecasLidas = lerPecasDaCondicao(pecas)
    if (pecasLidas === null) deFora.push('as peças')
    comCampos.pecas = pecasLidas ?? []
  }
  const prazo = campoDe(cru, 'prazo')
  if (prazo !== undefined) {
    const prazoLido = lerPrazoDaCondicao(prazo)
    if (prazoLido === null) deFora.push('o prazo')
    else comCampos.prazo = prazoLido
  }
  const saidas = campoDe(cru, 'saidas')
  if (saidas !== undefined) {
    const saidasLidas = lerSaidasDaCondicao(saidas)
    if (saidasLidas === null) deFora.push('as saídas')
    comCampos.saidas = saidasLidas ?? []
  }
  const confira = deFora.length > 0 ? `Ficou de fora na leitura: ${juntarComE(deFora)}. Confira e monte de novo.` : confiraLido(campoDe(cru, 'confira'))
  if (confira !== null) comCampos.confira = confira
  return comCampos
}

function juntarComE(partes: readonly string[]): string {
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** O "Confira" gravado: texto aparado, no teto; vazio ou torto = nenhum. */
function confiraLido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const texto = valor.replace(METADE_SOLTA, '').trim().slice(0, CONFIRA_DA_CONDICAO_MAX).trim()
  return texto === '' ? null : texto
}

/**
 * A condição traz algum campo do rework (o tipo, o desenho novo, as peças, o prazo, as saídas, o
 * "Confira")? É o que faz o `condicoes.json` sair na versão 2, que o app de antes recusa ler e gravar
 * (sem ela, ele regravaria a lista sem esses campos).
 */
export function temCampoDoRework(condicao: CondicaoPropria): boolean {
  return (
    condicao.tipo !== undefined ||
    condicao.desenho !== undefined ||
    condicao.pecas !== undefined ||
    condicao.prazo !== undefined ||
    condicao.saidas !== undefined ||
    condicao.confira !== undefined
  )
}

/** Teto do número da regra `vida` (a mesma vida por turno do prazo, `PRAZO_POR_VEZ_MAX`). */
export const N_DA_VIDA_MAX = 999
/** Teto do número da regra `cura`: cortar mais que 100% não existe. */
export const N_DA_CURA_MAX = 100

/**
 * A regra e o número (E4a, decisão 10). `narra`, regra torta ou ausente: nenhum
 * dos dois campos (a condição de antes volta byte a byte). Número torto ou fora
 * do teto da regra vira 0, que também some do arquivo.
 */
function comRegraLida(lida: CondicaoPropria, regra: unknown, n: unknown): CondicaoPropria {
  if (regra !== 'vida' && regra !== 'cura') return lida
  const teto = regra === 'vida' ? N_DA_VIDA_MAX : N_DA_CURA_MAX
  const numero = typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= teto ? n : 0
  return numero === 0 ? { ...lida, regra } : { ...lida, regra, n: numero }
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

/**
 * A lista com esta condição gravada: troca a de mesmo id, ou entra no fim.
 * `null` = não coube (condição nova e a lista já está no teto). A mesma regra
 * para a lista em memória, a do computador e a do arquivo da pasta.
 */
export function listaComCondicao(lista: readonly CondicaoPropria[], condicao: CondicaoPropria): CondicaoPropria[] | null {
  if (lista.some((c) => c.id === condicao.id)) return lista.map((c) => (c.id === condicao.id ? condicao : c))
  return lista.length >= CATALOGO_MAX ? null : [...lista, condicao]
}

/** A lista sem a condição `id`; a mesma lista quando ela não está lá. */
export function listaSemCondicao(lista: readonly CondicaoPropria[], id: string): readonly CondicaoPropria[] {
  return lista.some((c) => c.id === id) ? lista.filter((c) => c.id !== id) : lista
}

/** O que o formulário entrega: tudo menos o id. Rework das condições: também o tipo, o desenho novo, as peças, o prazo e as saídas. */
export type RascunhoDeCondicao = Pick<CondicaoPropria, 'nome' | 'cor' | 'simbolo' | 'texto' | 'regra' | 'n' | 'gatilho' | 'tipo' | 'desenho' | 'pecas' | 'prazo' | 'saidas'>

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

/**
 * As duas, já lidas (`lerCondicaoPropria` monta as chaves sempre na mesma ordem), são iguais campo a
 * campo? Rework das condições: compara tudo (o gatilho, as peças, o prazo e as saídas inclusive), para a
 * cópia que vai na ficha acompanhar a condição editada.
 */
function mesmaCondicao(a: CondicaoPropria, b: CondicaoPropria): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Quantas fichas deste mapa levam a condição `condicaoId`: o número do aviso de editar e de excluir. */
export function fichasComCondicao(map: Pick<MapData, 'tokens'>, condicaoId: string): number {
  return map.tokens.filter((token) => condicoesPropriasOf(token).some((c) => c.id === condicaoId)).length
}

/** O mestre editou a condição: as fichas desta cena que a levam passam a mostrar o nome, a cor e o desenho novos. */
export function trocarCondicaoPropriaNasFichas(map: MapData, condicao: CondicaoPropria): MapData {
  const limpa = lerCondicaoPropria(condicao)
  if (limpa === null) return map
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const atuais = condicoesPropriasOf(token)
    const antiga = atuais.find((c) => c.id === limpa.id)
    if (antiga === undefined || mesmaCondicao(antiga, limpa)) return token
    mudou = true
    const comANova = comCondicoesProprias(token, atuais.map((c) => (c.id === limpa.id ? limpa : c)))
    // PENDENCIAS do rework, nº 13: renomeada, o prazo dela na ficha (guardado pelo NOME) acompanha; senão o prazo ficava órfão.
    return antiga.nome === limpa.nome ? comANova : comPrazoRenomeado(comANova, antiga.nome, limpa.nome)
  })
  return mudou ? { ...map, tokens } : map
}

/** O prazo da condição `de` (pela chave do nome) passa a ser o de `para`; nenhum = a mesma ficha. */
function comPrazoRenomeado(token: Token, de: string, para: string): Token {
  const prazos = token.prazosDasCondicoes
  // O mapa do disco chega cru (`prazosDasCondicoes` não passou por leitor): só lista, só entrada com nome em texto.
  if (!Array.isArray(prazos)) return token
  const chave = chaveDaCondicao(de)
  let mudou = false
  const novos = prazos.map((prazo) => {
    if (typeof prazo !== 'object' || prazo === null || typeof prazo.nome !== 'string' || chaveDaCondicao(prazo.nome) !== chave) return prazo
    mudou = true
    return { ...prazo, nome: para }
  })
  return mudou ? { ...token, prazosDasCondicoes: novos } : token
}

/** O mestre excluiu a condição: ela sai de toda ficha desta cena. */
export function tirarCondicaoPropriaDasFichas(map: MapData, condicaoId: string): MapData {
  return nasFichas(map, (atuais) => (atuais.some((c) => c.id === condicaoId) ? atuais.filter((c) => c.id !== condicaoId) : null))
}
