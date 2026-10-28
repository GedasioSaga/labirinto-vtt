/**
 * VISTA 3/4 DOS MÓVEIS (fatia MT11): a cena "de cima com volume" de qualquer
 * móvel do catálogo vira a 3/4 do protótipo aprovado (`docs/design/objetos/
 * prototipo/objetos.js`, vista '34'): o TAMPO sobe pela altura do móvel e a
 * FRENTE aparece embaixo dele, mais escura (0,74, a `FRENTE` do protótipo),
 * com a base apoiada na pegada e a sombra de baixo no pé.
 *
 * As alturas não são inventadas aqui: saem das SOMBRAS que cada móvel já
 * declara na vista de cima. Sombra presa ao chão com altura (`z > 0`, sem
 * `solta`) é uma COLUNA (o corpo do barril, a perna da mesa, o mourão); sombra
 * `solta` é um TAMPO no ar (o da mesa, o assento, a trave do arco). Cada peça
 * sobe a altura da estrutura em que está (a mais alta que contém o meio
 * dela); cada coluna ganha a frente varrida do chão até a altura dela, e cada
 * tampo, a beirada. As estruturas saem do norte para o sul (a base mais ao sul
 * por cima), cada uma com a frente por baixo das peças dela.
 *
 * Os móveis que JÁ são desenhados em pé (a lápide, o quadro de avisos, a
 * barraca e a vista Lado dos tipos com vista) ficam como estão e ganham só a
 * sombra de baixo, como no protótipo (as colunas "Lado, de cima" e "Lado,
 * 3/4" da folha aprovada quase não diferem).
 *
 * GIRO: na 3/4 a frente fica sempre embaixo NA TELA. O quarto de volta do
 * objeto é pintado na cena (`girarCena`, com a luz e a sombra fixas, como a
 * placa de seta da MT5) antes de subir o tampo; o que sobra do giro gira a
 * imagem inteira, como sempre.
 */
import type { TipoMobilia } from '../../../lib/mobilia/tipos'
import { ALTURA_DA_LENHA_EM_TRES_QUARTOS } from '../../../lib/mobilia/vistaTresQuartos'
import { G, PREGO, QUARTO, type LadoDoMovel } from './contexto'
import { elipse, type Caixa, type Forma } from './formas'
import { SOMBRA_DO_TAPETE } from './tapete'
import { contato, type Cena, type CriarPeca, type CurvaY, type MaterialDaPeca, type Peca, type Sombra } from './motor'

/** A frente recebe menos luz que o tampo: o `FRENTE` do protótipo (`objetos.js:654`). */
export const TOM_DA_FRENTE = 0.74
/** Espessura padrão da beirada de um tampo solto (px do protótipo): a tábua grossa do tampo da mesa. */
export const ESPESSURA_DO_TAMPO = 0.06 * G
/** Força do contato da base com o chão na 3/4 (a sombra de baixo, firme, no pé). */
const FORCA_DA_SOMBRA_DE_BAIXO = 0.34

export type ModoDoTresQuartos = 'derivado' | 'em-pe'

export interface PerfilDoTresQuartos {
  readonly modo: ModoDoTresQuartos
  /** Quanto sobe a peça que não está em cima de nenhuma estrutura (px do protótipo): a lenha da fogueira. */
  readonly alturaSolta?: number
  /** Espessura da beirada de cada tampo solto (px do protótipo). */
  readonly espessura?: number
  /** Poste de ferro no meio (o lampião), com este raio (px do protótipo), do chão ao tampo mais alto. */
  readonly poste?: number
}

const DERIVADO: PerfilDoTresQuartos = { modo: 'derivado' }
const EM_PE: PerfilDoTresQuartos = { modo: 'em-pe' }

