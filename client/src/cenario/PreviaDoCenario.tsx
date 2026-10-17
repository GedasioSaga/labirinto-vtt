import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Botao } from '../components/grimorio/Botao'
import { classes, movimentoReduzido } from '../components/grimorio/comum'
import { IconeDoLivro } from '../components/livro/icones'
import { estaCalado, useSomStore } from '../stores/somStore'
import { duracaoDoCenarioS, type CenarioDoPino } from './catalogo'
import { duracaoDoEstiloS, useEstilosDeCenario, type EstiloDeCenario } from './estilosDeCenario'
import { MARGEM, type Retangulo } from './revelacao/layout'
import { RevelacaoDoLocal } from './revelacao/RevelacaoDoLocal'
import { FIM_DA_REVELACAO, faixaDaCamera, faixaDoAmbiente } from './revelacao/tempo'
import './previaDoCenario.css'

interface Tamanho {
  w: number
  h: number
}

/**
 * A revelação mede em px (margens de 16, imagem mínima de 200x150, coluna
 * abaixo de 640 de largura): é desenhada neste tamanho virtual, estreito
 * (imagem em cima, postigo embaixo), e encolhida com `scale()` até a moldura
 * encostar nas margens de 5cqw do palco. Pequeno: ~0,66x; grande: ~1x (as
 * molduras são canvas e não devem ser ampliadas). A altura é folga: o palco
 * fica com a altura do grupo que assentou (`onMedir`), e um texto comprido
 * demais rola dentro do postigo.
 */
const VIRTUAL_PEQUENO: Tamanho = { w: 317, h: 476 }
const VIRTUAL_GRANDE: Tamanho = { w: 572, h: 680 }
/** Medidas do protótipo (consolidado.css, .cena), em fração da largura do palco. */
const MARGEM_DO_PALCO = 0.05
const BASE_DO_PALCO = 0.06
/** A borda inteira da moldura (madeira + aro); no protótipo o aro é sombra por dentro da madeira. */
const molduraNaTela = (largura: number) => Math.max(4, 0.022 * largura)
/** O aro de metal e o filete escuro de 1 px em volta dele. */
const metalNaTela = (largura: number) => Math.max(1.5, 0.0075 * largura) + 1
/** Antes da revelação assentar, o palco guarda o formato do protótipo. */
const PROPORCAO_INICIAL = '210 / 214'

interface Encaixe {
  escala: number
  /** Margens do protótipo, em px da tela. */
  topo: number
  base: number
  /** Bordas do palco (em cima + embaixo). */
  bordas: number
}

/** Escala e margens para a moldura encostar nas margens de 5cqw; põe as espessuras da moldura no virtual. */
function encaixar(palco: HTMLElement, virtual: HTMLElement, larguraVirtual: number): Encaixe | null {
  const largura = palco.offsetWidth
  const dentro = palco.clientWidth
  if (dentro <= 0) return null
  const topo = largura * MARGEM_DO_PALCO
  const escala = (dentro - 2 * topo) / (larguraVirtual - 2 * MARGEM)
  virtual.style.setProperty('--lb-cena-escala', escala.toFixed(4))
  const metal = metalNaTela(largura)
  virtual.style.setProperty('--lb-cena-madeira', `${((molduraNaTela(largura) - metal) / escala).toFixed(2)}px`)
  virtual.style.setProperty('--lb-cena-metal', `${(metal / escala).toFixed(2)}px`)
  return { escala, topo, base: largura * BASE_DO_PALCO, bordas: palco.offsetHeight - palco.clientHeight }
}

const mesmoRetangulo = (a: Retangulo | null, b: Retangulo) => a !== null && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
/** Regra da casa: animação de ambiente no painel acaba em no máximo 5 s. */
export const TETO_DO_PALCO_S = 5
/** Com movimento reduzido tudo chega em fades de até 0,3 s. */
const FIM_REDUZIDO_S = 0.4

/** Quanto a revelação leva até tudo parar: a moldura e o texto (4,6 s) ou a câmera e o ambiente, o que acabar depois. */
export function duracaoDaRevelacaoS(cenario: CenarioDoPino, estilo: EstiloDeCenario | null): number {
  if (estilo !== null) return Math.max(FIM_DA_REVELACAO, duracaoDoEstiloS(cenario, estilo))
  const duracao = duracaoDoCenarioS(cenario)
  return Math.max(FIM_DA_REVELACAO, faixaDaCamera(duracao)[1], faixaDoAmbiente(duracao)[1])
}

