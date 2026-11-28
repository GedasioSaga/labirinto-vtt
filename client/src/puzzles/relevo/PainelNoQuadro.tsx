/**
 * O PAINEL EM RELEVO NO QUADRO DO PUZZLE (28/11): a arte (o painel em bitmap,
 * `raster.ts`, e a imagem do mestre na área do relevo) e cada lacuna, que é um
 * encaixe com a forma da placa que falta. Vazia, a lacuna é um vão escuro
 * rebaixado (a sombra cai da borda de cima à esquerda, a luz pega o lábio de
 * baixo); cheia, mostra o pedaço exato do painel com a costura em volta.
 *
 * Só desenha, como o resto do `QuadroDoPuzzle`: tocar e soltar são de quem
 * usa. O botão da lacuna tem a caixa da placa, mas só o contorno dela recebe
 * o ponteiro (`.qpz-placa__toque`): as placas vizinhas não se roubam o toque
 * nem no arrasto (`elementFromPoint` acha o contorno, e o `closest` o botão).
 */
import { useId, useMemo, type CSSProperties } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import { classes } from '../../lib/primitivosDaTela'
import type { CenaDoRelevo, EncaixeNaVista, PostaNaVista, VisualDoRelevo } from '../tipos'
import { AREA, caixaDe, caixaEmPorcento, caminhoSvg, PAINEL_INTEIRO, poligonoDaPlaca, recorteCss, retanguloNaCaixa, type Caixa } from './placas'
import { urlDoSvgDoPainel } from './miniatura'
import './relevo.css'

export interface FonteDoPainel {
  /** O painel em bitmap (com a cena) ou só a moldura (imagem própria); `null` = ainda fundindo. */
  painel: string | null
  /** A imagem do mestre já resolvida (só sem cena); `null` = sem imagem. */
  propria: string | null
  /** O painel não pôde ser desenhado. */
  falhou: boolean
}

const SEM_FONTE: FonteDoPainel = { painel: null, propria: null, falhou: false }

/** O painel do visual, pronto para o `<img>`: desenhado uma vez por cena e metal nesta página. */
export function useFonteDoPainel(visual: VisualDoRelevo | null): FonteDoPainel {
  const resolver = useImagemDaMesa()
  if (visual === null) return SEM_FONTE
  // O SVG vai direto para o `<img>`: o navegador o desenha fora da linha principal, sem travar a abertura.
  const painel = urlDoSvgDoPainel(visual.cena, visual.metal)
  const propria = visual.cena === null ? resolver(visual.imagem) : null
  return { painel, propria, falhou: false }
}

function porcento(caixa: Caixa): CSSProperties {
  const p = caixaEmPorcento(caixa)
  return { left: `${p.x}%`, top: `${p.y}%`, width: `${p.largura}%`, height: `${p.altura}%` }
}

/** A arte do quadro: o painel inteiro e, sem cena, a imagem do mestre na área do relevo. */
export function ArteDoRelevo({ visual, fonte }: { visual: VisualDoRelevo; fonte: FonteDoPainel }) {
  return (
    <div className={classes('qpz__arte', 'qpz-relevo', fonte.painel === null && 'is-fundindo')}>
      {fonte.painel !== null && <img src={fonte.painel} alt="" draggable={false} />}
      {visual.cena === null &&
        (fonte.propria !== null ? (
          <img className="qpz-relevo__propria" src={fonte.propria} alt="" draggable={false} style={porcento(AREA)} />
        ) : (
          <div className="qpz-relevo__sem-imagem" style={porcento(AREA)}>
            Sem imagem ainda.
          </div>
        ))}
      {fonte.falhou && <div className="qpz__vazio">Não foi possível desenhar o painel.</div>}
    </div>
  )
}

interface GeometriaDaPlaca {
  caixa: Caixa
  d: string
  recorte: string
  estilo: CSSProperties
}

export function geometriaDaPlaca(cena: CenaDoRelevo | null, placa: number): GeometriaDaPlaca {
  const poligono = poligonoDaPlaca(cena, placa)
  const caixa = caixaDe(poligono)
  const p = caixaEmPorcento(caixa)
  return {
    caixa,
    d: caminhoSvg(poligono, caixa),
    recorte: recorteCss(poligono, caixa),
    // No meio da caixa, como todo encaixe (o `translate(-50%, -50%)` do `.qpz-encaixe`, que o tremer também usa).
    estilo: { left: `${p.x + p.largura / 2}%`, top: `${p.y + p.altura / 2}%`, width: `${p.largura}%`, height: `${p.altura}%` },
  }
}

