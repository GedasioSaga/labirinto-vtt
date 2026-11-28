/**
 * O TABULEIRO DAS PEÇAS DESLIZANTES NO QUADRO DO PUZZLE (28/11): a base fixa (a
 * parede, a bandeja, o poço e a saída, `BaseDasDeslizantes`) e o que se mexe
 * (`PainelDasDeslizantes`): as peças, cada uma um botão do tamanho da casa.
 *
 * Os gestos: tocar numa peça vizinha da casa vazia a desliza; arrastar leva a
 * peça junto com o dedo, só na direção da vazia e só até ela, e ao soltar ela
 * vai (passou de 40% do caminho, ou foi um peteleco) ou volta. Soltar fora não
 * conta como toque. Tocar numa peça presa só a faz tremer. Com o foco numa
 * peça, as setas andam pela grade e Enter ou Espaço deslizam; o teclado não
 * anima (a tecla é repetida; a resposta é a peça já no lugar novo).
 *
 * A tela prevê o lance (a peça já vai) e o host confirma pela vista; se ele
 * recusar (alguém mexeu antes), a peça volta. A peça que cada outra pessoa
 * mexeu por último fica acesa, com o nome dela.
 *
 * Sem `onDeslizar` (o editor), tudo é só para ver.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as EventoDeTecla, type PointerEvent as EventoDePonteiro, type RefObject } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import { classes } from '../../lib/primitivosDaTela'
import { urlDaFigura } from '../camadas/arte'
import type { TecladoDoControle } from '../ControlesDaCombinacao'
import type { DeslizantesNaVista } from '../tipos'
import { ALTURA_DO_QUADRO, LARGURA_DO_QUADRO, PLAQUETA, POCO, posicaoNaFigura, urlDaBaseDasDeslizantes, urlDaMolduraDaPeca, urlDoBloco } from './arte'
import { casasVizinhas, deslizar, pecaVazia } from './deslizantes'
import { tocarSomDasDeslizantes } from './somDasDeslizantes'
import './deslizantes.css'

/** Quanto do caminho o dedo precisa levar a peça para ela ir (antes disso, ela volta). */
const LIMIAR_DO_ARRASTO = 0.4
/** Um peteleco rápido também leva a peça, mesmo curto (px por ms). */
const VELOCIDADE_DO_PETELECO = 0.45
/** Até aqui o gesto é um toque, não um arrasto (px). */
const FOLGA_DO_TOQUE = 6
/** A peça prevista volta se a vista não mudar neste tempo (a recusa não muda a vista). */
const ESPERA_DA_VISTA_MS = 900
const TREMOR_MS = 260
/** O clique que o navegador manda logo depois de um arrasto não é um toque novo. */
const CLIQUE_DEPOIS_DO_ARRASTO_MS = 400
/** A margem da plaqueta até a figura, em unidades do quadro. */
const MARGEM_DA_PLAQUETA = 14

type Caixa = { x: number; y: number; lado: number }

