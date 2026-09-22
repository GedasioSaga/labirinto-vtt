import { useRef, useState, type KeyboardEvent } from 'react'
import type { PinTravel, TravelPinOption, TravelSceneOption } from '../lib/pinTravel'
import { PIN_PASSAGE_LABELS, PIN_PASSAGE_ORDER } from '../lib/pins'
import type { PinPassage } from '../types/map'
import { ChevronDownIcon } from './icons'

export interface PinTravelControlsProps {
  /** Para onde o pino aberto no painel leva agora. */
  travel: PinTravel
  /** Cenas para onde ele pode levar: todas as da aventura menos a aberta. */
  scenes: readonly TravelSceneOption[]
  /** Pinos de viagem de uma cena, para ligar a um que já está lá. */
  pinsIn: (sceneId: string) => readonly TravelPinOption[]
  /** Cria o pino de chegada no centro de `sceneId` e liga os dois. */
  onLinkNew: (sceneId: string) => void
  onLinkExisting: (sceneId: string, pinId: string) => void
  onUnlink: () => void
  /** Leva a visão do mestre pela passagem — o mesmo que o clique com Selecionar. */
  onGo: () => void
  /** Como o jogador passa por ESTE pino (o par tem o seu). */
  passage: PinPassage
  onPassageChange: (passage: PinPassage) => void
}

/** Onde está a escolha de "Leva a…": fechada, escolhendo a cena, ou escolhendo o pino de lá. */
type Escolha = { passo: 'cena' } | { passo: 'pino'; sceneId: string } | null

/** Ids fixos: só existe um pino aberto no painel por vez (o mesmo molde de `lb-pin-description`). */
const STATUS_ID = 'lb-pin-travel-status'
const SELETOR_ID = 'lb-pin-travel-picker'
const CENAS_ID = 'lb-pin-travel-scenes'
const PINOS_ID = 'lb-pin-travel-pins'
const PASSAGEM_ID = 'lb-pin-travel-passage'

/** O que cada modo faz, dito ao mestre logo abaixo da escolha. */
const EFEITO_DA_PASSAGEM: Record<PinPassage, string> = {
  pede: 'O jogador pede e você decide se ele passa.',
  livre: 'O jogador passa sozinho; você só lê que ele chegou.',
  trancada: 'Ninguém passa por aqui, e nenhum pedido chega a você.',
}

/** Foco depois do render: quem o recebe pode ter acabado de nascer (ou de trocar de pino). */
function focarDepois(achar: () => HTMLElement | null | undefined): void {
  requestAnimationFrame(() => achar()?.focus())
}

function detalhe(travel: PinTravel, temCena: boolean, algumaAbre: boolean): string {
  if (travel.status === 'indisponivel') return 'A cena não abriu: o arquivo dela não foi encontrado.'
  if (travel.status === 'ligado') {
    const descricao = travel.partner.description.trim()
    return descricao === '' ? 'até um pino sem descrição' : `até “${descricao}”`
  }
  if (!temCena) return 'Crie outra cena em Cenas para ter para onde levar.'
  if (!algumaAbre) return 'As outras cenas não abriram.'
  return 'Escolha a cena e o pino de chegada.'
}

/**
 * Destino do PINO DE VIAGEM, dentro do painel do pino (a mesma `section`).
 *
 * Primeiro o que é, em texto: "Leva a Cripta" com o pino par embaixo, ou
 * "Sem destino". Depois o que dá para fazer. "Leva a…" abre a escolha em dois
 * passos, no próprio painel: a cena, e lá o pino de chegada — criar um novo,
 * que nasce no centro da cena, ou ligar a um pino de viagem que já está lá.
 *
 * A régua à esquerda do bloco diz o estado sem depender de ler: latão quando
 * a passagem leva a algum lugar, apagada quando não — a mesma troca que o
 * ícone faz no mapa.
 *
 * Teclado: Esc fecha a escolha e devolve o foco a quem a abriu; as setas andam
 * entre as opções; depois de ligar, desligar ou atravessar, o foco vai para a
 * frase do destino, que é o que mudou (e o leitor de tela a lê: `aria-live`).
 */
