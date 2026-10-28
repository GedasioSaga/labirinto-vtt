import type { Pin, PinBlockReason, PinIcon, PinKind, PinPassage, RegionPoint } from '../types/map'
import { MINIGAME_PADRAO, type MinigameDanca, type MusicaDaDanca } from '../minigames/danca/tipos'
import { MINIGAME_PESCA_PADRAO, type MinigamePesca } from '../minigames/pesca/tipos'
import { MINIGAME_TIRO_PADRAO, type MinigameTiro } from '../minigames/tiro/tipos'
import type { JogoDoMinigame, MinigameDoPino } from '../minigames/tipos'
import { parseHexColor } from './tokenColor'

/**
 * Regras do pino de ponto de interesse, compartilhadas pelo editor (render e
 * clique) e pelo jogador (render e toque). Puro: sem DOM, sem Pixi, sem store.
 */

/** Altura do pino em px de mundo, da ponta cravada ao topo da cabeça. */
export const PIN_HEIGHT = 34
/** Raio da cabeça redonda onde mora o glifo, em px de mundo. */
export const PIN_HEAD_RADIUS = 11
/** Centro da cabeça fica esta distância acima do ponto cravado. */
export const PIN_HEAD_OFFSET = PIN_HEIGHT - PIN_HEAD_RADIUS

/**
 * Altura mínima do pino na TELA, em px. O pino é desenhado em px de mundo e,
 * com a cena inteira na janela, virava um risco de 3 px que ninguém via (relato
 * dos jogadores, torre-lote-5 #485 e #517). Abaixo do zoom em que ficaria menor
 * que isto, ele cresce no mundo na razão inversa da câmera — a mesma ideia do
 * nome da ficha (`screenLabel.ts`). 16 px deixa a cabeça com ~10 px de
 * diâmetro e o limiar em ~47% de zoom: perto disso o pino já tem o tamanho de sempre.
 */
export const PIN_MIN_SCREEN_HEIGHT = 16

/**
 * Quantas vezes o pino cresce no mundo para não ficar abaixo de
 * `PIN_MIN_SCREEN_HEIGHT` na tela: 1 (tamanho de mundo) de perto, maior que 1
 * de longe. Escala inválida (zero, negativa, não finita) devolve 1 — o desenho
 * e o toque seguem o pino de sempre em vez de estourar.
 */
export function pinSizeScale(cameraScale: number): number {
  if (!Number.isFinite(cameraScale) || cameraScale <= 0) return 1
  return Math.max(1, PIN_MIN_SCREEN_HEIGHT / (PIN_HEIGHT * cameraScale))
}

/** Tamanho do pino (`Pin.escala`, fatia 14): de metade a três vezes o de sempre. */
export const PIN_ESCALA_MIN = 0.5
export const PIN_ESCALA_MAX = 3
/** Passo do deslizante "Tamanho" da Aparência. */
export const PIN_ESCALA_PASSO = 0.25
/** A cor de fábrica da cabeça (o latão): escolher esta é voltar ao padrão. */
export const PIN_COR_PADRAO = '#f2c14e'
/** Paleta da Aparência: a mesma do protótipo consolidado (a do campo Cor do token). */
export const PIN_CORES: readonly string[] = ['#d9d2c0', '#c98a5b', '#e2645a', '#e0a44a', '#7fb48a', '#79a9cc', '#ab93d6', '#5b6670']

/** Escala que o arquivo pode guardar: número finito na faixa. */
export function isPinEscala(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= PIN_ESCALA_MIN && value <= PIN_ESCALA_MAX
}

/** Fator de tamanho do pino; ausente ou torto (arquivo editado à mão, host antigo) = 1. */
export function escalaDoPino(pin: Pick<Pin, 'escala'>): number {
  return isPinEscala(pin.escala) ? pin.escala : 1
}

/**
 * Piso do pino REDUZIDO (`Pin.escala` < 1), como fator de mundo: ele também não
 * fica abaixo de `PIN_MIN_SCREEN_HEIGHT` na tela — no celular afastado, o "?"
 * do pino 0,5 virava um risco de 6 px. `pinSizeScale` só garante o piso ao
 * pino 1x; a escala menor, aplicada por cima, furava esse piso. Nunca menor que
 * `PIN_ESCALA_MIN` (nenhum pino desce disso, e o zoom de perto não repinta à
 * toa). Câmera inválida devolve 0: sem piso, o fator de sempre.
 */
export function pinSizeFloor(cameraScale: number): number {
  if (!Number.isFinite(cameraScale) || cameraScale <= 0) return 0
  return Math.max(PIN_ESCALA_MIN, PIN_MIN_SCREEN_HEIGHT / (PIN_HEIGHT * cameraScale))
}

