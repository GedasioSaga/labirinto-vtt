import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, ThreeModule } from '../../transicoes/tipos'
import { clamp01, easeInOutSine, span } from '../../transicoes/curvas'
import { descartarCena, semente } from '../../transicoes/texturas'

/*
 * ESCADA DE MADEIRA (pacote de animações), subindo e descendo.
 *
 * O molde é o da escadaria de pedra embutida (`transicoes/cenas/escadaPedra.ts`),
 * que o usuário aprovou: mesmo passo lento (1,05 s), 2 passos no patamar e 8
 * no lance, o peso que afunda a câmera a cada apoio, a mesma duração (11,7 s).
 * O que muda é o lugar: um vão estreito entre paredes de madeira, como as
 * escadas de serviço da mansão do Resident Evil (1996): lambri escuro com
 * rodapé, corrimão, vigas no teto, um lampião na parede e poeira na luz dele.
 *
 * O "_" no nome diz ao script do pacote (`scripts/pacote-animacoes.cjs`) que
 * este arquivo é um auxiliar, não uma animação. As duas fontes
 * (`escada-madeira.ts` e `escada-madeira-descendo.ts`) importam daqui e o Vite
 * embute este arquivo em cada módulo.
 */

// ---------------------------------------------------------------------------
// Medidas
// ---------------------------------------------------------------------------

// Degrau de escada de casa: mais alto e mais curto que o da pedra (0,2 × 0,33).
// O lance fica íngreme e os espelhos se empilham à frente, como num vão de serviço.
const DEGRAUS = 30
const ESPELHO = 0.2
const PISO = 0.28
const LARGURA = 1.6
const TABUA = 0.03
const SALIENCIA = 0.025
/** Subindo, câmera baixa e olhando um pouco para cima: vê os espelhos de frente e o lampião. */
const OLHO_SUBINDO = 1.3
const INCLINACAO_SUBINDO = 0.22
/** Descendo, de pé e olhando para baixo: os pisos somem no escuro do fundo. */
const OLHO_DESCENDO = 1.6
const INCLINACAO_DESCENDO = -0.78
/** Lambri até 85 cm acima da linha dos bocéis; corrimão a 95 cm; teto a 2,5 m. */
const LAMBRI = 0.85
const CORRIMAO = 0.95
const TETO = 2.5

// ---------------------------------------------------------------------------
// Ritmo (o mesmo da pedra)
// ---------------------------------------------------------------------------

const DURACAO_DO_PASSO = 1.05
const PASSOS_NO_PATAMAR = 2
const PASSOS_NO_LANCE = 8
const PASSOS = PASSOS_NO_PATAMAR + PASSOS_NO_LANCE
const INICIO_DA_CAMINHADA = 1.0
const FIM_DA_CAMINHADA = INICIO_DA_CAMINHADA + PASSOS * DURACAO_DO_PASSO
const FADE_ENTRADA = 1.1
const FADE_SAIDA_INICIO = FIM_DA_CAMINHADA - 0.9
const FADE_SAIDA_FIM = FIM_DA_CAMINHADA + 0.2
/** Fração do passo em que o pé apoia: antes o corpo avança, depois o peso assenta (e soa a passada). */
const APOIO = 0.62
/** Começa a 12 cm do primeiro espelho depois dos passos do patamar. */
const Z_INICIAL = PASSOS_NO_PATAMAR * PISO + 0.12
/** Subindo o corpo se ergue para vencer o degrau; descendo quase não sobe, só cai. */
const ARCO_SUBINDO = 0.03
const ARCO_DESCENDO = 0.012
/** O quanto o peso afunda a câmera logo depois do apoio. */
const ASSENTO = 0.06
const BALANCO = 0.03
const ROLAGEM = 0.012

// Lugar: do fundo do patamar (atrás da câmera) até bem depois do último degrau.
const Z_ATRAS = Z_INICIAL + 2.2
const Z_FIM = -DEGRAUS * PISO - 0.6

/** 1 = subindo (a escada cresce à frente), -1 = descendo (afunda à frente). */
type Sentido = 1 | -1

/** O roteiro, para os testes e para as provas (gráfico do movimento e onda do som). */
export const ROTEIRO_DA_ESCADA_DE_MADEIRA = {
  inicioDaCaminhada: INICIO_DA_CAMINHADA,
  duracaoDoPasso: DURACAO_DO_PASSO,
  passos: PASSOS,
  passosNoPatamar: PASSOS_NO_PATAMAR,
  apoio: APOIO,
  fadeEntradaFim: FADE_ENTRADA,
  fadeSaidaInicio: FADE_SAIDA_INICIO,
  fim: FADE_SAIDA_FIM,
  espelho: ESPELHO,
  piso: PISO,
  assento: ASSENTO,
} as const

/** Quando o pé apoia no passo `k` (segundos da cena): é aí que soa a passada na tábua. */
export function momentoDoApoio(k: number): number {
  return INICIO_DA_CAMINHADA + (k + APOIO) * DURACAO_DO_PASSO
}

// ---------------------------------------------------------------------------
// Movimento da câmera (puro: só depende de t)
// ---------------------------------------------------------------------------

