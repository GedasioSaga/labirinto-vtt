/**
 * PRATELEIRA DE POTES de cima com volume (lote 5 dos objetos novos,
 * 11/11/2026): a prateleira de PAREDE da cozinha, estreita, com os temperos e
 * as conservas. De cima aparece só o que se vê do alto: a tábua de cima, com a
 * ripa de fundo rente à parede e o topo das duas laterais, e em cima dela a
 * fileira de potes vista pela boca (o pano amarrado dos vidros, a rolha, a
 * tampa de madeira dos potes de barro). Ela não toca o chão: a sombra cai
 * longe, como a de tudo o que está no alto.
 *
 * NA 3/4 A FRENTE APARECE INTEIRA: os potes da tábua de cima em pé (os vidros
 * de conserva com a tampa de pano, os vidros de tempero arrolhados, os potes de
 * barro com rótulo), o vão com a segunda fileira, a tábua de baixo, as duas
 * mãos-francesas e, pendurados no varão de ferro debaixo dela, o MAÇO DE ERVAS
 * e a RÉSTIA DE ALHO. Não é a prateleira de depósito (`prateleiraDeDeposito.ts`,
 * de pé no chão, com três vãos de caixote, saco e jarro): aqui não há pé nem
 * montante, a carga é miúda e de vidro, e o que diz "cozinha" a 25% de zoom são
 * os pontos claros dos panos e do alho e o verde do maço.
 *
 * COMO A FRENTE CHEGA NA 3/4. A 3/4 não redesenha o móvel: sobe cada peça da
 * vista de cima a altura da estrutura em que ela está, mexendo no `dy` dela
 * (`tresQuartos.ts`). Daí as duas regras deste arquivo:
 * - a peça DE UMA VISTA SÓ só é pintada quando está no lugar em que foi
 *   desenhada, com `dy` zero (`soNoLugar`). A boca dos potes vista de cima nasce
 *   no lugar e some quando a 3/4 a sobe; a peça da frente nasce deslocada para
 *   baixo a altura da âncora dela e só aparece quando a 3/4 a sobe de volta;
 * - cada grupo da frente tem uma ÂNCORA (`ancorar`): uma estrutura de um ponto
 *   só, que não pinta nada e só diz à 3/4 a altura do grupo e a ordem (do
 *   norte para o sul, pela base). A frente é desenhada em coordenadas da TELA
 *   da 3/4 (x como na pegada; y = o y do chão menos a altura).
 * Nada fica guardado debaixo de outra peça, então não há fatia nem fresta.
 *
 * COM O OBJETO GIRADO a 3/4 dá o quarto de volta na cena antes de subir as
 * peças, e a cena só serve à 3/4. Por isso o desenho lê `c.giro`: girado, ele
 * não põe as bocas dos potes e desenha a frente já para o lado que ficou
 * virado para quem olha (de costas, as ripas do fundo na frente dos potes; de
 * lado, a ilharga com a mão-francesa), desgirada na fábrica (`novaTela`).
 *
 * O perfil do tipo tem de ser `{ modo: 'derivado', espessura:
 * ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES }`: a beirada da tábua de cima é a
 * que a 3/4 dá ao tampo solto. Os potes enchem a largura (a prateleira esticada
 * ganha potes, não potes maiores); a escala deles sai do fundo. Material:
 * `madeira`; o vidro, o barro, os panos, as conservas, as ervas e o alho são
 * fixos. Escreve `cena.corDoPiso` (o escuro da própria madeira, como a
 * prateleira de depósito): o fundo do vão cai abaixo do piso de luz.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { luminanciaLinear, ruido, texturaDaClasse, TOM_DA_CORDA, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { G, LENCOL, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** O fundo de partida, em casas: os potes têm o tamanho de desenho nele. */
const FUNDO_DE_PARTIDA = 0.4
/** Alturas em casas: o tampo (a tábua de cima) e o vão entre ela e a tábua de baixo. */
const ALTURA = 1.22
const VAO = 0.3
/**
 * A grossura das tábuas (px do protótipo): a beirada que o perfil do tipo tem
 * de trazer para a tábua de cima (`{ modo: 'derivado', espessura:
 * ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES }`). A tábua de baixo é desenhada
 * com a mesma.
 */
export const ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES = 0.055 * G
/** A folga da pegada, a grossura das laterais e a ripa de fundo vista de cima (px do protótipo). */
const FOLGA = 0.4
const LATERAL = 2.8
const RIPA = 2.2
/** Quanto a mão-francesa desce abaixo da tábua de baixo e onde fica o varão de ferro, a partir dela. */
const MAO_FRANCESA = 8.5
const VARAO = 2.6
/** A madeira vista de frente: o fundo do vão (escuro lá dentro), as laterais e a beira da tábua, que pega a luz. */
const TOM_DO_FUNDO = 0.8
const ESCURO_DO_VAO = 0.34
const TOM_DA_LATERAL = 0.9
const TOM_DA_BEIRA = 1.05

