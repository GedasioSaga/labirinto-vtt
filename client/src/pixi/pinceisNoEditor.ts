import { Matrix, type Graphics, type Texture } from 'pixi.js'
import type { AlturaDoPenhasco, MapData, ModoDoPenhasco } from '../types/map'
import type { Point } from './world'
import { revealBrushRadius, type RevealBrushMode } from '../lib/concealBrush'
import { passoDoRisco, raioDoPincelDePenhasco, type ResultadoDoRisco } from '../lib/penhasco'
import { passoDaPincelada, raioDoPincelDeTextura, type ResultadoDaTextura } from '../lib/texturas'
import { relevoLigado, unidadeDoRelevo } from '../lib/relevo'
import { isContinente } from '../lib/marcadorDeContinente'
import { escalaDaTextura, ladoDoLadrilhoNoMundo, type TexturasRenderer } from './drawTexturas'
import { useMapStore } from '../stores/mapStore'
import {
  AVISO_PENHASCO_BEIRA_ESCONDIDA,
  AVISO_PENHASCO_COSTA_ESCONDIDA,
  AVISO_PENHASCO_LONGE_DA_BEIRA,
  AVISO_PENHASCO_LONGE_DA_COSTA,
  AVISO_PENHASCO_NADA_A_APAGAR,
  AVISO_PENHASCO_SEM_RELEVO,
  AVISO_PINCEL_SEM_ZONA,
  AVISO_TEXTURA_AREA_GRANDE,
  AVISO_TEXTURA_BALDE_FORA,
  AVISO_TEXTURA_BALDE_IGUAL,
  AVISO_TEXTURA_AUSENTE,
  AVISO_TEXTURA_NADA_A_APAGAR,
} from '../components/labels'

/**
 * Os PINCÉIS DE ARRASTO do editor que só viram mapa ao soltar: o Pincel de
 * revelar (zona oculta), o Penhasco e as Texturas. Saíram do `PixiCanvas.tsx`
 * (máquina de gestos) no molde de `neblinaNoEditor.ts`: o canvas escolhe o
 * modo no `pointerdown` e chama `comecar`, `mover` no `pointermove`, `soltar`
 * no `pointerup` (com `null` quando o botão sobe fora do canvas: vale o que já
 * foi pintado) e `descartar` no Esc ou na troca de ferramenta.
 *
 * O traço em curso fica aqui, fora da store: gravar a cada `pointermove`
 * empilharia um Ctrl+Z por pixel. O traço inteiro vira UMA mudança no mapa.
 * `descartar` só larga os pontos: o rascunho (`draftGraphics`) e o modo do
 * gesto são de quem chama, como eram no canvas.
 */

export interface GestoDePincel {
  /** Começa o traço no ponto (px de mundo). `map` é o do `pointerdown`. Alt inverte o modo do painel só neste traço. */
  comecar: (p: Point, altKey: boolean, map: MapData) => void
  mover: (p: Point) => void
  /** Solta. `null` = soltou fora do canvas (o ponto de fora não entra no traço). */
  soltar: (p: Point | null) => void
  /** Larga o traço sem gravar. */
  descartar: () => void
}

interface DependenciasDoPincel {
  rascunho: Graphics
  /** Mostra o aviso, se ele já não estiver na tela. */
  avisar: (texto: string) => void
}

