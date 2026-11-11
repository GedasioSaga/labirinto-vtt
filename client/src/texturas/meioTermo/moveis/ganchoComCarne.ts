/**
 * GANCHO COM CARNE PENDURADA de cima com volume (lote 5 dos objetos novos,
 * 11/11/2026): o varal da despensa. Uma TRAVE de madeira sobre dois postes,
 * cada um numa sapata atravessada, com ganchos de ferro e, pendurados na
 * frente dela, um PRESUNTO, uma RÉSTIA DE LINGUIÇAS e uma AVE DEPENADA. É alto
 * e fino: de cima aparecem a trave com os ganchos de ferro por cima, as
 * sapatas, o ALTO de cada peça (o couro do presunto com a ponta do osso
 * amarrada, os gomos da linguiça, o corpo claro da ave com as asas) e, longe
 * no chão, a sombra de cada uma e a da trave.
 *
 * NA 3/4 AS PEÇAS APARECEM DE FRENTE, penduradas: o presunto com o corte em V
 * (a gordura clara e a carne curada), a guirlanda de linguiças entre dois
 * ganchos com o rabo que sobra, a ave de cabeça para baixo, amarrada pelos pés,
 * e um gancho vazio. A armação a 3/4 deriva sozinha das sombras: os postes e as
 * sapatas são colunas e a trave, o tampo no ar, com a beirada da grossura dela.
 * Sem sangue: a carne é curada e a ave, limpa.
 *
 * COMO AS PEÇAS CHEGAM NA 3/4. A 3/4 não redesenha o móvel: sobe cada peça da
 * vista de cima a altura da estrutura em que ela está, mexendo no `dy` dela
 * (`tresQuartos.ts`). Daí as duas regras deste arquivo, as mesmas da
 * prateleira de potes:
 * - a peça DE UMA VISTA SÓ só é pintada quando está no lugar em que foi
 *   desenhada, com `dy` zero (`soNoLugar`). O alto de cada peça nasce no lugar
 *   e some quando a 3/4 o sobe; a peça de frente nasce deslocada para baixo a
 *   altura da âncora dela e só aparece quando a 3/4 a sobe de volta;
 * - cada peça pendurada tem uma ÂNCORA (`ancorar`): uma estrutura de um ponto
 *   só, que não pinta nada e só diz à 3/4 a altura do grupo e a ordem (do
 *   norte para o sul, pela base: a peça fica na frente ou atrás da trave e dos
 *   postes conforme o lugar dela no chão).
 *
 * COM O OBJETO GIRADO a 3/4 dá o quarto de volta na cena antes de subir as
 * peças, e a cena só serve à 3/4. Por isso o desenho lê `c.giro`: girado, ele
 * não põe o alto das peças e as desenha já como ficam para quem olha (de
 * costas, atrás da trave; de lado, de perfil, em fila ao longo da trave, com a
 * guirlanda fugindo para o fundo), desgiradas na fábrica (`novaTela`).
 *
 * O perfil do tipo tem de ser `{ modo: 'derivado', espessura:
 * ESPESSURA_DA_TRAVE_DO_GANCHO }`. As peças têm o tamanho do menor lado
 * (1,5 x 0,5 casas de partida) e o varal esticado repete o jogo de peças a cada
 * casa e meia. Material: `madeira` (a armação); o ferro, a corda e as carnes
 * são fixos.
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, dentroDe, elipse, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas da armação ----------

/** A pegada de partida, em casas: as peças penduradas têm o tamanho de desenho nela. */
const FUNDO_DE_PARTIDA = 0.5
const LARGURA_DE_PARTIDA = 1.5
/** Alturas em casas: o alto da trave e dos postes, e as sapatas. */
const ALTURA = 1.3
const ALTURA_DA_SAPATA = 0.075
/**
 * A grossura da trave (px do protótipo): a beirada que o perfil do tipo tem de
 * trazer (`{ modo: 'derivado', espessura: ESPESSURA_DA_TRAVE_DO_GANCHO }`). Com
 * a padrão (0,06 casa) a trave sai fina como uma ripa.
 */
