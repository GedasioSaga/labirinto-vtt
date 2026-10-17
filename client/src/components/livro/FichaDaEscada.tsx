import type { ReactNode } from 'react'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { PlayerSecretControls, type PlayerSecretControlsProps } from '../PlayerSecretControls'
import { StairControls, type StairControlsProps, type StairTravelProps } from '../StairControls'
import { FichaLembrada } from './FichaLembrada'
import './fichaDoItem.css'

/*
 * FICHA DA ESCADA (fatia 16b, a ficha base que a fatia 17 usa; decisão 4.1).
 * O essencial é o que a escada É — Sentido, Forma, Tamanho e os números que
 * as alças do mapa também mudam (Comprimento, Largura e Curva; na espiral, o
 * Diâmetro) — e o "Oculto para jogadores", com o "Revelar para…" da sala
 * aberta. A ficha recolhida "Para onde leva" junta o "Leva a" da aventura, o
 * Piso e a Transição ao trocar de piso. Os controles e os handlers são os de
 * antes.
 */

/** Chave da escolha lembrada da ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-escada-'

export interface FichaDaEscadaProps {
  controles: StairControlsProps
  /** O piso a que a escada leva (resumo "Piso 2"); ausente = não leva a outro piso. */
  levaAoPiso?: number
  /** Piso e Leva ao piso, montados pelo painel (só com a ligação de pisos). */
  piso?: ReactNode
  /** Transição ao trocar de piso, montada pelo painel. */
  transicao?: ReactNode
  /** Oculto para jogadores e Revelar para… (grupo `playerVisibility`). */
  jogadores?: PlayerSecretControlsProps
}

/** Para onde a escada leva, numa palavra: outro piso, outra cena ou lugar nenhum (a de enfeite). */
function resumoDoDestino(levaAoPiso: number | undefined, travel: StairTravelProps | null): string {
  if (levaAoPiso !== undefined) return `Piso ${levaAoPiso}`
  if (travel !== null && Boolean(travel.linkedSceneId)) return 'Outra cena'
  return 'Lugar nenhum'
}

export function FichaDaEscada({ controles, levaAoPiso, piso, transicao, jogadores }: FichaDaEscadaProps) {
  const temDestino = controles.travel !== null || piso !== undefined || transicao !== undefined
  return (
    <section className="lb-ficha-da-escada">
      {/* O título do bloco de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Escada</h2>
      <Essencial>
        <StairControls {...controles} parte="essencial" />
        {jogadores !== undefined && <PlayerSecretControls {...jogadores} embutido />}
      </Essencial>
      {temDestino && (
        <Fichas>
          <FichaLembrada
            prefixo={PREFIXO_LEMBRADO}
            id="destino"
            titulo="Para onde leva"
            icone="viagem"
            padrao={false}
            resumo={resumoDoDestino(levaAoPiso, controles.travel)}
          >
            <StairControls {...controles} parte="destino" />
            {piso}
            {transicao}
          </FichaLembrada>
        </Fichas>
      )}
    </section>
  )
}