/**
 * O piso que importa para ESTES pinos: `pinSizeFloor` só quando algum é
 * reduzido; sem nenhum, 0 — e o zoom de perto não repinta pino à toa.
 */
export function pinSizeFloorFor(pins: readonly Pick<Pin, 'escala'>[], cameraScale: number): number {
  return pins.some((pin) => escalaDoPino(pin) < 1) ? pinSizeFloor(cameraScale) : 0
}

/**
 * Fator de mundo com que ESTE pino é desenhado e tocado: o do zoom
 * (`pinSizeScale`) vezes a escala dele, sem descer do piso (`pinSizeFloor`). O
 * pino de escala 1 ou maior nunca bate no piso — o fator do zoom já o garante
 * —, então só o reduzido muda, e só quando ficaria pequeno demais na tela.
 */
export function fatorDoPino(pin: Pick<Pin, 'escala'>, sizeScale: number, sizeFloor = 0): number {
  const piso = Number.isFinite(sizeFloor) && sizeFloor > 0 ? sizeFloor : 0
  return Math.max(sizeScale * escalaDoPino(pin), piso)
}

/** `#rrggbb` minúsculo, ou `undefined` para qualquer outra coisa. */
export function normalizarCorDoPino(value: unknown): string | undefined {
  return typeof value === 'string' && parseHexColor(value) !== null ? value.toLowerCase() : undefined
}

/**
 * O que a Aparência grava em `Pin.cor`: `null` ("Cor padrão"), cor torta ou o
 * próprio latão de fábrica viram AUSENTE — o arquivo de um mapa antigo sai igual.
 */
export function corDoPinoParaGravar(cor: string | null): string | undefined {
  const normalizada = normalizarCorDoPino(cor)
  return normalizada === PIN_COR_PADRAO ? undefined : normalizada
}

/** O que a Aparência grava em `Pin.escala`: `null` ("Padrão"), 1 ou valor fora da faixa viram AUSENTE. */
export function escalaDoPinoParaGravar(escala: number | null): number | undefined {
  return isPinEscala(escala) && escala !== 1 ? escala : undefined
}

/** Cor da cabeça como número `0xRRGGBB`, ou `null` = o latão de sempre. */
export function corDoPino(pin: Pick<Pin, 'cor'>): number | null {
  return parseHexColor(pin.cor)
}

/**
 * Teto da folga do toque, em raios da cabeça DESENHADA. A folga em px de tela
 * existe para o dedo, mas sem teto ela vale mais que o próprio pino quando ele
 * está pequeno: o toque ao lado abria um pino que não aparecia. Dois raios (um
 * diâmetro de cabeça em volta do desenho) seguem generosos para o dedo.
 */
export const PIN_TAP_MAX_HEAD_RADII = 2

/**
 * Folga do toque no pino, em px de MUNDO, para passar a `findPinAt`: a folga
 * pedida em px de tela, limitada a `PIN_TAP_MAX_HEAD_RADII` raios da cabeça como
 * ela aparece na tela neste zoom (já com `pinSizeScale`). Escala inválida → 0:
 * sem zoom conhecido não há como converter, e folga infinita abriria qualquer pino.
 */
export function pinTapTolerance(screenTolerancePx: number, cameraScale: number): number {
  if (!Number.isFinite(cameraScale) || cameraScale <= 0) return 0
  const headOnScreen = PIN_HEAD_RADIUS * pinSizeScale(cameraScale) * cameraScale
  return Math.min(screenTolerancePx, headOnScreen * PIN_TAP_MAX_HEAD_RADII) / cameraScale
}

/**
 * Glifo de cada tipo — é o que distingue "!" de "?" na tela do jogador. O pino
 * de viagem não desenha glifo: a cabeça dele leva o símbolo de passagem
 * (`PIN_TRAVEL_SYMBOL`); a seta aqui só existe para quem precisa de texto.
 */
export const PIN_GLYPH: Record<PinKind, string> = {
  exclamacao: '!',
  interrogacao: '?',
  viagem: '→',
  // A alavanca também desenha símbolo (`PIN_LEVER_SYMBOL`), nunca este texto.
  alavanca: '/',
  // O minigame desenha o controle (`PIN_CONTROLE_SYMBOL`); a nota é o texto
  // das listas de texto puro (pistas do mestre, lugares do jogador).
  minigame: '♪',
}

/** Nome de cada tipo na interface do mestre. */
export const PIN_KIND_LABELS: Record<PinKind, string> = {
  exclamacao: 'Exclamação (!)',
  interrogacao: 'Interrogação (?)',
  viagem: 'Viagem',
  alavanca: 'Alavanca',
  minigame: 'Minigame',
}

