/**
 * LÂMINA PENDULAR de cima com volume (lote L02 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`;
 * temas Dungeons, Cripta e Inferno): a armadilha do corredor. Uma VIGA grossa de madeira atravessa a pegada na beira de
 * cima (giro 0), cintada de ferro nas pontas; no meio dela, a CHAPA de pendurar com as duas BOCHECHAS de ferro e o
 * EIXO, de onde pende o BRAÇO, uma barra chata de ferro com o olho no alto e o colar embaixo; na ponta do braço, a
 * LÂMINA em meia-lua larga, de chifres para cima, presa por uma chapa rebitada: o corpo de aço escurecido com pontos
 * de ferrugem, o chanfro afiado e o FIO polido ao longo da curva de baixo, com dois dentes lascados. No chão, o SULCO
 * gasto do arco que o fundo da lâmina varre e os riscos claros dela. Desenho original: só a ideia da armadilha de
 * masmorra.
 *
 * Como a tocha e os grilhões de parede, o que pende é desenhado de frente (o braço desce da viga para a frente da
 * pegada): é o que diz "pêndulo" visto de cima e o que deixa o balanço LER, um giro no plano da tela em volta do eixo.
 *
 * A PEÇA QUE MEXE (contrato do I0-e, `lib/mobilia/animadores.ts`): `montarLaminaPendular` é só a parte parada (a viga,
 * a chapa, as bochechas, o eixo e o sulco no chão); `montarLaminaPendularQueMexe` é só o braço e a lâmina, em repouso
 * (a prumo), com a sombra pintada deles; `ANIMACAO_DO_LAMINA_PENDULAR` é o `oscilar` em volta do eixo. A versão
 * PARADA (a 1ª, a imagem do catálogo e a de "menos movimento") é `montarLaminaPendularParada`, as duas juntas; a
 * BALANÇANDO é a parte parada com o braço no animador (`versoes/laminaPendularVersoes.ts`).
 *
 * Rente ao chão na 3/4 (perfil derivado de `alturaSolta` 0,03 casa, o dos grilhões): nenhuma sombra tem altura, as
 * sombras pintadas caem para baixo à direita na tela (desgiradas). Pegada de partida 2 x 1,5 casas: o que é comprido
 * (a viga, o braço) sai da pegada; o que é redondo (a lâmina, o olho, os rebites), do menor lado. Materiais: `metal`
 * (a lâmina, o braço e as ferragens) e `madeira` (a viga). O sulco e a ferrugem são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, caixa, cadeia, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import type { AnimacaoDoMovel } from '../../../lib/mobilia/animadores'

/** A pegada de partida (px do protótipo): 2 x 1,5 casas. As medidas abaixo são desta pegada. */
const MEIA_LARGURA = 1 * G
const MEIA_ALTURA = 0.75 * G

/** O eixo, a partir da beira de cima, e a viga (a fundura dela). */
const Y_DO_EIXO = 6
const FUNDO_DA_VIGA = 10.5
/** O alto da lâmina no meio (onde o braço entra no soquete), a partir do eixo. */
const COMPRIMENTO_DO_BRACO = 61
/**
 * A meia-lua de chifres para cima: o disco de fora menos um disco de dentro MAIOR, que encosta no fim do braço. Sobra
 * a lua larga e baixa de lâmina de machado, `espessura` px de aço no meio e a ponta fina em cada chifre. (Na primeira
 * folha, de 28/11, a lua funda de chifres altos com o olho no alto do braço lia ÂNCORA; esta, com a chapa de prender
 * por cima, lê lâmina.)
 */
const LUA = { raio: 22, raioDeDentro: 26, espessura: 13 } as const
/**
 * O fio polido ao longo da curva de baixo, o chanfro afiado logo acima dele e os dois dentes lascados no fio (o
 * ângulo a partir do prumo, em graus).
 */
