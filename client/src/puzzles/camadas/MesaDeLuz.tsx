/**
 * A MESA DE LUZ NO QUADRO DO PUZZLE (28/11): a base fixa (a parede e a mesa,
 * `BaseDasCamadas`) e o que se mexe (`PainelDasCamadas`): as lâminas na mesa,
 * cada uma a figura recortada pelos cacos dela com a pele do material por
 * cima, e, ao lado, a pilha com os controles.
 *
 * Os gestos (os mesmos no mouse, no dedo e no teclado):
 * - arrastar uma lâmina da mochila até a mesa a põe no alto da pilha (a mesa
 *   acende na pausa antes de soltar); tocar nela na mochila e depois na mesa
 *   faz o mesmo;
 * - tocar num pedaço da figura escolhe a lâmina dele (a de cima naquele
 *   ponto); tocar de novo na escolhida a gira um quarto de volta;
 * - a lista ao lado escolhe também, e a barra gira, sobe, desce e tira;
 * - no teclado: setas para cima e para baixo escolhem, esquerda e direita
 *   giram, Alt com as setas muda a altura, Delete tira e Esc solta a escolha.
 *
 * Quem vale é o host (a vista): a tela só pede. A lâmina gira quando a vista
 * chega, inclusive a que outro jogador girou, e cada mudança tem o seu som.
 * Sem `onEmpilhar` (o editor), tudo é só para ver.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent as EventoDoMouse, type RefObject } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import { classes } from '../../lib/primitivosDaTela'
import type { TecladoDoControle } from '../ControlesDaCombinacao'
import type { CamadasNaVista, LaminaNaVista } from '../tipos'
import { ALTURA_DO_QUADRO, caminhoDosCacos, COLUNA_DA_PILHA, LARGURA_DO_QUADRO, urlDaFigura, urlDaMesa, urlDaPele, VIDRO_DA_MESA } from './arte'
import { cacosDoCorte, cantoDaMarca, NOME_DA_MARCA, type Ponto } from './camadas'
import { tocarSomDasCamadas } from './somDasCamadas'
import './camadas.css'

/** O aviso de um toque sem efeito fica isto na linha de baixo. */
const AVISO_MS = 2600

/** A parede e a mesa (a arte do quadro, por baixo da camada). */
export function BaseDasCamadas({ camadas }: { camadas: CamadasNaVista }) {
  return (
    <div className="qpz__arte qpz-cam-base">
      <img src={urlDaMesa(camadas.material)} alt="" draggable={false} />
    </div>
  )
}

export interface PropsDaMesa {
  camadas: CamadasNaVista
  resolvido: boolean
  /** A lâmina escolhida na mochila: tocar na mesa a põe. */
  naMao?: { vagaId: string; nome: string } | null
  /** Ausente = só para ver (o editor e o resumo). */
  onEmpilhar?: (vagaId: string) => void
  onGirar?: (encaixeId: string, passo: 1 | -1) => void
  onMover?: (encaixeId: string, passo: 1 | -1) => void
  onTirar?: (encaixeId: string) => void
  /** Onde a tela do jogador pendura o teclado do painel. */
  teclado?: RefObject<TecladoDoControle | null>
}

