import { useEffect, useRef, useState } from 'react'
import type { Pin, PinExitLabel } from '../types/map'
import { PIN_GLYPH, isPlayerSafePinImage, passageOf } from '../lib/pins'
import { PinTravelArt } from '../components/PinSymbolArt'
import type { LockAnswerPhase } from './playerConnection'
import { PlayerLockPad } from './PlayerLockPad'

interface PlayerPinCardProps {
  pin: Pin
  onClose: () => void
  /**
   * Pino de viagem: manda o pedido de passagem ao mestre (já confirmado aqui).
   * Ausente = o cartão não oferece passar, só lê. `exitId` é a saída escolhida
   * numa encruzilhada; no pino de uma saída ele não vem.
   */
  onRequestTravel?: (exitId?: string) => void
  /** Já há um pedido esperando o mestre: não dá para pedir de novo. */
  travelWaiting?: boolean
  /**
   * FECHADURA COM SEGREDO: manda a tentativa ao host. Ausente = o cartão não
   * oferece tentar (a fechadura aparece, mas sem "Tentar").
   */
  onTryLock?: (tentativa: string) => void
  /** A resposta do host à última tentativa NESTE pino; ausente = nenhuma. */
  lockPhase?: LockAnswerPhase
}

/** O que o cartão diz de cada resposta do host. */
const TEXTO_DA_FECHADURA: Record<Exclude<LockAnswerPhase, 'sending'>, string> = {
  wrong: 'Não abre.',
  too_soon: 'Espere um instante antes de tentar de novo.',
  open: 'Abriu.',
}

/**
 * Cenário sem foto. Fica como `<img>` de verdade, e não como um `<div>` vazio,
 * porque a área de imagem é parte do que o cartão promete: o jogador precisa
 * ver que ali CABE uma imagem e que o mestre não pôs nenhuma — um buraco sem
 * explicação leria como falha de carregamento.
 */
const IMAGEM_AUSENTE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">' +
      '<rect width="320" height="180" fill="%23191a20"/>' +
      '<path d="M96 122l38-44 26 30 18-20 46 34z" fill="none" stroke="%235d6070" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="118" cy="66" r="9" fill="none" stroke="%235d6070" stroke-width="3"/>' +
      '</svg>',
  )

/** O que o cartão diz em cada passo da passagem, por modo do pino. */
interface TextosDaPassagem {
  botao: string
  esperando: string
  pergunta: string
  confirmar: string
}

const TEXTOS_PEDE: TextosDaPassagem = {
  botao: 'Pedir para passar',
  esperando: 'Pedido enviado ao mestre',
  pergunta: 'Pedir ao mestre para passar por aqui?',
  confirmar: 'Pedir',
}

/** Livre: ninguém é interrompido, então o cartão não fala em mestre. */
const TEXTOS_LIVRE: TextosDaPassagem = {
  botao: 'Passar',
  esperando: 'Passando…',
  pergunta: 'Passar por aqui?',
  confirmar: 'Passar',
}

/**
 * O cartão do ponto de interesse, do jeito que o usuário descreveu: "abrir a
 * imagem de um cenário ou um item e embaixo a descrição".
 *
 * Imagem EM CIMA, texto EMBAIXO — nesta ordem no DOM, sem `order` de flex ou
 * posicionamento que desmanche a ordem de leitura: quem enxerga e quem ouve
 * recebem a mesma sequência.
 *
 * Fecha por Escape, pelo botão e por tocar fora. O "fora" é ouvido na janela,
 * na fase de captura, e não por um fundo que cobre a tela: o véu continua
 * pintado, mas não tapa o mapa — o jogador que lê "Está trancada" continua
 * vendo onde está. O toque de fechar que cai no mapa para ali, antes do canvas:
 * fechar o cartão não arrasta o mapa nem abre outro pino.
 */
