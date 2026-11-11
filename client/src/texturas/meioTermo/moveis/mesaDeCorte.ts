/**
 * MESA DE CORTE de cima com volume (lote 5 dos objetos novos, 11/11/2026): a
 * mesa do açougueiro e da cozinha. De cima aparece o TAMPO GROSSO de madeira
 * clara, em sarrafos colados, todo MARCADO DE FACA (os cortes cruzados, mais
 * juntos no meio, onde a madeira afundou e clareou de tanto uso) e, em cima
 * dele, o serviço: o CUTELO CRAVADO na madeira (do alto, a lâmina quase de fio
 * e o cabo no ar), o PEIXE inteiro esperando a faca, a FACA largada, a CENOURA
 * cortada em rodelas, as duas metades da CEBOLA, o cheiro-verde picado e o
 * PANO de prato caído na quina da frente. Sem sangue: o peixe está inteiro e o
 * que mancha a madeira é caldo de legume.
 *
 * NA 3/4 é uma mesa pesada: o tampo sobe com tudo o que está em cima dele,
 * com a beirada grossa do bloco (a espessura que o perfil do tipo traz), e as
 * quatro pernas vão do chão até ele. O pano passa um pouco da quina e cai por
 * cima da beirada. O CUTELO aparece DE PÉ, cravado: a lâmina é uma chapa em pé
 * na direção em que foi cravada, com o dorso em cima e o cabo para o alto.
 *
 * COMO O CUTELO TROCA DE DESENHO. A 3/4 não redesenha o móvel: sobe cada peça
 * da vista de cima a altura da estrutura em que ela está, mexendo no `dy` dela
 * (`tresQuartos.ts`). O cutelo usa as duas regras da prateleira de potes e do
 * gancho com carne: a peça DE UMA VISTA SÓ só é pintada no lugar em que foi
 * desenhada, com `dy` zero (`soNoLugar`: o cutelo visto do alto some quando o
 * tampo o sobe, e o de pé nasce deslocado e aparece quando a 3/4 o sobe de
 * volta), e o de pé tem uma ÂNCORA (`ancorar`), a estrutura de um ponto só que
 * diz à 3/4 a altura e a ordem dele. Com o objeto girado a cena só serve à 3/4:
 * o desenho lê `c.giro`, não põe o cutelo visto do alto e desenha o de pé já
 * na direção girada. Todo o resto da mesa a 3/4 deriva e gira sozinha.
 *
 * A 25% de zoom sobram o bloco claro com a beirada grossa, o risco prateado do
 * peixe, o ponto branco do pano e o laranja da cenoura: é o que diz "mesa de
 * cozinha" e não "bancada de oficina" (escura, de ferro). Material: `madeira`
 * (o pinho, de partida: é a madeira clara do pedido); o aço, os cabos, o peixe,
 * os legumes e o pano são fixos. As coisas têm o tamanho do menor lado
 * (1,5 x 1 casas de partida) e os lugares são frações da pegada: a mesa
 * esticada ganha tampo, não um peixe maior.
 */
import { hash, rgb } from '../../ruido'
import { oklabDoRgb, tomDoMeio } from '../materiais'
import { anel, caixa, capsula, dentroDe, elipse, elipseGirada, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { BURACO, G, LENCOL, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A pegada de partida, em casas: as coisas em cima do tampo têm o tamanho de desenho nela. */
const FUNDO_DE_PARTIDA = 1
const LARGURA_DE_PARTIDA = 1.5
/** A altura do tampo, em casas (a do balcão e da bancada). */
const ALTURA_DO_TAMPO = 0.62
/**
 * A grossura do bloco na 3/4 (px do protótipo): a beirada que o perfil do tipo
 * tem de trazer (`{ modo: 'derivado', espessura: ESPESSURA_DO_TAMPO_DA_MESA_DE_CORTE }`).
 * Com a padrão (0,06 casa) o tampo sai fino como o de uma mesa de jantar.
 */
export const ESPESSURA_DO_TAMPO_DA_MESA_DE_CORTE = 0.15 * G

/** O tampo recua isto da pegada; a quina dele e a largura de cada sarrafo (px do protótipo, no menor lado). */
const FOLGA_DO_TAMPO = 0.8
const QUINA_DO_TAMPO = 1.8
const SARRAFO = 7.6
/** A perna (o lado dela) e o quanto fica para dentro da beira do tampo. */
const PERNA = 7.6
const RECUO_DA_PERNA = 2
/**
 * A quina da perna, em fração do lado: chanfrada o bastante para a 3/4 ler a
 * perna como redonda e correr o veio de pé (`ehRedonda` em `tresQuartos.ts`).
 */
const QUINA_DA_PERNA = 0.32

/** O aço das lâminas, o ferro escuro do dorso do cutelo e o latão dos rebites. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xb4, 0xba, 0xbe] }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.95)) }
const LATAO = materialDaPeca('latao')
/** O corte velho, que escureceu, e o corte novo, na madeira clara de dentro. */
const CORTE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x38, 0x28] }
const CORTE_NOVO: MaterialDaPeca = { classe: 'liso', rgb: [0xea, 0xd8, 0xb0] }
/** A mancha de caldo de legume na madeira. */
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x4c, 0x34] }
/** O peixe: o lombo cinza-azulado (a barriga clara sai da textura), a barbatana e o olho. */
const PEIXE: MaterialDaPeca = { classe: 'liso', rgb: [0x98, 0xa4, 0xa8] }
const BARBATANA: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x86, 0x8a] }
const OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0x38, 0x36, 0x34] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf0, 0xf2, 0xee] }
/** A cenoura e o miolo dela, a cebola (a casca e a polpa) e os dois verdes do cheiro-verde. */
const CENOURA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0x8a, 0x58] }
const MIOLO_DA_CENOURA: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xa8, 0x72] }
const CASCA_DA_CEBOLA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x8e, 0x66] }
const CEBOLA: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xdc, 0xc8] }
const VERDES: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x74, 0x8a, 0x58] },
  { classe: 'liso', rgb: [0x90, 0x9e, 0x6a] },
]
/** A listra do pano de prato: um azul desbotado. */
const LISTRA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x8c, 0x9c, 0xa8] }
/** A sombra do cutelo no tampo: escura, meio transparente, de borda macia. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }

/** A luz (OKLab L) a partir da qual a madeira do tampo é clara: os cabos ficam com a madeira do outro lado. */
const L_DA_MADEIRA_CLARA = 0.62