const FIO = 2.1
const CHANFRO = 1.7
const DENTES: readonly number[] = [-24, 31]
/** A chapa de prender a lâmina no braço: o trapézio que desce do braço e abre por cima do aço. */
const CHAPA_DA_LAMINA = { alto: 10, baixo: 5, meiaEmCima: 2.6, meiaEmbaixo: 8.6 } as const
/** O braço: meia largura da barra, o olho do alto (raios) e o colar (a distância dele acima da chapa da lâmina). */
const BRACO = { meia: 1.55, olho: 2.7, furo: 1.15, colar: 2 } as const
/** As bochechas da chapa de pendurar, de cada lado do olho, e o eixo com as porcas. */
const BOCHECHA = { de: 3.5, ate: 5.9 } as const
const EIXO = { meio: 7, raio: 1.05, porca: 1.6 } as const

/** O balanço: a abertura de cada lado e o período (ida e volta). Pêndulo pesado e lento, sem susto. */
const ABERTURA_EM_GRAUS = 28
const PERIODO_MS = 2600

/**
 * A peça que mexe para o animador `oscilar` (I0-e): o pivô é o eixo, no meio da largura e a `Y_DO_EIXO` px do alto
 * (fração da pegada; o eixo acompanha a pegada esticada, porque sai de `sy`).
 */
export const ANIMACAO_DO_LAMINA_PENDULAR: AnimacaoDoMovel = {
  animador: 'oscilar',
  pivo: { x: 0.5, y: Y_DO_EIXO / (2 * MEIA_ALTURA) },
  periodoMs: PERIODO_MS,
  amplitudeGraus: ABERTURA_EM_GRAUS,
}

/** O sulco do chão (fixo): o escuro de dentro e o risco claro da pedra arranhada. */
const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x35, 0x31] }
const RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xab, 0x9c] }
/** A ferrugem do aço e o escuro do furo do olho e dos dentes. */
const FERRUGEM: Rgb = [0x7a, 0x4e, 0x36]
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x27] }
/** O escuro em que o pixel escuro demais é levantado: o cinza quente do ferro (o de `braseiro.ts`). */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** A altura em que a lâmina e o braço passam do chão (px): a sombra pintada deles fica longe assim. */
const ALTURA_DA_LAMINA = 9

const DO_METAL = texturaDaClasse('metal')

/** O aço da lâmina: a textura do metal e as manchas de ferrugem, poucas e miúdas, nunca em listra. */
const texAcoComFerrugem: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  const mancha = ruido(x * 0.22 + p.su, y * 0.22 + p.sv) + ruido(x * 0.7 + p.sv, y * 0.7) * 0.35
  if (mancha <= 0.32) return
  const t = Math.min(1, (mancha - 0.32) / 0.3) * 0.55
  s[0] += (FERRUGEM[0] - s[0]) * t
  s[1] += (FERRUGEM[1] - s[1]) * t
  s[2] += (FERRUGEM[2] - s[2]) * t
  s[3] -= t * 0.12
}

/** O deslocamento do desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta. */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A sombra pintada de uma peça a `z` px do chão: afastada para baixo à direita na tela, sem altura. */
function sombraLonge(c: ContextoDoMovel, cena: Cena, forma: Forma, z: number, forca: number): void {
  const [dx, dy] = desgirado(SOMBRA_X * z, SOMBRA_Y * z, c.giro)
  cena.sombras.push({ forma: { b: [forma.b[0] + dx, forma.b[1] + dy, forma.b[2] + dx, forma.b[3] + dy], d: (x, y) => forma.d(x - dx, y - dy) }, z: 0, suave: 1.6, forca })
}

/** As medidas na pegada: o eixo, o alto da lâmina no meio, o fundo dela e a régua do que é redondo. */
interface Regua {
  readonly sx: number
  readonly sy: number
  readonly k: number
  readonly yEixo: number
  readonly ySoquete: number
  readonly yFundo: number
}

