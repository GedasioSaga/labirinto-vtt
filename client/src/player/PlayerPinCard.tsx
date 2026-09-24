import { useEffect, useRef, useState } from 'react'
import type { Pin, PinExitLabel } from '../types/map'
import { PIN_BLOCK_REASON_LABELS, PIN_GLYPH, blockReasonOf, isPlayerSafePinImage, passageOf } from '../lib/pins'
import { PinTravelArt } from '../components/PinSymbolArt'

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
  /** Passagem trancada: o jogador já pediu "Me avise quando der" por este pino. */
  watching?: boolean
  /**
   * Liga (`true`) ou desliga o aviso de quando a passagem trancada abrir.
   * Ausente = o cartão trancado só lê, sem botão.
   */
  onWatch?: (on: boolean) => void
}

/** O que o cartão diz da passagem fechada, depois do motivo (ou do "Está trancada"). */
const FECHADA_SEM_PASSAR = 'Não dá para passar por aqui agora.'

/** Etiqueta da passagem cujo par é a chegada oculta (mão única). */
const ETIQUETA_SO_IDA = 'Só ida'
/** O que a pergunta de confirmação acrescenta numa passagem só de ida. */
const AVISO_SO_IDA = 'Não dá para voltar por este caminho.'

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
export function PlayerPinCard({ pin, onClose, onRequestTravel, travelWaiting = false, watching = false, onWatch }: PlayerPinCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const askRef = useRef<HTMLButtonElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  /**
   * Pergunta "Pedir ao mestre…?" na tela, no lugar do botão de pedir. Numa
   * encruzilhada guarda a saída escolhida; `saida: null` = o pino de uma saída.
   */
  const [confirming, setConfirming] = useState<{ saida: PinExitLabel | null } | null>(null)
  /** A última saída escolhida: cancelar a pergunta devolve o foco ao botão DELA. */
  const [ultimaSaida, setUltimaSaida] = useState<string | null>(null)
  /** Para onde o foco volta depois de abrir ou fechar a pergunta; `null` = não mexe. */
  const [focusTarget, setFocusTarget] = useState<'confirm' | 'cancel' | 'ask' | null>(null)

  useEffect(() => {
    // Quem chegou pelo teclado segue com o foco: abrir a pergunta o leva ao
    // "Pedir"; cancelar o devolve ao botão que a abriu. Passagem SÓ DE IDA não
    // tem desfazer, então a pergunta começa no botão seguro, o "Cancelar":
    // um Enter a mais não derruba o jogador num lugar de onde não volta.
    if (focusTarget === 'confirm') confirmRef.current?.focus()
    if (focusTarget === 'cancel') cancelRef.current?.focus()
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
  const trancada = viagem && passagem === 'trancada'
  // O PORQUÊ da passagem fechada ("Desabou"). Valor desconhecido (host de
  // versão futura) cai no "Está trancada" de sempre, sem mostrar o cru.
  const motivo = blockReasonOf(pin)
  const podePedir = viagem && !trancada && onRequestTravel !== undefined
  const textos = passagem === 'livre' ? TEXTOS_LIVRE : TEXTOS_PEDE
  // ENCRUZILHADA: com mais de uma saída, um botão por saída, pelo rótulo que o
  // mestre escreveu — o destino e o nome da cena nunca chegam aqui. Com uma
  // saída só (ou sem o campo), o cartão é o de sempre.
  const escolhas = viagem ? (pin.escolhas ?? []) : []
  const encruzilhada = escolhas.length > 1
  // SÓ IDA: o par é a chegada oculta. No pino de uma saída vem em `semVolta`;
  // numa encruzilhada, por saída (`soIda`). O destino continua sem aparecer.
  const semVolta = viagem && !encruzilhada && pin.semVolta === true
  const saidaSoIda = (saida: PinExitLabel | null): boolean => (saida === null ? semVolta : saida.soIda === true)
  const perguntar = (saida: PinExitLabel | null) => {
    setConfirming({ saida })
    if (saida !== null) setUltimaSaida(saida.id)
    setFocusTarget(saidaSoIda(saida) ? 'cancel' : 'confirm')
  }
  const perguntaBase =
    confirming === null || confirming.saida === null
      ? textos.pergunta
      : passagem === 'livre'
        ? `Passar por ${confirming.saida.rotulo}?`
        : `Pedir ao mestre para passar por ${confirming.saida.rotulo}?`
  const pergunta = confirming !== null && saidaSoIda(confirming.saida) ? `${perguntaBase} ${AVISO_SO_IDA}` : perguntaBase

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
        {semVolta && <span className="pp-pincard__oneway pp-pincard__oneway--card">{ETIQUETA_SO_IDA}</span>}
        {trancada && (
          <p className="pp-pincard__locked">
            {motivo === null ? (
              `Está trancada. ${FECHADA_SEM_PASSAR}`
            ) : (
              <>
                <strong className="pp-pincard__reason">{PIN_BLOCK_REASON_LABELS[motivo]}.</strong> {FECHADA_SEM_PASSAR}
              </>
            )}
          </p>
        )}
        {trancada && onWatch !== undefined && (
          // Botão de alternar: o rótulo fica o mesmo e o estado mora no
          // `aria-pressed` (e na frase logo abaixo, para quem enxerga).
          <>
            <button
              type="button"
              className="pp-pincard__watch"
              aria-pressed={watching}
              onClick={() => onWatch(!watching)}
            >
              Me avise quando der
            </button>
            {watching && <p className="pp-pincard__watch-hint">Você recebe um aviso quando abrir.</p>}
          </>
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
                    {saida.soIda === true && (
                      <>
                        {' '}
                        <span className="pp-pincard__oneway">{ETIQUETA_SO_IDA}</span>
                      </>
                    )}
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
                ref={cancelRef}
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
