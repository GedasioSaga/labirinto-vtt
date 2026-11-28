/**
 * As VERSÕES do poço (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a 1ª, SIMPLES
 * (a borda de pedra, a trave nos dois esteios com o sarilho e o balde no chão, de hoje), é o desenho de `MONTADORES`
 * (`../poco.ts`). As outras:
 *
 * - COM TELHADO: o poço de hoje inteiro debaixo de um telhadinho de duas águas, de tabuinhas de madeira em fiadas, a
 *   cumeeira em cima da trave e as tábuas de beira nas pontas. A água de cima pega a luz, a de baixo fica na sombra;
 *   a borda de pedra e um gomo da água aparecem dos dois lados, e a sombra comprida do telhado cai no chão.
 * - COM MANIVELA: o mesmo poço com outro sarilho: os dois esteios fincados NA borda de pedra, o rolo de madeira mais
 *   comprido com a corda enrolada, o eixo de ferro passando do esteio da direita e a MANIVELA em L com o punho de
 *   madeira; o balde sai do chão e fica pendurado na corda, em cima da água.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que marca, pela semente, as peças que a
 * versão troca (os esteios, a trave, o sarilho e a corda; o balde do chão), e elas saem da cena; a borda e a água saem
 * byte a byte iguais. Lugares de material: os do poço (`pedras` e `madeira`); o ferro, a corda e a água são fixos.
 */
import { anel, caixa, capsula, elipse } from '../formas'
import { hash, rgb } from '../../../ruido'
import { tomDoMeio } from '../../materiais'
import type { Cena, CriarPeca, MaterialDaPeca, Peca } from '../motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { montarPoco } from '../poco'
import type { VersoesDesenhadas } from '.'

/** As peças de `../poco.ts` pela semente: os esteios, a trave, o sarilho e as voltas da corda; o balde do chão. */
const SARILHO_DE_HOJE: ReadonlySet<number> = new Set([319, 321, 330, 331, 332, 333, 334])
const BALDE_DE_HOJE: ReadonlySet<number> = new Set([340, 341, 342])
/** As sombras do balde do chão são as duas últimas que `../poco.ts` põe (a do balde e o contato dele). */
const SOMBRAS_DO_BALDE = 2
/** O raio da borda e o da água no desenho da vila (`../poco.ts`), na mesma escala `k`. */
const R_DA_VILA = 26
const r_DA_VILA = 17

const FERRO: MaterialDaPeca = materialDaPeca('ferro')
const AGUA_DO_BALDE: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.6)) }
const SOMBRA_DA_CUMEEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x24, 0x1e] }

/** O poço de hoje sem as peças marcadas; `semBalde` tira também as duas sombras do balde do chão. */
function pocoSem(c: ContextoDoMovel, cena: Cena, sementes: ReadonlySet<number>, semBalde: boolean): void {
  const tirar = new Set<Peca>()
  const peca: CriarPeca = (forma, mat, o) => {
    const p = c.peca(forma, mat, o)
    if (o?.semente !== undefined && sementes.has(o.semente)) tirar.add(p)
    return p
  }
  montarPoco({ ...c, peca }, cena)
  for (let i = cena.partes.length - 1; i >= 0; i -= 1) if (tirar.has(cena.partes[i])) cena.partes.splice(i, 1)
  if (semBalde) cena.sombras.splice(cena.sombras.length - SOMBRAS_DO_BALDE, SOMBRAS_DO_BALDE)
}

/** A escala do desenho da vila na pegada (a de `../poco.ts`). */
function escala(c: ContextoDoMovel): number {
  return Math.min(c.hw, c.hh) / 32.5
}

/** COM TELHADO: o poço de hoje e o telhado de duas águas por cima da trave. */
const comTelhado: MontarMovel = (c, cena) => {
  montarPoco(c, cena)
  const k = escala(c)
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const [x0, x1] = [-32 * k, 32 * k]
  const [norte, cumeeira, sul] = [-16.8 * k, -2.2 * k, 12.4 * k]
  // A sombra comprida do telhado, só de cima: na 3/4 derivada uma sombra com altura vira um tampo, que levaria junto a
  // água e o sarilho; lá o telhado fica no tampo do poço (toda peça dele tem o meio dentro da borda de pedra).
  if (c.vista !== 'tres-quartos') cena.sombras.push({ forma: caixa(x0, norte, x1, sul, 1.2 * k), z: c.g * 1.7, solta: true, forca: 0.3 })
  // As duas águas em fiadas de tabuinhas, da beira para a cumeeira, cada fiada cobrindo o alto da de baixo: a fiada é
  // uma tira só e as tabuinhas são as tábuas de pé dela, com a fresta escura e a luz de cada uma; o `dx` desencontra
  // as juntas de uma fiada para a outra. A água do norte pega a luz; a do sul fica na sombra.
  const largura = 4.4 * k
  const fiadas = 5
  for (const [beira, tom, semente] of [[norte, 1.06, 6600], [sul, 0.8, 6610]] as const) {
    const passo = (cumeeira - beira) / fiadas
    for (let i = 0; i < fiadas; i += 1) {
      const ya = beira + i * passo
      const yb = beira + (i + 1) * passo + Math.sign(passo) * 0.7 * k
      const s = hash(i, semente, 6602) * largura
      L.push(P(caixa(x0 - s, Math.min(ya, yb), x1 - s, Math.max(ya, yb), 0.3 * k), mad, { tabua: largura, eixo: QUARTO, bisel: 0.6 * k, tom: tom * (0.96 + 0.08 * hash(i, semente, 6603)), contorno: 0.3, dx: s, semente: semente + i, projeta: { dist: 1.2 * k, forca: 0.25 } }))
    }
  }
  // A sombra da cumeeira na água do sul e a cumeeira por cima de tudo. Sem tábua de beira nas pontas: numa peça só
  // ela seria a maior do poço, e a frente da 3/4 (a cor da maior peça) sairia de tábua em vez de pedra.
  L.push(P(caixa(x0, cumeeira, x1, cumeeira + 2.6 * k, 0.6 * k), SOMBRA_DA_CUMEEIRA, { bisel: 0, alfa: 0.32, contorno: 0, suave: 1.2 * k, semente: 6619 }))
  L.push(P(capsula(x0 - 0.4 * k, cumeeira, x1 + 0.4 * k, cumeeira, 1.5 * k), mad, { tabua: 0, eixo: 0, bisel: 1.2 * k, tom: 1.12, contorno: 0.3, semente: 6630, projeta: { dist: 1.5 * k, forca: 0.3 } }))
}

