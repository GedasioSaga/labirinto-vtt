/**
 * As VERSÕES do muro baixo de pedra (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`;
 * tema Neve): a 1ª, a de hoje, é o desenho de `MONTADORES` (`../muroBaixoDePedra.ts`). Aqui fica COM NEVE: o MESMO
 * trecho de muro, com as mesmas lajes, pedras e juntas, debaixo de uma nevada.
 *
 * - A CAPA some debaixo de um colchão de neve de beira mole, que deixa a pedra das lajes à mostra só num fio de cada
 *   lado; a junta entre duas lajes ainda marca a neve (cada laje leva o seu pedaço, cortado na caixa dela).
 * - As pedras miúdas da BEIRA ganham cada uma o seu punhado de neve, do lado da capa, com falhas.
 * - Ao PÉ do muro, a neve que o vento juntou: um monte comprido de cada lado (maior na frente), por cima do chão e
 *   por baixo das pedras caídas, que ficam com neve no alto.
 * - O musgo e o líquen saem: debaixo da neve não aparecem.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que guarda as opções de cada peça; a
 * semente de cada uma diz o que ela é (as faixas de semente de `../muroBaixoDePedra.ts`). A lista sai na mesma ordem,
 * sem o musgo e o líquen, com a neve de cada peça logo depois dela. Na 3/4 derivada cada pedaço de neve tem o meio da
 * caixa dentro da peça que cobre e sobe com a estrutura dela (a laje, o corpo, a pedra caída); o monte do pé fica no
 * chão. Lugar de material: `pedra`, o de hoje (o granito, o gelo e a obsidiana do I0-d também nevam).
 */
import { hash } from '../../../ruido'
import { caixa, dentroDe, elipse, poligono, type Forma, type Ponto } from '../formas'
import type { CriarPeca, OpcoesDaPeca, Peca } from '../motor'
import { montarMuroBaixoDePedra } from '../muroBaixoDePedra'
import { quartosDoGiro } from '../pipaDeitada'
import { NEVE, texDaNeveDeitada } from '../bonecoDeNeve'
import type { VersoesDesenhadas } from '.'

/** As medidas do desenho de hoje (`../muroBaixoDePedra.ts`): meia fundura do corpo e da capa, em fração da fundura. */
const MEIO_CORPO = 0.39
const MEIA_CAPA = 0.25

/** As faixas de semente das peças do desenho de hoje (`../muroBaixoDePedra.ts`). */
const SEMENTES = {
  beira: [9150, 9200],
  mioloDaLaje: [9200, 9300],
  liquen: [9500, 9600],
  caida: [9700, 9750],
  lasca: [9750, 9800],
} as const

/** O colchão da capa: quanto da meia capa fica de pedra à mostra de cada lado, e o ondulado da beira (px). */
const PEDRA_A_MOSTRA = { luz: 0.2, sombra: 0.14 } as const
const ONDA_DA_CAPA = 0.9
/** O monte do pé: até onde vai (fração do que sobra entre o corpo e a beira da pegada) e o quanto ondula. */
const MONTE_DA_FRENTE = 0.92
const MONTE_DE_TRAS = 0.62
const ONDA_DO_MONTE = 0.28

type Tipo = 'musgo' | 'liquen' | 'mioloDaLaje' | 'beira' | 'caida' | 'lasca' | 'outra'

function naFaixa(semente: number, [de, ate]: readonly [number, number]): boolean {
  return semente >= de && semente < ate
}

/** O que é a peça do desenho de hoje: o musgo pela classe, o resto pela semente. */
function tipoDa(p: Peca, o: OpcoesDaPeca | undefined): Tipo {
  if (p.mat.classe === 'folha') return 'musgo'
  const semente = o?.semente ?? -1
  if (naFaixa(semente, SEMENTES.liquen)) return 'liquen'
  if (naFaixa(semente, SEMENTES.mioloDaLaje)) return 'mioloDaLaje'
  if (naFaixa(semente, SEMENTES.beira)) return 'beira'
  if (naFaixa(semente, SEMENTES.caida)) return 'caida'
  if (naFaixa(semente, SEMENTES.lasca)) return 'lasca'
  return 'outra'
}

/** Uma beira de `u0` a `u1` na altura `v(u)` (no referencial do muro), em `n` lances. */
function beira(u0: number, u1: number, v: (u: number) => number, n: number): Ponto[] {
  return Array.from({ length: n + 1 }, (_, i): Ponto => {
    const u = u0 + ((u1 - u0) * i) / n
    return [u, v(u)]
  })
}