/** O id de SVG sem os dois-pontos do `useId` (o `url(#…)` não os aceita). */
function useIdDeSvg(): string {
  return `qpzp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

/** O pedaço do painel dentro da placa posta: o mesmo bitmap do quadro, no mesmo lugar. */
function ConteudoDaPlaca({ cena, fonte, caixa, posta }: { cena: CenaDoRelevo | null; fonte: FonteDoPainel; caixa: Caixa; posta: PostaNaVista }) {
  const resolver = useImagemDaMesa()
  if (cena === null && fonte.propria !== null) return <img src={fonte.propria} alt="" draggable={false} style={{ ...retanguloNaCaixa(AREA, caixa), objectFit: 'cover' }} />
  if (cena !== null && fonte.painel !== null) return <img src={fonte.painel} alt="" draggable={false} style={retanguloNaCaixa(PAINEL_INTEIRO, caixa)} />
  // O painel ainda fundindo: a imagem do item segura o lugar.
  const src = resolver(posta.imagem)
  return src === null ? null : <img src={src} alt="" draggable={false} style={{ inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
}

export interface PropsDaPlacaNoQuadro {
  encaixe: EncaixeNaVista & { placa: number }
  cena: CenaDoRelevo | null
  fonte: FonteDoPainel
  /** O rótulo do leitor de tela, já montado por quem chama (o mesmo dos outros encaixes). */
  rotulo: string
  resolvido: boolean
  mostraQuem: boolean
  alvo: boolean
  onTocar?: (encaixeId: string, botao: HTMLButtonElement) => void
}

export function PlacaNoQuadro({ encaixe, cena, fonte, rotulo, resolvido, mostraQuem, alvo, onTocar }: PropsDaPlacaNoQuadro) {
  const id = useIdDeSvg()
  const { caixa, d, recorte, estilo } = useMemo(() => geometriaDaPlaca(cena, encaixe.placa), [cena, encaixe.placa])
  const { posta } = encaixe
  const className = classes('qpz-encaixe', 'qpz-placa', posta !== null ? 'is-cheia' : 'is-vazia', alvo && !resolvido && 'is-pode')
  const miolo = (
    <>
      <svg className="qpz-placa__forma" viewBox={`0 0 ${caixa.largura.toFixed(1)} ${caixa.altura.toFixed(1)}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {posta === null && (
          <>
            <defs>
              <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0c0a08" />
                <stop offset="1" stopColor="#231b13" />
              </linearGradient>
              <filter id={`${id}f`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feOffset in="SourceAlpha" dx="10" dy="13" result="desl" />
                <feComposite in="SourceAlpha" in2="desl" operator="out" result="faixa" />
                <feGaussianBlur in="faixa" stdDeviation="7" result="faixaBorrada" />
                <feComposite in="faixaBorrada" in2="SourceAlpha" operator="in" result="sombraDentro" />
                <feColorMatrix in="sombraDentro" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.95 0" result="sombra" />
                <feOffset in="SourceAlpha" dx="-4" dy="-5" result="desl2" />
                <feComposite in="SourceAlpha" in2="desl2" operator="out" result="faixa2" />
                <feGaussianBlur in="faixa2" stdDeviation="1.6" result="faixa2Borrada" />
                <feComposite in="faixa2Borrada" in2="SourceAlpha" operator="in" result="luzDentro" />
                <feColorMatrix in="luzDentro" type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.72  0 0 0 0 0.5  0 0 0 0.4 0" result="luz" />
                <feMerge>
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="sombra" />
                  <feMergeNode in="luz" />
                </feMerge>
              </filter>
            </defs>
            <path className="qpz-placa__vao" d={d} fill={`url(#${id}g)`} filter={`url(#${id}f)`} />
          </>
        )}
        <path className="qpz-placa__toque" d={d} />
      </svg>
      {posta !== null && (
        <span className="qpz-encaixe__peca" style={{ clipPath: recorte }}>
          <ConteudoDaPlaca cena={cena} fonte={fonte} caixa={caixa} posta={posta} />
        </span>
      )}
      <span className="qpz-encaixe__brilho" style={{ clipPath: recorte }} />
      <svg className="qpz-placa__linhas" viewBox={`0 0 ${caixa.largura.toFixed(1)} ${caixa.altura.toFixed(1)}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className="qpz-placa__borda" d={d} vectorEffect="non-scaling-stroke" />
        <path className="qpz-placa__alvo" d={d} vectorEffect="non-scaling-stroke" />
      </svg>
      {mostraQuem && posta !== null && <span className="qpz-encaixe__quem">{posta.por}</span>}
    </>
  )
  if (onTocar === undefined) {
    return (
      <span className={className} style={estilo} aria-hidden="true">
        {miolo}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      style={estilo}
      data-alvo="encaixe"
      data-enc={encaixe.id}
      aria-label={rotulo}
      aria-disabled={resolvido || undefined}
      onClick={(event) => onTocar(encaixe.id, event.currentTarget)}
    >
      {miolo}
    </button>
  )
}