/** A quina do tampo, gasta de mão, pega luz: a largura da faixa (px do protótipo) e a luz somada. */
const LARGURA_DA_QUINA_GASTA = 2.8
const LUZ_DA_QUINA_GASTA = 0.15
/** O meio do tampo, afundado e clareado de tanto corte: a luz somada no miolo da bacia. */
const LUZ_DA_BACIA = 0.1

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A madeira dos cabos: escura no tampo claro, clara no tampo escuro, para a faca não sumir na mesa. */
function madeiraDoCabo(tampo: MaterialDaPeca): MaterialDaPeca {
  const [L] = oklabDoRgb(tampo.rgb[0], tampo.rgb[1], tampo.rgb[2])
  return materialDaPeca(L >= L_DA_MADEIRA_CLARA ? 'nogueira' : 'pinho')
}

/** O veio dos sarrafos com a quina gasta, a bacia clara do meio (raios `rx`, `ry`) e as manchas largas do uso, sem listra. */
function texDoTampo(forma: Forma, rx: number, ry: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < LARGURA_DA_QUINA_GASTA) s[3] += LUZ_DA_QUINA_GASTA * (1 - (t > 0 ? t : 0) / LARGURA_DA_QUINA_GASTA)
    const d = Math.hypot(x / rx, y / ry)
    s[3] += LUZ_DA_BACIA * (1 - limitar(d, 0, 1)) + ruido(x * 0.07 + p.su, y * 0.1 + p.sv) * 0.1 - 0.03
  }
}

/** O peixe: o lombo escuro e a barriga clara (de través, a partir do meio em (cx, cy), no giro `ang`) e as escamas em fileiras. */
function texDoPeixe(cx: number, cy: number, ang: number, meiaAltura: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (_u, _v, x, y, _p, s) => {
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = (-(x - cx) * si + (y - cy) * co) / meiaAltura
    s[3] += limitar(atraves, -1, 1) * 0.2 + 0.03
    const fileira = Math.floor((atraves + 1) * 3.2)
    const fase = ao / 1.9 + (fileira & 1) * 0.5
    const f = fase - Math.floor(fase)
    if (f < 0.22) s[3] -= 0.09 * (1 - f / 0.22)
  }
}

/** As camadas da cebola cortada, em anéis em volta de (cx, cy). */
function texDeCebola(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[3] += Math.sin(Math.hypot(x - cx, y - cy) * 3.6) * 0.1
  }
}

/** A casca da cenoura: os anéis de través. */
const texDeCenoura: Textura = (u, _v, _x, _y, _p, s) => {
  s[3] += Math.sin(u * 2.3) * 0.05
}

/** Leva os pontos de uma coisa desenhada deitada (x ao comprido, a partir da origem dela) para o lugar no tampo. */
function noLugar(origem: Ponto, angulo: number, escala: number): (p: Ponto) => Ponto {
  const co = Math.cos(angulo) * escala
  const si = Math.sin(angulo) * escala
  return ([x, y]) => [origem[0] + x * co - y * si, origem[1] + x * si + y * co]
}

// ---------- o giro ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

