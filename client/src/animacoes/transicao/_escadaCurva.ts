import type * as Three from 'three'
import { clamp01, easeInOutSine, span } from '../../transicoes/curvas'
import { descartarCena, semente } from '../../transicoes/texturas'
import type { CenaTransicao, CriarCena, KitDeSom, ThreeModule } from '../../transicoes/tipos'

/**
 * ESCADA CURVA (pedido de 09/10/2026, imagem 42): escadaria de pedra branca
 * que sobe em arco junto a uma parede de pedra clara, com guarda-corpo azul do
 * lado de fora da curva, arandelas de luz quente na parede e uma porta azul em
 * arco embaixo. Clima de Resident Evil clássico: primeira pessoa, o que não é
 * escada some no preto.
 *
 * O que faz a CURVA se ler: a parede é o lado de dentro (convexa, de frente
 * para quem anda) e o olhar vai para dentro da curva. Assim a parede ocupa o
 * lado de dentro do quadro e esconde o resto do lance atrás dela; o corrimão
 * azul atravessa o quadro em arco e some na mesma dobra; os degraus abrem em
 * leque (estreitos junto à parede, largos junto ao guarda-corpo).
 *
 * Duas transições do pacote usam este arquivo: `escada-curva` (subindo) e
 * `escada-curva-descendo`. O `_` no nome diz ao script do pacote que isto é
 * código dividido, embutido em cada uma pelo import — não uma animação.
 *
 * Ritmo, duração e fades no molde da "Escadaria" embutida
 * (`transicoes/cenas/escadaPedra.ts`), que o usuário já aprovou: passos de
 * 1,05 s, dois no patamar e oito na escada, 11,7 s ao todo.
 */

/** 1 = subindo (a escada vira para a esquerda, como na foto); -1 = descendo a mesma escada. */
export type Sentido = 1 | -1

// ---------------------------------------------------------------------------
// Geometria, em metros e radianos. O centro da curva fica na origem e o
// primeiro espelho, no ângulo 0; o ângulo cresce no sentido em que se anda.
// Descendo, o grupo inteiro é espelhado: a mesma escada, percorrida de cima,
// vira para a direita (a parede passa para a direita e o guarda-corpo para a
// esquerda, como numa escada de verdade).

/** Face da parede de pedra: o lado de dentro da curva. */
const RAIO_PAREDE = 2.6
/** Os degraus entram 5 cm na parede: nenhuma fresta na junta. */
const RAIO_DENTRO = RAIO_PAREDE - 0.05
/** Borda de fora dos degraus (1,6 m de largura). */
const RAIO_FORA = 4.15
/**
 * Linha por onde o corpo anda, um pouco puxada para dentro. Daqui, a linha de
 * visada que tangencia a parede fica a ~36° da direção do passo: é ali que o
 * lance some atrás da curva.
 */
const RAIO_ANDAR = 3.2
/** Onde ficam os balaústres, sobre a borda de fora do degrau. */
const RAIO_GUARDA = 4.0
const ESPELHO = 0.2
/** Profundidade do degrau na linha do andar. */
const PISO = 0.34
/** Ângulo de um degrau: o arco de PISO na linha do andar (~6,1°). */
const ANG_DEGRAU = PISO / RAIO_ANDAR
/** Patamar antes do primeiro degrau, em radianos. */
const ANG_PATAMAR = 1.5
/** Descendo, o corpo de cada degrau desce até aqui abaixo do piso (o costado some no escuro). */
const COSTADO_DESCENDO = 2.4
const ALTURA_CORRIMAO = 0.92
const ALTURA_TRAVESSA = 0.16
/** Uma pedra da parede (textura de 2 x 4 blocos) cobre 1,2 m. */
const LADO_DA_CANTARIA = 1.2

/**
 * O que muda entre subir e descer. Subindo, o lance continua para cima, além
 * da curva (26 degraus, a maioria nunca à vista). Descendo, ele é curto: depois
 * dos oito degraus que se desce, faltam dois, e lá embaixo, na parede, já
 * aparece a porta azul em arco, meio escondida pela curva.
 */
interface Planta {
  /** Pisos de pedra construídos (descendo, o chão do salão vem logo depois do último). */
  degraus: number
  /** Fim do guarda-corpo, em radianos. */
  fimDoGuarda: number
  /** Fim da parede, em radianos (já fora de vista). */
  fimDaParede: number
  /** Pilares de remate redondo, em radianos. */
  pilares: readonly number[]
  /** Arandelas, em degraus a partir do primeiro espelho. */
  arandelas: readonly number[]
  /** Centro da porta em arco, em radianos; null = sem porta à vista. */
  porta: number | null
}

const DEGRAUS_SUBINDO = 26
const DEGRAUS_DESCENDO = 9
/** A porta fica a 0,7 m (no raio da parede) do pé do último degrau. */
const ANG_DA_PORTA = DEGRAUS_DESCENDO * ANG_DEGRAU + 0.27

const PLANTAS: Record<Sentido, Planta> = {
  1: {
    degraus: DEGRAUS_SUBINDO,
    fimDoGuarda: DEGRAUS_SUBINDO * ANG_DEGRAU + 0.3,
    fimDaParede: DEGRAUS_SUBINDO * ANG_DEGRAU + 0.3,
    pilares: [-ANG_PATAMAR + 0.1, -0.5 * ANG_DEGRAU, 7.5 * ANG_DEGRAU, 15.5 * ANG_DEGRAU, 23.5 * ANG_DEGRAU],
    arandelas: [4.5, 9.5, 14.5],
    porta: null,
  },
  [-1]: {
    degraus: DEGRAUS_DESCENDO,
    fimDoGuarda: (DEGRAUS_DESCENDO + 0.5) * ANG_DEGRAU,
    fimDaParede: ANG_DA_PORTA + 0.9,
    // Sem pilar na borda do patamar: descendo, o olho passa a 80 cm dele e a bola enchia o canto do quadro.
    pilares: [-ANG_PATAMAR + 0.1, (DEGRAUS_DESCENDO + 0.5) * ANG_DEGRAU],
    arandelas: [-4.5, 1.5, 4.8, 8.3],
    porta: ANG_DA_PORTA,
  },
}

// ---------------------------------------------------------------------------
// Câmera e passo.

const OLHO_SUBINDO = 1.3
/** Descendo, de pé e olhando para baixo: o olho fica mais alto (como na escadaria reta). */
const OLHO_DESCENDO = 1.6
/**
 * Quem anda numa curva olha para onde ela vai: ~26° para dentro da tangente
 * (o lance uns 3 m adiante). É o que põe a parede no lado de dentro do quadro
 * e a dobra onde o lance some perto do meio.
 */
const OLHAR_ADIANTE: Record<Sentido, number> = {
  1: 0.45,
  // Descendo, de olho nos degraus lá embaixo: menos para dentro, senão a
  // parede tapa metade do quadro e a curva da escada some.
  [-1]: 0.4,
}
/** Subindo, a cabeça levanta um pouco: os degraus sobem e a arandela entra no alto do quadro. */
const INCLINACAO_SUBINDO = 0.13
const INCLINACAO_DESCENDO_PATAMAR = -0.42
const INCLINACAO_DESCENDO_ESCADA = -0.74
const INCLINACAO_DESCENDO_SALAO = -0.2
/** Nos últimos degraus da descida a cabeça vira mais para dentro: a porta azul fica na parede. */
const OLHAR_PARA_A_PORTA = 0.25
/**
 * Descendo, o olho anda 30 cm mais para fora da curva que os pés da subida: de
 * cima, junto à parede, ela tapava a escada; daqui a parede fica na beira do
 * quadro e os degraus aparecem fazendo a curva.
 */
