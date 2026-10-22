import { useEffect, useId, useRef } from 'react'
import { COR_DA_PORTA_PADRAO, CORES_DA_PORTA } from '../../lib/corDaPorta'
import { CampoCor } from '../grimorio/CampoCor'
import './fichaDoPino.css'

/*
 * COR DA PORTA (fatia 22), na ficha Aparência: o mesmo campo da cor do pino
 * (`CorETamanhoDoPino.tsx`) — a paleta do protótipo, "Outra cor…" (o seletor
 * nativo) e "Cor padrão", que grava AUSENTE: a porta volta ao laranja de
 * sempre, e o arquivo de um mapa antigo sai igual. O seletor nativo diz de que
 * abertura a cor veio (`abertura`): cada abertura vira um Ctrl+Z
 * (`lib/corDaPorta.ts:chaveDaCorDaPorta`), e a bolinha da paleta, um passo próprio.
 */

const OPCOES = CORES_DA_PORTA.map((valor) => ({ valor }))

export interface CorDaPortaProps {
  /** `#rrggbb`, ou `null` = o laranja de sempre. */
  cor: string | null
  /** `abertura`: a vez do seletor de "Outra cor…" de onde a cor veio (as cores da mesma abertura são um Ctrl+Z só). */
  onCorChange: (cor: string | null, abertura?: string) => void
}

export function CorDaPorta({ cor, onCorChange }: CorDaPortaProps) {
  const seletorRef = useRef<HTMLInputElement>(null)
  // O id do campo entra na chave: a ficha remontada (Aparência recolhida e
  // aberta) recomeça a conta, e não pode emendar no arrasto da ficha de antes.
  const campo = useId()
  const fechamentos = useRef(0)

  // O `onChange` do React é o `input` nativo, um por quadro do arrasto. O
  // `change` nativo chega UMA vez, quando a caixa fecha, depois deles
  // (`ColorInputType::DidEndChooser`, no Chromium): é o fim do arrasto, e a
  // próxima abertura ganha outra chave.
  useEffect(() => {
    const seletor = seletorRef.current
    if (seletor === null) return
    const aoFechar = (): void => {
      fechamentos.current += 1
    }
    seletor.addEventListener('change', aoFechar)
    return () => seletor.removeEventListener('change', aoFechar)
  }, [])

  // Cor fora da paleta (veio de "Outra cor…" ou do arquivo): a bolinha do
  // seletor mostra a cor e leva o aro de marcada, já que nenhuma da paleta está.
  const outra = cor !== null && !CORES_DA_PORTA.includes(cor.toLowerCase())
  return (
    <CampoCor
      rotulo="Cor da porta"
      opcoes={OPCOES}
      valor={cor ?? ''}
      onChange={(valor) => onCorChange(valor)}
      onPadrao={() => onCorChange(null)}
      extra={
        <input
          ref={seletorRef}
          type="color"
          className={outra ? 'gr-cor lb-pin-outra-cor lb-pin-outra-cor--marcada' : 'gr-cor lb-pin-outra-cor'}
          aria-label="Outra cor…"
          title="Outra cor…"
          value={cor ?? COR_DA_PORTA_PADRAO}
          onChange={(evento) => onCorChange(evento.currentTarget.value, `${campo}:${fechamentos.current}`)}
        />
      }
    />
  )
}