// ---------- a peça de uma vista só e a âncora ----------

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero). A 3/4 sobe
 * cada peça mexendo no `dy` dela: a peça da vista de cima (nasce com `dy` zero)
 * some quando sobe, e a de pé (nasce deslocada a altura da âncora) aparece
 * quando a 3/4 a traz de volta. Só vale sem giro: a cena girada passa à textura
 * a peça de antes do giro (`girarPeca` em `tresQuartos.ts`).
 */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/**
 * A mesma forma com a caixa de pintura centrada em (cx, cy): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber em que estrutura a peça está, cai na âncora.
 */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A âncora só contém o próprio ponto, com esta folga de conta; fora dele está longe de tudo, e nada dela é pintado. */
const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05
/** Cada grupo aberto fica isto mais ao sul que o anterior: na mesma base, a 3/4 os pinta na ordem em que foram abertos. */
const PASSO_DA_ORDEM = 1e-3

/**
 * A ÂNCORA de um grupo, no ponto (x, y) do chão da pegada já girada: um tampo
 * solto de um ponto só, sem sombra. A 3/4 sobe `z` as peças cuja caixa tem o
 * meio nela e as pinta na ordem da base (o `y`). `q` = os quartos de volta que
 * a 3/4 ainda vai dar na cena.
 */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

/** A peça de pé não tem deslocamento nem sombra própria (a sombra dela cairia na vista de cima). */
type OpcoesDaTela = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Põe uma peça num grupo (a lista vai de trás para a frente). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaTela) => void

/** A tela da 3/4: quem desenha nela escreve em coordenadas da tela, com a pegada já girada. */
interface Tela {
  /**
   * Abre um grupo de peças que sobem juntas. (x, base) = o ponto do chão que
   * dá a ordem do grupo (fora de toda estrutura da mesa); `meio` = o y da tela
   * em volta do qual ficam as caixas de pintura, acima da base.
   */
  grupo(x: number, base: number, meio: number): Por
}

