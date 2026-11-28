/**
 * BONECO DE NEVE (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Neve):
 * três bolas de neve rolada empilhadas, a de baixo maior, a do meio e a cabeça, com a CARTOLA de feltro escuro meio
 * caída para trás, o NARIZ de cenoura apontando para a frente (o sul, no giro 0), os olhos e a boca de carvão, três
 * botões de carvão na bola do meio, os BRAÇOS de galho saindo dos lados e o CACHECOL de lã enrolado no pescoço, com a
 * ponta caída pela frente da bola do meio.
 *
 * De cima o que diz "boneco" é o nariz laranja saindo da cabeça, os galhos e o anel do cachecol; as bolas leem pelo
 * volume: cada uma pega a luz de cima à esquerda e cai no azul da neve do lado da sombra, e a de cima faz sombra na de
 * baixo (para baixo à direita NA TELA). A bola de baixo tem as pintas de terra que ela pegou ao ser rolada.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): cada bola é um corte por altura, e a luz de cada fatia
 * sai da normal da bola no ponto, NA TELA (o giro não leva a luz junto). Perfil da 3/4: `{ modo: 'derivado',
 * espessura: 0 }`. Versões: CLÁSSICO (este desenho, `montarBonecoDeNeve`) e DERRETENDO (`montarBonecoDeNeveDerretendo`,
 * registrado em `versoes/bonecoDeNeveVersoes.ts`): as bolas baixas e moles, a cabeça escorregando para a frente, a
 * cartola caída no chão, um braço caído na poça de neve derretida e um botão solto nela.
 *
 * Material: `cachecol` (tecido; a faixa da cartola é do mesmo pano). A neve, o carvão, a cenoura, os galhos e o feltro
 * são fixos. Os outros desenhos do L08 (o iglu, o trenó, o muro e o banco com neve) usam a neve daqui.
 */
