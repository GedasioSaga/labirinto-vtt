/**
 * A COOPERAÇÃO NO QUADRO DO PUZZLE (28/11): a base fixa (a parede, a chapa, os
 * nichos, o cano e os assentos, `BaseDaCooperacao`) e o que se mexe
 * (`PainelDaCooperacao`): em cada ponto, o nome, o lampião com a chama e o
 * clarão na chapa, o anel da janela que esvazia, e o controle daquele lugar.
 *
 * Os gestos: tocar (ou clicar, ou Enter e Espaço com o foco) no controle do SEU
 * ponto o aciona: a alavanca desce, a placa afunda, o botão entra. Enquanto o
 * lampião do ponto está aceso, o controle fica embaixo (a trava o segura) e
 * volta na mola quando a janela fecha. Os controles dos outros pontos aparecem,
 * apagados, com "Noutro lugar": quem está lá é que os aciona. No teste do
 * editor (`meuPonto` nulo), o mestre aciona todos.
 *
 * O que vale é o host (a vista): ela diz o que está aceso e quanto falta; a tela
 * conta o resto sozinha e apaga o lampião na hora, sem esperar outra vista.
 *
 * Sem `onAcionar` (o editor e a miniatura), tudo é só para ver.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { classes } from '../../lib/primitivosDaTela'
import type { CooperacaoNaVista } from '../tipos'
import { ALTURA_DO_QUADRO, BRACO_DA_ALAVANCA, LADO_DO_PUNHO, LARGURA_DO_QUADRO, arteDoLampiao, arteDosControles, geometriaDaCooperacao, urlDaBaseDaCooperacao, type CelulaDoPonto } from './arte'
import { GESTO_DA_ARTE, NOME_DA_ARTE_DO_PONTO } from './cooperacao'
import { tocarSomDaCooperacao } from './somDaCooperacao'
import type { Caixa } from '../interruptores/arte'
import './cooperacao.css'

/** O punho desce duas vezes o braço da alavanca (do alto da fenda ao pé), em % do próprio tamanho. */
const CURSO_DO_PUNHO = `${((2 * BRACO_DA_ALAVANCA * 100) / LADO_DO_PUNHO).toFixed(2)}%`
/** Folga do relógio local: o lampião apaga um quadro depois do fim da janela, nunca antes. */
const FOLGA_DO_RELOGIO_MS = 16
/** As chamas não tremulam juntas (segundos de defasagem por ponto). */
const DEFASAGEM_DA_CHAMA = 0.61

/** A parede, a chapa e os nichos (a arte do quadro, por baixo da camada). */
export function BaseDaCooperacao({ cooperacao }: { cooperacao: CooperacaoNaVista }) {
  const artes = cooperacao.pontos.map((ponto) => ponto.arte)
  return (
    <div className="qpz__arte qpz-coop-base">
      <img src={urlDaBaseDaCooperacao(cooperacao.material, artes)} alt="" draggable={false} />
    </div>
  )
}

export interface PropsDoPainelDaCooperacao {
  cooperacao: CooperacaoNaVista
  resolvido: boolean
  /** Ausente = só para ver (o editor e a miniatura). */
  onAcionar?: (ponto: number) => void
}