// ---------- os materiais fixos ----------

/** O vidro (verde-água bem claro, com brilho) e o risco de luz na frente dele. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xb2, 0xc2, 0xba] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf2, 0xf4, 0xee] }
/** O que os vidros guardam: azeitona, páprica, mel, erva seca, sal grosso e picles. */
const CONTEUDOS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x86, 0x8e, 0x5c] },
  { classe: 'liso', rgb: [0xa6, 0x66, 0x50] },
  { classe: 'liso', rgb: [0xba, 0x94, 0x5c] },
  { classe: 'liso', rgb: [0x7e, 0x86, 0x66] },
  { classe: 'liso', rgb: [0xd6, 0xd0, 0xc0] },
  { classe: 'liso', rgb: [0x6e, 0x7c, 0x5a] },
]
/**
 * Os panos das tampas: o linho cru, um vermelho desbotado e um palha. Sem
 * azul: visto do alto, o pano azul-acinzentado lia como tampa de lata.
 */
const PANOS: readonly MaterialDaPeca[] = [
  LENCOL,
  { classe: 'tecido', fio: 'linho', rgb: [0xb6, 0x82, 0x78] },
  { classe: 'tecido', fio: 'linho', rgb: [0xc9, 0xb4, 0x8a] },
]
/** O barro dos potes (a terracota contida do vaso), a rolha, a tampa de madeira, o papel do rótulo e a tinta dele. */
const BARRO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x73, 0x5a] }
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x96, 0x68] }
const TAMPA = materialDaPeca('pinho')
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd0, 0xb2] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x54, 0x44, 0x3a] }
/** O barbante das tampas e das amarras, o ferro do varão e a sombra que cada pote faz na tábua. */
const BARBANTE: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x6c, 0x48] }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
/** O maço de ervas: os talos e os três verdes da folhagem seca, calmos. */
const TALO: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x7a, 0x52] }
const VERDES: readonly MaterialDaPeca[] = [
  { classe: 'folha', rgb: [0x6a, 0x80, 0x54] },
  { classe: 'folha', rgb: [0x58, 0x6e, 0x4c] },
  { classe: 'folha', rgb: [0x88, 0x94, 0x64] },
]
/** A réstia: a cabeça de alho, a casca arroxeada, a raiz seca e a trança de palha (a corda da cerca, com a torção). */
const ALHO: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xd8, 0xc8] }
const CASCA_ROXA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x84, 0x94] }
const RAIZ: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0x9c, 0x78] }
const TRANCA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave01(t: number): number {
  const x = limitar(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** O barro: manchas largas de queima e um grão miúdo, sem listra. */
const texDoBarro: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 0.08 + ruido(x * 1.1 + p.sv, y * 1.1) * 0.03
}

/** A conserva dentro do vidro: os pedaços, em manchas miúdas de luz. */
const texDeConserva: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.9 + p.su, y * 0.9 + p.sv) * 0.2 + ruido(x * 2.1 + p.sv, y * 2.1) * 0.06
}

/** O pano amarrado visto de cima: liso no meio e franzido em pregas para a beira. */
function texDePregas(cx: number, cy: number, raio: number): Textura {
  const linho = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (linho !== null) linho(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy) / raio
    if (d > 0.55) s[3] += Math.sin(Math.atan2(y - cy, x - cx) * 9 + p.semente) * 0.11 * ((d - 0.55) / 0.45)
  }
}

/** O fundo do vão, entre `alto` e `baixo` na tela: a madeira, clara na beira da tábua e escura debaixo da de cima. */
function texDoVao(alto: number, baixo: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    s[3] -= ESCURO_DO_VAO * suave01((baixo - y) / (baixo - alto))
  }
}

/** A luminância linear do escuro em que o pixel escuro demais é levantado: a do escuro padrão do motor (a nogueira). */
const LUZ_DO_ESCURO = 0.062
const PASSO_DO_ESCURO = 0.02

/**
 * O escuro da PRÓPRIA madeira (o tom dela descido até a luz do escuro padrão),
 * como na prateleira de depósito: com o padrão, o fundo do vão de uma
 * prateleira de pinho ou de madeira velha saía vermelho-queimado.
 */