import { type Rgb } from '../../ruido'
import { anel, cadeia, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { alturas, naTela, novoFatiador, rumoDaSombra, sombraDoCilindro, sombraNoAr, type Fatiador } from './pilhaDeFatias'
import { disco, lisa } from './apoioDasReferencias'
import { misturarCor, suave } from './muroEmRuina'

// ---------- a neve do lote L08 (o iglu, o trenó e as versões com neve importam daqui) ----------

/** A neve: o branco-azulado contido do chão Neve (`#dfe8f0`), um nada mais baixo para a luz do motor não passar de 245. */
export const TOM_DA_NEVE: Rgb = [0xd3, 0xda, 0xe2]
/** A neve na sombra: o azul-acinzentado do Monte de neve (`carimbos/novos/monteDeNeve.ts`), nunca o cinza do chão. */
export const TOM_DA_NEVE_NA_SOMBRA: Rgb = [0x96, 0xa6, 0xba]
/** A neve molhada, que já começou a derreter: mais cinza e mais escura. */
export const TOM_DA_NEVE_MOLHADA: Rgb = [0xb9, 0xc1, 0xc9]
export const NEVE: MaterialDaPeca = { classe: 'liso', rgb: TOM_DA_NEVE }

/** A luz de cima à esquerda e do alto (a do motor), de comprimento 1. */
const LUZ_X = -0.4993
const LUZ_Y = -0.5492
const LUZ_Z = 0.669
/** Quanto a luz da normal vira luz da amostra, o azul que entra do lado da sombra e o grão de cristal. */
const LUZ_DA_NEVE = 0.15
const AZUL_DA_SOMBRA = 0.62
const GRAO_DA_NEVE = 0.035

/** A luz de uma normal (no objeto) NA TELA, com zero no plano deitado: positiva virada para a luz. */
export function luzNaNeve(nx: number, ny: number, nz: number, q: number): number {
  const [sx, sy] = naTela(nx, ny, q)
  return sx * LUZ_X + sy * LUZ_Y + nz * LUZ_Z - LUZ_Z
}

/** Pinta a neve na amostra pela normal (no objeto): a luz macia, o azul do lado da sombra e o grão de cristal. */
export function pintarNeve(s: Float32Array, x: number, y: number, nx: number, ny: number, nz: number, q: number): void {
  const l = luzNaNeve(nx, ny, nz, q)
  s[3] += LUZ_DA_NEVE * (l < 0 ? l * 0.75 : l)
  misturarCor(s, TOM_DA_NEVE_NA_SOMBRA, AZUL_DA_SOMBRA * suave(-0.1, -1.1, l))
  s[3] += ruido(x * 1.1 + 3.1, y * 1.1 + 7.7) * GRAO_DA_NEVE
}

/**
 * A textura da neve DEITADA (o monte, a capa do muro, a neve no assento): o grão e, perto da beira que olha para o
 * lado da sombra NA TELA, o azul (a beira de cima à esquerda fica com a luz do chanfro do motor).
 */
export function texDaNeveDeitada(q: number, fundo = 2.4): Textura {
  return (_u, _v, x, y, p, s) => {
    const d = p.forma.d(x, y)
    const gx = p.forma.d(x + 0.4, y) - d
    const gy = p.forma.d(x, y + 0.4) - d
    const l = Math.hypot(gx, gy) || 1
    const [sx, sy] = naTela(gx / l, gy / l, q)
    const paraASombra = Math.max(0, sx * 0.55 + sy * 0.8)
    misturarCor(s, TOM_DA_NEVE_NA_SOMBRA, 0.5 * paraASombra * suave(-fundo, 0, d))
    s[3] += ruido(x * 1.1 + 3.1, y * 1.1 + 7.7) * GRAO_DA_NEVE + ruido(x * 0.22 + 1.7, y * 0.22 + 9.3) * 0.05
  }
}

// ---------- as bolas ----------

/** Uma bola de neve: o meio (no objeto, px), a altura do meio, o raio deitado e o de pé (a bola mole é mais baixa). */
interface Bola {
  readonly cx: number
  readonly cy: number
  readonly zc: number
  readonly r: number
  readonly rz: number
}

/** Uma coisa de cima que faz sombra na bola: a bola de cima, a cabeça, a aba da cartola. */
interface QueFazSombra {
  readonly cx: number
  readonly cy: number
  readonly z: number
  readonly r: number
}

interface ComoPintar {
  readonly q: number
  /** A cor da neve (a molhada no boneco derretendo) e quanto ela brilha molhada (0 = fosca). */
  readonly cor: Rgb
  readonly brilho: number
  /** As pintas de terra da bola rolada (0 = nenhuma). */
  readonly terra: number
  /** Os fios do derretido escorrendo pela frente (0 = nenhum). */
  readonly escorre: number
  readonly sombras: readonly QueFazSombra[]
  readonly semente: number
}

/** O passo das fatias das bolas (px): um corte por px de altura. */
const PASSO = 1
/** A menor fatia que entra (px de raio): abaixo disto o corte não aparece em nenhuma das vistas. */
const MENOR_FATIA = 0.35
const TERRA: Rgb = [0x6c, 0x62, 0x58]

/** A bola em fatias, de `de` a `ate` (px): o que fica dentro da bola de baixo não entra. */
function bolaEmFatias(f: Fatiador, b: Bola, de: number, ate: number, como: ComoPintar): void {
  const [rx, ry] = rumoDaSombra(como.q)
  const mat: MaterialDaPeca = { classe: 'liso', rgb: como.cor }
  for (const z of alturas(Math.max(de, b.zc - b.rz), Math.min(ate, b.zc + b.rz), PASSO)) {
    const t = (z - b.zc) / b.rz
    const r = b.r * Math.sqrt(Math.max(0, 1 - t * t))
    if (r < MENOR_FATIA) continue
    const tex: Textura = (_u, _v, x, y, _p, s) => {
      const dx = x - b.cx
      const dy = y - b.cy
      const d2 = (dx * dx + dy * dy) / (b.r * b.r)
      // A altura da superfície em cima do ponto (a fatia de cima mostra o miolo dela); embaixo do meio, a da fatia.
      const zs = t >= 0 ? b.zc + b.rz * Math.sqrt(Math.max(0, 1 - d2)) : z
      const gx = dx / (b.r * b.r)
      const gy = dy / (b.r * b.r)
      const gz = (zs - b.zc) / (b.rz * b.rz)
      const n = Math.hypot(gx, gy, gz) || 1
      pintarNeve(s, x, y + z, gx / n, gy / n, gz / n, como.q)
      // A sombra das coisas de cima na bola: o disco delas levado pelo rumo da sombra até a altura do ponto.
      for (const o of como.sombras) {
        const alto = o.z - zs
        if (alto <= 0) continue
        const dist = Math.hypot(x - (o.cx + rx * alto), y - (o.cy + ry * alto))
        const k = suave(o.r + 1.6, o.r - 1.2, dist)
        if (k > 0) {
          s[3] -= 0.17 * k
          misturarCor(s, TOM_DA_NEVE_NA_SOMBRA, 0.42 * k)
        }
      }
      if (como.brilho > 0) {
        const l = luzNaNeve(gx / n, gy / n, gz / n, como.q)
        s[3] += como.brilho * suave(0.12, 0.3, l)
      }
      if (como.terra > 0 && ruido(x * 0.7 + como.semente, (y * 0.5 + zs) * 0.7 + 4.3) > 0.5 - como.terra) misturarCor(s, TERRA, 0.45)
      if (como.escorre > 0 && t < 0.35 && gy / n > 0.25) s[3] -= como.escorre * suave(0.18, 0.36, ruido(x * 0.62 + como.semente, 3.7))
    }
    f.fatia(0, z, disco(b.cx, b.cy, r), mat, lisa(1, tex, como.semente))
  }
}

// ---------- as peças pequenas ----------

const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x33, 0x33] }
const CENOURA: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0x6f, 0x3e] }
const GALHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5b, 0x48, 0x39] }
const FELTRO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x3a, 0x3a] }
/** A água da neve derretida: cinza-azulada, meio transparente (o chão aparece), e a lama de neve em volta da bola. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x6f, 0x7d, 0x8a] }
const LAMA_DE_NEVE: MaterialDaPeca = { classe: 'liso', rgb: [0xa9, 0xb2, 0xba] }
/** O escuro em que o pixel escuro demais é levantado: o do feltro e do carvão, frio. */
const ESCURO_DO_CARVAO: Rgb = [0x43, 0x42, 0x44]

