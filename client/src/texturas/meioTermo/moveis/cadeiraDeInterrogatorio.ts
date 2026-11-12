/**
 * CADEIRA DE INTERROGATÓRIO de cima com volume (lote 14 dos objetos novos, 11/11/2026; pedido do mestre:
 * "coloca uns equipamentos de tortura tambem"): a cadeira pesada de carvalho e ferro, CHUMBADA no chão, vazia.
 * De cima aparecem os dois POSTES de trás com o capuz de ferro e, entre eles, o alto do ENCOSTO de chapa, com a
 * CINTA DE COURO solta passada por cima dele; o ASSENTO de chapa rebitada na moldura de madeira; os BRAÇOS
 * largos, cada um com a BRAÇADEIRA aberta (a meia-argola presa no braço, com o rebaixo do pulso, e a outra
 * metade aberta para fora na dobradiça); na frente, a GAVETA de ferro das brasas puxada um palmo para fora,
 * fria e vazia (só o pó da cinza no fundo); no chão, os dois GRILHÕES dos tornozelos abertos, cada um preso por
 * uma corrente curta ao pé da frente, e as SAPATAS de ferro aparafusadas no chão debaixo de cada pé.
 *
 * O que a separa da cadeira comum (`cadeira.ts`): é maior, quase toda de ferro escuro, tem braços com as
 * braçadeiras e os grilhões no chão. Sem gente e sem sangue: a história é o ferro gasto, a ferrugem e o couro.
 *
 * NA 3/4 a cadeira deriva pelas sombras (`tresQuartos.ts`): os postes, a chapa do encosto, os pés da frente e a
 * gaveta são colunas; o assento e os braços, tampos soltos (cada braçadeira sobe com o braço dela, a metade
 * aberta presa a ele pela caixa de pintura). A face do encosto que a 3/4 varre é ferro liso; de frente (sem
 * giro) a cinta que desce por ela, a fivela, os rebites, a tala de través e os escorridos de ferrugem, e a
 * argola da gaveta, são desenhados na tela e presos a PINOS (um ponto sem tamanho nem tinta, como os do cofre):
 * de cima a peça guardada some (`soNoLugar`), na 3/4 ela volta ao lugar. Girada, a cena só serve à 3/4 e essas
 * peças da frente não entram: o desenho lê `c.giro`.
 *
 * Materiais: `madeira` (os postes, a moldura do assento e os braços). O ferro, a ferrugem, o couro e a cinza são
 * fixos. Escreve `cena.corDoPiso` (o escuro do ferro): com o da nogueira a chapa na sombra saía marrom. As
 * larguras são frações da pegada (1 x 1 casa de partida) e o miúdo (rebites, braçadeiras, grilhões) tem o
 * tamanho do menor lado.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, menos, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { BURACO, G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

/** O ferro batido da chapa, escuro, e o das ferragens miúdas, um pouco mais claro. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.05)) }
/** O couro da cinta, curtido e escurecido de mão. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x52, 0x36] }
/** A cinza fria no fundo da gaveta. */
const CINZA_FRIA: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x88, 0x82] }
/** A ferrugem da sucata e da âncora: marrom-alaranjado, não laranja. */
const FERRUGEM: Rgb = rgb('#935f47')
const ESCORRIDO: MaterialDaPeca = { classe: 'liso', rgb: FERRUGEM }
/** No miolo da mancha ainda sobra um pouco do ferro de baixo. */
const FERRUGEM_CHEIA = 0.8
/** O brilho do ferro velho, bem abaixo do metal novo (0,42): a chapa gasta não espelha. */
const BRILHO_DO_FERRO = 0.24
/** O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão e da âncora. */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

// ---------- as medidas (px do protótipo na cadeira de 1 casa) ----------

