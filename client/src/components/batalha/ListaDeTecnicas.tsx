import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { textoDaCarga, type GolpeNaTela, type PipDaVez } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * AS TIRAS DO MENU DE BATALHA (o `.tira` do protótipo aprovado) e a LISTA DE
 * TÉCNICAS (Atacar com as armas, Habilidades): tiras com nome, descrição,
 * custo à direita ("45 SP", "? SP"), chips Ação · Dano · Tempo, apagadas com
 * o motivo, e a seta para o detalhe (a conta do dano, o efeito, os extras).
 *
 * Teclado: setas sobem e descem (a seleção segue o foco), seta para a
 * direita abre o detalhe, Enter escolhe, seta para a esquerda ou Esc voltam.
 * Tira apagada recebe foco (para o motivo ser lido) e não escolhe.
 */

const GIROS = [-3, -1.6, -2.6, -1.2, -3.4, -2] as const

/** PRNG pequeno e determinístico (o mesmo rasgo para a mesma tira a cada render). */
function mulberry32(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A borda rasgada da tira (protótipo `rasgo`): pontos aleatórios em volta, com a mesma semente. */
function rasgo(semente: number, amplitude = 4): string {
  const r = mulberry32(semente)
  const n = 28
  const pontos: string[] = []
  for (let i = 0; i <= n; i += 1) pontos.push(`${((i / n) * 100).toFixed(2)}% ${(r() * amplitude).toFixed(1)}px`)
  for (let i = 1; i <= 3; i += 1) pontos.push(`calc(100% - ${(r() * amplitude * 1.6).toFixed(1)}px) ${i * 25}%`)
  for (let i = n; i >= 0; i -= 1) pontos.push(`${((i / n) * 100).toFixed(2)}% calc(100% - ${(r() * amplitude).toFixed(1)}px)`)
  for (let i = 3; i >= 1; i -= 1) pontos.push(`${(r() * amplitude * 1.6).toFixed(1)}px ${i * 25}%`)
  return `polygon(${pontos.join(',')})`
}

function sementeDe(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return h >>> 0
}

export interface TiraProps {
  indice: number
  /** Dá a semente do rasgo. */
  chave: string
  nome: string
  /** À direita: o custo, a carga, o atalho. */
  lado?: string | null
  /** A linha de baixo; com `motivo`, o motivo toma o lugar. */
  detalhe?: string | null
  motivo?: string | null
  chips?: ReactNode
  esta: boolean
  forma?: boolean
  pequena?: boolean
  expandida?: boolean
  controla?: string
  onEscolher: () => void
  onFoco: () => void
  refDaTira?: (elemento: HTMLButtonElement | null) => void
}

export function Tira({ indice, chave, nome, lado, detalhe, motivo, chips, esta, forma, pequena, expandida, controla, onEscolher, onFoco, refDaTira }: TiraProps) {
  const estilo = useMemo(() => {
    const semente = sementeDe(chave)
    return {
      '--giro': `${GIROS[indice % GIROS.length]}deg`,
      '--rasgo': rasgo(semente),
      '--rasgo2': rasgo(semente + 101, 5),
      '--i': indice,
    } as CSSProperties
  }, [chave, indice])
  const classe = ['bt-tira', forma ? 'bt-tira--forma' : '', pequena ? 'bt-tira--pequena' : ''].filter(Boolean).join(' ')
  const linha = motivo ?? detalhe ?? null
  return (
    <button
      ref={refDaTira}
      type="button"
      className={classe}
      style={estilo}
      data-esta={esta ? 'sim' : 'nao'}
      data-tira={chave}
      aria-disabled={motivo ? true : undefined}
      aria-expanded={expandida}
      aria-controls={controla}
      onFocus={onFoco}
      onClick={() => {
        if (!motivo) onEscolher()
      }}
    >
      <span className="bt-tira__nome">{nome}</span>
      <span className="bt-tira__lado">{lado ?? ''}</span>
      {linha !== null && linha !== '' && <span className="bt-tira__det">{linha}</span>}
      {chips !== undefined && chips !== null && <span className="bt-tira__chips">{chips}</span>}
    </button>
  )
}

/** As setas andam entre as tiras; Home e End vão às pontas. Devolve se tratou a tecla. */
export function andarComSetas(evento: KeyboardEvent, tiras: readonly (HTMLButtonElement | null)[], atual: number): boolean {
  const total = tiras.length
  if (total === 0) return false
  let proxima: number | null = null
  if (evento.key === 'ArrowDown') proxima = (atual + 1) % total
  else if (evento.key === 'ArrowUp') proxima = (atual - 1 + total) % total
  else if (evento.key === 'Home') proxima = 0
  else if (evento.key === 'End') proxima = total - 1
  if (proxima === null) return false
  evento.preventDefault()
  tiras[proxima]?.focus()
  return true
}

/** A cabeça do menu: o nome e a economia da vez ("Simples 1 · Bônus 0 · Mov 2/4"). */
export function CabecaDaVez({ quem, pips, carga, titulo }: { quem: string; pips: readonly PipDaVez[] | null; carga: number; titulo?: string }) {
  const textoCarga = textoDaCarga(carga)
  return (
    <div className="bt-vez__cabeca">
      <h2 className="bt-vez__quem">{titulo === undefined ? quem : `${titulo}`}</h2>
      <div className="bt-vez__economia" aria-label={[...(pips ?? []).map((pip) => pip.texto), textoCarga].filter(Boolean).join(', ')}>
        {(pips ?? []).map((pip) => (
          <span key={pip.id} className="bt-pip" data-gasto={pip.gasto ? 'sim' : 'nao'} data-passou={pip.passou ? 'sim' : 'nao'} aria-hidden="true">
            {pip.texto}
          </span>
        ))}
        {textoCarga !== null && (
          <span className="bt-pip bt-pip--carga" aria-hidden="true">
            Carga {carga}
          </span>
        )}
      </div>
    </div>
  )
}

/** Os chips Ação · Dano · Tempo de um golpe. */
export function ChipsDoGolpe({ golpe }: { golpe: GolpeNaTela }) {
  return (
    <>
      {golpe.forma !== undefined && <span className="bt-etq bt-etq--forma">{golpe.forma}</span>}
      <span className="bt-etq">{golpe.acaoTexto}</span>
      {!golpe.dano.semDano && <span className="bt-etq bt-etq--dano">{golpe.dano.valor === null ? 'Dano: fórmula' : `Dano ${golpe.dano.valor}`}</span>}
      {golpe.tempoTexto !== null && <span className={golpe.overload ? 'bt-etq bt-etq--over' : 'bt-etq'}>{golpe.tempoTexto}</span>}
      {golpe.overload && golpe.tempoTexto !== 'Overload' && <span className="bt-etq bt-etq--over">Overload</span>}
      {golpe.perfurante && <span className="bt-etq">Perfurante</span>}
    </>
  )
}

export interface ListaDeTecnicasProps {
  /** "Atacar" ou "Habilidades". */
  titulo: string
  pips: readonly PipDaVez[] | null
  carga: number
  golpes: readonly GolpeNaTela[]
  onEscolher: (golpe: GolpeNaTela) => void
  onVoltar: () => void
  /** "Escolher armas" no topo (o limite da ficha, Q1/Q8). `pendente` = ainda não escolheu. */
  armas?: { pendente: boolean; onAbrir: () => void }
  /** Aberta pelo teclado: as tiras entram na hora. */
  instantaneo?: boolean
  /** O que dizer sem golpe nenhum. */
  vazio: string
}

export function ListaDeTecnicas({ titulo, pips, carga, golpes, onEscolher, onVoltar, armas, instantaneo, vazio }: ListaDeTecnicasProps) {
  const tiras = useRef<(HTMLButtonElement | null)[]>([])
  const [atual, setAtual] = useState(0)
  const [aberto, setAberto] = useState<string | null>(null)
  const temArmas = armas !== undefined
  const total = golpes.length + (temArmas ? 1 : 0)
  tiras.current.length = total

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (andarComSetas(evento, tiras.current, atual)) return
    if (evento.key === 'Escape' || evento.key === 'ArrowLeft') {
      evento.preventDefault()
      evento.stopPropagation()
      if (aberto !== null && evento.key === 'ArrowLeft') setAberto(null)
      else onVoltar()
      return
    }
    if (evento.key === 'ArrowRight') {
      const golpe = golpes[atual - (temArmas ? 1 : 0)]
      if (golpe === undefined) return
      evento.preventDefault()
      setAberto((antes) => (antes === golpe.chave ? null : golpe.chave))
    }
  }

  return (
    <div className="bt-vez bt-vez--lista" data-instantaneo={instantaneo ? 'sim' : 'nao'} onKeyDown={teclar}>
      <CabecaDaVez quem={titulo} pips={pips} carga={carga} />
      {total === 0 ? (
        <p className="bt-vez__aviso">{vazio}</p>
      ) : (
        <ul className="bt-vez__tiras" aria-label={titulo}>
          {temArmas && (
            <li>
              <Tira
                indice={0}
                chave="escolher-armas"
                nome={armas.pendente ? 'Escolher armas' : 'Trocar armas'}
                detalhe={armas.pendente ? 'A ficha tem limite de armas por batalha: escolha antes de atacar' : 'Troque as armas levadas, sempre dentro do limite'}
                pequena
                esta={atual === 0}
                onFoco={() => setAtual(0)}
                onEscolher={armas.onAbrir}
                refDaTira={(elemento) => {
                  tiras.current[0] = elemento
                }}
              />
            </li>
          )}
          {golpes.map((golpe, i) => {
            const indice = i + (temArmas ? 1 : 0)
            const idDoDetalhe = `bt-detalhe-${golpe.chave}`
            const expandida = aberto === golpe.chave
            return (
              <li key={golpe.chave}>
                <Tira
                  indice={indice}
                  chave={golpe.chave}
                  nome={golpe.nome}
                  lado={golpe.custoTexto}
                  detalhe={golpe.descricao || null}
                  motivo={golpe.motivo}
                  chips={<ChipsDoGolpe golpe={golpe} />}
                  forma={golpe.forma !== undefined}
                  esta={atual === indice}
                  expandida={expandida}
                  controla={expandida ? idDoDetalhe : undefined}
                  onFoco={() => setAtual(indice)}
                  onEscolher={() => onEscolher(golpe)}
                  refDaTira={(elemento) => {
                    tiras.current[indice] = elemento
                  }}
                />
                {expandida && <DetalheDoGolpe id={idDoDetalhe} golpe={golpe} />}
              </li>
            )
          })}
        </ul>
      )}
      <p className="bt-vez__dica">
        <kbd>↑</kbd> <kbd>↓</kbd> escolhe · <kbd>→</kbd> detalhe · <kbd>Enter</kbd> usa · <kbd>Esc</kbd> volta
      </p>
      <div className="bt-vez__rodape">
        <button type="button" className="bt-botao bt-botao--p" onClick={onVoltar}>
          Voltar
        </button>
      </div>
    </div>
  )
}

/** O detalhe aberto pela seta: a conta do dano, o custo, a ação, o tempo e o motivo. */
export function DetalheDoGolpe({ id, golpe }: { id?: string; golpe: GolpeNaTela }) {
  return (
    <div className="bt-detalhe" id={id}>
      <dl>
        <dt>Dano</dt>
        <dd>{golpe.dano.conta}</dd>
        <dt>Ação</dt>
        <dd>{golpe.acaoTexto}</dd>
        {golpe.custoTexto !== null && (
          <>
            <dt>Custo</dt>
            <dd>{golpe.custo.tipo === 'pergunta' ? `${golpe.custo.texto} (você confirma na mira)` : golpe.custoTexto}</dd>
          </>
        )}
        {golpe.tempoTexto !== null && (
          <>
            <dt>Tempo</dt>
            <dd>{golpe.tempoTexto}</dd>
          </>
        )}
        {golpe.descricao !== '' && (
          <>
            <dt>Efeito</dt>
            <dd>{golpe.descricao}</dd>
          </>
        )}
        {golpe.motivo !== null && (
          <>
            <dt>Agora</dt>
            <dd>{golpe.motivo}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
