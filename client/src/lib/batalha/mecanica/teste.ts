import type { CdDaDisputa, QuemRola } from '../disputa'
import type { DisputaAMao } from '../mecanicasAMao'
import type { CdDoTeste, NumeroDaCd, NumeroSimples, QuemRolaNoTeste, Teste } from './modelo'

/**
 * O TESTE DA TÉCNICA MONTADA (construtor de mecânicas, fatia C4; seção 2 do
 * plano): a peça `teste` vira a MESMA disputa que a F2 rola à mão
 * (`DisputaAMao`, rolada por `disputa.ts` com a vantagem da F1). Assim não há
 * segunda conta do d20: o host rola ao usar, antes do dano
 * (`comADisputaNoUso`), quem perde não toma nada, e a linha do golpe leva o
 * texto da rolagem (o Desfazer volta junto com ela).
 *
 * - Resistência: o alvo rola d20 + mod do atributo contra a CD (passa com o
 *   total igual ou acima). Passou: nada; com `devolveCusto`, se ninguém
 *   falhou, a técnica não gasta (SP e uso voltam, como a Explosão).
 * - Disputa: d20 + mod de quem usa contra d20 + mod do alvo; o empate fica
 *   com o alvo (a regra da F2: "só pega se ele vencer").
 *
 * Só importa tipos: `leitura.ts` (que o motor inteiro importa) chama daqui.
 * Puro: sem store, sem rede.
 */

function quemRola(quem: QuemRolaNoTeste): QuemRola {
  return quem.vantagem === undefined ? { atributoId: quem.atributo } : { atributoId: quem.atributo, vantagem: quem.vantagem }
}

function cdSimples(numero: NumeroSimples): Exclude<CdDaDisputa, { tipo: 'porCarga' }> {
  return 'fixo' in numero ? { tipo: 'fixa', cd: numero.fixo } : { tipo: 'expressao', formula: numero.formula }
}

function cdNaCarga(numero: NumeroDaCd): number | 'acerta' | { expressao: string } {
  if (numero === 'automatico') return 'acerta'
  return 'fixo' in numero ? numero.fixo : { expressao: numero.formula }
}

/** A CD da peça como a disputa da F2 a lê (a tabela da Concentração: `cargas[0]` = carga 1). */
export function cdDoTeste(cd: CdDoTeste): CdDaDisputa {
  if (!('porCarga' in cd)) return cdSimples(cd)
  const [zero, um, dois, tres] = cd.porCarga
  return { tipo: 'porCarga', semCarga: cdSimples(zero), cargas: [cdNaCarga(um), cdNaCarga(dois), cdNaCarga(tres)] }
}

/** A disputa que o app rola ao usar a técnica montada; `null` = o alvo reage (ou não erra), sem teste. */
export function disputaDoTeste(teste: Teste): DisputaAMao | null {
  switch (teste.tipo) {
    case 'reacao':
    case 'naoErra':
      return null
    case 'resistencia': {
      const disputa: DisputaAMao = { quando: 'uso', testa: 'alvo', rola: quemRola(teste.alvo), contra: { tipo: 'cd', cd: cdDoTeste(teste.cd) } }
      if (teste.sePassar === 'devolveCusto') disputa.seQuemUsaPerde = { devolveOCusto: true }
      return disputa
    }
    case 'disputa':
      return { quando: 'uso', testa: 'quemUsa', rola: quemRola(teste.usuario), contra: { tipo: 'rolagem', quem: quemRola(teste.alvo) } }
  }
}
