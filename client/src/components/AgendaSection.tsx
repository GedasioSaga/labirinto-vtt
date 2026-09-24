import { useId, useState, type FormEvent } from 'react'
import {
  APITOS,
  adicionarEvento,
  avisoDoEvento,
  criarEfeitoAlarme,
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
  type EfeitoDoEvento,
  type EventoDaAgenda,
  type MomentoDaMesa,
} from '../lib/agendaDaCampanha'
import { ALARM_MAX_LENGTH } from '../net/protocol'
import type { SceneListItem } from '../stores/adventureStore'
import { useToastStore } from '../stores/toastStore'
import { CollapsibleSection } from './CollapsibleSection'

/** O grupo dos avisos da agenda na Caixa: "Agenda (2)". */
export const GRUPO_DA_AGENDA = 'Agenda'

/** Soa o alarme nas cenas (`hostBridge.sceneAlarm`): quantos receberam, ou `null` se não deu. */
export type SoarAlarme = (sceneIds: string[], text: string) => number | null

export interface AgendaSectionProps {
  /** A agenda da aventura; ausente = campanha que ainda não marcou nada. */
  agenda: AgendaDaCampanha | undefined
  /** Grava a agenda nova (hora que andou, evento marcado ou removido). */
  onChange(agenda: AgendaDaCampanha): void
  /** As cenas da aventura, para escolher onde soa o alarme de um evento. Ausente = sem alarme no formulário. */
  cenas?: readonly SceneListItem[]
  /** Soa o alarme de um evento que disparou. Ausente = sala fechada: o alarme não soa e a Caixa diz isso. */
  onAlarm?: SoarAlarme
}

const AVISO_NA_CAIXA = { grupo: GRUPO_DA_AGENDA, sempreEmCaixa: true } as const

/**
 * Cada evento que disparou vira um aviso na Caixa do mestre, no grupo
 * "Agenda", sem prazo: quem decide que já leu é ele. O alarme do evento é a
 * única coisa que sai da janela do mestre, e só aqui, no disparo. Vários
 * alarmes no mesmo avanço soam na ordem da hora: o último fica soando.
 */
function dispararEventos(disparados: readonly EventoDaAgenda[], onAlarm: SoarAlarme | undefined): void {
  const { push } = useToastStore.getState()
  for (const evento of disparados) {
    push('info', avisoDoEvento(evento), null, AVISO_NA_CAIXA)
    if (evento.efeito === undefined) continue
    const enviados = onAlarm === undefined ? null : onAlarm([...evento.efeito.cenas], evento.efeito.texto)
    if (enviados === null) push('error', `Alarme de "${evento.titulo}" não soou: a sala não está aberta.`, null, AVISO_NA_CAIXA)
  }
}

/** As cenas onde o alarme pode soar: da aventura (não o mapa solto) e com o arquivo aberto. */
function cenasComAlarme(cenas: readonly SceneListItem[]): SceneListItem[] {
  return cenas.filter((cena) => cena.id !== '' && cena.available)
}

interface EventoFormProps {
  agora: MomentoDaMesa
  cenas: readonly SceneListItem[]
  onMarcar(titulo: string, quando: MomentoDaMesa, efeito: EfeitoDoEvento | undefined): boolean
}

interface AlarmeDoEventoProps {
  baseId: string
  cenas: readonly SceneListItem[]
  texto: string
  escolhidas: ReadonlySet<string>
  onTexto(texto: string): void
  onEscolher(cenaId: string, marcada: boolean): void
}