function escuroDaMadeira(mad: MaterialDaPeca): Rgb {
  const escuro = (f: number): Rgb => [Math.round(mad.rgb[0] * f), Math.round(mad.rgb[1] * f), Math.round(mad.rgb[2] * f)]
  let f = 1
  while (f > PASSO_DO_ESCURO && luminanciaLinear(...escuro(f)) > LUZ_DO_ESCURO) f -= PASSO_DO_ESCURO
  return escuro(f)
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
 * some quando sobe, e a da frente (nasce deslocada a altura da âncora) aparece
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
/** Cada grupo aberto fica isto mais ao sul que o anterior: a 3/4 pinta do norte para o sul, e assim na ordem em que foram abertos. */
const PASSO_DA_ORDEM = 1e-3

/**
 * A ÂNCORA de um grupo da frente, no ponto (x, y) do chão da pegada já girada:
 * um tampo solto de um ponto só, sem sombra. A 3/4 sobe `z` as peças cuja caixa
 * tem o meio nela e as pinta na ordem da base (o `y`). `q` = os quartos de
 * volta que a 3/4 ainda vai dar na cena.
 */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

/** A peça da frente não tem deslocamento nem sombra própria (a sombra dela cairia na vista de cima). */
type OpcoesDaFrente = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Põe uma peça num grupo da frente (a lista vai de trás para a frente). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaFrente) => void