export const ESPESSURA_DA_TRAVE_DO_GANCHO = 0.1 * G
/** A folga da pegada, a meia largura da trave, o poste (ao comprido e no fundo) e a largura da sapata (px do protótipo). */
const FOLGA = 0.4
const MEIA_TRAVE = 2.6
const POSTE = 5.6
const FUNDO_DO_POSTE = 4.4
const SAPATA = 5.6
/**
 * A quina do poste, em fração do fundo dele: chanfrada o bastante para a 3/4
 * ler o poste como redondo e correr o veio de pé (`ehRedonda` em
 * `tresQuartos.ts`); com a quina viva o veio ia deitado.
 */
const QUINA_DO_POSTE = 0.32
/** As peças pendem na frente da trave, a esta distância do meio dela, e o gancho acaba isto abaixo da trave (px do protótipo). */
const PENDE = 4.6
const ABAIXO_DA_TRAVE = 1.6

// ---------- os materiais fixos ----------

/** O ferro dos ganchos e a corda das amarras. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.92)) }
const BARBANTE: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x72, 0x4c] }
/** O presunto: o couro curado, a ponta do osso, a gordura do corte e a carne curada. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0xae, 0x7c, 0x58] }
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd2, 0xba] }
const GORDURA: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xcc, 0xa8] }
const CARNE: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x60, 0x56] }
/** A linguiça defumada e o brilho da tripa. */
const LINGUICA: MaterialDaPeca = { classe: 'liso', rgb: [0x98, 0x5c, 0x4c] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xc8, 0xb4] }
/** A ave depenada: a pele clara, a dobra dela, os pés, o bico e a crista. */
const PELE: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xc6, 0xa4] }
const DOBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x6c, 0x54] }
const PE_DA_AVE: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xac, 0x70] }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xa2, 0x62] }
const CRISTA: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x62, 0x58] }

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** O couro curado: manchas largas de defumação, sem listra. */
const texDeCouro: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.22 + p.su, y * 0.22 + p.sv) * 0.16 + ruido(x * 0.9 + p.sv, y * 0.9) * 0.04
}

/** A carne curada: as fibras e o marmoreio, em manchas claras miúdas. */
const texDeCarne: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.7 + p.su, y * 1.6 + p.sv) * 0.16
}

/** A pele depenada: lisa, com os poros em pontinhos escuros. */
const texDePele: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 0.07
  if (hash(Math.floor(x * 1.7), Math.floor(y * 1.7), p.semente) > 0.86) s[3] -= 0.07
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
 * some quando sobe, e a de frente (nasce deslocada a altura da âncora) aparece
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
/** O que só aparece de cima sobe quase nada na 3/4: o bastante para sair do lugar e sumir. */
const QUASE_NADA = 0.02

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

/** A peça de uma vista só não tem deslocamento nem sombra própria (a sombra dela cairia na outra vista). */
type OpcoesDaVista = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Põe uma peça num grupo (a lista vai de trás para a frente). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaVista) => void