/** Altura do piso sob a posição z: 0 no patamar, um degrau a cada PISO. */
function pisoEm(z: number, sentido: Sentido): number {
  if (z > 0) return 0
  return sentido * Math.min(DEGRAUS, Math.floor(-z / PISO) + 1) * ESPELHO
}

/** Onde o corpo está ao fim do passo `j` (j = 0 é a largada). */
function marco(j: number, sentido: Sentido): { y: number; z: number } {
  const z = Z_INICIAL - j * PISO
  return { y: pisoEm(z - 0.01, sentido), z }
}

interface Pose {
  x: number
  y: number
  z: number
  rolagem: number
}

/**
 * Um passo: o corpo avança e vence o degrau, o pé apoia e o peso afunda a
 * câmera, que volta devagar. É esse afundar que faz o passo pesar; o lado
 * alterna a cada passo (pé direito, pé esquerdo).
 */
function poseDoPasso(t: number, sentido: Sentido): Pose {
  const w = (t - INICIO_DA_CAMINHADA) / DURACAO_DO_PASSO
  if (w < 0) return { x: 0, y: 0, z: Z_INICIAL, rolagem: 0 }
  if (w >= PASSOS) {
    const fim = marco(PASSOS, sentido)
    return { x: 0, y: fim.y, z: fim.z, rolagem: 0 }
  }
  const k = Math.floor(w)
  const u = w - k
  const de = marco(k, sentido)
  const para = marco(k + 1, sentido)
  const ida = clamp01(u / APOIO)
  const avanco = easeInOutSine(ida)
  const arco = Math.sin(Math.PI * ida) * (sentido === 1 ? ARCO_SUBINDO : ARCO_DESCENDO)
  const depois = Math.max(0, u - APOIO) / (1 - APOIO)
  const assento = u > APOIO ? -ASSENTO * Math.sin(Math.PI * Math.min(1, depois * 1.6)) * Math.exp(-depois * 1.5) : 0
  const lado = k % 2 === 0 ? 1 : -1
  const onda = Math.sin(Math.PI * u)
  return {
    x: lado * BALANCO * onda,
    y: de.y + (para.y - de.y) * avanco + arco + assento,
    z: de.z + (para.z - de.z) * avanco,
    rolagem: lado * ROLAGEM * onda,
  }
}

/**
 * Reduzir movimento: o mesmo caminho, sem passo. A câmera desliza numa linha
 * só (sem balanço, sem sobe-e-desce, sem parar a cada degrau), acelerando e
 * freando de leve no começo e no fim.
 */
function poseSuave(t: number, sentido: Sentido): Pose {
  const w = PASSOS * easeInOutSine(span(t, INICIO_DA_CAMINHADA, FIM_DA_CAMINHADA))
  const k = Math.min(PASSOS - 1, Math.floor(w))
  const u = w - k
  const de = marco(k, sentido)
  const para = marco(k + 1, sentido)
  return { x: 0, y: de.y + (para.y - de.y) * u, z: de.z + (para.z - de.z) * u, rolagem: 0 }
}

/** 1 = tela preta; entra do preto e volta ao preto, como a pedra. */
function fadeEm(t: number): number {
  return Math.max(1 - span(t, 0, FADE_ENTRADA), span(t, FADE_SAIDA_INICIO, FADE_SAIDA_FIM))
}

/** Chama do lampião: três senos fora de fase, sem relógio interno (a miniatura sai sempre igual). */
function chamaEm(t: number): number {
  return 1 + 0.07 * Math.sin(t * 6.1) + 0.045 * Math.sin(t * 13.7 + 1.3) + 0.025 * Math.sin(t * 29.3 + 0.4)
}

/**
 * A linha dos bocéis: rodapé, lambri, corrimão e teto acompanham esta linha.
 * Subindo ela sai do patamar um piso antes do primeiro espelho (como a
 * longarina de uma escada de verdade), e descendo sai da borda do patamar.
 */
function linhaDaEscada(z: number, sentido: Sentido): number {
  if (sentido === 1) return Math.max(0, ESPELHO * (1 - z / PISO))
  return Math.min(0, (ESPELHO * z) / PISO)
}

// ---------------------------------------------------------------------------
// Texturas (canvas, com semente: a miniatura sai igual toda vez)
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number]

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const g = canvas.getContext('2d')
  if (!g) throw new Error('canvas 2D indisponível')
  return [canvas, g]
}

function tom(rgb: Rgb, fator: number, alfa = 1): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * fator)))
  return `rgba(${c(rgb[0])}, ${c(rgb[1])}, ${c(rgb[2])}, ${alfa})`
}

interface Tabuado {
  largura: number
  altura: number
  tabuas: number
  base: Rgb
  seed: number
  /** Veio de lado (degrau, espelho, forro): as tábuas viram faixas horizontais. */
  deitado?: boolean
  /** Emenda de topo (tábua curta) no meio do comprimento. */
  emendas?: boolean
  /** Chance de nó em cada tábua. */
  nos?: number
  /** Pintura por cima (desgaste, sujeira), já sem a rotação. */
  depois?: (g: CanvasRenderingContext2D, largura: number, altura: number) => void
}