/**
 * Ordem em que os tipos aparecem no painel: os dois de sempre, a viagem, a
 * alavanca e o minigame por último — o protótipo aprovado mostra os cinco
 * nesta ordem.
 */
export const PIN_KIND_ORDER: readonly PinKind[] = ['exclamacao', 'interrogacao', 'viagem', 'alavanca', 'minigame']

/** O que `pinKindChangePatch` grava: o tipo novo e o que ele solta no mesmo passo do desfazer. */
export type PinKindChangePatch = Pick<Pin, 'kind'> & Partial<Pick<Pin, 'destino' | 'presoA' | 'portaLigada' | 'minigame'>>

/**
 * O que muda no pino quando o mestre troca o tipo dele, num passo só do
 * desfazer. Virar viagem solta a porta ligada e o desafio; sair da viagem
 * solta o destino e a ficha (só a passagem anda com o navio). A porta ligada
 * sobrevive entre alavanca e minigame — é a mesma porta, aberta de outro
 * jeito. Entrar no minigame dá o desafio do protótipo; escolher de novo o
 * tipo que o pino já tem não apaga o desafio que o mestre montou.
 */
export function pinKindChangePatch(pin: Pick<Pin, 'kind' | 'minigame'>, kind: PinKind): PinKindChangePatch {
  if (kind === 'viagem') return { kind, portaLigada: undefined, minigame: undefined }
  const minigame = kind !== 'minigame' ? undefined : pin.kind === 'minigame' && pin.minigame !== undefined ? pin.minigame : minigamePadrao()
  const comPorta = kind === 'alavanca' || kind === 'minigame'
  return { kind, destino: null, presoA: undefined, minigame, ...(comPorta ? {} : { portaLigada: undefined }) }
}

/**
 * Cópia nova de `MINIGAME_PADRAO` (a dança, o jogo de quem acaba de virar
 * minigame): o pino não divide objeto com a constante nem com outro pino,
 * então nada que mexa num deles alcança o outro.
 */
export function minigamePadrao(): MinigameDanca {
  return copiarMinigame(MINIGAME_PADRAO)
}

/** Cópia nova do desafio do protótipo de cada jogo. */
export function minigamePadraoDo(jogo: JogoDoMinigame): MinigameDoPino {
  switch (jogo) {
    case 'danca':
      return minigamePadrao()
    case 'pesca':
      return copiarMinigame(MINIGAME_PESCA_PADRAO)
    case 'tiro':
      return copiarMinigame(MINIGAME_TIRO_PADRAO)
  }
}

/**
 * O "Jogo" do painel do mestre: trocar de jogo põe o desafio padrão do outro
 * (nada de um jogo serve no outro: música e nota mínima não existem na pesca,
 * lago e lances não existem na dança). O mesmo jogo devolve o desafio como
 * está — escolher de novo a opção marcada não apaga o que o mestre montou.
 */
export function trocarJogoDoMinigame(minigame: MinigameDoPino, jogo: JogoDoMinigame): MinigameDoPino {
  return minigame.jogo === jogo ? minigame : minigamePadraoDo(jogo)
}

/** Cópia funda do desafio: quem guarda (o convite, o pino novo) não divide objeto com o original. */
export function copiarMinigame(minigame: MinigameDanca): MinigameDanca
export function copiarMinigame(minigame: MinigamePesca): MinigamePesca
export function copiarMinigame(minigame: MinigameTiro): MinigameTiro
export function copiarMinigame(minigame: MinigameDoPino): MinigameDoPino
export function copiarMinigame(minigame: MinigameDoPino): MinigameDoPino {
  switch (minigame.jogo) {
    case 'danca':
      return {
        ...minigame,
        musica: copiarMusica(minigame.musica),
        premio: { ...minigame.premio },
        consequencia: { ...minigame.consequencia },
      }
    case 'pesca':
    case 'tiro':
      return { ...minigame, premio: { ...minigame.premio }, consequencia: { ...minigame.consequencia } }
  }
}

function copiarMusica(musica: MusicaDaDanca): MusicaDaDanca {
  if (musica.tipo === 'demo') return { tipo: 'demo' }
  return {
    ...musica,
    coreografias: {
      diversao: musica.coreografias.diversao.map((nota) => ({ ...nota })),
      expert: musica.coreografias.expert.map((nota) => ({ ...nota })),
    },
  }
}

/**
 * Dois desafios iguais POR VALOR. O painel grava um objeto novo a cada
 * mudança; comparar por referência empilharia no desfazer um passo que não
 * muda nada (gravar o mesmo desafio de novo).
 */
export function sameMinigame(a: MinigameDoPino | undefined, b: MinigameDoPino | undefined): boolean {
  return mesmoDado(a, b)
}

