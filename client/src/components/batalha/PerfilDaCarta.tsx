import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { FichaDePersonagem } from '../FichaDePersonagem'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'

/**
 * O PERFIL da carta (decisão 4): a ficha do personagem, só leitura — a
 * `FichaDePersonagem` sem `onAjustar` e fora da edição não tem um controle que
 * mude número. O mestre abre o de qualquer carta; o jogador, só o de aliado
 * (a carta "outro" nem chega aqui: a faixa não a deixa clicável).
 */

export interface PerfilDaCartaProps {
  personagem: Personagem
  sistema: SistemaDeRpg | null
  /** "Grupo · aliado", "Rivais · NPC"... */
  descricao?: string
  onFechar: () => void
}

const NADA_MUDA = () => {}
const SEM_IMAGEM = () => Promise.resolve(null)

export function PerfilDaCarta({ personagem, sistema, descricao, onFechar }: PerfilDaCartaProps) {
  return (
    <JanelaDaBatalha titulo={personagem.nome || 'Perfil'} descricao={descricao ?? 'Só leitura'} larga onFechar={onFechar}>
      {sistema === null ? (
        <p className="bt-regras__vazio">Esta mesa não tem sistema de RPG: o perfil não tem o que mostrar.</p>
      ) : (
        <FichaDePersonagem personagem={personagem} sistema={sistema} editando={false} onChange={NADA_MUDA} escolherImagem={SEM_IMAGEM} />
      )}
    </JanelaDaBatalha>
  )
}