/** O ponto da superfície da bola na elevação `e` e no rumo `a` (radianos; 0 = a frente, positivo para o leste). */
function naBola(b: Bola, e: number, a: number, fora = 0): readonly [number, number, number] {
  const ce = Math.cos(e)
  return [b.cx + (b.r + fora) * ce * Math.sin(a), b.cy + (b.r + fora) * ce * Math.cos(a), b.zc + (b.rz + fora) * Math.sin(e)]
}

/** A luz deitada de uma peça pequena (o carvão, o nariz): um nada de volume pela textura, sem chanfro em cada corte. */
function texDoPequeno(q: number, brilho: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const d = p.forma.d(x, y)
    const gx = p.forma.d(x + 0.3, y) - d
    const gy = p.forma.d(x, y + 0.3) - d
    const l = Math.hypot(gx, gy) || 1
    const [sx, sy] = naTela(gx / l, gy / l, q)
    s[3] += (0.16 * (-sx * 0.6 - sy * 0.8) * suave(-1.2, 0, d)) + brilho * suave(-0.9, -0.2, d) * Math.max(0, -sx - sy)
  }
}

/** Um carvão (olho, botão, boca) na superfície da bola, um nada para fora dela. */
function carvao(f: Fatiador, b: Bola, e: number, a: number, raio: number, q: number): void {
  const [x, y, z] = naBola(b, e, a, 0.25)
  f.fatia(2, z, disco(x, y, raio), CARVAO, lisa(1, texDoPequeno(q, 0.1), 1801))
}

/** O nariz de cenoura: a cunha da cabeça para a frente, caída `queda` (radianos), com os anéis da raiz. */
function nariz(f: Fatiador, cena: Parameters<MontarMovel>[1], b: Bola, comprimento: number, queda: number, desvio: number, q: number): void {
  const [x0, y0, z0] = naBola(b, -0.05, desvio, -0.4)
  const ponta: Ponto = [x0 + Math.sin(desvio) * comprimento * Math.cos(queda), y0 + Math.cos(desvio) * comprimento * Math.cos(queda)]
  const meia = 1.25
  const lado: Ponto = [Math.cos(desvio) * meia, -Math.sin(desvio) * meia]
  const forma = poligono([[x0 + lado[0], y0 + lado[1]], ponta, [x0 - lado[0], y0 - lado[1]]])
  const z = z0 - Math.sin(queda) * comprimento * 0.5
  const doPequeno = texDoPequeno(q, 0.12)
  const tex: Textura = (u, v, x, y, p, s, escala) => {
    doPequeno(u, v, x, y, p, s, escala)
    // Os anéis da cenoura, de través.
    const ao = (x - x0) * Math.sin(desvio) + (y - y0) * Math.cos(desvio)
    s[3] -= 0.07 * suave(0.55, 0.85, Math.abs(Math.sin(ao * 2.1)))
  }
  f.fatia(2, z, forma, CENOURA, lisa(1, tex, 1802))
  cena.sombras.push(sombraNoAr(forma, z, q, 0.24, 1))
}

