import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Três toques longos: dá para distinguir do zumbido de uma notificação comum. */
export const ALARM_VIBRATION: number[] = [300, 120, 300, 120, 600]

/** Variável CSS (em `:root`) com a altura da faixa; `player.css` desce o que fica no alto. */
export const ALARM_SPACE_VAR = '--pp-alarm-space'

/** O que a vibração precisa do navegador. `vibrate` ausente = o navegador não vibra (iPhone, computador). */
export interface VibrationTarget {
  vibrate?: (pattern: number[]) => boolean
}

/**
 * Vibra o celular quando o navegador deixa. Sem a API, com o navegador
 * recusando (sem toque do usuário na página ainda) ou lançando erro: `false`,
 * e o alarme segue só na tela.
 */
export function vibrarAlarme(target: VibrationTarget | undefined): boolean {
  if (target === undefined || typeof target.vibrate !== 'function') return false
  try {
    return target.vibrate(ALARM_VIBRATION)
  } catch {
    return false
  }
}

export interface PlayerAlarmBannerProps {
  /** O alarme como o mestre escreveu. Vai para a tela como TEXTO: HTML aparece literal. */
  text: string
  /** De onde vem a vibração; o `navigator` da página. Injetável para o teste. */
  vibrationTarget: VibrationTarget | undefined
}

/**
 * O ALARME DO MESTRE na tela do jogador: faixa no alto, com a cor de alerta,
 * que fica até o mestre encerrar — não tem "Fechar". `role="alert"` para o
 * leitor de tela anunciar na hora. Não rouba o foco e não cobre o mapa além
 * da faixa: o jogador pode estar arrastando a ficha para fugir.
 *
 * Vibra uma vez ao aparecer. Alarme novo remonta a faixa (`key` no id, em
 * `main.tsx`) e vibra de novo; o mesmo alarme a cada snapshot, não.
 */
export function PlayerAlarmBanner({ text, vibrationTarget }: PlayerAlarmBannerProps) {
  // Guardado na montagem: o efeito roda uma vez por alarme (cada alarme novo é
  // uma montagem nova, `key`), e não a cada render com outro objeto de alvo.
  const [target] = useState(vibrationTarget)
  useEffect(() => {
    vibrarAlarme(target)
  }, [target])

  const ref = useRef<HTMLDivElement | null>(null)
  // A altura da faixa vai para `--pp-alarm-space`, e o que fica no alto
  // (painel, "Sua vez", recado, cartão do pino) desce junto: a faixa não tapa
  // nada. Texto de duas linhas no celular muda a altura — o observador acompanha.
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const root = document.documentElement
    const apply = () => root.style.setProperty(ALARM_SPACE_VAR, `${el.offsetHeight}px`)
    apply()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(ALARM_SPACE_VAR)
    }
  }, [])

  return (
    <div ref={ref} className="pp-alarm" role="alert">
      <span className="pp-alarm__title">Alarme</span>
      <p className="pp-alarm__text">{text}</p>
    </div>
  )
}
