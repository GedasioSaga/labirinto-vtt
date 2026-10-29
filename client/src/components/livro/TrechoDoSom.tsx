import { useEffect, useId, useRef, useState, type KeyboardEvent as EventoDeTecla, type PointerEvent as EventoDePonteiro } from 'react'
import { trechoDaFonte, type EfeitoDeSom, type TrechoDoSom } from '../../lib/sons/biblioteca'
import type { CarregadorDeBytes } from '../../lib/sons/aoVivo/motor'
import { lerOndaDoSom, type OndaDoSom } from '../../lib/sons/ondaDoSom'
import { noDecimo, PASSO_DO_TRECHO_S, PASSO_LARGO_DO_TRECHO_S, segundosDoInstante, textoDoInstante } from '../../lib/sons/tempoDoTrecho'
import { Botao } from '../grimorio/Botao'
import { classes } from '../grimorio/comum'
import { IconeDoLivro } from './icones'

/*
 * O TRECHO DE A ATÉ B no lápis da aba Sons (29/10/2026): a faixa do tempo do
 * som com duas alças, os tempos em `m:ss,d` ao lado, Ouvir e Usar o som
 * inteiro. Cada mudança vale na hora (a biblioteca grava sozinha), como o
 * resto do lápis; o arrasto grava ao soltar. Sem duração conhecida (YouTube,
 * ou o arquivo que não abriu) a faixa não aparece e ficam só os campos.
 *
 * Movimento: nenhum. A alça segue o ponteiro sem atraso, e a seta do teclado
 * pula sem transição (ação repetida dezenas de vezes num ajuste).
 */

const ERRO_DO_INSTANTE = 'Use minutos e segundos (0:12,5) ou só segundos (12,5).'
/** Shift + Page Up/Down: dez segundos. */
const PASSO_DA_PAGINA_S = 10

type Alca = 'inicio' | 'fim'

interface Props {
  efeito: EfeitoDeSom
  carregar: CarregadorDeBytes
  tocando: boolean
  /** Ouvir (o trecho de agora) ou Parar, quando já toca. */
  onOuvir: () => void
  /** A loja aceitou? Recusado, quem chama mostra o motivo. */
  onMudar: (trecho: TrechoDoSom | null) => boolean
}

type EstadoDaOnda = { tipo: 'lendo' } | { tipo: 'pronta'; onda: OndaDoSom } | { tipo: 'sem' }

function useOnda(efeito: EfeitoDeSom, carregar: CarregadorDeBytes): EstadoDaOnda {
  const ref = efeito.fonte.tipo === 'arquivo' ? efeito.fonte.ref : null
  const [estado, setEstado] = useState<EstadoDaOnda>(() => (ref === null ? { tipo: 'sem' } : { tipo: 'lendo' }))
  useEffect(() => {
    const lendo = lerOndaDoSom(efeito.fonte, carregar)
    if (lendo === null) {
      setEstado({ tipo: 'sem' })
      return
    }
    let valendo = true
    lendo.then(
      (onda) => {
        if (valendo) setEstado({ tipo: 'pronta', onda })
      },
      () => {
        if (valendo) setEstado({ tipo: 'sem' })
      },
    )
    return () => {
      valendo = false
    }
    // A fonte só muda de áudio quando muda a `ref`; o trecho mexe na fonte sem trocar a onda.
  }, [ref, carregar])
  return estado
}

/** O caminho SVG da onda espelhada, em coordenadas de 0 a `BARRAS` por 0 a 1 (o SVG estica). */
function caminhoDaOnda(picos: Float32Array): string {
  let d = ''
  for (let i = 0; i < picos.length; i++) {
    // Piso de 4%: o silêncio ainda mostra a linha do tempo, não um buraco.
    const meia = Math.max(0.04, picos[i] ?? 0) * 0.5
    d += `M${i + 0.5} ${(0.5 - meia).toFixed(3)}V${(0.5 + meia).toFixed(3)}`
  }
  return d
}