/** Igualdade profunda de dado JSON (objeto, lista, texto, número, booleano). */
function mesmoDado(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => mesmoDado(item, b[i]))
  const chavesA = Object.keys(a).filter((chave) => Reflect.get(a, chave) !== undefined)
  const chavesB = Object.keys(b).filter((chave) => Reflect.get(b, chave) !== undefined)
  return chavesA.length === chavesB.length && chavesA.every((chave) => mesmoDado(Reflect.get(a, chave), Reflect.get(b, chave)))
}

/**
 * O tipo que o atalho `?` dá ao pino selecionado: alterna entre "!" e "?"
 * (achado 11 do passeio de 20/09/2026). O pino de VIAGEM devolve `null` — não
 * muda: ele não é um ponto de interesse, e virá-lo "?" por uma tecla apagaria
 * o destino dele e desligaria o par da outra cena sem a pessoa ver.
 */
export function pinKindAfterShortcut(kind: PinKind): PinKind | null {
  if (kind === 'exclamacao') return 'interrogacao'
  if (kind === 'interrogacao') return 'exclamacao'
  return null
}

/**
 * O tipo desenha o ícone escolhido (`Pin.icon`)? A viagem desenha a passagem,
 * a alavanca a própria alavanca e o minigame o controle (`drawPins.ts`, `PlayerPinCard`,
 * `pinSummary`) — neles a grade "Ícone no mapa" gravaria o campo e abriria um
 * passo no desfazer sem mudar nada na tela, então o painel não a mostra.
 */
export function pinKindShowsIcon(kind: PinKind): boolean {
  return kind === 'exclamacao' || kind === 'interrogacao'
}

/** Guarda de leitura: tipo desconhecido (arquivo editado à mão, versão futura) não entra no desenho. */
export function isPinKind(value: unknown): value is PinKind {
  return typeof value === 'string' && (PIN_KIND_ORDER as readonly string[]).includes(value)
}

/** Nome de cada símbolo na interface do mestre e no leitor de tela. */
export const PIN_ICON_LABELS: Record<PinIcon, string> = {
  bau: 'Baú',
  armadilha: 'Armadilha',
  chave: 'Chave',
  perigo: 'Perigo',
  escada: 'Escada',
  agua: 'Água',
  item: 'Item',
}

/** Ordem em que os símbolos aparecem na grade do painel. */
export const PIN_ICON_ORDER: readonly PinIcon[] = ['bau', 'armadilha', 'chave', 'perigo', 'escada', 'agua', 'item']

/** Guarda de leitura: arquivo de mapa editado à mão ou de versão futura não derruba o desenho. */
export function isPinIcon(value: unknown): value is PinIcon {
  return typeof value === 'string' && (PIN_ICON_ORDER as readonly string[]).includes(value)
}

/**
 * Os modos de passagem do pino de viagem, na ordem do painel do mestre: do
 * mais aberto ao mais fechado, com o passe (livre para uns, pede para os
 * outros) entre "Livre" e "Trancada".
 */
export const PIN_PASSAGE_ORDER: readonly PinPassage[] = ['pede', 'livre', 'passe', 'trancada']

/** Nome de cada modo no painel do mestre. */
export const PIN_PASSAGE_LABELS: Record<PinPassage, string> = {
  pede: 'Pede ao mestre',
  livre: 'Livre',
  passe: 'Com passe',
  trancada: 'Trancada',
}

/** Guarda de leitura: modo desconhecido (arquivo editado à mão, versão futura) não vale. */
export function isPinPassage(value: unknown): value is PinPassage {
  return PIN_PASSAGE_ORDER.some((passage) => passage === value)
}

/**
 * O modo que vale. Ausente é "pede ao mestre": é o que todo pino gravado antes
 * do campo fazia, e um valor desconhecido que escapasse até aqui também cai no
 * modo que pergunta — nunca num que deixa passar sem ninguém ver.
 */
export function passageOf(pin: Pick<Pin, 'passagem'>): PinPassage {
  return isPinPassage(pin.passagem) ? pin.passagem : 'pede'
}

/** "Ler só de perto": menor e maior número de casas que o painel e o disco aceitam. */
export const PIN_LER_DE_PERTO_MIN = 1
export const PIN_LER_DE_PERTO_MAX = 20

/**
 * Guarda de leitura de `Pin.lerDePerto`: só inteiro de casas dentro da faixa.
 * Zero, negativo, fração, texto ou número gigante (arquivo editado à mão) não
 * vale — o chamador trata como ausente, o pino de sempre.
 */
export function isPinReadDistance(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= PIN_LER_DE_PERTO_MIN && value <= PIN_LER_DE_PERTO_MAX
}