const AFASTAMENTO_DO_OLHO: Record<Sentido, number> = { 1: 0, [-1]: 0.42 }
/** Balanço lateral (m) e rolagem (rad) de cada passo, alternando o lado. */
const BALANCO_M = 0.03
const ROLAGEM_RAD = 0.012
/**
 * Aceno de cabeça (rad) quando o pé assenta: é o "peso" do passo. A altura não
 * afunda (ela sobe ou desce sem voltar atrás, como manda a conferência); o
 * baque fica no aceno, na rolagem e no som.
 */
const ACENO_SUBINDO = 0.014
const ACENO_DESCENDO = 0.022

// ---------------------------------------------------------------------------
// Roteiro (o mesmo da escadaria reta).

const DUR_PASSO = 1.05
const PASSOS_NO_PATAMAR = 2
const PASSOS_NA_ESCADA = 8
const INICIO_ANDAR = 1.0
const TOTAL_PASSOS = PASSOS_NO_PATAMAR + PASSOS_NA_ESCADA
const FIM_ANDAR = INICIO_ANDAR + TOTAL_PASSOS * DUR_PASSO
const FADE_ENTRADA = 1.1
const FADE_SAIDA_INICIO = FIM_ANDAR - 0.9
const FADE_SAIDA_FIM = FIM_ANDAR + 0.2
/** Fração do passo em que o corpo avança; o resto é o pé assentando. */
const LEVANTA = 0.62
/** Os pés caem no meio dos pisos: o primeiro, a dois degraus e meio do primeiro espelho. */
const ANG_INICIO = -(PASSOS_NO_PATAMAR + 0.5) * ANG_DEGRAU
/**
 * O som acompanha o fade da imagem: o eco do último passo abaixa antes de o
 * motor fechar o áudio na duração natural (sem corte seco no fim).
 */
const SOM_SAI_INICIO = FADE_SAIDA_FIM - 0.45
const SOM_SAI_DURACAO = 0.4

/** O roteiro em números, para o teste e para a conferência. */
export const ROTEIRO_ESCADA_CURVA = {
  duracaoS: FADE_SAIDA_FIM,
  inicioAndarS: INICIO_ANDAR,
  fimAndarS: FIM_ANDAR,
  durPassoS: DUR_PASSO,
  levanta: LEVANTA,
  totalPassos: TOTAL_PASSOS,
  passosNoPatamar: PASSOS_NO_PATAMAR,
  angDegrau: ANG_DEGRAU,
  raioAndar: RAIO_ANDAR,
  espelho: ESPELHO,
  olharAdiante: OLHAR_ADIANTE,
  afastamentoDoOlho: AFASTAMENTO_DO_OLHO,
  fadeEntradaS: FADE_ENTRADA,
  fadeSaidaInicioS: FADE_SAIDA_INICIO,
  somSaiInicioS: SOM_SAI_INICIO,
} as const

/** Instantes em que cada pé assenta (fim do avanço do corpo): é quando o passo soa. */
export function instantesDasPisadas(): number[] {
  return Array.from({ length: TOTAL_PASSOS }, (_, k) => INICIO_ANDAR + (k + LEVANTA) * DUR_PASSO)
}

// ---------------------------------------------------------------------------
// Pose da câmera (pura: o teste e o gráfico de conferência leem daqui).

/** Altura do piso no ângulo dado (0 no patamar); depois do último degrau, o chão do salão. */
function pisoEm(ang: number, sentido: Sentido, degraus = DEGRAUS_SUBINDO): number {
  if (ang < 0) return 0
  return sentido * Math.min(degraus + 1, Math.floor(ang / ANG_DEGRAU) + 1) * ESPELHO
}

/** Altura do piso sob o pé `j` (0 = onde a cena começa). */
function pisoDoPe(j: number, sentido: Sentido): number {
  return pisoEm(ANG_INICIO + j * ANG_DEGRAU, sentido)
}

/** Linha que passa pelo meio dos pisos: a base do guarda-corpo e do rodapé da parede. */
function linhaDosPisos(ang: number, sentido: Sentido, degraus: number): number {
  return sentido * ESPELHO * Math.min(degraus + 1, Math.max(0, ang / ANG_DEGRAU + 0.5))
}

const GANHO_SUAVE = TOTAL_PASSOS / (TOTAL_PASSOS - 1)

/**
 * Progresso suave, em passos: arranca durante o primeiro passo, segue em
 * velocidade constante e freia no último, terminando no mesmo lugar que o
 * corpo. A cabeça gira por ele (contínua, sem os trancos do passo) e, com
 * "reduzir movimento", o corpo inteiro desliza por ele.
 */
function progressoSuave(w: number): number {
  if (w <= 0) return 0
  if (w >= TOTAL_PASSOS) return TOTAL_PASSOS
  if (w < 1) return (GANHO_SUAVE * w * w) / 2
  if (w <= TOTAL_PASSOS - 1) return GANHO_SUAVE * (w - 0.5)
  const falta = TOTAL_PASSOS - w
  return GANHO_SUAVE * (TOTAL_PASSOS - 1 - (falta * falta) / 2)
}

/** A câmera no referencial da escada (antes do espelho do sentido descendo). */
export interface PoseNaEscada {
  /** Ângulo do corpo na curva. */
  ang: number
  /** Distância do centro da curva (a linha do andar + o balanço). */
  raio: number
  y: number
  /** Rumo (yaw): cresce virando para o centro da curva. */
  rumo: number
  /** Inclinação (pitch), já com o aceno. */
  inclinacao: number
  rolagem: number
  /** Desvio lateral do passo, em metros (positivo = para fora da curva). */
  balanco: number
  /** Aceno da pisada, em radianos (já somado em `inclinacao`). */
  aceno: number
}

export function poseNaEscada(t: number, sentido: Sentido, reduzirMovimento: boolean): PoseNaEscada {
  const w = (t - INICIO_ANDAR) / DUR_PASSO
  const suave = progressoSuave(w)
  let passos: number
  let y: number
  let balanco = 0
  let rolagem = 0
  let aceno = 0
  if (reduzirMovimento) {
    // Desliza em velocidade constante, sem trancos: a altura acompanha a
    // rampa dos degraus em linha reta.
    passos = suave
    const k = Math.min(TOTAL_PASSOS - 1, Math.floor(passos))
    const de = pisoDoPe(k, sentido)
    y = de + (pisoDoPe(k + 1, sentido) - de) * (passos - k)
  } else {
    const andado = Math.min(Math.max(w, 0), TOTAL_PASSOS)
    const k = Math.min(TOTAL_PASSOS - 1, Math.floor(andado))
    const u = andado - k
    // O corpo avança e sobe (ou desce) na primeira parte do passo; depois para.
    const m = easeInOutSine(clamp01(u / LEVANTA))
    passos = k + m
    const de = pisoDoPe(k, sentido)
    y = de + (pisoDoPe(k + 1, sentido) - de) * m
    const lado = k % 2 === 0 ? 1 : -1
    balanco = lado * BALANCO_M * Math.sin(Math.PI * u)
    rolagem = lado * ROLAGEM_RAD * Math.sin(Math.PI * u)
    if (u > LEVANTA) {
      const depois = (u - LEVANTA) / (1 - LEVANTA)
      const forca = sentido === 1 ? ACENO_SUBINDO : ACENO_DESCENDO
      aceno = -forca * Math.sin(Math.PI * Math.min(1, depois * 1.6)) * Math.exp(-depois * 1.5)
    }
  }
  const olho = sentido === 1 ? OLHO_SUBINDO : OLHO_DESCENDO
  // Descendo, o olhar baixa conforme a borda do patamar chega.
  const chegandoNaBorda = easeInOutSine(span(suave, 0.8, 2.8))
  // E levanta de novo nos últimos degraus: lá embaixo, a porta azul.
  const chegandoEmBaixo = easeInOutSine(span(suave, 7.4, 9.8))
  const descendo = INCLINACAO_DESCENDO_PATAMAR + (INCLINACAO_DESCENDO_ESCADA - INCLINACAO_DESCENDO_PATAMAR) * chegandoNaBorda
  const base = sentido === 1 ? INCLINACAO_SUBINDO : descendo + (INCLINACAO_DESCENDO_SALAO - descendo) * chegandoEmBaixo
  return {
    ang: ANG_INICIO + passos * ANG_DEGRAU,
    raio: RAIO_ANDAR + AFASTAMENTO_DO_OLHO[sentido] + balanco,
    y: y + olho,
    rumo: ANG_INICIO + suave * ANG_DEGRAU + OLHAR_ADIANTE[sentido] + (sentido === -1 ? OLHAR_PARA_A_PORTA * chegandoEmBaixo : 0),
    inclinacao: base + aceno,
    rolagem,
    balanco,
    aceno,
  }
}