/** O perfil de cada tipo do catálogo. Um tipo novo no catálogo sem perfil não compila. */
export const PERFIS: Readonly<Record<TipoMobilia, PerfilDoTresQuartos>> = {
  barril: DERIVADO,
  caixa: DERIVADO,
  bau: DERIVADO,
  catre: DERIVADO,
  mesa: DERIVADO,
  cadeira: DERIVADO,
  cerca: DERIVADO,
  armario: DERIVADO,
  aparador: DERIVADO,
  fogueira: { modo: 'derivado', alturaSolta: ALTURA_DA_LENHA_EM_TRES_QUARTOS },
  // O tapete sobe a espessura dele inteiro, franja junto (a franja fica fora do corpo).
  tapete: { modo: 'derivado', alturaSolta: SOMBRA_DO_TAPETE.z },
  mesaQuadrada: DERIVADO,
  mesaRedonda: DERIVADO,
  // A lápide, o quadro e a barraca já são desenhados de frente, em pé (folha da MT4).
  lapide: EM_PE,
  vaso: DERIVADO,
  lampiao: { modo: 'derivado', poste: 0.035 * G },
  quadroDeAvisos: EM_PE,
  poco: DERIVADO,
  barraca: EM_PE,
  // O corpo da carroça é um caixote em cima das rodas: a beirada é a lateral dele.
  carroca: { modo: 'derivado', espessura: 0.3 * G },
  // A sombra da sebe é solta (MT5, para não arrastar), mas a sebe é maciça: a beirada vai até o chão.
  sebe: { modo: 'derivado', espessura: Infinity },
  jardineira: DERIVADO,
  arcoDoPortao: DERIVADO,
  placaDeSeta: DERIVADO,
  tapeteLongo: { modo: 'derivado', alturaSolta: SOMBRA_DO_TAPETE.z },
  // O chão queimado do fogo é rente ao chão, como o tapete sem espessura: nada sobe.
  fogo: DERIVADO,
  // Móveis de casa (28/10/2026): as alturas saem das sombras de cada um, como o armário.
  fogao: DERIVADO,
  geladeira: DERIVADO,
  pia: DERIVADO,
  balcao: DERIVADO,
}

/** O perfil do móvel nesta vista Frente/Lado: o de Lado já é desenhado em pé. */
export function perfilDoTresQuartos(tipo: TipoMobilia, lado: LadoDoMovel): PerfilDoTresQuartos {
  return lado === 'lado' ? EM_PE : PERFIS[tipo]
}

/**
 * O quarto de volta vai PINTADO na 3/4 (a frente fica embaixo na tela)? Sim
 * nos móveis derivados; a placa de seta já pinta o dela no desenho; o móvel
 * em pé gira a imagem inteira, como sempre.
 */
export function pintaOGiroNaTresQuartos(tipo: TipoMobilia, lado: LadoDoMovel): boolean {
  return tipo !== 'placaDeSeta' && perfilDoTresQuartos(tipo, lado).modo === 'derivado'
}

// ---------- varrer: a forma arrastada do chão até a altura ----------

/** Precisão da distância perto da borda (px do protótipo): o erro some no chanfro. */
const PASSO_MINIMO_DA_VARREDURA = 0.4
/** Longe da forma a distância exata não importa (a cobertura e o chanfro só leem perto da borda). */
const LONGE_DA_VARREDURA = 4
/** Fundo o bastante: nenhum chanfro passa disto. */
const FUNDO_DA_VARREDURA = -4

/**
 * A forma `f` arrastada para CIMA na tela de 0 a `altura` px (a parede de uma
 * coluna vista de frente): a menor distância de `f` ao longo da vertical,
 * andando em passos que a distância garante (a distância muda no máximo 1 por
 * px andado), com erro menor que `PASSO_MINIMO_DA_VARREDURA` perto da borda.
 */
export function varrer(f: Forma, altura: number): Forma {
  if (!(altura > 0)) return f
  const b = f.b
  return {
    b: [b[0], b[1] - altura, b[2], b[3]],
    d(x, y) {
      let melhor = Infinity
      let t = 0
      for (;;) {
        const v = f.d(x, y + t)
        if (v < melhor) {
          melhor = v
          if (melhor <= FUNDO_DA_VARREDURA) return melhor
        }
        if (t >= altura) return melhor
        const alvo = melhor < LONGE_DA_VARREDURA ? melhor : LONGE_DA_VARREDURA
        const passo = v - alvo + PASSO_MINIMO_DA_VARREDURA
        t = t + passo > altura ? altura : t + passo
      }
    },
  }
}

// ---------- girar a cena um quarto de volta ----------

type Quartos = 1 | 2 | 3