/** Alturas em casas: o assento, os braços, a chapa do encosto, os postes (passam da chapa) e a gaveta. */
const ALTURA_DO_ASSENTO = 0.4
const ALTURA_DO_BRACO = 0.64
const ALTURA_DA_CHAPA = 0.94
const ALTURA_DOS_POSTES = 1.02
const ALTURA_DA_GAVETA = 0.2
/** A beirada padrão que a 3/4 dá ao tampo solto: o pé da frente para debaixo da do braço. */
const BEIRADA = 0.06 * G
/** As linhas da planta, em frações da meia pegada: os postes, a chapa, o assento, os braços, os pés e a gaveta. */
const POSTE = { x0: 0.6, x1: 0.86, y0: -0.9, y1: -0.64 }
const CHAPA = { x: 0.62, y0: -0.84, y1: -0.7 }
const ASSENTO = { x: 0.6, y0: -0.7, y1: 0.54 }
const BRACO = { x0: 0.59, x1: 0.84, y0: -0.66, y1: 0.6 }
const PE = { x0: 0.6, x1: 0.84, y0: 0.36, y1: 0.6 }
const GAVETA = { x: 0.38, y0: 0.5, y1: 0.76 }
/** A quina dos postes e dos pés, em fração do lado: chanfrada, a 3/4 corre o veio de pé (`ehRedonda`). */
const QUINA_DO_POSTE = 0.32
/** As orelhas de ferro dos pés: quanto saem do pé, quanto entram debaixo dele (px) e a meia largura (fração do lado do pé). */
const ORELHA = 2.6
const SOB_O_PE = 0.5
const MEIA_ORELHA = 0.32
/** A moldura de madeira do assento (px) e o passo dos rebites da chapa. */
const MOLDURA = 3.2
const PASSO_DOS_REBITES = 4.6
/** A braçadeira: o meio dela no braço (fração do meio fundo), o raio de fora e a grossura da argola. */
const BRACADEIRA_Y = 0.2
const RAIO_DA_BRACADEIRA = 3.3
const ARGOLA = 1
/** Os grilhões no chão: o meio (frações da meia pegada), o raio e a abertura (radianos). */
const GRILHAO = { x: 0.52, y: 0.84 }
const RAIO_DO_GRILHAO = 2.9
const ABERTURA_DO_GRILHAO = 0.9
/** A cinta de couro: de onde a onde ela passa por cima da chapa (frações da meia largura) e até que altura desce na frente (casas). */
const CINTA = { x0: -0.27, x1: -0.08 }
const FIM_DA_CINTA = 0.56
/** A tala de través na face do encosto (altura em casas) e o passo dos rebites da face. */
const TALA = 0.74
const PASSO_DOS_REBITES_DA_FACE = 4.8

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A ferrugem em manchas (a da âncora), nunca em listras: onde o ruído passa do limiar o tom vai para a ferrugem. */
function texFerrugem(quanto: number): Textura {
  const metal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    if (metal !== null) metal(u, v, x, y, p, s, escala)
    const mancha = ruido(x * 0.09 + p.su, y * 0.09 + p.sv) * 1.5 + ruido(x * 0.32 + p.sv, y * 0.32 + p.su) * 0.9 + ruido(x * 1.1 + p.su, y * 1.1) * 0.55
    const q = (mancha + quanto - 0.2) / 0.5
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] -= t * 0.05
  }
}

/** A cinza fria no fundo da gaveta: o pó claro em manchas, mais grosso nos cantos. */
const texDaCinza: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.16 + ruido(x * 1.6, y * 1.6) * 0.06
  s[5] = limitar(0.55 + ruido(x * 0.24 + p.sv, y * 0.24) * 1.2, 0.2, 1)
}

// ---------- os pinos da frente (o molde do cofre e da gaiola com aves) ----------

const RAIO_DO_PINO = 1e-6
const FORA_DO_PINO = 1e3
const BORDA_DO_PINO = 0.05

/** O pino: um tampo solto de um ponto só, sem sombra nem tinta, que dá à 3/4 a altura e a ordem do grupo. */
function pino(cena: Cena, x: number, y: number, z: number): void {
  const ponto: Forma = { b: [x, y, x, y], d: (px, py) => (Math.abs(px - x) < RAIO_DO_PINO && Math.abs(py - y) < RAIO_DO_PINO ? -1 : FORA_DO_PINO) }
  cena.sombras.push({ forma: ponto, z, solta: true, forca: 0, suave: BORDA_DO_PINO })
}

/** A peça só é pintada com `dy` zero: guardada (de cima) ela some; a 3/4 a sobe de volta para o lugar. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): é o meio da caixa que a 3/4 lê para achar a estrutura. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** Uma peça desenhada na tela da 3/4 (de frente, sem giro). */
interface DaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta'>
}

function caixaDe(lista: readonly DaFrente[]): Caixa {
  return [
    Math.min(...lista.map((d) => d.forma.b[0])),
    Math.min(...lista.map((d) => d.forma.b[1])),
    Math.max(...lista.map((d) => d.forma.b[2])),
    Math.max(...lista.map((d) => d.forma.b[3])),
  ]
}