/** A tela da 3/4: quem desenha nela escreve em coordenadas da tela, com a pegada já girada. */
interface Tela {
  /**
   * Abre um grupo de peças que sobem juntas. (x, base) = o ponto do chão que
   * dá a ordem do grupo; `meio` = o y da tela em volta do qual ficam as caixas
   * de pintura (o meio do que o grupo desenha, acima da base).
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

// ---------- os potes ----------

/** O que a prateleira guarda: o vidro de conserva com tampa de pano, o vidro de tempero arrolhado, o pote de barro com rótulo e o potinho de barro com pano. */
type Pote = 'vidroDePano' | 'vidroDeRolha' | 'poteDeRotulo' | 'potinhoDePano'

/** A largura e a altura de cada pote visto de frente (px do protótipo, no fundo de partida). */
const LARGURA_DO_POTE: Readonly<Record<Pote, number>> = { vidroDePano: 7.6, vidroDeRolha: 5.8, poteDeRotulo: 8.8, potinhoDePano: 6.8 }
const ALTURA_DO_POTE: Readonly<Record<Pote, number>> = { vidroDePano: 10.6, vidroDeRolha: 11.8, poteDeRotulo: 9.8, potinhoDePano: 7.4 }

/** A arrumação de cada tábua, da esquerda para a direita; a prateleira mais larga repete a lista. */
const FILEIRA_DE_CIMA: readonly Pote[] = ['vidroDePano', 'poteDeRotulo', 'vidroDeRolha', 'potinhoDePano', 'vidroDePano', 'vidroDeRolha', 'poteDeRotulo', 'vidroDePano', 'potinhoDePano', 'vidroDeRolha']
const FILEIRA_DE_BAIXO: readonly Pote[] = ['poteDeRotulo', 'vidroDePano', 'vidroDeRolha', 'vidroDePano', 'potinhoDePano', 'poteDeRotulo', 'vidroDeRolha', 'vidroDePano', 'poteDeRotulo', 'potinhoDePano']
/** O menor espaço entre dois potes (px do protótipo) e o teto de potes numa tábua (a prateleira não passa de 12 casas). */
const ENTRE_POTES = 1.3
const POTES_NO_MAXIMO = 96
/** Quanto o pote fica para trás da beira da tábua, na tela, e a semente dos potes de cada tábua. */
const RECUO_DO_POTE = 0.9
const SEMENTE_DOS_POTES = 4200
const SEMENTES_POR_TABUA = 500

/** Um pote na tábua: o tipo, o meio dele (em coordenadas do objeto) e o número na fileira. */
interface Lugar {
  readonly tipo: Pote
  readonly x: number
  readonly y: number
  readonly n: number
}

/** Os potes que cabem entre `x0` e `x1`, com a folga repartida por igual; `yDe(n)` = o y de cada um na tábua. */
function arrumar(lista: readonly Pote[], x0: number, x1: number, k: number, yDe: (n: number) => number): Lugar[] {
  const cabem: Pote[] = []
  let soma = 0
  for (let i = 0; i < POTES_NO_MAXIMO; i += 1) {
    const tipo = lista[i % lista.length]
    if (soma + LARGURA_DO_POTE[tipo] * k + (cabem.length + 2) * ENTRE_POTES > x1 - x0) break
    cabem.push(tipo)
    soma += LARGURA_DO_POTE[tipo] * k
  }
  const folga = (x1 - x0 - soma) / (cabem.length + 1)
  let x = x0 + folga
  return cabem.map((tipo, n) => {
    const larg = LARGURA_DO_POTE[tipo] * k
    const lugar: Lugar = { tipo, x: x + larg / 2, y: yDe(n), n }
    x += larg + folga
    return lugar
  })
}

/** As cores de um pote: saem do número dele na fileira, as mesmas na vista de cima e na frente. */
function coresDoPote(n: number, tabua: number): { conteudo: MaterialDaPeca; pano: MaterialDaPeca; semente: number } {
  return {
    conteudo: CONTEUDOS[(n * 2 + tabua * 3) % CONTEUDOS.length],
    pano: PANOS[(n + tabua * 2) % PANOS.length],
    semente: SEMENTE_DOS_POTES + tabua * SEMENTES_POR_TABUA + n * 12,
  }
}

/** A tampa de pano vista de frente: o pano caído em volta da boca e o barbante que o amarra. */
function tampaDePano(por: Por, cx: number, topo: number, meiaBoca: number, pano: MaterialDaPeca, semente: number): void {
  por(uniao(elipse(cx, topo + 0.9, meiaBoca + 0.9, 1.5), caixa(cx - meiaBoca - 0.8, topo + 0.9, cx + meiaBoca + 0.8, topo + 3.1, 0.5)), pano, { bisel: 1.1, contorno: 0.26, semente })
  por(capsula(cx - meiaBoca - 0.5, topo + 2.4, cx + meiaBoca + 0.5, topo + 2.4, 0.4), BARBANTE, { bisel: 0.3, contorno: 0.1 })
}

/** Um vidro de frente, com o pé em `pe`: a parede de vidro, o que ele guarda, o risco de luz e a tampa (pano amarrado ou rolha no gargalo). */
function vidroDeFrente(por: Por, cx: number, pe: number, larg: number, alt: number, tampa: 'pano' | 'rolha', n: number, tabua: number): void {
  const { conteudo, pano, semente } = coresDoPote(n, tabua)
  const meia = larg / 2
  const ombro = pe - alt + (tampa === 'pano' ? 2 : 3.4)
  por(caixa(cx - meia, ombro, cx + meia, pe, Math.min(2.2, meia * 0.6)), VIDRO, { bisel: meia * 0.7, contorno: 0.3, metal: 0.5, semente })
  const nivel = ombro + (pe - ombro) * (0.12 + 0.2 * hash(n, tabua, 911))
  por(caixa(cx - meia + 0.9, nivel, cx + meia - 0.9, pe - 0.8, Math.min(1.5, meia * 0.4)), conteudo, { bisel: meia * 0.6, contorno: 0.12, textura: texDeConserva, semente: semente + 1 })
  por(capsula(cx - meia * 0.5, ombro + 1.7, cx - meia * 0.5, pe - 2.2, 0.42), BRILHO, { bisel: 0, contorno: 0, alfa: 0.5 })
  if (tampa === 'pano') {
    tampaDePano(por, cx, pe - alt, meia - 0.3, pano, semente + 2)
    return
  }
  por(caixa(cx - meia * 0.58, pe - alt + 1.5, cx + meia * 0.58, ombro + 1.2, 0.7), VIDRO, { bisel: meia * 0.45, contorno: 0.3, metal: 0.5, semente: semente + 2 })
  por(caixa(cx - meia * 0.5, pe - alt, cx + meia * 0.5, pe - alt + 2.3, 0.6), ROLHA, { bisel: 0.7, contorno: 0.24, semente: semente + 3 })
}

/** Um pote de barro de frente: o pé, o bojo, a boca e a tampa (de madeira com pega, ou de pano); o rótulo de papel só aparece de frente. */
function barroDeFrente(por: Por, cx: number, pe: number, larg: number, alt: number, tampa: 'pano' | 'madeira', n: number, tabua: number, comRotulo: boolean): void {
  const { pano, semente } = coresDoPote(n, tabua)
  const meia = larg / 2
  const ry = alt * 0.42
  const cy = pe - ry - 0.4
  const boca = pe - alt + (tampa === 'pano' ? 0.6 : 1.5)
  const tom = 0.95 + 0.1 * hash(n, tabua, 913)
  por(caixa(cx - meia * 0.55, pe - 1.8, cx + meia * 0.55, pe, 0.5), BARRO, { bisel: 0.5, tom: 0.76, contorno: 0.2, textura: texDoBarro, semente })
  por(elipse(cx, cy, meia, ry), BARRO, { bisel: meia * 0.84, contorno: 0.26, tom, textura: texDoBarro, semente: semente + 1 })
  por(caixa(cx - meia * 0.62, boca, cx + meia * 0.62, cy - ry * 0.55, 0.9), BARRO, { bisel: 0.9, tom: tom * 0.9, contorno: 0.24, textura: texDoBarro, semente: semente + 2 })
  if (comRotulo) {
    por(caixa(cx - meia * 0.52, cy - ry * 0.36, cx + meia * 0.52, cy + ry * 0.44, 0.3), PAPEL, { bisel: 0.25, contorno: 0.2 })
    por(capsula(cx - meia * 0.3, cy - ry * 0.08, cx + meia * 0.3, cy - ry * 0.08, 0.24), TINTA, { bisel: 0, contorno: 0, alfa: 0.7 })
    por(capsula(cx - meia * 0.3, cy + ry * 0.2, cx + meia * 0.1, cy + ry * 0.2, 0.22), TINTA, { bisel: 0, contorno: 0, alfa: 0.6 })
  }
  if (tampa === 'pano') {
    tampaDePano(por, cx, pe - alt, meia * 0.62, pano, semente + 3)
    return
  }
  por(caixa(cx - meia * 0.74, pe - alt + 0.6, cx + meia * 0.74, boca + 0.6, 0.6), TAMPA, { tabua: 0, bisel: 0.7, contorno: 0.26, semente: semente + 3 })
  por(elipse(cx, pe - alt + 0.5, 1.1, 0.9), TAMPA, { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.26, semente: semente + 4 })
}

/** Um pote de frente, em pé, com o pé em (cx, pe), e a sombra dele na tábua. */
function poteDeFrente(por: Por, lugar: Lugar, cx: number, pe: number, k: number, tabua: number, comRotulo: boolean): void {
  const larg = LARGURA_DO_POTE[lugar.tipo] * k
  const alt = ALTURA_DO_POTE[lugar.tipo] * k
  por(elipse(cx + 0.8, pe + 0.1, larg / 2 + 0.5, 1.3), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.32, suave: 1.2 })
  switch (lugar.tipo) {
    case 'vidroDePano':
      vidroDeFrente(por, cx, pe, larg, alt, 'pano', lugar.n, tabua)
      return
    case 'vidroDeRolha':
      vidroDeFrente(por, cx, pe, larg, alt, 'rolha', lugar.n, tabua)
      return
    case 'poteDeRotulo':
      barroDeFrente(por, cx, pe, larg, alt, 'madeira', lugar.n, tabua, comRotulo)
      return
    case 'potinhoDePano':
      barroDeFrente(por, cx, pe, larg, alt, 'pano', lugar.n, tabua, false)
  }
}

