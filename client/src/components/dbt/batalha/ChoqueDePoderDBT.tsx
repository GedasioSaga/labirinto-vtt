import { useState } from 'react'
import { APOSTA_DO_CHOQUE_MAX, KI_POR_PONTO_DE_CHOQUE, PONTOS_DO_CHOQUE } from '../../../lib/dbt/batalha/tipos'
import { Stepper } from '../ficha/pecas'

/**
 * O CHOQUE DE PODER (seção 9, `ChoqueDePoderDBT`): o placar até 3 de cada
 * lado e a aposta antes de rolar (5 Ki por ponto, pagos na hora). O host
 * guarda as duas apostas e só então rola. O mestre aposta pelos dois lados
 * quando é NPC; o jogador vê só o lado dele com o botão.
 */

export interface LadoDoChoque {
  nome: string
  tecnica: string
  pontos: number
  /** Já apostou nesta rodada (o valor fica escondido até rolar). */
  apostou: boolean
  /** Ausente = quem olha não aposta por este lado. */
  onApostar?: (aposta: number) => void
}

export interface ChoqueDePoderDBTProps {
  atacante: LadoDoChoque
  defensor: LadoDoChoque
  /** As rodadas já roladas, a mais nova no fim. */
  rolagens: readonly { atacante: number; defensor: number }[]
  ocupado?: boolean
}

function Pips({ pontos, rotulo }: { pontos: number; rotulo: string }) {
  return (
    <span className="dbb-choque__pips" role="img" aria-label={`${rotulo}: ${pontos} de ${PONTOS_DO_CHOQUE}`}>
      {Array.from({ length: PONTOS_DO_CHOQUE }, (_, indice) => (
        <i key={indice} data-on={indice < pontos ? 'sim' : 'nao'} />
      ))}
    </span>
  )
}

function Lado({ lado, ocupado }: { lado: LadoDoChoque; ocupado: boolean }) {
  const [aposta, setAposta] = useState(0)
  return (
    <div className="dbb-choque__lado">
      <p className="dbb-cartao__t">
        {lado.nome}
        <span className="dbb-cartao__d"> com {lado.tecnica}</span>
      </p>
      <Pips pontos={lado.pontos} rotulo={lado.nome} />
      {lado.apostou ? (
        <p className="dbb-espera">Apostou. Esperando o outro lado.</p>
      ) : lado.onApostar === undefined ? (
        <p className="dbb-cartao__d">Ainda vai apostar.</p>
      ) : (
        <>
          <span className="dbb-campo">
            Pontos ({aposta * KI_POR_PONTO_DE_CHOQUE} Ki, +{aposta} na rolagem)
            <Stepper rotulo={`aposta de ${lado.nome}`} valor={aposta} onMenos={() => setAposta(Math.max(0, aposta - 1))} onMais={() => setAposta(Math.min(APOSTA_DO_CHOQUE_MAX, aposta + 1))} podeMenos={aposta > 0} podeMais={aposta < APOSTA_DO_CHOQUE_MAX} />
          </span>
          <button type="button" className="dbf-btn dbf-btn--pri" disabled={ocupado} onClick={() => lado.onApostar?.(aposta)}>
            {ocupado ? 'Enviando…' : 'Apostar e rolar'}
          </button>
        </>
      )}
    </div>
  )
}

export function ChoqueDePoderDBT({ atacante, defensor, rolagens, ocupado = false }: ChoqueDePoderDBTProps) {
  const ultima = rolagens.length === 0 ? null : rolagens[rolagens.length - 1]
  return (
    <section className="dbb-cartao dbb-cartao--ki" aria-label={`Choque de Poder: ${atacante.nome} contra ${defensor.nome}`}>
      <p className="dbb-cartao__t">Choque de Poder</p>
      <div className="dbb-choque">
        <Lado lado={atacante} ocupado={ocupado} />
        <Lado lado={defensor} ocupado={ocupado} />
      </div>
      <p className="dbb-cartao__d" aria-live="polite">
        {ultima === null
          ? 'O primeiro a 3 vence. Empate não pontua.'
          : `Última rodada: ${atacante.nome} ${ultima.atacante}, ${defensor.nome} ${ultima.defensor}${ultima.atacante === ultima.defensor ? ' (empate, rola de novo)' : ''}.`}
      </p>
    </section>
  )
}