/** O alarme do evento: o aviso que o jogador lê no disparo e as cenas onde soa. */
function AlarmeDoEvento({ baseId, cenas, texto, escolhidas, onTexto, onEscolher }: AlarmeDoEventoProps) {
  return (
    <div className="lb-agenda__alarme">
      <div className="lb-field">
        <label className="lb-label" htmlFor={`${baseId}-alarme-texto`}>
          Aviso de alarme
        </label>
        <textarea
          id={`${baseId}-alarme-texto`}
          className="lb-input lb-cenas__recado-campo"
          rows={2}
          value={texto}
          maxLength={ALARM_MAX_LENGTH}
          placeholder="O sino da torre tocou!"
          onChange={(event) => onTexto(event.target.value)}
        />
      </div>
      <fieldset className="lb-alarme__cenas">
        <legend className="lb-label">Soar em</legend>
        <ul className="lb-gather__list">
          {cenas.map((cena) => (
            <li key={cena.id}>
              <label className="lb-gather__item">
                <input
                  type="checkbox"
                  className="lb-gather__check"
                  checked={escolhidas.has(cena.id)}
                  onChange={(event) => onEscolher(cena.id, event.target.checked)}
                />
                <span>{cena.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  )
}

/** "Novo evento": título, dia e apito, e o alarme opcional. Momento que já passou não deixa marcar. */
function EventoForm({ agora, cenas, onMarcar }: EventoFormProps) {
  const baseId = useId()
  const [titulo, setTitulo] = useState('')
  const [dia, setDia] = useState(String(agora.dia))
  const [apito, setApito] = useState<Apito>(proximoApito(agora).apito)
  const [comAlarme, setComAlarme] = useState(false)
  const [textoAlarme, setTextoAlarme] = useState('')
  const [escolhidas, setEscolhidas] = useState<ReadonlySet<string>>(new Set())
  const diaNumero = Number(dia)
  const diaOk = dia.trim().length > 0 && isDiaValido(diaNumero)
  const passou = diaOk && jaPassou(agora, { dia: diaNumero, apito })
  const podeAlarme = cenas.length > 0
  // Na ordem da lista de cenas, não na dos cliques.
  const efeito = comAlarme && podeAlarme ? criarEfeitoAlarme(cenas.filter((cena) => escolhidas.has(cena.id)).map((cena) => cena.id), textoAlarme) : undefined
  const pronto = titulo.trim().length > 0 && diaOk && !passou && efeito !== null

  const escolher = (cenaId: string, marcada: boolean) => {
    setEscolhidas((atuais) => {
      const proximas = new Set(atuais)
      if (marcada) proximas.add(cenaId)
      else proximas.delete(cenaId)
      return proximas
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pronto || efeito === null || !onMarcar(titulo, { dia: diaNumero, apito }, efeito)) return
    setTitulo('')
    setComAlarme(false)
    setTextoAlarme('')
    setEscolhidas(new Set())
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
      {podeAlarme && (
        <label className="lb-gather__item">
          <input type="checkbox" className="lb-gather__check" checked={comAlarme} onChange={(event) => setComAlarme(event.target.checked)} />
          <span>Soar alarme ao disparar</span>
        </label>
      )}
      {podeAlarme && comAlarme && (
        <AlarmeDoEvento baseId={baseId} cenas={cenas} texto={textoAlarme} escolhidas={escolhidas} onTexto={setTextoAlarme} onEscolher={escolher} />
      )}
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
 * momento de um evento, ele vai para a Caixa ("Agenda") — o título nunca vai ao
 * jogador; o alarme do evento, se houver, soa só nesse momento.
 */
export function AgendaSection({ agenda, onChange, cenas = [], onAlarm }: AgendaSectionProps) {
  const atual = agenda ?? novaAgenda()

  const levarA = (momento: MomentoDaMesa) => {
    const { agenda: nova, disparados } = levarAgendaA(atual, momento)
    onChange(nova)
    dispararEventos(disparados, onAlarm)
  }

  const marcar = (titulo: string, quando: MomentoDaMesa, efeito: EfeitoDoEvento | undefined): boolean => {
    const nova = adicionarEvento(atual, titulo, quando, efeito)
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
                  {evento.efeito !== undefined && ' · Alarme'}
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
        <EventoForm agora={atual.agora} cenas={cenasComAlarme(cenas)} onMarcar={marcar} />
      </div>
    </CollapsibleSection>
  )
}