const segundos = (s: number) => `${s.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`

export interface PreviaDoCenarioProps {
  imagem: string
  cenario: CenarioDoPino
  /** "Nome do local" e descrição do pino: a prévia é a revelação inteira, como o jogador verá. */
  nome: string
  descricao: string
  /** A janela "Ver grande": maior, toca ao abrir e vai até o fim natural, com o botão de som e sem o "Ver grande". */
  grande?: boolean
  onVerGrande?: () => void
}

/**
 * PRÉVIA VIVA DO CENÁRIO: um pedaço de mapa escurecido com a revelação de
 * verdade dentro (`RevelacaoDoLocal` + `AnimacaoCenario`), em escala. Parada,
 * mostra o último quadro e não gasta nada (sem quadro, sem áudio). "Assistir"
 * toca uma vez com o som da mesa e volta ao último quadro no fim (no palco da
 * ficha, em no máximo 5 s), no "Parar" ou ao sair de vista. Nome, descrição e
 * efeitos mudam a prévia sem tocar de novo; trocar a câmera (ou o estilo) toca.
 */
export function PreviaDoCenario({ imagem, cenario, nome, descricao, grande = false, onVerGrande }: PreviaDoCenarioProps) {
  const palcoRef = useRef<HTMLDivElement>(null)
  const virtualRef = useRef<HTMLDivElement>(null)
  const [tocando, setTocando] = useState(grande)
  const [rodada, setRodada] = useState(0)
  /** O clique no Assistir (`performance.now()`): a coreografia e o fim contam dele, no relógio de parede. */
  const [inicio, setInicio] = useState(() => performance.now())
  const [som, setSom] = useState(true)
  const [encaixe, setEncaixe] = useState<Encaixe | null>(null)
  const [grupo, setGrupo] = useState<Retangulo | null>(null)
  const [reduzir, setReduzir] = useState(movimentoReduzido)
  const volumeDaMesa = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))
  const estilos = useEstilosDeCenario()
  const estilo = cenario.estilo === undefined ? null : (estilos.find((e) => e.id === cenario.estilo) ?? null)
  const duracaoS = duracaoDaRevelacaoS(cenario, estilo)
  const fimEmS = reduzir ? FIM_REDUZIDO_S : grande ? duracaoS : Math.min(TETO_DO_PALCO_S, duracaoS)
  const virtual = grande ? VIRTUAL_GRANDE : VIRTUAL_PEQUENO

  const tocar = () => {
    // A preferência vale na hora de tocar: ligada com a ficha já aberta, o Assistir já sai reduzido.
    setReduzir(movimentoReduzido())
    setInicio(performance.now())
    setTocando(true)
    setRodada((n) => n + 1)
  }
  const parar = () => {
    setTocando(false)
    setRodada((n) => n + 1)
  }

  useLayoutEffect(() => {
    const palco = palcoRef.current
    const caixa = virtualRef.current
    if (palco === null || caixa === null) return
    const medir = () => {
      const novo = encaixar(palco, caixa, virtual.w)
      if (novo !== null) setEncaixe((antes) => (antes !== null && antes.escala === novo.escala && antes.topo === novo.topo && antes.bordas === novo.bordas ? antes : novo))
    }
    medir()
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    observador?.observe(palco)
    return () => observador?.disconnect()
  }, [virtual.w])

  // O teto conta do clique no relógio de parede: um quadro travado (print, página ocupada) não estica a prévia.
  useEffect(() => {
    if (!tocando || (grande && !reduzir)) return
    const restaMs = Math.max(0, fimEmS * 1000 - (performance.now() - inicio))
    const id = window.setTimeout(parar, restaMs)
    return () => window.clearTimeout(id)
  }, [tocando, grande, reduzir, fimEmS, inicio])

  const aoMedir = (novo: Retangulo) => setGrupo((antes) => (mesmoRetangulo(antes, novo) ? antes : novo))

  // Trocar a câmera (ou o estilo) toca a prévia: é o jeito de ver a escolha.
  const camera = `${cenario.estilo ?? ''}|${cenario.movimento}`
  const cameraAntes = useRef(camera)
  useEffect(() => {
    if (cameraAntes.current === camera) return
    cameraAntes.current = camera
    tocar()
  }, [camera])

  // Parada, o resto redesenha o último quadro antes da pintura, sem tocar. Tocando,
  // o nome e os efeitos já mudam na tela; o texto novo entra no último quadro.
  // A escala também: fontes e molduras mudam de tamanho no virtual, que não muda e não avisa a revelação.
  const aoVivo = [nome, descricao, cenario.nevoa, cenario.raios, cenario.particulas, cenario.duracaoS ?? '', encaixe?.escala ?? ''].join('|')
  const aoVivoAntes = useRef(aoVivo)
  useLayoutEffect(() => {
    if (aoVivoAntes.current === aoVivo) return
    aoVivoAntes.current = aoVivo
    if (!tocando) setRodada((n) => n + 1)
  }, [aoVivo, tocando])

  // Fora de vista (rolou a ficha, trocou de marcador, recolheu o livro) não gasta quadro nem som.
  useEffect(() => {
    const palco = palcoRef.current
    if (!tocando || grande || palco === null || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver((entradas) => {
      const ultima = entradas[entradas.length - 1]
      if (ultima !== undefined && !ultima.isIntersecting) parar()
    })
    observador.observe(palco)
    return () => observador.disconnect()
  }, [tocando, grande])

  function alternarSom() {
    setSom((ligado) => !ligado)
    // O estilo do pacote só recebe o volume ao nascer: tocando, recomeça para o botão valer na hora.
    if (estilo !== null && tocando) {
      setInicio(performance.now())
      setRodada((n) => n + 1)
    }
  }

  function verGrande(abrir: () => void) {
    if (tocando) parar()
    abrir()
  }

  // A moldura encosta nas margens do protótipo (5cqw dos lados e em cima, 6cqw embaixo) e o palco tem a altura do grupo.
  const escala = encaixe?.escala ?? 1
  const dx = encaixe === null ? 0 : encaixe.topo - MARGEM * escala
  const dy = encaixe === null || grupo === null ? 0 : encaixe.topo - grupo.y * escala
  const alturaDoPalco = encaixe === null || grupo === null ? null : Math.round(encaixe.topo + grupo.h * escala + encaixe.base + encaixe.bordas)
  // "Som do vento" é da panorâmica: num estilo do pacote ele não muda nada, e a pílula não aparece.
  const vento =
    cenario.som && estilo === null ? (
      <span className="lb-cena__vento" data-tocando={tocando}>
        <svg viewBox="0 0 12 10" aria-hidden="true">
          <path d="M1 3.5h6.5a1.8 1.8 0 1 0-1.8-1.8M1 6.5h8.5a1.8 1.8 0 1 1-1.8 1.8" />
        </svg>
        <span className="lb-cena__barras">
          <i />
          <i />
          <i />
        </span>
        Vento
      </span>
    ) : null

  return (
    <div className={classes('lb-cena', grande && 'lb-cena--grande')}>
      <div
        ref={palcoRef}
        className="lb-cena__palco"
        role="img"
        aria-label="Prévia da animação do cenário"
        style={alturaDoPalco === null ? { aspectRatio: PROPORCAO_INICIAL } : { height: alturaDoPalco }}
      >
        <div key={rodada} className="lb-cena__veu" data-entra={tocando} aria-hidden="true" />
        <div
          ref={virtualRef}
          className="lb-cena__virtual"
          style={{ width: virtual.w, height: virtual.h, transform: `translate(${dx}px, ${dy}px) scale(${escala})` }}
          aria-hidden="true"
          inert
        >
          <RevelacaoDoLocal
            imagem={{ src: imagem, cenario }}
            nome={nome}
            descricao={descricao}
            volume={tocando && (som || !grande) ? volumeDaMesa : 0}
            previa
            parada={!tocando}
            rodada={rodada}
            fimEmS={fimEmS}
            reduzir={reduzir}
            inicioMs={inicio}
            onFim={parar}
            onMedir={aoMedir}
            sobreAImagem={vento}
          />
        </div>
      </div>
      <div className="lb-cena__acoes">
        <Botao variante="latao" tamanho="p" onClick={tocando ? parar : tocar}>
          <IconeDoLivro nome={tocando ? 'pausa' : 'play'} />
          {tocando ? 'Parar' : 'Assistir'}
        </Botao>
        {grande ? (
          <Botao variante="fantasma" tamanho="p" soIcone aria-label="Som" aria-pressed={som} onClick={alternarSom}>
            <IconeDoLivro nome="som" />
          </Botao>
        ) : (
          onVerGrande !== undefined && (
            <Botao variante="fantasma" tamanho="p" onClick={() => verGrande(onVerGrande)}>
              Ver grande
            </Botao>
          )
        )}
        <span className="lb-cena__dur">{segundos(duracaoS)}</span>
      </div>
    </div>
  )
}