/**
 * Guarda o grupo da frente `chao - meio` abaixo do lugar, preso ao pino em (meio x, `chao`): a 3/4 pinta o
 * grupo na ordem do `chao` entre as estruturas da cadeira, e o sobe de volta.
 */
function porNaFrente(c: ContextoDoMovel, cena: Cena, chao: number, lista: readonly DaFrente[]): void {
  const b = caixaDe(lista)
  const x = (b[0] + b[2]) / 2
  const meio = (b[1] + b[3]) / 2
  const z = chao - meio
  pino(cena, x, chao, z)
  for (const { forma, mat, o } of lista) cena.partes.push(c.peca(presa(forma, x, meio), mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
}

// ---------- a cadeira de cima ----------

interface Planta {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  /** O tamanho do miúdo: 1 na cadeira de 1 casa. */
  readonly k: number
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
}

function rebite(p: Planta, x: number, y: number, r: number, semente: number): void {
  p.L.push(p.c.peca(elipse(x, y, r, r), FERRAGEM, { bisel: r * 0.85, tom: 1.22, contorno: 0.26, metal: 0.42, semente }))
}

/**
 * As orelhas de ferro que chumbam um pé no chão: uma do lado de fora e uma na ponta (atrás nos postes, na
 * frente nos pés da frente), cada uma com o parafuso. São orelhas, e não uma chapa debaixo do pé inteiro, para
 * o meio delas ficar fora da coluna do pé: a chapa inteira subia com a coluna na 3/4 e virava o topo do poste.
 */
function sapata(p: Planta, pe: Forma, lado: number, frente: number, semente: number): void {
  const { L, k } = p
  const [x0, y0, x1, y1] = pe.b
  const largo = ORELHA * k
  const sobra = SOB_O_PE * k
  const meia = (y1 - y0) * MEIA_ORELHA
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const doLado = lado > 0 ? caixa(x1 - sobra, my - meia, x1 + largo, my + meia, 0.6 * k) : caixa(x0 - largo, my - meia, x0 + sobra, my + meia, 0.6 * k)
  const daPonta = frente > 0 ? caixa(mx - meia, y1 - sobra, mx + meia, y1 + largo, 0.6 * k) : caixa(mx - meia, y0 - largo, mx + meia, y0 + sobra, 0.6 * k)
  ;[doLado, daPonta].forEach((orelha, i) => {
    L.push(p.c.peca(orelha, FERRO, { tabua: 0, bisel: 0.7 * k, tom: 0.92, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.12), semente: semente + i }))
  })
  rebite(p, lado > 0 ? x1 + largo * 0.55 : x0 - largo * 0.55, my, 0.8 * k, semente + 2)
  rebite(p, mx, frente > 0 ? y1 + largo * 0.55 : y0 - largo * 0.55, 0.8 * k, semente + 3)
}

/** O grilhão aberto no chão: as duas meias-argolas abertas na dobradiça e a corrente curta até o pé. */
function grilhao(p: Planta, cx: number, cy: number, lado: number, presoEm: Ponto, semente: number): void {
  const { c, L, k } = p
  const P = c.peca
  const r = RAIO_DO_GRILHAO * k
  const dobradica: Ponto = [cx + lado * r * 0.9, cy - r * 0.35]
  // A corrente: elos alternados, de frente (o anel) e de lado (o risco), da sapata até a dobradiça.
  const elos = 4
  for (let i = 0; i < elos; i += 1) {
    const t = (i + 0.5) / elos
    const ex = presoEm[0] + (dobradica[0] - presoEm[0]) * t
    const ey = presoEm[1] + (dobradica[1] - presoEm[1]) * t
    const ang = Math.atan2(dobradica[1] - presoEm[1], dobradica[0] - presoEm[0])
    const [ux, uy] = [Math.cos(ang) * 1.1 * k, Math.sin(ang) * 1.1 * k]
    const elo = i % 2 === 0 ? menos(capsula(ex - ux, ey - uy, ex + ux, ey + uy, 0.95 * k), capsula(ex - ux * 0.6, ey - uy * 0.6, ex + ux * 0.6, ey + uy * 0.6, 0.35 * k)) : capsula(ex - ux, ey - uy, ex + ux, ey + uy, 0.42 * k)
    L.push(P(elo, FERRAGEM, { bisel: 0.4 * k, tom: 1.05, contorno: 0.28, metal: 0.3, semente: semente + i, projeta: { dist: 0.5, forca: 0.24, suave: 0.5 } }))
  }
  // As duas meias-argolas: a de baixo no lugar, a de cima aberta na dobradiça.
  const meia = (giro: number): Forma => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= 12; i += 1) {
      const a = giro + (Math.PI * i) / 12
      pontos.push([dobradica[0] + Math.cos(a) * r - Math.cos(giro) * r, dobradica[1] + Math.sin(a) * r - Math.sin(giro) * r])
    }
    return cadeia(pontos, ARGOLA * 0.62 * k)
  }
  const base = lado > 0 ? 0 : Math.PI
  L.push(P(meia(base), FERRO, { bisel: 0.6 * k, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.18), semente: semente + 5, projeta: { dist: 0.6, forca: 0.3, suave: 0.6 } }))
  L.push(P(meia(base + lado * (Math.PI + ABERTURA_DO_GRILHAO)), FERRO, { bisel: 0.6 * k, tom: 1.08, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.18), semente: semente + 6, projeta: { dist: 0.6, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(dobradica[0], dobradica[1], 1.15 * k, 1.15 * k), FERRAGEM, { bisel: 0.8 * k, tom: 1.15, contorno: 0.28, metal: 0.4, semente: semente + 7 }))
}

