/**
 * PEDRA DE AMOLAR de cima com volume (lote 3 dos objetos novos, 11/11/2026):
 * o rebolo do ferreiro, em pé num cavalete de madeira. A RODA DE PEDRA gira
 * num eixo de ferro apoiado nos dois trilhos do cavalete; debaixo dela, entre
 * os trilhos, a CALHA cheia de água em que a pedra molha; na ponta da frente
 * do eixo, a MANIVELA com o punho de madeira. De cima a roda é uma tira (a
 * roda vista do alto é o aro dela): larga, clara, redonda ao comprido, com a
 * água escura dos dois lados e o eixo atravessado, que é a pista de que
 * aquilo gira.
 *
 * NA 3/4 A RODA APARECE DE FRENTE: o disco de pedra com os anéis do desgaste,
 * a grossura do aro por cima, o cubo de ferro no meio e, na frente dele, o
 * trilho, a calha e as duas pernas do cavalete; a ponta do eixo vem do cubo
 * para a frente e acaba na manivela. O disco é desenhado de frente uma vez e
 * FATIADO, como a frente do guarda-roupa e da prateleira de depósito: as
 * fatias ficam GUARDADAS debaixo do cavalete na vista de cima (ele é fechado
 * de madeira, água e pedra) e sobem para o lugar na 3/4.
 *
 * Quem põe cada coisa na altura certa é a regra de sempre (`tresQuartos.ts`):
 * a peça sobe a altura da estrutura que contém o meio da caixa dela. Aqui
 * quase tudo se prende a uma ÂNCORA, um tampo solto de um quarto de px, sem
 * sombra, escondido atrás da própria peça (`presa` centra a caixa de pintura
 * nela), e a ordem das âncoras do fundo para a frente é a ordem em que a 3/4
 * pinta. A tira da roda sobe até o eixo e fica atrás do disco. Só as quatro
 * pernas são colunas de verdade (a 3/4 as varre do chão).
 *
 * As medidas da frente são na TELA da 3/4 (x como na pegada; y = o y do chão
 * menos a altura), então o perfil do tipo tem de ser
 * `{ modo: 'derivado', espessura: 0 }`: com a beirada padrão dos tampos soltos
 * cada âncora ganharia um fio de 3 px debaixo dela.
 *
 * COM O OBJETO GIRADO a 3/4 dá o quarto de volta na cena antes de subir as
 * peças, e as fatias do disco sairiam deitadas. Por isso o desenho lê
 * `c.giro` e já entrega a cena girada ao contrário (`pecaNaTela`): na 3/4 a
 * pedra de amolar mostra a roda de frente em qualquer giro. De cima ela gira
 * com o objeto, como todo móvel.
 *
 * A 25% de zoom sobram o quadro de madeira, a barra clara da pedra com a água
 * dos lados e o risco do eixo com a manivela: é o que diz "pedra de amolar" e
 * não "banco". Materiais: `pedra` (a roda) e `madeira` (o cavalete); o ferro e
 * a água são fixos. Tudo tem o tamanho do menor lado (1 x 1 casa de partida).
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, elipse, uniao, type Caixa, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, PREGO, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo, no menor lado; as alturas, em casas) ----------

/** A roda: o raio e a meia grossura. */
const RAIO = 23
const MEIA_GROSSURA = 4.9
/** O quadro do cavalete: as meias medidas de fora e a largura dos trilhos e das travessas das pontas. */
const MEIA_LARGURA = 26.6
const MEIO_FUNDO = 17.6
const TRILHO = 5
/** A parede da calha, dentro do quadro. */
const PAREDE_DA_CALHA = 1.7
/** O eixo: o raio dele, o quanto passa do quadro atrás e na frente, e a manivela (o braço para a direita e o punho para a frente). */
const RAIO_DO_EIXO = 1.25
const EIXO_ATRAS = 3.6
const EIXO_NA_FRENTE = 3
const BRACO_DA_MANIVELA = 8.4
const PUNHO_DA_MANIVELA = 6.2
/** A perna (o lado dela) e a quina, em fração do lado: chanfrada o bastante para a 3/4 correr o veio de pé (`ehRedonda`). */
const PERNA = 5.6
const QUINA_DA_PERNA = 0.32
/** Alturas em casas: o alto dos trilhos, a água e o fundo da calha. O eixo fica logo acima dos trilhos. */
const ALTURA_DO_QUADRO = 0.6
const ALTURA_DA_AGUA = 0.52
const ALTURA_DO_FUNDO_DA_CALHA = 0.18
const EIXO_ACIMA_DO_QUADRO = 1.5

