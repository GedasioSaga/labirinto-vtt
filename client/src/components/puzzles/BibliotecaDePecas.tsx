import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Botao } from '../grimorio/Botao'
import { classes } from '../grimorio/comum'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { NOME_DA_PECA_MAX } from '../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { apagarPeca, garantirNoAcervo, renomearPeca, srcDaPeca, subirPecaPropria, type PecaDoEditor, type PecasDoEditor } from './pecasDoEditor'

/**
 * A BIBLIOTECA DE PEÇAS do editor (protótipo aprovado, `htmlBiblioteca` e
 * `moverBibArrasto`): a pasta "Peça de puzzle" do acervo, mais as peças
 * desenhadas que ainda não estão lá. Tocar escolhe a peça (nome, descrição,
 * "Peça certa do encaixe N"); arrastar até um encaixe do quadro faz dela a
 * peça certa, e o encaixe acende enquanto a peça paira sobre ele.
 *
 * O arrasto mexe só no fantasma (`transform` dele) e na classe do encaixe sob
 * o ponteiro: nada da tela re-renderiza até soltar.
 */

/** Abaixo disto o toque é escolha, não arrasto (v2: 6 px). */
const LIMIAR_DO_ARRASTO_PX = 6
/** O meio do fantasma (64 px) fica sob o ponteiro. */
const MEIO_DO_FANTASMA_PX = 32

interface ArrastoDaPeca {
  peca: PecaDoEditor
  src: string | null
  ponteiro: number
  x0: number
  y0: number
  fantasma: HTMLDivElement | null
  alvo: HTMLElement | null
}

interface PropsDaBiblioteca {
  pecas: PecasDoEditor
  selecionada: string | null
  onSelecionar: (itemId: string | null) => void
  /** O encaixe escolhido no quadro, para o "Peça certa do encaixe N". */
  encaixe: { id: string; numero: number } | null
  onPecaNoEncaixe: (encaixeId: string, peca: PecaDoEditor) => void
  onAviso: (texto: string, tipo: 'info' | 'error') => void
}

function texto(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export function BibliotecaDePecas({ pecas, selecionada, onSelecionar, encaixe, onPecaNoEncaixe, onAviso }: PropsDaBiblioteca) {
  const resolver = useImagemDaMesa()
  const podeGravar = useAcervoDeItensStore((estado) => estado.podeGravar)
  const arrasto = useRef<ArrastoDaPeca | null>(null)
  const ignorarClique = useRef(false)
  const peca = pecas.porId(selecionada)

  useEffect(() => () => limparFantasma(arrasto.current), [])

  const comecar = (evento: PointerEvent<HTMLButtonElement>, alvo: PecaDoEditor) => {
    if (evento.button !== 0 || arrasto.current !== null) return
    arrasto.current = { peca: alvo, src: srcDaPeca(alvo, resolver), ponteiro: evento.pointerId, x0: evento.clientX, y0: evento.clientY, fantasma: null, alvo: null }
    evento.currentTarget.setPointerCapture(evento.pointerId)
  }

  const mover = (evento: PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.ponteiro) return
    if (a.fantasma === null) {
      if (Math.hypot(evento.clientX - a.x0, evento.clientY - a.y0) < LIMIAR_DO_ARRASTO_PX) return
      a.fantasma = criarFantasma(a.src, a.peca.nome)
    }
    a.fantasma.style.transform = `translate3d(${evento.clientX - MEIO_DO_FANTASMA_PX}px, ${evento.clientY - MEIO_DO_FANTASMA_PX}px, 0) scale(1.08)`
    // O fantasma não pega ponteiro (CSS), então o que está sob ele é o encaixe.
    const achado = document.elementFromPoint(evento.clientX, evento.clientY)?.closest('[data-enc-ed]')
    const sob = achado instanceof HTMLElement ? achado : null
    if (sob !== a.alvo) {
      a.alvo?.classList.remove('is-pairando-ok')
      sob?.classList.add('is-pairando-ok')
      a.alvo = sob
    }
  }

  const soltar = (evento: PointerEvent<HTMLButtonElement>, valer: boolean) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.ponteiro) return
    arrasto.current = null
    const arrastou = a.fantasma !== null
    const encaixeId = a.alvo?.dataset.encEd
    limparFantasma(a)
    if (!arrastou) return
    // O clique que segue o arrasto não escolhe a peça.
    ignorarClique.current = true
    window.setTimeout(() => {
      ignorarClique.current = false
    }, 0)
    if (valer && encaixeId !== undefined) onPecaNoEncaixe(encaixeId, a.peca)
  }

  const subir = async () => {
    try {
      const id = await subirPecaPropria()
      if (id !== null) {
        onSelecionar(id)
        onAviso('A peça entrou no acervo, na pasta Peça de puzzle. Dê um nome a ela aqui embaixo.', 'info')
      }
    } catch (erro) {
      onAviso(texto(erro), 'error')
    }
  }

  return (
    <section className="pze-bib" aria-labelledby="pze-bib-t">
      <div className="pze-bib__cab">
        <h3 id="pze-bib-t">Biblioteca de peças</h3>
        <span className="pze-nota">Toque para dar nome e descrição; arraste até um encaixe para ser a peça certa.</span>
      </div>
      <div className="pze-bib__grade" role="group" aria-label="Peças">
        {pecas.biblioteca.map((p) => {
          const src = srcDaPeca(p, resolver)
          return (
            <button
              key={p.itemId}
              type="button"
              className={classes('pze-peca', !p.noAcervo && 'is-fora', p.noAcervo && p.desenhada === null && 'is-propria')}
              aria-pressed={selecionada === p.itemId}
              aria-label={p.noAcervo ? p.nome : `${p.nome}, desenhada, ainda fora do acervo`}
              onPointerDown={(evento) => comecar(evento, p)}
              onPointerMove={mover}
              onPointerUp={(evento) => soltar(evento, true)}
              onPointerCancel={(evento) => soltar(evento, false)}
              onClick={() => {
                if (ignorarClique.current) return
                onSelecionar(selecionada === p.itemId ? null : p.itemId)
              }}
            >
              {src !== null ? <img src={src} alt="" draggable={false} /> : <span className="pze-peca__inicial">{Array.from(p.nome.trim())[0] ?? '?'}</span>}
              <span>{p.nome}</span>
            </button>
          )
        })}
        {podeGravar && (
          <button type="button" className="pze-peca pze-peca--nova" onClick={() => void subir()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Subir peça</span>
          </button>
        )}
      </div>
      {!podeGravar && <p className="pze-nota">O acervo de itens não abriu aqui: as peças desenhadas aparecem, mas pôr no acervo e subir peça ficam para o app.</p>}
      {peca !== null && <PecaEscolhida key={peca.itemId} peca={peca} src={srcDaPeca(peca, resolver)} encaixe={encaixe} podeGravar={podeGravar} onPecaNoEncaixe={onPecaNoEncaixe} onSelecionar={onSelecionar} onAviso={onAviso} />}
    </section>
  )
}

