import { useCallback, useId, useState, type ReactNode } from 'react'
import type { CondicaoPropria, TokenCondition } from '../types/map'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER, TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import { CondicoesProprias } from './CondicoesProprias'
import { PastilhaDeCondicao } from './PastilhaDeCondicao'
import './TokenControls.css'

const SEM_PROPRIAS: readonly CondicaoPropria[] = []

export interface TokenConditionControlsProps {
  /** Condições marcadas na ficha selecionada, já limpas (`tokenConditionsOf`). */
  conditions: readonly TokenCondition[]
  /** Um clique: marca a condição se ela não está na ficha, desmarca se está. */
  onToggleCondition: (condition: TokenCondition) => void
  /**
   * A ficha selecionada. Com ela o bloco mostra também as condições CRIADAS
   * pelo mestre e o "Criar condição" (`CondicoesProprias`); sem ela, só as de fábrica.
   */
  tokenId?: string
  /** As condições criadas que estão na ficha, já limpas (`condicoesPropriasOf`). */
  proprias?: readonly CondicaoPropria[]
  /** Dentro da ficha "Condições" (fatia 9): as pastilhas sempre à vista, sem a linha "+". */
  embutido?: boolean
}

/** O mestre precisa saber que a marca NÃO é anotação só dele — diferente de "Oculto para jogadores", ela sai para quem vê a ficha. */
export const CONDICOES_HINT = 'Aparece em cima da ficha, também na tela dos jogadores que a veem.'

/** A nota fixa sob os chips da ficha "Condições" (fatia 9), com o texto do protótipo. */
export const CONDICOES_NOTA = 'Aparecem sobre a ficha, também para os jogadores.'

/** Chave da escolha lembrada: a mesma família `lb-section:<id>` de `CollapsibleSection`. */
const PREFIXO_LEMBRADO = 'lb-section:'

/** localStorage pode não existir ou lançar (janela privada, dado bloqueado): sem escolha gravada, a linha nasce fechada. */
function lerAberta(id: string): boolean {
  try {
    return window.localStorage.getItem(PREFIXO_LEMBRADO + id) === '1'
  } catch {
    return false
  }
}

function gravarAberta(id: string, aberta: boolean): void {
  try {
    window.localStorage.setItem(PREFIXO_LEMBRADO + id, aberta ? '1' : '0')
  } catch {
    // Sem armazenamento a escolha vale enquanto o painel estiver montado.
  }
}

/**
 * Aberta ou fechada, lembrada entre fichas e entre sessões — como as seções
 * recolhíveis do painel (`CollapsibleSection`). O mestre em luta abre as
 * condições uma vez e elas ficam à vista em toda ficha; na preparação, fecha.
 */
export function useSecaoLembrada(id: string): [boolean, (aberta: boolean) => void] {
  const [aberta, setAberta] = useState(() => lerAberta(id))
  const lembrar = useCallback(
    (nova: boolean) => {
      setAberta(nova)
      gravarAberta(id, nova)
    },
    [id],
  )
  return [aberta, lembrar]
}

/** O "+" das linhas de opcional; a barra de pé some quando a linha abre e ele vira "−" (o CSS anima só o sinal). */
function SinalDeAbrir() {
  return (
    <span className="lb-token-opt__sinal" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" focusable="false">
        <path d="M5 12h14" />
        <path className="lb-token-opt__barra" d="M12 5v14" />
      </svg>
    </span>
  )
}

export interface OpcionalDaFichaProps {
  /** O nome da linha, que é também o nome do bloco aberto. */
  rotulo: string
  /** A ficha já tem o que este bloco mostra (uma condição marcada, uma rota): o corpo fica à vista e a linha vira cabeçalho parado. */
  preenchido: boolean
  /** A escolha lembrada do mestre (`useSecaoLembrada`). */
  aberta: boolean
  onAbertaChange: (aberta: boolean) => void
  /** Texto à direita do cabeçalho preenchido, no lugar do sinal ("3 pontos · no ponto 2"). */
  resumo?: string
  /** A frase que explica a linha: a dica sob demanda (P3) a mostra num balão ao pairar ou focar a linha. */
  dicaId?: string
  /** Já mora numa ficha com o mesmo título (fatia 9): sem a linha, o corpo sempre à vista. */
  embutido?: boolean
  children: ReactNode
}

/**
 * Opcional da Ficha no molde do Figma UI3 ("Click Add stroke in the Stroke
 * section"): vazio, é UMA linha com "+"; o "+" abre o bloco, e a linha aberta
 * mostra "−" para fechar. É o par de `OpcionalDaSala` (RoomControls): a mesma
 * linha, o mesmo alvo, a mesma cor apagada do opcional vazio.
 *
 * Diferença de propósito: na Sala o "+" acrescenta um DADO (um texto, uma
 * nota); aqui ele mostra CONTROLES de mesa (condições, patrulha). Por isso a
 * escolha é lembrada, como as seções recolhíveis do painel, e não vale só
 * para a ficha da vez.
 *
 * Preenchido (condição marcada, rota traçada), o corpo fica à vista sempre e
 * a linha vira cabeçalho parado: o que está na ficha não se esconde atrás de
 * um clique. Fechado, o corpo continua no DOM sob `hidden` (o molde de
 * `CollapsibleSection`): fora da vista e da ordem de Tab, com o
 * `aria-controls` da linha apontando para ele.
 *
 * Abrir e fechar é gesto frequente: o corpo aparece de uma vez, sem animar a
 * altura; só o sinal troca, em 110 ms (TokenControls.css).
 */