// ---------- os materiais fixos ----------

/** O ferro do eixo, dos mancais e do cubo; a água da calha (a do balde, um pouco mais escura: a pedra faz sombra nela). */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.92)) }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.66)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }
/** A madeira molhada: o escorrido da calha, meio transparente. */
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x24, 0x1c] }

/** De onde vem a luz (a do motor: de cima à esquerda). */
const LUZ_X = -0.62
const LUZ_Z = 0.62
/** Quanto a luz muda do lombo às beiras da roda: mais na tira vista do alto (é o que a faz ler como roda), menos na grossura do aro da 3/4. */
const LOMBO_DE_CIMA = 0.74
const LOMBO_NA_FRENTE = 0.5
/**
 * A beira do aro não chega a ficar de pé (fração da queda inteira do cilindro): com a queda inteira a ponta da
 * direita caía abaixo do piso de luz e era levantada para o escuro da madeira, uma ponta marrom na pedra cinza.
 */
const QUEDA_DA_BEIRA = 0.8
/** A pedra molhada: o quanto escurece e até onde, acima da linha da água (px do protótipo, no menor lado). */
const ESCURO_DO_MOLHADO = 0.13
const ALCANCE_DO_MOLHADO = 9

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O grão da pedra do rebolo. O granito fica com o da tabela (o pontilhado
 * claro e escuro). O arenito em camadas e a ardósia em lâminas da tabela dão
 * LISTRAS, e uma roda listrada lê como madeira torneada: aqui elas são pedra
 * de grão miúdo, com um ponto mais escuro ou mais claro de vez em quando.
 */
function graoDaPedra(pedra: MaterialDaPeca): Textura | null {
  if (pedra.classe !== 'pedra' || pedra.pedra === undefined || pedra.pedra === 'granito') return texturaDaClasse(pedra.classe)
  return (_u, _v, x, y, p, s) => {
    s[3] += ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.09 + ruido(x * 1.7, y * 1.7 + p.su) * 0.04
    const ponto = hash(Math.floor(x * 1.4), Math.floor(y * 1.4), p.semente)
    if (ponto > 0.95) s[6] = -0.13
    else if (ponto < 0.035) s[6] = 0.08
  }
}

/**
 * A pedra do ARO, redonda ao comprido: o chanfro do motor tem uma largura só
 * e não arredonda uma peça de 46 px, então a luz de través vai aqui (o lombo
 * no meio, a beira da esquerda na luz, a da direita na sombra). Por cima, os
 * riscos finos do desgaste, que correm em volta da roda. `raio` = o da roda,
 * com o meio em x = 0.
 */
function texDoAro(raio: number, lombo: number, daPedra: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const q = limitar(x / raio, -1, 1)
    s[3] += lombo * (LUZ_X * q * 0.5 + LUZ_Z * (Math.sqrt(1 - q * q * QUEDA_DA_BEIRA) - 1)) + Math.sin(y * 2.6 + ruido(x * 0.12, y * 0.5) * 3) * 0.02
  }
}

/**
 * A FACE do disco, em volta de (cx, cy): os anéis do desgaste, um pouco
 * tortos, a beira mais gasta que o miolo e, perto de `linhaDaAgua` (o y da
 * tela em que a pedra sai da calha), a pedra ainda molhada, mais escura.
 */
function texDaFace(cx: number, cy: number, raio: number, linhaDaAgua: number, alcance: number, daPedra: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    const beira = d / raio
    s[3] += Math.sin(d * 1.35 + ruido(x * 0.16, y * 0.16) * 2.4) * 0.024 + 0.07 * beira * beira * beira - 0.03
    s[3] -= ESCURO_DO_MOLHADO * limitar(1 - (linhaDaAgua - y) / alcance + ruido(x * 0.3, y * 0.1) * 0.5, 0, 1)
  }
}

