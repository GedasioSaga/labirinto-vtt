import { PIN_COR_PADRAO, PIN_CORES, PIN_ESCALA_MAX, PIN_ESCALA_MIN, PIN_ESCALA_PASSO } from '../../lib/pins'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoCor } from '../grimorio/CampoCor'
import { CampoFaixa } from '../grimorio/CampoFaixa'

/*
 * COR E TAMANHO DO PINO (fatia 14 do design consolidado): na ficha Aparência,
 * a paleta do protótipo (a mesma do campo Cor do token) com "Outra cor…" (o
 * seletor nativo) e "Cor padrão", e o deslizante "Tamanho", de metade a 3x,
 * com "Padrão". Os dois "padrão" gravam AUSENTE: o pino volta ao latão e ao
 * tamanho de sempre, e o arquivo de um mapa antigo sai igual.
 */

const OPCOES = PIN_CORES.map((valor) => ({ valor }))

/** "1x", "1,5x", "0,75x": vírgula de casa decimal, como o mestre lê. */
export function formatarEscalaDoPino(escala: number): string {
  return `${escala.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`
}

export interface CorDoPinoProps {
  /** `#rrggbb`, ou `null` = o latão de sempre. */
  cor: string | null
  onCorChange: (cor: string | null) => void
}

export function CorDoPino({ cor, onCorChange }: CorDoPinoProps) {
  // Cor fora da paleta (veio de "Outra cor…" ou do arquivo): a bolinha do
  // seletor mostra a cor e leva o aro de marcada, já que nenhuma da paleta está.
  const outra = cor !== null && !PIN_CORES.includes(cor.toLowerCase())
  return (
    <CampoCor
      rotulo="Cor do pino"
      opcoes={OPCOES}
      valor={cor ?? ''}
      onChange={onCorChange}
      onPadrao={() => onCorChange(null)}
      extra={
        <input
          type="color"
          className={outra ? 'gr-cor lb-pin-outra-cor lb-pin-outra-cor--marcada' : 'gr-cor lb-pin-outra-cor'}
          aria-label="Outra cor…"
          title="Outra cor…"
          value={cor ?? PIN_COR_PADRAO}
          onChange={(evento) => onCorChange(evento.currentTarget.value)}
        />
      }
    />
  )
}

export interface TamanhoDoPinoProps {
  /** 0,5 a 3; 1 = o de sempre. */
  escala: number
  onEscalaChange: (escala: number | null) => void
}

export function TamanhoDoPino({ escala, onEscalaChange }: TamanhoDoPinoProps) {
  return (
    <>
      <CampoFaixa
        rotulo="Tamanho"
        valor={escala}
        min={PIN_ESCALA_MIN}
        max={PIN_ESCALA_MAX}
        passo={PIN_ESCALA_PASSO}
        formatar={formatarEscalaDoPino}
        onChange={onEscalaChange}
      />
      <Acoes>
        {/* Nome próprio: "Padrão" sozinho se confunde com o "Cor padrão" logo acima. */}
        <Botao variante="fantasma" tamanho="p" aria-label="Tamanho padrão" onClick={() => onEscalaChange(null)}>
          Padrão
        </Botao>
      </Acoes>
    </>
  )
}