/** Um grupo que só aparece na vista de cima, em volta de (x, y): fora de qualquer estrutura, sobe quase nada na 3/4 e some. */
function grupoDeCima(P: CriarPeca, cena: Cena, x: number, y: number): Por {
  ancorar(cena, 0, x, y, QUASE_NADA)
  return (forma, mat, o = {}) => {
    cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
}

/** A tela da 3/4: quem desenha nela escreve em coordenadas da tela, com a pegada já girada. */
interface Tela {
  /**
   * Abre um grupo de peças que sobem juntas. (x, base) = o ponto do chão que
   * dá a ordem do grupo (fora de toda estrutura da armação); `meio` = o y da
   * tela em volta do qual ficam as caixas de pintura, acima da base.
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

// ---------- as peças penduradas, de frente ----------

/** O que cada peça pendurada recebe para se desenhar. */
interface Prancheta {
  readonly por: Por
  /** Do desenho da peça (x de través, y para BAIXO a partir do olho do gancho) para a tela. */
  readonly em: (p: Ponto) => Ponto
  /** Quanto o x do desenho vale na tela: 1 de frente, menos de perfil (sem o sinal do espelho). */
  readonly largura: number
  /** Para que lado o desenho está virado: 1, ou -1 espelhado (visto de costas). */
  readonly espelho: number
  readonly k: number
  readonly semente: number
}

function pontos(t: Prancheta, lista: readonly Ponto[]): Forma {
  return poligono(lista.map(t.em))
}

function oval(t: Prancheta, x: number, y: number, rx: number, ry: number): Forma {
  const [cx, cy] = t.em([x, y])
  return elipse(cx, cy, Math.max(0.5, rx * t.largura * t.k), ry * t.k)
}

function ovalGirado(t: Prancheta, x: number, y: number, rx: number, ry: number, giro: number): Forma {
  const [cx, cy] = t.em([x, y])
  return elipseGirada(cx, cy, Math.max(0.5, rx * t.largura * t.k), ry * t.k, giro * t.espelho * t.largura)
}

function fio(t: Prancheta, a: Ponto, b: Ponto, raio: number): Forma {
  const [ax, ay] = t.em(a)
  const [bx, by] = t.em(b)
  return capsula(ax, ay, bx, by, raio)
}

/** Quanto o gancho sobe do olho até a trave (no desenho da peça) e o olho dele. */
const HASTE_DO_GANCHO = 7.6
const OLHO_DO_GANCHO = { fora: 1.45, dentro: 0.65 }

/** O gancho de ferro: a haste que desce da trave e o olho onde a peça é enfiada. */
function gancho(t: Prancheta): void {
  t.por(fio(t, [0, -HASTE_DO_GANCHO / t.k], [0, -0.4], 0.55), FERRO, { bisel: 0.5, contorno: 0.28, metal: 0.4 })
  const [ox, oy] = t.em([0, 0.5])
  t.por(anel(ox, oy, OLHO_DO_GANCHO.fora, OLHO_DO_GANCHO.fora, OLHO_DO_GANCHO.dentro, OLHO_DO_GANCHO.dentro), FERRO, { bisel: 0.5, contorno: 0.28, metal: 0.4 })
}

/** O presunto pendurado pelo jarrete: a corda, a ponta do osso, o couro curado e o corte em V com a gordura e a carne. */
function presunto(t: Prancheta): void {
  const { k } = t
  gancho(t)
  t.por(fio(t, [0, 1], [0, 3.8], 0.45), BARBANTE, { bisel: 0.3, contorno: 0.2 })
  t.por(oval(t, 0, 4.5, 1.6, 1.4), OSSO, { bisel: 1, contorno: 0.28 })
  const corpo = uniao(oval(t, 0, 20.6, 7.2, 9.2), pontos(t, [[-1.8, 5], [1.8, 5], [4.3, 12.5], [6.5, 17.6], [-6.5, 17.6], [-4.3, 12.5]]))
  t.por(corpo, COURO, { bisel: 4.2 * k * Math.min(1, t.largura + 0.3), contorno: 0.3, textura: texDeCouro, semente: t.semente })
  // O corte: o couro aparado em arco, a gordura clara em volta e a carne curada no meio.
  const corte = dentroDe(oval(t, 0, 20.8, 6.1, 8.1), oval(t, 0, 27.6, 8.6, 12.4))
  t.por(corte, GORDURA, { bisel: 1.2 * k, contorno: 0.18, semente: t.semente + 1 })
  const magro = dentroDe(oval(t, 0, 21.6, 4.5, 6.3), oval(t, 0, 28.6, 6.6, 10.4))
  t.por(magro, CARNE, { bisel: 1.6 * k, contorno: 0.14, textura: texDeCarne, semente: t.semente + 2 })
  t.por(fio(t, [-2.3, 7], [2.3, 7], 0.55), BARBANTE, { bisel: 0.4, contorno: 0.2 })
}

/** O raio de um gomo da linguiça e o quanto cada ponta dele encolhe para dar lugar ao nó (px do desenho). */
const RAIO_DO_GOMO = 1.55
const NO_DO_GOMO = 0.55

/** Os gomos de linguiça ao longo dos pontos, cada um com o brilho da tripa, e o nó de barbante entre dois deles. */
function gomos(t: Prancheta, caminho: readonly Ponto[], semente: number): void {
  for (let i = 1; i < caminho.length; i += 1) {
    const [ax, ay] = caminho[i - 1]
    const [bx, by] = caminho[i]
    const l = Math.hypot(bx - ax, by - ay) || 1
    const ux = ((bx - ax) / l) * NO_DO_GOMO
    const uy = ((by - ay) / l) * NO_DO_GOMO
    const a: Ponto = [ax + ux, ay + uy]
    const b: Ponto = [bx - ux, by - uy]
    t.por(fio(t, a, b, RAIO_DO_GOMO * t.k), LINGUICA, { bisel: 1.3 * t.k, contorno: 0.3, tom: 0.93 + 0.14 * hash(i, semente, 951), semente: semente + i })
    t.por(fio(t, [a[0] - 0.5, a[1] - 0.2], [(a[0] + b[0]) / 2 - 0.5, (a[1] + b[1]) / 2 - 0.2], 0.36), BRILHO, { bisel: 0, contorno: 0, alfa: 0.32 })
  }
  for (let i = 1; i < caminho.length - 1; i += 1) {
    const [nx, ny] = t.em(caminho[i])
    t.por(elipse(nx, ny, 0.75, 0.75), BARBANTE, { bisel: 0.4, contorno: 0.2 })
  }
}

/**
 * A réstia de linguiças entre dois ganchos, `vao` adiante um do outro no
 * desenho: a guirlanda de gomos que cai de um e sobe para o outro, e o rabo
 * que sobra pendurado no segundo.
 */
function linguicas(t: Prancheta, vao: number): void {
  const fundo = Math.min(14, vao * 0.95)
  const guirlanda: Ponto[] = [[0, 1.4], [vao * 0.07, fundo * 0.5], [vao * 0.24, fundo * 0.85], [vao * 0.5, fundo], [vao * 0.76, fundo * 0.85], [vao * 0.93, fundo * 0.5], [vao, 1.4]]
  const rabo: Ponto[] = [[vao, 1.8], [vao + 0.7, 7.4], [vao + 0.2, 13], [vao + 0.9, 18.4]]
  gancho(t)
  gancho({ ...t, em: ([x, y]) => t.em([x + vao, y]) })
  gomos(t, guirlanda, t.semente)
  gomos(t, rabo, t.semente + 20)
}

/** A ave depenada, de cabeça para baixo: os pés amarrados no gancho, as coxas, as asas coladas ao corpo, o pescoço e a cabeça caída. */
function ave(t: Prancheta): void {
  const { k } = t
  gancho(t)
  t.por(fio(t, [0, 1], [0, 3], 0.4), BARBANTE, { bisel: 0.3, contorno: 0.2 })
  for (const lado of [-1, 1]) t.por(fio(t, [lado * 0.7, 2.8], [lado * 1.6, 7.2], 0.7 * k), PE_DA_AVE, { bisel: 0.6, contorno: 0.28 })
  t.por(fio(t, [-1.7, 3.6], [1.7, 3.6], 0.5), BARBANTE, { bisel: 0.3, contorno: 0.2 })
  for (const lado of [-1, 1]) t.por(ovalGirado(t, lado * 5.2, 16.4, 1.9, 4.6, lado * 0.22), PELE, { bisel: 1.3 * k, tom: 0.9, contorno: 0.3, textura: texDePele, semente: t.semente + 3 })
  for (const lado of [-1, 1]) t.por(ovalGirado(t, lado * 2.6, 10.4, 2.1, 3.9, -lado * 0.28), PELE, { bisel: 1.8 * k, contorno: 0.28, textura: texDePele, semente: t.semente + 1 })
  t.por(oval(t, 0, 17.2, 5.6, 7.8), PELE, { bisel: 3.8 * k * Math.min(1, t.largura + 0.3), contorno: 0.3, textura: texDePele, semente: t.semente })
  t.por(fio(t, [0, 12.8], [0, 21.4], 0.32), DOBRA, { bisel: 0, contorno: 0, alfa: 0.28 })
  t.por(fio(t, [0, 24], [0.7, 28.6], 1.35 * k), PELE, { bisel: 1.1 * k, tom: 0.94, contorno: 0.28, semente: t.semente + 5 })
  t.por(oval(t, 1, 30.2, 2, 1.7), PELE, { bisel: 1.3 * k, tom: 0.9, contorno: 0.3 })
  t.por(pontos(t, [[2.5, 30], [4.5, 31.2], [2.4, 31.6]]), BICO, { bisel: 0.4, contorno: 0.28 })
  t.por(oval(t, 0.1, 31.8, 1, 0.6), CRISTA, { bisel: 0.4, contorno: 0.2 })
}

// ---------- o alto das peças, de cima ----------

/** O presunto visto do alto, em volta de (x, y): o couro largo, a ponta do osso no meio, com a volta da corda. */
function presuntoDeCima(por: Por, x: number, y: number, k: number, semente: number): void {
  por(elipse(x, y, 6.6 * k, 4.7 * k), COURO, { bisel: 3.4 * k, contorno: 0.3, textura: texDeCouro, semente })
  por(anel(x, y, 2.6 * k, 2.5 * k, 1.7 * k, 1.6 * k), BARBANTE, { bisel: 0.4, contorno: 0.2 })
  por(elipse(x, y, 1.6 * k, 1.5 * k), OSSO, { bisel: 1, contorno: 0.28 })
}

/** A réstia vista do alto, de um gancho (x) ao outro (x + vao): os gomos em fila, um pouco fora de linha, e o rabo, de ponta. */
function linguicasDeCima(por: Por, x: number, y: number, vao: number, k: number, semente: number): void {
  const elos = Math.max(2, Math.round(vao / (5.2 * k)))
  const passo = vao / elos
  for (let i = 0; i < elos; i += 1) {
    const ya = y + (i % 2 === 0 ? 0.5 : -0.4) * k
    const yb = y + (i % 2 === 0 ? -0.4 : 0.5) * k
    por(capsula(x + i * passo + 0.7, ya, x + (i + 1) * passo - 0.7, yb, RAIO_DO_GOMO * k), LINGUICA, { bisel: 1.3 * k, contorno: 0.3, tom: 0.93 + 0.14 * hash(i, semente, 951), semente: semente + i })
  }
  por(elipse(x + vao + 0.9 * k, y + 1.2 * k, 1.7 * k, 1.7 * k), LINGUICA, { bisel: 1.5 * k, contorno: 0.3, semente: semente + 30 })
}

/** A ave vista do alto: as asas dos lados, o corpo claro e os dois pés amarrados no meio. */
function aveDeCima(por: Por, x: number, y: number, k: number, semente: number): void {
  for (const lado of [-1, 1]) por(elipse(x + lado * 4.9 * k, y + 0.3 * k, 1.8 * k, 3 * k), PELE, { bisel: 1.3 * k, tom: 0.9, contorno: 0.3, textura: texDePele, semente: semente + 3 })
  por(elipse(x, y, 5.1 * k, 4.3 * k), PELE, { bisel: 3.2 * k, contorno: 0.3, textura: texDePele, semente })
  for (const lado of [-1, 1]) por(elipse(x + lado * 1 * k, y - 0.2 * k, 1.1 * k, 1.1 * k), PE_DA_AVE, { bisel: 0.8, contorno: 0.28 })
  por(capsula(x - 1.7 * k, y - 0.2 * k, x + 1.7 * k, y - 0.2 * k, 0.45), BARBANTE, { bisel: 0.3, contorno: 0.2 })
}

// ---------- a montagem ----------

/** O que pende de um jogo de ganchos, pelo lugar ao longo da trave (fração da meia largura do jogo). */
const LUGAR_DO_PRESUNTO = -0.68
const LUGAR_DO_GANCHO_VAZIO = -0.37
const LUGARES_DA_LINGUICA: readonly [number, number] = [-0.16, 0.26]
const LUGAR_DA_AVE = 0.72
/** A meia largura de um jogo no tamanho de partida (px do protótipo): as peças encolhem se o jogo for mais apertado. */
const MEIO_JOGO_DE_PARTIDA = 33.9
/** De perfil a peça tem esta parte da largura de frente, e a guirlanda abre só isto para o lado. */
const PERFIL = 0.6
const PERFIL_DA_GUIRLANDA = 0.12
/** A altura do meio de uma peça pendurada abaixo do gancho (px do desenho): onde ficam a âncora e a sombra dela. */
const MEIO_DA_PECA = 16
/** A sombra de cada peça no chão: os dois raios em px do desenho (o maior ao longo da luz), a borda e a força. */
const SOMBRA_DA_PECA = { ao: 8, atraves: 4.4, suave: 2.6, forca: 0.25 }
const GIRO_DA_SOMBRA = Math.atan2(SOMBRA_Y, SOMBRA_X)

/** As medidas do varal já no tamanho do móvel. */
interface Varal {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  /** Os quartos de volta do objeto na 3/4. */
  readonly q: number
  /** A escala das peças penduradas. */
  readonly k: number
  /** A altura da trave e a do olho dos ganchos (px do protótipo). */
  readonly H: number
  readonly zDoGancho: number
  /** O meio de cada poste ao longo da trave e a meia largura de cada jogo de peças. */
  readonly xDoPoste: number
  readonly meioJogo: number
  /** O meio de cada jogo ao longo da trave. */
  readonly jogos: readonly number[]
}

/** A armação vista de cima: as sapatas, os postes debaixo da trave e a trave; `antes` põe o que fica debaixo da trave. */
function montarArmacao(v: Varal, antes: () => void): void {
  const { c, cena, H, xDoPoste } = v
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const trave = caixa(-hw + FOLGA, -MEIA_TRAVE, hw - FOLGA, MEIA_TRAVE, 0.7)
  cena.sombras.push({ forma: trave, z: H, solta: true, forca: 0.2 })
  for (const lado of [-1, 1]) {
    const xp = lado * xDoPoste
    // A sapata em duas metades, uma de cada lado do poste: a de trás fica atrás dele na 3/4 e a da frente passa na frente do pé.
    for (const [i, [ya, yb]] of ([[-hh + FOLGA, -FUNDO_DO_POSTE / 2], [FUNDO_DO_POSTE / 2, hh - FOLGA]] as const).entries()) {
      const metade = caixa(xp - SAPATA / 2, ya, xp + SAPATA / 2, yb, 1.1)
      cena.sombras.push({ forma: metade, z: g * ALTURA_DA_SAPATA }, contato(metade, 0.3))
      L.push(P(metade, mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.88, contorno: 0.26, semente: 4500 + i + (lado > 0 ? 2 : 0) }))
    }
    // O poste vai até o alto, a meia-madeira com a trave; de cima o topo dele fica debaixo dela.
    const poste = caixa(xp - POSTE / 2, -FUNDO_DO_POSTE / 2, xp + POSTE / 2, FUNDO_DO_POSTE / 2, QUINA_DO_POSTE * FUNDO_DO_POSTE)
    cena.sombras.push({ forma: poste, z: H, forca: 0.26 })
    L.push(P(poste, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.84, semente: 4505 + (lado > 0 ? 1 : 0) }))
  }
  antes()
  L.push(P(trave, mad, { tabua: 0, bisel: 1.3, contorno: 0.26, semente: 4508, projeta: { dist: 1, forca: 0.2 } }))
  // A cavilha que prende a trave em cada poste.
  for (const lado of [-1, 1]) L.push(P(elipse(lado * xDoPoste, 0, 0.85, 0.85), mad, { tabua: 0, bisel: 0.5, tom: 0.62, contorno: 0.2 }))
}