/**
 * Tábuas lado a lado com veio, nós, emendas e uma junta escura entre elas,
 * mais um granulado por cima: é o granulado que dá o ar de textura de
 * PlayStation sem baixar a resolução da tela.
 */
function texturaDeTabuas(THREE: ThreeModule, op: Tabuado): Three.CanvasTexture {
  const [canvas, g] = tela(op.largura, op.altura)
  const rnd = semente(op.seed)
  // Pintado sempre "em pé"; deitado é o mesmo desenho girado 90°.
  const L = op.deitado ? op.altura : op.largura
  const A = op.deitado ? op.largura : op.altura
  if (op.deitado) {
    g.translate(op.largura, 0)
    g.rotate(Math.PI / 2)
  }
  const w = L / op.tabuas
  for (let j = 0; j < op.tabuas; j++) {
    const x0 = j * w
    const fator = 0.8 + rnd() * 0.4
    g.fillStyle = tom(op.base, fator)
    g.fillRect(x0, 0, w + 1, A)
    const fios = Math.round(w * 0.7)
    for (let i = 0; i < fios; i++) {
      const x = x0 + rnd() * w
      const amplitude = 0.4 + rnd() * 2.2
      const comprimentoDaOnda = 14 + rnd() * 40
      const fase = rnd() * Math.PI * 2
      g.strokeStyle = rnd() < 0.8 ? tom(op.base, fator * 0.5, 0.05 + rnd() * 0.2) : tom(op.base, fator * 1.35, 0.04 + rnd() * 0.08)
      g.lineWidth = 0.5 + rnd() * 1.4
      g.beginPath()
      for (let y = 0; y <= A; y += 6) {
        const xx = x + Math.sin(y / comprimentoDaOnda + fase) * amplitude
        if (y === 0) g.moveTo(xx, y)
        else g.lineTo(xx, y)
      }
      g.stroke()
    }
    if (rnd() < (op.nos ?? 0.3)) {
      const cx = x0 + w * (0.3 + rnd() * 0.4)
      const cy = rnd() * A
      const r = 1.5 + rnd() * w * 0.1
      for (let anel = 4; anel >= 1; anel--) {
        g.fillStyle = tom(op.base, fator * (0.3 + 0.12 * anel), 0.4)
        g.beginPath()
        g.ellipse(cx, cy, r * anel * 0.5, r * anel * 1.2, 0, 0, Math.PI * 2)
        g.fill()
      }
    }
    if (op.emendas && rnd() < 0.6) {
      g.fillStyle = 'rgba(0, 0, 0, 0.6)'
      g.fillRect(x0, rnd() * A, w, 1.5)
    }
    // Junta: sombra funda de um lado, fio de luz do outro (a quina gasta).
    g.fillStyle = 'rgba(0, 0, 0, 0.78)'
    g.fillRect(x0, 0, 1.6, A)
    g.fillStyle = 'rgba(255, 214, 160, 0.07)'
    g.fillRect(x0 + 1.6, 0, 1, A)
  }
  g.setTransform(1, 0, 0, 1, 0, 0)
  op.depois?.(g, op.largura, op.altura)
  const img = g.getImageData(0, 0, op.largura, op.altura)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 8
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

/** Mancha redonda que some nas bordas: halo do lampião e grão de poeira. */
function texturaDeBrilho(THREE: ThreeModule, tamanho: number, miolo: number): Three.CanvasTexture {
  const [canvas, g] = tela(tamanho, tamanho)
  const meio = tamanho / 2
  const grd = g.createRadialGradient(meio, meio, 0, meio, meio, meio)
  grd.addColorStop(0, 'rgba(255, 255, 255, 1)')
  grd.addColorStop(miolo, 'rgba(255, 255, 255, 0.35)')
  grd.addColorStop(1, 'rgba(255, 255, 255, 0)')
  g.fillStyle = grd
  g.fillRect(0, 0, tamanho, tamanho)
  return new THREE.CanvasTexture(canvas)
}

/** UV em metros: a textura repete a cada `ladoU` × `ladoV` metros e não estica em peça comprida. */
function uvEmMetros(geo: Three.BufferGeometry, larguraU: number, alturaV: number, ladoU: number, ladoV: number): Three.BufferGeometry {
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * larguraU) / ladoU, (uv.getY(i) * alturaV) / ladoV)
  uv.needsUpdate = true
  return geo
}

// ---------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------

const POEIRA = 240

/**
 * Escada estreita de madeira entre duas paredes de madeira, subindo ou
 * descendo. Subindo, a câmera baixa vê os espelhos se empilhando e o lampião
 * na parede da esquerda; descendo, olha para baixo e vê os pisos sumindo no
 * escuro, com o lampião lá embaixo.
 */