/** Os motivos da passagem trancada, na ordem do painel do mestre (depois de "Trancada", que é a ausência). */
export const PIN_BLOCK_REASON_ORDER: readonly PinBlockReason[] = ['desabou', 'alagada', 'em-chamas', 'sem-energia']

/** O nome de cada motivo — o mesmo no painel do mestre e no cartão do jogador. */
export const PIN_BLOCK_REASON_LABELS: Record<PinBlockReason, string> = {
  desabou: 'Desabou',
  alagada: 'Alagada',
  'em-chamas': 'Em chamas',
  'sem-energia': 'Sem energia',
}

/** Como a ausência de motivo se chama no painel: a passagem trancada de sempre. */
export const PIN_BLOCK_REASON_NONE_LABEL = 'Trancada'

/** Guarda de leitura: motivo desconhecido (arquivo editado à mão, host de versão futura) não vale. */
export function isPinBlockReason(value: unknown): value is PinBlockReason {
  return PIN_BLOCK_REASON_ORDER.some((reason) => reason === value)
}

/**
 * O motivo que vale para o jogador: só do pino de viagem TRANCADO, e só um da
 * lista. Motivo guardado num pino reaberto fica com o mestre — é o que ele
 * preparou para depois, não o que a porta é agora.
 */
export function blockReasonOf(pin: Pick<Pin, 'kind' | 'passagem' | 'motivo'>): PinBlockReason | null {
  if (pin.kind !== 'viagem' || passageOf(pin) !== 'trancada') return null
  return isPinBlockReason(pin.motivo) ? pin.motivo : null
}

/** Ponto do desenho do símbolo, no quadrado normalizado -1..1 com a origem no centro da cabeça. */
export interface PinSymbolPoint {
  x: number
  y: number
}

/** Traço do símbolo: polilinha aberta, ou fechada quando o contorno volta ao início. */
export interface PinSymbolStroke {
  points: readonly PinSymbolPoint[]
  closed?: boolean
}

/** Círculo do símbolo, no mesmo quadrado normalizado. */
export interface PinSymbolCircle extends PinSymbolPoint {
  r: number
}

/**
 * Forma vetorial de um símbolo. Coordenadas NORMALIZADAS (-1..1, y para baixo)
 * porque os dois desenhistas têm réguas diferentes: o mapa desenha em px de
 * mundo dentro de uma cabeça de 11 px de raio (`pixi/drawPins.ts`), o painel
 * desenha num `viewBox` de 24 (`components/PinSymbolArt.tsx`). Uma fonte só
 * para as duas telas — o que o mestre escolhe no painel é a mesma forma que
 * ele vê no mapa e que o jogador recebe.
 */
export interface PinSymbolShape {
  strokes: readonly PinSymbolStroke[]
  /** Círculo de contorno (o anel da chave). */
  rings?: readonly PinSymbolCircle[]
  /** Círculo cheio (o ponto do "perigo"). */
  dots?: readonly PinSymbolCircle[]
}

/**
 * Os seis símbolos, em traço e nada mais: é o estilo da casa (minimapa de
 * Resident Evil — linha fina clara, sem hachura, sem ilustração), e é o que
 * continua legível numa cabeça de 22 px de diâmetro e com zoom para fora.
 *
 * Cada um foi desenhado para ser reconhecível pela SILHUETA, não pelo detalhe:
 * duas mandíbulas com dentes não se confundem com uma caixa de tampa reta nem
 * com três ondas, mesmo quando a cabeça do pino tem poucos pixels na tela.
 */