/** O gancho visto de cima: a volta de ferro por cima da trave, saindo para a frente, onde a peça pende. */
function ganchoDeCima(v: Varal, x: number): void {
  v.cena.partes.push(v.c.peca(capsula(x, -MEIA_TRAVE + 0.7, x, PENDE - 0.6, 0.6), FERRO, { bisel: 0.5, contorno: 0.28, metal: 0.4, projeta: { dist: 0.6, forca: 0.28, suave: 0.6 } }))
}

/** O que pende do varal: o tipo e o lugar ao longo da trave (em coordenadas do objeto); a linguiça vai de `x` a `ate`. */
interface Pendurado {
  readonly tipo: 'presunto' | 'linguicas' | 'ave' | 'vazio'
  readonly x: number
  readonly ate: number
  readonly semente: number
}

function pendurados(v: Varal): Pendurado[] {
  return v.jogos.flatMap((meio, j): Pendurado[] => {
    const em = (f: number): number => meio + f * v.meioJogo
    const semente = 4600 + j * 80
    return [
      { tipo: 'presunto', x: em(LUGAR_DO_PRESUNTO), ate: em(LUGAR_DO_PRESUNTO), semente },
      { tipo: 'vazio', x: em(LUGAR_DO_GANCHO_VAZIO), ate: em(LUGAR_DO_GANCHO_VAZIO), semente: semente + 10 },
      { tipo: 'linguicas', x: em(LUGARES_DA_LINGUICA[0]), ate: em(LUGARES_DA_LINGUICA[1]), semente: semente + 20 },
      { tipo: 'ave', x: em(LUGAR_DA_AVE), ate: em(LUGAR_DA_AVE), semente: semente + 60 },
    ]
  })
}