export function criarEscadaDeMadeira(sentido: Sentido): CriarCena {
  return (THREE, { reduzirMovimento }): CenaTransicao => {
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, sentido === 1 ? 0.27 : 0.24)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 30)
    scene.add(camera)

    const linha = (z: number) => linhaDaEscada(z, sentido)
    /** Quanto a linha sobe por metro de z (negativo subindo: a escada cresce para -z). */
    const inclinacaoDaLinha = sentido === 1 ? -ESPELHO / PISO : ESPELHO / PISO
    /** Onde a linha deixa de ser reta (patamar) e vira rampa (lance). */
    const zDaJuncao = sentido === 1 ? PISO : 0
    const yMin = sentido === 1 ? -0.6 : -(DEGRAUS * ESPELHO + 1.5)
    const yMax = sentido === 1 ? DEGRAUS * ESPELHO + 3.5 : 3.5

    // --- Luz -------------------------------------------------------------
    // Quase nada de ambiente: o escuro é o assunto. O lampião é a luz-chave;
    // um holofote fraco e quente preso na câmera (como o da pedra) só impede
    // o degrau mais perto de sumir antes de o lampião alcançar.
    scene.add(new THREE.AmbientLight(0x1b120b, 0.3))
    // Fria lá no alto (subindo) ou lá no fundo (descendo): o escuro ganha forma
    // e o lampião fica mais quente por contraste, como nas mansões do jogo.
    const fria = new THREE.DirectionalLight(0x6c7fa6, 0.12)
    fria.position.set(-0.4, sentido === 1 ? 8 : 4, -9)
    fria.target.position.set(0, sentido * 2, 0)
    scene.add(fria, fria.target)
    const presenca = new THREE.SpotLight(0xd6b48c, 0.2, 4.5, Math.PI / 3.2, 0.95, 2)
    presenca.position.set(0, 0.1, 0)
    camera.add(presenca)
    const alvoDaPresenca = new THREE.Object3D()
    alvoDaPresenca.position.set(0, -1, -3)
    camera.add(alvoDaPresenca)
    presenca.target = alvoDaPresenca

    // --- Materiais -----------------------------------------------------------
    // Tons escuros e bem quentes: o motor desliga o gerenciamento de cor e a
    // saída em sRGB clareia e lava o que é escuro (a pedra foi afinada assim).
    const madeira: Rgb = [66, 34, 15]
    const texDegrau = texturaDeTabuas(THREE, {
      largura: 256,
      altura: 64,
      tabuas: 1,
      base: [86, 46, 20],
      seed: 11,
      deitado: true,
      nos: 0.5,
      depois: (g, l, a) => {
        // O meio do degrau, onde todo mundo pisa, perdeu o verniz e clareou;
        // os cantos junto às paredes juntaram sujeira.
        const gasto = g.createRadialGradient(l / 2, a / 2, 0, l / 2, a / 2, l * 0.3)
        gasto.addColorStop(0, 'rgba(255, 214, 160, 0.16)')
        gasto.addColorStop(1, 'rgba(255, 214, 160, 0)')
        g.fillStyle = gasto
        g.fillRect(0, 0, l, a)
        const cantos = g.createLinearGradient(0, 0, l, 0)
        cantos.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
        cantos.addColorStop(0.12, 'rgba(0, 0, 0, 0)')
        cantos.addColorStop(0.88, 'rgba(0, 0, 0, 0)')
        cantos.addColorStop(1, 'rgba(0, 0, 0, 0.55)')
        g.fillStyle = cantos
        g.fillRect(0, 0, l, a)
      },
    })
    const texEspelho = texturaDeTabuas(THREE, {
      largura: 256,
      altura: 32,
      tabuas: 1,
      base: [48, 24, 10],
      seed: 23,
      deitado: true,
      nos: 0.2,
      depois: (g, l, a) => {
        // Bico de sapato riscando a parte de baixo do espelho.
        const rnd = semente(29)
        for (let i = 0; i < 26; i++) {
          g.fillStyle = `rgba(255, 220, 180, ${0.04 + rnd() * 0.07})`
          g.fillRect(l * 0.2 + rnd() * l * 0.6, a * (0.6 + rnd() * 0.35), 3 + rnd() * 14, 1)
        }
      },
    })
    const texParede = texturaDeTabuas(THREE, { largura: 256, altura: 512, tabuas: 4, base: madeira, seed: 37, emendas: true, nos: 0.35 })
    const texLambri = texturaDeTabuas(THREE, { largura: 256, altura: 256, tabuas: 8, base: [44, 21, 9], seed: 41, nos: 0.15 })
    const texChao = texturaDeTabuas(THREE, { largura: 256, altura: 512, tabuas: 5, base: [70, 38, 17], seed: 53, emendas: true, nos: 0.3 })
    const texForro = texturaDeTabuas(THREE, { largura: 512, altura: 256, tabuas: 4, base: [40, 22, 11], seed: 61, deitado: true, emendas: true })

    const matPiso = new THREE.MeshStandardMaterial({ map: texDegrau, roughness: 0.62 })
    const matEspelho = new THREE.MeshStandardMaterial({ map: texEspelho, roughness: 0.85 })
    const matBocel = new THREE.MeshStandardMaterial({ color: 0x6a3f1e, roughness: 0.5 })
    const matParede = new THREE.MeshStandardMaterial({ map: texParede, roughness: 0.8 })
    const matLambri = new THREE.MeshStandardMaterial({ map: texLambri, roughness: 0.72 })
    const matChao = new THREE.MeshStandardMaterial({ map: texChao, roughness: 0.7 })
    const matForro = new THREE.MeshStandardMaterial({ map: texForro, roughness: 0.9 })
    const matRodape = new THREE.MeshStandardMaterial({ color: 0x1e1007, roughness: 0.7 })
    const matMoldura = new THREE.MeshStandardMaterial({ color: 0x3a1f0d, roughness: 0.6 })
    const matCorrimao = new THREE.MeshStandardMaterial({ color: 0x4a2711, roughness: 0.42 })
    const matViga = new THREE.MeshStandardMaterial({ color: 0x1c1008, roughness: 0.85 })
    // Latão sem mapa de ambiente: metal puro sairia preto; meio metálico lê como latão gasto.
    const matLatao = new THREE.MeshStandardMaterial({ color: 0x4a3518, metalness: 0.3, roughness: 0.6 })

    // --- Peças que seguem a linha da escada ----------------------------------
    /**
     * Uma peça comprida ao longo da linha: um trecho reto sobre o patamar e um
     * inclinado no lance. O inclinado é cisalhado (não girado): as bordas
     * ficam de pé e a altura medida na vertical é a mesma do trecho reto.
     */
    const aoLongoDaLinha = (fazer: (comprimento: number) => Three.BufferGeometry, material: Three.Material, x: number, acima: number, soNoLance = false) => {
      const trechos: [number, number][] = soNoLance ? [[zDaJuncao, Z_FIM]] : [[Z_ATRAS, zDaJuncao], [zDaJuncao, Z_FIM]]
      for (const [z0, z1] of trechos) {
        const geo = fazer(z0 - z1)
        if (z0 === zDaJuncao) geo.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0, inclinacaoDaLinha))
        const zMeio = (z0 + z1) / 2
        const malha = new THREE.Mesh(geo, material)
        malha.position.set(x, linha(zMeio) + acima, zMeio)
        scene.add(malha)
      }
    }

    for (const lado of [-1, 1] as const) {
      const giro = lado === -1 ? Math.PI / 2 : -Math.PI / 2
      // Parede inteira de tábuas largas, de pé; some no escuro lá em cima.
      const comprimento = Z_ATRAS - Z_FIM
      const altura = yMax - yMin
      const parede = new THREE.Mesh(uvEmMetros(new THREE.PlaneGeometry(comprimento, altura), comprimento, altura, 0.64, 1.28), matParede)
      parede.rotation.y = giro
      parede.position.set((lado * LARGURA) / 2, (yMin + yMax) / 2, (Z_ATRAS + Z_FIM) / 2)
      scene.add(parede)
      // Lambri de tábuas estreitas e mais escuras, da base dos degraus até 85 cm acima da linha.
      const xLambri = lado * (LARGURA / 2 - 0.006)
      const alturaDoLambri = LAMBRI + ESPELHO + 0.05
      aoLongoDaLinha((c) => uvEmMetros(new THREE.PlaneGeometry(c, alturaDoLambri), c, alturaDoLambri, 0.64, 0.64).rotateY(giro), matLambri, xLambri, LAMBRI - alturaDoLambri / 2)
      // Rodapé (longarina no lance): cobre a ponta dos degraus contra a parede.
      aoLongoDaLinha((c) => new THREE.BoxGeometry(0.025, 0.42, c), matRodape, lado * (LARGURA / 2 - 0.006 - 0.0125), -0.04)
      // Moldura no topo do lambri.
      aoLongoDaLinha((c) => new THREE.BoxGeometry(0.04, 0.05, c), matMoldura, lado * (LARGURA / 2 - 0.006 - 0.02), LAMBRI)
    }

    // Corrimão na parede da direita, só no lance, em suportes de latão.
    aoLongoDaLinha((c) => new THREE.CylinderGeometry(0.027, 0.027, c, 8).rotateX(Math.PI / 2), matCorrimao, LARGURA / 2 - 0.006 - 0.075, CORRIMAO, true)
    const geoSuporte = new THREE.BoxGeometry(0.075, 0.018, 0.022)
    for (let z = zDaJuncao - 0.35; z > Z_FIM + 0.5; z -= 1.1) {
      const suporte = new THREE.Mesh(geoSuporte, matLatao)
      suporte.position.set(LARGURA / 2 - 0.006 - 0.04, linha(z) + CORRIMAO - 0.03, z)
      scene.add(suporte)
    }

    // Forro de tábuas acompanhando a escada, com vigas atravessadas: o vão
    // fecha por cima e a escada vira um corredor apertado.
    aoLongoDaLinha((c) => uvEmMetros(new THREE.PlaneGeometry(LARGURA, c), LARGURA, c, 1.28, 0.64).rotateX(Math.PI / 2), matForro, 0, TETO)
    const geoViga = new THREE.BoxGeometry(LARGURA, 0.13, 0.11)
    for (let z = Z_ATRAS - 0.4; z > Z_FIM; z -= 1.15) {
      const viga = new THREE.Mesh(geoViga, matViga)
      viga.position.set(0, linha(z) + TETO - 0.065, z)
      scene.add(viga)
    }

    // Patamar: tábuas correndo no sentido da caminhada.
    const fundoDoPatamar = Z_ATRAS
    const chao = new THREE.Mesh(uvEmMetros(new THREE.PlaneGeometry(LARGURA, fundoDoPatamar), LARGURA, fundoDoPatamar, 0.64, 1.28).rotateX(-Math.PI / 2), matChao)
    chao.position.set(0, 0, fundoDoPatamar / 2)
    scene.add(chao)

    // --- Degraus -----------------------------------------------------------
    // Cada degrau: um bloco (o espelho, de frente para quem sobe), a tábua do
    // piso por cima saindo um pouco além e um bocel redondo na borda que se vê
    // (subindo, a da frente; descendo, a de trás, de onde o pé cai).
    const geoBloco = new THREE.BoxGeometry(LARGURA, ESPELHO - TABUA, PISO)
    const geoTabua = new THREE.BoxGeometry(LARGURA, TABUA, PISO + SALIENCIA)
    const geoBocel = new THREE.CylinderGeometry(TABUA / 2 + 0.002, TABUA / 2 + 0.002, LARGURA, 8).rotateZ(Math.PI / 2)
    for (let i = 0; i < DEGRAUS; i++) {
      const topo = sentido * (i + 1) * ESPELHO
      const zFrente = -i * PISO
      const zMeio = zFrente - PISO / 2
      const bloco = new THREE.Mesh(geoBloco, matEspelho)
      bloco.position.set(0, topo - ESPELHO / 2 - TABUA / 2, zMeio)
      const tabua = new THREE.Mesh(geoTabua, matPiso)
      tabua.position.set(0, topo - TABUA / 2, zMeio + (sentido * SALIENCIA) / 2)
      const bocel = new THREE.Mesh(geoBocel, matBocel)
      bocel.position.set(0, topo - TABUA / 2, sentido === 1 ? zFrente + SALIENCIA : zFrente - PISO - SALIENCIA)
      scene.add(bloco, tabua, bocel)
    }
    if (sentido === -1) {
      // Descendo, a primeira quina é a borda do próprio patamar.
      const bocel = new THREE.Mesh(geoBocel, matBocel)
      bocel.position.set(0, -TABUA / 2, -SALIENCIA)
      const tira = new THREE.Mesh(new THREE.BoxGeometry(LARGURA, TABUA, 0.08), matPiso)
      tira.position.set(0, -TABUA / 2, 0.04 - SALIENCIA)
      scene.add(bocel, tira)
    }

    // --- Lampião ---------------------------------------------------------------
    // Na parede da esquerda, mais à frente: cresce na tela enquanto a câmera
    // se aproxima e sai pela esquerda no fim do lance.
    const zLampiao = sentido === 1 ? -2.5 : -2.6
    const yLampiao = linha(zLampiao) + (sentido === 1 ? 0.92 : 1.35)
    const xParede = -LARGURA / 2
    const espelhoDoLampiao = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.1), matLatao)
    espelhoDoLampiao.position.set(xParede + 0.01, yLampiao - 0.02, zLampiao)
    const braco = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.018), matLatao)
    braco.position.set(xParede + 0.07, yLampiao - 0.09, zLampiao)
    const copo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.035, 8), matLatao)
    copo.position.set(xParede + 0.12, yLampiao - 0.085, zLampiao)
    const vidro = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.046, 0.17, 10),
      new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.35, depthWrite: false }),
    )
    vidro.position.set(xParede + 0.12, yLampiao + 0.015, zLampiao)
    const matChama = new THREE.MeshBasicMaterial({ color: 0xffd49a })
    const chama = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), matChama)
    chama.position.set(xParede + 0.12, yLampiao - 0.01, zLampiao)
    const matHalo = new THREE.MeshBasicMaterial({ map: texturaDeBrilho(THREE, 64, 0.18), color: 0xff9a50, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), matHalo)
    halo.position.copy(chama.position)
    halo.renderOrder = 2
    scene.add(espelhoDoLampiao, braco, copo, vidro, chama, halo)
    // Duas luzes no lampião. Um holofote de quase 180° virado para o vão: é uma
    // pontual que não acende a parede de trás (colada nela, estouraria em
    // branco) e, aberto assim, não desenha o círculo de lanterna na parede da
    // frente. E uma pontual fraca e curta que só esquenta a madeira em volta.
    const luz = new THREE.SpotLight(0xff9c4a, 1.35, 6.5, 1.45, 1, 2)
    luz.name = 'lampiao'
    luz.position.set(xParede + 0.14, yLampiao, zLampiao)
    const alvoDaLuz = new THREE.Object3D()
    alvoDaLuz.position.set(xParede + 1.14, yLampiao - 0.35, zLampiao + 0.3)
    luz.target = alvoDaLuz
    // Afastada da parede: perto demais, acenderia o latão do lampião como uma lâmpada.
    const brilhoNaParede = new THREE.PointLight(0xffa457, 0.05, 1.8, 2)
    brilhoNaParede.position.set(xParede + 0.35, yLampiao + 0.05, zLampiao)
    scene.add(luz, alvoDaLuz, brilhoNaParede)
    // A tremida da chama mexe na COR da luz, não na intensidade: o motor
    // multiplica a intensidade uma vez depois de montar (conversão das luzes
    // legadas), e reescrever a intensidade a cada quadro desfaria isso.
    const corDaLuz = luz.color.clone()

    // --- Poeira na luz ------------------------------------------------------------
    const rndPoeira = semente(71)
    const base = new Float32Array(POEIRA * 3)
    const fases = new Float32Array(POEIRA * 4)
    for (let i = 0; i < POEIRA; i++) {
      const z = zLampiao - 1.1 + rndPoeira() * 3.4
      base[i * 3] = -0.7 + rndPoeira() * 1.4
      base[i * 3 + 1] = linha(z) + 0.35 + rndPoeira() * 1.9
      base[i * 3 + 2] = z
      for (let f = 0; f < 4; f++) fases[i * 4 + f] = rndPoeira() * Math.PI * 2
    }
    const posicoes = new THREE.BufferAttribute(new Float32Array(POEIRA * 3), 3)
    const cores = new THREE.BufferAttribute(new Float32Array(POEIRA * 3), 3)
    const geoPoeira = new THREE.BufferGeometry()
    geoPoeira.setAttribute('position', posicoes)
    geoPoeira.setAttribute('color', cores)
    const poeira = new THREE.Points(
      geoPoeira,
      new THREE.PointsMaterial({ size: 0.012, map: texturaDeBrilho(THREE, 32, 0.3), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    poeira.frustumCulled = false
    poeira.name = 'poeira'
    scene.add(poeira)

    /** Grãos pairando (sem cair de vez: nada some e reaparece) e só acesos perto do lampião. */
    function atualizarPoeira(t: number, brilho: number) {
      const lento = reduzirMovimento ? 0.4 : 1
      for (let i = 0; i < POEIRA; i++) {
        const tt = t * lento
        const x = base[i * 3] + Math.sin(tt * 0.33 + fases[i * 4]) * 0.06
        const y = base[i * 3 + 1] + Math.sin(tt * 0.27 + fases[i * 4 + 1]) * 0.05 - tt * 0.01
        const z = base[i * 3 + 2] + Math.sin(tt * 0.21 + fases[i * 4 + 2]) * 0.06
        posicoes.setXYZ(i, x, y, z)
        const d = Math.hypot(x - luz.position.x, y - luz.position.y, z - luz.position.z)
        const perto = clamp01(1 - d / 1.9)
        // O grão gira e pisca ao pegar a luz; reduzido, fica aceso por igual.
        const pisca = reduzirMovimento ? 0.8 : 0.6 + 0.4 * Math.sin(t * 2.1 + fases[i * 4 + 3])
        const b = perto * perto * brilho * pisca * 1.25
        cores.setXYZ(i, b, b * 0.72, b * 0.42)
      }
      posicoes.needsUpdate = true
      cores.needsUpdate = true
    }

    const olho = sentido === 1 ? OLHO_SUBINDO : OLHO_DESCENDO
    const inclinacao = sentido === 1 ? INCLINACAO_SUBINDO : INCLINACAO_DESCENDO

    function atualizar(t: number) {
      const pose = reduzirMovimento ? poseSuave(t, sentido) : poseDoPasso(t, sentido)
      camera.position.set(pose.x, pose.y + olho, pose.z)
      camera.rotation.set(inclinacao, 0, pose.rolagem, 'YXZ')
      // Reduzido, a chama fica parada: tremer luz também é movimento na tela.
      const fogo = reduzirMovimento ? 1 : chamaEm(t)
      luz.color.copy(corDaLuz).multiplyScalar(fogo)
      brilhoNaParede.color.copy(corDaLuz).multiplyScalar(fogo)
      matHalo.opacity = 0.45 * fogo
      chama.scale.set(1, 1 + (fogo - 1) * 2.5, 1)
      halo.quaternion.copy(camera.quaternion)
      atualizarPoeira(t, fogo)
      return { fade: fadeEm(t) }
    }

    function ajustarTela(aspecto: number) {
      camera.aspect = aspecto
      camera.fov = aspecto < 0.8 ? 66 : 50
      camera.updateProjectionMatrix()
    }

    function criarSom(kit: KitDeSom) {
      return somDaEscada(kit, sentido)
    }

    return { scene, camera, atualizar, ajustarTela, criarSom, descartar: () => descartarCena(scene) }
  }
}

// ---------------------------------------------------------------------------
// Som
// ---------------------------------------------------------------------------

/**
 * O "ar" da casa: um ronco grave quase no limite do audível. 0,25 × MIXAGEM dá
 * o mesmo nível de antes (0,35 × 0,6): subir a mixagem não engrossa o fundo.
 */
const AR = 0.25
/** O ar sai 0,4 s antes da cortina: chega ao silêncio antes do motor fechar o som. */
const ANTECIPO_DO_AR = 0.4
/**
 * Ganho da mixagem inteira (passos, eco e ar): põe a escada no volume das
 * transições aprovadas (~-18,6 LUFS integrado, conferido com
 * scripts/conferir-som.cjs) e o pico verdadeiro abaixo de -1 dBTP, sem mexer
 * no equilíbrio entre batida e estalo. Sem rangido (pedido do mestre em
 * 09/10/2026: só passadas), o passo sozinho precisa de mais ganho.
 */
const MIXAGEM = 0.85

/**
 * Pistas do som: um passo na madeira a cada apoio do pé (no mesmo instante em
 * que a câmera assenta) e o ar parado da casa por baixo, que entra e sai com
 * o fade. Tudo disparado pelo tempo da cena, nunca por relógio próprio: o
 * motor escala a duração e o som acompanha.
 */
function somDaEscada(kit: KitDeSom, sentido: Sentido) {
  const { ctx } = kit
  const mixagem = ctx.createGain()
  mixagem.gain.value = MIXAGEM
  mixagem.connect(kit.destino)
  // Vão pequeno de madeira: dois ecos curtos e abafados, sem a cauda longa do salão de pedra.
  const sala = ctx.createGain()
  const ecoA = ctx.createDelay(0.3)
  ecoA.delayTime.value = 0.043
  const ecoB = ctx.createDelay(0.3)
  ecoB.delayTime.value = 0.067
  const abafa = ctx.createBiquadFilter()
  abafa.type = 'lowpass'
  abafa.frequency.value = 1700
  const retorno = ctx.createGain()
  retorno.gain.value = 0.3
  sala.connect(ecoA)
  sala.connect(ecoB)
  ecoA.connect(abafa)
  ecoB.connect(abafa)
  abafa.connect(retorno).connect(ecoA)
  const molhado = ctx.createGain()
  molhado.gain.value = 0.45
  abafa.connect(molhado).connect(mixagem)

  const ar = ctx.createBufferSource()
  ar.buffer = kit.ruido(2)
  ar.loop = true
  const arGrave = ctx.createBiquadFilter()
  arGrave.type = 'lowpass'
  arGrave.frequency.value = 170
  const arVolume = ctx.createGain()
  arVolume.gain.value = 0
  ar.connect(arGrave).connect(arVolume).connect(mixagem)
  let arLigado = false
  let arAlvo = -1

  let ultimo = -1
  return {
    atualizar(t: number) {
      if (!arLigado) {
        ar.start(ctx.currentTime)
        arLigado = true
      }
      const saida = span(t, FADE_SAIDA_INICIO - ANTECIPO_DO_AR, FADE_SAIDA_FIM - ANTECIPO_DO_AR)
      const alvo = Math.round(AR * (1 - Math.max(fadeEm(t), saida)) * 1000) / 1000
      if (alvo !== arAlvo) {
        arAlvo = alvo
        arVolume.gain.setTargetAtTime(alvo, ctx.currentTime, 0.12)
      }
      const w = (t - INICIO_DA_CAMINHADA) / DURACAO_DO_PASSO
      if (w < 0 || w >= PASSOS) return
      const k = Math.floor(w)
      if (k !== ultimo && w - k >= APOIO) {
        ultimo = k
        passoNaMadeira(kit, mixagem, sala, ctx.currentTime, k, sentido)
      }
    },
    reiniciar: () => {
      ultimo = -1
      arAlvo = -1
    },
  }
}

/**
 * Bota em degrau de madeira: só a passada, batida oca (a escada é uma caixa) e
 * o estalo do salto na tábua. Sem rangido: o mestre pediu só passadas. Cada
 * degrau tem a sua semente: a batida muda um pouco de tom de um para o outro.
 */
function passoNaMadeira(kit: KitDeSom, destino: AudioNode, sala: AudioNode, at: number, k: number, sentido: Sentido): void {
  const { ctx } = kit
  const rnd = semente(4099 + k * 7919)
  const noPatamar = k < PASSOS_NO_PATAMAR
  const saida = ctx.createGain()
  // O estalo usa um ruído novo a cada render, e o pico verdadeiro varia até ~2,3 dB entre renders
  // (com 1 / 0,9 batia em -1,9 dBTP descendo e -2,2 subindo). Com 0,85 / 0,8, em 10 renders o
  // pior pico foi -2,5 dBTP: 1,5 dB de folga até o teto de -1. Descendo segue um pouco mais pesado.
  saida.gain.value = noPatamar ? 0.7 : sentido === -1 ? 0.85 : 0.8
  saida.connect(destino)
  saida.connect(sala)

  // Batida oca: grave curto que cai de tom, sem o baque fundo da pedra.
  const oco = ctx.createOscillator()
  oco.type = 'sine'
  oco.frequency.setValueAtTime(150 + rnd() * 25, at)
  oco.frequency.exponentialRampToValueAtTime(78, at + 0.12)
  const ocoVolume = ctx.createGain()
  ocoVolume.gain.setValueAtTime(0.0001, at)
  ocoVolume.gain.exponentialRampToValueAtTime(0.75, at + 0.006)
  ocoVolume.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
  oco.connect(ocoVolume).connect(saida)
  oco.start(at)
  oco.stop(at + 0.34)

  // Salto na tábua: estalo seco em banda média.
  const salto = ctx.createBufferSource()
  salto.buffer = kit.ruido(0.09)
  const saltoFiltro = ctx.createBiquadFilter()
  saltoFiltro.type = 'bandpass'
  saltoFiltro.frequency.value = 1300
  saltoFiltro.Q.value = 1.2
  const saltoVolume = ctx.createGain()
  saltoVolume.gain.setValueAtTime(1.2, at)
  saltoVolume.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
  salto.connect(saltoFiltro).connect(saltoVolume).connect(saida)
  salto.start(at)
}
