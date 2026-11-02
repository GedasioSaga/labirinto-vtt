import { useId, useState, type ReactNode } from 'react'
import { APOSTA_DO_CHOQUE_MAX, KI_POR_PONTO_DE_CHOQUE, type Faixa, type OpcaoDaPendencia } from '../../../lib/dbt/batalha/tipos'
import { Segmentos, Stepper } from '../ficha/pecas'
import { FAIXAS, NOME_DA_FAIXA } from './dadosDaBatalhaDBT'

/**
 * Peças pequenas da batalha DBT, comuns ao mestre e ao jogador. Só mostram o
 * que recebem e devolvem o clique; nenhuma regra mora aqui.
 */

export function BarraDeRecurso({ tipo, atual, max }: { tipo: 'pv' | 'pk'; atual: number; max: number }) {
  const proporcao = max <= 0 ? 0 : Math.min(1, Math.max(0, atual / max))
  const rotulo = tipo === 'pv' ? 'PV' : 'Ki'
  return (
    <span className={`dbb-recurso dbb-recurso--${tipo}`} aria-label={`${rotulo} ${atual} de ${max}`}>
      <span aria-hidden="true">{rotulo}</span>
      <span aria-hidden="true">
        <b>{atual}</b>/{max}
      </span>
      <span className="dbb-recurso__barra" aria-hidden="true">
        <i style={{ transform: `scaleX(${proporcao})` }} />
      </span>
    </span>
  )
}

/** A faixa do golpe, acesa onde ele caiu. Com `onEscolher`, vira o controle segmentado do modo manual. */
export function FaixaDoGolpe({ faixa, critico = false, onEscolher }: { faixa: Faixa; critico?: boolean; onEscolher?: (faixa: Faixa) => void }) {
  if (onEscolher === undefined) {
    return (
      <div className="dbb-faixas" role="img" aria-label={`Faixa: ${NOME_DA_FAIXA[faixa]}${critico ? ', crítico' : ''}`}>
        {FAIXAS.map((candidata) => (
          <span key={candidata} data-faixa={candidata} data-on={candidata === faixa ? 'sim' : 'nao'} aria-hidden="true">
            {candidata === faixa && critico ? 'Crítico' : NOME_DA_FAIXA[candidata]}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="dbb-faixas" role="radiogroup" aria-label="Faixa do golpe">
      {FAIXAS.map((candidata) => (
        <button
          key={candidata}
          type="button"
          role="radio"
          aria-checked={candidata === faixa}
          data-faixa={candidata}
          data-on={candidata === faixa ? 'sim' : 'nao'}
          onClick={() => onEscolher(candidata)}
        >
          {candidata === faixa && critico ? 'Crítico' : NOME_DA_FAIXA[candidata]}
        </button>
      ))}
    </div>
  )
}

export function CustoDeKi({ ki, gratis }: { ki: number; gratis: boolean }) {
  if (gratis || ki === 0) return <span className="dbb-op__ki dbb-op__ki--gratis">sem Ki</span>
  return <span className="dbb-op__ki">{ki} Ki</span>
}

/** Um botão de escolha com custo e, se não vale agora, o motivo embaixo (a opção nunca some). */
export function BotaoDeOpcao({
  rotulo,
  ki,
  gratis,
  bloqueio,
  pressionado,
  onEscolher,
}: {
  rotulo: string
  ki: number
  gratis: boolean
  bloqueio: string | null
  pressionado?: boolean
  onEscolher: () => void
}) {
  const motivo = useId()
  return (
    <button
      type="button"
      className="dbb-op"
      disabled={bloqueio !== null}
      aria-pressed={pressionado}
      aria-describedby={bloqueio === null ? undefined : motivo}
      onClick={onEscolher}
    >
      <span className="dbb-op__n">{rotulo}</span>
      <CustoDeKi ki={ki} gratis={gratis} />
      {bloqueio !== null && (
        <span id={motivo} className="dbb-op__m">
          {bloqueio}
        </span>
      )}
    </button>
  )
}

/** Números da conta: "INT +3", "EP +2". */
export function PartesDaConta({ partes }: { partes: readonly { rotulo: string; valor: number }[] }) {
  if (partes.length === 0) return null
  return (
    <ul className="dbb-conta" aria-label="Conta do acerto">
      {partes.map((parte, indice) => (
        <li key={`${parte.rotulo}-${indice}`}>
          {parte.rotulo} {parte.valor >= 0 ? `+${parte.valor}` : parte.valor}
        </li>
      ))}
    </ul>
  )
}

export function NumeroDoGolpe({ valor, rotulo, tipo }: { valor: number | string; rotulo: string; tipo?: 'ca' | 'dano' }) {
  return (
    <span className={`dbb-golpe__num${tipo === undefined ? '' : ` dbb-golpe__num--${tipo}`}`}>
      <b>{valor}</b>
      <span>{rotulo}</span>
    </span>
  )
}

export interface ExtraDaResposta {
  aposta?: number
  atributo?: 'des' | 'for'
}

/**
 * As respostas de uma pendência como botões. O que pede aposta (Choque)
 * ganha o contador de pontos; o que pede atributo (agarrão) ganha DES/FOR.
 */
export function RespostasDaPendencia({
  opcoes,
  onResponder,
  ocupado = false,
}: {
  opcoes: readonly OpcaoDaPendencia[]
  onResponder: (opcao: OpcaoDaPendencia, extra: ExtraDaResposta) => void
  ocupado?: boolean
}) {
  const [aposta, setAposta] = useState(0)
  const [atributo, setAtributo] = useState<'des' | 'for'>('des')
  const pedeAposta = opcoes.some((opcao) => opcao.pede === 'aposta')
  const pedeAtributo = opcoes.some((opcao) => opcao.pede === 'atributo')
  return (
    <div className="dbb-grupo">
      {pedeAposta && (
        <div className="dbb-campos">
          <span className="dbb-campo">
            Pontos de aposta ({aposta * KI_POR_PONTO_DE_CHOQUE} Ki)
            <Stepper rotulo="pontos de aposta" valor={aposta} onMenos={() => setAposta(Math.max(0, aposta - 1))} onMais={() => setAposta(Math.min(APOSTA_DO_CHOQUE_MAX, aposta + 1))} podeMenos={aposta > 0} podeMais={aposta < APOSTA_DO_CHOQUE_MAX} />
          </span>
        </div>
      )}
      {pedeAtributo && (
        <Segmentos
          rotulo="Atributo do teste"
          opcoes={[
            { valor: 'des', texto: 'DES' },
            { valor: 'for', texto: 'FOR' },
          ]}
          valor={atributo}
          onTrocar={setAtributo}
        />
      )}
      <ul className="dbb-ops">
        {opcoes.map((opcao) => (
          <li key={opcao.chave}>
            <BotaoDeOpcao
              rotulo={opcao.rotulo}
              ki={opcao.pede === 'aposta' ? aposta * KI_POR_PONTO_DE_CHOQUE : opcao.ki}
              gratis={opcao.pede === 'aposta' ? aposta === 0 : opcao.gratis}
              bloqueio={ocupado ? 'Enviando…' : opcao.bloqueio}
              onEscolher={() => onResponder(opcao, opcao.pede === 'aposta' ? { aposta } : opcao.pede === 'atributo' ? { atributo } : {})}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Secao({ titulo, nota, children }: { titulo: string; nota?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section className="dbb-sec" aria-labelledby={id}>
      <h3 id={id} className="dbb-sec__t">
        {titulo}
        {nota !== undefined && <span>{nota}</span>}
      </h3>
      {children}
    </section>
  )
}