/** Um braço de galho: a vara com a forquilha da ponta, deitada na altura `z`, e a sombra dela no chão. */
function braco(f: Fatiador, cena: Parameters<MontarMovel>[1], pontos: readonly Ponto[], forquilha: readonly Ponto[], z: number, q: number, sombra: boolean): void {
  const vara = cadeia(pontos, 0.72)
  const ponta = cadeia(forquilha, 0.5)
  const tex = texDoPequeno(q, 0.04)
  f.fatia(1, z, vara, GALHO, lisa(1, tex, 1803))
  f.fatia(1, z + 0.01, ponta, GALHO, lisa(0.94, tex, 1804))
  if (sombra) cena.sombras.push(sombraNoAr(vara, z, q, 0.28, 0.9), sombraNoAr(ponta, z, q, 0.22, 0.8))
}

/** Uma faixa curta de pano (a ponta do cachecol) na altura `z`: o retângulo girado de meio (x, y). */
function retalho(x: number, y: number, comprido: number, largo: number, angulo: number): Forma {
  const c = Math.cos(angulo)
  const s = Math.sin(angulo)
  const a = comprido / 2
  const b = largo / 2
  return poligono([[x - c * a + s * b, y - s * a - c * b], [x + c * a + s * b, y + s * a - c * b], [x + c * a - s * b, y + s * a + c * b], [x - c * a - s * b, y - s * a + c * b]])
}

/** A lã do cachecol com a luz da fatia pela normal que se der (o anel do pescoço olha para fora, a ponta para a frente). */
function texDoPano(pano: MaterialDaPeca, q: number, normal: (x: number, y: number) => readonly [number, number, number]): Textura {
  const daLa = texturaDaClasse(pano.classe)
  return (u, v, x, y, p, s, escala) => {
    if (daLa !== null) daLa(u, v, x, y, p, s, escala)
    const [nx, ny, nz] = normal(x, y)
    s[3] += 0.2 * luzNaNeve(nx, ny, nz, q)
  }
}

/** O cachecol: o anel no pescoço (de `zDe` a `zAte`) e a ponta caída pela frente da bola de baixo dele. */
function cachecol(f: Fatiador, pano: MaterialDaPeca, cabeca: Bola, meio: Bola, zDe: number, zAte: number, rumo: number, elevacoes: readonly number[], q: number): void {
  const fora = cabeca.r + 1.35
  const dentro = cabeca.r * 0.55
  const doAnel = texDoPano(pano, q, (x, y) => {
    const dx = x - cabeca.cx
    const dy = y - cabeca.cy
    const l = Math.hypot(dx, dy) || 1
    return [dx / l, dy / l, 0.25]
  })
  for (const z of alturas(zDe, zAte, PASSO)) f.fatia(1, z, anel(cabeca.cx, cabeca.cy, fora, fora, dentro, dentro), pano, lisa(1, doAnel, 1805))
  // A ponta: um retalho por elevação, deitado na bola do meio, do pescoço para baixo; a franja no último.
  elevacoes.forEach((e, i) => {
    const [x, y, z] = naBola(meio, e, rumo, 0.7)
    const normal: readonly [number, number, number] = [Math.cos(e) * Math.sin(rumo), Math.cos(e) * Math.cos(rumo), Math.sin(e)]
    const tex = texDoPano(pano, q, () => normal)
    const ultimo = i === elevacoes.length - 1
    f.fatia(1, z, retalho(x, y, ultimo ? 2.6 : 3, 3.4, -rumo), pano, lisa(ultimo ? 0.9 : 1, tex, 1806 + i))
  })
}