/** O ponto do móvel girado `q` quartos de volta no sentido da tela (y para baixo: horário). */
function girarPonto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : [y, -x]
}

/** O ponto da tela de volta no referencial do móvel. */
function desgirarPonto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : [-y, x]
}

function girarCaixa(b: Caixa, q: Quartos): Caixa {
  return q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
}

export function girarForma(f: Forma, q: Quartos): Forma {
  return {
    b: girarCaixa(f.b, q),
    d(x, y) {
      const [mx, my] = desgirarPonto(x, y, q)
      return f.d(mx, my)
    },
  }
}

/** A curva da tampa (normal inclinada ao longo de y) depois do giro: em y (meia volta) ou em x (quarto). */
function girarCurva(curva: CurvaY | undefined, q: Quartos): { curvaY: CurvaY | undefined; curvaX?: CurvaY } {
  if (curva === undefined) return { curvaY: undefined }
  if (q === 2) return { curvaY: { ...curva, c: -curva.c } }
  return { curvaY: undefined, curvaX: q === 1 ? { ...curva, c: -curva.c } : curva }
}

/**
 * A peça girada: a forma, o deslocamento, o veio, o centro do anel e do arco
 * e a curva giram; a luz, o recesso e a projeção ficam na tela (luz fixa). A
 * textura própria lê o ponto no referencial do móvel, com a peça de antes.
 */
function girarPeca(p: Peca, q: Quartos): Peca {
  const [dx, dy] = girarPonto(p.dx, p.dy, q)
  const giro = q * QUARTO
  const tex = p.tex
  const polar = p.polar === undefined ? undefined : (() => {
    const [cx, cy] = girarPonto(p.polar.cx, p.polar.cy, q)
    return { ...p.polar, cx, cy }
  })()
  const arco = p.arco === undefined ? undefined : (() => {
    const [cx, cy] = girarPonto(p.arco.cx, p.arco.cy, q)
    return { ...p.arco, cx, cy, a0: p.arco.a0 + giro }
  })()
  return {
    ...p,
    forma: girarForma(p.forma, q),
    dx,
    dy,
    eixo: p.eixo + giro,
    polar,
    arco,
    ...girarCurva(p.curvaY, q),
    tex:
      tex === null
        ? null
        : (u, v, x, y, _girada, s, escala) => {
            const [mx, my] = desgirarPonto(x, y, q)
            tex(u, v, mx, my, p, s, escala)
          },
  }
}

/** A cena girada `quartos` quartos de volta (0 = a mesma cena). */
export function girarCena(cena: Cena, quartos: number): Cena {
  const q = ((Math.round(quartos) % 4) + 4) % 4
  if (q === 0) return cena
  const qq = q as Quartos
  return {
    ...cena,
    partes: cena.partes.map((p) => girarPeca(p, qq)),
    sombras: cena.sombras.map((s) => ({ ...s, forma: girarForma(s.forma, qq) })),
  }
}

// ---------- a 3/4 ----------

interface Estrutura {
  readonly forma: Forma
  readonly z: number
  readonly coluna: boolean
  readonly partes: Peca[]
}

function areaDaCaixa(b: Caixa): number {
  return (b[2] - b[0]) * (b[3] - b[1])
}

/** A estrutura em que a peça está: a mais alta que contém o meio dela (empate: a menor, a mais justa). */
function estruturaDaPeca(p: Peca, estruturas: readonly Estrutura[]): Estrutura | null {
  const b = p.forma.b
  const cx = (b[0] + b[2]) / 2 + p.dx
  const cy = (b[1] + b[3]) / 2 + p.dy
  let achada: Estrutura | null = null
  for (const e of estruturas) {
    if (e.forma.d(cx, cy) > 0) continue
    if (achada === null || e.z > achada.z || (e.z === achada.z && areaDaCaixa(e.forma.b) < areaDaCaixa(achada.forma.b))) achada = e
  }
  return achada
}

/** O material da frente: o da maior peça da estrutura; sem peça, o da maior peça do móvel. */
function materialDaFrente(partes: readonly Peca[], todas: readonly Peca[]): MaterialDaPeca {
  const fonte = partes.length > 0 ? partes : todas
  let maior = fonte[0]
  for (const p of fonte) if (areaDaCaixa(p.forma.b) > areaDaCaixa(maior.forma.b)) maior = p
  return maior.mat
}

