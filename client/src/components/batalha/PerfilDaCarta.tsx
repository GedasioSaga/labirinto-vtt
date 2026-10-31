import { useMemo, type ReactNode } from 'react'
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
 * Tipos de habilidade F3: acima da ficha, a lista Passivas (`PassivasDaFicha`),
 * a única parte que age: Ativar/Desligar fora da vez, sem gastar ação.
 */

export interface PerfilDaCartaProps {
  personagem: Personagem
  sistema: SistemaDeRpg | null
  /** "Grupo · aliado", "Rivais · NPC"... */
  descricao?: string
  /** F3: a imagem da forma ligada pelo menu, que vence a foto da ficha no retrato (como na carta); `null`/ausente = a foto da ficha. */
  imagemDaForma?: string | null
  /** Tipos de habilidade F3: a lista Passivas da ficha (quem monta decide se age). Ausente = nada. */
  passivas?: ReactNode
  onFechar: () => void
}

const NADA_MUDA = () => {}
const SEM_IMAGEM = () => Promise.resolve(null)

export function PerfilDaCarta({ personagem, sistema, descricao, imagemDaForma, passivas, onFechar }: PerfilDaCartaProps) {
  // Só leitura (`onChange` não grava): trocar o retrato aqui não chega à ficha.
  const mostrado = useMemo(
    () => (imagemDaForma === undefined || imagemDaForma === null ? personagem : { ...personagem, retrato: imagemDaForma }),
    [personagem, imagemDaForma],
  )
  return (
    <JanelaDaBatalha titulo={personagem.nome || 'Perfil'} descricao={descricao ?? 'Só leitura'} larga onFechar={onFechar}>
      {passivas !== undefined && passivas !== null && <div className="bt-perfil__passivas">{passivas}</div>}
      {sistema === null ? (
        <p className="bt-regras__vazio">Esta mesa não tem sistema de RPG: o perfil não tem o que mostrar.</p>
      ) : (
        <FichaDePersonagem personagem={mostrado} sistema={sistema} editando={false} onChange={NADA_MUDA} escolherImagem={SEM_IMAGEM} />
      )}
    </JanelaDaBatalha>
  )
}