/** A cartola de feltro: a aba, a copa com a faixa do pano e o alto, de pé em (cx, cy) a partir de `z0`. */
function cartola(f: Fatiador, pano: MaterialDaPeca, cx: number, cy: number, z0: number, q: number): void {
  const ABA = 5.3
  const COPA = 3.8
  const ALTO_DA_COPA = 7
  const daAba: Textura = (_u, _v, x, y, _p, s) => {
    const l = Math.hypot(x - cx, y - cy) || 1
    s[3] += 0.12 * luzNaNeve((x - cx) / l, (y - cy) / l, 0.5, q) + 0.06
  }
  f.fatia(3, z0, disco(cx, cy, ABA), FELTRO, lisa(1, daAba, 1810))
  f.fatia(3, z0 + 0.7, disco(cx, cy, ABA - 0.3), FELTRO, lisa(1.04, daAba, 1811))
  for (const z of alturas(z0 + 1, z0 + ALTO_DA_COPA, PASSO)) {
    const daFaixa = z < z0 + 2.6
    const alto = z >= z0 + ALTO_DA_COPA - 1e-6
    const tex: Textura = alto
      ? (_u, _v, x, y, p, s) => {
          // O alto da copa, plano: um aro de luz na beira de cima à esquerda.
          const d = p.forma.d(x, y)
          const [sx, sy] = naTela(x - cx, y - cy, q)
          s[3] += 0.03 + 0.12 * suave(-1.4, -0.3, d) * Math.max(0, (-sx - sy) / (COPA * 1.2))
        }
      : (_u, _v, x, y, _p, s) => {
          const l = Math.hypot(x - cx, y - cy) || 1
          s[3] += 0.16 * luzNaNeve((x - cx) / l, (y - cy) / l, 0, q)
        }
    const mat = daFaixa ? pano : FELTRO
    const texDaFaixa = daFaixa ? texDoPano(pano, q, (x, y) => { const l = Math.hypot(x - cx, y - cy) || 1; return [(x - cx) / l, (y - cy) / l, 0] }) : tex
    f.fatia(3, z, disco(cx, cy, COPA), mat, lisa(daFaixa ? 0.92 : 1, texDaFaixa, 1812))
  }
}

// ---------- o boneco ----------

/** A escala do boneco pela pegada: ele foi medido numa casa (meio lado de 28 px). */
function escalaDo(c: ContextoDoMovel): number {
  return Math.min(c.hw, c.hh) / 28
}