function caixa(x: number, y: number, largura: number, altura: number): CSSProperties {
  return {
    left: `${((x / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    top: `${((y / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
    width: `${((largura / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    height: `${((altura / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
  }
}

function modulo(valor: number, base: number): number {
  return ((valor % base) + base) % base
}

/** O ponto (0 a 100) está dentro do polígono? (o raio de sempre: conta as travessias). */
function dentro([px, py]: Ponto, poligono: readonly Ponto[]): boolean {
  let dentroDele = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const [xi, yi] = poligono[i] ?? [0, 0]
    const [xj, yj] = poligono[j] ?? [0, 0]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentroDele = !dentroDele
  }
  return dentroDele
}

/** O ponto da mesa visto pela lâmina girada (desfaz o giro em volta do meio). */
function desgirado([x, y]: Ponto, giro: number): Ponto {
  const a = (-giro * Math.PI) / 2
  const dx = x - 50
  const dy = y - 50
  return [50 + dx * Math.cos(a) - dy * Math.sin(a), 50 + dx * Math.sin(a) + dy * Math.cos(a)]
}

function lugarNaPilha(i: number, total: number): string {
  if (total === 1) return 'Sozinha na mesa'
  if (i === total - 1) return 'No alto'
  if (i === 0) return 'Embaixo'
  return `${total - i}ª de cima`
}

interface PropsDaLamina {
  lamina: LaminaNaVista
  camadas: CamadasNaVista
  cacos: readonly (readonly Ponto[])[]
  figura: string | null
  recorte: string
}

/** Uma lâmina desenhada: a figura recortada pelos cacos dela e a pele por cima (o mesmo na mesa e na lista). */
function DesenhoDaLamina({ lamina, camadas, cacos, figura, recorte }: PropsDaLamina) {
  const pele = urlDaPele({ material: camadas.material, cacos, meus: lamina.cacos, manchas: lamina.manchas, marca: lamina.marca, canto: cantoDaMarca(camadas.corte, lamina.marca) })
  return (
    <>
      <svg className="qpz-cam__figura" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={recorte}>
            <path d={caminhoDosCacos(cacos, lamina.cacos)} />
          </clipPath>
        </defs>
        {figura !== null && <image href={figura} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${recorte})`} />}
      </svg>
      <img className="qpz-cam__pele" src={pele} alt="" draggable={false} />
    </>
  )
}

export function PainelDasCamadas({ camadas, resolvido, naMao = null, onEmpilhar, onGirar, onMover, onTirar, teclado }: PropsDaMesa) {
  const prefixo = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const resolver = useImagemDaMesa()
  const cacos = useMemo(() => cacosDoCorte(camadas.corte), [camadas.corte])
  const figura = camadas.figura === 'imagem' ? resolver(camadas.imagem) : urlDaFigura(camadas.figura, camadas.codigo)
  const soParaVer = onEmpilhar === undefined
  const pilha = camadas.pilha
  const ids = pilha.map((lamina) => lamina.encaixeId)

  const [escolhidaCrua, setEscolhida] = useState<string | null>(null)
  const escolhida = escolhidaCrua !== null && ids.includes(escolhidaCrua) ? escolhidaCrua : null
  const laminaEscolhida = pilha.find((lamina) => lamina.encaixeId === escolhida) ?? null
  const [aviso, setAviso] = useState<{ texto: string; vez: number } | null>(null)
  const raiz = useRef<HTMLDivElement>(null)

  // O ângulo mostrado de cada lâmina anda pelo caminho curto (de 270 para 0 é +90, não -270).
  const angulos = useRef(new Map<string, number>())
  const anguloDe = (lamina: LaminaNaVista): number => {
    const alvo = lamina.giro * 90
    const anterior = angulos.current.get(lamina.encaixeId)
    if (anterior === undefined) {
      angulos.current.set(lamina.encaixeId, alvo)
      return alvo
    }
    let delta = alvo - modulo(anterior, 360)
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    const novo = anterior + delta
    angulos.current.set(lamina.encaixeId, novo)
    return novo
  }

  // Depois de aberta, a lâmina que chega entra pousando (o CSS faz, com `@starting-style`);
  // as que já estavam na mesa ao abrir aparecem paradas. O brilho de fechar idem.
  const [viva, setViva] = useState(false)
  useEffect(() => setViva(true), [])
  const [abriuResolvida] = useState(resolvido)

  // O som de cada mudança que a vista trouxe (de quem for).
  const anterior = useRef<readonly LaminaNaVista[] | null>(null)
  useEffect(() => {
    const antes = anterior.current
    anterior.current = pilha
    if (antes === null) return
    const idsAntes = antes.map((lamina) => lamina.encaixeId)
    const chegaram = ids.filter((id) => !idsAntes.includes(id))
    const sairam = idsAntes.filter((id) => !ids.includes(id))
    const giraram = pilha.some((lamina) => {
      const velha = antes.find((outra) => outra.encaixeId === lamina.encaixeId)
      return velha !== undefined && velha.giro !== lamina.giro
    })
    const mudouAOrdem = ids.filter((id) => idsAntes.includes(id)).join('|') !== idsAntes.filter((id) => ids.includes(id)).join('|')
    if (chegaram.length > 0) {
      tocarSomDasCamadas('pousar', camadas.material)
      // A que pousou fica escolhida, se nada estava: dá para girá-la logo.
      setEscolhida((atual) => (atual !== null && ids.includes(atual) ? atual : (chegaram[chegaram.length - 1] ?? null)))
    } else if (sairam.length > 0) tocarSomDasCamadas('tirar', camadas.material)
    else if (mudouAOrdem) tocarSomDasCamadas('mover', camadas.material)
    else if (giraram) tocarSomDasCamadas('girar', camadas.material)
  })

  const vezDoAviso = aviso?.vez
  useEffect(() => {
    if (vezDoAviso === undefined) return
    const id = window.setTimeout(() => setAviso(null), AVISO_MS)
    return () => window.clearTimeout(id)
  }, [vezDoAviso])
  const avisar = (texto: string) => setAviso((antes) => ({ texto, vez: (antes?.vez ?? 0) + 1 }))

  const podeMexer = !soParaVer && !resolvido
  const indiceEscolhida = escolhida === null ? -1 : ids.indexOf(escolhida)

  const girar = (passo: 1 | -1) => {
    if (!podeMexer || escolhida === null || !camadas.rotacaoImporta) return
    onGirar?.(escolhida, passo)
  }
  const mover = (passo: 1 | -1) => {
    if (!podeMexer || escolhida === null || !camadas.ordemImporta) return
    const destino = indiceEscolhida + passo
    if (destino < 0 || destino >= ids.length) {
      avisar(passo === 1 ? 'Ela já está no alto da pilha.' : 'Ela já está embaixo de todas.')
      return
    }
    onMover?.(escolhida, passo)
  }
  const tirar = () => {
    if (!podeMexer || escolhida === null) return
    onTirar?.(escolhida)
  }
  const escolherVizinha = (passo: 1 | -1) => {
    if (ids.length === 0) return
    // A lista mostra o alto primeiro: subir na lista é subir na pilha. Sem escolha,
    // a seta para baixo começa pela de cima, e a para cima, pela de baixo.
    const atual = indiceEscolhida === -1 ? (passo === 1 ? -1 : ids.length) : indiceEscolhida
    const proxima = ids[Math.min(ids.length - 1, Math.max(0, atual + passo))]
    if (proxima !== undefined) setEscolhida(proxima)
  }

  /** Tocar na mesa: com uma lâmina na mão, ela entra; senão, escolhe (ou gira) a do pedaço tocado. */
  const tocarMesa = (evento: EventoDoMouse<HTMLElement>) => {
    if (soParaVer) return
    if (resolvido) {
      avisar('A figura já fechou: as lâminas ficaram presas.')
      return
    }
    if (naMao !== null) {
      onEmpilhar?.(naMao.vagaId)
      return
    }
    if (pilha.length === 0) {
      avisar('A mesa está vazia: arraste uma lâmina da mochila até aqui, ou toque nela e depois na mesa.')
      return
    }
    const caixaDaMesa = evento.currentTarget.getBoundingClientRect()
    if (caixaDaMesa.width === 0 || evento.detail === 0) {
      // Enter ou espaço na mesa: sem ponto para mirar, escolhe a de cima; na escolhida, gira.
      const deCima = ids[ids.length - 1] ?? null
      if (escolhida !== null && camadas.rotacaoImporta) onGirar?.(escolhida, 1)
      else if (escolhida === null) setEscolhida(deCima)
      return
    }
    const ponto: Ponto = [((evento.clientX - caixaDaMesa.left) / caixaDaMesa.width) * 100, ((evento.clientY - caixaDaMesa.top) / caixaDaMesa.height) * 100]
    const tocada = [...pilha].reverse().find((lamina) => {
      const visto = desgirado(ponto, lamina.giro)
      return [...lamina.cacos, ...lamina.manchas].some((i) => {
        const caco = cacos[i]
        return caco !== undefined && dentro(visto, caco)
      })
    })
    if (tocada === undefined) {
      avisar('Aí só passa a luz. Toque num pedaço pintado para escolher a lâmina dele.')
      return
    }
    if (tocada.encaixeId === escolhida && camadas.rotacaoImporta) {
      onGirar?.(tocada.encaixeId, 1)
      return
    }
    setEscolhida(tocada.encaixeId)
  }

  // O teclado: a tela do jogador entrega as teclas enquanto o foco está na mesa.
  // Pelo teclado nada anda (a tecla se repete; a resposta é a lâmina já girada); o ponteiro volta a animar.
  const [peloTeclado, setPeloTeclado] = useState(false)
  const teclaAgora = useRef<(evento: KeyboardEvent) => boolean>(() => false)
  teclaAgora.current = (evento) => {
    if (!podeMexer || raiz.current === null || !(evento.target instanceof Node) || !raiz.current.contains(evento.target)) return false
    if (evento.ctrlKey || evento.metaKey) return false
    const comAlt = evento.altKey
    let feito = true
    if (evento.key === 'ArrowUp') comAlt ? mover(1) : escolherVizinha(1)
    else if (evento.key === 'ArrowDown') comAlt ? mover(-1) : escolherVizinha(-1)
    else if (evento.key === 'ArrowLeft' && !comAlt) girar(-1)
    else if (evento.key === 'ArrowRight' && !comAlt) girar(1)
    else if ((evento.key === 'Delete' || evento.key === 'Backspace') && !comAlt) tirar()
    else if (evento.key === 'Escape' && escolhida !== null && naMao === null) setEscolhida(null)
    else feito = false
    if (feito) {
      evento.preventDefault()
      setPeloTeclado(true)
    }
    return feito
  }
  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => teclaAgora.current(evento)
    return () => {
      teclado.current = null
    }
  }, [teclado])

  const { x, y, lado } = VIDRO_DA_MESA
  const col = COLUNA_DA_PILHA
  const semFigura = figura === null
  const rotuloDaMesa = soParaVer
    ? `Mesa de luz com ${pilha.length} de ${camadas.total} lâminas`
    : naMao !== null
      ? `Pôr ${naMao.nome} na mesa`
      : pilha.length === 0
        ? 'Mesa de luz vazia: escolha uma lâmina na mochila'
        : 'Mesa de luz: toque num pedaço da figura para escolher a lâmina dele; tocar de novo gira'
  const motivoSemEscolha = pilha.length === 0 ? 'Ponha uma lâmina na mesa primeiro.' : 'Escolha uma lâmina na lista ou na mesa.'
  const regras = `${camadas.rotacaoImporta ? 'Giram de 90 em 90 graus.' : 'Só assentam de pé.'} ${camadas.ordemImporta ? 'A ordem importa.' : 'A ordem não importa.'}`

  // A ordem no DOM é fixa (pelo id) e a altura vem do z-index: mudar a ordem não
  // remonta nada, e a lâmina que só trocou de altura não "pousa" de novo.
  const naOrdemFixa = pilha.map((lamina, i) => ({ lamina, i })).sort((a, b) => (a.lamina.encaixeId < b.lamina.encaixeId ? -1 : 1))
  const desenhos = naOrdemFixa.map(({ lamina, i }) => (
    <div
      key={lamina.encaixeId}
      className={classes('qpz-cam__lamina', lamina.encaixeId === escolhida && podeMexer && 'is-escolhida')}
      style={{ transform: `rotate(${anguloDe(lamina)}deg)`, zIndex: i + 1 }}
      data-lamina={lamina.encaixeId}
    >
      <div className="qpz-cam__miolo">
        <DesenhoDaLamina lamina={lamina} camadas={camadas} cacos={cacos} figura={figura} recorte={`${prefixo}-m-${lamina.encaixeId}`} />
      </div>
    </div>
  ))

  const conteudoDaMesa = (
    <>
      <div className="qpz-cam__pilha">{desenhos}</div>
      <div className="qpz-cam__brilho" aria-hidden="true" />
      {pilha.length === 0 ? (
        <span className="qpz-cam__vazia">{soParaVer ? 'Mesa vazia' : 'Mesa vazia. Arraste uma lâmina da mochila até aqui, ou toque nela e depois na mesa.'}</span>
      ) : (
        semFigura && <span className="qpz-cam__vazia">Sem imagem ainda: as lâminas não têm o que mostrar.</span>
      )}
      {naMao !== null && podeMexer && <span className="qpz-cam__convite">Toque na mesa para pôr {naMao.nome}</span>}
    </>
  )

  return (
    <div
      ref={raiz}
      className={classes('qpz-cam', viva && 'is-viva', peloTeclado && 'is-teclado', resolvido && 'is-resolvida', resolvido && !abriuResolvida && 'is-fechou', naMao !== null && podeMexer && 'is-recebendo')}
      data-material={camadas.material}
      onPointerDown={() => setPeloTeclado(false)}
    >
      {soParaVer ? (
        <div className="qpz-cam__mesa" style={caixa(x, y, lado, lado)} role="img" aria-label={rotuloDaMesa}>
          {conteudoDaMesa}
        </div>
      ) : (
        <button type="button" className="qpz-cam__mesa" style={caixa(x, y, lado, lado)} data-alvo="mesa" aria-disabled={resolvido || undefined} aria-label={rotuloDaMesa} onClick={tocarMesa}>
          {conteudoDaMesa}
        </button>
      )}

      <div className="qpz-cam__coluna" style={caixa(col.x, col.y, col.largura, col.altura)}>
        <p className="qpz-cam__titulo">
          Na mesa: <strong>{pilha.length}</strong> de {camadas.total}
        </p>
        <p className="qpz-cam__regras">{regras}</p>
        {pilha.length === 0 ? (
          <p className="qpz-cam__nenhuma">Nenhuma lâmina na mesa ainda.</p>
        ) : (
          <ol className="qpz-cam__lista" aria-label="Lâminas na mesa, do alto para baixo">
            {[...pilha].reverse().map((lamina, j) => {
              const i = pilha.length - 1 - j
              const nome = `${lamina.nome}`
              const detalhe = `${lugarNaPilha(i, pilha.length)}${lamina.por === '' ? '' : ` · posta por ${lamina.por}`}`
              const miniatura = (
                <span className="qpz-cam__mini" aria-hidden="true">
                  <span className="qpz-cam__mini-giro" style={{ transform: `rotate(${lamina.giro * 90}deg)` }}>
                    <DesenhoDaLamina lamina={lamina} camadas={camadas} cacos={cacos} figura={figura} recorte={`${prefixo}-l${i}`} />
                  </span>
                </span>
              )
              return (
                <li key={lamina.encaixeId}>
                  {soParaVer ? (
                    <span className="qpz-cam__linha">
                      {miniatura}
                      <span className="qpz-cam__nome">
                        {nome}
                        <small>{detalhe}</small>
                      </span>
                    </span>
                  ) : (
                    <button type="button" className={classes('qpz-cam__linha', lamina.encaixeId === escolhida && 'is-escolhida')} aria-pressed={lamina.encaixeId === escolhida} onClick={() => setEscolhida(lamina.encaixeId === escolhida ? null : lamina.encaixeId)}>
                      {miniatura}
                      <span className="qpz-cam__nome">
                        {nome}
                        <small>
                          {detalhe} · marca {NOME_DA_MARCA[lamina.marca].toLocaleLowerCase('pt-BR')}
                        </small>
                      </span>
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {!soParaVer && !resolvido && (
          <div className="qpz-cam__barra" role="group" aria-label="Mexer na lâmina escolhida">
            {camadas.rotacaoImporta && (
              <>
                <button type="button" className="qpz-cam__botao" aria-disabled={escolhida === null || undefined} onClick={() => (escolhida === null ? avisar(motivoSemEscolha) : girar(-1))} aria-label="Girar a lâmina escolhida para a esquerda" title="Girar para a esquerda (seta para a esquerda)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 H4 V1 M4.6 5 A9 9 0 1 1 3 12" /></svg>
                </button>
                <button type="button" className="qpz-cam__botao" aria-disabled={escolhida === null || undefined} onClick={() => (escolhida === null ? avisar(motivoSemEscolha) : girar(1))} aria-label="Girar a lâmina escolhida para a direita" title="Girar para a direita (seta para a direita)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5 H20 V1 M19.4 5 A9 9 0 1 0 21 12" /></svg>
                </button>
              </>
            )}
            {camadas.ordemImporta && (
              <>
                <button type="button" className="qpz-cam__botao" aria-disabled={escolhida === null || indiceEscolhida === ids.length - 1 || undefined} onClick={() => (escolhida === null ? avisar(motivoSemEscolha) : mover(1))} aria-label="Subir a lâmina escolhida na pilha" title="Subir (Alt + seta para cima)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20 V5 M6 11 L12 5 L18 11" /></svg>
                </button>
                <button type="button" className="qpz-cam__botao" aria-disabled={escolhida === null || indiceEscolhida === 0 || undefined} onClick={() => (escolhida === null ? avisar(motivoSemEscolha) : mover(-1))} aria-label="Descer a lâmina escolhida na pilha" title="Descer (Alt + seta para baixo)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 V19 M6 13 L12 19 L18 13" /></svg>
                </button>
              </>
            )}
            <button type="button" className="qpz-cam__botao is-tirar" aria-disabled={escolhida === null || undefined} onClick={() => (escolhida === null ? avisar(motivoSemEscolha) : tirar())} title="Devolver à mochila de quem pôs (Delete)">
              Tirar
            </button>
          </div>
        )}
        {!soParaVer && (
          <p className="qpz-cam__dica" role="status" aria-live="polite">
            {resolvido
              ? 'A figura fechou.'
              : (aviso?.texto ??
                (laminaEscolhida === null
                  ? motivoSemEscolha
                  : `Escolhida: ${laminaEscolhida.nome}. ${camadas.rotacaoImporta ? 'Setas ← → giram. ' : ''}${camadas.ordemImporta ? 'Alt + ↑ ↓ mudam a altura. ' : ''}Delete tira.`))}
          </p>
        )}
      </div>
    </div>
  )
}