export function OpcionalDaFicha({ rotulo, preenchido, aberta, onAbertaChange, resumo, dicaId, embutido = false, children }: OpcionalDaFichaProps) {
  const corpoId = `${useId()}-corpo`
  if (embutido) return <div className="lb-token-opt__body">{children}</div>
  const mostrar = preenchido || aberta
  return (
    <>
      {preenchido ? (
        <div className="lb-token-opt__head lb-token-opt__head--cheio">
          <span>{rotulo}</span>
          {resumo !== undefined && <span className="lb-token-opt__resumo">{resumo}</span>}
        </div>
      ) : (
        <button
          type="button"
          className="lb-token-opt__head"
          aria-expanded={mostrar}
          aria-controls={corpoId}
          aria-describedby={dicaId}
          onClick={() => onAbertaChange(!mostrar)}
        >
          <span>{rotulo}</span>
          <SinalDeAbrir />
        </button>
      )}
      <div id={corpoId} className="lb-token-opt__body" hidden={!mostrar}>
        {children}
      </div>
    </>
  )
}

/**
 * Condições da ficha selecionada — envenenado, caído, dormindo, atordoado,
 * invisível. É o controle de MESA do painel: mexido a cada rodada, um clique
 * por condição, e o mapa responde na hora com a pastilha em cima da ficha.
 *
 * Sem marca, o bloco é uma linha "Condições" com "+" (`OpcionalDaFicha`): o
 * nome do botão começa por "Condições", que é por onde a jornada
 * `condicao-na-ficha` o acha. Com marca, as pastilhas ficam à vista. A escolha
 * de deixar aberto é lembrada: em luta, o mestre abre uma vez e as condições
 * ficam à mão em toda ficha.
 *
 * Botões de LIGAR/DESLIGAR (`aria-pressed`) num grupo, e não rádios: uma
 * ficha pode estar caída E envenenada ao mesmo tempo. Marcar e desmarcar são o
 * mesmo gesto; Ctrl+Z desfaz (`toggleTokenCondition` passa pelo histórico).
 *
 * Duas colunas de pastilha + nome, como a legenda de um mapa (`lb-seg--pairs`):
 * em três colunas "Envenenado" não cabia na largura do rail.
 *
 * Depois das cinco de fábrica vêm as condições que o mestre criou e o "Criar
 * condição" (`CondicoesProprias`, pedido de 09/11/2026), no mesmo grupo e com
 * o mesmo gesto de ligar e desligar. A pastilha (`PastilhaDeCondicao`) é a
 * mesma para as duas famílias.
 */
export function TokenConditionControls({
  conditions,
  onToggleCondition,
  embutido = false,
  tokenId,
  proprias = SEM_PROPRIAS,
}: TokenConditionControlsProps) {
  const [aberta, lembrarAberta] = useSecaoLembrada('ficha-condicoes')
  const dicaId = useId()
  return (
    <section className="lb-section lb-token-opt">
      <OpcionalDaFicha
        rotulo="Condições"
        preenchido={conditions.length > 0 || proprias.length > 0}
        aberta={aberta}
        onAbertaChange={lembrarAberta}
        dicaId={dicaId}
        embutido={embutido}
      >
        {/* Embutida na ficha "Condições": os chips do protótipo; solta, as pastilhas em duas colunas. */}
        <div className={embutido ? 'gr-chips' : 'lb-seg lb-seg--pairs'} role="group" aria-label="Condições da ficha" aria-describedby={dicaId}>
          {TOKEN_CONDITION_ORDER.map((condition) => (
            <button
              key={condition}
              type="button"
              aria-pressed={conditions.includes(condition)}
              className={embutido ? 'gr-chip' : 'lb-seg__option'}
              onClick={() => {
                // Quem mexe nas condições está usando o bloco: ele fica aberto,
                // também quando a última marca sai — as pastilhas não somem
                // debaixo do ponteiro.
                if (!aberta) lembrarAberta(true)
                onToggleCondition(condition)
              }}
            >
              <PastilhaDeCondicao symbol={TOKEN_CONDITION_SYMBOLS[condition]} />
              {TOKEN_CONDITION_LABELS[condition]}
            </button>
          ))}
          {tokenId !== undefined && (
            // `key` pela ficha: o formulário aberto e não salvo não passa para a ficha seguinte.
            <CondicoesProprias key={tokenId} tokenId={tokenId} naFicha={proprias} classeDoChip={embutido ? 'gr-chip' : 'lb-seg__option'} />
          )}
        </div>
      </OpcionalDaFicha>
      {/* Embutida, a nota fica à vista sob os chips (protótipo); solta, é a dica sob demanda da linha. */}
      <p id={dicaId} className={embutido ? 'gr-nota' : 'lb-field__hint'}>
        {embutido ? CONDICOES_NOTA : CONDICOES_HINT}
      </p>
    </section>
  )
}