/** A gaveta das brasas puxada para fora: a caixa de ferro, o fundo com o pó da cinza fria e a argola na frente. */
function gaveta(p: Planta, forma: Forma): void {
  const { c, L, k } = p
  const P = c.peca
  const [x0, y0, x1, y1] = forma.b
  const parede = 1.1 * k
  L.push(P(forma, FERRO, { tabua: 0, bisel: 0.6 * k, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.1), semente: 6301 }))
  const fundo = caixa(x0 + parede, y0, x1 - parede, y1 - parede, 0.4 * k)
  L.push(P(fundo, FERRO, { tabua: 0, bisel: 0.3, tom: 0.62, contorno: 0.1, recesso: { k: 1.6, forca: 0.4 }, semente: 6302 }))
  L.push(P(fundo, CINZA_FRIA, { bisel: 0, contorno: 0, alfa: 0.55, textura: texDaCinza, semente: 6303 }))
  // A argola de puxar, caída para a frente na beira da gaveta.
  const ax = (x0 + x1) / 2
  L.push(P(anel(ax, y1 + 0.6 * k, 1.9 * k, 1.1 * k, 1.1 * k, 0.45 * k), FERRAGEM, { bisel: 0.4 * k, tom: 1.1, contorno: 0.28, metal: 0.4, semente: 6304 }))
}

/** O assento: a moldura de madeira, a chapa rebitada dentro dela, gasta no meio. */
function assento(p: Planta, forma: Forma): void {
  const { c, L, k } = p
  const P = c.peca
  const [x0, y0, x1, y1] = forma.b
  const mad = c.m.madeira
  L.push(P(forma, mad, { tabua: 0, bisel: 1.2, contorno: 0.24, semente: 6310 }))
  const m = MOLDURA * k
  const chapa = caixa(x0 + m, y0 + m * 0.4, x1 - m, y1 - m, 0.8 * k)
  L.push(P(chapa, FERRO, { tabua: 0, bisel: 1 * k, contorno: 0.24, metal: BRILHO_DO_FERRO, recesso: { k: 1.2, forca: 0.22 }, textura: texFerrugem(0.06), semente: 6311 }))
  const [cx0, cy0, cx1, cy1] = chapa.b
  const r = 0.62 * k
  const passo = PASSO_DOS_REBITES * k
  const nx = Math.max(2, Math.round((cx1 - cx0) / passo))
  const ny = Math.max(2, Math.round((cy1 - cy0) / passo))
  for (let i = 0; i <= nx; i += 1) {
    const x = cx0 + 1.6 * k + ((cx1 - cx0 - 3.2 * k) * i) / nx
    rebite(p, x, cy0 + 1.5 * k, r, 6320 + i)
    rebite(p, x, cy1 - 1.5 * k, r, 6340 + i)
  }
  for (let j = 1; j < ny; j += 1) {
    const y = cy0 + 1.5 * k + ((cy1 - cy0 - 3 * k) * j) / ny
    rebite(p, cx0 + 1.6 * k, y, r, 6360 + j)
    rebite(p, cx1 - 1.6 * k, y, r, 6380 + j)
  }
  // O gasto do meio da chapa: o ferro mais claro e liso onde se sentou, e uns riscos.
  const [mx, my] = [(cx0 + cx1) / 2, (cy0 + cy1) / 2 + 1.5 * k]
  L.push(P(elipse(mx, my, (cx1 - cx0) * 0.28, (cy1 - cy0) * 0.26), FERRAGEM, { bisel: 0, contorno: 0, alfa: 0.3, suave: 3 * k, semente: 6399 }))
  for (let i = 0; i < 5; i += 1) {
    const ax = mx + (hash(i, 1, 6400) - 0.5) * (cx1 - cx0) * 0.5
    const ay = my + (hash(i, 2, 6400) - 0.5) * (cy1 - cy0) * 0.5
    const ang = (hash(i, 3, 6400) - 0.5) * 2
    const meio = (1.5 + hash(i, 4, 6400) * 2) * k
    L.push(P(capsula(ax - Math.cos(ang) * meio, ay - Math.sin(ang) * meio, ax + Math.cos(ang) * meio, ay + Math.sin(ang) * meio, 0.2 * k), FERRAGEM, { bisel: 0, contorno: 0, alfa: 0.35, tom: 1.3, semente: 6401 + i }))
  }
}

