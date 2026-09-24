import { useId, useState, type FormEvent } from 'react'
import {
  APITOS,
  adicionarEvento,
  avisoDoEvento,
  DIA_MAXIMO,
  formatarMomento,
  isApito,
  isDiaValido,
  jaPassou,
  levarAgendaA,
  NOME_DO_APITO,
  novaAgenda,
  proximoApito,
  proximoDia,
  removerEvento,
  TITULO_MAX,
  type AgendaDaCampanha,
  type Apito,
  type EventoDaAgenda,
  type MomentoDaMesa,
} from '../lib/agendaDaCampanha'
import { useToastStore } from '../stores/toastStore'
import { CollapsibleSection } from './CollapsibleSection'

/** O grupo dos avisos da agenda na Caixa: "Agenda (2)". */
export const GRUPO_DA_AGENDA = 'Agenda'

export interface AgendaSectionProps {
  /** A agenda da aventura; ausente = campanha que ainda não marcou nada. */
  agenda: AgendaDaCampanha | undefined
  /** Grava a agenda nova (hora que andou, evento marcado ou removido). */
  onChange(agenda: AgendaDaCampanha): void
}

/**
 * Cada evento que disparou vira um aviso na Caixa do mestre, no grupo
 * "Agenda", sem prazo: quem decide que já leu é ele. Nada disto sai da janela
 * do mestre.
 */
function avisarNaCaixa(disparados: readonly EventoDaAgenda[]): void {
  const { push } = useToastStore.getState()
  for (const evento of disparados) push('info', avisoDoEvento(evento), null, { grupo: GRUPO_DA_AGENDA, sempreEmCaixa: true })
}

interface EventoFormProps {
  agora: MomentoDaMesa
  onMarcar(titulo: string, quando: MomentoDaMesa): boolean
}

/** "Novo evento": título, dia e apito. Momento que já passou não deixa marcar. */
function EventoForm({ agora, onMarcar }: EventoFormProps) {
  const baseId = useId()
  const [titulo, setTitulo] = useState('')
  const [dia, setDia] = useState(String(agora.dia))
  const [apito, setApito] = useState<Apito>(proximoApito(agora).apito)
  const diaNumero = Number(dia)
  const diaOk = dia.trim().length > 0 && isDiaValido(diaNumero)
  const passou = diaOk && jaPassou(agora, { dia: diaNumero, apito })
  const pronto = titulo.trim().length > 0 && diaOk && !passou

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pronto && onMarcar(titulo, { dia: diaNumero, apito })) setTitulo('')
  }

  return (
    <form className="lb-agenda__form" aria-label="Novo evento" onSubmit={submit}>
      <div className="lb-field">
        <label className="lb-label" htmlFor={`${baseId}-titulo`}>
          Evento
        </label>
        <input
          id={`${baseId}-titulo`}
          className="lb-input"
          value={titulo}
          maxLength={TITULO_MAX}
          placeholder="Disparo dos Gêmeos"
          onChange={(event) => setTitulo(event.target.value)}
        />
      </div>
      <div className="lb-agenda__quando">
        <div className="lb-field">
          <label className="lb-label" htmlFor={`${baseId}-dia`}>
            Dia
          </label>
          <input
            id={`${baseId}-dia`}
            className="lb-input"
            type="number"
            min={1}
            max={DIA_MAXIMO}
            step={1}
            value={dia}
            onChange={(event) => setDia(event.target.value)}
          />
        </div>
        <div className="lb-field">
          <label className="lb-label" htmlFor={`${baseId}-apito`}>
            Apito
          </label>
          <select
            id={`${baseId}-apito`}
            className="lb-input"
            value={apito}
            onChange={(event) => {
              const escolhido = event.target.value
              if (isApito(escolhido)) setApito(escolhido)
            }}
          >
            {APITOS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {NOME_DO_APITO[opcao]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {passou && (
        <p className="lb-agenda__dica" role="status">
          Esse momento já passou: escolha um depois de agora.
        </p>
      )}
      <div className="lb-cenas__acoes">
        <button type="submit" className="lb-btn" disabled={!pronto}>
          Marcar
        </button>
      </div>
    </form>
  )
}

/**
 * AGENDA DA CAMPANHA, no painel do mestre: a hora da mesa (dia e apito), os
 * botões que a fazem andar e os eventos marcados. Quando a hora chega ao
 * momento de um evento, ele vai para a Caixa ("Agenda") — nunca ao jogador.
 */
export function AgendaSection({ agenda, onChange }: AgendaSectionProps) {
  const atual = agenda ?? novaAgenda()

  const levarA = (momento: MomentoDaMesa) => {
    const { agenda: nova, disparados } = levarAgendaA(atual, momento)
    onChange(nova)
    avisarNaCaixa(disparados)
  }

  const marcar = (titulo: string, quando: MomentoDaMesa): boolean => {
    const nova = adicionarEvento(atual, titulo, quando)
    if (nova === null) return false
    onChange(nova)
    return true
  }

  return (
    <CollapsibleSection id="agenda" title="Agenda" defaultOpen={false}>
      <div className="lb-agenda">
        <p className="lb-agenda__agora" aria-live="polite">
          Agora: {formatarMomento(atual.agora)}
        </p>
        <div className="lb-cenas__acoes">
          <button type="button" className="lb-btn" title="Avança a hora da mesa um apito" onClick={() => levarA(proximoApito(atual.agora))}>
            Próximo apito
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" title="Vai à Aurora do dia seguinte" onClick={() => levarA(proximoDia(atual.agora))}>
            Próximo dia
          </button>
        </div>
        {atual.eventos.length === 0 ? (
          <p className="lb-agenda__vazio">Nenhum evento marcado.</p>
        ) : (
          <ul className="lb-agenda__lista" aria-label="Eventos da agenda">
            {atual.eventos.map((evento) => (
              <li key={evento.id} className="lb-agenda__evento" data-disparado={evento.disparado === true ? 'true' : undefined}>
                <span className="lb-agenda__titulo">{evento.titulo}</span>
                <span className="lb-agenda__momento">
                  {formatarMomento(evento.quando)}
                  {evento.disparado === true && ' · Disparou'}
                </span>
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-agenda__remover"
                  aria-label={`Remover ${evento.titulo}`}
                  title="Remover evento"
                  onClick={() => onChange(removerEvento(atual, evento.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <EventoForm agora={atual.agora} onMarcar={marcar} />
      </div>
    </CollapsibleSection>
  )
}