export const PIN_SYMBOLS: Record<PinIcon, PinSymbolShape> = {
  // Caixa de tampa reta com a correia do fecho cruzando a emenda.
  bau: {
    strokes: [
      {
        points: [
          { x: -0.85, y: -0.16 },
          { x: 0.85, y: -0.16 },
          { x: 0.85, y: 0.62 },
          { x: -0.85, y: 0.62 },
        ],
        closed: true,
      },
      {
        points: [
          { x: -0.85, y: -0.16 },
          { x: -0.7, y: -0.62 },
          { x: 0.7, y: -0.62 },
          { x: 0.85, y: -0.16 },
        ],
      },
      {
        points: [
          { x: 0, y: -0.36 },
          { x: 0, y: 0.22 },
        ],
      },
    ],
  },
  // Duas mandíbulas de dentes apontando uma para a outra.
  armadilha: {
    strokes: [
      {
        points: [
          { x: -0.85, y: -0.64 },
          { x: -0.42, y: -0.14 },
          { x: 0, y: -0.64 },
          { x: 0.42, y: -0.14 },
          { x: 0.85, y: -0.64 },
        ],
      },
      {
        points: [
          { x: -0.85, y: 0.64 },
          { x: -0.42, y: 0.14 },
          { x: 0, y: 0.64 },
          { x: 0.42, y: 0.14 },
          { x: 0.85, y: 0.64 },
        ],
      },
    ],
  },
  // Anel, haste e dois dentes na ponta.
  chave: {
    strokes: [
      {
        points: [
          { x: -0.04, y: 0 },
          { x: 0.88, y: 0 },
        ],
      },
      {
        points: [
          { x: 0.46, y: 0 },
          { x: 0.46, y: 0.44 },
        ],
      },
      {
        points: [
          { x: 0.78, y: 0 },
          { x: 0.78, y: 0.44 },
        ],
      },
    ],
    rings: [{ x: -0.44, y: 0, r: 0.4 }],
  },
  // Triângulo com barra e ponto — o aviso universal, e não mais um "!" solto.
  perigo: {
    strokes: [
      {
        points: [
          { x: 0, y: -0.74 },
          { x: 0.82, y: 0.64 },
          { x: -0.82, y: 0.64 },
        ],
        closed: true,
      },
      {
        points: [
          { x: 0, y: -0.22 },
          { x: 0, y: 0.16 },
        ],
      },
    ],
    // Ponto cheio, não anel: abaixo de r≈0.2 um círculo de contorno fecha o
    // miolo e vira borrão (o aviso de `components/icons.tsx`).
    dots: [{ x: 0, y: 0.44, r: 0.18 }],
  },
  // Degraus subindo para a direita — a mesma leitura da ferramenta Escada.
  escada: {
    strokes: [
      {
        points: [
          { x: -0.86, y: 0.7 },
          { x: -0.86, y: 0.24 },
          { x: -0.29, y: 0.24 },
          { x: -0.29, y: -0.22 },
          { x: 0.29, y: -0.22 },
          { x: 0.29, y: -0.68 },
          { x: 0.86, y: -0.68 },
        ],
      },
    ],
  },
  // Três ondas paralelas, amplitude curta: não se confunde com o zigue-zague da armadilha.
  agua: {
    strokes: [
      {
        points: [
          { x: -0.85, y: -0.3 },
          { x: -0.42, y: -0.6 },
          { x: 0, y: -0.3 },
          { x: 0.42, y: -0.6 },
          { x: 0.85, y: -0.3 },
        ],
      },
      {
        points: [
          { x: -0.85, y: 0.15 },
          { x: -0.42, y: -0.15 },
          { x: 0, y: 0.15 },
          { x: 0.42, y: -0.15 },
          { x: 0.85, y: 0.15 },
        ],
      },
      {
        points: [
          { x: -0.85, y: 0.6 },
          { x: -0.42, y: 0.3 },
          { x: 0, y: 0.6 },
          { x: 0.42, y: 0.3 },
          { x: 0.85, y: 0.6 },
        ],
      },
    ],
  },
  // ITEM NO MAPA (entrega 5): o saco amarrado — o pino de item que o mestre
  // solta do acervo. Bojo largo embaixo, gargalo estreito e as duas pontas do
  // pano acima do nó: não se confunde com a caixa reta do baú.
  item: {
    strokes: [
      {
        points: [
          { x: -0.3, y: -0.34 },
          { x: -0.74, y: 0.12 },
          { x: -0.74, y: 0.5 },
          { x: -0.5, y: 0.74 },
          { x: 0.5, y: 0.74 },
          { x: 0.74, y: 0.5 },
          { x: 0.74, y: 0.12 },
          { x: 0.3, y: -0.34 },
        ],
        closed: true,
      },
      {
        points: [
          { x: -0.3, y: -0.34 },
          { x: -0.46, y: -0.74 },
          { x: 0, y: -0.52 },
          { x: 0.46, y: -0.74 },
          { x: 0.3, y: -0.34 },
        ],
      },
    ],
  },
}

/**
 * Símbolo do pino de VIAGEM: a seta entrando num vão de porta — "passe por
 * aqui". Mesma régua normalizada e mesmo traço fino dos seis símbolos acima;
 * o que separa o pino de viagem dos outros no mapa é a cabeça ESCURA com a
 * linha clara (`pixi/drawPins.ts`), não um traço mais grosso.
 */
export const PIN_TRAVEL_SYMBOL: PinSymbolShape = {
  strokes: [
    // O vão: batente de cima, lateral e batente de baixo, aberto para a seta.
    {
      points: [
        { x: 0.02, y: -0.74 },
        { x: 0.8, y: -0.74 },
        { x: 0.8, y: 0.74 },
        { x: 0.02, y: 0.74 },
      ],
    },
    // A haste da seta, vinda de fora.
    {
      points: [
        { x: -0.86, y: 0 },
        { x: 0.44, y: 0 },
      ],
    },
    // A ponta.
    {
      points: [
        { x: 0.08, y: -0.36 },
        { x: 0.44, y: 0 },
        { x: 0.08, y: 0.36 },
      ],
    },
  ],
}