/** O CLÁSSICO: as três bolas firmes, a cartola, o nariz para a frente, os dois braços e o cachecol. */
export const montarBonecoDeNeve: MontarMovel = (c, cena) => {
  const k = escalaDo(c)
  const f = novoFatiador(c.peca, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DO_CARVAO
  const pano = c.m.cachecol
  // As bolas um nada para trás e para a esquerda do meio: a sombra comprida, para baixo à direita, cabe na pegada.
  const ox = -2.5 * k
  const oy = -1.5 * k
  const base: Bola = { cx: ox, cy: oy, zc: 9.2 * k, r: 13.4 * k, rz: 10.8 * k }
  const meio: Bola = { cx: ox + 0.2 * k, cy: oy - 0.5 * k, zc: 26.6 * k, r: 9.7 * k, rz: 8.2 * k }
  const cabeca: Bola = { cx: ox + 0.3 * k, cy: oy - 0.9 * k, zc: 39.8 * k, r: 7.1 * k, rz: 6.5 * k }
  const zTopoBase = base.zc + base.rz
  const zTopoMeio = meio.zc + meio.rz
  const zTopoCabeca = cabeca.zc + cabeca.rz
  // A cartola caída para trás e para a esquerda, que deixa o rosto à mostra de cima.
  const chapeu = { x: cabeca.cx - 1.1 * k, y: cabeca.cy - 2.1 * k, z: zTopoCabeca - 1.8 * k }
  const como = (semente: number, terra: number, sombras: readonly QueFazSombra[]): ComoPintar => ({ q, cor: TOM_DA_NEVE, brilho: 0, terra, escorre: 0, sombras, semente })
  bolaEmFatias(f, base, 0, zTopoBase, como(11.3, 0.045, [{ cx: meio.cx, cy: meio.cy, z: meio.zc, r: meio.r }]))
  bolaEmFatias(f, meio, zTopoBase - 2 * k, zTopoMeio, como(21.7, 0.02, [{ cx: cabeca.cx, cy: cabeca.cy, z: cabeca.zc, r: cabeca.r }]))
  bolaEmFatias(f, cabeca, zTopoMeio - 1.5 * k, zTopoCabeca, como(31.1, 0, [{ cx: chapeu.x, cy: chapeu.y, z: chapeu.z, r: 5.3 }]))

  // Os botões, os olhos, a boca e o nariz.
  for (const e of [0.62, 0.2, -0.22]) carvao(f, meio, e, 0.02, 1.05 * k, q)
  for (const a of [-0.42, 0.42]) carvao(f, cabeca, 0.4, a, 0.85 * k, q)
  for (const a of [-0.5, -0.26, 0, 0.26, 0.5]) carvao(f, cabeca, -0.34 + 0.1 * Math.abs(a), a, 0.5 * k, q)
  nariz(f, cena, cabeca, 6 * k, 0.08, 0.05, q)

  // Os braços de galho, da bola do meio para fora, um nada para cima e para a frente, cada um com a forquilha.
  const zBraco = meio.zc + 2 * k
  const yb = meio.cy + 0.5 * k
  braco(f, cena, [[meio.cx - meio.r + 1.2 * k, yb], [meio.cx - 15 * k, yb + 1.2 * k], [meio.cx - 20.5 * k, yb - 0.8 * k]], [[meio.cx - 17.5 * k, yb + 0.6 * k], [meio.cx - 20.5 * k, yb + 3.4 * k]], zBraco, q, true)
  braco(f, cena, [[meio.cx + meio.r - 1.2 * k, yb - 0.4 * k], [meio.cx + 14.5 * k, yb - 2.2 * k], [meio.cx + 19.5 * k, yb - 5.6 * k]], [[meio.cx + 16.8 * k, yb - 3.6 * k], [meio.cx + 20.8 * k, yb - 2.4 * k]], zBraco + 1.5 * k, q, true)

  cachecol(f, pano, cabeca, meio, zTopoMeio - 2.6 * k, zTopoMeio - 0.4 * k, 0.62, [1.05, 0.78, 0.5, 0.22], q)
  cartola(f, pano, chapeu.x, chapeu.y, chapeu.z, q)
  f.fechar()

  cena.sombras.push(
    sombraDoCilindro(base.cx, base.cy, base.r * 0.96, zTopoBase, q, 0.32, 1.6),
    sombraDoCilindro(meio.cx, meio.cy, meio.r * 0.95, zTopoMeio, q, 0.3, 1.5),
    sombraDoCilindro(cabeca.cx, cabeca.cy, cabeca.r * 0.95, zTopoCabeca, q, 0.28, 1.4),
    sombraDoCilindro(chapeu.x, chapeu.y, 3.8, chapeu.z + 7, q, 0.28, 1.2),
    contato(disco(base.cx, base.cy, base.r * 0.86), 0.34),
  )
}

/** A poça de neve derretida em volta do pé: o contorno torto, de raio `r` (x) e `ry`. */
function poca(cx: number, cy: number, r: number, ry: number, semente: number): Forma {
  const pontos: Ponto[] = []
  const n = 22
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const q = 0.84 + 0.2 * (ruido(Math.cos(a) * 1.7 + semente, Math.sin(a) * 1.7 + 2.1) + 0.5) + 0.06 * Math.sin(a * 3 + semente)
    pontos.push([cx + Math.cos(a) * r * q, cy + Math.sin(a) * ry * q])
  }
  return poligono(pontos)
}

/**
 * O DERRETENDO: as bolas baixas e moles (a de baixo afundada na própria poça), a do meio e a cabeça escorregando para
 * a frente e para a direita, os fios do derretido na frente de cada bola (de cima, a neve molhada brilha), a cartola
 * caída no chão ao lado, um braço caído na poça e o outro pendendo, um olho escorregado e um botão solto na água.
 */