export function PinTravelControls({ travel, scenes, pinsIn, onLinkNew, onLinkExisting, onUnlink, onGo, passage, onPassageChange }: PinTravelControlsProps) {
  const [escolha, setEscolha] = useState<Escolha>(null)
  const gatilhoRef = useRef<HTMLButtonElement | null>(null)
  const seletorRef = useRef<HTMLDivElement | null>(null)
  /** A cena escolhida no passo 1: "Voltar" devolve o foco a ela, e não ao topo da lista. */
  const cenaEscolhidaRef = useRef<string | null>(null)

  const temCena = scenes.length > 0
  const algumaAbre = scenes.some((scene) => scene.available)
  const aberta = escolha !== null

  const opcoes = () => Array.from(seletorRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
  const frase = () => document.getElementById(STATUS_ID)

  const abrir = () => {
    setEscolha({ passo: 'cena' })
    focarDepois(() => opcoes()[0])
  }
  const fechar = () => {
    setEscolha(null)
    focarDepois(() => gatilhoRef.current)
  }
  const alternar = () => (aberta ? fechar() : abrir())
  const escolherCena = (sceneId: string) => {
    cenaEscolhidaRef.current = sceneId
    setEscolha({ passo: 'pino', sceneId })
    focarDepois(() => opcoes()[0])
  }
  const voltar = () => {
    setEscolha({ passo: 'cena' })
    const cena = cenaEscolhidaRef.current
    focarDepois(() => (cena === null ? null : seletorRef.current?.querySelector<HTMLButtonElement>(`[data-cena="${CSS.escape(cena)}"]`)) ?? opcoes()[0])
  }
  /** Depois de mudar a ligação, o foco vai para o que mudou: a frase do destino. */
  const concluir = (acao: () => void) => {
    acao()
    setEscolha(null)
    focarDepois(frase)
  }

  const aoTeclar = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!aberta) return
    // Esc e setas param aqui: no window, Esc largaria o pino inteiro e a seta
    // moveria o que estiver selecionado no mapa.
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      fechar()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const botoes = opcoes()
    if (botoes.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement)
    const passo = event.key === 'ArrowDown' ? 1 : -1
    const proximo = atual === -1 ? (passo === 1 ? 0 : botoes.length - 1) : (atual + passo + botoes.length) % botoes.length
    botoes[proximo]?.focus()
  }

  const gatilho = (rotulo: string, className: string) => (
    <button
      ref={gatilhoRef}
      type="button"
      className={className}
      aria-expanded={aberta}
      aria-controls={aberta ? SELETOR_ID : undefined}
      disabled={!algumaAbre}
      onClick={alternar}
    >
      {rotulo}
      {/* A mesma divisa das seções recolhíveis (CollapsibleSection): de lado
          fechada, para baixo aberta. Decorativa: o estado é o `aria-expanded`. */}
      <span className="lb-travel__chevron">
        <ChevronDownIcon size={14} />
      </span>
    </button>
  )

  return (
    <div className={`lb-travel lb-travel--${travel.status}`} role="group" aria-label="Destino da viagem" onKeyDown={aoTeclar}>
      <p id={STATUS_ID} className="lb-travel__status" tabIndex={-1} aria-live="polite">
        {travel.status === 'sem-destino' ? (
          <span className="lb-travel__title">Sem destino</span>
        ) : (
          <span className="lb-travel__title">
            Leva a <strong className="lb-travel__scene">{travel.sceneName}</strong>
          </span>
        )}
        <span className="lb-travel__detail">{detalhe(travel, temCena, algumaAbre)}</span>
      </p>

      {travel.status === 'ligado' && (
        <button type="button" className="lb-btn lb-btn--block" onClick={() => concluir(onGo)}>
          Ir para {travel.sceneName}
        </button>
      )}
      {travel.status === 'sem-destino' ? (
        gatilho('Leva a…', 'lb-btn lb-btn--block')
      ) : (
        <div className="lb-travel__row">
          {gatilho('Trocar destino', 'lb-btn lb-btn--ghost')}
          <button type="button" className="lb-btn lb-btn--ghost" onClick={() => concluir(onUnlink)}>
            Desligar
          </button>
        </div>
      )}
      {travel.status === 'ligado' && !aberta && <p className="lb-travel__hint">No mapa, um clique no pino com Selecionar também leva.</p>}

      {/* Como o JOGADOR passa: numa mesa espalhada por várias cenas, aprovar
          cada passagem vira gargalo do mestre. Vale só para este pino — a
          volta tem o modo dela, no pino par. Mesmo segmented em linhas do
          "Tipo do pino": "Pede ao mestre" não cabe em um terço do poço. */}
      <span className="lb-label" id={PASSAGEM_ID}>
        Passagem
      </span>
      <div className="lb-seg lb-seg--rows" role="radiogroup" aria-labelledby={PASSAGEM_ID}>
        {PIN_PASSAGE_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={passage === option}
            className="lb-seg__option"
            onClick={() => onPassageChange(option)}
          >
            {PIN_PASSAGE_LABELS[option]}
          </button>
        ))}
      </div>
      <p className="lb-travel__hint">{EFEITO_DA_PASSAGEM[passage]}</p>

      {escolha !== null && (
        <div id={SELETOR_ID} ref={seletorRef} className="lb-travel__picker">
          {escolha.passo === 'cena' ? (
            <>
              <p className="lb-label" id={CENAS_ID}>
                Para qual cena?
              </p>
              <ul className="lb-travel__options" aria-labelledby={CENAS_ID}>
                {scenes.map((scene) => (
                  <li key={scene.id} className="lb-travel__option">
                    <button
                      type="button"
                      className="lb-btn lb-travel__choice"
                      data-cena={scene.id}
                      disabled={!scene.available}
                      onClick={() => escolherCena(scene.id)}
                    >
                      {scene.name}
                    </button>
                    {!scene.available && <span className="lb-travel__note">não abriu</span>}
                  </li>
                ))}
              </ul>
              <div className="lb-travel__row lb-travel__row--end">
                <button type="button" className="lb-btn lb-btn--ghost" onClick={fechar}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <PassoDoPino
              sceneName={scenes.find((scene) => scene.id === escolha.sceneId)?.name ?? ''}
              pins={pinsIn(escolha.sceneId)}
              onCreate={() => concluir(() => onLinkNew(escolha.sceneId))}
              onPick={(pinId) => concluir(() => onLinkExisting(escolha.sceneId, pinId))}
              onBack={voltar}
              onCancel={fechar}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface PassoDoPinoProps {
  sceneName: string
  pins: readonly TravelPinOption[]
  onCreate: () => void
  onPick: (pinId: string) => void
  onBack: () => void
  onCancel: () => void
}

/**
 * Passo 2 do "Leva a…": onde o pino chega na cena escolhida. Criar a chegada
 * vem primeiro — é o caminho da primeira ligação —, e os pinos de viagem que
 * já estão lá vêm depois; o que já leva a outro lugar aparece desabilitado,
 * com o motivo, em vez de sumir.
 */
function PassoDoPino({ sceneName, pins, onCreate, onPick, onBack, onCancel }: PassoDoPinoProps) {
  return (
    <>
      <p className="lb-label">Chegada em {sceneName}</p>
      <button type="button" className="lb-btn lb-btn--block" onClick={onCreate}>
        Criar pino de chegada
      </button>
      <p className="lb-travel__hint">Nasce no centro da cena, já ligado de volta; depois é só arrastar.</p>
      {pins.length > 0 && (
        <>
          <p className="lb-label" id={PINOS_ID}>
            Ou um pino de viagem que já está lá
          </p>
          <ul className="lb-travel__options" aria-labelledby={PINOS_ID}>
            {pins.map((pin) => (
              <li key={pin.id} className="lb-travel__option">
                <button type="button" className="lb-btn lb-travel__choice" disabled={pin.note !== null} onClick={() => onPick(pin.id)}>
                  {pin.label}
                </button>
                {pin.note !== null && <span className="lb-travel__note">{pin.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="lb-travel__row lb-travel__row--end">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onBack}>
          Voltar
        </button>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </>
  )
}
