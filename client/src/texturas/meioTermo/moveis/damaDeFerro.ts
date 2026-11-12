/**
 * DAMA DE FERRO de cima com volume (lote 14 dos objetos novos, 11/11/2026,
 * grupo Sala de tortura; o mestre pediu "uns equipamentos de tortura"): o
 * armário de ferro em forma de sarcófago, VAZIO, em pé sobre um PLINTO de
 * pedra. O CORPO é de chapas rebitadas e cintado: estreito no pé, BOJUDO no
 * peito, com os OMBROS caindo redondos até o pescoço; em cima, a CABEÇA em
 * cúpula com a MÁSCARA de rosto impassível moldada no ferro. Na frente, duas
 * PORTAS: a da esquerda fechada, com o FERROLHO recolhido e as dobradiças
 * grossas; a da direita ESCANCARADA, aberta além do esquadro, mostrando a face
 * de dentro cheia de ESPIGÕES, e o vão escuro com as fileiras de espigões do
 * fundo.
 *
 * DE CIMA aparecem o plinto, o bojo do corpo, os ombros com a beira
 * rebitada, o alto da cabeça com a argola de içar, os nós das dobradiças e a
 * porta aberta, uma chapa saindo da quina em diagonal com as pontas dos
 * espigões viradas para a frente. A sombra comprida (a do corpo, a da cabeça e
 * a da porta) diz que a peça é alta.
 *
 * NA 3/4 nada é estrutura da 3/4 (`tresQuartos.ts`): o desenho todo é feito na
 * TELA da 3/4, peça a peça, de trás para a frente, cada peça presa a uma ÂNCORA
 * ao sul da pegada (a regra do cutelo e a tela da mesa de corte): o plinto, a
 * porta aberta quando fica atrás, o corpo (o vulto do sólido redondo, fatia a
 * fatia, com a luz pela inclinação: os ombros clareiam, o pé do bojo
 * escurece), as cintas, a cabeça, e na frente as portas, o vão e a máscara.
 * Assim o corpo fica em cima do plinto (uma coluna da 3/4 desceria até o chão)
 * e a cabeça na frente dos ombros (a 3/4 pinta do norte para o sul pela base,
 * e os ombros cobririam a cabeça). As peças da vista de cima só pintam no
 * lugar (`soNoLugar`) e sobem num PINO (um ponto sem tamanho nem tinta),
 * sumindo na 3/4.
 *
 * GIRADA (`c.giro`), a cena só serve à 3/4: o desenho gira a planta (o plinto,
 * o corpo, a cabeça e a porta aberta) e põe na tela, desgirado como na mesa de
 * corte, o que fica à vista daquele lado: as costas com a emenda rebitada, o
 * lado com o vão e a porta aberta na frente, ou o lado com a porta fechada e a
 * porta aberta atrás. A máscara e o ferrolho só aparecem de frente.
 *
 * A 25% de zoom sobram, de cima, o oval de ferro escuro no plinto claro, a
 * chapa da porta em diagonal e a sombra comprida; na 3/4, o vulto alto de
 * ferro com ombros e cabeça, a máscara clara e o vão escuro com as pontas
 * claras. Materiais: `metal` (o ferro) e `pedra` (o plinto). As medidas valem
 * numa casa e escalam com o menor lado da pegada. Escreve `cena.corDoPiso` (o
 * escuro do ferro, como o cofre e o canhão).
 */
import { rgb, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo numa casa) ----------

/** As alturas: o plinto, o pé e o alto das portas, o alto do corpo (o pescoço) e o alto da cabeça. */
const ALTURA_DO_PLINTO = 5.6
const PE_DA_PORTA = 7.6
const TOPO_DA_PORTA = 47
const ALTO_DO_CORPO = 58
const TOPO_DA_CABECA = 78
/** O plinto recua da beira da pegada à esquerda e atrás, e um pouco mais à direita e na frente (por onde a porta aberta passa). */
const RECUO_DO_PLINTO = 3
const RECUO_DO_PLINTO_NA_FRENTE = 7
const RAIO_DO_PLINTO = 1.6
/** O corpo de cima, no mais largo (o peito): o meio e os raios. Fica um pouco à esquerda, para a porta aberta caber na pegada. */
const CORPO = { x: -3.5, y: -3, rx: 19, ry: 14 } as const
/** A cabeça de cima, no mais largo: o meio (y, um pouco para trás) e os raios. */
const CABECA = { y: -4.5, rx: 10, ry: 8.5 } as const
/** O perfil do corpo (fração dos raios por fração da altura): a largura no pé, onde fica o peito, onde os ombros começam a cair, a largura ali e a do pescoço. */
const PE_DO_CORPO = 0.78
const ALTURA_DO_PEITO = 0.62
const ALTURA_DO_OMBRO = 0.84
const LARGURA_NO_OMBRO = 0.96
const LARGURA_DO_PESCOCO = 0.42
/** O perfil da cabeça: o pescoço, o queixo abrindo, o rosto reto e a cúpula. */
const FIM_DO_PESCOCO = 0.12
const ALTURA_DO_QUEIXO = 0.3
const ALTURA_DA_TESTA = 0.62
const PESCOCO_NA_CABECA = 0.72
/** As fatias do vulto de cada sólido (mais na cabeça, que fecha em cúpula). */
const FATIAS_DO_CORPO = 26
const FATIAS_DA_CABECA = 30
/** As portas, de lado na frente (-1 a 1): a linha das dobradiças e a meia fresta. */
const LADO_DA_DOBRADICA = 0.93
const LADO_DA_FRESTA = 0.03
/** O quanto a porta da direita está aberta (radianos, além do esquadro), girando na dobradiça para a frente. */
const ABERTURA = 1.85
/** A grossura da chapa da porta e o comprimento dos espigões. */
const GROSSURA_DA_PORTA = 2.4
const ESPIGAO = 4.6
/** As cintas (o pé de cada uma), a altura delas e os rebites. */
const CINTAS = [14, 36] as const
const ALTURA_DA_CINTA = 2.8
const REBITES_NA_CINTA = 6
const REBITES_NO_OMBRO = 18
/** A fileira de rebites dos ombros: a altura (fração do corpo) e o raio (fração do oval). */
const ALTURA_DOS_REBITES_DO_OMBRO = 0.9
const RAIO_DOS_REBITES_DO_OMBRO = 0.88
/** Os espigões: as fileiras (descendo do alto da porta, com este passo), as colunas do fundo do vão e os lugares ao longo da porta aberta. */
const FILEIRAS_DE_ESPIGOES = 5
const PRIMEIRA_FILEIRA = 5
const PASSO_DAS_FILEIRAS = 7.6
const COLUNAS_DO_FUNDO = 4
const AO_LONGO_DA_PORTA = [0.22, 0.5, 0.78] as const
/** O ferrolho da porta fechada: a altura e de onde a onde vai a barra (px, a partir da fresta). */
const ALTURA_DO_FERROLHO = 27
const BARRA_DO_FERROLHO = { de: 11, ate: 1.4 } as const
/** A máscara: os raios e a altura do meio (fração da cabeça). */
const MASCARA = { rx: 4.8, ry: 5.8, altura: 0.48 } as const
/** Os pontos de cada beira curva da porta aberta. */
const PONTOS_DA_BEIRA = 10
/** Os espigões da porta aberta vistos do alto: as fileiras (o quanto descem do alto da porta, a de baixo primeiro) e quantos por fileira. */
const FILEIRAS_VISTAS_DE_CIMA = [30, 6] as const
const ESPIGOES_VISTOS_DE_CIMA = 5