/** O alto de cada peça, visto de cima, debaixo da trave (só sem giro: girada, a cena só serve à 3/4). */
function porAltoDasPecas(v: Varal, lista: readonly Pendurado[]): void {
  const { c, cena, k } = v
  for (const p of lista) {
    if (p.tipo === 'vazio') continue
    const meio = (p.x + p.ate) / 2
    const por = grupoDeCima(c.peca, cena, meio, PENDE - 0.01)
    if (p.tipo === 'presunto') presuntoDeCima(por, p.x, PENDE, k, p.semente)
    else if (p.tipo === 'linguicas') linguicasDeCima(por, p.x, PENDE, p.ate - p.x, k, p.semente)
    else aveDeCima(por, p.x, PENDE, k, p.semente)
  }
}

/** A sombra de uma peça pendurada no chão, caída para baixo à direita NA TELA a partir do ponto (x, y) da pegada já girada. */
function sombraDaPeca(v: Varal, x: number, y: number): void {
  const z = v.zDoGancho - MEIO_DA_PECA * v.k
  const forma = elipseGirada(x + SOMBRA_X * z, y + SOMBRA_Y * z, SOMBRA_DA_PECA.ao * v.k, SOMBRA_DA_PECA.atraves * v.k, GIRO_DA_SOMBRA)
  v.cena.sombras.push({ forma: girarForma(forma, (4 - v.q) % 4), z: 0, suave: SOMBRA_DA_PECA.suave, forca: SOMBRA_DA_PECA.forca })
}

