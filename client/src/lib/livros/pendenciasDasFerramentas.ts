import { antigosSemAlcance } from '../batalha/alcance/antigos'
import { antigosComProposta } from '../batalha/requisitos/antigos'
import { juntarDasFichas, ligarPeloNome, mecanicasDasFichas } from './catalogo'

/**
 * O QUE FALTA EM CADA FERRAMENTA do menu "Ferramentas" da biblioteca
 * (protótipo aprovado em 23/11: "Dar alcance aos antigos: 19 pendentes").
 * As MESMAS contas que cada ferramenta faz ao abrir (o ensaio, sem gravar):
 * o número do menu é o tamanho da lista que ela vai mostrar.
 *
 * Puro: sem store, sem disco (as propostas dos arquivos chegam lidas).
 */

export type FerramentaDaBiblioteca = 'juntar' | 'ligar' | 'alcance' | 'requisitos'

type DadosDoAlcance = Parameters<typeof antigosSemAlcance>[0]
type PropostasDoAlcance = NonNullable<Parameters<typeof antigosSemAlcance>[1]>
type PropostasDosRequisitos = Parameters<typeof antigosComProposta>[1]

export interface DadosDasPendencias extends DadosDoAlcance {
  propostasDoAlcance: PropostasDoAlcance
  propostasDosRequisitos: PropostasDosRequisitos
}

export type PendenciasDasFerramentas = Readonly<Record<FerramentaDaBiblioteca, number>>

/** Juntar das fichas: as entradas novas mais as que ganham a mecânica montada na ficha (o que o Juntar grava). */
function pendenciasDoJuntar(dados: DadosDasPendencias): number {
  const { itens, ganharam } = mecanicasDasFichas(dados.personagens, dados.catalogo)
  return juntarDasFichas(dados.personagens, itens).length + ganharam
}

export function pendenciasDasFerramentas(dados: DadosDasPendencias): PendenciasDasFerramentas {
  return {
    juntar: pendenciasDoJuntar(dados),
    ligar: ligarPeloNome(dados.catalogo, dados.acervo).ligadas,
    alcance: antigosSemAlcance(dados, dados.propostasDoAlcance).antigos.length,
    requisitos: dados.pastaId === null ? 0 : antigosComProposta({ pastaId: dados.pastaId, personagens: dados.personagens }, dados.propostasDosRequisitos).antigos.length,
  }
}
