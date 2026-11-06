import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as EventoDoPonteiro } from 'react'
import { createPortal } from 'react-dom'
import { useImagemDaMesa } from '../../../../components/ImagemDaMesa'
import { CASA_DA_ARENA, EQUIPE_DO_LADO, type CasaDaArena } from '../../../../lib/arena/grade'
import { GRADE_DO_TREINO, LADOS_DO_TREINO, nomeLivre } from '../../../../lib/treino/mesaEmMemoria'
import { iniciaisDoNome, rotuloDaCasa, type BonecoNaGrade } from '../grade/bonecos'
import { GradeDaArena, type MontagemDaGrade } from '../grade/GradeDaArena'
import { retratoDoBoneco } from '../grade/retratos'
import {
  casaLivreNoLado,
  ladoDaCasa,
  ladoDaPeca,
  moverNaGrade,
  porNaGrade,
  recusaDaCasa,
  TEXTO_DA_RECUSA,
  tirarDaGrade,
  type PecaDaMontagem,
  type PecaNaGrade,
} from './regrasDaMontagem'
import './montagem.css'

/**
 * A MONTAGEM POR ARRASTO (fatia J): à esquerda, a lista "Personagens" no
 * formato do painel do app (retrato, nome, selo Jogador ou NPC); à direita, a
 * grade 12 x 8 da Arena com as duas metades. Puxar um item da lista para uma
 * casa põe o token ali (o fantasma do retrato segue o ponteiro e a casa sob ele
 * acende; ocupada ou lado cheio recusa); puxar o token de volta para a lista o
 * tira; arrastar na grade muda de casa ou de lado. Sem arrasto: Enter (ou
 * clique) no item põe na primeira casa livre do lado dele, setas andam o token
 * e Delete tira. Esc desiste do arrasto.
 */

/** Px de tela antes de o toque na lista virar arrasto (abaixo disso é clique), como a grade. */
const LIMIAR_DO_ARRASTO = 4
const CASA_DA_GRADE = CASA_DA_ARENA

interface Props {
  pecas: readonly PecaDaMontagem[]
  lista: readonly PecaNaGrade[]
  onMudar(lista: PecaNaGrade[]): void
  demo: boolean
  /** O botão "Ajustar" na linha do Judge (abre o painel dele). */
  onAjustarJuiz?: () => void
}

interface ArrastoDaLista {
  pecaId: string
  pointerId: number
  x0: number
  y0: number
  movido: boolean
  casa: CasaDaArena | null
}

function nomeDoLado(casa: CasaDaArena): string {
  return EQUIPE_DO_LADO[ladoDaCasa(casa)].nome
}

/**
 * Os nomes na grade, como a luta vai chamar cada cópia: a mesma conta de
 * `montarLutadores` (o Lado A inteiro primeiro, depois o B, cada lado na ordem
 * da lista, e o nome repetido ganha número, "Judge 2"). Assim o "Judge 2" da
 * montagem é o mesmo "Judge 2" do registro, de qualquer lado que ele esteja.
 */
function nomesDasCopias(lista: readonly PecaNaGrade[], pecas: readonly PecaDaMontagem[]): Map<string, string> {
  const usados = new Set<string>()
  const nomes = new Map<string, string>()
  for (const lado of LADOS_DO_TREINO) {
    for (const peca of lista) {
      if (ladoDaCasa(peca.casa) !== lado) continue
      const item = pecas.find((candidato) => candidato.id === peca.pecaId)
      if (item === undefined) continue
      const nome = nomeLivre(item.nome, usados)
      usados.add(nome)
      nomes.set(peca.chave, nome)
    }
  }
  return nomes
}

function Retrato({ src, nome, classe }: { src: string | null; nome: string; classe: string }) {
  const [quebrou, setQuebrou] = useState<string | null>(null)
  return (
    <span className={classe} aria-hidden="true">
      {src !== null && quebrou !== src ? <img src={src} alt="" draggable={false} decoding="async" onError={() => setQuebrou(src)} /> : <span className="lo-tr-mg__iniciais">{iniciaisDoNome(nome)}</span>}
    </span>
  )
}

