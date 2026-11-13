import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  formatarTamanho,
  lerTamanhoDigitado,
  limitarTamanho,
  passoDoTamanho,
  TOKEN_SIZE_MAX_SQUARES,
  TOKEN_SIZE_MIN_SQUARES,
  TOKEN_SIZE_STEP,
  type TamanhoLimitado,
} from '../lib/tokenSize'
import './CampoDoTamanho.css'

export interface CampoDoTamanhoProps {
  /** O lado de agora, em casas; `null` = sem número (o "Não mudar" da cena): o campo fica vazio. */
  casas: number | null
  /** Recebe o lado novo, já arredondado e dentro da faixa; só quando ele muda. */
  onTrocar: (casas: number) => void
  /** Nome acessível do campo: "Tamanho da ficha em casas". */
  rotulo: string
  /** O que o − e o + mudam, para o nome deles: "o tamanho da ficha" -> "Diminuir o tamanho da ficha". */
  nomeDoPasso: string
  /** Id do texto que explica o campo (a dica da cena). */
  dicaId?: string
}

/** De onde o − e o + partem com o campo vazio: o lado com que toda ficha nasce. */
const PARTIDA_DO_CAMPO_VAZIO = 1

/** O que o campo diz quando o texto não é número. */
const AVISO_NAO_E_NUMERO = 'Escreva um número de casas, como 1,5.'

/**
 * O CAMPO DO TAMANHO DA FICHA (pedido do mestre de 12/11/2026: "eu quero
 * dizer o quanto tem que mudar"): `[−] [ 1,5 casa ] [+]`. O mesmo no painel
 * da ficha (`TokenSizeControls`) e no "Tamanho da ficha ao entrar" da cena
 * (`SceneTokenSizeControls`), para os dois falarem igual.
 *
 * - Vírgula ou ponto valem; o campo mostra com vírgula (`formatarTamanho`).
 * - De 0,25 a 6 casas: fora disso vira o limite mais perto, com um aviso
 *   curto embaixo (`limitarTamanho`). Texto que não é número não grava.
 * - Como a rotação da sala (`RoomRotationField`), o campo NÃO grava a cada
 *   tecla — digitar "1,5" passaria por 1 e deixaria dois Ctrl+Z. Enter (ou
 *   sair do campo) confirma; Esc volta ao número de antes; seta para cima e
 *   para baixo, e o − e o +, andam 0,1 casa na hora.
 * - Campo apagado e confirmado: nada muda, volta o número de antes (o "Não
 *   mudar" da cena é o botão dele, não o campo vazio).
 */