/** COM MANIVELA: o poço de hoje sem o sarilho e sem o balde do chão, e o sarilho de manivela com o balde pendurado. */
const comManivela: MontarMovel = (c, cena) => {
  pocoSem(c, cena, new Set([...SARILHO_DE_HOJE, ...BALDE_DE_HOJE]), true)
  const k = escala(c)
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const corda = materialDaPeca('corda')
  const yEixo = -2.2 * k
  const xEsteio = (R_DA_VILA + r_DA_VILA) / 2 * k
  // O balde pendurado em cima da água, um pouco para a frente do rolo, e a corda descendo até a alça.
  const [bx, by, rb] = [4.5 * k, 8.4 * k, 4.2 * k]
  cena.sombras.push({ forma: elipse(bx, by, rb, rb), z: 9 * k, solta: true, forca: 0.26 })
  L.push(P(elipse(bx, by, rb, rb), mad, { bisel: 1 * k, tabua: 1.5 * k, polar: { cx: bx, cy: by, r: rb }, tom: 0.96, contorno: 0.3, semente: 6650, projeta: { dist: 3 * k, forca: 0.3 } }))
  L.push(P(elipse(bx, by, rb - 1.7 * k, rb - 1.7 * k), AGUA_DO_BALDE, { bisel: 0, contorno: 0.2, recesso: { k: 0.8 * k, forca: 0.25 }, semente: 6651 }))
  L.push(P(anel(bx, by, rb + 0.1 * k, rb + 0.1 * k, rb - 0.6 * k, rb - 0.6 * k), FERRO, { bisel: 0.4 * k, contorno: 0.25, metal: 0.35, semente: 6652 }))
  L.push(P(capsula(bx - rb + 0.4 * k, by, bx + rb - 0.4 * k, by, 0.42 * k), FERRO, { bisel: 0.42 * k, contorno: 0.25, metal: 0.35, semente: 6653 }))
  L.push(P(capsula(bx, by, bx, yEixo + 3 * k, 0.6 * k), corda, { bisel: 0.5 * k, contorno: 0.25, semente: 6654 }))
  // Os dois esteios fincados na borda de pedra.
  for (const lado of [-1, 1]) {
    const x = lado * xEsteio
    L.push(P(caixa(x - 2.7 * k, yEixo - 3 * k, x + 2.7 * k, yEixo + 3 * k, 0.8 * k), mad, { bisel: 1.3 * k, tabua: 0, tom: 0.82, contorno: 0.3, semente: 6660 + lado, projeta: { dist: 2.5 * k, forca: 0.3 } }))
  }
  // O eixo de ferro de ponta a ponta, passando do esteio da direita até a manivela.
  const xManivela = 27.4 * k
  L.push(P(capsula(-xEsteio - 2 * k, yEixo, xManivela, yEixo, 0.75 * k), FERRO, { bisel: 0.7 * k, contorno: 0.3, metal: 0.35, semente: 6670, projeta: { dist: 2 * k, forca: 0.3 } }))
  // O rolo de madeira com a corda enrolada em voltas.
  const meioRolo = 13.5 * k
  L.push(P(caixa(-meioRolo, yEixo - 3 * k, meioRolo, yEixo + 3 * k, 1.4 * k), mad, { bisel: 2.6 * k, tabua: 0, eixo: 0, tom: 0.9, contorno: 0.3, semente: 6671, projeta: { dist: 3 * k, forca: 0.32 } }))
  for (let i = 0; i < 5; i += 1) {
    const x = -8 * k + i * 4 * k
    L.push(P(caixa(x - 1.2 * k, yEixo - 2.7 * k, x + 1.2 * k, yEixo + 2.7 * k, 0.6 * k), corda, { bisel: 1 * k, contorno: 0.25, semente: 6672 + i }))
  }
  // A manivela em L: o braço de ferro descendo e o punho de madeira, que gira na mão.
  L.push(P(capsula(xManivela, yEixo, xManivela, 6.2 * k, 0.85 * k), FERRO, { bisel: 0.8 * k, contorno: 0.3, metal: 0.38, semente: 6680, projeta: { dist: 2 * k, forca: 0.3 } }))
  L.push(P(capsula(xManivela, 6.2 * k, 31.4 * k, 6.2 * k, 1.15 * k), mad, { bisel: 1.1 * k, tabua: 0, tom: 1.08, contorno: 0.3, semente: 6681, projeta: { dist: 1.8 * k, forca: 0.3 } }))
  L.push(P(elipse(xManivela, yEixo, 1.3 * k, 1.3 * k), FERRO, { bisel: 0.8 * k, tom: 1.1, contorno: 0.28, metal: 0.4, semente: 6682 }))
}

/** Ids na ordem do painel, depois da 1ª ("Simples", a de hoje): comTelhado, comManivela. */
export const versoesDoPoco: VersoesDesenhadas = { comTelhado, comManivela }