export const montarBonecoDeNeveDerretendo: MontarMovel = (c, cena) => {
  const k = escalaDo(c)
  const f = novoFatiador(c.peca, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DO_CARVAO
  const pano = c.m.cachecol
  const ox = -2 * k
  const oy = -2 * k
  const base: Bola = { cx: ox, cy: oy, zc: 3.5 * k, r: 15 * k, rz: 10.5 * k }
  const meio: Bola = { cx: ox + 1.2 * k, cy: oy + 0.9 * k, zc: 17.5 * k, r: 8.8 * k, rz: 7.6 * k }
  const cabeca: Bola = { cx: ox + 3 * k, cy: oy + 2.8 * k, zc: 28.6 * k, r: 6.3 * k, rz: 5.5 * k }
  const zTopoBase = base.zc + base.rz
  const zTopoMeio = meio.zc + meio.rz
  const zTopoCabeca = cabeca.zc + cabeca.rz

  // A poça e a lama de neve em volta do pé, rentes ao chão (por baixo de tudo).
  const daAgua: Textura = (_u, _v, x, y, p, s) => {
    const d = p.forma.d(x, y)
    s[3] += 0.1 * suave(-1.6, -0.2, d) + ruido(x * 0.3 + 7, y * 0.3 + 1) * 0.06
  }
  f.fatia(0, 0.05, poca(ox + 1.5 * k, oy + 2.5 * k, 24 * k, 19.5 * k, 3.1), AGUA, { ...lisa(1, daAgua, 1820), alfa: 0.6 })
  f.fatia(0, 0.1, poca(ox + 0.5 * k, oy + 1 * k, 18.5 * k, 17 * k, 5.3), LAMA_DE_NEVE, { ...lisa(1, texDaNeveDeitada(q, 3), 1821), alfa: 0.85 })

  const como = (semente: number, sombras: readonly QueFazSombra[]): ComoPintar => ({ q, cor: TOM_DA_NEVE_MOLHADA, brilho: 0.1, terra: 0.03, escorre: 0.07, sombras, semente })
  bolaEmFatias(f, base, 0.2, zTopoBase, como(12.9, [{ cx: meio.cx, cy: meio.cy, z: meio.zc, r: meio.r }]))
  bolaEmFatias(f, meio, zTopoBase - 2 * k, zTopoMeio, como(23.3, [{ cx: cabeca.cx, cy: cabeca.cy, z: cabeca.zc, r: cabeca.r }]))
  bolaEmFatias(f, cabeca, zTopoMeio - 1.4 * k, zTopoCabeca, como(33.7, []))

  // O rosto escorregado: um olho mais baixo, o nariz caído e a boca torta.
  carvao(f, cabeca, 0.42, -0.4, 0.8 * k, q)
  carvao(f, cabeca, 0.02, 0.5, 0.8 * k, q)
  for (const a of [-0.36, -0.1, 0.18]) carvao(f, cabeca, -0.42 + 0.12 * a, a, 0.48 * k, q)
  nariz(f, cena, cabeca, 4.6 * k, 0.55, 0.22, q)
  // Dois botões na bola do meio e o terceiro solto na poça, na frente.
  for (const e of [0.48, 0.02]) carvao(f, meio, e, 0.12, 1 * k, q)
  f.fatia(2, 0.35, disco(ox + 6.5 * k, oy + 19 * k, 1.05 * k), CARVAO, lisa(1, texDoPequeno(q, 0.12), 1822))

  // Um braço pendendo da esquerda, baixo; o outro caído na poça, à direita.
  const yb = meio.cy + 1 * k
  braco(f, cena, [[meio.cx - meio.r + 1.2 * k, yb], [meio.cx - 13 * k, yb + 4 * k], [meio.cx - 17 * k, yb + 8.5 * k]], [[meio.cx - 15 * k, yb + 6 * k], [meio.cx - 18.8 * k, yb + 5.5 * k]], meio.zc - 1 * k, q, true)
  braco(f, cena, [[ox + 9 * k, oy + 15.5 * k], [ox + 17 * k, oy + 17.5 * k], [ox + 23.5 * k, oy + 16 * k]], [[ox + 20 * k, oy + 17 * k], [ox + 22.5 * k, oy + 20 * k]], 0.4, q, false)

  cachecol(f, pano, cabeca, meio, zTopoMeio - 2.2 * k, zTopoMeio - 0.4 * k, -0.5, [1, 0.7, 0.4, 0.1, -0.2], q)
  // A cartola caída no chão, à esquerda na frente, sentada na lama.
  cartola(f, pano, ox - 13.5 * k, oy + 15 * k, 0.5, q)
  f.fechar()

  cena.sombras.push(
    sombraDoCilindro(base.cx, base.cy, base.r * 0.96, zTopoBase, q, 0.28, 1.8),
    sombraDoCilindro(meio.cx, meio.cy, meio.r * 0.95, zTopoMeio, q, 0.28, 1.6),
    sombraDoCilindro(cabeca.cx, cabeca.cy, cabeca.r * 0.95, zTopoCabeca, q, 0.26, 1.4),
    sombraDoCilindro(ox - 13.5 * k, oy + 15 * k, 3.8, 7.5, q, 0.26, 1.2),
    contato(disco(base.cx, base.cy, base.r * 0.9), 0.3),
  )
}
