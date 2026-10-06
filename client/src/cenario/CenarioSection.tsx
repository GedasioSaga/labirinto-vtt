import { useEffect, useId, useState } from 'react'
import { Toggle } from '../components/Toggle'
import {
  CENARIO_DURACAO_MAX_S,
  CENARIO_DURACAO_MIN_S,
  CENARIO_DURACAO_NATURAL_S,
  CENARIO_PADRAO,
  MOVIMENTOS,
  type CenarioDoPino,
  type MovimentoId,
} from './catalogo'
import { CenarioPreviewDialog } from './CenarioPreviewDialog'
import './cenario.css'

interface CenarioSectionProps {
  cenario: CenarioDoPino | undefined
  /** A imagem do pino; sem ela não há o que animar. */
  imagem: string | null
  onChange: (cenario: CenarioDoPino | undefined) => void
}

type Quando = 'nao' | CenarioDoPino['quando']

const QUANDO: Array<{ valor: Quando; nome: string }> = [
  { valor: 'nao', nome: 'Não, só o cartão' },
  { valor: 'primeira', nome: 'Só da primeira vez' },
  { valor: 'sempre', nome: 'Sempre' },
]

/** Seta que mostra o sentido do movimento (ou o "aproximar") no cartão da galeria. */
function SetaDoMovimento({ id }: { id: MovimentoId }) {
  const caminho: Record<MovimentoId, string> = {
    sobe: 'M8 13V3M4 7l4-4 4 4',
    desce: 'M8 3v10M4 9l4 4 4-4',
    direita: 'M3 8h10M9 4l4 4-4 4',
    esquerda: 'M13 8H3M7 4 3 8l4 4',
    aproxima: 'M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3',
  }
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={caminho[id]} />
    </svg>
  )
}

function ExpandirIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
    </svg>
  )
}

/**
 * ANIMAÇÃO DO CENÁRIO no painel do pino "!": quando toca (nunca, só da
 * primeira vez, sempre), qual movimento, quanto tempo e quais efeitos. Cada
 * movimento tem o botão de assistir inteiro numa janela.
 */
export function CenarioSection({ cenario, imagem, onChange }: CenarioSectionProps) {
  const tituloId = useId()
  const quandoId = useId()
  const duracaoId = useId()
  const dicaId = useId()
  const [previa, setPrevia] = useState<CenarioDoPino | null>(null)
  const quando: Quando = cenario?.quando ?? 'nao'

  function mudar(patch: Partial<CenarioDoPino>) {
    onChange({ ...(cenario ?? CENARIO_PADRAO), ...patch })
  }

  function escolherQuando(valor: Quando) {
    if (valor === quando) return
    if (valor === 'nao') onChange(undefined)
    else mudar({ quando: valor })
  }

  return (
    <section className="lb-cenario-secao" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="lb-label">
        Animação do Cenário
      </h3>
      {imagem === null ? (
        <p className="lb-travel__hint">Coloque uma imagem no pino para animar o cenário.</p>
      ) : (
        <>
          <div className="lb-seg" role="radiogroup" aria-labelledby={quandoId}>
            <span id={quandoId} className="lb-sr-only">
              Quando o jogador vê
            </span>
            {QUANDO.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                role="radio"
                aria-checked={quando === opcao.valor}
                className="lb-seg__option"
                onClick={() => escolherQuando(opcao.valor)}
              >
                {opcao.nome}
              </button>
            ))}
          </div>
          {cenario !== undefined && (
            <>
              <ul className="lb-cenario-secao__movimentos">
                {MOVIMENTOS.map((m) => (
                  <li key={m.id} className="lb-cenario-mov" data-escolhido={cenario.movimento === m.id}>
                    <button type="button" className="lb-cenario-mov__escolher" aria-pressed={cenario.movimento === m.id} onClick={() => mudar({ movimento: m.id })}>
                      <span className="lb-cenario-mov__seta">
                        <SetaDoMovimento id={m.id} />
                      </span>
                      {m.nome}
                    </button>
                    <button
                      type="button"
                      className="lb-iconbtn lb-iconbtn--sm"
                      aria-label={`Assistir ${m.nome}`}
                      title="Assistir inteira"
                      onClick={() => setPrevia({ ...cenario, movimento: m.id })}
                    >
                      <ExpandirIcon />
                    </button>
                  </li>
                ))}
              </ul>
              <DuracaoDoCenario key={cenario.movimento} inputId={duracaoId} dicaId={dicaId} duracaoS={cenario.duracaoS} onChange={(duracaoS) => mudar({ duracaoS })} />
              <Toggle label="Névoa" checked={cenario.nevoa} onChange={(nevoa) => mudar({ nevoa })} />
              <Toggle label="Raios de sol" checked={cenario.raios} onChange={(raios) => mudar({ raios })} />
              <Toggle label="Partículas (pólen e folhas)" checked={cenario.particulas} onChange={(particulas) => mudar({ particulas })} />
              <Toggle label="Som do vento" checked={cenario.som} onChange={(som) => mudar({ som })} />
              <p className="lb-travel__hint">
                {cenario.quando === 'sempre'
                  ? 'Toca toda vez que o jogador abre este pino; depois vem o cartão.'
                  : 'Toca na primeira vez que o jogador abre este pino; depois, só o cartão (com "Ver animação").'}
              </p>
            </>
          )}
          {previa && <CenarioPreviewDialog imagem={imagem} cenario={previa} onClose={() => setPrevia(null)} />}
        </>
      )}
    </section>
  )
}

interface DuracaoProps {
  inputId: string
  dicaId: string
  duracaoS: number | undefined
  onChange: (duracaoS: number | undefined) => void
}

/** Segundos: vazio = duração natural; grava ao sair do campo ou no Enter, preso ao teto. */
function DuracaoDoCenario({ inputId, dicaId, duracaoS, onChange }: DuracaoProps) {
  const [texto, setTexto] = useState(duracaoS === undefined ? '' : String(duracaoS))
  useEffect(() => {
    setTexto(duracaoS === undefined ? '' : String(duracaoS))
  }, [duracaoS])

  function gravar() {
    const limpo = texto.trim().replace(',', '.')
    if (limpo === '') {
      onChange(undefined)
      return
    }
    const lido = Number(limpo)
    if (!Number.isFinite(lido)) {
      setTexto(duracaoS === undefined ? '' : String(duracaoS))
      return
    }
    const preso = Math.min(CENARIO_DURACAO_MAX_S, Math.max(CENARIO_DURACAO_MIN_S, Math.round(lido * 10) / 10))
    onChange(preso === CENARIO_DURACAO_NATURAL_S ? undefined : preso)
    setTexto(preso === CENARIO_DURACAO_NATURAL_S ? '' : String(preso))
  }

  return (
    <div className="lb-field lb-cenario-secao__duracao">
      <label className="lb-label" htmlFor={inputId}>
        Duração (segundos)
      </label>
      <input
        id={inputId}
        className="lb-input"
        type="text"
        inputMode="decimal"
        placeholder={String(CENARIO_DURACAO_NATURAL_S)}
        aria-describedby={dicaId}
        value={texto}
        onChange={(event) => setTexto(event.currentTarget.value)}
        onBlur={gravar}
        onKeyDown={(event) => {
          if (event.key === 'Enter') gravar()
        }}
      />
      <span id={dicaId} className="lb-travel__hint">
        Vazio = {CENARIO_DURACAO_NATURAL_S} s. De {CENARIO_DURACAO_MIN_S} a {CENARIO_DURACAO_MAX_S} s.
      </span>
    </div>
  )
}