/**
 * Símbolo da ALAVANCA: a base chapada, a haste inclinada e o punho cheio na
 * ponta. Mesmo traço fino dos outros; a cabeça é a de latão dos marcadores
 * (`pixi/drawPins.ts`), porque a alavanca é coisa da sala, não passagem.
 */
export const PIN_LEVER_SYMBOL: PinSymbolShape = {
  strokes: [
    // A base onde a haste gira.
    {
      points: [
        { x: -0.72, y: 0.62 },
        { x: 0.72, y: 0.62 },
      ],
    },
    // A haste, do pivô ao punho.
    {
      points: [
        { x: -0.1, y: 0.62 },
        { x: 0.4, y: -0.36 },
      ],
    },
  ],
  dots: [{ x: 0.48, y: -0.52, r: 0.22 }],
}

/**
 * Símbolo do MINIGAME: o controle de videogame, com a cruz à esquerda e os
 * dois botões à direita. Coordenadas do `<symbol id="pinoControle">` do
 * protótipo aprovado (`docs/design/minigame-danca/prototipo/index.html`),
 * divididas pelo meio-lado do símbolo (`0.64` do raio da cabeça, como em
 * `pixi/drawPins.ts`): o pino do app é, ponto por ponto, o do protótipo.
 * A cabeça é a de latão, como a da alavanca: o desafio é coisa da sala.
 */
export const PIN_CONTROLE_SYMBOL: PinSymbolShape = {
  strokes: [
    // O corpo do controle, com as duas alças descendo.
    {
      points: [
        { x: -0.6, y: -0.42 },
        { x: 0.6, y: -0.42 },
        { x: 0.84, y: -0.22 },
        { x: 0.98, y: 0.4 },
        { x: 0.8, y: 0.62 },
        { x: 0.5, y: 0.46 },
        { x: -0.5, y: 0.46 },
        { x: -0.8, y: 0.62 },
        { x: -0.98, y: 0.4 },
        { x: -0.84, y: -0.22 },
      ],
      closed: true,
    },
    // A cruz: o braço deitado e o de pé.
    {
      points: [
        { x: -0.6, y: 0.02 },
        { x: -0.22, y: 0.02 },
      ],
    },
    {
      points: [
        { x: -0.41, y: -0.17 },
        { x: -0.41, y: 0.21 },
      ],
    },
  ],
  // Os dois botões, em diagonal.
  dots: [
    { x: 0.3, y: 0.1, r: 0.13 },
    { x: 0.56, y: -0.1, r: 0.13 },
  ],
}

/**
 * Só data URL de imagem viaja para o jogador. Caminho de disco do mestre
 * (`C:\...`, `/home/...`, `file://...`) NUNCA sai: quem recorta o mapa
 * (`lib/fogFilter.ts`) apaga o campo quando esta função devolve `false`.
 */
export function isPlayerSafePinImage(image: string | null): image is string {
  return typeof image === 'string' && image.startsWith('data:image/')
}

/**
 * Pino sob o ponto do mundo, do desenhado por último para o primeiro (o de
 * cima ganha). A área de toque é a cabeça mais a haste: um retângulo alto e
 * estreito com a bola em cima (no pino `semHaste`, só a bola), engordado por
 * `tolerance` para o dedo — no celular o alvo real é o dedo, não o desenho.
 * `sizeScale` é o mesmo fator do desenho (`pinSizeScale`): o alvo é o pino
 * como ele APARECE, crescido no zoom afastado, e não o de tamanho de mundo.
 * `sizeFloor` é o piso do pino reduzido (`pinSizeFloor`), o mesmo do desenho.
 */
export function findPinAt(pins: readonly Pin[], point: RegionPoint, tolerance = 0, sizeScale = 1, sizeFloor = 0): Pin | null {
  for (let i = pins.length - 1; i >= 0; i--) {
    if (pinHit(pins[i], point, tolerance, sizeScale, sizeFloor)) return pins[i]
  }
  return null
}

/**
 * O ponto cai na cabeça ou na haste do pino (só na cabeça, sem haste), com a
 * folga `tolerance`. `sizeScale` e `sizeFloor` são os do desenho
 * (`fatorDoPino`): o pino como ele APARECE.
 */