// ---------- as cores ----------

/** O ferro escuro, em tons do metal escolhido. */
const TOM_DO_FERRO = 0.8
const TOM_DA_PAREDE = 0.92
const TOM_DA_CINTA = 1.04
const TOM_DO_BOJO = 0.74
const TOM_DO_OMBRO = 1
const TOM_DA_BEIRA = 1.02
const TOM_DO_REBITE = 1.34
const TOM_DA_PORTA = 0.9
const TOM_DA_PORTA_ABERTA = 0.8
const LUZ_NA_PORTA_ABERTA = 0.16
const TOM_DA_QUINA = 1.12
const TOM_DA_CABECA = 0.9
const TOM_DO_ALTO_DA_CABECA = 1.04
const TOM_DA_MASCARA = 1.12
const TOM_DO_ESPIGAO = 1.3
const TOM_DA_FACE_DO_PLINTO = 0.74
/** A luz no sólido: o lado da esquerda pega a luz; a inclinação para cima clareia e a para baixo escurece (com estes tetos). */
const SOMBRA_NA_PAREDE = 0.16
const GANHO_DA_INCLINACAO = 0.15
const LUZ_DO_ALTO = 0.3
const SOMBRA_DE_BAIXO = 0.1
/** O vão de dentro: quase preto, um cinza de ferro frio. */
const DENTRO: MaterialDaPeca = { classe: 'liso', rgb: [0x2d, 0x2c, 0x2b] }
/** Os olhos e a boca da máscara e as rachas da pedra: o escuro de dentro. */
const RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x22, 0x21] }
/**
 * O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do cofre e do canhão. Com o piso
 * padrão (a nogueira) o vão e o lado da sombra do ferro saíam marrons.
 */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')
const FERRUGEM: Rgb = rgb('#8c5b45')
const FERRUGEM_CHEIA = 0.62
const BRILHO_DO_FERRO = 0.3

// ---------- as sombras ----------

/** As amostras da sombra varrida na direção da luz. */
const AMOSTRAS_DA_SOMBRA = 10
/** A sombra do vulto (corpo, cabeça e porta) e a do plinto, no chão. */
const SOMBRA_DO_VULTO = { suave: 3.2, forca: 0.24 } as const
const SOMBRA_DO_PLINTO = { suave: 1.1, forca: 0.3 } as const
const CONTATO_DO_PLINTO = 0.34

// ---------- âncoras, pinos e o giro (os da mesa de corte) ----------

const RAIO_DO_PONTO = 1e-6
const LONGE = 1e3
const BORDA_DO_PONTO = 0.05
/** Cada âncora fica isto mais ao sul que a anterior: a 3/4 pinta as peças na ordem em que foram postas. */
const PASSO_DA_ORDEM = 1e-3
const ALEM_DA_PEGADA = 0.5
/** O pino das peças da vista de cima: qualquer altura acima do chão as tira do lugar, e elas somem na 3/4. */
const ALTURA_DO_PINO = 1

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

function girarCaixa(b: Caixa, q: number): Caixa {
  return q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : q === 3 ? [b[1], -b[2], b[3], -b[0]] : b
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const volta = 4 - q
  return {
    b: girarCaixa(f.b, q),
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

function ponto(x: number, y: number): Forma {
  return { b: [x, y, x, y], d: (px, py) => (Math.abs(px - x) < RAIO_DO_PONTO && Math.abs(py - y) < RAIO_DO_PONTO ? -1 : LONGE) }
}

function meioDa(f: Forma): Ponto {
  return [(f.b[0] + f.b[2]) / 2, (f.b[1] + f.b[3]) / 2]
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): o desenho não muda, mas a 3/4 a acha no pino. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero): some quando a 3/4 a sobe, aparece quando a traz de volta. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

type OpcoesDaTela = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaTela) => void
/** Uma peça pronta para pôr (a forma, o material e as opções). */
type Desenho = readonly [Forma, MaterialDaPeca, OpcoesDaTela]

/**
 * A TELA da 3/4: quem desenha nela escreve em coordenadas da tela, com a
 * pegada já girada, de trás para a frente. Cada peça ganha a âncora dela ao sul
 * da pegada, na ordem em que foi posta, e nasce descida a altura da âncora: a
 * 3/4 a sobe de volta e a pinta depois de tudo. Sem giro ela só pinta no lugar
 * (some na vista de cima); girada, a cena só serve à 3/4 e a peça sai
 * desgirada (a forma, o deslocamento, o veio e o ponto que a textura lê), para
 * a volta da 3/4 a pôr como foi desenhada.
 */