/**
 * O braço: a tábua larga com a ponteira de ferro e a braçadeira aberta. A metade aberta passa da beira de fora
 * do braço: a caixa dela é presa ao meio da braçadeira, para subir com o braço na 3/4.
 */
function braco(p: Planta, forma: Forma, lado: number, projecao: number, semente: number): void {
  const { c, L, k } = p
  const P = c.peca
  const [x0, y0, x1, y1] = forma.b
  const mad = c.m.madeira
  L.push(P(forma, mad, { tabua: 0, bisel: 1.2, contorno: 0.24, semente, projeta: { dist: projecao, forca: 0.3, suave: 1.2 } }))
  L.push(P(caixa(x0, y1 - 3.4 * k, x1, y1, 0.6 * k), FERRO, { tabua: 0, bisel: 0.7 * k, contorno: 0.26, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.14), semente: semente + 1 }))
  for (const f of [0.3, 0.7]) rebite(p, x0 + (x1 - x0) * f, y1 - 1.7 * k, 0.55 * k, semente + 2)
  // A braçadeira: a sela de ferro de través com o rebaixo do pulso, a dobradiça na beira de fora e a metade aberta.
  const by = p.Y(BRACADEIRA_Y)
  const r = RAIO_DA_BRACADEIRA * k
  const meioX = (x0 + x1) / 2
  L.push(P(caixa(x0 - 0.3 * k, by - r, x1 + 0.3 * k, by + r, 0.8 * k), FERRO, { tabua: 0, bisel: 0.9 * k, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.16), semente: semente + 3 }))
  L.push(P(elipse(meioX, by, (x1 - x0) * 0.32, r * 0.62), BURACO, { bisel: 0.6 * k, contorno: 0, recesso: { k: 1, forca: 0.45 }, tom: 1.3, semente: semente + 4 }))
  const xDaDobradica = lado > 0 ? x1 + 0.3 * k : x0 - 0.3 * k
  const aberta: Ponto[] = []
  for (let i = 0; i <= 12; i += 1) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12
    aberta.push([xDaDobradica + lado * Math.cos(a) * r, by + Math.sin(a) * r])
  }
  L.push(P(presa(cadeia(aberta, ARGOLA * 0.7 * k), meioX, by), FERRO, { bisel: 0.65 * k, tom: 1.08, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.2), semente: semente + 5, projeta: { dist: 1, forca: 0.3, suave: 0.8 } }))
  L.push(P(capsula(xDaDobradica, by - r * 0.9, xDaDobradica, by + r * 0.9, 0.95 * k), FERRAGEM, { bisel: 0.8 * k, tom: 1.15, contorno: 0.28, metal: 0.4, semente: semente + 6 }))
  // O ferrolho do lado de dentro, onde a metade de cima fecha.
  const xDoFerrolho = lado > 0 ? x0 + 0.9 * k : x1 - 0.9 * k
  L.push(P(caixa(xDoFerrolho - 0.9 * k, by - 1.3 * k, xDoFerrolho + 0.9 * k, by + 1.3 * k, 0.4 * k), FERRAGEM, { tabua: 0, bisel: 0.5 * k, tom: 1.1, contorno: 0.28, metal: 0.4, semente: semente + 7 }))
}