export function PlayerPinCard({ pin, onClose, onRequestTravel, travelWaiting = false, onTryLock, lockPhase }: PlayerPinCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const askRef = useRef<HTMLButtonElement | null>(null)
  /**
   * Pergunta "Pedir ao mestre…?" na tela, no lugar do botão de pedir. Numa
   * encruzilhada guarda a saída escolhida; `saida: null` = o pino de uma saída.
   */
  const [confirming, setConfirming] = useState<{ saida: PinExitLabel | null } | null>(null)
  /** A última saída escolhida: cancelar a pergunta devolve o foco ao botão DELA. */
  const [ultimaSaida, setUltimaSaida] = useState<string | null>(null)
  /** Para onde o foco volta depois de abrir ou fechar a pergunta; `null` = não mexe. */
  const [focusTarget, setFocusTarget] = useState<'confirm' | 'ask' | null>(null)

  useEffect(() => {
    // Quem chegou pelo teclado segue com o foco: abrir a pergunta o leva ao
    // "Pedir"; cancelar o devolve ao botão que a abriu.
    if (focusTarget === 'confirm') confirmRef.current?.focus()
    if (focusTarget === 'ask') askRef.current?.focus()
  }, [focusTarget, confirming])

  useEffect(() => {
    // Foco no botão de fechar: quem chegou aqui pelo teclado tem para onde ir,
    // e Escape funciona mesmo sem o foco estar dentro do cartão.
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && cardRef.current?.contains(alvo)) return
      onClose()
      // No mapa, o toque só fecha. Nos painéis ao lado, ele segue para o
      // controle tocado: quem aperta "Centralizar" com o cartão aberto quer
      // as duas coisas.
      if (alvo instanceof HTMLCanvasElement) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  const descricao = pin.description.trim()
  // Só data URL vira foto: se um caminho de disco escapasse até aqui, o
  // `<img>` tentaria abrir o computador do mestre pelo navegador do jogador.
  const foto = isPlayerSafePinImage(pin.image) ? pin.image : null
  // Pino de viagem: o cartão é o de sempre (imagem e descrição do mestre), com
  // a passagem no lugar do glifo — a mesma cabeça que o jogador vê no mapa.
  // O nome da cena de destino nunca chega aqui (`lib/fogFilter.ts`).
  const viagem = pin.kind === 'viagem'
  // O modo vem no recorte (o destino, não). Trancada não oferece botão nenhum:
  // um "Pedir" que o host sempre recusa só ensinaria o jogador a insistir.
  const passagem = passageOf(pin)
  // FECHADURA COM SEGREDO: vem no recorte só enquanto está fechada (forma e,
  // nos volantes, casas; a resposta mora no host). Fechada, a passagem também não abre: o
  // cartão oferece a combinação no lugar do "Pedir para passar".
  const fechadura = pin.fechadura
  const trancadaComSegredo = viagem && fechadura !== undefined
  const trancada = viagem && passagem === 'trancada' && !trancadaComSegredo
  const podePedir = viagem && !trancada && !trancadaComSegredo && onRequestTravel !== undefined
  const textos = passagem === 'livre' ? TEXTOS_LIVRE : TEXTOS_PEDE
  // ENCRUZILHADA: com mais de uma saída, um botão por saída, pelo rótulo que o
  // mestre escreveu — o destino e o nome da cena nunca chegam aqui. Com uma
  // saída só (ou sem o campo), o cartão é o de sempre.
  const escolhas = viagem ? (pin.escolhas ?? []) : []
  const encruzilhada = escolhas.length > 1
  const perguntar = (saida: PinExitLabel | null) => {
    setConfirming({ saida })
    if (saida !== null) setUltimaSaida(saida.id)
    setFocusTarget('confirm')
  }
  const pergunta =
    confirming === null || confirming.saida === null
      ? textos.pergunta
      : passagem === 'livre'
        ? `Passar por ${confirming.saida.rotulo}?`
        : `Pedir ao mestre para passar por ${confirming.saida.rotulo}?`

  return (
    <div className="pp-pincard__backdrop">
      <div
        ref={cardRef}
        className="pp-pincard"
        role="dialog"
        aria-modal="true"
        aria-label={viagem ? 'Passagem' : `Ponto de interesse ${PIN_GLYPH[pin.kind]}`}
      >
        <img
          className="pp-pincard__image"
          src={foto === null ? IMAGEM_AUSENTE : foto}
          alt={foto === null ? 'Este ponto de interesse ainda não tem imagem' : 'Imagem deixada pelo mestre neste ponto de interesse'}
        />
        <div className="pp-pincard__body">
          <span className={viagem ? 'pp-pincard__glyph pp-pincard__glyph--viagem' : 'pp-pincard__glyph'} aria-hidden="true">
            {viagem ? <PinTravelArt size={16} /> : PIN_GLYPH[pin.kind]}
          </span>
          <p className="pp-pincard__text">
            {descricao === '' ? 'O mestre ainda não escreveu nada sobre este ponto.' : descricao}
          </p>
        </div>
        {trancada && <p className="pp-pincard__locked">Está trancada. Não dá para passar por aqui agora.</p>}
        {trancadaComSegredo && <p className="pp-pincard__locked">Trancada com segredo. Acerte a combinação para passar.</p>}
        {fechadura !== undefined && (
          // A chave é o pino, a forma e (nos volantes) as casas: outro cadeado começa zerado.
          <PlayerLockPad key={`${pin.id}|${fechadura.forma}|${fechadura.forma === 'volantes' ? fechadura.casas : ''}`} pinId={pin.id} lock={fechadura} sending={lockPhase === 'sending'} onTry={onTryLock} />
        )}
        {lockPhase !== undefined && lockPhase !== 'sending' && (
          // Fora da fechadura: o "Abriu." fica depois que o snapshot novo tira a fechadura do pino.
          <p className={lockPhase === 'open' ? 'pp-lock__status pp-lock__status--open' : 'pp-lock__status'} role="status">
            {TEXTO_DA_FECHADURA[lockPhase]}
          </p>
        )}
        {podePedir && confirming === null && !encruzilhada && (
          <button
            ref={askRef}
            type="button"
            className="pp-pincard__travel"
            disabled={travelWaiting}
            onClick={() => perguntar(null)}
          >
            {travelWaiting ? textos.esperando : textos.botao}
          </button>
        )}
        {podePedir && confirming === null && encruzilhada && (
          // Uma saída por botão, na ordem do mestre. Esperando o mestre, todas
          // ficam desligadas: um pedido por vez, como no cartão simples.
          <>
            {/* A mesma moldura de estado do "Está trancada": diz o que aconteceu, sem convidar toque. */}
            {travelWaiting && <p className="pp-pincard__locked">{textos.esperando}</p>}
            <ul className="pp-pincard__exits" aria-label="Saídas">
              {escolhas.map((saida, index) => (
                <li key={saida.id}>
                  <button
                    ref={saida.id === ultimaSaida || (ultimaSaida === null && index === 0) ? askRef : undefined}
                    type="button"
                    className="pp-pincard__travel"
                    disabled={travelWaiting}
                    onClick={() => perguntar(saida)}
                  >
                    {saida.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {podePedir && confirming !== null && (
          // Confirmação antes de mandar: no modo "pede" o pedido interrompe o
          // mestre, e no livre o jogador troca de cena — nos dois, um toque
          // sem querer não pode virar a ação.
          <div className="pp-pincard__confirm" role="group" aria-labelledby={`pp-travel-ask-${pin.id}`}>
            <p id={`pp-travel-ask-${pin.id}`} className="pp-pincard__question">
              {pergunta}
            </p>
            <div className="pp-pincard__choices">
              <button
                ref={confirmRef}
                type="button"
                className="pp-pincard__travel"
                onClick={() => {
                  const saida = confirming.saida
                  setConfirming(null)
                  if (saida === null) onRequestTravel()
                  else onRequestTravel(saida.id)
                }}
              >
                {textos.confirmar}
              </button>
              <button
                type="button"
                className="pp-pincard__close pp-pincard__close--inline"
                onClick={() => {
                  setConfirming(null)
                  setFocusTarget('ask')
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        <button ref={closeRef} type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