export function CampoDoTamanho({ casas, onTrocar, rotulo, nomeDoPasso, dicaId }: CampoDoTamanhoProps) {
  const id = useId()
  const avisoId = `${id}-aviso`
  // `null` = ninguém digitando: o campo mostra o lado de agora (o arrasto da alça, o Ctrl+Z).
  const [rascunho, setRascunhoNoEstado] = useState<string | null>(null)
  // O mesmo rascunho num ref, para a limpeza da desmontagem (abaixo) ler o que estava digitado.
  const rascunhoRef = useRef<string | null>(null)
  const setRascunho = (texto: string | null) => {
    rascunhoRef.current = texto
    setRascunhoNoEstado(texto)
  }
  const [aviso, setAviso] = useState<string | null>(null)
  const [invalido, setInvalido] = useState(false)

  const onTrocarRef = useRef(onTrocar)
  const casasRef = useRef(casas)
  useEffect(() => {
    onTrocarRef.current = onTrocar
    casasRef.current = casas
  })
  // Número digitado e não confirmado, e o campo SOME (outra ficha escolhida no mapa): o clique no mapa
  // troca a ficha ANTES de o campo perder o foco, e o `blur` gravaria na ficha errada. Quem usa o campo o
  // remonta a cada ficha (`key`), e é aqui, com o callback do último render DESTE campo, que "sair confirma" vale.
  useEffect(
    () => () => {
      const digitado = rascunhoRef.current === null ? null : lerTamanhoDigitado(rascunhoRef.current)
      if (digitado === null) return
      const novo = limitarTamanho(digitado).casas
      if (novo !== casasRef.current) onTrocarRef.current(novo)
    },
    [],
  )

  const atual = casas ?? PARTIDA_DO_CAMPO_VAZIO
  const noMinimo = atual <= TOKEN_SIZE_MIN_SQUARES
  const noMaximo = atual >= TOKEN_SIZE_MAX_SQUARES

  /** Grava `resultado` quando ele muda o lado, e mostra o aviso dele (ou apaga o de antes). */
  const gravar = (resultado: TamanhoLimitado) => {
    setRascunho(null)
    setInvalido(false)
    setAviso(resultado.aviso)
    if (resultado.casas !== casas) onTrocar(resultado.casas)
  }

  /** Enter e sair do campo. `false` = o texto não é número: fica marcado, com o aviso. */
  const confirmar = (): boolean => {
    if (rascunho === null) return true
    if (rascunho.trim() === '') {
      setRascunho(null)
      setInvalido(false)
      return true
    }
    const digitado = lerTamanhoDigitado(rascunho)
    if (digitado === null) {
      setInvalido(true)
      setAviso(AVISO_NAO_E_NUMERO)
      return false
    }
    gravar(limitarTamanho(digitado))
    return true
  }

  /** − e +, setas: 0,1 casa a partir do que está escrito (o digitado, se for número; senão o lado de agora). */
  const andar = (sentido: 1 | -1) => {
    const digitado = rascunho === null ? null : lerTamanhoDigitado(rascunho)
    gravar(passoDoTamanho(digitado ?? atual, sentido))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirmar()
    } else if (event.key === 'Escape' && rascunho !== null) {
      // Só engole o Esc quando há digitação a desfazer: sem ela, o Esc segue
      // viagem e fecha a janela ou larga a seleção, como em todo campo do painel.
      event.preventDefault()
      event.stopPropagation()
      setRascunho(null)
      setInvalido(false)
      setAviso(null)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      andar(event.key === 'ArrowUp' ? 1 : -1)
    }
  }

  const mostrado = rascunho ?? (casas === null ? '' : formatarTamanho(casas))
  // A unidade acompanha o número escrito ("1,5 casa", "2 casas"); campo vazio fica sem unidade.
  const numeroEscrito = mostrado.trim() === '' ? null : (lerTamanhoDigitado(mostrado) ?? casas)
  const unidade = numeroEscrito === null ? null : Math.abs(numeroEscrito) < 2 ? 'casa' : 'casas'
  const descritoPor = [dicaId, aviso === null ? undefined : avisoId].filter((parte) => parte !== undefined).join(' ')
  const passo = formatarTamanho(TOKEN_SIZE_STEP)

  return (
    <div className="lb-tamanho">
      <div className="lb-tamanho__linha">
        <button
          type="button"
          className="lb-tamanho__passo"
          aria-label={`Diminuir ${nomeDoPasso}`}
          title={`Menos ${passo} casa`}
          aria-disabled={noMinimo || undefined}
          onClick={noMinimo ? undefined : () => andar(-1)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <div className="lb-tamanho__caixa">
          <input
            id={id}
            className="lb-input lb-tamanho__campo"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={false}
            placeholder="—"
            aria-label={rotulo}
            aria-describedby={descritoPor === '' ? undefined : descritoPor}
            aria-invalid={invalido || undefined}
            value={mostrado}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setRascunho(event.target.value)
              setInvalido(false)
              setAviso(null)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Texto que não é número volta ao lado de antes; o aviso fica, para dizer por quê.
              if (!confirmar()) {
                setRascunho(null)
                setInvalido(false)
              }
            }}
          />
          {unidade !== null && (
            <span className="lb-tamanho__unidade" aria-hidden="true">
              {unidade}
            </span>
          )}
        </div>
        <button
          type="button"
          className="lb-tamanho__passo"
          aria-label={`Aumentar ${nomeDoPasso}`}
          title={`Mais ${passo} casa`}
          aria-disabled={noMaximo || undefined}
          onClick={noMaximo ? undefined : () => andar(1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {/* Sempre no DOM: a região `status` só é anunciada quando já existia antes do texto chegar. */}
      <p id={avisoId} className="lb-tamanho__aviso" role="status">
        {aviso}
      </p>
    </div>
  )
}