function pinHit(pin: Pin, point: RegionPoint, rawTolerance: number, rawSizeScale: number, sizeFloor: number): boolean {
  // Tamanho do pino (fatia 14): o alvo cresce e encolhe com o desenho. No pino
  // menor que o de sempre a folga encolhe junto, senão ela passaria do teto de
  // `PIN_TAP_MAX_HEAD_RADII` cabeças e abriria o pino tocando o chão ao lado.
  const sizeScale = fatorDoPino(pin, rawSizeScale, sizeFloor)
  const relativo = rawSizeScale > 0 ? sizeScale / rawSizeScale : escalaDoPino(pin)
  const tolerance = rawTolerance * Math.min(1, relativo)
  const headRadius = PIN_HEAD_RADIUS * sizeScale
  const headOffset = PIN_HEAD_OFFSET * sizeScale
  const height = PIN_HEIGHT * sizeScale
  const dx = point.x - pin.x
  const dy = point.y - pin.y
  // Cabeça: círculo em torno do centro dela.
  if (Math.hypot(dx, dy + headOffset) <= headRadius + tolerance) return true
  // Sem haste, o vão até a ponta é chão: tocar ali não abre o pino (nem
  // esconde o pino de baixo), senão o alvo seria um retângulo que ninguém vê.
  if (pin.semHaste === true) return false
  // Haste: faixa vertical entre a ponta e a base da cabeça.
  return Math.abs(dx) <= headRadius / 2 + tolerance && dy <= tolerance && dy >= -height - tolerance
}

/**
 * TODOS os pinos sob o ponto, do mais perto ao mais longe (distância até o
 * centro da cabeça); no empate — dois pinos cravados no mesmo ponto — o de
 * cima primeiro, como em `findPinAt`. É o que deixa o toque do jogador
 * alcançar o pino de baixo: com um só, `findPinAt` escondia o outro para sempre.
 * `sizeScale` e `sizeFloor` como em `findPinAt`.
 */
export function findPinsAt(pins: readonly Pin[], point: RegionPoint, tolerance = 0, sizeScale = 1, sizeFloor = 0): Pin[] {
  const hits: { pin: Pin; distance: number }[] = []
  for (let i = pins.length - 1; i >= 0; i--) {
    const pin = pins[i]
    // A distância mede até o centro da cabeça DESTE pino, já no tamanho dele.
    const headOffset = PIN_HEAD_OFFSET * fatorDoPino(pin, sizeScale, sizeFloor)
    if (pinHit(pin, point, tolerance, sizeScale, sizeFloor)) hits.push({ pin, distance: Math.hypot(point.x - pin.x, point.y - pin.y + headOffset) })
  }
  // `sort` é estável: no empate fica a ordem de cima para baixo montada acima.
  return hits.sort((a, b) => a.distance - b.distance).map((hit) => hit.pin)
}

/** Teto do nome só do mestre: é um rótulo ao lado do pino, não um texto. */
export const PIN_NOME_MAX_LENGTH = 40

/**
 * O nome só do mestre como ele é gravado: aparado e cortado no teto. Texto em
 * branco e o que não é texto (arquivo editado à mão) viram `''` = sem nome.
 */
export function cleanPinName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, PIN_NOME_MAX_LENGTH) : ''
}

/** Como o MESTRE chama o pino na lista e ao lado dele: o nome, ou o resumo de sempre. */
export function pinMasterLabel(pin: Pin): string {
  const nome = cleanPinName(pin.nome)
  return nome === '' ? pinSummary(pin) : nome
}

/**
 * Texto curto do pino para o mestre (lista, título de painel e leitor de tela).
 * Sem descrição, quem nomeia o pino é o símbolo escolhido — e só na falta dele
 * o glifo, que é o que o pino de hoje tem.
 */
export function pinSummary(pin: Pin): string {
  const description = pin.description.trim()
  if (description !== '') return description
  // O pino de viagem desenha a passagem, nunca o símbolo escolhido: nomeá-lo
  // pelo símbolo diria "Baú" de um pino que no mapa é uma porta.
  // O de uma escada nem se desenha: no pedido que chega ao mestre, ele é a escada.
  if (pin.kind === 'viagem') return typeof pin.escadaId === 'string' && pin.escadaId !== '' ? 'Escada' : 'Pino de viagem'
  // A alavanca também desenha o próprio símbolo, nunca o escolhido.
  if (pin.kind === 'alavanca') return 'Alavanca'
  // O minigame também: o controle no mapa, e o nome do jogo quando há um.
  if (pin.kind === 'minigame') {
    const jogo = pin.minigame?.jogo
    return jogo === 'danca' ? 'Dança' : jogo === 'pesca' ? 'Pesca' : jogo === 'tiro' ? 'Tiro' : 'Minigame'
  }
  if (isPinIcon(pin.icon)) return `Ponto de interesse — ${PIN_ICON_LABELS[pin.icon]}`
  return `Ponto de interesse ${PIN_GLYPH[pin.kind]}`
}