// Pincel de revelar — rascunho do traço em curso. Claro = o jogador vai ver;
// escuro = volta a ficar escondido (o mesmo preto translúcido da zona no editor).
const REVEAL_STROKE_COLOR = 0xffffff
const REVEAL_STROKE_ALPHA = 0.3
const HIDE_STROKE_COLOR = 0x000000
const HIDE_STROKE_ALPHA = 0.55
/** Passo mínimo entre pontos do traço, em px de mundo: menor que meia célula do pincel. */
const REVEAL_STROKE_MIN_STEP = 3
// Penhasco — rascunho do risco em curso, na "terra clara" das faixas da parede
// (`AJUSTE_DO_PENHASCO`); a borracha usa o mesmo escuro do esconder.
const PENHASCO_STROKE_COLOR = 0xc69a66
const PENHASCO_STROKE_ALPHA = 0.45
// Texturas — prévia do traço enquanto o ladrilho da textura ainda não saiu
// (a primeira pincelada de uma textura): um tom neutro de terra, translúcido.
const TEXTURA_PREVIA_COR = 0xb9a27a
const TEXTURA_PREVIA_ALPHA = 0.4

type EstiloDoRascunho = { color: number; alpha: number } | { texture: Texture; matrix: Matrix; textureSpace: 'global'; alpha: number }

/** O rascunho de um traço de pincel na largura real: um ponto vira disco; dois ou mais, a linha de pontas redondas. */
function desenharTraco(g: Graphics, pontos: readonly Point[], raio: number, estilo: EstiloDoRascunho): void {
  g.clear()
  const [first, ...rest] = pontos
  if (first === undefined) return
  if (rest.length === 0) {
    g.circle(first.x, first.y, raio).fill(estilo)
    return
  }
  g.moveTo(first.x, first.y)
  for (const p of rest) g.lineTo(p.x, p.y)
  g.stroke({ ...estilo, width: raio * 2, cap: 'round', join: 'round' })
}

/**
 * Pincel de revelar: o traço na largura real, claro para revelar e escuro para
 * esconder — o mesmo par de cores do que a zona vira no editor
 * (`drawConcealZones.ts`: escuro = o jogador não vê). Sem snap: o pincel segue
 * a mão. Revelar fora de qualquer zona ativa não faz nada, e a tela diz por quê.
 */
export function criarGestoDoPincelDeRevelar(dep: DependenciasDoPincel): GestoDePincel {
  let pontos: Point[] = []
  let modo: RevealBrushMode = 'revelar'
  let raio = 0

  const desenhar = (): void =>
    desenharTraco(dep.rascunho, pontos, raio, modo === 'revelar' ? { color: REVEAL_STROKE_COLOR, alpha: REVEAL_STROKE_ALPHA } : { color: HIDE_STROKE_COLOR, alpha: HIDE_STROKE_ALPHA })

  /** Mais um ponto no traço, só quando andou o bastante: arrasto parado não enche a lista. */
  const estender = (p: Point): void => {
    const last = pontos[pontos.length - 1]
    if (last !== undefined && Math.hypot(p.x - last.x, p.y - last.y) < REVEAL_STROKE_MIN_STEP) return
    pontos.push(p)
    desenhar()
  }

  return {
    comecar(p, altKey, map) {
      // Alt INVERTE o modo do painel só neste traço (revelar ⇄ esconder) e é
      // lido aqui, no começo: soltar o Alt no meio não troca o traço.
      const { revealBrushMode, revealBrushWidth } = useMapStore.getState()
      modo = altKey ? (revealBrushMode === 'revelar' ? 'esconder' : 'revelar') : revealBrushMode
      raio = revealBrushRadius(map.grid, revealBrushWidth)
      pontos = [p]
      desenhar()
    },
    mover: estender,
    soltar(last) {
      if (last !== null && pontos.length > 0) estender(last)
      const stroke = pontos
      pontos = []
      dep.rascunho.clear()
      if (stroke.length === 0) return
      const hitZone = useMapStore.getState().paintRevealBrush(stroke, raio, modo)
      if (hitZone || modo !== 'revelar') return
      dep.avisar(AVISO_PINCEL_SEM_ZONA)
    },
    descartar() {
      pontos = []
    },
  }
}

/**
 * O que a tela diz depois de soltar o pincel de penhasco, ou `null` quando o
 * risco fez o que prometia e já aparece. Fora do continente não há costa nem
 * mar: os avisos falam da beira da região.
 */