/** A água da calha: mais escura junto das paredes de cima e da esquerda (a sombra delas) e ondulada de leve. */
function texDaAgua(x0: number, y0: number, alcance: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const naSombra = Math.max(limitar(1 - (x - x0) / alcance, 0, 1), limitar(1 - (y - y0) / alcance, 0, 1))
    s[3] += -0.3 * naSombra + ruido(x * 0.34, y * 0.5) * 0.09
  }
}

/** O escorrido na frente da calha: riscos de pé, mais fortes embaixo da beira. */
const texDoMolhado: Textura = (_u, _v, x, y, p, s) => {
  s[5] = limitar(0.5 + ruido(x * 0.9 + p.su, y * 0.12 + p.sv) * 2.2, 0, 1)
}

// ---------- a âncora e a fatia ----------

/** O lado da âncora (px do protótipo): um tampo solto que não faz sombra e some atrás da peça presa a ela. */
const FRESTA = 0.25
/** Quanto uma fatia passa por cima da vizinha (px do protótipo): sem isso sobraria um fio de chão entre as duas. */
const EMENDA = 0.2
/** Até onde a forma de uma fatia continua valendo depois do corte: mais que o alcance do passo do chanfro. */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3
/** A fatia guardada não passa disto (px do protótipo): tem de caber debaixo do cavalete. */
const FATIA_MAXIMA = 24

/** Onde uma peça se prende para subir `z` na 3/4. */
interface Ancora {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Cria a âncora em (x, y): o ponto tem de ficar DENTRO de uma peça presa a ela, que a esconde na 3/4. */
function ancorar(cena: Cena, x: number, y: number, z: number): Ancora {
  cena.sombras.push({ forma: caixa(x - FRESTA / 2, y - FRESTA / 2, x + FRESTA / 2, y + FRESTA / 2), z, solta: true, forca: 0 })
  return { x, y, z }
}

/**
 * A mesma forma com a caixa de pintura centrada na âncora: o desenho não muda
 * (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê para
 * saber em que estrutura a peça está, cai na âncora.
 */
function presa(forma: Forma, a: Ancora): Forma {
  const mx = Math.max(a.x - forma.b[0], forma.b[2] - a.x)
  const my = Math.max(a.y - forma.b[1], forma.b[3] - a.y)
  return { b: [a.x - mx, a.y - my, a.x + mx, a.y + my], d: (x, y) => forma.d(x, y) }
}

/** A peça da frente não tem deslocamento nem sombra própria: a cópia de uma fatia escureceria a da outra. */
type OpcoesDaFrente = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

/** Uma peça desenhada como a 3/4 a mostra: x como na pegada, y na tela (o y do chão menos a altura). */
interface PecaDaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFrente
}

/** Uma fatia da frente: de onde a onde vai na tela da 3/4 e a âncora dela (a fatia fica guardada `z` abaixo do lugar da tela). */
interface Fatia {
  readonly de: number
  readonly ate: number
  readonly ancora: Ancora
}

/**
 * A cópia da peça da frente que cabe à fatia, ou nada se a peça não passa por
 * ela. A forma é a peça inteira, descida para o lugar guardado (o chanfro e o
 * contorno não sabem do corte); a textura esconde o que passa da fatia e
 * devolve ao material as coordenadas da frente.
 */
function naFatia(P: CriarPeca, peca: PecaDaFrente, fatia: Fatia): Peca | null {
  const f = peca.forma
  const z = fatia.ancora.z
  const visivel0 = Math.max(fatia.de, f.b[1]) + z - EMENDA
  const visivel1 = Math.min(fatia.ate, f.b[3]) + z + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const guardada: Forma = {
    b: [f.b[0], corte0, f.b[2], corte1],
    d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : f.d(x, y - z)),
  }
  const eixo = peca.o.eixo ?? 0
  const du = -z * Math.sin(eixo)
  const dv = -z * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    if (y < visivel0 || y > visivel1) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - z, p, s, escala)
  }
  return P(presa(guardada, fatia.ancora), peca.mat, { ...peca.o, textura })
}

// ---------- o giro na 3/4 ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): [number, number] {
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

/**
 * A fábrica de peças de quem desenha NA TELA da 3/4. Com o objeto girado, a
 * 3/4 dá `q` quartos de volta na cena antes de subir as peças (`girarCena`),
 * e as fatias guardadas sairiam deitadas ou de ponta-cabeça. Aqui a peça já
 * sai girada ao contrário (a forma, o veio e o ponto que a textura lê): a
 * volta da 3/4 a põe de novo como foi desenhada. Sem giro, é a fábrica de
 * sempre, byte a byte.
 */