/** Tremor da chama da arandela: lento e determinístico (a miniatura sai sempre igual). */
export function tremorDaChama(t: number, k: number, reduzirMovimento: boolean): number {
  const amplitude = reduzirMovimento ? 0.4 : 1
  const onda = 0.05 * Math.sin(2 * Math.PI * 1.3 * t + k * 1.7) + 0.035 * Math.sin(2 * Math.PI * 3.1 * t + k * 4.1) + 0.02 * Math.sin(2 * Math.PI * 6.7 * t + k * 2.3)
  return 1 + amplitude * onda
}

/** Volume do som (0 a 1) no tempo da cena: inteiro até o fim, depois abaixa junto com a imagem. */
export function volumeDoSom(t: number): number {
  return 1 - span(t, SOM_SAI_INICIO, SOM_SAI_INICIO + SOM_SAI_DURACAO)
}

// ---------------------------------------------------------------------------
// Geometria em lote: os degraus inteiros viram UMA malha (poucos draw calls).

type V3 = readonly [number, number, number]
type V2 = readonly [number, number]

/** Ponto no referencial da escada. */
function polar(r: number, ang: number, y: number): V3 {
  return [r * Math.cos(ang), y, -r * Math.sin(ang)]
}

/** Normal que aponta para fora do centro da curva. */
function radial(ang: number): V3 {
  return [Math.cos(ang), 0, -Math.sin(ang)]
}

const CIMA: V3 = [0, 1, 0]

interface Lote {
  pos: number[]
  nor: number[]
  uv: number[]
  idx: number[]
}

const novoLote = (): Lote => ({ pos: [], nor: [], uv: [], idx: [] })

/** Quadrilátero a-b-c-d, anti-horário visto do lado para onde a normal aponta. */
function quad(lote: Lote, v: readonly [V3, V3, V3, V3], n: readonly [V3, V3, V3, V3], uv: readonly [V2, V2, V2, V2]): void {
  const base = lote.pos.length / 3
  for (let i = 0; i < 4; i++) {
    lote.pos.push(v[i][0], v[i][1], v[i][2])
    lote.nor.push(n[i][0], n[i][1], n[i][2])
    lote.uv.push(uv[i][0], uv[i][1])
  }
  lote.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

/** Faixa curva vertical (face de fora do degrau, rodapé): normal para fora do centro. */
function faixaCurva(lote: Lote, r: number, a0: number, a1: number, baixo: (ang: number) => number, alto: (ang: number) => number, segmentos: number): void {
  for (let s = 0; s < segmentos; s++) {
    const b0 = a0 + ((a1 - a0) * s) / segmentos
    const b1 = a0 + ((a1 - a0) * (s + 1)) / segmentos
    const [u0, u1] = [(r * b0) / LADO_DA_CANTARIA, (r * b1) / LADO_DA_CANTARIA]
    const [y00, y10, y11, y01] = [baixo(b0), baixo(b1), alto(b1), alto(b0)]
    quad(
      lote,
      [polar(r, b0, y00), polar(r, b1, y10), polar(r, b1, y11), polar(r, b0, y01)],
      [radial(b0), radial(b1), radial(b1), radial(b0)],
      [
        [u0, y00 / LADO_DA_CANTARIA],
        [u1, y10 / LADO_DA_CANTARIA],
        [u1, y11 / LADO_DA_CANTARIA],
        [u0, y01 / LADO_DA_CANTARIA],
      ],
    )
  }
}

/** Junta os lotes numa geometria só, um grupo de material por lote. */
function geometriaDosLotes(THREE: ThreeModule, lotes: readonly Lote[]): Three.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const geo = new THREE.BufferGeometry()
  for (const [material, lote] of lotes.entries()) {
    const desloc = pos.length / 3
    geo.addGroup(idx.length, lote.idx.length, material)
    for (const valor of lote.pos) pos.push(valor)
    for (const valor of lote.nor) nor.push(valor)
    for (const valor of lote.uv) uv.push(valor)
    for (const i of lote.idx) idx.push(i + desloc)
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  return geo
}

const SEGMENTOS_DO_DEGRAU = 4

/** Pisos, espelhos e costado (face de fora) de todos os degraus, mais o costado do patamar de cima (descendo). */
function lotesDaEscada(sentido: Sentido, degraus: number): [Lote, Lote, Lote] {
  const pisos = novoLote()
  const espelhos = novoLote()
  const costado = novoLote()
  for (let i = 0; i < degraus; i++) {
    const a0 = i * ANG_DEGRAU
    const topo = sentido * (i + 1) * ESPELHO
    // Subindo, cada degrau é maciço até o chão do salão; descendo, o corpo
    // desce além do degrau de baixo e some no escuro.
    const fundo = sentido === 1 ? 0 : topo - COSTADO_DESCENDO
    // Juntas desencontradas: cada piso começa num ponto diferente da pedra.
    const du = (i * 0.37) % 1
    for (let s = 0; s < SEGMENTOS_DO_DEGRAU; s++) {
      const b0 = a0 + (ANG_DEGRAU * s) / SEGMENTOS_DO_DEGRAU
      const b1 = a0 + (ANG_DEGRAU * (s + 1)) / SEGMENTOS_DO_DEGRAU
      const v0 = s / SEGMENTOS_DO_DEGRAU
      const v1 = (s + 1) / SEGMENTOS_DO_DEGRAU
      quad(
        pisos,
        [polar(RAIO_DENTRO, b0, topo), polar(RAIO_FORA, b0, topo), polar(RAIO_FORA, b1, topo), polar(RAIO_DENTRO, b1, topo)],
        [CIMA, CIMA, CIMA, CIMA],
        [
          [du, v0],
          [du + 1, v0],
          [du + 1, v1],
          [du, v1],
        ],
      )
    }
    faixaCurva(costado, RAIO_FORA, a0, a0 + ANG_DEGRAU, () => fundo, () => topo, SEGMENTOS_DO_DEGRAU)
    // Espelho: só subindo ele fica de frente para quem anda. Descendo, a
    // queda entre um piso e outro olha para longe da câmera e nunca aparece.
    if (sentido === 1) {
      const n: V3 = [Math.sin(a0), 0, Math.cos(a0)]
      const base = i * ESPELHO
      quad(
        espelhos,
        [polar(RAIO_DENTRO, a0, base), polar(RAIO_FORA, a0, base), polar(RAIO_FORA, a0, topo), polar(RAIO_DENTRO, a0, topo)],
        [n, n, n, n],
        [
          [du, 0],
          [du + 1, 0],
          [du + 1, 1],
          [du, 1],
        ],
      )
    }
  }
  if (sentido === -1) {
    // Patamar de cima, de onde se começa a descer: o chão de lajes é outro
    // material (ver a cena); aqui fica só o costado dele.
    faixaCurva(costado, RAIO_FORA, -ANG_PATAMAR, 0, () => -COSTADO_DESCENDO, () => 0, 12)
  }
  return [pisos, espelhos, costado]
}

// ---------------------------------------------------------------------------
// Texturas procedurais: cantaria de pedra branca com juntas, grão e manchas.
// Pequenas e sem filtro na ampliação (texel aparente): o "granulado" do
// PlayStation, que é o RE de 1996.

interface Aparelho {
  largura: number
  altura: number
  fiadas: number
  blocos: number
  /**
   * Cor média da pedra: neutra, quase sem amarelo (a pedra é BRANCA; o calor
   * vem só da luz da arandela, perto dela). O motor desliga o gerenciamento
   * de cor (a tela clareia os tons médios), então o valor aqui é mais escuro
   * que o branco que aparece.
   */
  pedra: readonly [number, number, number]
  junta: string
  /** Variação de tom de um bloco para outro (0,1 = ±5%). */
  variacao: number
  /** 0,5 = aparelho corrido (meio bloco de desencontro entre fiadas). */
  desencontro: number
  manchas: number
  semente: number
}

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível')
  return [canvas, ctx]
}