/** A sombra que a boca de cada pote faz na tábua de cima, vista do alto. */
const SOMBRA_DO_POTE: Projecao = { dist: 1.1, forca: 0.32, suave: 0.9 }
/** As pontas do pano franzido em volta da boca, e o quanto cada uma sai e entra do raio. */
const PONTAS_DO_PANO = 7
const FRANZIDO_DO_PANO = 0.08

/** O contorno do pano amarrado, visto do alto: quase redondo, com as pontas do franzido (cada pote com as dele viradas para um lado). */
function contornoDoPano(x: number, y: number, raio: number, semente: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < PONTAS_DO_PANO * 2; i += 1) {
    const a = (i / (PONTAS_DO_PANO * 2)) * Math.PI * 2 + semente
    const r = raio * (i % 2 === 0 ? 1 + FRANZIDO_DO_PANO : 1 - FRANZIDO_DO_PANO)
    pontos.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
  }
  return poligono(pontos)
}

/**
 * A boca de um pote da tábua de cima, VISTA DO ALTO: o pano franzido com o
 * barbante, o vidro com a rolha ou o barro com a tampa de madeira. Só aparece
 * na vista de cima: o meio de cada peça cai dentro da tábua, que a sobe na 3/4.
 */
function poteDeCima(P: CriarPeca, L: Peca[], lugar: Lugar, k: number): void {
  const { conteudo, pano, semente } = coresDoPote(lugar.n, 0)
  const { x, y } = lugar
  const r = (LARGURA_DO_POTE[lugar.tipo] * k) / 2
  const deCima = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(forma, mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
  if (lugar.tipo === 'vidroDePano' || lugar.tipo === 'potinhoDePano') {
    const fora = r + 0.8
    deCima(contornoDoPano(x, y, fora, semente), pano, { bisel: fora * 0.6, contorno: 0.28, textura: texDePregas(x, y, fora), semente, projeta: SOMBRA_DO_POTE })
    deCima(anel(x, y, r * 0.9, r * 0.9, r * 0.7, r * 0.7), BARBANTE, { bisel: 0.3, contorno: 0.1, alfa: 0.8 })
    return
  }
  if (lugar.tipo === 'vidroDeRolha') {
    deCima(elipse(x, y, r, r), VIDRO, { bisel: r * 0.5, contorno: 0.3, metal: 0.5, semente, projeta: SOMBRA_DO_POTE })
    deCima(elipse(x, y, r - 0.9, r - 0.9), conteudo, { bisel: 0.4, contorno: 0.1, recesso: { k: 0.8, forca: 0.2 }, textura: texDeConserva, semente: semente + 1 })
    deCima(elipse(x, y, r * 0.56, r * 0.56), ROLHA, { bisel: 0.8, contorno: 0.26, semente: semente + 2 })
    return
  }
  deCima(elipse(x, y, r, r), BARRO, { bisel: r * 0.45, contorno: 0.28, textura: texDoBarro, semente, projeta: SOMBRA_DO_POTE })
  deCima(elipse(x, y, r * 0.76, r * 0.76), TAMPA, { tabua: 0, bisel: 0.8, contorno: 0.24, semente: semente + 1 })
  deCima(elipse(x, y, r * 0.24, r * 0.24), TAMPA, { tabua: 0, bisel: r * 0.24, tom: 0.9, contorno: 0.26, semente: semente + 2 })
}

// ---------- o que fica pendurado ----------

/** As folhas e os talos do maço, e as cabeças da réstia. */
const FOLHAS = 24
const TALOS = 5
const CABECAS = 7
const PASSO_DAS_CABECAS = 2.55
/** O maço, a partir do varão (px do protótipo): onde os talos são amarrados, onde a folhagem começa e o comprimento dela. */
const MACO = { amarra: 4.6, folhagem: 6.6, comprimento: 14 }

/** O maço de ervas de cabeça para baixo, pendurado em (x, y0): a alça de barbante, os talos amarrados em leque e as folhas secas, miúdas, que abrem para baixo. */
function macoDeErvas(por: Por, x: number, y0: number, semente: number): void {
  por(capsula(x, y0 - 0.2, x, y0 + 2.6, 0.34), BARBANTE, { bisel: 0.2, contorno: 0.16 })
  por(poligono([[x - 1, y0 + 2], [x + 1, y0 + 2], [x + 1.9, y0 + MACO.folhagem + 1], [x - 1.9, y0 + MACO.folhagem + 1]]), TALO, { bisel: 0.7, contorno: 0.26, semente })
  for (let i = 0; i < TALOS; i += 1) {
    const f = i / (TALOS - 1) - 0.5
    por(capsula(x + f * 2.4, y0 + MACO.amarra, x + f * 8.6, y0 + MACO.folhagem + MACO.comprimento * 0.92, 0.34), TALO, { bisel: 0.2, tom: 0.9, contorno: 0.2 })
  }
  for (let i = 0; i < FOLHAS; i += 1) {
    // De cima (perto da amarra) para baixo: as folhas de baixo ficam por cima, e o leque abre.
    const t = i / (FOLHAS - 1)
    const abre = 1.3 + 3.5 * t
    const fx = x + (hash(i, semente, 921) * 2 - 1) * abre
    const fy = y0 + MACO.folhagem + 1 + t * MACO.comprimento + (hash(i, semente, 922) - 0.5) * 1.6
    const giro = (fx - x) * 0.16 + (hash(i, semente, 923) - 0.5) * 0.7
    por(elipseGirada(fx, fy, 0.95 + 0.4 * hash(i, semente, 924), 2.4 + 0.9 * hash(i, semente, 925), giro), VERDES[i % VERDES.length], { bisel: 0.8, contorno: 0.3, semente: semente + 1 + i })
  }
  por(capsula(x - 1.8, y0 + MACO.amarra, x + 1.8, y0 + MACO.amarra, 0.6), BARBANTE, { bisel: 0.4, contorno: 0.2 })
}

/** A réstia de alho pendurada em (x, y0): a alça, a trança de palha e as cabeças, uma de cada lado, com a casca arroxeada e a raiz seca. */
function restiaDeAlho(por: Por, x: number, y0: number, semente: number): void {
  por(anel(x, y0 + 1.5, 1.5, 1.9, 0.7, 1.1), TRANCA, { bisel: 0.5, contorno: 0.26 })
  const fim = y0 + 6 + (CABECAS - 1) * PASSO_DAS_CABECAS + 1.6
  por(cadeia([[x, y0 + 3], [x + 0.5, y0 + 9], [x - 0.5, y0 + 15], [x + 0.3, fim - 2], [x, fim]], 0.9), TRANCA, { eixo: QUARTO, bisel: 0.7, contorno: 0.26, semente })
  for (let i = 0; i < CABECAS; i += 1) {
    const lado = i % 2 === 0 ? -1 : 1
    const cx = x + lado * (2.3 + 0.4 * hash(i, semente, 931))
    const cy = y0 + 6 + i * PASSO_DAS_CABECAS
    por(elipse(cx, cy, 2.45, 2.25), ALHO, { bisel: 2.1, contorno: 0.3, tom: 0.95 + 0.07 * hash(i, semente, 932), semente: semente + 1 + i })
    por(capsula(cx - lado * 0.5, cy - 1.2, cx + lado * 0.6, cy + 1.1, 0.3), CASCA_ROXA, { bisel: 0, contorno: 0, alfa: 0.4 })
    por(elipse(cx + lado * 2, cy + 0.9, 0.6, 0.5), RAIZ, { bisel: 0.3, contorno: 0.2 })
  }
}

// ---------- a montagem ----------

/** As medidas da prateleira já no tamanho do móvel e os potes de cada tábua. */
interface Prateleira {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  /** Os quartos de volta do objeto na 3/4. */
  readonly q: number
  /** A escala dos potes (1 no fundo de partida). */
  readonly k: number
  /** A altura do tampo e o vão entre as tábuas (px do protótipo). */
  readonly H: number
  readonly vao: number
  /** A meia largura e o meio fundo da pegada NA TELA (trocados com o objeto de lado). */
  readonly mw: number
  readonly mf: number
  /** Os potes da tábua de cima e os da de baixo, em coordenadas do objeto. */
  readonly deCima: readonly Lugar[]
  readonly deBaixo: readonly Lugar[]
}

/** A base dos grupos da frente: logo ao sul da tábua de cima, para a 3/4 os pintar por cima dela. */
const ALEM_DA_TABUA = 0.1
/** Onde o maço e a réstia ficam no varão (frações da meia largura). */
const LUGAR_DO_MACO = -0.44
const LUGAR_DA_RESTIA = 0.4
/** As duas ripas do fundo, vistas de costas (px do protótipo). */
const RIPA_DE_COSTAS = 4.2

/** A tábua de cima vista do alto, com a ripa de fundo e o topo das laterais: a estrutura que a 3/4 sobe. */
function montarTabuaDeCima(v: Prateleira): void {
  const { c, cena } = v
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const tampo = caixa(-hw + FOLGA, -hh + FOLGA, hw - FOLGA, hh - FOLGA, 0.7)
  cena.sombras.push({ forma: tampo, z: v.H, solta: true })
  L.push(P(tampo, mad, { tabua: (c.h - 2 * FOLGA) / 2, bisel: 1.1, semente: 4101 }))
  L.push(P(caixa(-hw + FOLGA, -hh + FOLGA, hw - FOLGA, -hh + FOLGA + RIPA, 0.5), mad, { tabua: 0, bisel: 0.8, tom: 0.82, semente: 4102, projeta: { dist: 0.9, forca: 0.26 } }))
  for (const [i, xa] of [-hw + FOLGA, hw - FOLGA - LATERAL].entries()) {
    L.push(P(caixa(xa, -hh + FOLGA, xa + LATERAL, hh - FOLGA, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: TOM_DA_LATERAL, semente: 4103 + i }))
  }
}

/** Os potes da tábua de cima EM PÉ, do fundo para a frente da tela; o rótulo só aparece sem giro. */
function porPotesEmPe(v: Prateleira, tela: Tela): void {
  const { q, k, H, mf } = v
  const naTela = v.deCima.map((lugar) => ({ lugar, ponto: girarPonto(lugar.x, lugar.y, q) })).sort((a, b) => a.ponto[1] - b.ponto[1])
  for (const { lugar, ponto } of naTela) {
    const alt = ALTURA_DO_POTE[lugar.tipo] * k
    const pe = ponto[1] + LARGURA_DO_POTE[lugar.tipo] * k * 0.3 - H
    poteDeFrente(tela.grupo(ponto[0], mf + ALEM_DA_TABUA, pe - alt / 2), lugar, ponto[0], pe, k, 0, q === 0)
  }
}

/**
 * A FRENTE (sem giro) ou as COSTAS (meia volta): o fundo do vão, os potes da
 * tábua de baixo, a tábua, as laterais com a mão-francesa, o varão e o que
 * pende dele. De costas tudo fica espelhado, os potes perdem o rótulo e as
 * duas ripas do fundo passam na frente deles.
 */
function montarFrente(v: Prateleira, tela: Tela): void {
  const { c, q, k, H, vao, mw, mf } = v
  const mad = c.m.madeira
  const deCostas = q === 2
  const espelho = deCostas ? -1 : 1
  const base = mf + ALEM_DA_TABUA
  const yVao = mf - H + ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES
  const yTabua = yVao + vao
  const yDeBaixo = yTabua + ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES
  const borda = mw - FOLGA
  const dentro = borda - LATERAL

  const fundo = tela.grupo(0, base, (yVao + yTabua) / 2)
  fundo(caixa(-dentro - 0.3, yVao - 0.4, dentro + 0.3, yTabua + 0.3), mad, { tabua: vao / 2, bisel: 0, contorno: 0, tom: TOM_DO_FUNDO, textura: texDoVao(yVao, yTabua), semente: 4110 })

  const pe = yTabua - RECUO_DO_POTE
  for (const lugar of v.deBaixo) {
    const cx = espelho * lugar.x
    poteDeFrente(tela.grupo(cx, base, pe - (ALTURA_DO_POTE[lugar.tipo] * k) / 2), lugar, cx, pe, k, 1, !deCostas)
  }

  const madeiramento = tela.grupo(0, base, (mf - H + yDeBaixo + MAO_FRANCESA) / 2)
  if (deCostas) {
    for (const [i, ya] of [yVao, yTabua - RIPA_DE_COSTAS].entries()) {
      madeiramento(caixa(-dentro - 0.3, ya, dentro + 0.3, ya + RIPA_DE_COSTAS, 0.4), mad, { tabua: 0, bisel: 0.8, tom: 0.86, contorno: 0.24, semente: 4111 + i })
    }
  }
  madeiramento(caixa(-dentro - 0.4, yTabua, dentro + 0.4, yDeBaixo, 0.4), mad, { tabua: 0, bisel: 0.9, tom: TOM_DA_BEIRA, semente: 4113 })
  const yVarao = yDeBaixo + VARAO
  madeiramento(capsula(-dentro, yVarao, dentro, yVarao, 0.55), FERRO, { bisel: 0.5, contorno: 0.26, metal: 0.4, semente: 4114 })
  for (const [i, xa] of [-borda, dentro].entries()) {
    madeiramento(caixa(xa, mf - H, xa + LATERAL, yDeBaixo + MAO_FRANCESA, 1.1), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: TOM_DA_LATERAL, semente: 4115 + i })
  }

  const xMaco = espelho * LUGAR_DO_MACO * c.hw
  macoDeErvas(tela.grupo(xMaco, base, yVarao + 10), xMaco, yVarao, 4300)
  const xRestia = espelho * LUGAR_DA_RESTIA * c.hw
  restiaDeAlho(tela.grupo(xRestia, base, yVarao + 12), xRestia, yVarao, 4330)
}