function reguaDe(c: ContextoDoMovel): Regua {
  const sx = c.hw / MEIA_LARGURA
  const sy = c.hh / MEIA_ALTURA
  const k = Math.min(sx, sy)
  const yEixo = -c.hh + Y_DO_EIXO * sy
  const ySoquete = yEixo + COMPRIMENTO_DO_BRACO * sy
  return { sx, sy, k, yEixo, ySoquete, yFundo: ySoquete + LUA.espessura * k }
}

/** Um rebite: a cabeça redonda que pega a luz. */
function rebite(c: ContextoDoMovel, cena: Cena, x: number, y: number, r: number, semente: number): void {
  cena.partes.push(c.peca(elipse(x, y, r, r), c.m.metal, { tabua: 0, bisel: r, tom: 1.3, metal: 0.55, contorno: 0.22, semente }))
}

// ---------- a parte parada ----------

/** O sulco do chão: o arco que o fio da lâmina varre no fundo do balanço, gasto, e os riscos claros em volta. */
function montarSulco(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const raio = r.yFundo - r.yEixo
  const arco = (de: number, ate: number, raioDoArco: number): Ponto[] => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= 12; i += 1) {
      const a = ((de + ((ate - de) * i) / 12) * Math.PI) / 180
      pontos.push([Math.sin(a) * raioDoArco, r.yEixo + Math.cos(a) * raioDoArco])
    }
    return pontos
  }
  cena.partes.push(c.peca(cadeia(arco(-ABERTURA_EM_GRAUS, ABERTURA_EM_GRAUS, raio), 1.5 * r.k), SULCO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 1.3 * r.k, recesso: { k: 0.8 * r.k, forca: 0.3 }, semente: 26000 }))
  cena.partes.push(c.peca(cadeia(arco(-15, 15, raio - 0.3 * r.k), 0.75 * r.k), SULCO, { bisel: 0, contorno: 0, alfa: 0.55, tom: 0.85, suave: 0.5 * r.k, semente: 26001 }))
  // Os riscos: a ponta da lâmina arranhou a pedra nos dois lados do sulco, cada risco de um comprimento.
  for (let i = 0; i < 7; i += 1) {
    const centro = (hash(i, 1, 260) - 0.5) * 2 * ABERTURA_EM_GRAUS
    const meio = 4 + 6 * hash(i, 2, 260)
    const raioDoRisco = raio + (hash(i, 3, 260) - 0.5) * 4.6 * r.k
    cena.partes.push(c.peca(cadeia(arco(centro - meio, centro + meio, raioDoRisco), 0.22 * r.k), RISCO, { bisel: 0, contorno: 0, alfa: 0.3 + 0.2 * hash(i, 4, 260), semente: 26010 + i }))
  }
}