function emPorcento(caixa: Caixa): CSSProperties {
  return {
    left: `${((caixa.x / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    top: `${((caixa.y / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
    width: `${((caixa.lado / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    height: `${((caixa.lado / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
  }
}

/** A parede, a bandeja, o poço, a saída (modo chave) e a plaqueta (modo figura): a arte do quadro, por baixo da camada. */
export function BaseDasDeslizantes({ deslizantes }: { deslizantes: DeslizantesNaVista }) {
  return (
    <div className="qpz__arte qpz-dz-base">
      <img src={urlDaBaseDasDeslizantes(deslizantes.material, deslizantes.lado, deslizantes.alvo, deslizantes.modo === 'figura')} alt="" draggable={false} />
    </div>
  )
}

/** Quantas vezes a figura é mais larga (x) ou mais alta (y) que o quadrado: a imagem do mestre que não é quadrada. */
function useProporcao(url: string | null): { x: number; y: number } {
  const [proporcao, setProporcao] = useState({ x: 1, y: 1 })
  useEffect(() => {
    if (url === null) return
    let vivo = true
    const imagem = new Image()
    imagem.onload = () => {
      if (!vivo || imagem.naturalWidth === 0 || imagem.naturalHeight === 0) return
      const razao = imagem.naturalWidth / imagem.naturalHeight
      setProporcao(razao >= 1 ? { x: razao, y: 1 } : { x: 1, y: 1 / razao })
    }
    imagem.src = url
    return () => {
      vivo = false
    }
  }, [url])
  return proporcao
}

/** Para onde a peça da casa `casa` vai ao deslizar para a vazia em `vazia`. */
function direcao(casa: number, vazia: number): string {
  if (vazia === casa - 1) return 'para a esquerda'
  if (vazia === casa + 1) return 'para a direita'
  return vazia < casa ? 'para cima' : 'para baixo'
}

function posicao(casa: number, lado: number, dx = 0, dy = 0): string {
  return `translate(${((casa % lado) + dx) * 100}%, ${(Math.floor(casa / lado) + dy) * 100}%)`
}

interface Arrasto {
  ponteiro: number
  peca: number
  casa: number
  elemento: HTMLElement
  x0: number
  y0: number
  t0: number
  eixo: 'x' | 'y'
  sinal: 1 | -1
  passo: number
  andou: number
  mexeu: boolean
}

export interface PropsDoTabuleiro {
  deslizantes: DeslizantesNaVista
  resolvido: boolean
  /** Ausente = só para ver (o editor e o resumo). */
  onDeslizar?: (peca: number) => void
  /** O nome de quem olha: a peça que ele mesmo mexeu não leva o nome. */
  eu?: string
  /** Onde a tela do jogador pendura o teclado do tabuleiro; ausente = as peças ouvem as setas elas mesmas. */
  teclado?: RefObject<TecladoDoControle | null>
}

export function PainelDasDeslizantes({ deslizantes, resolvido, onDeslizar, eu, teclado }: PropsDoTabuleiro) {
  const { lado, casas, modo, material } = deslizantes
  const vazia = pecaVazia(lado)
  const resolverImagem = useImagemDaMesa()
  const figura = modo !== 'figura' ? null : deslizantes.figura === 'imagem' ? resolverImagem(deslizantes.imagem) : urlDaFigura(deslizantes.figura, '')
  const proporcao = useProporcao(figura)
  const interativo = onDeslizar !== undefined && !resolvido
  const caixa = useRef<HTMLDivElement>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const arrastouEm = useRef(Number.NEGATIVE_INFINITY)

  // O lance previsto (a peça já vai); cai sozinho quando a vista muda (outra base) ou quando a espera acaba.
  const [previsto, setPrevisto] = useState<{ base: readonly number[]; casas: number[] } | null>(null)
  const naTela = previsto !== null && previsto.base === casas ? previsto.casas : casas
  useEffect(() => {
    if (previsto === null) return
    const espera = window.setTimeout(() => setPrevisto(null), ESPERA_DA_VISTA_MS)
    return () => window.clearTimeout(espera)
  }, [previsto])

  const [peloTeclado, setPeloTeclado] = useState(false)
  const [tremendo, setTremendo] = useState<number | null>(null)
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    if (tremendo === null) return
    const fim = window.setTimeout(() => setTremendo(null), TREMOR_MS)
    return () => window.clearTimeout(fim)
  }, [tremendo])

  // O som do sulco: o lance de quem mexeu, aqui (já tocou na previsão) ou noutro lugar da mesa (no editor, calado).
  const tocadoPara = useRef<string | null>(null)
  const casasAntes = useRef(casas)
  useLayoutEffect(() => {
    const antes = casasAntes.current
    if (antes === casas) return
    casasAntes.current = casas
    const agora = casas.join()
    if (onDeslizar !== undefined && antes.join() !== agora && tocadoPara.current !== agora) tocarSomDasDeslizantes('desliza', material)
    tocadoPara.current = null
    // Alguém mexeu no meio do meu arrasto: a peça volta para a casa que a vista diz.
    const a = arrasto.current
    if (a !== null && casas.indexOf(a.peca) !== a.casa) {
      a.elemento.classList.remove('is-arrastando')
      a.elemento.style.transform = posicao(casas.indexOf(a.peca), lado)
      arrasto.current = null
    }
  }, [casas, onDeslizar, material, lado])

  const ondeVazia = naTela.indexOf(vazia)

  const pedir = (peca: number, semAnimar: boolean): boolean => {
    if (onDeslizar === undefined || !interativo) return false
    const novas = deslizar(naTela, peca, lado)
    if (novas === null) {
      setTremendo(peca)
      setAviso('Essa peça não tem para onde deslizar.')
      tocarSomDasDeslizantes('presa', material)
      return false
    }
    setPeloTeclado(semAnimar)
    setAviso('')
    setPrevisto({ base: casas, casas: novas })
    tocadoPara.current = novas.join()
    tocarSomDasDeslizantes('desliza', material)
    onDeslizar(peca)
    return true
  }

  const apertar = (evento: EventoDePonteiro<HTMLButtonElement>, peca: number, casa: number) => {
    if (!interativo || arrasto.current !== null || evento.button !== 0 || !casasVizinhas(casa, ondeVazia, lado)) return
    const mesmaLinha = Math.floor(casa / lado) === Math.floor(ondeVazia / lado)
    evento.currentTarget.setPointerCapture(evento.pointerId)
    arrasto.current = {
      ponteiro: evento.pointerId,
      peca,
      casa,
      elemento: evento.currentTarget,
      x0: evento.clientX,
      y0: evento.clientY,
      t0: evento.timeStamp,
      eixo: mesmaLinha ? 'x' : 'y',
      sinal: ondeVazia > casa ? 1 : -1,
      passo: Math.max(1, evento.currentTarget.getBoundingClientRect().width),
      andou: 0,
      mexeu: false,
    }
  }

  const mover = (evento: EventoDePonteiro<HTMLButtonElement>) => {
    const a = arrasto.current
    if (a === null || a.ponteiro !== evento.pointerId) return
    const bruto = a.eixo === 'x' ? evento.clientX - a.x0 : evento.clientY - a.y0
    if (!a.mexeu && Math.abs(bruto) < FOLGA_DO_TOQUE) return
    if (!a.mexeu) a.elemento.classList.add('is-arrastando')
    a.mexeu = true
    // Só na direção da vazia, e só até ela: a peça segue o dedo sem atraso.
    a.andou = Math.max(0, Math.min(1, (bruto * a.sinal) / a.passo))
    const d = a.sinal * a.andou
    a.elemento.style.transform = posicao(a.casa, lado, a.eixo === 'x' ? d : 0, a.eixo === 'y' ? d : 0)
  }

  const soltar = (evento: EventoDePonteiro<HTMLButtonElement>, cancelou: boolean) => {
    const a = arrasto.current
    if (a === null || a.ponteiro !== evento.pointerId) return
    arrasto.current = null
    if (!a.mexeu) return
    arrastouEm.current = evento.timeStamp
    a.elemento.classList.remove('is-arrastando')
    const tempo = Math.max(1, evento.timeStamp - a.t0)
    const vai = !cancelou && (a.andou >= LIMIAR_DO_ARRASTO || (a.andou * a.passo) / tempo > VELOCIDADE_DO_PETELECO)
    // Indo ou voltando, a transição leva a peça do ponto onde o dedo a deixou.
    a.elemento.style.transform = vai ? posicao(ondeVazia, lado) : posicao(a.casa, lado)
    if (vai) pedir(a.peca, false)
  }

  /** O clique do botão: do ponteiro (anima) ou do Enter e do Espaço (`detail` 0, não anima). */
  const tocar = (peca: number, doTeclado: boolean) => {
    // O clique que vem logo depois de um arrasto já foi tratado ao soltar.
    if (!doTeclado && performance.now() - arrastouEm.current < CLIQUE_DEPOIS_DO_ARRASTO_MS) return
    pedir(peca, doTeclado)
  }

  /** As setas andam pela grade (pulando a vazia); Enter e Espaço ficam com o clique do botão. Devolve se a tecla era do tabuleiro. */
  const tecla = (evento: KeyboardEvent): boolean => {
    const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-peca]') : null
    if (alvo === null || caixa.current === null || !caixa.current.contains(alvo) || evento.ctrlKey || evento.metaKey || evento.altKey) return false
    const peca = Number(alvo.dataset.peca)
    const passos: Readonly<Record<string, [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const passo = passos[evento.key]
    if (passo === undefined) return false
    evento.preventDefault()
    let linha = Math.floor(naTela.indexOf(peca) / lado)
    let coluna = naTela.indexOf(peca) % lado
    for (;;) {
      linha += passo[1]
      coluna += passo[0]
      if (linha < 0 || coluna < 0 || linha >= lado || coluna >= lado) return true
      const ali = naTela[linha * lado + coluna]
      if (ali !== undefined && ali !== vazia) {
        caixa.current.querySelector<HTMLElement>(`[data-peca="${ali}"]`)?.focus()
        return true
      }
    }
  }
  const teclaAgora = useRef(tecla)
  useEffect(() => {
    teclaAgora.current = tecla
  })
  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => teclaAgora.current(evento)
    return () => {
      teclado.current = null
    }
  }, [teclado])

  const moldura = urlDaMolduraDaPeca(material)
  const acesas = new Map(deslizantes.ultimas.filter((ultima) => ultima.por !== '' && ultima.por !== eu).map((ultima) => [ultima.peca, ultima.por]))
  const ultima = deslizantes.ultimas.at(-1)
  const leitor = aviso !== '' ? aviso : ultima !== undefined ? `${ultima.por === eu ? 'Você deslizou' : `${ultima.por} deslizou`} a peça ${ultima.peca + 1}.` : ''

  const rosto = (peca: number): CSSProperties => {
    if (figura === null) return { backgroundImage: `url("${urlDoBloco(material, peca === deslizantes.chave)}")`, backgroundSize: '100% 100%' }
    const x = posicaoNaFigura(peca % lado, lado, proporcao.x)
    const y = posicaoNaFigura(Math.floor(peca / lado), lado, proporcao.y)
    return {
      backgroundImage: `url("${figura}")`,
      backgroundSize: `${lado * proporcao.x * 100}% ${lado * proporcao.y * 100}%`,
      backgroundPosition: `${x.toFixed(3)}% ${y.toFixed(3)}%`,
    }
  }

  const como = modo === 'chave' ? 'até a peça-chave chegar à saída' : 'até a figura fechar'
  return (
    <div
      ref={caixa}
      className={classes('qpz-dz', resolvido && 'is-resolvido', !interativo && 'is-parado')}
      data-material={material}
      data-modo={modo}
      data-instantaneo={peloTeclado || undefined}
      style={{ '--dz-lado': lado, '--dz-moldura': `url("${moldura}")` } as CSSProperties}
      role="group"
      aria-label={interativo ? `Tabuleiro de ${lado} por ${lado}: deslize as peças ${como}` : `Tabuleiro de ${lado} por ${lado}`}
    >
      {figura !== null && (
        <div className="qpz-dz__plaqueta" style={emPorcento({ x: PLAQUETA.x + MARGEM_DA_PLAQUETA, y: PLAQUETA.y + MARGEM_DA_PLAQUETA, lado: PLAQUETA.lado - 2 * MARGEM_DA_PLAQUETA })}>
          <img src={figura} alt="" draggable={false} style={{ objectFit: 'cover' }} />
        </div>
      )}
      <div className="qpz-dz__poco" style={emPorcento(POCO)}>
        {/* A peça que faltava assenta na casa vazia quando a figura fecha. */}
        {figura !== null && (
          <span className="qpz-dz__ultima" style={{ transform: posicao(vazia, lado) }} aria-hidden="true">
            <span className="qpz-dz__rosto" style={rosto(vazia)} />
          </span>
        )}
        {naTela.map((peca, casa) => {
          if (peca === vazia) return null
          const pode = interativo && casasVizinhas(casa, ondeVazia, lado)
          const deOutro = acesas.get(peca)
          const nome = modo === 'chave' ? (peca === deslizantes.chave ? 'Peça-chave' : 'Bloco') : `Peça ${peca + 1}${peca === casa ? ', no lugar' : ''}`
          return (
            <button
              key={peca}
              type="button"
              className={classes('qpz-dz__peca', pode && 'is-livre', tremendo === peca && 'is-presa', deOutro !== undefined && 'is-de-outro', modo === 'chave' && peca === deslizantes.chave && 'is-chave')}
              style={{ transform: posicao(casa, lado) }}
              data-peca={peca}
              tabIndex={onDeslizar !== undefined ? 0 : -1}
              aria-label={`${nome}${pode ? `, desliza ${direcao(casa, ondeVazia)}` : ''}`}
              aria-disabled={!pode || undefined}
              onPointerDown={(evento) => apertar(evento, peca, casa)}
              onPointerMove={mover}
              onPointerUp={(evento) => soltar(evento, false)}
              onPointerCancel={(evento) => soltar(evento, true)}
              onClick={(evento) => tocar(peca, evento.detail === 0)}
              onKeyDown={teclado === undefined ? (evento: EventoDeTecla<HTMLButtonElement>) => void tecla(evento.nativeEvent) : undefined}
            >
              <span className="qpz-dz__rosto" style={rosto(peca)} aria-hidden="true" />
              {deOutro !== undefined && !resolvido && (
                <span className="qpz-dz__quem" aria-hidden="true">
                  {deOutro}
                </span>
              )}
            </button>
          )
        })}
        {/* Quando fecha, a figura inteira (uma imagem só) cobre as peças: some a emenda fina entre elas. */}
        {figura !== null && <span className="qpz-dz__inteira" style={{ backgroundImage: `url("${figura}")`, backgroundSize: `${proporcao.x * 100}% ${proporcao.y * 100}%` }} aria-hidden="true" />}
      </div>
      <span className="qpz-dz__leitor" aria-live="polite">
        {leitor}
      </span>
    </div>
  )
}
