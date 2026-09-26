import type { Pin, PinBlockReason, PinIcon, PinKind, PinPassage, RegionPoint } from '../types/map'

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
}

/** Nome de cada tipo na interface do mestre. */
export const PIN_KIND_LABELS: Record<PinKind, string> = {
  exclamacao: 'Exclamação (!)',
  interrogacao: 'Interrogação (?)',
  viagem: 'Viagem',
  alavanca: 'Alavanca',
}

/** Ordem em que os tipos aparecem no painel: os dois de sempre, a viagem e a alavanca por último. */
export const PIN_KIND_ORDER: readonly PinKind[] = ['exclamacao', 'interrogacao', 'viagem', 'alavanca']

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
 * O tipo desenha o ícone escolhido (`Pin.icon`)? A viagem desenha a passagem
 * e a alavanca desenha a própria alavanca (`drawPins.ts`, `PlayerPinCard`,
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
}

/** Ordem em que os símbolos aparecem na grade do painel. */
export const PIN_ICON_ORDER: readonly PinIcon[] = ['bau', 'armadilha', 'chave', 'perigo', 'escada', 'agua']

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

/**
 * Pino trancado que aceita "Pedir ao mestre": trancado e sem a marca `mudo`.
 * Qualquer outro modo responde `false` — livre e pede não são "tentativas".
 */
export function acceptsLockedRequest(pin: Pin): boolean {
  return passageOf(pin) === 'trancada' && pin.mudo !== true
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
 * estreito com a bola em cima, engordado por `tolerance` para o dedo — no
 * celular o alvo real é o dedo, não o desenho. `sizeScale` é o mesmo fator do
 * desenho (`pinSizeScale`): o alvo é o pino como ele APARECE, crescido no zoom
 * afastado, e não o de tamanho de mundo.
 */
export function findPinAt(pins: readonly Pin[], point: RegionPoint, tolerance = 0, sizeScale = 1): Pin | null {
  for (let i = pins.length - 1; i >= 0; i--) {
    if (pinHit(pins[i], point, tolerance, sizeScale)) return pins[i]
  }
  return null
}

/**
 * O ponto cai na cabeça ou na haste do pino, com a folga `tolerance`.
 * `sizeScale` é o fator do desenho (`pinSizeScale`): o pino como ele APARECE.
 */
function pinHit(pin: Pin, point: RegionPoint, tolerance: number, sizeScale: number): boolean {
  const headRadius = PIN_HEAD_RADIUS * sizeScale
  const headOffset = PIN_HEAD_OFFSET * sizeScale
  const height = PIN_HEIGHT * sizeScale
  const dx = point.x - pin.x
  const dy = point.y - pin.y
  // Cabeça: círculo em torno do centro dela.
  if (Math.hypot(dx, dy + headOffset) <= headRadius + tolerance) return true
  // Haste: faixa vertical entre a ponta e a base da cabeça.
  return Math.abs(dx) <= headRadius / 2 + tolerance && dy <= tolerance && dy >= -height - tolerance
}

/**
 * TODOS os pinos sob o ponto, do mais perto ao mais longe (distância até o
 * centro da cabeça); no empate — dois pinos cravados no mesmo ponto — o de
 * cima primeiro, como em `findPinAt`. É o que deixa o toque do jogador
 * alcançar o pino de baixo: com um só, `findPinAt` escondia o outro para sempre.
 * `sizeScale` como em `findPinAt`.
 */
export function findPinsAt(pins: readonly Pin[], point: RegionPoint, tolerance = 0, sizeScale = 1): Pin[] {
  const headOffset = PIN_HEAD_OFFSET * sizeScale
  const hits: { pin: Pin; distance: number }[] = []
  for (let i = pins.length - 1; i >= 0; i--) {
    const pin = pins[i]
    if (pinHit(pin, point, tolerance, sizeScale)) hits.push({ pin, distance: Math.hypot(point.x - pin.x, point.y - pin.y + headOffset) })
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
  if (isPinIcon(pin.icon)) return `Ponto de interesse — ${PIN_ICON_LABELS[pin.icon]}`
  return `Ponto de interesse ${PIN_GLYPH[pin.kind]}`
}