/** Forma redonda (o canto da caixa fica fora dela): o veio da frente corre de pé, como as aduelas do barril. */
function ehRedonda(f: Forma): boolean {
  const b = f.b
  const lado = Math.min(b[2] - b[0], b[3] - b[1])
  return f.d(b[0] + lado * 0.08, b[1] + lado * 0.08) > 0
}

/** A sombra de baixo do móvel em pé: um borrão achatado logo debaixo da base. */
function sombraDeBaixoDoEmPe(cena: Cena): Sombra | null {
  let x0 = Infinity
  let x1 = -Infinity
  let base = -Infinity
  for (const p of cena.partes) {
    if (p.alfa < 0.5) continue
    x0 = Math.min(x0, p.forma.b[0] + p.dx)
    x1 = Math.max(x1, p.forma.b[2] + p.dx)
    base = Math.max(base, p.forma.b[3] + p.dy)
  }
  if (!Number.isFinite(base)) return null
  const rx = ((x1 - x0) / 2) * 0.92
  return { forma: elipse((x0 + x1) / 2, base - 0.6, rx, Math.max(1.6, 0.05 * G)), z: 0, suave: 1.6, forca: FORCA_DA_SOMBRA_DE_BAIXO }
}

/**
 * A cena na vista 3/4. `peca` = a fábrica de peças com a semente do móvel
 * (a frente ganha veio próprio, sempre o mesmo para o mesmo desenho).
 */
export function cenaEmTresQuartos(cena: Cena, perfil: PerfilDoTresQuartos, peca: CriarPeca): Cena {
  if (perfil.modo === 'em-pe') {
    const sombra = sombraDeBaixoDoEmPe(cena)
    return sombra === null ? cena : { ...cena, sombras: [...cena.sombras, sombra] }
  }
  const estruturas: Estrutura[] = []
  for (const s of cena.sombras) {
    if (!(s.z > 0)) continue
    estruturas.push({ forma: s.forma, z: s.z, coluna: s.solta !== true, partes: [] })
  }
  if (perfil.poste !== undefined && estruturas.length > 0) {
    const topo = Math.max(...estruturas.map((e) => e.z))
    estruturas.push({ forma: elipse(0, 0, perfil.poste, perfil.poste), z: topo, coluna: true, partes: [] })
  }
  const soltas: Peca[] = []
  const alturaSolta = perfil.alturaSolta ?? 0
  for (const p of cena.partes) {
    const e = estruturaDaPeca(p, estruturas)
    if (e === null) soltas.push({ ...p, dy: p.dy - alturaSolta })
    else e.partes.push({ ...p, dy: p.dy - e.z })
  }
  // Do norte para o sul pela base da estrutura; na mesma base, a mais baixa antes (a cabeceira alta por cima do colchão).
  const ordem = estruturas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.forma.b[3] - b.e.forma.b[3] || a.e.z - b.e.z || a.i - b.i)
    .map(({ e }) => e)
  const partes: Peca[] = [...soltas]
  const sombras: Sombra[] = [...cena.sombras]
  ordem.forEach((e, i) => {
    const mat = materialDaFrente(e.partes, cena.partes)
    const veio = { eixo: ehRedonda(e.forma) ? QUARTO : 0, tom: TOM_DA_FRENTE, bisel: 0.8, contorno: 0.2, semente: 900 + i }
    if (e.coluna) {
      partes.push(peca(varrer(e.forma, e.z), e.partes.length > 0 ? mat : perfil.poste !== undefined ? PREGO : mat, veio))
      sombras.push(contato(e.forma, FORCA_DA_SOMBRA_DE_BAIXO))
    } else {
      const espessura = Math.min(perfil.espessura ?? ESPESSURA_DO_TAMPO, e.z)
      partes.push(peca(varrer(e.forma, espessura), mat, { ...veio, dy: -(e.z - espessura) }))
      // Beirada que desce até o chão (a sebe) apoia como coluna.
      if (espessura >= e.z) sombras.push(contato(e.forma, FORCA_DA_SOMBRA_DE_BAIXO))
    }
    partes.push(...e.partes)
  })
  return { ...cena, partes, sombras }
}