export function MontagemNaGrade({ pecas, lista, onMudar, demo, onAjustarJuiz }: Props) {
  const resolver = useImagemDaMesa()
  const caixaDaGrade = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLElement>(null)
  const fantasmaRef = useRef<HTMLDivElement>(null)
  const arrasto = useRef<ArrastoDaLista | null>(null)
  const ultimoPonto = useRef({ x: 0, y: 0 })
  const cliqueEngolido = useRef(false)
  const [naMao, setNaMao] = useState<PecaDaMontagem | null>(null)
  const [realce, setRealce] = useState<MontagemDaGrade['realce']>(null)
  const [tirando, setTirando] = useState(false)
  const [anuncio, setAnuncio] = useState({ texto: '', vez: 0 })
  // As props de agora para os ouvintes que vivem entre renders.
  const atual = useRef({ lista, pecas, onMudar })
  atual.current = { lista, pecas, onMudar }

  const anunciar = useCallback((texto: string) => setAnuncio((antes) => ({ texto, vez: antes.vez + 1 })), [])
  const srcDe = useCallback((peca: PecaDaMontagem) => resolver(retratoDoBoneco(peca.retrato, peca.id, demo)), [resolver, demo])
  const nomes = useMemo(() => nomesDasCopias(lista, pecas), [lista, pecas])

  /** A casa da grade sob o ponto da janela; `null` = fora dela. */
  const casaSob = useCallback((x: number, y: number): CasaDaArena | null => {
    const tabuleiro = caixaDaGrade.current?.querySelector<HTMLElement>('.lo-ga-tabuleiro')
    const caixa = tabuleiro?.getBoundingClientRect()
    if (caixa === undefined || caixa.width === 0) return null
    const fator = (GRADE_DO_TREINO.colunas * CASA_DA_GRADE) / caixa.width
    const col = Math.floor(((x - caixa.left) * fator) / CASA_DA_GRADE)
    const row = Math.floor(((y - caixa.top) * fator) / CASA_DA_GRADE)
    return col >= 0 && row >= 0 && col < GRADE_DO_TREINO.colunas && row < GRADE_DO_TREINO.linhas ? { col, row } : null
  }, [])

  const sobreALista = useCallback((ponto: { x: number; y: number }): boolean => {
    const caixa = listaRef.current?.getBoundingClientRect()
    return caixa !== undefined && ponto.x >= caixa.left && ponto.x <= caixa.right && ponto.y >= caixa.top && ponto.y <= caixa.bottom
  }, [])

  const moverFantasma = (x: number, y: number) => {
    ultimoPonto.current = { x, y }
    const fantasma = fantasmaRef.current
    if (fantasma !== null) fantasma.style.transform = `translate(${x - 22}px, ${y - 22}px)`
  }
  // O fantasma nasce já no ponto do ponteiro (antes do primeiro quadro, sem piscar no canto).
  useLayoutEffect(() => {
    if (naMao !== null) moverFantasma(ultimoPonto.current.x, ultimoPonto.current.y)
  }, [naMao])

  const encerrar = useCallback(() => {
    arrasto.current = null
    setNaMao(null)
    setRealce(null)
  }, [])

  // Esc no meio do arrasto da lista: desiste, nada entra na grade.
  useEffect(() => {
    if (naMao === null) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      evento.preventDefault()
      evento.stopPropagation()
      encerrar()
      anunciar('Desistiu: nada entrou na grade.')
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [naMao, encerrar, anunciar])

  function por(peca: PecaDaMontagem, casa: CasaDaArena): boolean {
    const feito = porNaGrade(atual.current.lista, peca.id, casa)
    if (!feito.ok) {
      anunciar(`${peca.nome} não entrou: ${TEXTO_DA_RECUSA[feito.motivo]}.`)
      return false
    }
    onMudar(feito.lista)
    anunciar(`${peca.nome} entrou no ${nomeDoLado(casa)}, casa ${rotuloDaCasa(casa)}.`)
    return true
  }

  function aoApertar(evento: EventoDoPonteiro<HTMLButtonElement>, peca: PecaDaMontagem) {
    if (evento.button !== 0 || !evento.isPrimary || arrasto.current !== null) return
    arrasto.current = { pecaId: peca.id, pointerId: evento.pointerId, x0: evento.clientX, y0: evento.clientY, movido: false, casa: null }
    evento.currentTarget.setPointerCapture(evento.pointerId)
  }

  function aoMover(evento: EventoDoPonteiro<HTMLButtonElement>, peca: PecaDaMontagem) {
    const vivo = arrasto.current
    if (vivo === null || vivo.pointerId !== evento.pointerId) return
    if (!vivo.movido) {
      if (Math.hypot(evento.clientX - vivo.x0, evento.clientY - vivo.y0) < LIMIAR_DO_ARRASTO) return
      vivo.movido = true
      ultimoPonto.current = { x: evento.clientX, y: evento.clientY }
      setNaMao(peca)
    }
    moverFantasma(evento.clientX, evento.clientY)
    const casa = casaSob(evento.clientX, evento.clientY)
    const antes = vivo.casa
    if ((antes === null && casa === null) || (antes !== null && casa !== null && antes.col === casa.col && antes.row === casa.row)) return
    // A casa sob o fantasma muda só quando a casa muda (não a cada quadro do ponteiro).
    vivo.casa = casa
    if (casa === null) {
      setRealce(null)
      return
    }
    const recusa = recusaDaCasa(atual.current.lista, casa)
    setRealce({ casa, situacao: recusa === null ? 'livre' : recusa === 'cheio' ? 'cheio' : 'ocupada' })
  }

  function aoSoltar(evento: EventoDoPonteiro<HTMLButtonElement>, peca: PecaDaMontagem) {
    const fim = arrasto.current
    if (fim === null || fim.pointerId !== evento.pointerId) return
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId)
    encerrar()
    if (!fim.movido) return
    // O clique que o navegador manda depois do arrasto não é um "pôr na grade".
    cliqueEngolido.current = true
    window.setTimeout(() => {
      cliqueEngolido.current = false
    }, 0)
    const casa = casaSob(evento.clientX, evento.clientY)
    if (casa === null) anunciar(`${peca.nome} não entrou: solte numa casa da grade.`)
    else por(peca, casa)
  }

  function aoClicar(peca: PecaDaMontagem) {
    if (cliqueEngolido.current) {
      cliqueEngolido.current = false
      return
    }
    const lado = ladoDaPeca(peca)
    const casa = casaLivreNoLado(atual.current.lista, lado)
    if (casa === null) anunciar(`${peca.nome} não entrou: o ${EQUIPE_DO_LADO[lado].nome} está cheio.`)
    else por(peca, casa)
  }

  const bonecos: BonecoNaGrade[] = lista.flatMap((peca) => {
    const item = pecas.find((candidato) => candidato.id === peca.pecaId)
    if (item === undefined) return []
    return [{ tokenId: peca.chave, nome: nomes.get(peca.chave) ?? item.nome, lado: ladoDaCasa(peca.casa), casa: peca.casa, retrato: retratoDoBoneco(item.retrato, item.id, demo), vida: null, naVez: false, caiu: false, podeAndar: true }]
  })

  const focarNaLista = (pecaId: string) => requestAnimationFrame(() => listaRef.current?.querySelector<HTMLElement>(`[data-peca="${CSS.escape(pecaId)}"]`)?.focus())

  const montagemDaGrade: MontagemDaGrade = {
    realce,
    rotuloDoAlvo: (alvo) => nomeDoLado(alvo),
    aoArrastar: (_tokenId, ponto) => {
      const agora = ponto !== null && sobreALista(ponto)
      setTirando((antes) => (antes === agora ? antes : agora))
    },
    aoSoltarFora: (tokenId, ponto) => {
      if (!sobreALista(ponto)) return false
      const peca = atual.current.lista.find((candidata) => candidata.chave === tokenId)
      atual.current.onMudar(tirarDaGrade(atual.current.lista, tokenId))
      anunciar(`${nomes.get(tokenId) ?? 'A ficha'} saiu da grade.`)
      if (peca !== undefined) focarNaLista(peca.pecaId)
      return true
    },
    aoTirar: (tokenId) => {
      const peca = atual.current.lista.find((candidata) => candidata.chave === tokenId)
      atual.current.onMudar(tirarDaGrade(atual.current.lista, tokenId))
      anunciar(`${nomes.get(tokenId) ?? 'A ficha'} saiu da grade.`)
      if (peca !== undefined) focarNaLista(peca.pecaId)
    },
    dica: 'Arraste para mudar de casa ou de lado (a metade da grade decide), ou use as setas. Delete tira da grade; arrastar de volta para a lista também.',
  }

  function andar(chave: string, casa: CasaDaArena): boolean {
    const feito = moverNaGrade(atual.current.lista, chave, casa)
    if (!feito.ok) {
      anunciar(`${nomes.get(chave) ?? 'A ficha'} não mudou de casa: ${TEXTO_DA_RECUSA[feito.motivo]}.`)
      return false
    }
    atual.current.onMudar(feito.lista)
    return true
  }

  const contagem = (pecaId: string) => lista.filter((peca) => peca.pecaId === pecaId).length

  return (
    <div className="lo-tr-mg">
      <section ref={listaRef} className="lo-tr-mg__lista" aria-labelledby="lo-tr-mg-titulo" data-tirando={tirando ? '' : undefined} data-arrastando={naMao !== null ? '' : undefined}>
        <div className="lo-tr-mg__cab">
          <h2 className="lo-tr-mg__titulo" id="lo-tr-mg-titulo">
            Personagens
          </h2>
          <p className="lo-tr-mg__dica">Puxe para a grade. A metade onde soltar decide o lado.</p>
        </div>
        {pecas.length === 0 ? (
          <p className="lo-motivo">Ninguém para pôr na grade ainda.</p>
        ) : (
          <ul className="lo-tr-mg__itens" aria-label="Quem pode lutar">
            {pecas.map((peca) => {
              const vezes = contagem(peca.id)
              return (
                <li key={peca.id} className="lo-tr-mg__linha">
                  <button
                    type="button"
                    className="lo-tr-mg__item"
                    data-peca={peca.id}
                    data-na-mao={naMao?.id === peca.id ? '' : undefined}
                    aria-describedby="lo-tr-mg-como"
                    onPointerDown={(evento) => aoApertar(evento, peca)}
                    onPointerMove={(evento) => aoMover(evento, peca)}
                    onPointerUp={(evento) => aoSoltar(evento, peca)}
                    onPointerCancel={encerrar}
                    onLostPointerCapture={() => {
                      if (arrasto.current?.pecaId === peca.id) encerrar()
                    }}
                    // O retrato é um <img>: sem isto o navegador começa o arrasto nativo dele e cancela o nosso.
                    onDragStart={(evento) => evento.preventDefault()}
                    onClick={() => aoClicar(peca)}
                  >
                    <span className="lo-tr-mg__foto">
                      <Retrato src={srcDe(peca)} nome={peca.nome} classe="lo-tr-mg__retrato" />
                      {/* Quantas vezes está na grade: a marca no canto do retrato, como um contador. */}
                      {vezes > 0 && <span className="lo-tr-mg__vezes">{vezes}</span>}
                    </span>
                    <span className="lo-tr-mg__texto">
                      <span className="lo-tr-mg__nome">{peca.nome}</span>
                      {peca.detalhe !== null && <span className="lo-tr-mg__detalhe">{peca.detalhe}</span>}
                    </span>
                    {vezes > 0 && <span className="lo-sr">{vezes === 1 ? ', na grade' : `, ${vezes} na grade`}</span>}
                    <span className="lo-tr-mg__selo" data-tipo={peca.selo}>
                      {peca.selo === 'jogador' ? 'Jogador' : 'NPC'}
                    </span>
                  </button>
                  {peca.origem === 'juiz' && onAjustarJuiz !== undefined && (
                    <button type="button" className="lo-btn lo-btn--fantasma lo-tr-mg__ajustar" onClick={onAjustarJuiz} aria-label={`Ajustar ${peca.nome}`}>
                      Ajustar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p id="lo-tr-mg-como" className="lo-sr">
          Arraste até uma casa da grade, ou aperte Enter para pôr na primeira casa livre do lado dele.
        </p>
        <p className="lo-tr-mg__tirar" aria-hidden="true">
          Solte aqui para tirar da grade
        </p>
      </section>

      <div ref={caixaDaGrade} className="lo-tr-mg__grade">
        <GradeDaArena bonecos={bonecos} grade={GRADE_DO_TREINO} caber="largura" escalaMaxima={1} onAndar={andar} montagem={montagemDaGrade} rotulo="Grade da montagem" />
      </div>

      <p className="lo-sr" aria-live="polite">
        {anuncio.texto}
        {anuncio.vez % 2 === 0 ? '' : ' '}
      </p>

      {naMao !== null &&
        createPortal(
          <div ref={fantasmaRef} className="lo-tr-mg__fantasma" aria-hidden="true">
            <Retrato src={srcDe(naMao)} nome={naMao.nome} classe="lo-tr-mg__fantasma-retrato" />
            <span className="lo-tr-mg__fantasma-nome">{naMao.nome}</span>
          </div>,
          document.body,
        )}
    </div>
  )
}