/** O alto do encosto: a chapa entre os postes, os rebites do topo e a cinta de couro passada por cima. */
function encosto(p: Planta, chapa: Forma, projecao: number): void {
  const { c, L, k, X } = p
  const P = c.peca
  const [x0, y0, x1, y1] = chapa.b
  L.push(P(chapa, FERRO, { tabua: 0, bisel: 0.9 * k, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.2), semente: 6500, projeta: { dist: projecao, forca: 0.34, suave: 1.6 } }))
  const n = Math.max(3, Math.round((x1 - x0) / (PASSO_DOS_REBITES * k)))
  for (let i = 0; i <= n; i += 1) rebite(p, x0 + 1.5 * k + ((x1 - x0 - 3 * k) * i) / n, (y0 + y1) / 2, 0.55 * k, 6501 + i)
  // A cinta: passa por cima da chapa (sobra um tanto na frente, onde ela começa a descer) e cai atrás.
  const cinta = caixa(X(CINTA.x0), y0 - 1.6 * k, X(CINTA.x1), y1 + 1.8 * k, 0.6 * k)
  L.push(P(cinta, COURO, { tabua: 0, bisel: 0.8 * k, contorno: 0.26, semente: 6520, projeta: { dist: 0.6, forca: 0.28, suave: 0.5 } }))
  for (const y of [y0 - 0.6 * k, y1 + 0.8 * k]) L.push(P(capsula(X(CINTA.x0) + 1 * k, y, X(CINTA.x1) - 1 * k, y, 0.18 * k), COURO, { bisel: 0, contorno: 0, tom: 0.7, alfa: 0.7 }))
}

/** O poste de trás visto do alto: o topo de madeira, o capuz de ferro rebitado e o pináculo. */
function topoDoPoste(p: Planta, forma: Forma, projecao: number, semente: number): void {
  const { c, L, k } = p
  const P = c.peca
  const [x0, y0, x1, y1] = forma.b
  L.push(P(forma, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.2, contorno: 0.26, semente, projeta: { dist: projecao, forca: 0.32, suave: 1.6 } }))
  const sobra = 0.9 * k
  L.push(P(caixa(x0 + sobra, y0 + sobra, x1 - sobra, y1 - sobra, 1 * k), FERRO, { tabua: 0, bisel: 1.6 * k, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.16), semente: semente + 1 }))
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2]
  L.push(P(elipse(mx, my, 1.4 * k, 1.4 * k), FERRAGEM, { bisel: 1.2 * k, tom: 1.2, contorno: 0.26, metal: 0.45, semente: semente + 2 }))
}

// ---------- a frente da 3/4 (sem giro) ----------