/**
 * A ILHARGA (um quarto de volta): a lateral de frente para quem olha, com a
 * mão-francesa que desce do lado da parede e as duas espigas da tábua de baixo.
 * O vão e o que pende do varão ficam atrás dela e debaixo da tábua de cima.
 */
function montarIlharga(v: Prateleira, tela: Tela): void {
  const { c, q, H, vao, mw, mf } = v
  const mad = c.m.madeira
  // Para que lado da tela ficou a parede: 1 à direita, -1 à esquerda.
  const [parede] = girarPonto(0, -1, q)
  const xParede = parede * (mw - FOLGA)
  const xFrente = -xParede
  const yAlto = mf - H
  const yTabua = yAlto + ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES + vao
  const yDeBaixo = yTabua + ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES
  const desce = MAO_FRANCESA
  const em = (f: number): number => xFrente + (xParede - xFrente) * f
  const por = tela.grupo(0, mf + ALEM_DA_TABUA, (yAlto + yDeBaixo + desce) / 2)
  por(
    poligono([[xParede, yAlto], [xFrente, yAlto], [xFrente, yDeBaixo], [em(0.3), yDeBaixo + desce * 0.16], [em(0.58), yDeBaixo + desce * 0.5], [em(0.82), yDeBaixo + desce * 0.9], [xParede, yDeBaixo + desce]]),
    mad,
    { eixo: QUARTO, tabua: Math.abs(xParede - xFrente) / 2, bisel: 1, tom: TOM_DA_LATERAL, semente: 4120 },
  )
  for (const f of [0.26, 0.7]) {
    por(caixa(Math.min(em(f - 0.09), em(f + 0.09)), yTabua + 0.3, Math.max(em(f - 0.09), em(f + 0.09)), yDeBaixo - 0.3, 0.3), mad, { tabua: 0, bisel: 0.4, tom: 0.66, contorno: 0.2 })
  }
}