/** As mãos-francesas entre cada poste e a trave, de frente ou de costas (px do protótipo): quanto descem e quanto avançam. */
const MAO_FRANCESA = { desce: 13, avanca: 11, largura: 2.6 }
/** A base dos grupos que ficam no plano da trave: logo além da beira dela, fora da estrutura. */
const ALEM_DA_TRAVE = 0.1

/**
 * As peças penduradas, de frente, como ficam para quem olha. Cada uma é um
 * grupo com a base no ponto do chão em que pende (já girado): a 3/4 a pinta
 * na frente ou atrás da trave e dos postes conforme esse ponto.
 */
function porPecasPenduradas(v: Varal, tela: Tela, lista: readonly Pendurado[]): void {
  const { c, q, k, H, zDoGancho, xDoPoste } = v
  const mad = c.m.madeira
  const deLado = q % 2 === 1
  const espelho = q === 2 ? -1 : 1
  // De lado a trave foge para o fundo: para que lado da tela ficou a frente dela (onde as peças pendem) e o sentido do x do objeto.
  const [frente] = girarPonto(0, 1, q)
  const [, sentido] = girarPonto(1, 0, q)

  if (!deLado) {
    // As duas mãos-francesas, no plano da frente da trave.
    const [, plano] = girarPonto(0, MEIA_TRAVE + ALEM_DA_TRAVE, q)
    for (const lado of [-1, 1]) {
      const dentro = lado * (xDoPoste - POSTE / 2)
      const yDoPoste = plano - (H - ESPESSURA_DA_TRAVE_DO_GANCHO - MAO_FRANCESA.desce)
      const yDaTrave = plano - (H - ESPESSURA_DA_TRAVE_DO_GANCHO) + MAO_FRANCESA.largura * 0.3
      const por = tela.grupo(dentro - lado * MAO_FRANCESA.avanca * 0.5, plano, (yDoPoste + yDaTrave) / 2)
      por(barra(dentro + lado * 0.4, yDoPoste, dentro - lado * MAO_FRANCESA.avanca, yDaTrave, MAO_FRANCESA.largura), mad, { eixo: Math.atan2(yDaTrave - yDoPoste, -lado * MAO_FRANCESA.avanca), tabua: 0, bisel: 0.9, tom: 0.86, contorno: 0.26, semente: 4520 + lado })
    }
  }

  // Do fundo para a frente da tela.
  const naTela = lista.map((p) => ({ p, ponto: girarPonto((p.x + p.ate) / 2, PENDE, q) })).sort((a, b) => a.ponto[1] - b.ponto[1])
  for (const { p, ponto } of naTela) {
    const [gx, gy] = girarPonto(p.x, PENDE, q)
    const olho = gy - zDoGancho
    const por = tela.grupo(ponto[0], ponto[1], ponto[1] - zDoGancho + MEIO_DA_PECA * k)
    const base = { por, k, semente: p.semente }
    if (!deLado) {
      const t: Prancheta = { ...base, largura: 1, espelho, em: ([x, y]) => [gx + espelho * x * k, olho + y * k] }
      if (p.tipo === 'presunto') presunto(t)
      else if (p.tipo === 'linguicas') linguicas(t, (p.ate - p.x) / k)
      else if (p.tipo === 'ave') ave(t)
      else gancho(t)
    } else {
      // De perfil: a haste do gancho sai do lado da trave; a guirlanda foge para o fundo, de um gancho ao outro.
      por(capsula(frente * (MEIA_TRAVE - 0.6), olho - HASTE_DO_GANCHO * 0.6, gx, olho - HASTE_DO_GANCHO * 0.6, 0.55), FERRO, { bisel: 0.5, contorno: 0.28, metal: 0.4 })
      const t: Prancheta = { ...base, largura: PERFIL, espelho: 1, em: ([x, y]) => [gx + x * PERFIL * k, olho + y * k] }
      if (p.tipo === 'presunto') presunto(t)
      else if (p.tipo === 'ave') ave(t)
      else if (p.tipo === 'vazio') gancho(t)
      else {
        por(capsula(frente * (MEIA_TRAVE - 0.6), olho + (p.ate - p.x) * sentido - HASTE_DO_GANCHO * 0.6, gx, olho + (p.ate - p.x) * sentido - HASTE_DO_GANCHO * 0.6, 0.55), FERRO, { bisel: 0.5, contorno: 0.28, metal: 0.4 })
        linguicas({ ...base, largura: PERFIL_DA_GUIRLANDA, espelho: 1, em: ([x, y]) => [gx + x * PERFIL_DA_GUIRLANDA * k * frente, olho + x * k * sentido + y * k] }, (p.ate - p.x) / k)
      }
    }
    if (p.tipo !== 'vazio') sombraDaPeca(v, ponto[0], ponto[1])
  }
}