function novaTela(c: ContextoDoMovel, cena: Cena, q: number): Por {
  const volta = (4 - q) % 4
  const chao = (q % 2 === 0 ? c.hh : c.hw) + ALEM_DA_PEGADA
  let postas = 0
  return (forma, mat, o = {}) => {
    const [mx, my] = meioDa(forma)
    const base = chao + postas * PASSO_DA_ORDEM
    postas += 1
    const z = base - my
    cena.sombras.push({ forma: girarForma(ponto(mx, base), volta), z, solta: true, forca: 0, suave: BORDA_DO_PONTO })
    if (q === 0) {
      cena.partes.push(c.peca(forma, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
      return
    }
    const [dx, dy] = girarPonto(0, z, volta)
    const textura = o.textura
    cena.partes.push(
      c.peca(girarForma(forma, volta), mat, {
        ...o,
        dx,
        dy,
        eixo: (o.eixo ?? 0) - q * QUARTO,
        textura:
          textura === undefined
            ? undefined
            : (u, v, tx, ty, p, s, escala) => {
                const [sx, sy] = girarPonto(tx, ty, q)
                textura(u, v, sx, sy, p, s, escala)
              },
      }),
    )
  }
}

/** As peças da vista de cima (só sem giro): pintam no lugar e sobem todas num pino no meio da pegada, sumindo na 3/4. */
function novaVistaDeCima(c: ContextoDoMovel, cena: Cena): Por {
  cena.sombras.push({ forma: ponto(0, 0), z: ALTURA_DO_PINO, solta: true, forca: 0, suave: BORDA_DO_PONTO })
  return (forma, mat, o = {}) => {
    cena.partes.push(c.peca(presa(forma, 0, 0), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
}

// ---------- o sólido redondo de pé (o corpo e a cabeça) ----------

/** Um oval de cima: o meio e os raios. */
interface Oval {
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
}

/** Um sólido de pé, redondo em volta do eixo: o oval mais largo (de cima), do pé z0 ao alto z1, o perfil dos raios e as fatias do vulto. */
interface Solido {
  readonly o: Oval
  readonly z0: number
  readonly z1: number
  readonly perfil: (t: number) => number
  readonly fatias: number
}

/** O menor raio de uma fatia (o alto da cúpula não some de todo). */
const RAIO_MINIMO = 0.06

function girarOval(o: Oval, q: number): Oval {
  const [cx, cy] = girarPonto(o.cx, o.cy, q)
  return q % 2 === 1 ? { cx, cy, rx: o.ry, ry: o.rx } : { cx, cy, rx: o.rx, ry: o.ry }
}

function elipseDo(o: Oval, r = 1): Forma {
  return elipse(o.cx, o.cy, o.rx * r, o.ry * r)
}

function raioEm(sol: Solido, z: number): number {
  const t = Math.min(1, Math.max(0, (z - sol.z0) / (sol.z1 - sol.z0)))
  return Math.max(RAIO_MINIMO, sol.perfil(t))
}

/** O ponto da superfície de cima: de lado `s` (-1 a 1, pela frente, da esquerda para a direita) na altura z. */
function naPlanta(sol: Solido, s: number, z: number): Ponto {
  const r = raioEm(sol, z)
  return [sol.o.cx + s * sol.o.rx * r, sol.o.cy + sol.o.ry * r * Math.sqrt(Math.max(0, 1 - s * s))]
}

/** O mesmo ponto na tela da 3/4. */
function naParede(sol: Solido, s: number, z: number): Ponto {
  const [x, y] = naPlanta(sol, s, z)
  return [x, y - z]
}

/** A faixa da parede de s0 a s1 e de z0 a z1, como polígono (as beiras amostradas). */
function faixa(sol: Solido, s0: number, s1: number, z0: number, z1: number): Forma {
  const ao = 10
  const de = 4
  const pts: Ponto[] = []
  for (let i = 0; i <= ao; i += 1) pts.push(naParede(sol, s0 + ((s1 - s0) * i) / ao, z1))
  for (let i = 1; i <= de; i += 1) pts.push(naParede(sol, s1, z1 + ((z0 - z1) * i) / de))
  for (let i = 1; i <= ao; i += 1) pts.push(naParede(sol, s1 + ((s0 - s1) * i) / ao, z0))
  for (let i = 1; i < de; i += 1) pts.push(naParede(sol, s0, z0 + ((z1 - z0) * i) / de))
  return poligono(pts)
}

/** O vulto do sólido na tela da 3/4: os ovais de cada fatia, cada um subido a sua altura. */
function vultoDo(sol: Solido): Forma {
  const cortes = Array.from({ length: sol.fatias + 1 }, (_, i) => {
    const z = sol.z0 + ((sol.z1 - sol.z0) * i) / sol.fatias
    const r = raioEm(sol, z)
    return elipse(sol.o.cx, sol.o.cy - z, sol.o.rx * r, sol.o.ry * r)
  })
  let b0 = Infinity
  let b1 = Infinity
  let b2 = -Infinity
  let b3 = -Infinity
  for (const e of cortes) {
    b0 = Math.min(b0, e.b[0])
    b1 = Math.min(b1, e.b[1])
    b2 = Math.max(b2, e.b[2])
    b3 = Math.max(b3, e.b[3])
  }
  return {
    b: [b0, b1, b2, b3],
    d: (x, y) => {
      let menor = Infinity
      for (const e of cortes) menor = Math.min(menor, e.d(x, y))
      return menor
    },
  }
}

/** O perfil do corpo: estreito no pé, bojudo no peito, e os ombros caindo redondos até o pescoço. */
function perfilDoCorpo(t: number): number {
  if (t <= ALTURA_DO_PEITO) {
    const a = 1 - t / ALTURA_DO_PEITO
    return PE_DO_CORPO + (1 - PE_DO_CORPO) * (1 - a * a)
  }
  if (t <= ALTURA_DO_OMBRO) {
    const a = (t - ALTURA_DO_PEITO) / (ALTURA_DO_OMBRO - ALTURA_DO_PEITO)
    return 1 - (1 - LARGURA_NO_OMBRO) * a * a
  }
  const a = (t - ALTURA_DO_OMBRO) / (1 - ALTURA_DO_OMBRO)
  return LARGURA_DO_PESCOCO + (LARGURA_NO_OMBRO - LARGURA_DO_PESCOCO) * Math.cos((a * Math.PI) / 2)
}

/** O perfil da cabeça: o pescoço, o queixo abrindo, o rosto reto e a cúpula. */
function perfilDaCabeca(t: number): number {
  if (t <= FIM_DO_PESCOCO) return PESCOCO_NA_CABECA
  if (t <= ALTURA_DO_QUEIXO) {
    const a = (t - FIM_DO_PESCOCO) / (ALTURA_DO_QUEIXO - FIM_DO_PESCOCO)
    return PESCOCO_NA_CABECA + (1 - PESCOCO_NA_CABECA) * Math.sin((a * Math.PI) / 2)
  }
  if (t <= ALTURA_DA_TESTA) return 1
  const a = (t - ALTURA_DA_TESTA) / (1 - ALTURA_DA_TESTA)
  return Math.sqrt(Math.max(0, 1 - a * a))
}

/**
 * A sombra no chão de uma coisa que vai da altura z0 à z1 (px) com a forma
 * `f` de cima: a forma arrastada na direção da luz, como o motor faz com as
 * colunas, mas sem virar estrutura da 3/4.
 */
function varridaNaLuz(f: Forma, z0: number, z1: number): Forma {
  const zs = Array.from({ length: AMOSTRAS_DA_SOMBRA + 1 }, (_, i) => z0 + ((z1 - z0) * i) / AMOSTRAS_DA_SOMBRA)
  const b = f.b
  return {
    b: [b[0] + SOMBRA_X * z0, b[1] + SOMBRA_Y * z0, b[2] + SOMBRA_X * z1, b[3] + SOMBRA_Y * z1],
    d: (x, y) => {
      let menor = Infinity
      for (const z of zs) menor = Math.min(menor, f.d(x - SOMBRA_X * z, y - SOMBRA_Y * z))
      return menor
    },
  }
}

/** A forma `f` subida `z` px na tela. */
function subida(f: Forma, z: number): Forma {
  return { b: [f.b[0], f.b[1] - z, f.b[2], f.b[3] - z], d: (x, y) => f.d(x, y + z) }
}

/** A direção da porta (da dobradiça para a ponta solta) e as normais da face de fora e da de dentro. */
function direcoes(a: Ponto, b: Ponto): { u: Ponto; fora: Ponto; dentro: Ponto } {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const l = Math.hypot(ux, uy) || 1
  return { u: [ux / l, uy / l], fora: [uy / l, -ux / l], dentro: [-uy / l, ux / l] }
}

/** O espigão como triângulo: a base de meia largura `meia` ao longo de `base`, em (bx, by), e a ponta na direção `para`. */
function espigao(bx: number, by: number, base: Ponto, meia: number, para: Ponto, l: number): Forma {
  return poligono([[bx - base[0] * meia, by - base[1] * meia], [bx + base[0] * meia, by + base[1] * meia], [bx + para[0] * l, by + para[1] * l]])
}

// ---------- texturas ----------

/** O ferro velho: manchas de ferrugem discretas e o grão do metal (o da cerca de ferro). */
function texFerroVelho(quanto: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const mancha = ruido(x * 0.2 + p.su, y * 0.2 + p.sv) * 1.4 + ruido(x * 0.8 + p.sv, y * 0.8 + p.su) * 0.7
    const q = (mancha + quanto - 0.3) / 0.4
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.1 + ruido(x * 0.7, y * 0.7 + p.sv) * 0.04 - t * 0.05
  }
}

/**
 * A luz no sólido, com o ferro velho: acha a fatia mais alta que cobre o
 * ponto (a que está à vista) e clareia o lado da esquerda e o que se inclina
 * para cima (os ombros, a cúpula); o que se inclina para baixo (o pé do bojo)
 * escurece.
 */
function texDoSolido(sol: Solido, quanto: number): Textura {
  const ferro = texFerroVelho(quanto)
  const { cx, cy, rx, ry } = sol.o
  const passo = (sol.z1 - sol.z0) / sol.fatias
  return (u, v, x, y, p, s, escala) => {
    ferro(u, v, x, y, p, s, escala)
    for (let i = sol.fatias; i >= 0; i -= 1) {
      const z = sol.z0 + passo * i
      const r = raioEm(sol, z)
      const a = (x - cx) / (rx * r)
      const b = (y + z - cy) / (ry * r)
      if (a * a + b * b > 1) continue
      const encolhe = ((raioEm(sol, z - passo) - raioEm(sol, z + passo)) * rx) / (2 * passo)
      s[3] += -a * SOMBRA_NA_PAREDE + Math.max(-SOMBRA_DE_BAIXO, Math.min(LUZ_DO_ALTO, encolhe * GANHO_DA_INCLINACAO))
      return
    }
  }
}

/** O vão de dentro: mais escuro em cima, onde o fundo some, e um pouco mais claro embaixo (entre y0 e y1). */
function texDoVao(y0: number, y1: number): Textura {
  return (_u, _v, x, y, p, s) => {
    s[3] += ((y - y0) / (y1 - y0)) * 0.2 - 0.08 + ruido(x * 0.3 + p.su, y * 0.3) * 0.04
  }
}

/** A pedra do plinto com o grão dela e a beira gasta, um pouco mais clara. */
function texDoPlinto(forma: Forma, pedra: MaterialDaPeca): Textura {
  const grao = texturaDaClasse(pedra.classe)
  return (u, v, x, y, p, s, escala) => {
    if (grao !== null) grao(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < 2.4) s[3] += 0.08 * (1 - Math.max(0, t) / 2.4)
  }
}

// ---------- as medidas do desenho ----------

interface Alturas {
  readonly plinto: number
  readonly pe: number
  readonly porta: number
  readonly corpo: number
  readonly cabeca: number
}

/**
 * A porta aberta, de cima: a metade da frente da casca (de lado `s`, da
 * dobradiça à fresta), girada na dobradiça. Dá o ponto da chapa na altura z e
 * a normal da face de dentro (a côncava, a dos espigões).
 */
interface PortaAberta {
  readonly ponto: (s: number, z: number) => Ponto
  readonly dentro: (s: number, z: number) => Ponto
}

interface Dama {
  readonly k: number
  readonly ferro: MaterialDaPeca
  readonly pedra: MaterialDaPeca
  /** A planta, de cima e sem giro: o plinto, o corpo, a cabeça e a porta aberta. */
  readonly plinto: Caixa
  readonly corpo: Solido
  readonly cabeca: Solido
  readonly porta: PortaAberta
  readonly z: Alturas
}

function escurecido(m: MaterialDaPeca, t: number): MaterialDaPeca {
  return { ...m, rgb: [m.rgb[0] * t, m.rgb[1] * t, m.rgb[2] * t] }
}

/** A porta da direita aberta: a casca gira na dobradiça e a ponta solta (a da fresta) vai para a frente. */
function portaAberta(corpo: Solido): PortaAberta {
  const co = Math.cos(-ABERTURA)
  const si = Math.sin(-ABERTURA)
  const girar = (x: number, y: number): Ponto => [x * co - y * si, x * si + y * co]
  return {
    ponto: (s, z) => {
      const h = naPlanta(corpo, LADO_DA_DOBRADICA, z)
      const p = naPlanta(corpo, s, z)
      const [x, y] = girar(p[0] - h[0], p[1] - h[1])
      return [h[0] + x, h[1] + y]
    },
    dentro: (s, z) => {
      const r = raioEm(corpo, z)
      const nx = -s / (corpo.o.rx * r)
      const ny = -Math.sqrt(Math.max(0, 1 - s * s)) / (corpo.o.ry * r)
      const l = Math.hypot(nx, ny) || 1
      return girar(nx / l, ny / l)
    },
  }
}

/** O lado `s` da casca na fração t da porta aberta (0 na dobradiça, 1 na ponta solta). */
function ladoDaPorta(t: number): number {
  return LADO_DA_DOBRADICA + (LADO_DA_FRESTA - LADO_DA_DOBRADICA) * t
}

/** A beira da porta aberta na altura z, de cima (da dobradiça à ponta solta). */
function beiraDaPorta(p: PortaAberta, z: number): Ponto[] {
  return Array.from({ length: PONTOS_DA_BEIRA + 1 }, (_, i) => p.ponto(ladoDaPorta(i / PONTOS_DA_BEIRA), z))
}

function medir(c: ContextoDoMovel): Dama {
  const k = Math.min(c.w, c.h) / G
  const z: Alturas = { plinto: ALTURA_DO_PLINTO * k, pe: PE_DA_PORTA * k, porta: TOPO_DA_PORTA * k, corpo: ALTO_DO_CORPO * k, cabeca: TOPO_DA_CABECA * k }
  const corpo: Solido = { o: { cx: CORPO.x * k, cy: CORPO.y * k, rx: CORPO.rx * k, ry: CORPO.ry * k }, z0: z.plinto, z1: z.corpo, perfil: perfilDoCorpo, fatias: FATIAS_DO_CORPO }
  const cabeca: Solido = { o: { cx: CORPO.x * k, cy: CABECA.y * k, rx: CABECA.rx * k, ry: CABECA.ry * k }, z0: z.corpo, z1: z.cabeca, perfil: perfilDaCabeca, fatias: FATIAS_DA_CABECA }
  return {
    k,
    ferro: escurecido(c.m.metal, TOM_DO_FERRO),
    pedra: c.m.pedra,
    plinto: [-c.hw + RECUO_DO_PLINTO * k, -c.hh + RECUO_DO_PLINTO * k, c.hw - RECUO_DO_PLINTO_NA_FRENTE * k, c.hh - RECUO_DO_PLINTO_NA_FRENTE * k],
    corpo,
    cabeca,
    porta: portaAberta(corpo),
    z,
  }
}

/** A dama vista com o giro: a planta girada (na tela da 3/4, o sul é o lado de quem olha). */
interface Vista {
  readonly q: number
  readonly plinto: Caixa
  readonly corpo: Solido
  readonly cabeca: Solido
  readonly porta: PortaAberta
}

function ver(d: Dama, q: number): Vista {
  const g = (p: Ponto): Ponto => girarPonto(p[0], p[1], q)
  return {
    q,
    plinto: girarCaixa(d.plinto, q),
    corpo: { ...d.corpo, o: girarOval(d.corpo.o, q) },
    cabeca: { ...d.cabeca, o: girarOval(d.cabeca.o, q) },
    porta: { ponto: (s, z) => g(d.porta.ponto(s, z)), dentro: (s, z) => g(d.porta.dentro(s, z)) },
  }
}

function doFerro(semente: number, tom: number, quanto = -0.1): OpcoesDaTela {
  return { tabua: 0, metal: BRILHO_DO_FERRO, tom, textura: texFerroVelho(quanto + 0.06 * Math.sin(semente * 1.9)), semente }
}

/** O rebite: a cabeça clara e redonda. */
function rebite(d: Dama, p: Ponto, tom = TOM_DO_REBITE): Desenho {
  const r = 0.72 * d.k
  return [elipse(p[0], p[1], r, r), d.ferro, { bisel: 0.6, contorno: 0.2, metal: 0.42, tom }]
}

/** As lascas das duas quinas da frente e duas rachas finas, na planta sem giro. */
function detalhesDoPlinto(d: Dama): Desenho[] {
  const { k } = d
  const [x0, y0, x1, y1] = d.plinto
  const largura = x1 - x0
  const lasca = (x: number, s: number, semente: number): Desenho => [
    poligono([[x, y1 - 4.2 * k], [x + s * 3.4 * k, y1], [x, y1]]),
    d.pedra,
    { tabua: 0, bisel: 0.6, tom: 0.7, contorno: 0.2, semente },
  ]
  return [
    lasca(x0, 1, 12),
    lasca(x1, -1, 13),
    [capsula(x0 + largura * 0.19, y1 - 1.2 * k, x0 + largura * 0.25, y1 - 5 * k, 0.32 * k), RISCO, { bisel: 0, contorno: 0, alfa: 0.55 }],
    [capsula(x1 - largura * 0.1, y0 + 4 * k, x1 - largura * 0.06, y0 + 9 * k, 0.3 * k), RISCO, { bisel: 0, contorno: 0, alfa: 0.5 }],
  ]
}

// ---------- as sombras ----------

/** As sombras no chão, feitas na planta girada e desgiradas para a volta da 3/4. */
function montarSombras(d: Dama, v: Vista, cena: Cena): void {
  const volta = (4 - v.q) % 4
  const [x0, y0, x1, y1] = v.plinto
  const plinto = caixa(x0, y0, x1, y1, RAIO_DO_PLINTO * d.k)
  const porta = cadeia(beiraDaPorta(v.porta, (d.z.pe + d.z.porta) / 2), (GROSSURA_DA_PORTA * d.k) / 2)
  const corpo = varridaNaLuz(elipseDo(v.corpo.o), d.z.plinto, d.z.corpo)
  const cabeca = varridaNaLuz(elipseDo(v.cabeca.o), d.z.corpo, d.z.cabeca)
  const vulto = uniao(uniao(corpo, cabeca), varridaNaLuz(porta, d.z.pe, d.z.porta))
  cena.sombras.push(
    contato(girarForma(plinto, volta), CONTATO_DO_PLINTO),
    { forma: girarForma(varridaNaLuz(plinto, 0, d.z.plinto), volta), z: 0, ...SOMBRA_DO_PLINTO },
    { forma: girarForma(vulto, volta), z: 0, ...SOMBRA_DO_VULTO },
  )
}

// ---------- a vista de cima ----------

/** O plinto de cima (ou subido na 3/4), com as lascas e as rachas. */
function montarTampoDoPlinto(d: Dama, plinto: Caixa, por: Por, q: number, z: number): void {
  const [x0, y0, x1, y1] = plinto
  const tampo = subida(caixa(x0, y0, x1, y1, RAIO_DO_PLINTO * d.k), z)
  por(tampo, d.pedra, { tabua: 0, bisel: 1.8, contorno: 0.26, textura: texDoPlinto(tampo, d.pedra), semente: 10 })
  for (const [forma, mat, o] of detalhesDoPlinto(d)) por(subida(girarForma(forma, q), z), mat, o)
}

function montarDeCima(d: Dama, c: ContextoDoMovel, cena: Cena): void {
  const por = novaVistaDeCima(c, cena)
  const { k, ferro } = d
  montarTampoDoPlinto(d, d.plinto, por, 0, 0)
  // A porta aberta, mais baixa que os ombros: os espigões do lado côncavo, uma franja de pontas claras (a
  // fileira de baixo fica mais para dentro, porque a porta afina para o pé), e a beira curva da chapa.
  const zA = d.z.porta
  FILEIRAS_VISTAS_DE_CIMA.forEach((desce, fila) => {
    const z = zA - desce * k
    for (let j = 0; j < ESPIGOES_VISTOS_DE_CIMA; j += 1) {
      const s = ladoDaPorta((j + 0.5 + fila * 0.5) / (ESPIGOES_VISTOS_DE_CIMA + 0.5))
      const [bx, by] = d.porta.ponto(s, z)
      const para = d.porta.dentro(s, z)
      por(espigao(bx, by, [-para[1], para[0]], 1.1 * k, para, ESPIGAO * k), ferro, { bisel: 0.5, contorno: 0.26, ...doFerro(40 + fila * 8 + j, TOM_DO_ESPIGAO, -0.2) })
    }
  })
  por(cadeia(beiraDaPorta(d.porta, zA), (GROSSURA_DA_PORTA * k) / 2), ferro, { bisel: 0.9, contorno: 0.32, ...doFerro(45, 1.08) })
  // O corpo: o bojo (a beira que passa dos ombros), os ombros com a beira rebitada e os nós das dobradiças.
  const o = d.corpo.o
  por(elipseDo(o), ferro, { bisel: 1.4 * k, contorno: 0.32, ...doFerro(19, TOM_DO_BOJO) })
  por(elipseDo(o, LARGURA_NO_OMBRO), ferro, { bisel: 3.2 * k, contorno: 0.24, ...doFerro(20, TOM_DO_OMBRO) })
  por(anel(o.cx, o.cy, o.rx * 0.93, o.ry * 0.93, o.rx * 0.82, o.ry * 0.82), ferro, { bisel: 0.9, contorno: 0.16, ...doFerro(21, TOM_DA_BEIRA) })
  for (let i = 0; i < REBITES_NO_OMBRO; i += 1) {
    const a = (i / REBITES_NO_OMBRO) * Math.PI * 2
    por(...rebite(d, [o.cx + Math.cos(a) * o.rx * RAIO_DOS_REBITES_DO_OMBRO, o.cy + Math.sin(a) * o.ry * RAIO_DOS_REBITES_DO_OMBRO]))
  }
  for (const s of [-LADO_DA_DOBRADICA, LADO_DA_DOBRADICA]) {
    const [x, y] = naPlanta(d.corpo, s, d.z.porta)
    por(elipse(x, y, 1.6 * k, 1.6 * k), ferro, { bisel: 1, contorno: 0.3, ...doFerro(24 + s, 1.12) })
  }
  // A cabeça: a cúpula e a argola de içar.
  const oc = d.cabeca.o
  por(elipseDo(oc), ferro, { bisel: 3.6 * k, contorno: 0.32, ...doFerro(30, TOM_DO_ALTO_DA_CABECA) })
  // O nariz e a testa da máscara, a única coisa do rosto que passa da cúpula vista do alto.
  por(elipse(oc.cx, oc.cy + oc.ry * 0.9, 2.6 * k, 1.3 * k), ferro, { bisel: 0.9, contorno: 0.22, ...doFerro(31, TOM_DA_MASCARA * 1.08, -0.3) })
  por(anel(oc.cx, oc.cy - 0.4 * k, 2.3 * k, 2.3 * k, 1.2 * k, 1.2 * k), ferro, { bisel: 0.8, contorno: 0.3, ...doFerro(32, 1.3) })
}

// ---------- a 3/4, de trás para a frente ----------

/** O plinto: o tampo de pedra subido, as lascas e as rachas, e a face da frente. */
function montarPlinto(d: Dama, v: Vista, por: Por): void {
  const zP = d.z.plinto
  const [x0, , x1, y1] = v.plinto
  montarTampoDoPlinto(d, v.plinto, por, v.q, zP)
  por(caixa(x0, y1 - zP, x1, y1, 0.8 * d.k), d.pedra, { tabua: 0, bisel: 0.9, tom: TOM_DA_FACE_DO_PLINTO, contorno: 0.26, semente: 51 })
}

/** O corpo sobre o plinto: o vulto, as cintas rebitadas em volta, a emenda das costas e os rebites dos ombros. */
function montarCorpo(d: Dama, v: Vista, por: Por): void {
  const { k, ferro } = d
  const sol = v.corpo
  por(vultoDo(sol), ferro, { bisel: 1.6 * k, contorno: 0.32, ...doFerro(10, TOM_DA_PAREDE), textura: texDoSolido(sol, -0.1) })
  CINTAS.forEach((z0, i) => {
    const z = z0 * k
    const h = ALTURA_DA_CINTA * k
    por(faixa(sol, -1, 1, z, z + h), ferro, { bisel: 0.7, contorno: 0.28, ...doFerro(11 + i, TOM_DA_CINTA), textura: texDoSolido(sol, -0.14) })
    for (let j = 0; j < REBITES_NA_CINTA; j += 1) por(...rebite(d, naParede(sol, -0.85 + (1.7 * j) / (REBITES_NA_CINTA - 1), z + h / 2)))
  })
  if (v.q === 2) {
    // As costas: a emenda das chapas, de alto a baixo, com os rebites.
    const [xa, ya] = naParede(sol, 0, d.z.plinto + 2 * k)
    const [xb, yb] = naParede(sol, 0, d.z.porta)
    por(capsula(xa, ya, xb, yb, 0.5 * k), ferro, { bisel: 0.4, contorno: 0.2, ...doFerro(15, 0.7) })
    for (let z = d.z.plinto + 5 * k; z < d.z.porta; z += 6.5 * k) por(...rebite(d, naParede(sol, 0, z), TOM_DO_REBITE * 0.95))
  }
  // Os rebites dos ombros, na metade da frente (a de trás fica atrás da cabeça e do caimento).
  const zR = sol.z0 + (sol.z1 - sol.z0) * ALTURA_DOS_REBITES_DO_OMBRO
  const r = raioEm(sol, zR) * RAIO_DOS_REBITES_DO_OMBRO
  for (let i = 0; i < REBITES_NO_OMBRO; i += 1) {
    const a = (i / REBITES_NO_OMBRO) * Math.PI * 2
    if (Math.sin(a) < -0.2) continue
    por(...rebite(d, [sol.o.cx + Math.cos(a) * sol.o.rx * r, sol.o.cy + Math.sin(a) * sol.o.ry * r - zR]))
  }
}

/** A cabeça sobre o pescoço: o vulto em cúpula e a argola de içar no alto. */
function montarCabeca(d: Dama, v: Vista, por: Por): void {
  const { k, ferro } = d
  const sol = v.cabeca
  por(vultoDo(sol), ferro, { bisel: 1.4 * k, contorno: 0.32, ...doFerro(140, TOM_DA_CABECA), textura: texDoSolido(sol, -0.16) })
  por(subida(anel(sol.o.cx, sol.o.cy, 2.3 * k, 2.3 * k, 1.2 * k, 1.2 * k), sol.z1 - 0.6 * k), ferro, { bisel: 0.8, contorno: 0.3, ...doFerro(143, 1.3) })
}

/** O nó da dobradiça na parede: a tala de pé que abraça a cinta. */
function dobradicaNaParede(d: Dama, sol: Solido, s: number, z: number): Forma {
  const [xa, ya] = naParede(sol, s, z - 1.4 * d.k)
  const [xb, yb] = naParede(sol, s, z + 4.2 * d.k)
  return capsula(xa, ya, xb, yb, 1.35 * d.k)
}

/** A porta fechada (dobradiça à esquerda, fresta à direita, em `s`): a chapa, as cintas rebitadas, as dobradiças e, de frente, o ferrolho. */
function montarPortaFechada(d: Dama, v: Vista, por: Por, sDob: number, sFresta: number, deFrente: boolean): void {
  const { k, ferro } = d
  const sol = v.corpo
  const { pe, porta } = d.z
  por(faixa(sol, sDob, sFresta, pe, porta), ferro, { bisel: 1.2 * k, contorno: 0.3, ...doFerro(60, TOM_DA_PORTA), textura: texDoSolido(sol, -0.12) })
  CINTAS.forEach((z0, i) => {
    const z = z0 * k
    const h = ALTURA_DA_CINTA * k
    por(faixa(sol, sDob, sFresta, z, z + h), ferro, { bisel: 0.7, contorno: 0.3, ...doFerro(61 + i, TOM_DA_CINTA), textura: texDoSolido(sol, -0.14) })
    for (let j = 0; j < 4; j += 1) por(...rebite(d, naParede(sol, sDob + ((sFresta - sDob) * (j + 0.5)) / 4, z + h / 2)))
    por(dobradicaNaParede(d, sol, sDob, z), ferro, { bisel: 1, contorno: 0.32, ...doFerro(65 + i, 1.16) })
  })
  if (!deFrente) return
  // O ferrolho recolhido: os dois grampos e a barra com a maçaneta, perto da fresta.
  const zF = ALTURA_DO_FERROLHO * k
  const largura = sol.o.rx * raioEm(sol, zF)
  const sa = sFresta - (BARRA_DO_FERROLHO.de * k) / largura
  const sb = sFresta - (BARRA_DO_FERROLHO.ate * k) / largura
  const g = (1.1 * k) / largura
  for (const s of [sa + (2.2 * k) / largura, sb - (1.6 * k) / largura]) por(faixa(sol, s - g, s + g, zF - 1.9 * k, zF + 1.9 * k), ferro, { bisel: 0.6, contorno: 0.3, ...doFerro(68, 0.92) })
  const [xa, ya] = naParede(sol, sa, zF)
  const [xb, yb] = naParede(sol, sb, zF)
  por(capsula(xa, ya, xb, yb, 0.95 * k), ferro, { bisel: 0.8, contorno: 0.32, ...doFerro(69, 1.22) })
  const [xm, ym] = naParede(sol, sa + (4.4 * k) / largura, zF - 2 * k)
  por(elipse(xm, ym, 1.1 * k, 1.5 * k), ferro, { bisel: 0.8, contorno: 0.3, ...doFerro(70, 1.26) })
}

/** O vão da porta aberta (fresta à esquerda, dobradiça à direita, em `s`): o escuro de dentro; de frente, os espigões do fundo e a quina da porta fechada; e as dobradiças. */
function montarVao(d: Dama, v: Vista, por: Por, sFresta: number, sDob: number, deFrente: boolean): void {
  const { k, ferro } = d
  const sol = v.corpo
  const { pe, porta } = d.z
  const vao = faixa(sol, sFresta, sDob, pe, porta)
  por(vao, DENTRO, { bisel: 0.6, contorno: 0.34, recesso: { k: 2.6, forca: 0.4 }, textura: texDoVao(vao.b[1], vao.b[3]), semente: 80 })
  if (deFrente) {
    // Os espigões do fundo apontam para quem olha: na tela, as pontas descem.
    const l = ESPIGAO * k * 0.8
    for (let fila = 0; fila < FILEIRAS_DE_ESPIGOES; fila += 1) {
      for (let col = 0; col < COLUNAS_DO_FUNDO; col += 1) {
        const s = sFresta + ((sDob - sFresta) * (col + 0.45 + (fila % 2) * 0.3)) / COLUNAS_DO_FUNDO
        const [x, y] = naParede(sol, s, porta - (PRIMEIRA_FILEIRA + fila * PASSO_DAS_FILEIRAS) * k)
        por(poligono([[x - k, y], [x + k, y], [x, y + l]]), ferro, { bisel: 0.5, contorno: 0.22, ...doFerro(81 + fila * COLUNAS_DO_FUNDO + col, TOM_DO_ESPIGAO, -0.2) })
      }
    }
    // A grossura da porta fechada, na beira do vão.
    por(faixa(sol, sFresta - 2 * LADO_DA_FRESTA, sFresta + 0.05, pe, porta), ferro, { bisel: 0.4, contorno: 0.2, ...doFerro(98, TOM_DA_QUINA) })
  }
  CINTAS.forEach((z0, i) => por(dobradicaNaParede(d, sol, sDob, z0 * k), ferro, { bisel: 1, contorno: 0.32, ...doFerro(99 + i, 1.1) }))
}

/**
 * O que a frente do corpo mostra daquele lado: de frente as duas portas e o
 * vão; de um lado o vão, do outro a porta fechada (o lado `s` da frente vai
 * para a frente de quem olha como a raiz de 1 - s²); de costas, nada.
 */
function montarFrente(d: Dama, v: Vista, por: Por): void {
  const deLado = (s: number): number => Math.sqrt(1 - s * s)
  if (v.q === 0) {
    montarPortaFechada(d, v, por, -LADO_DA_DOBRADICA, -LADO_DA_FRESTA, true)
    montarVao(d, v, por, LADO_DA_FRESTA, LADO_DA_DOBRADICA, true)
  } else if (v.q === 1) {
    montarVao(d, v, por, -deLado(LADO_DA_FRESTA), -deLado(LADO_DA_DOBRADICA), false)
  } else if (v.q === 3) {
    montarPortaFechada(d, v, por, deLado(LADO_DA_DOBRADICA), deLado(LADO_DA_FRESTA), false)
  }
}

/**
 * A porta aberta, a casca curva de pé entre a dobradiça e a ponta solta (mais
 * estreita no pé, como o corpo). Com a face de dentro à vista (de frente e de
 * um lado): a chapa côncava e os espigões dela, apontando para quem olha. Com
 * a de fora: a chapa e as cintas rebitadas. A quina da ponta solta quando vira
 * para quem olha e, por último, a beira de cima.
 */
function montarPortaAberta(d: Dama, v: Vista, por: Por): void {
  const { k, ferro } = d
  const p = v.porta
  const { pe, porta } = d.z
  const naTela = (t: number, z: number): Ponto => {
    const [x, y] = p.ponto(ladoDaPorta(t), z)
    return [x, y - z]
  }
  const chapa = (z0: number, z1: number): Forma => {
    const pts: Ponto[] = []
    for (let i = 0; i <= PONTOS_DA_BEIRA; i += 1) pts.push(naTela(i / PONTOS_DA_BEIRA, z1))
    for (let i = PONTOS_DA_BEIRA; i >= 0; i -= 1) pts.push(naTela(i / PONTOS_DA_BEIRA, z0))
    return poligono(pts)
  }
  const meio = p.dentro(ladoDaPorta(0.5), (pe + porta) / 2)
  const deDentro = meio[1] > 0
  const face = deDentro ? meio : ([-meio[0], -meio[1]] as const)
  por(chapa(pe, porta), ferro, { bisel: 0.8, contorno: 0.32, ...doFerro(120, TOM_DA_PORTA_ABERTA - LUZ_NA_PORTA_ABERTA * face[0]) })
  if (deDentro) {
    const l = ESPIGAO * k * 0.85
    for (let fila = 0; fila < FILEIRAS_DE_ESPIGOES; fila += 1) {
      const z = porta - (PRIMEIRA_FILEIRA + fila * PASSO_DAS_FILEIRAS) * k
      AO_LONGO_DA_PORTA.forEach((t0, j) => {
        const t = t0 + (fila % 2) * 0.08
        const [bx, by] = naTela(t, z)
        por(espigao(bx, by, [1, 0], k, p.dentro(ladoDaPorta(t), z), l), ferro, { bisel: 0.5, contorno: 0.22, ...doFerro(130 + fila * 3 + j, TOM_DO_ESPIGAO, -0.2) })
      })
    }
  } else {
    CINTAS.forEach((z0, i) => {
      const z = z0 * k
      const h = ALTURA_DA_CINTA * k
      por(chapa(z, z + h), ferro, { bisel: 0.5, contorno: 0.3, ...doFerro(121 + i, TOM_DA_PORTA_ABERTA * 1.25) })
      for (const t of [0.3, 0.75]) por(...rebite(d, naTela(t, z + h / 2), TOM_DO_REBITE * 0.9))
    })
  }
  const zMeio = (pe + porta) / 2
  const { u } = direcoes(p.ponto(ladoDaPorta(0.9), zMeio), p.ponto(ladoDaPorta(1), zMeio))
  if (u[1] > 0) {
    // A quina da chapa na ponta solta: a grossura, de pé, virada para quem olha.
    const g = (GROSSURA_DA_PORTA * k) / 2
    const [nx, ny] = p.dentro(LADO_DA_FRESTA, zMeio)
    const [ax, ay] = naTela(1, porta)
    const [bx, by] = naTela(1, pe)
    por(poligono([[ax - nx * g, ay - ny * g], [ax + nx * g, ay + ny * g], [bx + nx * g, by + ny * g], [bx - nx * g, by - ny * g]]), ferro, { bisel: 0.3, contorno: 0.2, ...doFerro(125, TOM_DA_QUINA) })
  }
  por(subida(cadeia(beiraDaPorta(p, porta), (GROSSURA_DA_PORTA * k) / 2), porta), ferro, { bisel: 0.6, contorno: 0.3, ...doFerro(126, 1.18) })
}

/** A máscara de rosto impassível na frente da cabeça: o oval em relevo, a testa, os olhos semicerrados, o nariz reto e a boca fechada. */
function montarMascara(d: Dama, v: Vista, por: Por): void {
  const { k, ferro } = d
  const sol = v.cabeca
  const [cx, cy] = naParede(sol, 0, sol.z0 + (sol.z1 - sol.z0) * MASCARA.altura)
  por(elipse(cx, cy, MASCARA.rx * k, MASCARA.ry * k), ferro, { bisel: 1.8 * k, contorno: 0.26, ...doFerro(150, TOM_DA_MASCARA, -0.25) })
  por(capsula(cx - 3.4 * k, cy - 2.6 * k, cx + 3.4 * k, cy - 2.6 * k, 0.6 * k), ferro, { bisel: 0.5, contorno: 0.14, ...doFerro(151, TOM_DA_MASCARA * 1.12, -0.3) })
  for (const s of [-1, 1]) por(capsula(cx + s * 1 * k, cy - 1.4 * k, cx + s * 2.8 * k, cy - 1.55 * k, 0.4 * k), RISCO, { bisel: 0.3, contorno: 0.1 })
  por(capsula(cx, cy - 1.8 * k, cx + 0.15 * k, cy + 1.2 * k, 0.7 * k), ferro, { bisel: 0.7, contorno: 0.18, ...doFerro(152, TOM_DA_MASCARA * 1.16, -0.3) })
  por(capsula(cx - 1.5 * k, cy + 3.2 * k, cx + 1.5 * k, cy + 3.2 * k, 0.36 * k), RISCO, { bisel: 0.2, contorno: 0.1 })
}

function montarNaTela(d: Dama, v: Vista, por: Por): void {
  const portaNaFrente = v.porta.ponto(ladoDaPorta(0.5), d.z.porta)[1] > v.corpo.o.cy
  montarPlinto(d, v, por)
  if (!portaNaFrente) montarPortaAberta(d, v, por)
  montarCorpo(d, v, por)
  montarCabeca(d, v, por)
  montarFrente(d, v, por)
  if (portaNaFrente) montarPortaAberta(d, v, por)
  if (v.q === 0) montarMascara(d, v, por)
}

export const montarDamaDeFerro: MontarMovel = (c, cena) => {
  const d = medir(c)
  const q = quartosDoGiro(c.giro)
  const v = ver(d, q)
  cena.corDoPiso = ESCURO_DO_FERRO
  montarSombras(d, v, cena)
  if (q === 0) montarDeCima(d, c, cena)
  montarNaTela(d, v, novaTela(c, cena, q))
}