export const montarPrateleiraDePotes: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const q = quartosDoGiro(c.giro)
  const k = limitar(c.h / (FUNDO_DE_PARTIDA * c.g), 0.8, 1.25)
  const deLado = q % 2 === 1
  const x0 = -hw + FOLGA + LATERAL + 0.6
  const x1 = hw - FOLGA - LATERAL - 0.6
  // Na tábua de cima os potes ficam no meio do fundo que sobra da ripa, um pouco fora de linha.
  const meioDaTabua = (-hh + FOLGA + RIPA + hh - FOLGA) / 2
  const v: Prateleira = {
    c,
    cena,
    q,
    k,
    H: c.g * ALTURA,
    vao: c.g * VAO,
    mw: deLado ? hh : hw,
    mf: deLado ? hw : hh,
    deCima: arrumar(FILEIRA_DE_CIMA, x0, x1, k, (n) => meioDaTabua + (hash(n, 5, 941) - 0.5) * 2.2 * k),
    deBaixo: arrumar(FILEIRA_DE_BAIXO, x0, x1, k, () => 0),
  }
  cena.corDoPiso = escuroDaMadeira(c.m.madeira)
  montarTabuaDeCima(v)
  if (q === 0) for (const lugar of v.deCima) poteDeCima(c.peca, cena.partes, lugar, k)
  const tela = novaTela(c.peca, cena, q)
  if (deLado) montarIlharga(v, tela)
  else montarFrente(v, tela)
  porPotesEmPe(v, tela)
}