/** A face do encosto na tela da 3/4: a tala de través, os rebites, os escorridos de ferrugem e a cinta com a fivela. */
function faceDoEncosto(p: Planta, cena: Cena, chapa: Forma, zChapa: number, chao: number): void {
  const { c, k, X } = p
  const g = c.g
  const [x0, , x1, yFrente] = chapa.b
  const naTela = (x: number, z: number): Ponto => [x, yFrente - z]
  const lista: DaFrente[] = []
  const rebiteDaFace = (x: number, z: number): void => {
    lista.push({ forma: elipse(...naTela(x, z), 0.62 * k, 0.62 * k), mat: FERRAGEM, o: { bisel: 0.55 * k, tom: 1.2, contorno: 0.26, metal: 0.42 } })
  }
  // Os escorridos de ferrugem, debaixo de tudo: descem dos rebites do topo.
  for (const [f, comprido] of [[-0.42, 0.2], [0.16, 0.28], [0.5, 0.16]] as const) {
    const x = X(f)
    lista.push({ forma: capsula(...naTela(x, zChapa - 2 * k), ...naTela(x + 0.3 * k, zChapa - comprido * g), 0.7 * k), mat: ESCORRIDO, o: { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.9 * k } })
  }
  // A tala de través, com os rebites dela.
  const zTala = TALA * g
  lista.push({ forma: caixa(x0 + 0.4 * k, yFrente - zTala - 1.3 * k, x1 - 0.4 * k, yFrente - zTala + 1.3 * k, 0.4 * k), mat: FERRO, o: { tabua: 0, bisel: 0.8 * k, tom: 1.02, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(0.22) } })
  const n = Math.max(3, Math.round((x1 - x0) / (PASSO_DOS_REBITES_DA_FACE * k)))
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + 1.6 * k + ((x1 - x0 - 3.2 * k) * i) / n
    rebiteDaFace(x, zChapa - 1.6 * k)
    rebiteDaFace(x, zTala)
  }
  for (const z of [0.82, 0.66, 0.52]) {
    rebiteDaFace(x0 + 1.6 * k, z * g)
    rebiteDaFace(x1 - 1.6 * k, z * g)
  }
  // A cinta de couro descendo pela face, a ponta furada e a fivela de ferro no fim dela.
  const [cx0, cx1] = [X(CINTA.x0), X(CINTA.x1)]
  const zFim = FIM_DA_CINTA * g
  lista.push({ forma: caixa(cx0, yFrente - zChapa - 1.6 * k, cx1, yFrente - zFim, 0.6 * k), mat: COURO, o: { tabua: 0, bisel: 0.8 * k, contorno: 0.28 } })
  for (const z of [zFim + 4 * k, zFim + 7 * k]) lista.push({ forma: elipse((cx0 + cx1) / 2, yFrente - z, 0.42 * k, 0.42 * k), mat: BURACO, o: { bisel: 0.2, contorno: 0 } })
  const fivela = menos(caixa(cx0 - 0.8 * k, yFrente - zFim - 0.6 * k, cx1 + 0.8 * k, yFrente - zFim + 3.4 * k, 0.6 * k), caixa(cx0 + 0.4 * k, yFrente - zFim + 0.5 * k, cx1 - 0.4 * k, yFrente - zFim + 2.3 * k))
  lista.push({ forma: fivela, mat: FERRAGEM, o: { bisel: 0.5 * k, tom: 1.12, contorno: 0.3, metal: 0.42 } })
  lista.push({ forma: capsula((cx0 + cx1) / 2, yFrente - zFim + 0.6 * k, (cx0 + cx1) / 2, yFrente - zFim + 2.6 * k, 0.3 * k), mat: FERRAGEM, o: { bisel: 0.25 * k, tom: 1.2, contorno: 0.26, metal: 0.42 } })
  porNaFrente(c, cena, chao, lista)
}

/** A argola da gaveta na tela da 3/4: a chapinha com o grampo e a argola caída na frente da gaveta. */
function frenteDaGaveta(p: Planta, cena: Cena, forma: Forma, zGaveta: number, chao: number): void {
  const { c, k } = p
  const [x0, , x1, yFrente] = forma.b
  const ax = (x0 + x1) / 2
  const zGrampo = zGaveta * 0.72
  const lista: DaFrente[] = [
    { forma: caixa(ax - 1.7 * k, yFrente - zGrampo - 1.1 * k, ax + 1.7 * k, yFrente - zGrampo + 1.1 * k, 0.4 * k), mat: FERRAGEM, o: { tabua: 0, bisel: 0.5 * k, tom: 1.05, contorno: 0.28, metal: 0.36 } },
    { forma: anel(ax, yFrente - zGrampo + 2.6 * k, 2.1 * k, 2.1 * k, 1.3 * k, 1.3 * k), mat: FERRAGEM, o: { bisel: 0.45 * k, tom: 1.12, contorno: 0.3, metal: 0.42 } },
  ]
  porNaFrente(c, cena, chao, lista)
}

