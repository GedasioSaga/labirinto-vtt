import { COR_DA_PORTA_PADRAO, CORES_DA_PORTA } from '../../lib/corDaPorta'
import { CampoCor } from '../grimorio/CampoCor'
import './fichaDoPino.css'

/*
 * COR DA PORTA (fatia 22), na ficha Aparência: o mesmo campo da cor do pino
 * (`CorETamanhoDoPino.tsx`) — a paleta do protótipo, "Outra cor…" (o seletor
 * nativo) e "Cor padrão", que grava AUSENTE: a porta volta ao laranja de
 * sempre, e o arquivo de um mapa antigo sai igual. O seletor nativo avisa que
 * a cor veio do arrasto (`doSeletor`): o arrasto inteiro vira um Ctrl+Z
 * (`lib/corDaPorta.ts:chaveDaCorDaPorta`), e a bolinha da paleta, um passo próprio.
 */

const OPCOES = CORES_DA_PORTA.map((valor) => ({ valor }))

export interface CorDaPortaProps {
  /** `#rrggbb`, ou `null` = o laranja de sempre. */
  cor: string | null
  /** `doSeletor`: veio do arrasto de "Outra cor…" (um Ctrl+Z para o arrasto inteiro). */
  onCorChange: (cor: string | null, doSeletor?: boolean) => void
}

export function CorDaPorta({ cor, onCorChange }: CorDaPortaProps) {
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
          type="color"
          className={outra ? 'gr-cor lb-pin-outra-cor lb-pin-outra-cor--marcada' : 'gr-cor lb-pin-outra-cor'}
          aria-label="Outra cor…"
          title="Outra cor…"
          value={cor ?? COR_DA_PORTA_PADRAO}
          onChange={(evento) => onCorChange(evento.currentTarget.value, true)}
        />
      }
    />
  )
}
