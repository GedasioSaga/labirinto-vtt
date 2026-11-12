import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { DOOR_REQUEST_TEXT_MAX_LENGTH, type DoorRequestHow, type DoorToggleRejection } from '../net/protocol'
import type { DoorNotice, DoorRequestPhase } from './playerConnection'
import './PlayerDoorNotice.css'

/** Recusa do mestre ao toque na porta, em uma linha curta. */
const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  wrong_side: 'Não dá para abrir por este lado',
  blocked: 'Tem alguém no vão da porta',
  no_peek: 'Não dá para espiar aqui',
  // O "Trancar deste lado" numa porta já trancada: uma linha só, sem os botões de quem quer entrar.
  ja_trancada: 'Já está trancada',
}

/**
 * Os atalhos do "o que você faz?": um toque preenche o campo com o texto
 * pronto, e o jogador ainda pode mudar antes de enviar.
 */
const ATALHOS_DO_PEDIDO: readonly { rotulo: string; texto: string }[] = [
  { rotulo: 'Bater', texto: 'Bato na porta' },
  { rotulo: 'Forçar', texto: 'Tento forçar a porta' },
]

const DOOR_REQUEST_TEXT: Record<DoorRequestPhase, string> = {
  sent: 'Pedido enviado',
  opened: 'O mestre abriu',
  denied: 'O mestre disse não',
  pending: 'Seu pedido anterior ainda espera o mestre',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  not_locked: 'Essa porta abre com um toque',
}

/** O aviso do pedido da porta trancada, em uma linha. */
export function doorRequestText(phase: DoorRequestPhase): string {
  return DOOR_REQUEST_TEXT[phase]
}

export interface PlayerDoorNoticeProps {
  notice: DoorNotice
  /**
   * "Pedir ao mestre": `how` é sempre `ask` nesta tela, e `texto` o "o que
   * você faz?", aparado (`''` = vazio: o mestre lê "<ficha> quer abrir a porta").
   */
  onRequest(wallId: string, how: DoorRequestHow, texto: string): void
  /** CHAVE ABRE PORTA: "Usar <chave>". Sem ele, o botão não aparece nem com a chave na mochila. */
  onUseKey?(wallId: string): void
  onClose(): void
}

/**
 * O aviso da porta na tela do jogador. As recusas de sempre continuam uma
 * linha que some sozinha. "Trancada" vira a pergunta "e agora?" (decisão 1 do
 * mestre, 12/11): quem tem a chave DESTA porta vê "Usar <chave>", que abre na
 * hora; todo mundo vê UM "Pedir ao mestre", que abre o campo "O que você
 * faz?" (opcional, até 120 letras, como o Falar e o Ação da ficha) com os
 * atalhos "Bater" e "Forçar". O × fecha sem pedir.
 *
 * `role="group"` com nome, e não `status`: tem botões dentro, e o leitor de
 * tela anuncia o grupo "Porta trancada" ao chegar nele. O texto e os botões
 * são texto do React (sem HTML).
 */
export function PlayerDoorNotice({ notice, onRequest, onUseKey, onClose }: PlayerDoorNoticeProps) {
  const [pedindo, setPedindo] = useState(false)
  const [texto, setTexto] = useState('')
  const campoRef = useRef<HTMLInputElement | null>(null)
  const pedirRef = useRef<HTMLButtonElement | null>(null)
  /** Só depois de "Voltar": ao montar, o foco fica onde o jogador estava (o mapa). */
  const voltou = useRef(false)
  const campoId = useId()

  useEffect(() => {
    // Abriu o campo: o foco vai para ele. Voltou: o foco volta ao "Pedir ao mestre".
    if (pedindo) campoRef.current?.focus()
    else if (voltou.current) pedirRef.current?.focus()
  }, [pedindo])

  const key = notice.key
  if (notice.reason !== 'locked') {
    return (
      <p className="pp-notice" role="status" aria-live="polite">
        {DOOR_NOTICE_TEXT[notice.reason]}
      </p>
    )
  }

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onRequest(notice.wallId, 'ask', texto.trim())
  }
  const voltar = () => {
    voltou.current = true
    setPedindo(false)
    setTexto('')
  }

  if (pedindo) {
    return (
      <form className="pp-notice pp-notice--door pp-door-ask" aria-label="Pedir ao mestre" onSubmit={enviar}>
        <label className="pp-door-ask__label" htmlFor={campoId}>
          O que você faz? <span className="pp-door-ask__hint">(opcional)</span>
        </label>
        <input
          ref={campoRef}
          id={campoId}
          className="pp-tokencard__field"
          type="text"
          value={texto}
          maxLength={DOOR_REQUEST_TEXT_MAX_LENGTH}
          aria-describedby={`${campoId}-count`}
          onChange={(event) => setTexto(event.target.value)}
        />
        <p id={`${campoId}-count`} className="pp-door-ask__count" aria-live="polite">
          Faltam {DOOR_REQUEST_TEXT_MAX_LENGTH - texto.length} caracteres
        </p>
        <div className="pp-door-ask__row" role="group" aria-label="Atalhos">
          {ATALHOS_DO_PEDIDO.map((atalho) => (
            <button
              key={atalho.rotulo}
              type="button"
              className="pp-notice__action"
              onClick={() => {
                setTexto(atalho.texto)
                campoRef.current?.focus()
              }}
            >
              {atalho.rotulo}
            </button>
          ))}
        </div>
        <div className="pp-door-ask__row pp-door-ask__row--end">
          <button type="submit" className="pp-notice__action pp-notice__action--primary">
            Enviar ao mestre
          </button>
          <button type="button" className="pp-notice__action" onClick={voltar}>
            Voltar
          </button>
          <button type="button" className="pp-notice__close" aria-label="Fechar aviso" onClick={onClose}>
            ×
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="pp-notice pp-notice--door" role="group" aria-label="Porta trancada">
      <span className="pp-notice__text" role="status" aria-live="polite">
        {DOOR_NOTICE_TEXT.locked}
      </span>
      {/* Quem tem a chave desta porta abre sem pedir: é a ação primeira, antes do pedido ao mestre. */}
      {key !== undefined && onUseKey !== undefined && (
        <button type="button" className="pp-notice__action pp-notice__action--primary" onClick={() => onUseKey(notice.wallId)}>
          {`Usar ${key}`}
        </button>
      )}
      <button ref={pedirRef} type="button" className="pp-notice__action" onClick={() => setPedindo(true)}>
        Pedir ao mestre
      </button>
      <button type="button" className="pp-notice__close" aria-label="Fechar aviso" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