function noQuadro(caixa: Caixa): CSSProperties {
  return {
    left: `${((caixa.x / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    top: `${((caixa.y / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
    width: `${((caixa.largura / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    height: `${((caixa.altura / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
  }
}

function naCaixa(caixa: Caixa, dentro: Caixa): CSSProperties {
  return {
    left: `${(((caixa.x - dentro.x) / dentro.largura) * 100).toFixed(3)}%`,
    top: `${(((caixa.y - dentro.y) / dentro.altura) * 100).toFixed(3)}%`,
    width: `${((caixa.largura / dentro.largura) * 100).toFixed(3)}%`,
    height: `${((caixa.altura / dentro.altura) * 100).toFixed(3)}%`,
  }
}

function caixaDoMostrador(celula: CelulaDoPonto): Caixa {
  const { x, y, r } = celula.mostrador
  return { x: x - r - 2, y: y - r - 2, largura: 2 * r + 4, altura: 2 * r + 4 }
}

/** "Cripta acesa; Ponto 2 apagado": o que o leitor de tela anuncia quando algo muda. */
function textoDosPontos(cooperacao: CooperacaoNaVista, acesos: readonly boolean[]): string {
  return cooperacao.pontos.map((ponto, i) => `${ponto.rotulo} ${acesos[i] === true ? 'aceso' : 'apagado'}`).join('; ') + '.'
}

/**
 * Quando cada lampião apaga, no relógio desta tela (`performance.now`): a vista
 * traz quanto falta, e a tela conta. Uma vista nova recomeça a conta.
 */
function useApagamentos(cooperacao: CooperacaoNaVista, resolvido: boolean): boolean[] {
  const chave = cooperacao.pontos.map((ponto) => `${ponto.aceso ? 1 : 0}:${ponto.restaMs}`).join('|')
  // `chave` resume os pontos: a mesma vista repetida pela rede não recomeça a conta.
  const apagaEm = useMemo(() => {
    const agora = performance.now()
    return cooperacao.pontos.map((ponto) => (ponto.aceso ? agora + ponto.restaMs : 0))
  }, [chave])
  const [relogio, setRelogio] = useState(() => performance.now())
  useEffect(() => {
    const agora = performance.now()
    const proximas = apagaEm.filter((quando) => quando > agora)
    if (proximas.length === 0) return
    const id = window.setTimeout(() => setRelogio(performance.now()), Math.min(...proximas) - agora + FOLGA_DO_RELOGIO_MS)
    return () => window.clearTimeout(id)
  }, [apagaEm, relogio])
  const agora = Math.max(relogio, performance.now())
  return cooperacao.pontos.map((ponto, i) => resolvido || (ponto.aceso && (apagaEm[i] ?? 0) > agora))
}

export function PainelDaCooperacao({ cooperacao, resolvido, onAcionar }: PropsDoPainelDaCooperacao) {
  const { pontos, material, meuPonto, janela } = cooperacao
  const quantos = pontos.length
  const geometria = useMemo(() => geometriaDaCooperacao(quantos), [quantos])
  const lampiao = arteDoLampiao(material)
  const controles = arteDosControles(material)
  const interativo = onAcionar !== undefined && !resolvido
  const acesos = useApagamentos(cooperacao, resolvido)

  // Quantas vezes cada lampião acendeu desde que a tela abriu: a chama "pega" de novo. Os acesos ao abrir não fingem acender.
  const [acendeu, setAcendeu] = useState<number[]>(() => pontos.map(() => 0))
  const acesosAntes = useRef(acesos)
  const chaveDosAcesos = acesos.map((aceso) => (aceso ? 1 : 0)).join('')
  useLayoutEffect(() => {
    const antes = acesosAntes.current
    acesosAntes.current = acesos
    if (antes.length !== acesos.length) {
      setAcendeu(acesos.map(() => 0))
      return
    }
    const acenderam = acesos.flatMap((aceso, i) => (aceso && antes[i] !== true ? [i] : []))
    const apagaram = acesos.some((aceso, i) => !aceso && antes[i] === true)
    if (acenderam.length > 0) setAcendeu((vezes) => acesos.map((_, i) => (acenderam.includes(i) ? (vezes[i] ?? 0) + 1 : (vezes[i] ?? 0))))
    // O som: o gás pega aqui; noutro ponto, o sino de longe. No editor e resolvido, calado (o acerto é da tela).
    if (onAcionar === undefined || resolvido) return
    if (acenderam.some((i) => meuPonto === null || i === meuPonto)) tocarSomDaCooperacao('acende')
    else if (acenderam.length > 0) tocarSomDaCooperacao('longe')
    else if (apagaram) tocarSomDaCooperacao('apaga')
    // `chaveDosAcesos` resume `acesos` (uma lista nova a cada desenho).
  }, [chaveDosAcesos, onAcionar, resolvido, meuPonto])

  const acionar = (i: number) => {
    if (onAcionar === undefined || !interativo || (meuPonto !== null && meuPonto !== i)) return
    const ponto = pontos[i]
    if (ponto === undefined) return
    onAcionar(i)
    tocarSomDaCooperacao(ponto.arte)
  }

  const comoAgir = meuPonto === null ? 'acione os pontos ao mesmo tempo' : 'acione o seu ponto junto com os outros'
  return (
    <div
      className={classes('qpz-coop', resolvido && 'is-resolvido', !interativo && 'is-parado')}
      data-material={material}
      data-pontos={quantos}
      style={{ '--coop-curso': CURSO_DO_PUNHO } as CSSProperties}
      role="group"
      aria-label={interativo ? `Mecanismo de ${quantos} pontos: ${comoAgir}, dentro de ${janela} segundos` : `Mecanismo de ${quantos} pontos`}
    >
      <div className="qpz-coop__claroes" aria-hidden="true">
        {geometria.celulas.map((celula, i) => (
          <img key={i} className={classes('qpz-coop__clarao', acesos[i] === true && 'is-aceso')} src={controles.clarao} style={noQuadro(celula.clarao)} alt="" draggable={false} />
        ))}
      </div>
      {geometria.celulas.map((celula, i) => {
        const ponto = pontos[i]
        if (ponto === undefined) return null
        const aceso = acesos[i] === true
        const vez = acendeu[i] ?? 0
        const meu = meuPonto === null || meuPonto === i
        const usavel = interativo && meu
        const fracao = janela > 0 ? Math.min(1, ponto.restaMs / (janela * 1000)) : 0
        const estado = aceso ? `aceso${ponto.por !== '' ? ` por ${ponto.por}` : ''}` : 'apagado'
        const rotuloDoBotao = meu ? `${GESTO_DA_ARTE[ponto.arte]}: ${ponto.rotulo}, ${estado}` : `${NOME_DA_ARTE_DO_PONTO[ponto.arte]} de ${ponto.rotulo}, noutro lugar, ${estado}`
        return (
          <div key={i} className={classes('qpz-coop__ponto', aceso && 'is-aceso', vez > 0 && 'is-acendeu', meuPonto === i && 'is-meu', !meu && 'is-longe')} style={noQuadro(celula)} data-arte={ponto.arte}>
            <span className="qpz-coop__rotulo" style={naCaixa(celula.rotulo, celula)}>
              <span className="qpz-coop__numero" aria-hidden="true">
                {i + 1}
              </span>
              <span className="qpz-coop__nome">{ponto.rotulo}</span>
            </span>
            <span className="qpz-coop__lampiao" style={naCaixa(celula.lampiao, celula)} aria-hidden="true">
              <img className="qpz-coop__vidro" src={lampiao.vidro} alt="" draggable={false} />
              <img key={`a${vez}`} className="qpz-coop__aceso" src={lampiao.aceso} alt="" draggable={false} />
              <img key={`c${vez}`} className="qpz-coop__chama" src={lampiao.chama} alt="" draggable={false} style={{ animationDelay: `${(-i * DEFASAGEM_DA_CHAMA).toFixed(2)}s, 0s` }} />
              <img className="qpz-coop__corpo" src={lampiao.corpo} alt="" draggable={false} />
              <img className="qpz-coop__reflexo" src={lampiao.reflexo} alt="" draggable={false} />
            </span>
            <svg className="qpz-coop__mostrador" style={naCaixa(caixaDoMostrador(celula), celula)} viewBox="0 0 100 100" aria-hidden="true">
              <circle className="qpz-coop__trilho" cx="50" cy="50" r="40" pathLength={1} />
              {aceso && !resolvido && (
                <circle
                  key={`${vez}-${ponto.restaMs}`}
                  className="qpz-coop__anel"
                  cx="50"
                  cy="50"
                  r="40"
                  pathLength={1}
                  style={{ '--coop-de': (1 - fracao).toFixed(3), animationDuration: `${Math.max(0, ponto.restaMs)}ms` } as CSSProperties}
                />
              )}
              {resolvido && <circle className="qpz-coop__anel is-cheio" cx="50" cy="50" r="40" pathLength={1} />}
            </svg>
            <button
              type="button"
              className="qpz-coop__controle"
              style={naCaixa(celula.controle, celula)}
              data-ponto={i}
              tabIndex={onAcionar !== undefined && meu ? 0 : -1}
              aria-label={rotuloDoBotao}
              aria-disabled={!usavel || undefined}
              onClick={() => acionar(i)}
            >
              <span className="qpz-coop__calor" style={naCaixa(ponto.arte === 'alavanca' ? { x: celula.eixo.x - 130, y: celula.eixo.y - 170, largura: 260, altura: 340 } : ponto.arte === 'placa' ? celula.placa : celula.botao, celula.controle)} aria-hidden="true">
                <img src={controles.calor} alt="" draggable={false} />
              </span>
              {ponto.arte === 'alavanca' && (
                <>
                  <span className="qpz-coop__haste" style={naCaixa(celula.haste, celula.controle)} aria-hidden="true">
                    <img src={lampiao.haste} alt="" draggable={false} />
                  </span>
                  <span className="qpz-coop__punho" style={naCaixa(celula.punho, celula.controle)} aria-hidden="true">
                    <img src={lampiao.punho} alt="" draggable={false} />
                  </span>
                </>
              )}
              {ponto.arte === 'placa' && (
                <span className="qpz-coop__tampa" style={naCaixa(celula.placa, celula.controle)} aria-hidden="true">
                  <img src={controles.placa} alt="" draggable={false} />
                </span>
              )}
              {ponto.arte === 'painel' && (
                <span className="qpz-coop__cupula" style={naCaixa(celula.botao, celula.controle)} aria-hidden="true">
                  <img src={controles.botao} alt="" draggable={false} />
                </span>
              )}
              {!meu && (
                <span className="qpz-coop__longe" aria-hidden="true">
                  Noutro lugar
                </span>
              )}
            </button>
            {meuPonto === i && (
              <span className="qpz-coop__aqui" aria-hidden="true">
                Você está aqui
              </span>
            )}
            <span className={classes('qpz-coop__quem', aceso && ponto.por !== '' && 'is-visivel')} aria-hidden="true">
              {ponto.por !== '' ? ponto.por : ' '}
            </span>
          </div>
        )
      })}
      <div className="qpz-coop__brilho" style={noQuadro(geometria.placa)} aria-hidden="true" />
      <span className="qpz-coop__leitor" aria-live="polite">
        {textoDosPontos(cooperacao, acesos)}
      </span>
    </div>
  )
}
