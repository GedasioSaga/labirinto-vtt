import { useEffect, useState } from 'react'
import type { AtaqueResolvido, Faixa, JanelaDeReacao, NucleoDBT, OpcaoDaPendencia } from '../../../lib/dbt/batalha/tipos'
import { nomeDoCombatente } from './dadosDaBatalhaDBT'
import { FaixaDoGolpe, NumeroDoGolpe, RespostasDaPendencia, type ExtraDaResposta } from './pecasDaBatalhaDBT'

/**
 * A JANELA DE REAÇÃO (seção 8, `CaixaDeReacaoDBT`): quem atacou, com o quê,
 * o acerto contra a CA, a faixa acesa e o dano que vem (só quando quem olha
 * pode saber), as reações com o custo e quanto tempo a mesa já espera. O Ki
 * da reação só sai quando a janela resolve.
 */

/** O golpe como a caixa mostra; o jogador recebe só o que o recorte deixa. */
export interface GolpeNaTela {
  atacante: string
  alvo: string
  tecnica: string
  total: number | null
  d20: number | null
  ca: number | null
  faixa: Faixa
  critico: boolean
  /** null = quem olha não vê o dano (alvo de outro lado). */
  dano: number | null
}

export function golpeDoAtaque(nucleo: NucleoDBT, ataque: AtaqueResolvido): GolpeNaTela {
  return {
    atacante: nomeDoCombatente(nucleo, ataque.atacanteId),
    alvo: nomeDoCombatente(nucleo, ataque.alvoId),
    tecnica: ataque.tecnica.nome,
    total: ataque.rolagem?.total ?? ataque.salvaguarda?.total ?? null,
    d20: ataque.rolagem?.d20 ?? ataque.salvaguarda?.d20 ?? null,
    ca: ataque.ca,
    faixa: ataque.faixa,
    critico: ataque.critico,
    dano: ataque.danoPrevisto,
  }
}

/** "Lia: Barreira" por quem já respondeu na janela (só o mestre vê todos). */
export function respostasDaJanela(nucleo: NucleoDBT, janela: JanelaDeReacao): string[] {
  return janela.convidados.map((id) => {
    const resposta = Object.hasOwn(janela.respostas, id) ? janela.respostas[id] : undefined
    const texto = resposta === undefined ? 'ainda decidindo' : resposta === 'nao' ? 'não reage' : resposta.map((escolhida) => `${escolhida.tipo} (${escolhida.ki} Ki)`).join(', ')
    return `${nomeDoCombatente(nucleo, id)}: ${texto}`
  })
}

function useSegundosDesde(desde: number | null): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (desde === null) return
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(relogio)
  }, [desde])
  return desde === null ? 0 : Math.max(0, Math.floor((agora - desde) / 1000))
}

export interface CaixaDeReacaoDBTProps {
  golpe: GolpeNaTela
  /** Quem reage (o nome aparece no título quando não é o alvo, ou quando o mestre responde por um NPC). */
  reator?: string
  opcoes: readonly OpcaoDaPendencia[]
  onResponder: (opcao: OpcaoDaPendencia, extra: ExtraDaResposta) => void
  /** As respostas já dadas (mestre). */
  respostas?: readonly string[]
  /** Quando a janela abriu (relógio local); null = sem contador. */
  desde?: number | null
  ocupado?: boolean
}

export function CaixaDeReacaoDBT({ golpe, reator, opcoes, onResponder, respostas = [], desde = null, ocupado = false }: CaixaDeReacaoDBTProps) {
  const segundos = useSegundosDesde(desde)
  return (
    <section className="dbb-cartao" aria-label={`Reação: ${golpe.atacante} acerta ${golpe.alvo}`}>
      <p className="dbb-cartao__t">
        {golpe.atacante} acerta {golpe.alvo} com {golpe.tecnica}
      </p>
      <div className="dbb-golpe">
        {golpe.total !== null && <NumeroDoGolpe valor={golpe.total} rotulo={golpe.d20 === null ? 'acerto' : `acerto, d20 ${golpe.d20}`} />}
        {golpe.ca !== null && <NumeroDoGolpe valor={golpe.ca} rotulo="CA" tipo="ca" />}
        {golpe.dano !== null && <NumeroDoGolpe valor={golpe.dano} rotulo="dano que vem" tipo="dano" />}
      </div>
      <FaixaDoGolpe faixa={golpe.faixa} critico={golpe.critico} />
      {respostas.length > 0 && (
        <ul className="dbb-conta" aria-label="Quem já respondeu">
          {respostas.map((texto) => (
            <li key={texto}>{texto}</li>
          ))}
        </ul>
      )}
      <p className="dbb-cartao__d">
        {reator === undefined ? 'Reagir antes do dano.' : `${reator} reage antes do dano.`} O Ki sai quando a janela fecha; errar pela CA já foi a esquiva.
        {desde !== null && ` A mesa espera há ${segundos} s.`}
      </p>
      <RespostasDaPendencia opcoes={opcoes} onResponder={onResponder} ocupado={ocupado} />
    </section>
  )
}