const byte = (valor: number): number => Math.max(0, Math.min(255, Math.round(valor)))

function texturaDeCantaria(THREE: ThreeModule, a: Aparelho): Three.CanvasTexture {
  const [canvas, g] = tela(a.largura, a.altura)
  const rnd = semente(a.semente)
  g.fillStyle = a.junta
  g.fillRect(0, 0, a.largura, a.altura)
  const alturaDaFiada = a.altura / a.fiadas
  const larguraDoBloco = a.largura / a.blocos
  const junta = Math.max(1, Math.round(a.largura / 128))
  for (let f = 0; f < a.fiadas; f++) {
    const desloc = (f % 2) * a.desencontro * larguraDoBloco + (rnd() - 0.5) * larguraDoBloco * 0.15
    const y = f * alturaDaFiada
    for (let b = 0; b < a.blocos; b++) {
      const x = desloc + b * larguraDoBloco
      const tom = 1 + (rnd() - 0.5) * a.variacao
      const [r, gg, bb] = a.pedra.map((c) => byte(c * tom))
      // Desenhado de novo uma largura para cada lado: a pedra emenda sem costura.
      for (const dx of [-a.largura, 0, a.largura]) {
        const x0 = x + dx + junta
        const w = larguraDoBloco - junta
        const h = alturaDaFiada - junta
        g.fillStyle = `rgb(${r},${gg},${bb})`
        g.fillRect(x0, y + junta, w, h)
        // Quina de cima mais clara e de baixo mais escura: o relevo da pedra.
        g.fillStyle = 'rgba(255,255,252,0.18)'
        g.fillRect(x0, y + junta, w, junta)
        g.fillStyle = 'rgba(0,0,0,0.2)'
        g.fillRect(x0, y + alturaDaFiada - junta, w, junta)
      }
    }
  }
  const img = g.getImageData(0, 0, a.largura, a.altura)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  // Manchas de umidade e de mão (cinza, não marrom) e pedra lavada (claras).
  for (let k = 0; k < a.manchas; k++) {
    const x = rnd() * a.largura
    const y = rnd() * a.altura
    const raio = 6 + rnd() * a.largura * 0.18
    const grd = g.createRadialGradient(x, y, 0, x, y, raio)
    grd.addColorStop(0, rnd() > 0.35 ? 'rgba(48,48,46,0.16)' : 'rgba(255,255,252,0.1)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, a.largura, a.altura)
  }
  // Lascas.
  g.fillStyle = 'rgba(36,36,34,0.4)'
  for (let k = 0; k < a.manchas * 3; k++) g.fillRect(Math.floor(rnd() * a.largura), Math.floor(rnd() * a.altura), 1 + Math.floor(rnd() * 2), 1)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.NearestFilter
  return tex
}

/** Brilho em volta da chama: um disco que some nas bordas. */
function texturaDeHalo(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(64, 64)
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.22, 'rgba(255,255,255,0.42)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

/** Folha da porta: tábuas verticais, duas faixas de ferro com cravos e a argola. Tingida de azul pelo material. */
function texturaDaPorta(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(64, 128)
  const rnd = semente(53)
  g.fillStyle = 'rgb(214,214,214)'
  g.fillRect(0, 0, 64, 128)
  const tabuas = 5
  for (let k = 0; k < tabuas; k++) {
    const x = Math.round((k * 64) / tabuas)
    g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`
    g.fillRect(x, 0, Math.round(64 / tabuas), 128)
    g.fillStyle = 'rgba(0,0,0,0.55)'
    g.fillRect(x, 0, 1, 128)
  }
  for (const y of [26, 96]) {
    g.fillStyle = 'rgba(12,12,16,0.85)'
    g.fillRect(0, y, 64, 5)
    g.fillStyle = 'rgba(255,255,255,0.35)'
    for (let x = 4; x < 64; x += 12) g.fillRect(x, y + 2, 1, 1)
  }
  // Argola do puxador.
  g.strokeStyle = 'rgba(10,10,12,0.9)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(48, 66, 4, 0, Math.PI * 2)
  g.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  return tex
}

// ---------------------------------------------------------------------------
// Peças da cena.

/**
 * Cor da chama da arandela: âmbar CLARO. Quente o bastante para a pedra junto
 * dela dourar, claro o bastante para a pedra continuar branca (o tom ocre da
 * versão anterior vinha de uma luz laranja demais tingindo tudo).
 */
const COR_CHAMA = 0xffcf98
/** Acima do piso. Subindo o olho está a 1,3 m e a arandela entra no alto do quadro; descendo, a 1,6 m, ela sobe junto. */
const ALTURA_DA_ARANDELA: Record<Sentido, number> = { 1: 1.75, [-1]: 2.2 }
/** Intensidade em unidades "legadas" (o motor converte a luz pontual). */
// Subindo a parede passa a 60 cm do olho: a mesma luz fazia ali uma mancha estourada.
const LUZ_DA_ARANDELA: Record<Sentido, number> = { 1: 0.24, [-1]: 0.38 }
/** Alcance curto: a luz faz uma poça em volta da arandela e o resto cai no preto. */
const ALCANCE_DA_ARANDELA = 4.6
/**
 * A luz fica afastada da parede (não colada na chama): colada, a pedra junto
 * dela estourava em branco chapado e os degraus ficavam no escuro.
 */
const AFASTAMENTO_DA_LUZ = 0.75

interface Arandela {
  luz: Three.PointLight
  halo: Three.Sprite
}

function montarArandela(THREE: ThreeModule, mundo: Three.Group, ferro: Three.Material, vidro: Three.Material, haloTex: Three.Texture, k: number, sentido: Sentido, planta: Planta): Arandela {
  const ang = planta.arandelas[k] * ANG_DEGRAU
  const y = pisoEm(ang, sentido, planta.degraus) + ALTURA_DA_ARANDELA[sentido]
  // Montada com +X saindo da parede; girar por `ang` leva +X para a radial.
  const peca = new THREE.Group()
  const partes: [Three.BufferGeometry, Three.Material, number, number][] = [
    [new THREE.BoxGeometry(0.03, 0.26, 0.13), ferro, 0.015, 0],
    [new THREE.BoxGeometry(0.2, 0.025, 0.025), ferro, 0.11, 0.07],
    [new THREE.CylinderGeometry(0.066, 0.055, 0.19, 6), vidro, 0.22, -0.02],
    [new THREE.ConeGeometry(0.095, 0.085, 6), ferro, 0.22, 0.115],
    [new THREE.CylinderGeometry(0.028, 0.045, 0.045, 6), ferro, 0.22, -0.135],
  ]
  for (const [geo, mat, x, py] of partes) {
    const malha = new THREE.Mesh(geo, mat)
    malha.position.set(x, py, 0)
    peca.add(malha)
  }
  peca.position.set(...polar(RAIO_PAREDE, ang, y))
  peca.rotation.y = ang
  mundo.add(peca)

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: COR_CHAMA, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }))
  halo.position.set(...polar(RAIO_PAREDE + 0.22, ang, y - 0.02))
  halo.scale.set(0.95, 0.95, 1)
  mundo.add(halo)

  const luz = new THREE.PointLight(COR_CHAMA, LUZ_DA_ARANDELA[sentido], ALCANCE_DA_ARANDELA, 2)
  luz.name = `arandela-${k}`
  luz.position.set(...polar(RAIO_PAREDE + AFASTAMENTO_DA_LUZ, ang, y - 0.2))
  mundo.add(luz)
  return { luz, halo }
}

const ESPACO_DOS_BALAUSTRES = 0.15

/** Guarda-corpo azul: corrimão, travessa de baixo, balaústres finos e pilares com bola no topo. */
function montarGuardaCorpo(THREE: ThreeModule, mundo: Three.Group, azul: Three.Material, sentido: Sentido, planta: Planta): void {
  const angIni = -ANG_PATAMAR + 0.1
  const pontos = (altura: number) => {
    const lista: Three.Vector3[] = []
    for (let ang = angIni; ang < planta.fimDoGuarda; ang += 0.04) lista.push(new THREE.Vector3(...polar(RAIO_GUARDA, ang, linhaDosPisos(ang, sentido, planta.degraus) + altura)))
    lista.push(new THREE.Vector3(...polar(RAIO_GUARDA, planta.fimDoGuarda, linhaDosPisos(planta.fimDoGuarda, sentido, planta.degraus) + altura)))
    return lista
  }
  const corrimao = new THREE.CatmullRomCurve3(pontos(ALTURA_CORRIMAO))
  const travessa = new THREE.CatmullRomCurve3(pontos(ALTURA_TRAVESSA))
  for (const [curva, raio] of [
    [corrimao, 0.032],
    [travessa, 0.022],
  ] as const) {
    const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 260, raio, 6, false), azul)
    mundo.add(tubo)
  }

  // Balaústres: uma malha instanciada só (são uns 120).
  const angulos: number[] = []
  const passo = ESPACO_DOS_BALAUSTRES / RAIO_GUARDA
  for (let ang = angIni + passo; ang < planta.fimDoGuarda; ang += passo) {
    if (planta.pilares.some((p) => Math.abs(p - ang) < 0.11 / RAIO_GUARDA)) continue
    angulos.push(ang)
  }
  const balaustres = new THREE.InstancedMesh(new THREE.BoxGeometry(0.034, 1, 0.034), azul, angulos.length)
  const matriz = new THREE.Matrix4()
  const giro = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const tamanho = new THREE.Vector3(1, ALTURA_CORRIMAO - ALTURA_TRAVESSA, 1)
  for (const [i, ang] of angulos.entries()) {
    const meio = linhaDosPisos(ang, sentido, planta.degraus) + (ALTURA_CORRIMAO + ALTURA_TRAVESSA) / 2
    matriz.compose(new THREE.Vector3(...polar(RAIO_GUARDA, ang, meio)), giro.setFromAxisAngle(eixoY, ang), tamanho)
    balaustres.setMatrixAt(i, matriz)
  }
  balaustres.instanceMatrix.needsUpdate = true
  balaustres.frustumCulled = false
  mundo.add(balaustres)

  // Pilares quadrados com base, capitel e a bola do remate (como na foto).
  for (const ang of planta.pilares) {
    const chao = pisoEm(ang, sentido, planta.degraus)
    const topo = linhaDosPisos(ang, sentido, planta.degraus) + 1.02
    const pilar = new THREE.Group()
    const pecas: [Three.BufferGeometry, number][] = [
      [new THREE.BoxGeometry(0.2, 0.13, 0.2), chao + 0.065],
      [new THREE.BoxGeometry(0.14, topo - chao - 0.13, 0.14), (chao + 0.13 + topo) / 2],
      [new THREE.BoxGeometry(0.19, 0.05, 0.19), topo + 0.025],
      [new THREE.CylinderGeometry(0.028, 0.04, 0.05, 8), topo + 0.075],
      [new THREE.SphereGeometry(0.068, 10, 7), topo + 0.155],
    ]
    for (const [geo, py] of pecas) {
      const malha = new THREE.Mesh(geo, azul)
      malha.position.y = py
      pilar.add(malha)
    }
    pilar.position.set(...polar(RAIO_GUARDA, ang, 0))
    pilar.rotation.y = ang
    mundo.add(pilar)
  }
}

/** Contorno em arco romano: retângulo com meio círculo em cima, base no chão. */
function formaDeArco(THREE: ThreeModule, meiaLargura: number, alturaReta: number): Three.Shape {
  const forma = new THREE.Shape()
  forma.moveTo(-meiaLargura, 0)
  forma.lineTo(meiaLargura, 0)
  forma.lineTo(meiaLargura, alturaReta)
  forma.absarc(0, alturaReta, meiaLargura, 0, Math.PI, false)
  forma.lineTo(-meiaLargura, 0)
  return forma
}

const MEIA_LARGURA_DA_PORTA = 0.52
const ALTURA_RETA_DA_PORTA = 1.72
const MOLDURA = 0.17

/**
 * Porta azul em arco, no pé da escada, com moldura de pedra clara saliente.
 * Fica de pé na parede (plana: num raio de 2,6 m a corda de 1 m afasta só
 * 5 cm, e a moldura cobre a fresta).
 */
function montarPorta(THREE: ThreeModule, mundo: Three.Group, ang: number, chao: number, matMoldura: Three.Material): void {
  const porta = new THREE.Group()
  porta.name = 'porta'
  const contorno = formaDeArco(THREE, MEIA_LARGURA_DA_PORTA + MOLDURA, ALTURA_RETA_DA_PORTA)
  contorno.holes.push(formaDeArco(THREE, MEIA_LARGURA_DA_PORTA, ALTURA_RETA_DA_PORTA))
  const moldura = new THREE.Mesh(new THREE.ExtrudeGeometry(contorno, { depth: 0.2, bevelEnabled: false, curveSegments: 14 }), matMoldura)
  // Metade dentro da parede, metade saliente.
  moldura.position.z = -0.1
  const tex = texturaDaPorta(THREE)
  const largura = 2 * MEIA_LARGURA_DA_PORTA
  // A forma usa as próprias coordenadas como UV: leva x de [-L/2, L/2] e y de [0, topo] para 0..1.
  tex.repeat.set(1 / largura, 1 / (ALTURA_RETA_DA_PORTA + MEIA_LARGURA_DA_PORTA))
  tex.offset.set(0.5, 0)
  const folha = new THREE.Mesh(new THREE.ShapeGeometry(formaDeArco(THREE, MEIA_LARGURA_DA_PORTA, ALTURA_RETA_DA_PORTA), 14), new THREE.MeshStandardMaterial({ map: tex, color: 0x0d2f86, roughness: 0.62, emissive: 0x020818 }))
  // Recuada 6 cm da frente da moldura.
  folha.position.z = 0.04
  porta.add(moldura, folha)
  porta.position.set(...polar(RAIO_PAREDE, ang, chao))
  // +Z local (a frente da porta) apontando para fora do centro da curva.
  porta.rotation.y = Math.PI / 2 + ang
  mundo.add(porta)
}

// ---------------------------------------------------------------------------
// A cena.

export function criarEscadaCurva(sentido: Sentido): CriarCena {
  const planta = PLANTAS[sentido]
  return (THREE, { reduzirMovimento }): CenaTransicao => {
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.17)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40)
    camera.name = 'olho'
    scene.add(camera)

    // Tudo da escada mora num grupo: descendo, ele é espelhado (escala x = -1)
    // e a mesma escada vira para o outro lado. O three inverte a face da frente
    // de malha espelhada, então nada some.
    const mundo = new THREE.Group()
    mundo.scale.x = sentido
    scene.add(mundo)

    // Escuro neutro (nada de âmbar no ambiente: é ele que tingia a pedra).
    scene.add(new THREE.AmbientLight(0x101114, 1))
    // Lanterna fraca e neutra presa ao olho: só para os degraus logo à frente
    // não sumirem entre uma arandela e outra. Branca: é ela que mostra a pedra branca.
    // Queda linear (decay 1) e puxada para o lado de fora da curva: com a queda
    // física, a parede a meio metro do olho estourava em branco chapado.
    // Cone estreito (~36°): o largo de antes pegava em cheio a parede a 60 cm
    // do olho e estourava o terço do quadro em branco.
    const lanterna = new THREE.SpotLight(0xe6e8ec, sentido === 1 ? 0.24 : 0.5, 7, Math.PI / 5, 0.9, 1)
    // A câmera não está no grupo espelhado: o lado de fora é +x subindo e -x descendo.
    lanterna.position.set(0.35 * sentido, 0.2, 0)
    camera.add(lanterna)
    const alvoDaLanterna = new THREE.Object3D()
    // Subindo, mira os degraus adiante, longe da parede; descendo, o lance logo abaixo.
    if (sentido === 1) alvoDaLanterna.position.set(1.0, -0.6, -4)
    else alvoDaLanterna.position.set(0.3, -1.2, -4)
    camera.add(alvoDaLanterna)
    lanterna.target = alvoDaLanterna

    // Pedra branca: pisos mais claros e lisos, espelhos um tom abaixo (é o
    // contraste piso/espelho que desenha os degraus), parede em cantaria.
    const texPiso = texturaDeCantaria(THREE, { largura: 256, altura: 64, fiadas: 1, blocos: 2, pedra: [206, 205, 200], junta: '#66655f', variacao: 0.07, desencontro: 0, manchas: 10, semente: 11 })
    const texParede = texturaDeCantaria(THREE, { largura: 256, altura: 256, fiadas: 4, blocos: 2, pedra: [196, 195, 190], junta: '#5a5955', variacao: 0.12, desencontro: 0.5, manchas: 18, semente: 23 })
    const texLajes = texturaDeCantaria(THREE, { largura: 256, altura: 256, fiadas: 2, blocos: 2, pedra: [150, 150, 146], junta: '#3c3c39', variacao: 0.14, desencontro: 0, manchas: 16, semente: 37 })
    const matPiso = new THREE.MeshStandardMaterial({ map: texPiso, roughness: 0.78 })
    const matEspelho = new THREE.MeshStandardMaterial({ map: texPiso, color: 0x8f8f8b, roughness: 0.9 })
    const matCostado = new THREE.MeshStandardMaterial({ map: texParede, color: 0x9a9a96, roughness: 0.95 })

    const degraus = new THREE.Mesh(geometriaDosLotes(THREE, lotesDaEscada(sentido, planta.degraus)), [matPiso, matEspelho, matCostado])
    degraus.name = 'degraus'
    mundo.add(degraus)

    // Bocel: a quina do degrau, um friso claro. Subindo, a quina de frente;
    // descendo, a borda de onde se desce (é ela que desenha os degraus de cima).
    const bocel = new THREE.InstancedMesh(new THREE.BoxGeometry(RAIO_FORA - RAIO_DENTRO, 0.035, 0.05), new THREE.MeshStandardMaterial({ map: texPiso, color: 0xf0f0ec, roughness: 0.68 }), planta.degraus + 1)
    const matrizDoBocel = new THREE.Matrix4()
    const giroDoBocel = new THREE.Quaternion()
    const eixoY = new THREE.Vector3(0, 1, 0)
    const meioRaio = (RAIO_FORA + RAIO_DENTRO) / 2
    for (let i = 0; i <= planta.degraus; i++) {
      // Subindo: frente do degrau i (i = degraus sobra, no topo de fora de vista).
      // Descendo: i = 0 é a borda do patamar, i > 0 a borda do degrau i - 1.
      const ang = sentido === 1 ? i * ANG_DEGRAU - 0.02 / meioRaio : i * ANG_DEGRAU + 0.02 / meioRaio
      const topo = sentido === 1 ? Math.min(i + 1, planta.degraus) * ESPELHO : -i * ESPELHO
      matrizDoBocel.compose(new THREE.Vector3(...polar(meioRaio, ang, topo - 0.0175)), giroDoBocel.setFromAxisAngle(eixoY, ang), new THREE.Vector3(1, 1, 1))
      bocel.setMatrixAt(i, matrizDoBocel)
    }
    bocel.instanceMatrix.needsUpdate = true
    bocel.frustumCulled = false
    mundo.add(bocel)

    // Chão de lajes: subindo, o do salão (de onde se parte); descendo, o
    // patamar de cima e, lá embaixo, o salão onde fica a porta.
    // A geometria circular do three mapeia o diâmetro inteiro em 0..1: a
    // repetição é o diâmetro em pedras.
    const raioDoSalao = 16
    texLajes.repeat.set((2 * raioDoSalao) / LADO_DA_CANTARIA, (2 * raioDoSalao) / LADO_DA_CANTARIA)
    const salao = new THREE.Mesh(new THREE.CircleGeometry(raioDoSalao, 40), new THREE.MeshStandardMaterial({ map: texLajes, roughness: 0.9 }))
    salao.rotation.x = -Math.PI / 2
    const chaoDoSalao = sentido === 1 ? 0 : -(planta.degraus + 1) * ESPELHO
    salao.position.y = chaoDoSalao
    mundo.add(salao)
    if (sentido === -1) {
      const texPatamar = texturaDeCantaria(THREE, { largura: 256, altura: 256, fiadas: 2, blocos: 2, pedra: [176, 176, 171], junta: '#4a4a46', variacao: 0.12, desencontro: 0, manchas: 16, semente: 41 })
      texPatamar.repeat.set((2 * RAIO_FORA) / LADO_DA_CANTARIA, (2 * RAIO_FORA) / LADO_DA_CANTARIA)
      const patamar = new THREE.Mesh(new THREE.RingGeometry(RAIO_DENTRO, RAIO_FORA, 14, 1, -ANG_PATAMAR, ANG_PATAMAR), new THREE.MeshStandardMaterial({ map: texPatamar, roughness: 0.85 }))
      // O anel nasce no plano XY; deitado (-90° em X), o ângulo θ dele cai em
      // (cos θ, 0, -sen θ), que é o mesmo `polar` da escada.
      patamar.rotation.x = -Math.PI / 2
      mundo.add(patamar)
    }

    // Parede de pedra do lado de dentro da curva. O cilindro do three põe o
    // ângulo θ em (sen θ, cos θ); θ = π/2 + ang cai no `polar` da escada.
    const baseDaParede = sentido === 1 ? -0.3 : chaoDoSalao - 0.3
    const topoDaParede = sentido === 1 ? planta.degraus * ESPELHO + 3 : 3.5
    const alturaDaParede = topoDaParede - baseDaParede
    const arcoDaParede = planta.fimDaParede + ANG_PATAMAR
    const matParede = new THREE.MeshStandardMaterial({ map: texParede, roughness: 0.92 })
    texParede.repeat.set((RAIO_PAREDE * arcoDaParede) / LADO_DA_CANTARIA, alturaDaParede / LADO_DA_CANTARIA)
    const parede = new THREE.Mesh(new THREE.CylinderGeometry(RAIO_PAREDE, RAIO_PAREDE, alturaDaParede, 96, 1, true, Math.PI / 2 - ANG_PATAMAR, arcoDaParede), matParede)
    parede.name = 'parede'
    parede.position.y = (topoDaParede + baseDaParede) / 2
    mundo.add(parede)

    // Rodapé inclinado de pedra ao longo da parede, acompanhando os degraus.
    const rodape = novoLote()
    faixaCurva(rodape, RAIO_PAREDE + 0.03, -ANG_PATAMAR, planta.fimDaParede, (ang) => linhaDosPisos(ang, sentido, planta.degraus) - 0.14, (ang) => linhaDosPisos(ang, sentido, planta.degraus) + 0.24, 120)
    const matRodape = new THREE.MeshStandardMaterial({ map: texParede, color: 0xc4c4c0, roughness: 0.88 })
    mundo.add(new THREE.Mesh(geometriaDosLotes(THREE, [rodape]), matRodape))

    // Azul do guarda-corpo, já escurecido para a tela clarear (gerenciamento
    // de cor desligado no motor); um fio de emissivo para o azul nunca virar
    // preto onde a luz não chega.
    const azul = new THREE.MeshStandardMaterial({ color: 0x0b2a78, roughness: 0.42, emissive: 0x020818 })
    montarGuardaCorpo(THREE, mundo, azul, sentido, planta)

    if (planta.porta !== null) {
      const texMoldura = texParede.clone()
      texMoldura.repeat.set(1, 1)
      texMoldura.needsUpdate = true
      montarPorta(THREE, mundo, planta.porta, chaoDoSalao, new THREE.MeshStandardMaterial({ map: texMoldura, color: 0xe2e2de, roughness: 0.85 }))
    }

    const ferro = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.6 })
    const vidro = new THREE.MeshBasicMaterial({ color: 0xffe2b8 })
    const haloTex = texturaDeHalo(THREE)
    const arandelas = planta.arandelas.map((_, k) => montarArandela(THREE, mundo, ferro, vidro, haloTex, k, sentido, planta))
    // As intensidades de base são lidas no primeiro quadro: o motor converte as
    // luzes depois de `criar`, e o tremor tem de multiplicar o valor convertido.
    let bases: number[] | null = null

    function atualizar(t: number) {
      const pose = poseNaEscada(t, sentido, reduzirMovimento)
      const [x, y, z] = polar(pose.raio, pose.ang, pose.y)
      camera.position.set(sentido * x, y, z)
      camera.rotation.set(pose.inclinacao, sentido * pose.rumo, sentido * pose.rolagem, 'YXZ')
      bases ??= arandelas.map((a) => a.luz.intensity)
      for (const [k, a] of arandelas.entries()) {
        const chama = tremorDaChama(t, k, reduzirMovimento)
        a.luz.intensity = bases[k] * chama
        a.halo.material.opacity = 0.6 * chama
      }
      const entrada = 1 - span(t, 0, FADE_ENTRADA)
      const saida = span(t, FADE_SAIDA_INICIO, FADE_SAIDA_FIM)
      return { fade: Math.max(entrada, saida) }
    }

    function ajustarTela(aspecto: number) {
      camera.aspect = aspecto
      camera.fov = aspecto < 0.8 ? 66 : 50
      camera.updateProjectionMatrix()
    }

    function criarSom(kit: KitDeSom) {
      const { ctx } = kit
      // Limitador na saída (o mesmo do "Portão pesado", já aprovado): o passo
      // é um golpe curto, com pico muito acima da média; sem ele, chegar ao
      // volume das outras transições passava do teto.
      const limitador = ctx.createDynamicsCompressor()
      limitador.threshold.value = LIMITADOR.limiarDb
      limitador.knee.value = 6
      limitador.ratio.value = 12
      limitador.attack.value = 0.002
      limitador.release.value = 0.2
      // O compressor sozinho deixava passar a frente do golpe (ataque de 2 ms):
      // o pico verdadeiro variava de -1,8 a +0,7 dBTP entre execuções. O teto
      // é uma curva fixa, amostra a amostra: nada passa de TETO_DO_SOM.
      const teto = ctx.createWaveShaper()
      teto.curve = curvaDoTeto(AMOSTRAS_DA_CURVA)
      teto.oversample = '4x'
      limitador.connect(teto).connect(kit.destino)
      const ganho = GANHO_DO_SOM[sentido]
      // Tudo passa por um mestre que abaixa junto com o fade final.
      const mestre = ctx.createGain()
      mestre.gain.value = ganho
      mestre.connect(limitador)
      // Salão aberto e alto de pedra: cauda longa (~2,2 s) e escura, sem o eco
      // em "slap" do corredor fechado da escadaria reta.
      const salao = ctx.createConvolver()
      salao.buffer = respostaDoSalao(ctx)
      const molhado = ctx.createGain()
      molhado.gain.value = 0.6
      salao.connect(molhado).connect(mestre)
      // Primeiro reflexo: a parede curva, a menos de 1 m, do lado de dentro.
      const reflexo = ctx.createDelay(0.2)
      reflexo.delayTime.value = 0.011
      const reflexoFiltro = ctx.createBiquadFilter()
      reflexoFiltro.type = 'lowpass'
      reflexoFiltro.frequency.value = 3200
      const reflexoGanho = ctx.createGain()
      reflexoGanho.gain.value = 0.22
      const reflexoLado = ctx.createStereoPanner()
      // Subindo a parede fica à esquerda; descendo, à direita.
      reflexoLado.pan.value = -0.55 * sentido
      reflexo.connect(reflexoFiltro).connect(reflexoGanho).connect(reflexoLado).connect(mestre)
      const envio = ctx.createGain()
      envio.gain.value = 1
      envio.connect(salao)
      envio.connect(reflexo)

      let ultimo = -1
      let saindo = false
      return {
        atualizar(t: number) {
          if (!saindo && t >= SOM_SAI_INICIO) {
            saindo = true
            const agora = ctx.currentTime
            mestre.gain.cancelScheduledValues(agora)
            mestre.gain.setValueAtTime(ganho, agora)
            mestre.gain.linearRampToValueAtTime(0, agora + SOM_SAI_DURACAO)
          }
          const w = (t - INICIO_ANDAR) / DUR_PASSO
          if (w < 0 || w >= TOTAL_PASSOS) return
          const k = Math.floor(w)
          // O passo soa quando o pé assenta: o mesmo instante em que o corpo para.
          if (k !== ultimo && w - k >= LEVANTA) {
            ultimo = k
            const naEscada = k >= PASSOS_NO_PATAMAR
            passoNaPedraBranca(kit, mestre, envio, ctx.currentTime, {
              forca: naEscada ? 1 : 0.8,
              descendo: sentido === -1,
              // Pés alternados: um pouco para cada lado e um tom de diferença.
              lado: k % 2 === 0 ? -0.14 : 0.14,
              tom: 1 + 0.035 * Math.sin(k * 2.4),
            })
          }
        },
        reiniciar: () => {
          ultimo = -1
          saindo = false
          const agora = ctx.currentTime
          mestre.gain.cancelScheduledValues(agora)
          mestre.gain.setValueAtTime(ganho, agora)
        },
      }
    }

    function descartar() {
      lanterna.dispose()
      descartarCena(scene)
    }

    return { scene, camera, atualizar, ajustarTela, criarSom, descartar }
  }
}

// ---------------------------------------------------------------------------
// Som.

/**
 * Ganho do mestre por sentido, medido com scripts/conferir-som.cjs para cair
 * perto do volume das transições aprovadas (-18,6 LUFS). A descida já soa mais
 * alta (o corpo cai no degrau), por isso leva menos.
 */
const GANHO_DO_SOM: Record<Sentido, number> = { 1: 2.6, [-1]: 2.0 }
const LIMITADOR = { limiarDb: -10 } as const

/** Teto da saída (amplitude): -4 dBFS. O filtro do oversample 4x passa até ~1,2 dB por cima; sobra folga até -1 dBTP. */
export const TETO_DO_SOM = 0.63
/** Abaixo daqui a curva do teto é reta (o som passa intacto); acima, curva suave até o teto. */
export const JOELHO_DO_TETO = 0.4
const AMOSTRAS_DA_CURVA = 4097

/**
 * Curva do teto (WaveShaper): idêntica à entrada até o joelho, depois sobe em
 * tangente hiperbólica e nunca alcança TETO_DO_SOM. A derivada é contínua no
 * joelho, então só o topo do golpe é arredondado, sem clique. Entrada fora de
 * [-1, 1] o WaveShaper prende na ponta da curva: o teto vale para qualquer volume.
 */
export function curvaDoTeto(n: number): Float32Array<ArrayBuffer> {
  const curva = new Float32Array(n)
  const folga = TETO_DO_SOM - JOELHO_DO_TETO
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= JOELHO_DO_TETO ? a : JOELHO_DO_TETO + folga * Math.tanh((a - JOELHO_DO_TETO) / folga)
    curva[i] = Math.sign(x) * y
  }
  return curva
}

/**
 * Resposta ao impulso de um salão alto de pedra: ruído estéreo (determinístico)
 * que decai em ~2,2 s e escurece com o tempo (a pedra e o ar comem os agudos
 * primeiro). A entrada sobe em 12 ms: nenhum degrau no começo da cauda.
 */
function respostaDoSalao(ctx: BaseAudioContext): AudioBuffer {
  const taxa = ctx.sampleRate
  const duracao = 2.6
  const n = Math.ceil(taxa * duracao)
  const ir = ctx.createBuffer(2, n, taxa)
  const preAtraso = Math.round(0.024 * taxa)
  for (let c = 0; c < 2; c++) {
    const rnd = semente(57 + c * 101)
    const dados = ir.getChannelData(c)
    let filtrado = 0
    for (let i = preAtraso; i < n; i++) {
      const t = (i - preAtraso) / taxa
      const envoltoria = Math.exp(-3.1 * t) * Math.min(1, t / 0.012)
      // Passa-baixa de um polo que fecha com o tempo: brilhante no começo, escuro na cauda.
      const abertura = 0.5 * Math.exp(-1.8 * t) + 0.06
      filtrado += abertura * (rnd() * 2 - 1 - filtrado)
      dados[i] = filtrado * envoltoria
    }
  }
  return ir
}

interface Passo {
  /** 0 a 1: o patamar é mais leve que o degrau. */
  forca: number
  /** Descendo, o corpo cai no degrau: mais peso, estalo um pouco mais grave. */
  descendo: boolean
  /** -1 (esquerda) a 1 (direita). */
  lado: number
  /** Variação de tom de um pé para o outro (~±3%). */
  tom: number
}

/**
 * Sola de couro em pedra clara polida: um "toc" curto e agudo da laje (a pedra
 * maciça ressoa alto e seco, não o baque fundo da pedra bruta), o estalo do
 * salto e um arrasto leve de sola. Toda envoltória sobe em rampa de 1,5–3 ms e
 * termina em ~0 antes da fonte parar: nenhum degrau no sinal (era o que a
 * medida acusava como clique).
 */
function passoNaPedraBranca(kit: KitDeSom, seco: AudioNode, envio: AudioNode, at: number, passo: Passo) {
  const { ctx } = kit
  const saida = ctx.createGain()
  saida.gain.value = passo.forca
  const lado = ctx.createStereoPanner()
  lado.pan.value = passo.lado
  saida.connect(lado)
  lado.connect(seco)
  lado.connect(envio)
  const descendo = passo.descendo ? 1 : 0

  // 1. "Toc" da laje: seno que cai de ~420 para ~300 Hz em 70 ms. Entra 7 ms
  // depois do salto (o calcanhar bate, depois a sola): soa mais natural e os
  // picos das três camadas não se somam no mesmo instante.
  const at1 = at + 0.007
  const toc = ctx.createOscillator()
  toc.type = 'sine'
  toc.frequency.setValueAtTime(420 * passo.tom * (1 - 0.06 * descendo), at1)
  toc.frequency.exponentialRampToValueAtTime(300 * passo.tom, at1 + 0.07)
  const tg = ctx.createGain()
  tg.gain.setValueAtTime(0, at1)
  tg.gain.linearRampToValueAtTime(0.3, at1 + 0.002)
  tg.gain.exponentialRampToValueAtTime(0.0004, at1 + 0.1)
  toc.connect(tg).connect(saida)
  toc.start(at1)
  toc.stop(at1 + 0.13)

  // 2. Estalo do salto: ruído em banda em ~3,4 kHz, 35 ms.
  const salto = ctx.createBufferSource()
  salto.buffer = kit.ruido(0.12)
  const sf = ctx.createBiquadFilter()
  sf.type = 'bandpass'
  sf.frequency.value = 3400 * passo.tom
  sf.Q.value = 1.1
  const sg = ctx.createGain()
  sg.gain.setValueAtTime(0, at)
  sg.gain.linearRampToValueAtTime(0.5, at + 0.0015)
  sg.gain.exponentialRampToValueAtTime(0.0004, at + 0.07)
  salto.connect(sf).connect(sg).connect(saida)
  salto.start(at)
  salto.stop(at + 0.1)

  // 3. Peso do corpo: baque grave e curto (bem mais leve que o da pedra bruta),
  // com o corpo chegando 12 ms depois do salto.
  const at2 = at + 0.012
  const peso = ctx.createOscillator()
  peso.type = 'sine'
  peso.frequency.setValueAtTime(115, at2)
  peso.frequency.exponentialRampToValueAtTime(55, at2 + 0.14)
  const pg = ctx.createGain()
  pg.gain.setValueAtTime(0, at2)
  pg.gain.linearRampToValueAtTime(0.32 + 0.16 * descendo, at2 + 0.003)
  pg.gain.exponentialRampToValueAtTime(0.0004, at2 + 0.18)
  peso.connect(pg).connect(saida)
  peso.start(at2)
  peso.stop(at2 + 0.21)

  // 4. Arrasto da sola na pedra lisa: ruído agudo, curto e baixo.
  const areia = ctx.createBufferSource()
  areia.buffer = kit.ruido(0.25)
  const af = ctx.createBiquadFilter()
  af.type = 'highpass'
  af.frequency.value = 2400
  const ag = ctx.createGain()
  ag.gain.setValueAtTime(0, at)
  ag.gain.setValueAtTime(0, at + 0.02)
  ag.gain.linearRampToValueAtTime(0.045, at + 0.05)
  ag.gain.exponentialRampToValueAtTime(0.0004, at + 0.17)
  areia.connect(af).connect(ag).connect(saida)
  areia.start(at)
  areia.stop(at + 0.22)
}