export const montarGanchoComCarne: MontarMovel = (c, cena) => {
  const { hw, g } = c
  const q = quartosDoGiro(c.giro)
  const xDoPoste = hw - FOLGA - SAPATA / 2
  // As peças pendem entre os postes: o varal mais largo repete o jogo a cada casa e meia.
  const dentro = xDoPoste - POSTE / 2 - 2
  const quantos = Math.max(1, Math.round(c.w / (LARGURA_DE_PARTIDA * g)))
  const meioJogo = dentro / quantos
  const H = g * ALTURA
  const v: Varal = {
    c,
    cena,
    q,
    k: limitar(Math.min(c.h / (FUNDO_DE_PARTIDA * g), meioJogo / MEIO_JOGO_DE_PARTIDA), 0.7, 1.3),
    H,
    zDoGancho: H - ESPESSURA_DA_TRAVE_DO_GANCHO - ABAIXO_DA_TRAVE,
    xDoPoste,
    meioJogo,
    jogos: Array.from({ length: quantos }, (_, j) => -dentro + meioJogo * (2 * j + 1)),
  }
  const lista = pendurados(v)
  montarArmacao(v, () => {
    if (q === 0) porAltoDasPecas(v, lista)
  })
  for (const p of lista) {
    ganchoDeCima(v, p.x)
    if (p.tipo === 'linguicas') ganchoDeCima(v, p.ate)
  }
  porPecasPenduradas(v, novaTela(c.peca, cena, q), lista)
}
