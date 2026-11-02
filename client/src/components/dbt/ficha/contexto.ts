import { createContext, useContext } from 'react'
import type { Ajuste } from '../../../lib/ajusteDaFicha'
import type { FichaDBT, RacaDBT, VarianteDeRacaDBT } from '../../../lib/dbt/modelo'
import type { DerivadosDaFichaDBT } from '../../../lib/dbt/regras/ficha'
import type { Personagem } from '../../../lib/personagem'

/**
 * O que toda parte da ficha Dragon Ball lê: o personagem mostrado, a ficha
 * estruturada, os derivados já contados e as duas portas de mudança. Um
 * contexto só, montado pela `FichaDBT`, para as abas não repassarem dez props.
 */
export interface FichaDBTNaTela {
  personagem: Personagem
  ficha: FichaDBT
  derivados: DerivadosDaFichaDBT
  raca: RacaDBT | null
  variante: VarianteDeRacaDBT | null
  /** Editar/Salvar da janela: só aqui a estrutura muda (vai para o rascunho). */
  editando: boolean
  /** Quem pode decidir Jogador/NPC é o mestre (`tipoEditavel`): vê o bloco de NPC, aprova técnica especial, fixa valores à mão. */
  ehMestre: boolean
  ehNpc: boolean
  /** PV e PK como a mesa os usa (o máximo gravado; sem gravado, a conta). */
  pvAtual: number
  pvMax: number
  pkAtual: number
  pkMax: number
  /** Muda o rascunho (só na edição); os máximos da regra são gravados junto. */
  mudar: (mudanca: (personagem: Personagem) => Personagem) => void
  mudarFicha: (mudanca: (ficha: FichaDBT) => FichaDBT) => void
  /** Ajuste rápido fora da edição (PV, PK); ausente = a ficha só lê. */
  ajustar: ((ajuste: Ajuste) => void) | undefined
  /** Leva à aba (os quadrinhos de ST, talentos e carga levam à aba deles). */
  irPara: (aba: IdDaAbaDBT) => void
  /** Abre o construtor de técnica (só na edição): `null` = técnica nova. */
  abrirConstrutor: (tecnicaId: string | null) => void
}

export type IdDaAbaDBT = 'tecnicas' | 'transformacoes' | 'talentos' | 'inventario' | 'raca' | 'historia'

export const ContextoDaFichaDBT = createContext<FichaDBTNaTela | null>(null)

export function useFichaDBT(): FichaDBTNaTela {
  const contexto = useContext(ContextoDaFichaDBT)
  if (contexto === null) throw new Error('useFichaDBT fora da FichaDBT')
  return contexto
}