function pecaNaTela(P: CriarPeca, q: number): CriarPeca {
  if (q === 0) return P
  return (forma, mat, o = {}) => {
    const textura = o.textura
    return P(girarForma(forma, 4 - q), mat, {
      ...o,
      eixo: (o.eixo ?? 0) - q * QUARTO,
      textura:
        textura === undefined
          ? undefined
          : (u, v, x, y, p, s, escala) => {
              const [tx, ty] = girarPonto(x, y, q)
              textura(u, v, tx, ty, p, s, escala)
            },
    })
  }
}

/** As medidas do cavalete já no tamanho do móvel, os materiais e a fábrica de peças. */
interface Cavalete {
  readonly P: CriarPeca
  readonly pedra: MaterialDaPeca
  readonly madeira: MaterialDaPeca
  /** A cena como a tela a mostra (desgirada no fim, se o objeto estiver girado). */
  readonly cena: Cena
  readonly k: number
  /** As meias medidas de fora do quadro e a largura do trilho. */
  readonly mx: number
  readonly my: number
  readonly trilho: number
  readonly raio: number
  /** Alturas (px do protótipo): o alto dos trilhos, o eixo, a água e o fundo da calha. */
  readonly zQuadro: number
  readonly zEixo: number
  readonly zAgua: number
  readonly zFundo: number
}

// ---------- a frente: o disco, a calha e o trilho, guardados ----------