function avisoDoPenhasco(resultado: ResultadoDoRisco, comRelevo: boolean, continente: boolean): string | null {
  switch (resultado) {
    case 'longe-da-costa':
      return continente ? AVISO_PENHASCO_LONGE_DA_COSTA : AVISO_PENHASCO_LONGE_DA_BEIRA
    case 'costa-escondida':
      return continente ? AVISO_PENHASCO_COSTA_ESCONDIDA : AVISO_PENHASCO_BEIRA_ESCONDIDA
    case 'nada-a-apagar':
      return AVISO_PENHASCO_NADA_A_APAGAR
    case 'riscou':
      return comRelevo ? null : AVISO_PENHASCO_SEM_RELEVO
    case 'apagou':
    // O aviso da camada travada já saiu (com "Destravar"); outro por cima seria repetido.
    case 'camada-travada':
      return null
  }
}

/**
 * Penhasco: o risco na largura real do pincel, na cor da pedra do penhasco para
 * riscar e escuro para apagar. Sem snap; Alt INVERTE o modo do painel só neste
 * risco. O raio segue o tamanho do mapa, como a própria parede
 * (`raioDoPincelDePenhasco`), e a altura é a do começo: o risco inteiro desce a
 * mesma parede. Risco que não mudou nada diz por quê, em vez de sumir calado; o
 * que entrou com o relevo desligado também avisa, porque ainda não aparece.
 */
export function criarGestoDoPenhasco(dep: DependenciasDoPincel): GestoDePincel {
  let pontos: Point[] = []
  let modo: ModoDoPenhasco = 'riscar'
  let raio = 0
  let altura: AlturaDoPenhasco = 'medio'

  const desenhar = (): void =>
    desenharTraco(dep.rascunho, pontos, raio, modo === 'riscar' ? { color: PENHASCO_STROKE_COLOR, alpha: PENHASCO_STROKE_ALPHA } : { color: HIDE_STROKE_COLOR, alpha: HIDE_STROKE_ALPHA })

  /** Mais um ponto no risco, só quando andou um quarto do raio: o arquivo não guarda cada passo do mouse. */
  const estender = (p: Point): void => {
    const last = pontos[pontos.length - 1]
    if (last !== undefined && Math.hypot(p.x - last.x, p.y - last.y) < passoDoRisco(raio)) return
    pontos.push(p)
    desenhar()
  }

  return {
    comecar(p, altKey, map) {
      const { penhascoModo, penhascoLargura, penhascoAltura } = useMapStore.getState()
      modo = altKey ? (penhascoModo === 'riscar' ? 'apagar' : 'riscar') : penhascoModo
      raio = raioDoPincelDePenhasco(unidadeDoRelevo(map), penhascoLargura)
      altura = penhascoAltura
      pontos = [p]
      desenhar()
    },
    mover: estender,
    soltar(last) {
      if (last !== null && pontos.length > 0) estender(last)
      const risco = pontos
      pontos = []
      dep.rascunho.clear()
      if (risco.length === 0) return
      const store = useMapStore.getState()
      const resultado = store.riscarPenhasco({ modo, raio, pontos: risco, altura })
      const depois = useMapStore.getState().map
      const aviso = avisoDoPenhasco(resultado, relevoLigado(depois), isContinente(depois))
      if (aviso === null) return
      dep.avisar(aviso)
    },
    descartar() {
      pontos = []
    },
  }
}

/** O que a tela diz depois de soltar o gesto da ferramenta Texturas, ou `null` quando pintou. */
function avisoDaTextura(resultado: ResultadoDaTextura): string | null {
  switch (resultado) {
    case 'nada-a-apagar':
      return AVISO_TEXTURA_NADA_A_APAGAR
    case 'fora-de-forma':
      return AVISO_TEXTURA_BALDE_FORA
    case 'area-grande':
      return AVISO_TEXTURA_AREA_GRANDE
    case 'igual':
      return AVISO_TEXTURA_BALDE_IGUAL
    case 'textura-ausente':
      return AVISO_TEXTURA_AUSENTE
    // A store já avisou qual camada segurou, com "Destravar".
    case 'camada-travada':
    case 'pintou':
      return null
  }
}

