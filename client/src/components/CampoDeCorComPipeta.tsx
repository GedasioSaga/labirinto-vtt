import { useEffect, useId, useRef } from 'react'
import { useContaGotasStore } from '../stores/contaGotasStore'
import { PipetaIcon } from './icons'

interface CampoDeCorComPipetaProps {
  id?: string
  /** Classe da amostra; o padrão é a `.lb-swatch` do painel. */
  className?: string
  value: string
  onChange: (cor: string) => void
  disabled?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
  title?: string
  /** Nome acessível da pipeta; com várias cores na mesma seção, diga qual. */
  rotuloDaPipeta?: string
  /** Pipeta menor, para linha de lista (camadas do chão). */
  compacto?: boolean
}

const ROTULO_PADRAO = 'Pegar cor do mapa'
const TAMANHO_DO_ICONE = 16
const TAMANHO_DO_ICONE_COMPACTO = 13

/**
 * Amostra de cor nativa com uma pipeta ao lado. O popup do `<input
 * type="color">` no WebView2 não tem conta-gotas (só o Chrome tem), então a
 * pipeta arma o conta-gotas do app: o próximo clique no MAPA lê a cor ali e a
 * entrega pelo MESMO `onChange` da amostra — a troca passa pelo histórico como
 * qualquer outra. Esc ou clicar de novo na pipeta cancela.
 */
export function CampoDeCorComPipeta({
  id,
  className = 'lb-swatch',
  value,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  title,
  rotuloDaPipeta = ROTULO_PADRAO,
  compacto = false,
}: CampoDeCorComPipetaProps) {
  const donoId = useId()
  const ativo = useContaGotasStore((state) => state.donoId === donoId)
  // A cor entregue vai para o `onChange` DESTE render, não o do clique na
  // pipeta: o painel pode ter re-renderizado no meio (outro valor, outro item).
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Esc cancela. Captura no window: roda antes do Esc do mapa (que larga a
  // seleção) e o barra ali — cancelar a pipeta não pode custar a seleção.
  useEffect(() => {
    if (!ativo) return
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      useContaGotasStore.getState().desligar()
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [ativo])

  // Campo desabilitado ou saindo da tela com a pipeta armada: o mapa não pode
  // ficar mirando para um campo que não existe mais.
  useEffect(() => {
    if (ativo && disabled) useContaGotasStore.getState().desligar()
  }, [ativo, disabled])
  useEffect(
    () => () => {
      if (useContaGotasStore.getState().donoId === donoId) useContaGotasStore.getState().desligar()
    },
    [donoId],
  )

  const alternar = () => {
    const contaGotas = useContaGotasStore.getState()
    if (contaGotas.donoId === donoId) contaGotas.desligar()
    else contaGotas.ligar(donoId, (cor) => onChangeRef.current(cor))
  }

  const dica = ativo ? 'Clique no mapa para pegar a cor (Esc cancela)' : rotuloDaPipeta
  return (
    <span className="lb-campo-cor">
      <button
        type="button"
        className={compacto ? 'lb-iconbtn lb-campo-cor__pipeta lb-campo-cor__pipeta--compacta' : 'lb-iconbtn lb-campo-cor__pipeta'}
        aria-label={rotuloDaPipeta}
        aria-pressed={ativo}
        title={dica}
        disabled={disabled}
        onClick={alternar}
      >
        <PipetaIcon size={compacto ? TAMANHO_DO_ICONE_COMPACTO : TAMANHO_DO_ICONE} />
      </button>
      <input
        id={id}
        className={className}
        type="color"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        title={title}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  )
}
