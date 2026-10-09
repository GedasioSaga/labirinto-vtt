import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { BotaoProcurarAnimacoes } from '../components/ProcurarAnimacoes'
import {
  TRANSICAO_DURACAO_MAX_S,
  TRANSICAO_DURACAO_MIN_S,
  assinarTransicoes,
  isDuracaoValida,
  listarTransicoes,
  type TransicaoEscolhida,
  type TransicaoId,
  type TransicaoInfo,
} from './catalogo'
import { miniaturaDaTransicao } from './motor'
import { TransicaoPreviewDialog, formatarSegundos } from './TransicaoPreviewDialog'
import './transicoes.css'

interface TransicaoSectionProps {
  transicao: TransicaoEscolhida | undefined
  onChange: (transicao: TransicaoEscolhida | undefined) => void
  /** Quem atravessa: "o pino" ou "a escada", só para o texto de ajuda. */
  origem: 'pino' | 'escada'
  /** Escada de enfeite: a galeria aparece, com o aviso de que só toca depois de ligar a escada. */
  semDestino?: boolean
}

function ExpandirIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
    </svg>
  )
}

/**
 * Miniatura gerada uma vez por transição (um quadro da cena); sem WebGL fica o
 * fundo preto. Depende da ENTRADA, não só do id: a versão nova de uma
 * transição do pacote (mesmo id) desenha a miniatura de novo.
 */
function Miniatura({ info }: { info: TransicaoInfo }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void miniaturaDaTransicao(info.id).then((pronta) => {
      if (vivo) setUrl(pronta)
    })
    return () => {
      vivo = false
    }
  }, [info])
  return url ? <img className="lb-transicao-item__miniatura" src={url} alt="" /> : <span className="lb-transicao-item__miniatura" aria-hidden="true" />
}

/**
 * Galeria de TRANSIÇÕES ESPECIAIS do pino de viagem e da escada: "Nenhuma" e
 * uma linha por transição (miniatura + nome + duração), com o botão de
 * expandir que abre a animação inteira numa janela. Escolhida uma, aparece o
 * campo de duração (vazio = animação completa).
 *
 * A lista é viva: embutidas e as do pacote baixado, e a que chegar com o
 * painel aberto (botão "Procurar animações novas") entra sem reabrir nada.
 */
export function TransicaoSection({ transicao, onChange, origem, semDestino = false }: TransicaoSectionProps) {
  const tituloId = useId()
  const duracaoId = useId()
  const dicaId = useId()
  const [previa, setPrevia] = useState<TransicaoEscolhida | null>(null)
  const transicoes = useSyncExternalStore(assinarTransicoes, listarTransicoes)
  const escolhida = transicao?.id
  const info = escolhida ? transicoes.find((t) => t.id === escolhida) : undefined
  // Id de um pacote que este app ainda não baixou: a galeria diz isso em vez
  // de marcar "Nenhuma" calada — ela não mente sobre o pino.
  const naoInstalada = escolhida !== undefined && info === undefined ? escolhida : null

  function escolher(id: TransicaoId | undefined) {
    if (id === escolhida) return
    onChange(id === undefined ? undefined : { id })
  }

  return (
    <section className="lb-transicoes" aria-labelledby={tituloId}>
      <h3 id={tituloId} className="lb-label">
        Transição ao {origem === 'pino' ? 'atravessar' : 'trocar de piso'}
      </h3>
      <ul className="lb-transicoes__lista">
        <li className="lb-transicao-item" data-escolhida={escolhida === undefined}>
          <button type="button" className="lb-transicao-item__escolher" aria-pressed={escolhida === undefined} onClick={() => escolher(undefined)}>
            <span className="lb-transicao-item__miniatura lb-transicao-item__miniatura--nenhuma" aria-hidden="true">
              —
            </span>
            <span className="lb-transicao-item__texto">
              <span className="lb-transicao-item__nome">Nenhuma</span>
              <span className="lb-transicao-item__duracao">Chega direto</span>
            </span>
          </button>
        </li>
        {transicoes.map((t: TransicaoInfo) => (
          <li key={t.id} className="lb-transicao-item" data-escolhida={escolhida === t.id}>
            <button type="button" className="lb-transicao-item__escolher" aria-pressed={escolhida === t.id} onClick={() => escolher(t.id)}>
              <Miniatura info={t} />
              <span className="lb-transicao-item__texto">
                <span className="lb-transicao-item__nome">{t.nome}</span>
                <span className="lb-transicao-item__duracao">{formatarSegundos(t.duracaoNaturalS)}</span>
              </span>
            </button>
            <button
              type="button"
              className="lb-iconbtn lb-iconbtn--sm"
              aria-label={`Assistir ${t.nome}`}
              title="Assistir inteira"
              onClick={() => setPrevia(escolhida === t.id && transicao ? transicao : { id: t.id })}
            >
              <ExpandirIcon />
            </button>
          </li>
        ))}
      </ul>
      {naoInstalada !== null && <p className="lb-travel__hint">A transição escolhida ({naoInstalada}) ainda não chegou neste app. Até chegar, quem passar chega direto.</p>}
      <BotaoProcurarAnimacoes />
      {transicao && info && (
        <DuracaoDaTransicao
          key={transicao.id}
          inputId={duracaoId}
          dicaId={dicaId}
          duracaoS={transicao.duracaoS}
          naturalS={info.duracaoNaturalS}
          onChange={(duracaoS) => onChange(duracaoS === undefined ? { id: transicao.id } : { id: transicao.id, duracaoS })}
        />
      )}
      {semDestino && <p className="lb-travel__hint">Esta escada ainda não leva a lugar nenhum: a animação toca quando você ligar a escada a outro andar ou piso.</p>}
      <p className="lb-travel__hint">Só quem passar {origem === 'pino' ? 'pelo pino' : 'pela escada'} vê a animação, com um botão de pular.</p>
      {previa && <TransicaoPreviewDialog escolha={previa} onClose={() => setPrevia(null)} />}
    </section>
  )
}

interface DuracaoProps {
  inputId: string
  dicaId: string
  duracaoS: number | undefined
  naturalS: number
  onChange: (duracaoS: number | undefined) => void
}

/** Campo de segundos: vazio = completa; grava ao sair do campo ou no Enter, preso ao teto. */
function DuracaoDaTransicao({ inputId, dicaId, duracaoS, naturalS, onChange }: DuracaoProps) {
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
    const preso = Math.min(TRANSICAO_DURACAO_MAX_S, Math.max(TRANSICAO_DURACAO_MIN_S, Math.round(lido * 10) / 10))
    // Escrever a duração natural é o mesmo que deixar vazio.
    onChange(preso === naturalS || !isDuracaoValida(preso) ? undefined : preso)
    setTexto(preso === naturalS ? '' : String(preso))
  }

  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={inputId}>
        Duração (segundos)
      </label>
      <div className="lb-transicoes__duracao">
        <input
          id={inputId}
          className="lb-input"
          type="text"
          inputMode="decimal"
          placeholder={String(naturalS).replace('.', ',')}
          aria-describedby={dicaId}
          value={texto}
          onChange={(event) => setTexto(event.currentTarget.value)}
          onBlur={gravar}
          onKeyDown={(event) => {
            if (event.key === 'Enter') gravar()
          }}
        />
      </div>
      <span id={dicaId} className="lb-travel__hint">
        Vazio = animação completa ({formatarSegundos(naturalS)}). De {TRANSICAO_DURACAO_MIN_S} a {TRANSICAO_DURACAO_MAX_S} s.
      </span>
    </div>
  )
}