/** O tamanho do trecho: "4,7 s" até um minuto; acima, como um tempo ("1:12,0"). */
function textoDaDuracao(segundos: number): string {
  return segundos < 60 ? `${noDecimo(segundos).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s` : textoDoInstante(segundos)
}

function limitar(valor: number, menor: number, maior: number): number {
  return Math.min(maior, Math.max(menor, valor))
}

export function EditorDoTrecho({ efeito, carregar, tocando, onOuvir, onMudar }: Props) {
  const onda = useOnda(efeito, carregar)
  const duracaoS = onda.tipo === 'pronta' ? onda.onda.duracaoS : null
  const gravado = trechoDaFonte(efeito.fonte)
  const temTrecho = gravado.inicioS > 0 || gravado.fimS !== undefined
  // O fim de agora na tela: o gravado, ou o fim do som (sem fim gravado). Sem duração, vazio = até o fim.
  const fimNaTela = gravado.fimS ?? duracaoS ?? undefined

  const [arrasto, setArrasto] = useState<{ alca: Alca; inicioS: number; fimS: number } | null>(null)
  const [textoA, setTextoA] = useState<string | null>(null)
  const [textoB, setTextoB] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const faixa = useRef<HTMLDivElement>(null)
  const idA = useId()
  const idB = useId()
  const idErro = useId()

  const inicioS = arrasto?.inicioS ?? gravado.inicioS
  const fimS = arrasto?.fimS ?? fimNaTela

  /** Grava o trecho; o que cobre o som inteiro vira "som inteiro" (nada escrito no `sons.json`). */
  const gravar = (novoInicio: number, novoFim: number | undefined): boolean => {
    const inicio = noDecimo(Math.max(0, novoInicio))
    const fimNoTeto = novoFim === undefined ? undefined : noDecimo(novoFim)
    const ateOFim = fimNoTeto === undefined || (duracaoS !== null && fimNoTeto >= noDecimo(duracaoS))
    if (inicio === 0 && ateOFim) return onMudar(null)
    return onMudar({ inicioS: inicio, ...(ateOFim ? {} : { fimS: fimNoTeto }) })
  }

  const confirmarTexto = (alca: Alca) => {
    const texto = alca === 'inicio' ? textoA : textoB
    if (texto === null) return
    const limpar = () => (alca === 'inicio' ? setTextoA(null) : setTextoB(null))
    // B vazio = até o fim.
    if (alca === 'fim' && texto.trim() === '') {
      limpar()
      setErro(null)
      gravar(gravado.inicioS, undefined)
      return
    }
    const segundos = segundosDoInstante(texto)
    if (segundos === null) {
      setErro(ERRO_DO_INSTANTE)
      return
    }
    const novoInicio = alca === 'inicio' ? segundos : gravado.inicioS
    const novoFim = alca === 'fim' ? segundos : gravado.fimS
    if (duracaoS !== null && (novoInicio >= duracaoS || (novoFim !== undefined && novoFim > noDecimo(duracaoS) + PASSO_DO_TRECHO_S))) {
      setErro(`O som tem ${textoDoInstante(duracaoS)}: o trecho precisa caber nele.`)
      return
    }
    if (novoFim !== undefined && novoFim - novoInicio < PASSO_DO_TRECHO_S) {
      setErro('O fim (B) precisa vir depois do começo (A).')
      return
    }
    limpar()
    setErro(null)
    gravar(novoInicio, novoFim)
  }

  const teclaDoCampo = (alca: Alca) => (evento: EventoDeTecla<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmarTexto(alca)
    } else if (evento.key === 'Escape' && (alca === 'inicio' ? textoA : textoB) !== null) {
      // O Esc desfaz o que foi digitado; o segundo Esc (campo já limpo) fecha o diálogo.
      evento.preventDefault()
      evento.stopPropagation()
      if (alca === 'inicio') setTextoA(null)
      else setTextoB(null)
      setErro(null)
    }
  }

  // ─── a faixa (só com duração) ───
  const naFaixa = (clientX: number): number => {
    const caixa = faixa.current?.getBoundingClientRect()
    if (caixa === undefined || caixa.width <= 0 || duracaoS === null) return 0
    return noDecimo(limitar(((clientX - caixa.left) / caixa.width) * duracaoS, 0, duracaoS))
  }

  const moverAlca = (alca: Alca, segundos: number, inicio: number, fim: number): { inicioS: number; fimS: number } => {
    if (alca === 'inicio') return { inicioS: limitar(segundos, 0, fim - PASSO_DO_TRECHO_S), fimS: fim }
    return { inicioS: inicio, fimS: limitar(segundos, inicio + PASSO_DO_TRECHO_S, duracaoS ?? segundos) }
  }

  const apertar = (evento: EventoDePonteiro<HTMLDivElement>) => {
    if (duracaoS === null || fimS === undefined || evento.button !== 0) return
    const segundos = naFaixa(evento.clientX)
    // A alça mais perto do toque; no meio exato, a do lado para onde o toque foi.
    const alca: Alca = Math.abs(segundos - inicioS) <= Math.abs(segundos - fimS) && segundos <= fimS ? 'inicio' : 'fim'
    evento.currentTarget.setPointerCapture(evento.pointerId)
    setArrasto({ alca, ...moverAlca(alca, segundos, inicioS, fimS) })
    setErro(null)
  }

  const arrastar = (evento: EventoDePonteiro<HTMLDivElement>) => {
    if (arrasto === null) return
    setArrasto({ alca: arrasto.alca, ...moverAlca(arrasto.alca, naFaixa(evento.clientX), arrasto.inicioS, arrasto.fimS) })
  }

  const soltar = () => {
    if (arrasto === null) return
    setArrasto(null)
    gravar(arrasto.inicioS, arrasto.fimS)
  }

  const teclaDaAlca = (alca: Alca) => (evento: EventoDeTecla<HTMLDivElement>) => {
    if (duracaoS === null || fimS === undefined) return
    const atual = alca === 'inicio' ? inicioS : fimS
    const passo = evento.shiftKey ? PASSO_LARGO_DO_TRECHO_S : PASSO_DO_TRECHO_S
    const alvos: Record<string, number> = {
      ArrowLeft: atual - passo,
      ArrowDown: atual - passo,
      ArrowRight: atual + passo,
      ArrowUp: atual + passo,
      PageDown: atual - PASSO_DA_PAGINA_S,
      PageUp: atual + PASSO_DA_PAGINA_S,
      Home: 0,
      End: duracaoS,
    }
    const alvo = alvos[evento.key]
    if (alvo === undefined) return
    evento.preventDefault()
    const novo = moverAlca(alca, noDecimo(alvo), inicioS, fimS)
    setErro(null)
    gravar(novo.inicioS, novo.fimS)
  }

  const porcento = (segundos: number): string => `${duracaoS === null || duracaoS <= 0 ? 0 : (limitar(segundos, 0, duracaoS) / duracaoS) * 100}%`
  const tamanho = fimS === undefined ? null : fimS - inicioS
  const ehYoutube = efeito.fonte.tipo === 'youtube'

  return (
    <fieldset className="lb-trecho">
      <legend className="lb-trecho__rot">
        <span>Trecho</span>
        <output className="lb-trecho__resumo">{tamanho === null ? `De ${textoDoInstante(inicioS)} até o fim` : `${textoDoInstante(inicioS)} – ${textoDoInstante(fimS ?? 0)} (${textoDaDuracao(tamanho)})`}</output>
      </legend>

      {duracaoS !== null && fimS !== undefined && (
        <div
          ref={faixa}
          className={classes('lb-trecho__faixa', arrasto !== null && 'lb-trecho__faixa--arrastando')}
          onPointerDown={apertar}
          onPointerMove={arrastar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {onda.tipo === 'pronta' && onda.onda.picos !== null && (
            <svg className="lb-trecho__onda" viewBox={`0 0 ${onda.onda.picos.length} 1`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d={caminhoDaOnda(onda.onda.picos)} />
            </svg>
          )}
          {/* O fora do trecho escurece: o olho lê o que vai tocar, não o que sobra. */}
          <span className="lb-trecho__fora" style={{ left: 0, width: porcento(inicioS) }} aria-hidden="true" />
          <span className="lb-trecho__fora" style={{ left: porcento(fimS), right: 0 }} aria-hidden="true" />
          <span className="lb-trecho__escolhido" style={{ left: porcento(inicioS), width: `calc(${porcento(fimS)} - ${porcento(inicioS)})` }} aria-hidden="true" />
          {(['inicio', 'fim'] as const).map((alca) => {
            const valor = alca === 'inicio' ? inicioS : fimS
            return (
              <div
                key={alca}
                className={classes('lb-trecho__alca', `lb-trecho__alca--${alca}`)}
                style={{ left: porcento(valor) }}
                role="slider"
                tabIndex={0}
                aria-label={alca === 'inicio' ? 'Começo do trecho (A)' : 'Fim do trecho (B)'}
                aria-valuemin={alca === 'inicio' ? 0 : noDecimo(inicioS + PASSO_DO_TRECHO_S)}
                aria-valuemax={alca === 'inicio' ? noDecimo(fimS - PASSO_DO_TRECHO_S) : noDecimo(duracaoS)}
                aria-valuenow={valor}
                aria-valuetext={textoDoInstante(valor)}
                onKeyDown={teclaDaAlca(alca)}
              >
                <span className="lb-trecho__marca" aria-hidden="true">
                  {alca === 'inicio' ? 'A' : 'B'}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {onda.tipo === 'lendo' && <p className="lb-sons__nota">Lendo a duração do som…</p>}
      {onda.tipo === 'sem' && (
        <p className="lb-sons__nota">{ehYoutube ? 'No YouTube, digite os tempos: B vazio toca até o fim do vídeo.' : 'A faixa não abriu (o arquivo não está neste computador). Os tempos ainda podem ser digitados.'}</p>
      )}

      <div className="lb-trecho__tempos">
        <div className="gr-campo">
          <label className="gr-campo__rot" htmlFor={idA}>
            Começo (A)
          </label>
          <input
            id={idA}
            className="gr-entrada lb-trecho__tempo"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={textoA ?? textoDoInstante(inicioS)}
            aria-invalid={erro !== null && textoA !== null}
            aria-describedby={erro !== null ? idErro : undefined}
            onChange={(evento) => setTextoA(evento.currentTarget.value)}
            onBlur={() => confirmarTexto('inicio')}
            onKeyDown={teclaDoCampo('inicio')}
          />
        </div>
        <div className="gr-campo">
          <label className="gr-campo__rot" htmlFor={idB}>
            Fim (B)
          </label>
          <input
            id={idB}
            className="gr-entrada lb-trecho__tempo"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="até o fim"
            value={textoB ?? (fimS === undefined ? '' : textoDoInstante(fimS))}
            aria-invalid={erro !== null && textoB !== null}
            aria-describedby={erro !== null ? idErro : undefined}
            onChange={(evento) => setTextoB(evento.currentTarget.value)}
            onBlur={() => confirmarTexto('fim')}
            onKeyDown={teclaDoCampo('fim')}
          />
        </div>
      </div>
      {erro !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" id={idErro} role="alert">
          {erro}
        </p>
      )}

      <div className="lb-trecho__acoes">
        <Botao tamanho="p" aria-label={`${tocando ? 'Parar' : temTrecho ? 'Ouvir trecho de' : 'Ouvir'} ${efeito.nome}`} onClick={onOuvir}>
          {tocando ? <IconeQuadrado /> : <IconeDoLivro nome="som" />}
          {tocando ? 'Parar' : temTrecho ? 'Ouvir trecho' : 'Ouvir'}
        </Botao>
        <Botao
          tamanho="p"
          disabled={!temTrecho}
          onClick={() => {
            setTextoA(null)
            setTextoB(null)
            setErro(null)
            onMudar(null)
          }}
        >
          Usar o som inteiro
        </Botao>
      </div>
    </fieldset>
  )
}

function IconeQuadrado() {
  return (
    <svg className="gr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 7h10v10H7z" />
    </svg>
  )
}
