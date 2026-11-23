import type { Ajuste } from '../../ajusteDaFicha'
import { numeroDaFicha, type Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { recursoDeVida } from '../../vidaDaFicha'
import { acumuladorDaReferencia, comGastoNoAcumulador, comOEventoNosAcumuladores } from '../acumuladorNaBatalha'
import type { CombateDoPersonagem } from '../combate'
import { recursoDoCusto } from '../leituraDaFicha'
import type { Gasto } from './avaliar'
import type { AcumuladorDaFicha, RecursoDoAliado, Referencia } from './modelo'

/**
 * REQUISITOS, fase C (§6): os GASTOS dos requisitos que valem, na mesma linha do golpe, depois do
 * custo normal (SP, HP, acumulador, concentração, reação, item, munição, SP do aliado). Puro: devolve o
 * combate novo e o que a store tira das fichas; a store grava tudo com o antes e o depois na linha, e
 * o Desfazer dela devolve tudo.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** O que os gastos fazem, para a store gravar na linha. */
export interface GastosNaLinha {
  /** O SP e o HP que saem da ficha de quem usa (somados). */
  sp: number
  hp: number
  /** O combate de quem usa depois dos gastos de acumulador, concentração e reação (o mesmo objeto se nada mudou). */
  combate: CombateDoPersonagem
  /** Os itens que saem da mochila de quem usa. */
  itens: readonly { item: Referencia; n: number }[]
  municao: number
  /** O que o aliado paga (fase E: o pedido aceito). O aliado só paga; nada passa para quem pediu. */
  doAliado: readonly { aliadoTokenId: string; de: RecursoDoAliado; n: number }[]
  /** "gastou Polaridade 2 e 50 SP"; nada gasto = `null`. */
  texto: string | null
}

/** A carga depois do gasto, no tipo da concentração (0 a 3). */
function cargaQueFica(tem: CombateDoPersonagem['carga'], gasta: number): CombateDoPersonagem['carga'] {
  const fica = tem - gasta
  return fica <= 0 ? 0 : fica === 1 ? 1 : fica === 2 ? 2 : 3
}

function juntarComE(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1] ?? ''}`
}

/**
 * Aplica os gastos ao combate de quem usa e diz o que sai das fichas. `definicoes` = os acumuladores
 * da ficha; `rodada` marca o uso do acumulador gasto (a queda por rodada sem uso). A reação gasta (A7)
 * conta como "gastou a reação" para os acumuladores que sobem com ela.
 */
export function aplicarGastos(combate: CombateDoPersonagem, gastos: readonly Gasto[], definicoes: readonly AcumuladorDaFicha[], rodada: number): GastosNaLinha {
  let novo = combate
  let sp = 0
  let hp = 0
  let municao = 0
  const itens: { item: Referencia; n: number }[] = []
  const doAliado: { aliadoTokenId: string; de: RecursoDoAliado; n: number }[] = []
  const textos: string[] = []
  for (const gasto of gastos) {
    switch (gasto.recurso) {
      case 'sp':
        sp += gasto.n
        break
      case 'hp':
        hp += gasto.n
        break
      case 'acumulador': {
        const nome = acumuladorDaReferencia(definicoes, gasto.acumulador)?.nome ?? gasto.acumulador.nome
        const depois = comGastoNoAcumulador(novo, definicoes, gasto.acumulador, gasto.n, rodada)
        if (depois !== novo) textos.push(`${nome} ${gasto.n}`)
        novo = depois
        break
      }
      case 'concentracao': {
        const tem = novo.carga
        const fica = cargaQueFica(tem, gasto.n)
        if (fica !== tem) {
          novo = { ...novo, carga: fica }
          textos.push(`${tem - fica} ${tem - fica === 1 ? 'carga' : 'cargas'}`)
        }
        break
      }
      case 'reacao':
        if (novo.semReacao !== true) {
          novo = comOEventoNosAcumuladores({ ...novo, semReacao: true }, definicoes, { quando: 'gastaReacao' }, rodada)
          textos.push('a reação')
        }
        break
      case 'item':
        itens.push({ item: gasto.item, n: gasto.n })
        textos.push(`${gasto.n} ${gasto.item.nome}`)
        break
      case 'municao':
        municao += gasto.n
        textos.push(`${gasto.n} ${gasto.n === 1 ? 'bala' : 'balas'}`)
        break
      case 'doAliado':
        doAliado.push({ aliadoTokenId: gasto.aliadoTokenId, de: gasto.de, n: gasto.n })
        break
    }
  }
  if (sp > 0) textos.push(`${sp} SP`)
  if (hp > 0) textos.push(`${hp} HP`)
  return { sp, hp, combate: novo, itens, municao, doAliado, texto: textos.length === 0 ? null : `gastou ${juntarComE(textos)}` }
}

/** Os ajustes da ficha de quem usa: o SP e o HP dos gastos, tirados do que ela tem AGORA (depois do custo normal), nunca abaixo de 0. */
export function ajustesDosGastos(personagem: Personagem, sistema: SistemaDeRpg, gastos: Pick<GastosNaLinha, 'sp' | 'hp'>): Ajuste[] {
  const ajustes: Ajuste[] = []
  const sp = gastos.sp > 0 ? recursoDoCusto(sistema, 'sp') : null
  if (sp !== null) ajustes.push({ parte: 'recurso', chave: sp.id, valor: Math.max(0, numeroDaFicha(personagem.recursos, sp.id) - gastos.sp) })
  const vida = gastos.hp > 0 ? recursoDeVida(sistema) : null
  if (vida !== null) ajustes.push({ parte: 'recurso', chave: vida.id, valor: Math.max(0, numeroDaFicha(personagem.recursos, vida.id) - gastos.hp) })
  return ajustes
}