export interface GestoDaTextura extends GestoDePincel {
  /** Balde: um clique enche a área fechada debaixo dele; Alt tira a textura dela. Não há arrasto. */
  encher: (p: Point, altKey: boolean) => void
}

/**
 * Texturas: a pincelada mostra a própria textura repetida, na força escolhida,
 * enquanto o ladrilho já existe; antes disso, um tom neutro. A borracha usa o
 * escuro do esconder. A borda macia vem ao soltar. Sem snap; Alt troca pincel
 * e borracha só nesta pincelada. O anel do pincel segue o ponteiro.
 */
export function criarGestoDaTextura(
  dep: DependenciasDoPincel & { ladrilhoParaPrevia: TexturasRenderer['ladrilhoParaPrevia']; anel: (p: Point) => void },
): GestoDaTextura {
  let pontos: Point[] = []
  let tipo: 'pincel' | 'borracha' = 'pincel'
  let raio = 0
  let textura = ''
  let forca = 1

  const avisar = (resultado: ResultadoDaTextura): void => {
    const aviso = avisoDaTextura(resultado)
    if (aviso === null) return
    dep.avisar(aviso)
  }

  const desenhar = (): void => {
    const { map } = useMapStore.getState()
    const tile = tipo === 'pincel' ? dep.ladrilhoParaPrevia(textura, map.texturasImportadas) : null
    let estilo: EstiloDoRascunho
    if (tipo === 'borracha') estilo = { color: HIDE_STROKE_COLOR, alpha: HIDE_STROKE_ALPHA }
    else if (tile === null) estilo = { color: TEXTURA_PREVIA_COR, alpha: TEXTURA_PREVIA_ALPHA }
    else {
      const lado = ladoDoLadrilhoNoMundo(map, escalaDaTextura(textura))
      estilo = { texture: tile, matrix: new Matrix().scale(lado / tile.width, lado / tile.height), textureSpace: 'global', alpha: forca }
    }
    desenharTraco(dep.rascunho, pontos, raio, estilo)
  }

  /** Mais um ponto na pincelada, só quando andou um quarto do raio (o arquivo não guarda cada passo do mouse). */
  const estender = (p: Point): void => {
    dep.anel(p)
    const last = pontos[pontos.length - 1]
    if (last !== undefined && Math.hypot(p.x - last.x, p.y - last.y) < passoDaPincelada(raio)) return
    pontos.push(p)
    desenhar()
  }

  return {
    encher(p, altKey) {
      avisar(useMapStore.getState().encherComTextura(p, altKey))
    },
    comecar(p, altKey, map) {
      const { texturaModo, texturaTamanho, texturaForca, texturaEscolhida } = useMapStore.getState()
      const borracha = texturaModo === 'borracha'
      tipo = borracha !== altKey ? 'borracha' : 'pincel'
      raio = raioDoPincelDeTextura(unidadeDoRelevo(map), texturaTamanho)
      textura = texturaEscolhida
      forca = texturaForca
      pontos = [p]
      desenhar()
    },
    mover: estender,
    soltar(last) {
      if (last !== null && pontos.length > 0) estender(last)
      const pincelada = pontos
      pontos = []
      dep.rascunho.clear()
      if (pincelada.length === 0) return
      const store = useMapStore.getState()
      avisar(
        tipo === 'pincel'
          ? store.pintarTextura({ tipo: 'pincel', textura, forca, raio, pontos: pincelada })
          : store.pintarTextura({ tipo: 'borracha', forca, raio, pontos: pincelada }),
      )
    },
    descartar() {
      pontos = []
    },
  }
}