/** A viga cintada, a chapa de pendurar, as bochechas e o eixo com as porcas. */
function montarViga(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const { hw, hh, peca: P } = c
  const { k, sx, sy, yEixo } = r
  const fundo = -hh + FUNDO_DA_VIGA * sy
  const viga = caixa(-hw, -hh, hw, fundo, 1.2 * k)
  sombraLonge(c, cena, viga, 5 * k, 0.24)
  cena.sombras.push(contato(viga, 0.3))
  cena.partes.push(P(viga, c.m.madeira, { tabua: 0, eixo: 0, bisel: 1.8 * k, tom: 0.92, contorno: 0.28, semente: 26100 }))
  // As cintas de ferro perto das pontas, com dois rebites cada.
  for (const lado of [-1, 1]) {
    const x = lado * (hw - 9 * sx)
    const cinta = caixa(x - 2.3 * k, -hh, x + 2.3 * k, fundo, 0.4 * k)
    cena.partes.push(P(cinta, c.m.metal, { tabua: 0, bisel: 0.7 * k, tom: 0.86, metal: 0.36, contorno: 0.26, projeta: { dist: 0.6 * k, forca: 0.26 }, semente: 26110 + lado }))
    for (const f of [0.3, 0.72]) rebite(c, cena, x, -hh + (fundo + hh) * f, 0.75 * k, 26120 + lado * 3 + f * 10)
  }
  // A chapa de pendurar na viga, com quatro rebites, e as duas bochechas que descem até o eixo.
  const chapa = caixa(-8 * k, -hh + 1.6 * sy, 8 * k, fundo - 1.4 * sy, 0.8 * k)
  cena.partes.push(P(chapa, c.m.metal, { tabua: 0, bisel: 0.8 * k, tom: 0.9, metal: 0.38, contorno: 0.28, projeta: { dist: 0.7 * k, forca: 0.28 }, semente: 26130 }))
  for (const x of [-6, 6]) for (const y of [0.3, 0.75]) rebite(c, cena, x * k, -hh + 1.6 * sy + (fundo - 1.4 * sy - (-hh + 1.6 * sy)) * y, 0.7 * k, 26131 + x + y * 10)
  for (const lado of [-1, 1]) {
    const bochecha = caixa(Math.min(lado * BOCHECHA.de, lado * BOCHECHA.ate) * k, -hh + 3 * sy, Math.max(lado * BOCHECHA.de, lado * BOCHECHA.ate) * k, yEixo + 3.2 * k, 0.9 * k)
    cena.sombras.push(contato(bochecha, 0.26))
    cena.partes.push(P(bochecha, c.m.metal, { tabua: 0, bisel: 0.8 * k, tom: 1, metal: 0.42, contorno: 0.3, projeta: { dist: 0.6 * k, forca: 0.3 }, semente: 26140 + lado }))
  }
  // O eixo atravessa as bochechas; as porcas nas pontas.
  cena.partes.push(P(capsula(-EIXO.meio * k, yEixo, EIXO.meio * k, yEixo, EIXO.raio * k), c.m.metal, { tabua: 0, bisel: EIXO.raio * k, tom: 1.08, metal: 0.5, contorno: 0.26, eixo: QUARTO, semente: 26150 }))
  for (const lado of [-1, 1]) {
    cena.partes.push(P(elipse(lado * EIXO.meio * k, yEixo, EIXO.porca * k, EIXO.porca * k), c.m.metal, { tabua: 0, bisel: EIXO.porca * k * 0.8, tom: 1.16, metal: 0.5, contorno: 0.3, semente: 26152 + lado }))
  }
}

export const montarLaminaPendular: MontarMovel = (c, cena) => {
  const r = reguaDe(c)
  cena.corDoPiso = ESCURO_DO_FERRO
  montarSulco(c, cena, r)
  montarViga(c, cena, r)
}

// ---------- a peça que mexe: o braço e a lâmina, em repouso ----------