export const montarCadeiraDeInterrogatorio: MontarMovel = (c, cena) => {
  const { hw, hh, g } = c
  const k = Math.min(c.w, c.h) / G
  const X = (f: number): number => f * hw
  const Y = (f: number): number => f * hh
  const p: Planta = { c, L: cena.partes, k, X, Y }
  const q = ((Math.round(c.giro / 90) % 4) + 4) % 4
  cena.corDoPiso = ESCURO_DO_FERRO

  const zAssento = ALTURA_DO_ASSENTO * g
  const zBraco = ALTURA_DO_BRACO * g
  const zChapa = ALTURA_DA_CHAPA * g
  const zPoste = ALTURA_DOS_POSTES * g
  const zGaveta = ALTURA_DA_GAVETA * g
  const ladoDoPoste = (POSTE.x1 - POSTE.x0) * hw
  const postes = [-1, 1].map((s) => caixa(s < 0 ? X(-POSTE.x1) : X(POSTE.x0), Y(POSTE.y0), s < 0 ? X(-POSTE.x0) : X(POSTE.x1), Y(POSTE.y1), QUINA_DO_POSTE * ladoDoPoste))
  const pes = [-1, 1].map((s) => caixa(s < 0 ? X(-PE.x1) : X(PE.x0), Y(PE.y0), s < 0 ? X(-PE.x0) : X(PE.x1), Y(PE.y1), QUINA_DO_POSTE * ladoDoPoste))
  const chapa = caixa(X(-CHAPA.x), Y(CHAPA.y0), X(CHAPA.x), Y(CHAPA.y1), 0.4 * k)
  const formaDoAssento = caixa(X(-ASSENTO.x), Y(ASSENTO.y0), X(ASSENTO.x), Y(ASSENTO.y1), 1.2 * k)
  const bracos = [-1, 1].map((s) => caixa(s < 0 ? X(-BRACO.x1) : X(BRACO.x0), Y(BRACO.y0), s < 0 ? X(-BRACO.x0) : X(BRACO.x1), Y(BRACO.y1), 1.2 * k))
  const formaDaGaveta = caixa(X(-GAVETA.x), Y(GAVETA.y0), X(GAVETA.x), Y(GAVETA.y1), 0.6 * k)

  // 1. As sombras, que na 3/4 são a estrutura: os postes, a chapa, os pés e a gaveta são colunas; o assento e os
  // braços, tampos soltos.
  for (const poste of postes) cena.sombras.push({ forma: poste, z: zPoste }, contato(poste, 0.34))
  cena.sombras.push({ forma: chapa, z: zChapa, forca: 0.3 })
  for (const pe of pes) cena.sombras.push({ forma: pe, z: zBraco - BEIRADA, suave: 0.9, forca: 0.3 }, contato(pe, 0.34))
  cena.sombras.push({ forma: formaDoAssento, z: zAssento, solta: true, suave: 1.6, forca: 0.26 })
  for (const b of bracos) cena.sombras.push({ forma: b, z: zBraco, solta: true, suave: 1.6, forca: 0.24 })
  cena.sombras.push({ forma: formaDaGaveta, z: zGaveta, forca: 0.3 }, contato(formaDaGaveta, 0.3))

  // 2. No chão: as sapatas aparafusadas e os grilhões abertos, cada um preso ao pé da frente do lado dele.
  postes.forEach((poste, i) => sapata(p, poste, i === 0 ? -1 : 1, -1, 6600 + i * 3))
  pes.forEach((pe, i) => sapata(p, pe, i === 0 ? -1 : 1, 1, 6610 + i * 3))
  pes.forEach((pe, i) => {
    const lado = i === 0 ? -1 : 1
    // A corrente pega na orelha da frente do pé, do lado de dentro.
    const presoEm: Ponto = [(pe.b[0] + pe.b[2]) / 2 - lado * 1.2 * k, pe.b[3] + ORELHA * 0.55 * k]
    grilhao(p, X(lado * GRILHAO.x), Y(GRILHAO.y), -lado, presoEm, 6620 + i * 10)
  })

  // 3. A gaveta puxada, o assento, os braços, o encosto e o alto dos postes, de baixo para cima.
  gaveta(p, formaDaGaveta)
  assento(p, formaDoAssento)
  bracos.forEach((b, i) => braco(p, b, i === 0 ? -1 : 1, (zBraco - zAssento) * 0.3, 6700 + i * 10))
  encosto(p, chapa, (zChapa - zAssento) * 0.22)
  postes.forEach((poste, i) => topoDoPoste(p, poste, (zPoste - zAssento) * 0.22, 6800 + i * 3))

  // 4. A frente que só a 3/4 de frente mostra, presa a pinos: a face do encosto (o pino fica entre a frente da
  // chapa e a dos postes, para ela sair depois da chapa e antes dos postes, que tapam as pontas da tala, e do
  // assento, que a tapa embaixo; no meio do assento o pino roubava o assento, que subia junto) e a argola da
  // gaveta (depois da coluna da gaveta).
  if (q === 0) {
    faceDoEncosto(p, cena, chapa, zChapa, (chapa.b[3] + postes[0].b[3]) / 2)
    frenteDaGaveta(p, cena, formaDaGaveta, zGaveta, formaDaGaveta.b[3] + 0.5)
  }
}