/** O disco de frente e a grossura do aro por cima dele, em fatias guardadas debaixo do cavalete. */
function guardarRoda(v: Cavalete, guardaAte: number): void {
  const { P, cena, k, raio, pedra } = v
  const daPedra = graoDaPedra(pedra)
  const grossura = MEIA_GROSSURA * 2 * k
  // Na tela, a face da frente da roda tem o meio na altura do eixo; a de trás fica a grossura da roda acima.
  const cy = MEIA_GROSSURA * k - v.zEixo
  const linhaDaAgua = MEIA_GROSSURA * k - v.zAgua
  const frente: PecaDaFrente[] = [
    {
      forma: uniao(elipse(0, cy - grossura, raio, raio), caixa(-raio, cy - grossura, raio, cy)),
      mat: pedra,
      o: { tabua: 0, bisel: 1.3 * k, tom: 1.08, contorno: 0.3, textura: texDoAro(raio, LOMBO_NA_FRENTE, daPedra), semente: 3601 },
    },
    {
      forma: elipse(0, cy, raio, raio),
      mat: pedra,
      o: { tabua: 0, bisel: 1.4 * k, tom: 0.9, contorno: 0.3, textura: texDaFace(0, cy, raio, linhaDaAgua, ALCANCE_DO_MOLHADO * k, daPedra), semente: 3602 },
    },
    // O cubo: a chapa de ferro presa na pedra e a ponta do eixo no meio dela.
    { forma: caixa(-3.8 * k, cy - 3.8 * k, 3.8 * k, cy + 3.8 * k, 1 * k), mat: FERRO, o: { tabua: 0, bisel: 1 * k, tom: 0.9, contorno: 0.3, metal: 0.3, semente: 3603 } },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sy): PecaDaFrente => ({ forma: elipse(sx * 2.5 * k, cy + sy * 2.5 * k, 0.6 * k, 0.6 * k), mat: PREGO, o: { bisel: 0.5, contorno: 0, metal: 0.3 } }))),
    { forma: elipse(0, cy, 2 * k, 2 * k), mat: FERRO, o: { tabua: 0, bisel: 1.8 * k, tom: 1.2, contorno: 0.3, metal: 0.5, semente: 3604 } },
  ]
  const alto = cy - grossura - raio
  const baixo = cy + raio
  const fatias = Math.ceil((baixo - alto) / (FATIA_MAXIMA * k))
  for (let j = 0; j < fatias; j += 1) {
    const de = alto + ((baixo - alto) * j) / fatias
    const ate = alto + ((baixo - alto) * (j + 1)) / fatias
    const z = guardaAte - ate
    // A fatia de baixo é a última (a 3/4 pinta do fundo para a frente); a âncora fica dentro da pedra guardada.
    const fatia: Fatia = { de, ate, ancora: ancorar(cena, 2 * k, guardaAte - (ate - de) / 2 - 0.6 * (fatias - 1 - j), z) }
    for (const peca of frente) {
      const copia = naFatia(P, peca, fatia)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

/** A frente da calha (as tábuas, as duas cintas de ferro e o escorrido) e a face do trilho da frente, guardadas. */
function guardarCalhaETrilho(v: Cavalete, guardaAte: number): void {
  const { P, cena, k, mx, my, trilho, madeira: mad } = v
  const dentro = mx - trilho
  // Na tela: a parede da frente da calha, do fundo dela até o alto do trilho, e a face do trilho por cima.
  const calha0 = my - trilho - v.zQuadro
  const calha1 = my - trilho - v.zFundo
  const face0 = my - v.zQuadro
  const face1 = face0 + trilho
  const daCalha: PecaDaFrente[] = [
    { forma: caixa(-dentro, calha0, dentro, calha1, 0.8 * k), mat: mad, o: { tabua: 6.4 * k, bisel: 1 * k, tom: 0.76, contorno: 0.26, semente: 3610 } },
    { forma: caixa(-dentro + 1, face1 - 0.5, dentro - 1, calha1 - 1), mat: MOLHADO, o: { bisel: 0, contorno: 0, alfa: 0.3, textura: texDoMolhado, semente: 3611 } },
    ...[-0.56, 0.56].map((f): PecaDaFrente => ({ forma: caixa(f * dentro - 1.1 * k, calha0, f * dentro + 1.1 * k, calha1 + 0.4), mat: FERRO, o: { tabua: 0, bisel: 0.7 * k, tom: 0.86, contorno: 0.26, metal: 0.3, semente: 3612 } })),
  ]
  const zDaCalha = guardaAte - calha1
  const fatiaDaCalha: Fatia = { de: -Infinity, ate: Infinity, ancora: ancorar(cena, -dentro * 0.3, guardaAte - (calha1 - calha0) * 0.3, zDaCalha) }
  for (const peca of daCalha) {
    const copia = naFatia(P, peca, fatiaDaCalha)
    if (copia !== null) cena.partes.push(copia)
  }
  // A face do trilho da frente: a âncora dela vem depois da da calha, e a 3/4 a pinta por cima.
  const face: PecaDaFrente = { forma: caixa(-mx, face0, mx, face1, 0.7 * k), mat: mad, o: { tabua: 0, bisel: 1.1 * k, tom: 0.86, contorno: 0.26, semente: 3613 } }
  const yDaFace = guardaAte - (calha1 - calha0) * 0.3 + 1.5 * k
  const copia = naFatia(P, face, { de: -Infinity, ate: Infinity, ancora: ancorar(cena, dentro * 0.4, yDaFace, yDaFace - (face0 + face1) / 2) })
  if (copia !== null) cena.partes.push(copia)
}

// ---------- a vista de cima ----------

export const montarPedraDeAmolar: MontarMovel = (c, destino) => {
  const { g } = c
  const k = Math.min(c.w, c.h) / G
  const mad = c.m.madeira
  const pedra = c.m.pedra
  // A cena é montada como a tela a mostra, com a roda de frente, e desgirada no fim: na 3/4 a pedra de amolar
  // mostra a roda de frente em qualquer giro (o desenho cabe no menor lado, então cabe na pegada girada).
  const q = quartosDoGiro(c.giro)
  const P = pecaNaTela(c.peca, q)
  const cena: Cena = { partes: [], sombras: [] }
  const L = cena.partes
  const mx = MEIA_LARGURA * k
  const my = MEIO_FUNDO * k
  const trilho = TRILHO * k
  const raio = RAIO * k
  const meia = MEIA_GROSSURA * k
  const zQuadro = g * ALTURA_DO_QUADRO * k
  const v: Cavalete = { P, pedra, madeira: mad, cena, k, mx, my, trilho, raio, zQuadro, zEixo: zQuadro + EIXO_ACIMA_DO_QUADRO * k, zAgua: g * ALTURA_DA_AGUA * k, zFundo: g * ALTURA_DO_FUNDO_DA_CALHA * k }
  const dentroX = mx - trilho
  const dentroY = my - trilho

  // As quatro pernas, debaixo das quinas do quadro: a 3/4 as varre do chão até debaixo do trilho.
  const lado = PERNA * k
  const zDaPerna = zQuadro - trilho - lado
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx < 0 ? -mx : mx - lado
      const y = sy < 0 ? -my : my - lado
      const perna = caixa(x, y, x + lado, y + lado, QUINA_DA_PERNA * lado)
      cena.sombras.push({ forma: perna, z: zDaPerna, forca: 0.3 }, contato(perna, 0.34))
    }
  }
  // O chão: o escuro debaixo do cavalete e a sombra do quadro, caída para baixo à direita.
  cena.sombras.push(
    { forma: caixa(-mx, -my, mx, my, 1), z: 0, suave: 2 * k, forca: 0.3 },
    { forma: caixa(-mx + 8 * k, -my + 6.5 * k, mx + 8 * k, my + 6.5 * k, 2 * k), z: 0, suave: 3 * k, forca: 0.2 },
  )

  // 1. GUARDADO debaixo do cavalete: o disco de frente, a frente da calha e a face do trilho.
  const guardaAte = my - 1.6 * k
  guardarRoda(v, guardaAte)
  guardarCalhaETrilho(v, guardaAte)

  // 2. A CALHA: as paredes e a água, que sobem até a altura da água (ficam atrás do disco).
  const naCalha = ancorar(cena, dentroX * 0.5, -dentroY + PAREDE_DA_CALHA * k * 0.5, v.zAgua)
  const parede = PAREDE_DA_CALHA * k
  L.push(P(presa(caixa(-dentroX - 0.4, -dentroY - 0.4, dentroX + 0.4, dentroY + 0.4), naCalha), mad, { tabua: 0, bisel: 0.6, tom: 0.7, contorno: 0.1, semente: 3620 }))
  L.push(
    P(presa(caixa(-dentroX + parede, -dentroY + parede, dentroX - parede, dentroY - parede, 0.8 * k), naCalha), AGUA, {
      bisel: 0,
      contorno: 0.16,
      textura: texDaAgua(-dentroX + parede, -dentroY + parede, 3.4 * k),
      semente: 3621,
    }),
  )
  for (const [fx, fy] of [[-0.62, 0.72], [0.5, -0.74]]) {
    L.push(P(presa(elipse(fx * dentroX, fy * dentroY, 4.4 * k, 0.9 * k), naCalha), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.2, suave: 1 * k }))
  }

  // 3. O QUADRO: o trilho de trás com as duas travessas das pontas, e o trilho da frente (a âncora dele vem depois).
  // A âncora de trás fica na travessa da ponta, à frente das pernas de trás: a 3/4 pinta as pernas antes e o quadro as cobre.
  const atras = ancorar(cena, -mx + trilho / 2, -dentroY * 0.62, zQuadro)
  const naFrente = ancorar(cena, -mx * 0.45, my - trilho / 2, zQuadro)
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -mx : dentroX
    L.push(P(presa(caixa(x0, -dentroY - 0.5, x0 + trilho, dentroY + 0.5, 0.6 * k), atras), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1 * k, tom: 0.9, contorno: 0.24, semente: 3630 + sx }))
  }
  L.push(P(presa(caixa(-mx, -my, mx, -dentroY, 0.8 * k), atras), mad, { tabua: 0, bisel: 1.2 * k, contorno: 0.26, semente: 3632, projeta: { dist: 0.8, forca: 0.24 } }))
  L.push(P(presa(caixa(-mx, dentroY, mx, my, 0.8 * k), naFrente), mad, { tabua: 0, bisel: 1.2 * k, tom: 1.04, contorno: 0.26, semente: 3633, projeta: { dist: 0.8, forca: 0.24 } }))
  // As cavilhas das quinas, em cima de cada perna.
  for (const sx of [-1, 1]) {
    for (const [sy, ancora] of [[-1, atras], [1, naFrente]] as const) {
      L.push(P(presa(elipse(sx * (mx - lado / 2), sy * (my - trilho / 2), 0.8 * k, 0.8 * k), ancora), mad, { tabua: 0, bisel: 0.5, tom: 0.62, contorno: 0.2 }))
    }
  }

  // 4. O EIXO de ferro: a metade de trás (some atrás do disco na 3/4) com o mancal dela, e a tira da RODA por cima.
  const reixo = RAIO_DO_EIXO * k
  // A âncora da metade de trás fica na ponta dela debaixo da roda: depois da do quadro (o mancal fica por cima do trilho).
  const eixoDeTras = ancorar(cena, 0, -meia + 0.6 * k, v.zEixo)
  L.push(P(presa(capsula(0, -my - EIXO_ATRAS * k, 0, -meia + 1, reixo), eixoDeTras), FERRO, { bisel: reixo, tom: 1.1, contorno: 0.3, metal: 0.45, semente: 3640, projeta: { dist: 1.4, forca: 0.36 } }))
  L.push(P(presa(caixa(-3.2 * k, -my + 0.7 * k, 3.2 * k, -dentroY - 0.7 * k, 0.7 * k), eixoDeTras), FERRO, { tabua: 0, bisel: 0.9 * k, tom: 0.84, contorno: 0.3, metal: 0.3, semente: 3641, projeta: { dist: 0.8, forca: 0.3 } }))
  const daRoda = ancorar(cena, -raio * 0.4, 0, v.zEixo)
  L.push(
    P(presa(caixa(-raio, -meia, raio, meia, 1.6 * k), daRoda), pedra, {
      tabua: 0,
      bisel: 1.3 * k,
      tom: 1.08,
      contorno: 0.3,
      textura: texDoAro(raio, LOMBO_DE_CIMA, graoDaPedra(pedra)),
      semente: 3601,
      projeta: { dist: 3.6, forca: 0.42, suave: 1.5 },
    }),
  )

  // 5. NA FRENTE DE TUDO: a ponta do eixo com o mancal, o braço da manivela e o punho de madeira.
  const yDaPonta = my + EIXO_NA_FRENTE * k
  const daManivela = ancorar(cena, 0, my - trilho * 0.5, v.zEixo)
  const naManivela = (forma: Forma): Forma => presa(forma, daManivela)
  L.push(P(naManivela(capsula(0, meia - 1, 0, yDaPonta, reixo)), FERRO, { bisel: reixo, tom: 1.1, contorno: 0.3, metal: 0.45, semente: 3642, projeta: { dist: 1.4, forca: 0.36 } }))
  L.push(P(naManivela(caixa(-3.2 * k, dentroY + 0.7 * k, 3.2 * k, my - 0.7 * k, 0.7 * k)), FERRO, { tabua: 0, bisel: 0.9 * k, tom: 0.84, contorno: 0.3, metal: 0.3, semente: 3643, projeta: { dist: 0.8, forca: 0.3 } }))
  // Os dois parafusos de cada mancal.
  for (const [yDoMancal, ancora] of [[-my + trilho / 2, eixoDeTras], [my - trilho / 2, daManivela]] as const) {
    for (const sx of [-1, 1]) L.push(P(presa(elipse(sx * 2.1 * k, yDoMancal, 0.6 * k, 0.6 * k), ancora), PREGO, { bisel: 0.5, contorno: 0, metal: 0.3 }))
  }
  L.push(P(naManivela(capsula(0, yDaPonta, BRACO_DA_MANIVELA * k, yDaPonta, 1.15 * k)), FERRO, { bisel: 1 * k, tom: 0.96, contorno: 0.3, metal: 0.4, semente: 3644 }))
  L.push(P(naManivela(capsula(BRACO_DA_MANIVELA * k, yDaPonta + 1.2 * k, BRACO_DA_MANIVELA * k, yDaPonta + PUNHO_DA_MANIVELA * k, 1.7 * k)), mad, { eixo: QUARTO, tabua: 0, bisel: 1.5 * k, tom: 1.12, contorno: 0.3, semente: 3645 }))
  L.push(P(naManivela(elipse(0, yDaPonta, 1.7 * k, 1.7 * k)), FERRO, { bisel: 1.5 * k, tom: 1.2, contorno: 0.3, metal: 0.5, semente: 3646 }))

  // As peças já saíram desgiradas da fábrica; as sombras (e as âncoras, que são sombras) são desgiradas aqui.
  destino.partes.push(...L)
  for (const sombra of cena.sombras) destino.sombras.push({ ...sombra, forma: girarForma(sombra.forma, (4 - q) % 4) })
}