export const montarLaminaPendularQueMexe: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const r = reguaDe(c)
  const { k, yEixo, ySoquete } = r
  cena.corDoPiso = ESCURO_DO_FERRO
  const aco = c.m.metal

  // A lua: o disco de fora menos o de dentro (maior, encostado no fim do braço); o fio e o chanfro são faixas da beira
  // de fora dela.
  const raio = LUA.raio * k
  const cy = r.yFundo - raio
  const raioDeDentro = LUA.raioDeDentro * k
  const lua = menos(elipse(0, cy, raio, raio), elipse(0, ySoquete - raioDeDentro, raioDeDentro, raioDeDentro))
  const fio = menos(lua, elipse(0, cy, raio - FIO * k, raio - FIO * k))
  const chanfro = dentroDe(lua, anel(0, cy, raio - FIO * k, raio - FIO * k, raio - (FIO + CHANFRO) * k, raio - (FIO + CHANFRO) * k))
  const { alto, baixo, meiaEmCima, meiaEmbaixo } = CHAPA_DA_LAMINA
  const chapa = poligono([
    [-meiaEmCima * k, ySoquete - alto * k],
    [meiaEmCima * k, ySoquete - alto * k],
    [meiaEmbaixo * k, ySoquete + baixo * k],
    [-meiaEmbaixo * k, ySoquete + baixo * k],
  ])
  const braco = caixa(-BRACO.meia * k, yEixo, BRACO.meia * k, ySoquete - (alto - 2) * k, 0.6 * k)
  const olho = anel(0, yEixo, BRACO.olho * k, BRACO.olho * k, BRACO.furo * k, BRACO.furo * k)
  sombraLonge(c, cena, uniao(lua, braco), ALTURA_DA_LAMINA * k, 0.22)

  // O braço (a barra chata), o olho em volta do eixo e o colar logo acima da chapa.
  cena.partes.push(P(braco, aco, { tabua: 0, eixo: QUARTO, bisel: 0.9 * k, tom: 0.92, metal: 0.4, contorno: 0.28, textura: texAcoComFerrugem, semente: 26200 }))
  cena.partes.push(P(olho, aco, { tabua: 0, bisel: 0.9 * k, tom: 1.04, metal: 0.45, contorno: 0.3, projeta: { dist: 0.5 * k, forca: 0.26 }, semente: 26201 }))
  const yColar = ySoquete - (alto + BRACO.colar) * k
  const colar = caixa(-2.4 * k, yColar - 1 * k, 2.4 * k, yColar + 1 * k, 0.6 * k)
  cena.partes.push(P(colar, aco, { tabua: 0, bisel: 0.7 * k, tom: 1.06, metal: 0.45, contorno: 0.28, semente: 26202 }))

  // A lâmina: o corpo escurecido com ferrugem, o chanfro afiado, o fio polido e os dois dentes lascados.
  cena.partes.push(P(lua, aco, { tabua: 0, bisel: 2.2 * k, tom: 0.8, metal: 0.42, contorno: 0.3, textura: texAcoComFerrugem, semente: 26210 }))
  cena.partes.push(P(chanfro, aco, { tabua: 0, bisel: 0, tom: 1.08, metal: 0.5, contorno: 0, alfa: 0.55, suave: 0.4 * k, semente: 26211 }))
  cena.partes.push(P(fio, aco, { tabua: 0, bisel: 0.6 * k, tom: 1.34, metal: 0.62, contorno: 0, alfa: 0.92, semente: 26212 }))
  DENTES.forEach((graus, i) => {
    const a = (graus * Math.PI) / 180
    const [x, y] = [Math.sin(a) * (raio - 0.3 * k), cy + Math.cos(a) * (raio - 0.3 * k)]
    // O dente é um corte raso ao longo do fio (deitado na tangente), não um furo redondo.
    cena.partes.push(P(elipseGirada(x, y, 1.5 * k, 0.55 * k, -a), FURO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.3 * k, semente: 26213 + i }))
  })

  // A chapa que prende a lâmina no braço, por cima do aço, com três rebites.
  cena.partes.push(P(chapa, aco, { tabua: 0, bisel: 1.1 * k, tom: 0.98, metal: 0.45, contorno: 0.3, projeta: { dist: 0.7 * k, forca: 0.3 }, semente: 26220 }))
  rebite(c, cena, 0, ySoquete - (alto - 3.4) * k, 0.8 * k, 26221)
  for (const lado of [-1, 1]) rebite(c, cena, lado * (meiaEmbaixo - 3) * k, ySoquete + (baixo - 2.2) * k, 0.8 * k, 26222 + lado)
  cena.partes.push(P(elipse(0, yEixo, BRACO.furo * k, BRACO.furo * k), FURO, { bisel: 0, contorno: 0, alfa: 0.4, semente: 26225 }))
}

/** A versão PARADA (a 1ª): a parte parada e a que mexe numa imagem só, a lâmina a prumo. */
export const montarLaminaPendularParada: MontarMovel = (c, cena) => {
  montarLaminaPendular(c, cena)
  montarLaminaPendularQueMexe(c, cena)
}