export const versoesDoMuroBaixoDePedra: VersoesDesenhadas = {
  comNeve: (c, cena) => {
    const opcoes = new Map<Peca, OpcoesDaPeca | undefined>()
    const guardar: CriarPeca = (forma, mat, o) => {
      const p = c.peca(forma, mat, o)
      opcoes.set(p, o)
      return p
    }
    montarMuroBaixoDePedra({ ...c, peca: guardar }, cena)

    const P = c.peca
    const aoComprido = c.w >= c.h
    const comprimento = aoComprido ? c.w : c.h
    const fundura = aoComprido ? c.h : c.w
    const mc = comprimento / 2
    const mf = fundura / 2
    const corpo = fundura * MEIO_CORPO
    const capa = fundura * MEIA_CAPA
    const q = quartosDoGiro(c.giro)
    // Do referencial do muro (u ao comprido, v de través, negativo = o lado da luz) para o desenho.
    const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([u, v]): Ponto => (aoComprido ? [u, v] : [v, u])))
    const deTraves = (f: Forma): number => (aoComprido ? (f.b[1] + f.b[3]) / 2 : (f.b[0] + f.b[2]) / 2)
    const lances = Math.max(8, Math.round(comprimento / 3))
    const sorteio = Math.round(c.w + 7 * c.h)
    const onda = (u: number, semente: number): number =>
      Math.sin(u * 0.37 + semente) * 0.6 + Math.sin(u * 0.91 + semente * 2.3) * 0.4 + (hash(Math.floor(u / 3), semente, 8800 + sorteio) - 0.5) * 0.5

    // O colchão da capa (inteiro; cada laje leva o pedaço dela) e as faixas de neve das beiras, uma de cada lado.
    const colchao = pol([
      ...beira(-mc, mc, (u) => -capa * (1 - PEDRA_A_MOSTRA.luz) + ONDA_DA_CAPA * onda(u, 1), lances),
      ...beira(-mc, mc, (u) => capa * (1 - PEDRA_A_MOSTRA.sombra) + ONDA_DA_CAPA * onda(u, 2), lances).reverse(),
    ])
    const faixaDaBeira = (lado: number): Forma =>
      pol([
        ...beira(-mc, mc, () => lado * capa * 0.98, lances),
        ...beira(-mc, mc, (u) => lado * (capa + (corpo - capa) * (0.45 + 0.5 * Math.max(0, Math.sin(u * 0.53 + lado * 1.7) + 0.35 * Math.sin(u * 1.3)))), lances).reverse(),
      ])
    const faixas = { luz: faixaDaBeira(-1), sombra: faixaDaBeira(1) }
    const texNeve = texDaNeveDeitada(q)
    const neve = (forma: Forma, semente: number, bisel: number): Peca =>
      P(forma, NEVE, { tabua: 0, bisel, contorno: 0.12, textura: texNeve, semente, projeta: { dist: 0.9, forca: 0.16 } })

    // Os montes do pé: da borda do corpo até perto da beira da pegada, o da frente maior.
    const monte = (lado: number, alcance: number, semente: number): Forma =>
      pol([
        ...beira(-mc + 0.5, mc - 0.5, () => lado * (corpo + 0.2), lances),
        ...beira(-mc + 0.5, mc - 0.5, (u) => lado * (corpo + (mf - corpo) * alcance * (1 - ONDA_DO_MONTE * (0.5 + 0.5 * Math.sin(u * 0.29 + semente)))), lances).reverse(),
      ])

    const novas: Peca[] = []
    let lajeAberta: Forma | null = null
    let lajes = 0
    let montes = false
    const fecharLaje = (): void => {
      if (lajeAberta === null) return
      novas.push(neve(dentroDe(colchao, lajeAberta), 8810 + lajes, 1.6))
      lajeAberta = null
      lajes += 1
    }
    for (const p of cena.partes) {
      const tipo = tipoDa(p, opcoes.get(p))
      if (tipo === 'musgo' || tipo === 'liquen') continue
      if (tipo === 'mioloDaLaje') {
        fecharLaje()
        lajeAberta = caixa(p.forma.b[0], p.forma.b[1], p.forma.b[2], p.forma.b[3])
      }
      if ((tipo === 'caida' || tipo === 'lasca') && !montes) {
        fecharLaje()
        novas.push(P(monte(1, MONTE_DA_FRENTE, 0.7), NEVE, { tabua: 0, bisel: 2.6, contorno: 0.1, textura: texDaNeveDeitada(q, 3.4), semente: 8890 }))
        novas.push(P(monte(-1, MONTE_DE_TRAS, 2.9), NEVE, { tabua: 0, bisel: 2.2, contorno: 0.1, textura: texDaNeveDeitada(q, 3), semente: 8891 }))
        montes = true
      }
      novas.push(p)
      if (tipo === 'beira') {
        novas.push(neve(dentroDe(deTraves(p.forma) < 0 ? faixas.luz : faixas.sombra, p.forma), 8850 + (novas.length % 40), 1))
      } else if (tipo === 'caida' || tipo === 'lasca') {
        // A neve no alto da pedra, puxada para o lado da luz: a beira de baixo fica de pedra.
        const b = p.forma.b
        const cx = (b[0] + b[2]) / 2 - (b[2] - b[0]) * 0.08
        const cy = (b[1] + b[3]) / 2 - (b[3] - b[1]) * 0.1
        novas.push(neve(dentroDe(p.forma, elipse(cx, cy, (b[2] - b[0]) * 0.4, (b[3] - b[1]) * 0.38)), 8860 + (novas.length % 40), 1.2))
      }
    }
    fecharLaje()
    cena.partes.length = 0
    cena.partes.push(...novas)
  },
}