function novaTela(P: CriarPeca, cena: Cena, q: number): Tela {
  const volta = (4 - q) % 4
  let abertos = 0
  return {
    grupo(x, base, meio) {
      const chao = base + abertos * PASSO_DA_ORDEM
      abertos += 1
      const z = chao - meio
      ancorar(cena, q, x, chao, z)
      const [dx, dy] = girarPonto(0, z, volta)
      return (forma, mat, o = {}) => {
        const noMeio = presa(forma, x, meio)
        if (q === 0) {
          cena.partes.push(P(noMeio, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
          return
        }
        // Girada, a cena só serve à 3/4: a peça sai desgirada (a forma, o veio e o ponto que a textura lê) e a volta da 3/4 a põe como foi desenhada.
        const textura = o.textura
        cena.partes.push(
          P(girarForma(noMeio, volta), mat, {
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
    },
  }
}

/** O que cada parte da mesa precisa saber do móvel: a pegada, a escala das coisas e a lista de peças. */
interface Mesa {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  /** As coisas em cima do tampo têm o tamanho do menor lado: 1 na mesa de 1,5 x 1 casas. */
  readonly k: number
}

// ---------- o tampo ----------

/** Os cortes de faca: quantos, a meia largura, o quanto cobrem a madeira, o comprimento do menor ao maior (px do protótipo) e as duas direções em que a faca desce. */
const CORTES = 92
const MEIA_LARGURA_DO_CORTE = 0.32
const ALFA_DO_CORTE = 0.46
const CORTE_CURTO = 3.4
const CORTE_COMPRIDO = 14
const DIRECOES_DO_CORTE: readonly [number, number] = [-0.5, 1.05]
/** As manchas de caldo: o meio (frações da meia pegada) e os dois raios (px do protótipo, no menor lado). */
const MANCHAS: readonly (readonly [number, number, number, number])[] = [
  [0.34, 0.34, 9, 5],
  [-0.5, -0.02, 6, 4.4],
  [0.02, -0.58, 7, 3.2],
]

function montarTampo(b: Mesa, tampo: Forma): void {
  const { c, L, k } = b
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  // A grossura do bloco, aparecendo embaixo e à direita, e o tampo em sarrafos ao comprido.
  L.push(P(tampo, mad, { dx: 0.6 * k, dy: 1.8 * k, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.62, semente: 4701 }))
  L.push(P(tampo, mad, { tabua: SARRAFO * k, bisel: 1.6, contorno: 0.1, tom: 1.02, textura: texDoTampo(tampo, hw * 0.7, hh * 0.7), semente: 4702 }))
  // O uso, por baixo do serviço: as manchas de caldo e os cortes de faca, mais juntos no meio.
  MANCHAS.forEach(([fx, fy, rx, ry], i) => {
    L.push(P(elipse(fx * hw, fy * hh, rx * k, ry * k), MANCHA, { bisel: 0, contorno: 0, alfa: 0.2, suave: 3 * k, semente: 4705 + i }))
  })
  for (let i = 0; i < CORTES; i += 1) {
    // Dois sorteios somados puxam o corte para o meio do tampo.
    const cx = (hash(i, 1, 4710) + hash(i, 2, 4710) - 1) * 0.86 * hw
    const cy = (hash(i, 3, 4710) + hash(i, 4, 4710) - 1) * 0.82 * hh
    const meio = ((CORTE_CURTO + (CORTE_COMPRIDO - CORTE_CURTO) * hash(i, 5, 4710)) * k) / 2
    const ang = DIRECOES_DO_CORTE[i % 3 === 0 ? 1 : 0] + (hash(i, 6, 4710) - 0.5) * 0.6
    const corte = capsula(cx - Math.cos(ang) * meio, cy - Math.sin(ang) * meio, cx + Math.cos(ang) * meio, cy + Math.sin(ang) * meio, MEIA_LARGURA_DO_CORTE * k)
    // Um em cada quatro é corte novo, na madeira clara de dentro; os outros já escureceram.
    L.push(P(corte, i % 4 === 0 ? CORTE_NOVO : CORTE_VELHO, { bisel: 0, contorno: 0, alfa: ALFA_DO_CORTE }))
  }
}

// ---------- o serviço ----------

/** Onde cada coisa está no tampo: a origem (frações da meia pegada) e o giro. */
const LUGAR_DO_PEIXE = { x: -0.16, y: -0.2, giro: -0.16 }
const LUGAR_DO_CUTELO = { x: 0.5, y: -0.5, giro: -0.5 }
const LUGAR_DA_FACA = { x: 0.04, y: 0.6, giro: 0.08 }
const LUGAR_DA_CENOURA = { x: 0.5, y: 0.22, giro: 0.2 }
const LUGAR_DO_PANO = { x: -0.66, y: 0.66, giro: -0.14 }
const CEBOLAS: readonly (readonly [number, number])[] = [
  [-0.72, -0.52],
  [-0.5, -0.7],
]
/** A sombra que cada coisa deitada faz no tampo. */
const SOMBRA_DEITADA: Projecao = { dist: 1, forca: 0.32, suave: 0.8 }

/** O peixe inteiro, deitado de lado, do rabo ao focinho: as barbatanas, o corpo de escamas, a guelra, o olho e a boca. */
function montarPeixe(b: Mesa): void {
  const { c, L, k } = b
  const P = c.peca
  const origem: Ponto = [LUGAR_DO_PEIXE.x * c.hw, LUGAR_DO_PEIXE.y * c.hh]
  const em = noLugar(origem, LUGAR_DO_PEIXE.giro, k)
  const giro = LUGAR_DO_PEIXE.giro
  L.push(P(poligono(([[-17, -4.6], [-11.4, -1], [-11.4, 1], [-17, 4.6], [-14.4, 0]] as Ponto[]).map(em)), BARBATANA, { eixo: giro, bisel: 0.8 * k, contorno: 0.3, semente: 4720, projeta: SOMBRA_DEITADA }))
  L.push(P(poligono(([[-5, -3.6], [2.6, -6.2], [6.4, -3.4]] as Ponto[]).map(em)), BARBATANA, { bisel: 0.6 * k, tom: 0.94, contorno: 0.3, semente: 4721, projeta: SOMBRA_DEITADA }))
  L.push(P(poligono(([[-3, 3.8], [0.6, 5.8], [3, 3.6]] as Ponto[]).map(em)), BARBATANA, { bisel: 0.6 * k, tom: 1.04, contorno: 0.3, semente: 4722, projeta: SOMBRA_DEITADA }))
  const [mx, my] = em([1, 0])
  const corpo = elipseGirada(mx, my, 13.4 * k, 4.9 * k, giro)
  L.push(P(corpo, PEIXE, { bisel: 3.4 * k, contorno: 0.3, metal: 0.24, textura: texDoPeixe(mx, my, giro, 4.9 * k), semente: 4723, projeta: { dist: 1.5, forca: 0.36, suave: 1 } }))
  // A guelra (um arco escuro), o olho com o ponto de luz e o risco da boca.
  const [gx, gy] = em([6, 0])
  const guelra = dentroDe(corpo, anel(gx, gy, 4.6 * k, 4.6 * k, 4 * k, 4 * k))
  L.push(P(dentroDe(guelra, poligono(([[8.4, -6], [12, -6], [12, 6], [8.4, 6]] as Ponto[]).map(em))), OLHO, { bisel: 0, contorno: 0, alfa: 0.4 }))
  const [ox, oy] = em([11.2, -1])
  L.push(P(elipse(ox, oy, 1.15 * k, 1.15 * k), OLHO, { bisel: 0.5, contorno: 0.2 }))
  L.push(P(elipse(ox - 0.35 * k, oy - 0.35 * k, 0.36 * k, 0.36 * k), BRILHO, { bisel: 0, contorno: 0 }))
  const [ax, ay] = em([12.4, 1.5])
  const [bx, by] = em([14.2, 0.9])
  L.push(P(capsula(ax, ay, bx, by, 0.26 * k), OLHO, { bisel: 0, contorno: 0, alfa: 0.5 }))
}

/** A faca largada, do pé do cabo (a origem) à ponta: o cabo com os dois rebites, a virola e a lâmina de um fio só. */
function montarFaca(b: Mesa, cabo: MaterialDaPeca): void {
  const { c, L, k } = b
  const P = c.peca
  const giro = LUGAR_DA_FACA.giro
  const em = noLugar([LUGAR_DA_FACA.x * c.hw, LUGAR_DA_FACA.y * c.hh], giro, k)
  L.push(P(poligono(([[10.4, -1.7], [22, -1.7], [27, 1], [10.4, 1.5]] as Ponto[]).map(em)), ACO, { tabua: 0, bisel: 0.9 * k, contorno: 0.3, metal: 0.5, semente: 4740, projeta: SOMBRA_DEITADA }))
  L.push(P(poligono(([[0, -1.5], [1, -1.8], [9.6, -1.6], [9.6, 1.6], [1, 1.8], [0, 1.5]] as Ponto[]).map(em)), cabo, { eixo: giro, tabua: 0, bisel: 1.2 * k, contorno: 0.28, semente: 4741, projeta: SOMBRA_DEITADA }))
  L.push(P(poligono(([[9.4, -1.8], [10.8, -1.8], [10.8, 1.7], [9.4, 1.7]] as Ponto[]).map(em)), LATAO, { tabua: 0, bisel: 0.5, contorno: 0.24, metal: 0.4, semente: 4742 }))
  for (const x of [2.8, 6.8]) {
    const [rx, ry] = em([x, 0])
    L.push(P(elipse(rx, ry, 0.55 * k, 0.55 * k), LATAO, { bisel: 0.5, contorno: 0.2, metal: 0.5 }))
  }
}

/** As rodelas já cortadas, ao lado da cenoura: o meio de cada uma no desenho dela. */
const RODELAS: readonly Ponto[] = [[-3.4, 0.6], [-6.6, 2.4], [-9.4, 0.2], [-12.2, 3], [-14.6, 5.6]]

/** A cenoura pela metade, do corte (a origem) à ponta, e as rodelas que a faca já tirou. */
function montarCenoura(b: Mesa): void {
  const { c, L, k } = b
  const P = c.peca
  const giro = LUGAR_DA_CENOURA.giro
  const em = noLugar([LUGAR_DA_CENOURA.x * c.hw, LUGAR_DA_CENOURA.y * c.hh], giro, k)
  L.push(P(poligono(([[0, -2.5], [4.4, -2.7], [12.6, -1.1], [15, 0], [12.6, 1.1], [4.4, 2.7], [0, 2.5]] as Ponto[]).map(em)), CENOURA, { eixo: giro, bisel: 1.9 * k, contorno: 0.3, textura: texDeCenoura, semente: 4750, projeta: SOMBRA_DEITADA }))
  const [cx, cy] = em([0.2, 0])
  L.push(P(elipseGirada(cx, cy, 0.9 * k, 2.3 * k, giro), MIOLO_DA_CENOURA, { bisel: 0.5, contorno: 0.2 }))
  RODELAS.forEach(([x, y], i) => {
    const [rx, ry] = em([x, y])
    L.push(P(elipse(rx, ry, 2.4 * k, 2.4 * k), CENOURA, { bisel: 0.8 * k, tom: 1.05, contorno: 0.3, semente: 4752 + i, projeta: { dist: 0.6, forca: 0.3, suave: 0.6 } }))
    L.push(P(elipse(rx, ry, 1.15 * k, 1.15 * k), MIOLO_DA_CENOURA, { bisel: 0.4, contorno: 0.12 }))
  })
}

/** As duas metades da cebola, com o corte para cima: a casca, a polpa em camadas e o miolo. */
function montarCebolas(b: Mesa): void {
  const { c, L, k } = b
  const P = c.peca
  CEBOLAS.forEach(([fx, fy], i) => {
    const x = fx * c.hw
    const y = fy * c.hh
    const r = (4.7 - 0.5 * i) * k
    L.push(P(elipse(x, y, r, r), CASCA_DA_CEBOLA, { bisel: 1.2 * k, contorno: 0.3, semente: 4760 + i, projeta: { dist: 1.2, forca: 0.34, suave: 0.9 } }))
    L.push(P(elipse(x, y, r - 0.9 * k, r - 0.9 * k), CEBOLA, { bisel: 0.5, contorno: 0.12, textura: texDeCebola(x, y), semente: 4762 + i }))
    L.push(P(elipse(x, y, 0.8 * k, 0.8 * k), CASCA_DA_CEBOLA, { bisel: 0.4, tom: 1.16, contorno: 0.16 }))
  })
}

/** O cheiro-verde picado: quantos pedaços, em volta de onde (frações da meia pegada) e até que distância (px do protótipo). */
const PICADO = { pedacos: 18, x: -0.1, y: 0.26, raio: 7.5 }

function montarCheiroVerde(b: Mesa): void {
  const { c, L, k } = b
  const P = c.peca
  for (let i = 0; i < PICADO.pedacos; i += 1) {
    const longe = Math.sqrt(hash(i, 1, 4770)) * PICADO.raio * k
    const volta = hash(i, 2, 4770) * Math.PI * 2
    const cx = PICADO.x * c.hw + Math.cos(volta) * longe * 1.5
    const cy = PICADO.y * c.hh + Math.sin(volta) * longe * 0.7
    const meio = (0.7 + 0.9 * hash(i, 3, 4770)) * k
    const ang = hash(i, 4, 4770) * Math.PI
    L.push(P(capsula(cx - Math.cos(ang) * meio, cy - Math.sin(ang) * meio, cx + Math.cos(ang) * meio, cy + Math.sin(ang) * meio, 0.55 * k), VERDES[i % VERDES.length], { bisel: 0.4 * k, contorno: 0.26, projeta: { dist: 0.4, forca: 0.26, suave: 0.4 } }))
  }
}

/** O pano de prato amassado na quina da frente, passando um pouco da beira: o linho com as duas listras e a dobra. */
function montarPano(b: Mesa): void {
  const { c, L, k } = b
  const P = c.peca
  const giro = LUGAR_DO_PANO.giro
  const em = noLugar([LUGAR_DO_PANO.x * c.hw, LUGAR_DO_PANO.y * c.hh], giro, k)
  const pano = poligono(([[-10.4, -6.4], [-2, -7.4], [9.6, -6], [10.6, 1.4], [9, 7.6], [-1, 8.6], [-9.6, 7.4], [-11, 0.6]] as Ponto[]).map(em))
  L.push(P(pano, LENCOL, { eixo: giro, bisel: 1.5 * k, contorno: 0.26, ruga: 1.2, semente: 4780, projeta: { dist: 1.3, forca: 0.32, suave: 1 } }))
  for (const [i, x] of [-6.6, -4.2].entries()) {
    L.push(P(dentroDe(pano, poligono(([[x, -9], [x + 1.3, -9], [x + 2.1, 10], [x + 0.8, 10]] as Ponto[]).map(em))), LISTRA, { eixo: giro + QUARTO, bisel: 0, contorno: 0, alfa: 0.8, ruga: 1.2, semente: 4781 + i }))
  }
  // A dobra: uma sombra macia de través, de quem largou o pano dobrado ao meio.
  const [ax, ay] = em([1.6, -6.6])
  const [bx, by] = em([3.4, 7.8])
  L.push(P(capsula(ax, ay, bx, by, 0.5 * k), CORTE_VELHO, { bisel: 0, contorno: 0, alfa: 0.22, suave: 1.2 * k }))
}

// ---------- o cutelo cravado ----------

/**
 * O cutelo (px do protótipo, no menor lado): a meia lâmina, a altura dela fora
 * da madeira, a quina cortada da ponta, onde fica o furo de pendurar (ao longo
 * da lâmina, a partir do meio), o cabo e o quanto ele sobe até a ponta.
 */
const CUTELO = { meiaLamina: 8, altura: 8.2, quina: 1.6, furo: -5.2, cabo: 10.6, sobe: 2.6 } as const
/** Onde ficam os dois rebites, ao longo do cabo. */
const REBITES_DO_CABO: readonly number[] = [0.3, 0.72]
/** A sombra do cutelo no tampo: a peça escura, meio transparente, de borda macia. */
const SOMBRA_DO_CUTELO = { alfa: 0.3, suave: 1 }
/** Visto do alto, o cutelo inclinado mostra só esta tira da face da lâmina (px do protótipo, a meia largura dela). */
const TIRA_DA_LAMINA = 1.9
/** Visto do alto, o cabo vai do dorso da lâmina até aqui, no desenho do cutelo. */
const PE_DO_CABO: Ponto = [8.6, -2.1]
const PONTA_DO_CABO: Ponto = [19, -2.9]
/** A base do cutelo de pé: logo além da beira do tampo, fora da estrutura dele, para a 3/4 o pintar por cima. */
const ALEM_DO_TAMPO = 0.1

/**
 * O cutelo cravado VISTO DO ALTO (só sem giro; some na 3/4, onde aparece de
 * pé): o talho na madeira, a lâmina inclinada (uma tira estreita da face, com
 * o furo de pendurar), o dorso grosso e o cabo no ar, com a sombra dos dois
 * mais longe que a das coisas deitadas. O meio de cada peça cai dentro do
 * tampo, que a sobe na 3/4.
 */
function montarCuteloDeCima(b: Mesa, cabo: MaterialDaPeca): void {
  const { c, L, k } = b
  const P = c.peca
  const giro = LUGAR_DO_CUTELO.giro
  const em = noLugar([LUGAR_DO_CUTELO.x * c.hw, LUGAR_DO_CUTELO.y * c.hh], giro, k)
  const deCima = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(forma, mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
  /** O risco de `a` a `d` no desenho do cutelo, deslocado (dx, dy) no tampo. */
  const fio = (a: Ponto, d: Ponto, raio: number, dx = 0, dy = 0): Forma => {
    const [ax, ay] = em(a)
    const [bx, by] = em(d)
    return capsula(ax + dx, ay + dy, bx + dx, by + dy, raio * k)
  }
  const a = CUTELO.meiaLamina
  const lamina = ([[-a, -TIRA_DA_LAMINA + 1], [-a + CUTELO.quina, -TIRA_DA_LAMINA], [a, -TIRA_DA_LAMINA], [a, TIRA_DA_LAMINA], [-a, TIRA_DA_LAMINA]] as Ponto[]).map(em)
  const macia = { bisel: 0, contorno: 0, alfa: SOMBRA_DO_CUTELO.alfa, suave: SOMBRA_DO_CUTELO.suave * k }
  // As sombras: a da lâmina, perto, e a do cabo, que está mais alto, mais longe.
  deCima(poligono(lamina.map(([x, y]): Ponto => [x + SOMBRA_X * CUTELO.altura * k, y + SOMBRA_Y * CUTELO.altura * k])), SOMBRA, macia)
  deCima(fio(PE_DO_CABO, PONTA_DO_CABO, 1.6, SOMBRA_X * CUTELO.altura * 1.8 * k, SOMBRA_Y * CUTELO.altura * 1.8 * k), SOMBRA, macia)
  deCima(fio([-a - 0.6, TIRA_DA_LAMINA + 0.3], [a + 0.2, TIRA_DA_LAMINA + 0.3], 0.6), CORTE_VELHO, { bisel: 0, contorno: 0, alfa: 0.8 })
  deCima(poligono(lamina), ACO, { tabua: 0, bisel: 0.7 * k, contorno: 0.3, metal: 0.5, semente: 4730 })
  const [fx, fy] = em([CUTELO.furo, 0.1])
  deCima(elipseGirada(fx, fy, 1.05 * k, 0.7 * k, giro), BURACO, { bisel: 0.3, contorno: 0.1, recesso: { k: 0.6, forca: 0.3 } })
  deCima(fio([-a + CUTELO.quina, -TIRA_DA_LAMINA - 0.1], [a, -TIRA_DA_LAMINA - 0.1], 0.75), FERRO, { bisel: 0.7 * k, contorno: 0.28, metal: 0.4, semente: 4731 })
  deCima(fio(PE_DO_CABO, PONTA_DO_CABO, 1.7), cabo, { eixo: giro, tabua: 0, bisel: 1.5 * k, contorno: 0.28, semente: 4732 })
  for (const f of REBITES_DO_CABO) {
    const [rx, ry] = em([PE_DO_CABO[0] + (PONTA_DO_CABO[0] - PE_DO_CABO[0]) * f, PE_DO_CABO[1] + (PONTA_DO_CABO[1] - PE_DO_CABO[1]) * f])
    deCima(elipse(rx, ry, 0.6 * k, 0.6 * k), LATAO, { bisel: 0.5, contorno: 0.2, metal: 0.5 })
  }
}

/**
 * O cutelo cravado NA 3/4, DE PÉ, em qualquer giro (`q` quartos de volta): a
 * lâmina é uma chapa em pé ao longo da direção em que foi cravada (a da vista
 * de cima, girada com o objeto), vista como a 3/4 vê o que tem altura: o fio
 * no tampo e o dorso a altura dela acima. Depois o furo, o dorso grosso, o
 * cabo, que continua a lâmina e sobe, e os rebites; por baixo, o talho e a
 * sombra dela no tampo.
 */
function montarCuteloCravado(b: Mesa, tela: Tela, q: number, zTampo: number, cabo: MaterialDaPeca): void {
  const { c, k } = b
  const [x, y] = girarPonto(LUGAR_DO_CUTELO.x * c.hw, LUGAR_DO_CUTELO.y * c.hh, q)
  const [ux, uy] = girarPonto(Math.cos(LUGAR_DO_CUTELO.giro), Math.sin(LUGAR_DO_CUTELO.giro), q)
  const pe = y - zTampo
  const a = CUTELO.meiaLamina
  const h = CUTELO.altura
  const meioFundo = q % 2 === 1 ? c.hw : c.hh
  const por = tela.grupo(x, meioFundo + ALEM_DO_TAMPO, pe - (h * k) / 2)
  /** O ponto a `ao` px ao longo da lâmina (a partir do meio dela) e `sobe` px acima do tampo. */
  const em = (ao: number, sobe: number): Ponto => [x + ux * ao * k, pe + uy * ao * k - sobe * k]
  const fio = (de: Ponto, ate: Ponto, raio: number): Forma => capsula(de[0], de[1], ate[0], ate[1], raio * k)
  const caida = (p: Ponto): Ponto => [p[0] + SOMBRA_X * h * k, p[1] + SOMBRA_Y * h * k]
  por(poligono([em(-a, 0), em(a, 0), caida(em(a, 0)), caida(em(-a, 0))]), SOMBRA, { bisel: 0, contorno: 0, alfa: SOMBRA_DO_CUTELO.alfa, suave: SOMBRA_DO_CUTELO.suave * k })
  por(fio(em(-a - 0.6, 0), em(a + 0.6, 0), 0.6), CORTE_VELHO, { bisel: 0, contorno: 0, alfa: 0.8 })
  por(poligono([em(-a, 0), em(a, 0), em(a, h), em(-a + CUTELO.quina, h), em(-a, h - CUTELO.quina)]), ACO, { tabua: 0, bisel: 0.7 * k, contorno: 0.3, metal: 0.5, semente: 4733 })
  const [fx, fy] = em(CUTELO.furo, h * 0.62)
  por(elipse(fx, fy, Math.max(0.4, 1.05 * Math.abs(ux)) * k, 1.05 * k), BURACO, { bisel: 0.3, contorno: 0.1, recesso: { k: 0.6, forca: 0.3 } })
  por(fio(em(-a + CUTELO.quina, h), em(a, h), 0.75), FERRO, { bisel: 0.7 * k, contorno: 0.28, metal: 0.4, semente: 4734 })
  const peDoCabo = em(a + 0.6, h - 0.6)
  const pontaDoCabo = em(a + 0.6 + CUTELO.cabo, h - 0.6 + CUTELO.sobe)
  por(fio(peDoCabo, pontaDoCabo, 1.7), cabo, { eixo: Math.atan2(pontaDoCabo[1] - peDoCabo[1], pontaDoCabo[0] - peDoCabo[0]), tabua: 0, bisel: 1.5 * k, contorno: 0.28, semente: 4735 })
  for (const f of REBITES_DO_CABO) {
    por(elipse(peDoCabo[0] + (pontaDoCabo[0] - peDoCabo[0]) * f, peDoCabo[1] + (pontaDoCabo[1] - peDoCabo[1]) * f, 0.6 * k, 0.6 * k), LATAO, { bisel: 0.5, contorno: 0.2, metal: 0.5 })
  }
}

export const montarMesaDeCorte: MontarMovel = (c, cena) => {
  const { hw, hh, g } = c
  const q = quartosDoGiro(c.giro)
  const k = Math.min(c.h / FUNDO_DE_PARTIDA, c.w / LARGURA_DE_PARTIDA) / G
  const b: Mesa = { c, L: cena.partes, k }
  const zTampo = g * ALTURA_DO_TAMPO
  const tampo = caixa(-hw + FOLGA_DO_TAMPO, -hh + FOLGA_DO_TAMPO, hw - FOLGA_DO_TAMPO, hh - FOLGA_DO_TAMPO, QUINA_DO_TAMPO * k)
  // As quatro pernas, debaixo do tampo.
  const lado = PERNA * k
  const pernas = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => {
      const x = sx < 0 ? -hw + FOLGA_DO_TAMPO + RECUO_DA_PERNA * k : hw - FOLGA_DO_TAMPO - RECUO_DA_PERNA * k - lado
      const y = sy < 0 ? -hh + FOLGA_DO_TAMPO + RECUO_DA_PERNA * k : hh - FOLGA_DO_TAMPO - RECUO_DA_PERNA * k - lado
      return caixa(x, y, x + lado, y + lado, QUINA_DA_PERNA * lado)
    }),
  )
  // A sombra de baixo (pesada, em volta do tampo), a do tampo (solta, mais clara) e a de cada perna.
  const alem = 1.4 * k
  cena.sombras.push(
    { forma: caixa(tampo.b[0] - alem, tampo.b[1] - alem, tampo.b[2] + alem, tampo.b[3] + alem, QUINA_DO_TAMPO * k + alem), z: 0, suave: alem, forca: 0.4 },
    { forma: tampo, z: zTampo, solta: true, suave: 1.8, forca: 0.24 },
  )
  for (const perna of pernas) cena.sombras.push({ forma: perna, z: zTampo - ESPESSURA_DO_TAMPO_DA_MESA_DE_CORTE, suave: 0.9, forca: 0.3 }, contato(perna, 0.34))

  montarTampo(b, tampo)
  const cabo = madeiraDoCabo(c.m.madeira)
  montarCebolas(b)
  montarPeixe(b)
  montarCheiroVerde(b)
  montarCenoura(b)
  montarPano(b)
  montarFaca(b, cabo)
  // O cutelo por último: visto do alto (só sem giro) e de pé (só na 3/4).
  if (q === 0) montarCuteloDeCima(b, cabo)
  montarCuteloCravado(b, novaTela(c.peca, cena, q), q, zTampo, cabo)
}