function criarFantasma(src: string | null, nome: string): HTMLDivElement {
  const fantasma = document.createElement('div')
  fantasma.className = 'pze-fantasma'
  if (src !== null) {
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    fantasma.appendChild(img)
  } else {
    // textContent: o nome é do mestre e nunca vira HTML.
    fantasma.textContent = Array.from(nome.trim())[0] ?? '?'
  }
  document.body.appendChild(fantasma)
  document.body.classList.add('pze-arrastando')
  return fantasma
}

function limparFantasma(a: ArrastoDaPeca | null): void {
  if (a === null) return
  a.alvo?.classList.remove('is-pairando-ok')
  a.fantasma?.remove()
  document.body.classList.remove('pze-arrastando')
}

interface PropsDaPecaEscolhida {
  peca: PecaDoEditor
  src: string | null
  encaixe: PropsDaBiblioteca['encaixe']
  podeGravar: boolean
  onPecaNoEncaixe: PropsDaBiblioteca['onPecaNoEncaixe']
  onSelecionar: PropsDaBiblioteca['onSelecionar']
  onAviso: PropsDaBiblioteca['onAviso']
}

/** A peça escolhida: nome e descrição (do item do acervo, valem em todos os puzzles), e o que fazer com ela. */
function PecaEscolhida({ peca, src, encaixe, podeGravar, onPecaNoEncaixe, onSelecionar, onAviso }: PropsDaPecaEscolhida) {
  const [nome, setNome] = useState(peca.nome)
  const [descricao, setDescricao] = useState(peca.descricao)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [pondo, setPondo] = useState(false)
  const editavel = peca.noAcervo && podeGravar

  const gravar = () => {
    if (!editavel) return
    renomearPeca(peca.itemId, nome, descricao).catch((erro: unknown) => onAviso(texto(erro), 'error'))
  }
  const porNoAcervo = async () => {
    setPondo(true)
    try {
      await garantirNoAcervo(peca)
      onAviso(`“${peca.nome}” entrou no acervo, na pasta Peça de puzzle.`, 'info')
    } catch (erro) {
      onAviso(texto(erro), 'error')
    } finally {
      setPondo(false)
    }
  }
  const apagar = async () => {
    if (!confirmarApagar) {
      setConfirmarApagar(true)
      return
    }
    try {
      await apagarPeca(peca.itemId)
      onSelecionar(null)
    } catch (erro) {
      onAviso(texto(erro), 'error')
    }
  }

  return (
    <div className="pze-peca-edita">
      <span className="pze-peca-edita__ico">{src !== null && <img src={src} alt="" draggable={false} />}</span>
      <label className="gr-campo">
        <span className="gr-campo__rot">Nome da peça</span>
        <input
          className="gr-entrada"
          value={nome}
          maxLength={NOME_DA_PECA_MAX}
          disabled={!editavel}
          onChange={(evento) => setNome(evento.currentTarget.value)}
          onBlur={gravar}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') evento.currentTarget.blur()
          }}
        />
      </label>
      <label className="gr-campo pze-peca-edita__desc">
        <span className="gr-campo__rot">Descrição (o jogador lê na mochila)</span>
        <textarea className="gr-entrada" rows={2} value={descricao} disabled={!editavel} onChange={(evento) => setDescricao(evento.currentTarget.value)} onBlur={gravar} />
      </label>
      <div className="pze-peca-edita__acoes">
        {encaixe !== null && (
          <Botao variante="latao" tamanho="p" onClick={() => onPecaNoEncaixe(encaixe.id, peca)}>
            Peça certa do encaixe {encaixe.numero}
          </Botao>
        )}
        {!peca.noAcervo && podeGravar && (
          <Botao tamanho="p" disabled={pondo} onClick={() => void porNoAcervo()}>
            {pondo ? 'Pondo no acervo…' : 'Pôr no acervo'}
          </Botao>
        )}
        {peca.noAcervo && peca.desenhada === null && podeGravar && (
          <Botao variante="perigo" tamanho="p" onClick={() => void apagar()} onBlur={() => setConfirmarApagar(false)}>
            {confirmarApagar ? 'Apagar mesmo?' : 'Apagar esta peça'}
          </Botao>
        )}
        <span className="pze-nota">{peca.noAcervo ? 'Nome e descrição valem em todos os seus puzzles.' : 'Usada num encaixe, ela entra no acervo sozinha.'}</span>
      </div>
    </div>
  )
}
