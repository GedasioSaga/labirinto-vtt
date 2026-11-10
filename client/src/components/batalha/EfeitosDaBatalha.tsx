import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { EfeitoDaBatalha, NumeroDaForma, SaidaDaReacao } from '../../lib/batalha/combate'
import { saidasPossiveis } from '../../lib/batalha/reacao'
import { ehRefDeMidia, type ResolverDeImagem } from '../../lib/midia'
import { somDoImpacto, tocarSomDoCombate } from '../../lib/sons/sonsDoCombate'
import { trazerFichaDaVez } from '../../pixi/cameraDaBatalha'
import { levantarFicha, levantarTodas, recuarFicha, tombarFicha } from '../../pixi/impactoNasFichas'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { anuncioDoEfeito, formatarNumero, movimentoReduzido, palavraDoDano, TEXTO_DA_SAIDA } from './dadosDoMenu'
import type { ConsultaDaFicha } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * OS EFEITOS DA BATALHA sobre o mapa (o `.efeitos` do protótipo aprovado),
 * nas duas telas: toca a fila (`seq`, e a troca de vez) um depois do outro,
 * cada um só depois do anterior acabar — a faixa da vez (SUA VEZ para quem
 * joga, "Vez de Vera" para os outros e o mestre), o corte do golpe (retrato
 * do atacante e o nome da técnica), o risco no alvo, o d20 junto ao alvo
 * (160 ms entra, 8 números em 380 ms, pousa em 200 ms), o número do dano
 * (bate em 260 ms até 116%, fica 520 ms, sobe e some em 240 ms; "ESQUIVOU",
 * "CONTRA-ATAQUE", "CRÍTICO") e o tremor de 220 ms (`onTremor`: quem monta
 * mexe no invólucro do mapa).
 *
 * O corte e a faixa são o PALCO (pedido de 30/10: "passa rápido demais para
 * alguém ver"): entram em 220 ms, SEGURAM 1,2 s legíveis e saem em 260 ms;
 * enquanto passam, a camada sobe por cima de tudo. D3 (decisão 4, 10/11): só
 * os primeiros 300 ms escondem o menu da vez (`onPalco`); depois ele volta por
 * baixo e já aceita comando. A camada nunca pega o clique: o clique pula e
 * age. A faixa da vez seguinte do mesmo dono é curta (220 + 350 + 180 ms).
 *
 * Começa no `seq` de agora (sem reprise do que já passou). Clique, Enter,
 * Espaço ou Esc pulam o que está tocando (no palco a tecla é só do pulo; no
 * campo de texto ela é do texto). Movimento reduzido: só aparece e some, sem
 * deslizar, tremor nem risco, segurando o mesmo tempo. Só transform, opacity
 * e clip-path.
 *
 * A posição da ficha vem da consulta da S4 (px da janela), lida no começo de
 * cada efeito; ficha fora da tela não ganha d20 nem número.
 *
 * F3 (fatia T): a TRANSFORMAÇÃO, porte do `efeitoTransformacao` do protótipo
 * aprovado (cerca de 2,2 s, também palco): o palco roxo, os raios girando, dois
 * anéis estourando, o retrato (a imagem da forma, senão a da ficha), o clarão
 * curto, o nome da forma batendo no centro e os números subindo (só para o
 * dono e os aliados: sem `numeros`, só o nome). A forma desfeita e o selo que
 * acabou são um texto curto sobre a ficha (220/650/200 ms).
 */

export interface EfeitosDaBatalhaProps {
  efeitos: readonly EfeitoDaBatalha[]
  consulta: ConsultaDaFicha | null
  nomeDe: (tokenId: string) => string
  /** A foto pequena da ficha (o retrato do corte); `null` = iniciais. */
  imagemDe: (tokenId: string) => string | null
  /**
   * A faixa da troca de vez: uma chave nova (carta e rodada) toca a faixa —
   * SUA VEZ com `minha`, senão "Vez de <nome>". `null` = sem vez à vista.
   */
  vez?: {
    chave: string
    nome: string
    minha: boolean
    tokenId?: string
    /**
     * D3: quem joga esta vez (o id do jogador, ou 'mestre' para os NPC). Duas
     * vezes seguidas do mesmo dono tocam a faixa curta (220 + 350 + 180 ms).
     * Ausente = só a SUA VEZ seguida de outra SUA VEZ conta como o mesmo dono.
     */
    dono?: string | null
  } | null
  onTremor?: () => void
  /** O palco mudou: quem monta esconde o menu da vez (e o véu) enquanto não é `null`. */
  onPalco?: (palco: PalcoDosEfeitos) => void
  className?: string
  /**
   * D4: a vida da ficha (já com o dano), para o impacto do tamanho do golpe e
   * a queda. Ausente ou `null` = o tremor do meio (7 px) e sem tombo.
   */
  vidaDe?: (tokenId: string) => { atual: number; maximo: number } | null
  /**
   * D7: a câmera traz a ficha da vez para a vista (só fora da tela ou na
   * borda, sem zoom). Ausente = a escolha guardada neste computador
   * (`cameraDaBatalhaLigada`, ligada por padrão); `false` = nunca.
   */
  cameraSegue?: boolean
}

/**
 * O que ocupa o palco: o corte de um golpe, a transformação, a faixa da vez
 * de outro, ou a SUA VEZ (tocando ou ainda na fila: o menu novo da vez entra
 * depois dela).
 */
export type PalcoDosEfeitos = 'golpe' | 'transformacao' | 'vez' | 'suaVez' | null

type Tarefa = { tipo: 'efeito'; efeito: EfeitoDaBatalha } | { tipo: 'vez'; nome: string; minha: boolean; tokenId: string | null; curta: boolean }

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'
const PUNCH = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
/** A chegada do retrato e do nome no corte (a do protótipo). */
const CHEGADA = 'cubic-bezier(0.2, 0.9, 0.3, 1)'
/** O palco (corte e faixa da vez): entra, SEGURA legível e sai. Movimento reduzido segura o mesmo tempo. */
const ENTRA_MS = 220
const SEGURA_MS = 1200
const SAI_MS = 260
interface TemposDoPalco {
  entra: number
  segura: number
  sai: number
}
const TEMPOS_DO_PALCO: TemposDoPalco = { entra: ENTRA_MS, segura: SEGURA_MS, sai: SAI_MS }
/** D3: a faixa "Vez de" quando a mesma pessoa joga a vez seguinte: um aceno, não a apresentação inteira. */
const TEMPOS_DA_VEZ_SEGUIDA: TemposDoPalco = { entra: 220, segura: 350, sai: 180 }
/**
 * D3 (decisão 4 do plano de 10/11): o palco segura a duração inteira, mas só
 * BLOQUEIA os primeiros 300 ms (o tempo de ler que algo começou). Depois o
 * menu da vez volta (entra por baixo do corte, que segue por cima sem pegar
 * o clique) e já aceita comando; o clique e o Enter que pulam também agem.
 */
const BLOQUEIO_MS = 300
const TECLAS_QUE_PULAM = new Set(['Enter', ' ', 'Escape'])
/** O texto curto sobre a ficha (forma desfeita, selo que acabou): entra, segura e sai. */
const AVISO_ENTRA_MS = 220
const AVISO_SEGURA_MS = 650
const AVISO_SAI_MS = 200

/** A tecla no campo de texto (chat, modificador) é do texto: não pula nem é engolida. */
function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT'
}

/** O palco da tarefa que toca: só o corte do golpe e a faixa da vez. */
function palcoDa(tarefa: Tarefa | null): PalcoDosEfeitos {
  if (tarefa === null) return null
  if (tarefa.tipo === 'vez') return tarefa.minha ? 'suaVez' : 'vez'
  if (tarefa.efeito.tipo === 'transformacao') return 'transformacao'
  return tarefa.efeito.tipo === 'golpe' ? 'golpe' : null
}

/**
 * O `src` de uma imagem da mesa: a referência `midia:` passa pelo resolvedor
 * da tela (o jogador na sala, o mestre pela ponte de arquivos); sem base
 * conhecida, fica `null` (iniciais). A embutida e o resto passam como vieram.
 */
function srcDaImagem(resolver: ResolverDeImagem, valor: string | null): string | null {
  if (valor === null || valor === '') return null
  return ehRefDeMidia(valor) ? resolver(valor) : (resolver(valor) ?? valor)
}

function maiorSeq(efeitos: readonly EfeitoDaBatalha[]): number {
  let maior = -1
  for (const efeito of efeitos) if (efeito.seq > maior) maior = efeito.seq
  return maior
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

/** O motor da fila: anima com WAAPI, espera com timers, e `pular` termina tudo de uma vez. */
class Palco {
  private vivas = new Set<Animation>()
  private sonos = new Set<() => void>()
  pulando = false

  constructor(readonly camada: HTMLElement) {}

  animar(el: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions): Promise<void> {
    const animacao = el.animate(quadros, { fill: 'both', ...opcoes })
    this.vivas.add(animacao)
    if (this.pulando) animacao.finish()
    return animacao.finished.then(
      () => {
        this.vivas.delete(animacao)
      },
      () => {
        this.vivas.delete(animacao)
      },
    )
  }

  esperar(ms: number): Promise<void> {
    if (this.pulando) return Promise.resolve()
    return new Promise((resolver) => {
      const fim = () => {
        window.clearTimeout(prazo)
        this.sonos.delete(fim)
        resolver()
      }
      const prazo = window.setTimeout(fim, ms)
      this.sonos.add(fim)
    })
  }

  pular() {
    this.pulando = true
    for (const animacao of this.vivas) {
      try {
        animacao.finish()
      } catch {
        // animação já saiu
      }
    }
    for (const fim of [...this.sonos]) fim()
  }

  parar() {
    this.pular()
    for (const animacao of this.vivas) animacao.cancel()
    this.camada.replaceChildren()
  }

  criar(classe: string): HTMLElement {
    const el = document.createElement('div')
    el.className = classe
    this.camada.appendChild(el)
    return el
  }

  /** A ficha na camada (a consulta dá px da janela). */
  posicao(consulta: ConsultaDaFicha | null, tokenId: string): { x: number; y: number; raio: number } | null {
    const lido = consulta?.(tokenId) ?? null
    if (lido === null) return null
    const caixa = this.camada.getBoundingClientRect()
    return { x: lido.x - caixa.left, y: lido.y - caixa.top, raio: lido.raio }
  }
}

function texto(pai: HTMLElement, classe: string, conteudo: string, tag: 'span' | 'small' = 'span'): HTMLElement {
  const el = document.createElement(tag)
  el.className = classe
  el.textContent = conteudo
  pai.appendChild(el)
  return el
}

export function EfeitosDaBatalha({ efeitos, consulta, nomeDe, imagemDe, vez, onTremor, onPalco, className, vidaDe, cameraSegue }: EfeitosDaBatalhaProps) {
  const camada = useRef<HTMLDivElement>(null)
  const palco = useRef<Palco | null>(null)
  const fila = useRef<Tarefa[]>([])
  const tocando = useRef(false)
  const tarefaAtual = useRef<Tarefa | null>(null)
  const palcoAvisado = useRef<PalcoDosEfeitos>(null)
  const ultimoSeq = useRef<number | null>(null)
  const ultimaVez = useRef<string | null | undefined>(undefined)
  /** D3: o dono da última faixa de vez (a seguinte do mesmo dono é curta). */
  const ultimoDono = useRef<string | null>(null)
  /** D3: passados os 300 ms do palco que toca, ele segue à vista mas não bloqueia mais. */
  const liberado = useRef(false)
  const [anuncio, setAnuncio] = useState('')
  const resolver = useImagemDaMesa()
  // As props mudam a cada render; o motor lê sempre as de agora.
  const atuais = useRef({ consulta, nomeDe, imagemDe, onTremor, onPalco, resolver, vidaDe, cameraSegue })
  atuais.current = { consulta, nomeDe, imagemDe, onTremor, onPalco, resolver, vidaDe, cameraSegue }
  /** D4: quem bateu por último (o recuo do alvo vai para longe dele). */
  const ultimoAtacante = useRef<string | null>(null)

  /**
   * O palco de agora: o corte e a faixa sobem a camada por cima de tudo e pegam
   * o clique (que só pula); o d20 e o número deixam o mapa livre. A SUA VEZ
   * ainda na fila já conta, para o menu novo da vez entrar só depois dela.
   */
  const avisarPalco = () => {
    const tocandoAgora = palcoDa(tarefaAtual.current)
    const raiz = camada.current
    if (raiz !== null) {
      // O palco segue POR CIMA a duração inteira (o z da camada), mas nunca pega o clique (CSS): ele passa e age.
      if (tocandoAgora === null) delete raiz.dataset.pulavel
      else raiz.dataset.pulavel = 'sim'
    }
    const suaVezNaFila = fila.current.some((tarefa) => tarefa.tipo === 'vez' && tarefa.minha)
    // D3: liberado, o palco não esconde mais o menu: o da vez nova entra por baixo da faixa e já aceita comando.
    const agora: PalcoDosEfeitos = suaVezNaFila ? 'suaVez' : liberado.current ? null : tocandoAgora
    if (agora === palcoAvisado.current) return
    palcoAvisado.current = agora
    atuais.current.onPalco?.(agora)
  }

  useEffect(() => {
    const raiz = camada.current
    if (raiz === null) return
    const novo = new Palco(raiz)
    palco.current = novo
    return () => {
      novo.parar()
      palco.current = null
      fila.current = []
      tocando.current = false
    }
  }, [])

  const tocarFila = () => {
    const motor = palco.current
    if (motor === null || tocando.current) return
    tocando.current = true
    const pular = () => motor.pular()
    const teclar = (evento: KeyboardEvent) => {
      if (!TECLAS_QUE_PULAM.has(evento.key) || emCampoDeTexto(evento.target)) return
      // D3: nos 300 ms em que o palco bloqueia, a tecla é só do pulo (o menu ainda está escondido: não age às
      // cegas). Depois, o Enter e o Espaço pulam E agem no menu que já voltou; o Esc só pula (não recolhe o menu).
      const noPalco = palcoDa(tarefaAtual.current) !== null
      if (noPalco && (!liberado.current || evento.key === 'Escape')) {
        evento.preventDefault()
        evento.stopPropagation()
      }
      pular()
    }
    window.addEventListener('keydown', teclar, true)
    // O clique pula e segue para o que está embaixo (a camada nunca o pega): pula e age.
    window.addEventListener('pointerdown', pular, { capture: true, passive: true })
    let prazoDoBloqueio = 0
    void (async () => {
      try {
        // Um de cada vez: o próximo só começa quando o anterior acabou (ou foi pulado).
        while (fila.current.length > 0 && palco.current === motor) {
          const tarefa = fila.current.shift() as Tarefa
          motor.pulando = false
          tarefaAtual.current = tarefa
          liberado.current = false
          avisarPalco()
          window.clearTimeout(prazoDoBloqueio)
          if (palcoDa(tarefa) !== null)
            prazoDoBloqueio = window.setTimeout(() => {
              if (tarefaAtual.current !== tarefa) return
              liberado.current = true
              avisarPalco()
            }, BLOQUEIO_MS)
          if (tarefa.tipo === 'efeito') setAnuncio(anuncioDoEfeito(tarefa.efeito, atuais.current.nomeDe))
          await tocar(motor, tarefa)
        }
      } finally {
        window.clearTimeout(prazoDoBloqueio)
        liberado.current = false
        window.removeEventListener('keydown', teclar, true)
        window.removeEventListener('pointerdown', pular, true)
        tocando.current = false
        tarefaAtual.current = null
        avisarPalco()
      }
    })()
  }

  const tocar = async (motor: Palco, tarefa: Tarefa) => {
    const reduzido = movimentoReduzido()
    const { consulta: consultar, nomeDe: nome, imagemDe: imagem, onTremor: tremer, resolver: resolverImagem, vidaDe: vidaDaFicha, cameraSegue: cameraLigada } = atuais.current
    if (tarefa.tipo === 'vez') {
      if (tarefa.tokenId !== null) {
        // D4: quem tem a vez está de pé. D7: a ficha da vez fora da tela ou na borda vem para a vista (decisão 6).
        levantarFicha(tarefa.tokenId)
        if (cameraLigada !== false) trazerFichaDaVez(tarefa.tokenId)
      }
      // D5: os sons tocam no mesmo quadro do efeito.
      if (tarefa.minha) tocarSomDoCombate('suaVez')
      // C9: a foto de quem tem a vez no círculo da faixa (a forma ligada vence, como no corte).
      const foto = tarefa.tokenId === null ? null : srcDaImagem(resolverImagem, imagem(tarefa.tokenId))
      return tocarFaixa(motor, tarefa.nome, tarefa.tokenId === null ? undefined : foto, tarefa.minha, reduzido, tarefa.curta ? TEMPOS_DA_VEZ_SEGUIDA : TEMPOS_DO_PALCO)
    }
    const efeito = tarefa.efeito
    // F3: o gesto do Judge toca no mapa (`pixi/judgeDoMapa.ts`); aqui só o anúncio da região viva.
    if (efeito.tipo === 'judge') return
    if (efeito.tipo === 'transformacao') {
      const retrato = srcDaImagem(resolverImagem, efeito.imagem) ?? srcDaImagem(resolverImagem, imagem(efeito.tokenId))
      return tocarTransformacao(motor, nome(efeito.tokenId), retrato, efeito.forma, efeito.numeros ?? [], reduzido)
    }
    if (efeito.tipo === 'golpe') {
      ultimoAtacante.current = efeito.atacanteTokenId
      tocarSomDoCombate('corte')
      const retrato = srcDaImagem(resolverImagem, imagem(efeito.atacanteTokenId))
      await tocarCorte(motor, nome(efeito.atacanteTokenId), retrato, efeito.nome, efeito.surpresa ? 'Surpresa' : efeito.overload ? 'Overload' : null, reduzido)
      if (!reduzido) await Promise.all(efeito.alvos.map((tokenId) => tocarRisco(motor, motor.posicao(consultar, tokenId))))
      return
    }
    const onde = motor.posicao(consultar, efeito.tokenId)
    if (onde === null) return
    // F3: a forma desfeita e o selo que acabou: o texto curto sobre a ficha.
    if (efeito.tipo === 'forma') return tocarAviso(motor, onde, `${efeito.forma} desfeito`, 'forma', reduzido)
    if (efeito.tipo === 'selo') return tocarAviso(motor, onde, `${efeito.nome} acabou`, 'selo', reduzido)
    if (efeito.tipo === 'reacao') tocarSomDoCombate('dado')
    if (efeito.tipo === 'reacao') return tocarDado(motor, onde, efeito.d20, efeito.modificador, efeito.total, reduzido)
    if (efeito.valor > 0) {
      // D4: o impacto do tamanho do golpe. Tremor de 3, 7 ou 12 px; a ficha pisca (~90 ms) e recua ~10 px para longe
      // de quem bateu (volta em ~180 ms); a que caiu tomba 12° em 320 ms e fica esmaecida.
      const vida = vidaDaFicha?.(efeito.tokenId) ?? null
      forcaDoTremor = forcaDoTremorPeloDano(vida !== null && vida.maximo > 0 ? efeito.valor / vida.maximo : null)
      if (!reduzido) tremer?.()
      tocarSomDoCombate(somDoImpacto(forcaDoTremor))
      const deQuem = ultimoAtacante.current === null ? null : motor.posicao(consultar, ultimoAtacante.current)
      void piscarFicha(motor, onde, reduzido)
      recuarFicha(efeito.tokenId, deQuem === null ? null : { x: onde.x - deQuem.x, y: onde.y - deQuem.y }, reduzido)
      if (vida !== null && vida.atual <= 0) tombarFicha(efeito.tokenId, reduzido)
    }
    return tocarNumero(motor, onde, efeito.valor, efeito.saida, reduzido)
  }

  // Os efeitos novos entram na fila; a lista vazia (batalha acabou) zera o seq.
  useEffect(() => {
    if (efeitos.length === 0) {
      ultimoSeq.current = -1
      // D4: sem batalha, ninguém fica tombado no mapa.
      levantarTodas()
      return
    }
    if (ultimoSeq.current === null) {
      ultimoSeq.current = maiorSeq(efeitos)
      return
    }
    const desde = ultimoSeq.current
    const novos = efeitos.filter((efeito) => efeito.seq > desde).sort((a, b) => a.seq - b.seq)
    if (novos.length === 0) return
    ultimoSeq.current = novos[novos.length - 1]?.seq ?? desde
    for (const efeito of novos) fila.current.push({ tipo: 'efeito', efeito })
    tocarFila()
    // `tocarFila` lê tudo por ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efeitos])

  // A troca de vez: só quando a vez MUDA (a que já era ao montar não toca). Entra
  // no fim da fila, depois do golpe que ainda passa. Antes da pintura, para o
  // menu da vez nova não piscar na tela antes da faixa SUA VEZ.
  const chaveDaVez = vez?.chave ?? null
  useLayoutEffect(() => {
    const antes = ultimaVez.current
    ultimaVez.current = chaveDaVez
    if (antes === undefined || chaveDaVez === null || chaveDaVez === antes || vez === undefined || vez === null) return
    const minha = vez.minha
    const nome = vez.nome.trim()
    // D3: o mesmo dono jogando a vez seguinte (dois personagens do jogador, dois NPC do mestre): a faixa curta.
    const dono = vez.dono ?? (minha ? 'eu' : null)
    const curta = dono !== null && dono === ultimoDono.current
    ultimoDono.current = dono
    // A vez de outro sem nome à vista não tem o que dizer.
    if (!minha && nome === '') return
    fila.current.push({ tipo: 'vez', nome, minha, tokenId: vez.tokenId ?? null, curta })
    if (tocando.current) avisarPalco()
    else tocarFila()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaVez])

  return (
    <div ref={camada} className={className === undefined ? 'bt-efeitos' : `bt-efeitos ${className}`} aria-hidden="false">
      <span className="bt-sr" aria-live="polite">
        {anuncio}
      </span>
    </div>
  )
}

/** Aparece, segura e some só com opacity (movimento reduzido): o mesmo tempo de leitura, sem deslizar. */
async function tocarSoOpacidade(motor: Palco, el: HTMLElement, tempos: TemposDoPalco = TEMPOS_DO_PALCO) {
  await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: tempos.entra, easing: EASE })
  await motor.esperar(tempos.segura)
  await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: tempos.sai, easing: EASE })
  el.remove()
}

/**
 * A foto redonda (corte, faixa): a imagem cobrindo o círculo, ou as iniciais em
 * tinta. A imagem que não carrega (arquivo sumido) também vira as iniciais, em
 * vez de um círculo vazio.
 */
function fotoRedonda(pai: HTMLElement, classe: string, imagem: string | null, nome: string): HTMLElement {
  const roda = document.createElement('div')
  roda.className = classe
  const comIniciais = () => {
    roda.replaceChildren()
    roda.dataset.iniciais = 'sim'
    roda.textContent = iniciais(nome)
  }
  if (imagem !== null) {
    const foto = document.createElement('img')
    foto.alt = ''
    foto.addEventListener('error', comIniciais, { once: true })
    foto.src = imagem
    roda.appendChild(foto)
  } else {
    comIniciais()
  }
  pai.appendChild(roda)
  return roda
}

/**
 * A faixa da troca de vez: SUA VEZ (e o nome da carta) para quem joga; "Vez de" e o nome para os outros.
 * C9 (lote de 01/11): a foto de quem tem a vez num círculo à esquerda; `imagem` undefined = sem ficha à vista (sem o círculo).
 */
async function tocarFaixa(motor: Palco, nome: string, imagem: string | null | undefined, minha: boolean, reduzido: boolean, tempos: TemposDoPalco = TEMPOS_DO_PALCO) {
  const { entra: ENTRA_MS, segura: SEGURA_MS, sai: SAI_MS } = tempos
  const el = motor.criar('bt-ef-faixa')
  el.dataset.de = minha ? 'mim' : 'outro'
  const roda = imagem === undefined ? null : fotoRedonda(el, 'bt-ef-faixa__foto', imagem, nome)
  let grande: HTMLElement
  if (minha) {
    grande = texto(el, 'bt-ef-faixa__grande', 'SUA VEZ')
    if (nome !== '') texto(el, 'bt-ef-faixa__sub', nome)
  } else {
    texto(el, 'bt-ef-faixa__sub', 'Vez de')
    grande = texto(el, 'bt-ef-faixa__grande', nome)
  }
  if (reduzido) return tocarSoOpacidade(motor, el, tempos)
  // A foto chega um passo antes do título e deriva junto com ele (o mesmo sentido, menos distância).
  if (roda !== null) {
    void motor.animar(
      roda,
      [
        { transform: 'translateX(-24%)', easing: CHEGADA },
        { transform: 'translateX(0)', offset: 0.22, easing: 'linear' },
        { transform: 'translateX(2%)' },
      ],
      { duration: ENTRA_MS + SEGURA_MS },
    )
  }
  // O título chega junto com a abertura e segue derivando devagar enquanto a faixa segura.
  void motor.animar(
    grande,
    [
      { transform: 'translateX(-14%) skewX(-12deg)', opacity: 0, easing: EASE },
      { transform: 'translateX(0) skewX(0)', opacity: 1, offset: 0.22, easing: 'linear' },
      { transform: 'translateX(2%) skewX(0)', opacity: 1 },
    ],
    { duration: ENTRA_MS + SEGURA_MS, delay: 60 },
  )
  // A abertura corta com folga em cima e embaixo: a foto que vaza da faixa e as linhas de sangue abrem junto, sem pular no fim.
  await motor.animar(el, [{ clipPath: 'inset(-40% 100% -40% 0)' }, { clipPath: 'inset(-40% 0 -40% 0)' }], { duration: ENTRA_MS, easing: EASE })
  await motor.esperar(SEGURA_MS)
  await motor.animar(el, [{ transform: 'rotate(-6deg) translateX(0)', opacity: 1 }, { transform: 'rotate(-6deg) translateX(18%)', opacity: 0 }], { duration: SAI_MS, easing: EASE })
  el.remove()
}

async function tocarCorte(motor: Palco, quem: string, imagem: string | null, golpe: string, marca: string | null, reduzido: boolean) {
  const el = motor.criar('bt-ef-corte')
  const retrato = fotoRedonda(el, 'bt-ef-corte__retrato', imagem, quem)
  const caixa = document.createElement('div')
  caixa.className = 'bt-ef-corte__texto'
  el.appendChild(caixa)
  texto(caixa, 'bt-ef-corte__quem', marca === null ? quem : `${quem} · ${marca}`)
  const nome = texto(caixa, 'bt-ef-corte__nome', golpe)
  if (reduzido) return tocarSoOpacidade(motor, el)
  // O retrato e o nome chegam (~600 ms) e seguem derivando devagar enquanto o corte segura legível.
  const vida = ENTRA_MS + SEGURA_MS
  void motor.animar(
    retrato,
    [
      { transform: 'translateX(-30%)', easing: CHEGADA },
      { transform: 'translateX(3%)', offset: 0.42, easing: 'linear' },
      { transform: 'translateX(6%)' },
    ],
    { duration: vida },
  )
  void motor.animar(
    nome,
    [
      { transform: 'translateX(30%)', opacity: 0, easing: CHEGADA },
      { transform: 'translateX(-1%)', opacity: 1, offset: 0.4, easing: 'linear' },
      { transform: 'translateX(-4%)', opacity: 1 },
    ],
    { duration: vida, delay: 40 },
  )
  await motor.animar(el, [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: ENTRA_MS, easing: EASE })
  await motor.esperar(SEGURA_MS)
  await motor.animar(el, [{ transform: 'rotate(-7deg) translateX(0)', opacity: 1 }, { transform: 'rotate(-7deg) translateX(-12%)', opacity: 0 }], { duration: SAI_MS, easing: EASE })
  el.remove()
}

async function tocarRisco(motor: Palco, onde: { x: number; y: number } | null) {
  if (onde === null) return
  const el = motor.criar('bt-ef-risco')
  el.style.transform = `translate(${onde.x}px, ${onde.y}px) rotate(-32deg)`
  await motor.animar(
    el,
    [
      { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
      { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.55 },
      { clipPath: 'inset(0 0 0 100%)', opacity: 0.6 },
    ],
    { duration: 200, easing: EASE },
  )
  el.remove()
}

async function tocarDado(motor: Palco, onde: { x: number; y: number; raio: number }, d20: number, modificador: number, total: number, reduzido: boolean) {
  const el = motor.criar('bt-ef-selo')
  const base = `translate(${onde.x + onde.raio + 10}px, ${onde.y}px)`
  el.style.transform = `${base} translateY(-62%)`
  const dado = texto(el, 'bt-dado', '?', 'span')
  const rotulo = texto(el, 'bt-dado-rotulo', 'Reação')
  const saida = saidasPossiveis(d20, total)[0] ?? 'cheio'
  const pousar = () => {
    dado.textContent = String(d20)
    dado.dataset.s = saida
    rotulo.textContent = modificador === 0 ? TEXTO_DA_SAIDA[saida].selo : `${d20} ${modificador > 0 ? '+' : '−'} ${Math.abs(modificador)} = ${total} · ${TEXTO_DA_SAIDA[saida].selo}`
  }
  if (reduzido) {
    pousar()
    await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: EASE })
    await motor.esperar(650)
  } else {
    void motor.animar(el, [{ opacity: 0, transform: `${base} translate(-12px, -62%)` }, { opacity: 1, transform: `${base} translate(0, -62%)` }], { duration: 160, easing: EASE })
    const giro = motor.animar(dado, [{ transform: 'rotate(0)' }, { transform: 'rotate(-360deg)' }], { duration: 380, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' })
    for (let passo = 0; passo < 8 && !motor.pulando; passo += 1) {
      dado.textContent = String(1 + Math.floor(Math.random() * 20))
      await motor.esperar(48)
    }
    await giro
    pousar()
    await motor.animar(dado, [{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 200, easing: PUNCH })
    await motor.esperar(360)
  }
  void motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 500, easing: EASE, fill: 'forwards' }).then(() => el.remove())
}

async function tocarNumero(motor: Palco, onde: { x: number; y: number; raio: number }, valor: number, saida: SaidaDaReacao | 'direto', reduzido: boolean) {
  const el = motor.criar('bt-ef-numero')
  const palavra = palavraDoDano(saida)
  if (palavra !== null) texto(el, '', palavra, 'small')
  el.appendChild(document.createTextNode(formatarNumero(valor)))
  el.dataset.tipo = valor === 0 ? 'zero' : saida === 'critico' ? 'critico' : 'dano'
  // Acima da ficha, para o clarão e o recuo dela continuarem à vista.
  const base = `translate(${onde.x}px, ${onde.y - onde.raio - 14}px) translate(-50%, -100%)`
  el.style.transform = base
  if (reduzido) {
    await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: EASE })
    await motor.esperar(620)
    await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE })
    el.remove()
    return
  }
  await motor.animar(
    el,
    [
      { transform: `${base} scale(0.5)`, opacity: 0 },
      { transform: `${base} scale(1.16)`, opacity: 1, offset: 0.4 },
      { transform: `${base} scale(1)`, opacity: 1 },
    ],
    { duration: 260, easing: EASE },
  )
  await motor.esperar(520)
  await motor.animar(el, [{ transform: base, opacity: 1 }, { transform: `${base} translateY(-22px)`, opacity: 0 }], { duration: 240, easing: EASE })
  el.remove()
}

/** D4: a ficha atingida pisca: um clarão de papel sobre o disco, acende em ~25 ms e apaga até os 90 ms (só opacity). */
const CLARAO_MS = 90
async function piscarFicha(motor: Palco, onde: { x: number; y: number; raio: number }, reduzido: boolean) {
  const el = motor.criar('bt-ef-clarao')
  const diametro = Math.max(24, onde.raio * 2.4)
  el.style.width = `${diametro}px`
  el.style.height = `${diametro}px`
  el.style.transform = `translate(${onde.x - diametro / 2}px, ${onde.y - diametro / 2}px)`
  await motor.animar(el, [{ opacity: 0 }, { opacity: reduzido ? 0.5 : 0.9, offset: 0.28 }, { opacity: 0 }], { duration: CLARAO_MS, easing: 'linear' })
  el.remove()
}

function filho(pai: HTMLElement, classe: string): HTMLElement {
  const el = document.createElement('div')
  el.className = classe
  pai.appendChild(el)
  return el
}

/** Os números da forma sobem do "de" ao "para" (ease-out cúbico). Pulado ou aba escondida: vão direto ao fim. */
function contarNumeros(motor: Palco, alvos: readonly { el: HTMLElement; de: number; para: number }[], ms: number): Promise<void> {
  return new Promise((resolver) => {
    const inicio = performance.now()
    let feito = false
    const fim = () => {
      if (feito) return
      feito = true
      for (const alvo of alvos) alvo.el.textContent = formatarNumero(alvo.para)
      resolver()
    }
    const passo = () => {
      if (feito) return
      const p = motor.pulando ? 1 : Math.min(1, (performance.now() - inicio) / ms)
      const q = 1 - Math.pow(1 - p, 3)
      for (const alvo of alvos) alvo.el.textContent = formatarNumero(Math.round(alvo.de + (alvo.para - alvo.de) * q))
      if (p < 1) window.requestAnimationFrame(passo)
      else fim()
    }
    window.requestAnimationFrame(passo)
    // O quadro pode não vir (aba escondida): o relógio garante o fim.
    void motor.esperar(ms + 60).then(fim)
  })
}

/**
 * A TRANSFORMAÇÃO (porte do `efeitoTransformacao` do protótipo): o palco roxo
 * entra em 160 ms, os raios giram 1,5 s, dois anéis estouram de 0,35 a 2,8 em
 * 620 ms (aos 120 e 230 ms), o retrato sobe em 340 ms, o clarão de 300 ms aos
 * 300 ms, o rótulo aos 380 ms, o nome bate de 1,6 a 1 aos 420 ms, as linhas
 * dos números aos 760 ms (+60 ms cada), contam em 420 ms, seguram 700 ms e
 * tudo sai em 220 ms. Movimento reduzido: aparece, números já no fim, some.
 */
async function tocarTransformacao(motor: Palco, quem: string, imagem: string | null, forma: string, numeros: readonly NumeroDaForma[], reduzido: boolean) {
  const el = motor.criar('bt-ef-transformacao')
  const fundo = filho(el, 'bt-ef-transformacao__fundo')
  const raios = filho(el, 'bt-ef-transformacao__raios')
  const aneis = [filho(el, 'bt-ef-transformacao__anel'), filho(el, 'bt-ef-transformacao__anel')]
  const retrato = filho(el, 'bt-ef-transformacao__retrato')
  const comIniciais = () => {
    retrato.replaceChildren()
    texto(retrato, 'bt-ef-transformacao__iniciais', iniciais(quem))
  }
  if (imagem !== null) {
    const foto = document.createElement('img')
    foto.alt = ''
    foto.addEventListener('error', comIniciais, { once: true })
    foto.src = imagem
    retrato.appendChild(foto)
  } else {
    comIniciais()
  }
  const caixa = filho(el, 'bt-ef-transformacao__texto')
  const rotulo = texto(caixa, 'bt-ef-transformacao__rot', `${quem} · Transformação`)
  const nome = texto(caixa, 'bt-ef-transformacao__nome', forma)
  const linhas: HTMLElement[] = []
  const contas: { el: HTMLElement; de: number; para: number }[] = []
  if (numeros.length > 0) {
    const lista = filho(caixa, 'bt-ef-transformacao__numeros')
    for (const numero of numeros) {
      const linha = filho(lista, '')
      texto(linha, '', numero.rotulo)
      linha.appendChild(document.createTextNode(`${formatarNumero(numero.de)} → `))
      const valor = document.createElement('b')
      valor.textContent = formatarNumero(numero.de)
      linha.appendChild(valor)
      if (numero.nota !== undefined && numero.nota !== '') texto(linha, '', numero.nota, 'small')
      linhas.push(linha)
      contas.push({ el: valor, de: numero.de, para: numero.para })
    }
  }
  const clarao = filho(el, 'bt-ef-transformacao__clarao')

  if (reduzido) {
    for (const conta of contas) conta.el.textContent = formatarNumero(conta.para)
    await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE })
    await motor.esperar(1100)
    await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: EASE })
    el.remove()
    return
  }

  void motor.animar(fundo, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE })
  void motor.animar(
    raios,
    [
      { transform: 'rotate(0deg)', opacity: 0 },
      { transform: 'rotate(8deg)', opacity: 1, offset: 0.25 },
      { transform: 'rotate(24deg)', opacity: 0.55 },
    ],
    { duration: 1500, easing: 'linear' },
  )
  aneis.forEach((anel, i) => {
    void motor.animar(anel, [{ transform: 'scale(0.35)', opacity: 1 }, { transform: 'scale(2.8)', opacity: 0 }], { duration: 620, delay: 120 + i * 110, easing: EASE })
  })
  void motor.animar(retrato, [{ transform: 'translateY(6%) scale(1.06)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 340, delay: 80, easing: EASE })
  void motor.animar(clarao, [{ opacity: 0 }, { opacity: 0.7, offset: 0.25 }, { opacity: 0 }], { duration: 300, delay: 300, easing: EASE })
  void motor.animar(rotulo, [{ opacity: 0, transform: 'translateX(-20px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 240, delay: 380, easing: EASE })
  void motor.animar(
    nome,
    [
      { opacity: 0, transform: 'rotate(-4deg) scale(1.6)' },
      { opacity: 1, transform: 'rotate(-4deg) scale(0.96)', offset: 0.7 },
      { opacity: 1, transform: 'rotate(-4deg) scale(1)' },
    ],
    { duration: 300, delay: 420, easing: EASE },
  )
  linhas.forEach((linha, i) => {
    void motor.animar(linha, [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 220, delay: 760 + i * 60, easing: EASE })
  })
  await motor.esperar(820)
  if (contas.length > 0) await contarNumeros(motor, contas, 420)
  await motor.esperar(contas.length > 0 ? 700 : 900)
  await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE })
  el.remove()
}

/** O texto curto sobre a ficha ("PUNHO NEGRO DESFEITO", "ATORDOADO ACABOU"): sobe de leve, segura e some subindo. */
async function tocarAviso(motor: Palco, onde: { x: number; y: number; raio: number }, conteudo: string, tipo: 'forma' | 'selo', reduzido: boolean) {
  const el = motor.criar('bt-ef-aviso')
  el.dataset.tipo = tipo
  el.textContent = conteudo
  const base = `translate(${onde.x}px, ${onde.y - onde.raio - 10}px) translate(-50%, -100%)`
  el.style.transform = base
  if (reduzido) {
    await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: AVISO_ENTRA_MS, easing: EASE })
    await motor.esperar(AVISO_SEGURA_MS)
    await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: AVISO_SAI_MS, easing: EASE })
    el.remove()
    return
  }
  await motor.animar(
    el,
    [
      { transform: `${base} translateY(8px) scale(0.96)`, opacity: 0 },
      { transform: `${base} translateY(0) scale(1)`, opacity: 1 },
    ],
    { duration: AVISO_ENTRA_MS, easing: EASE },
  )
  await motor.esperar(AVISO_SEGURA_MS)
  await motor.animar(el, [{ transform: base, opacity: 1 }, { transform: `${base} translateY(-10px)`, opacity: 0 }], { duration: AVISO_SAI_MS, easing: EASE })
  el.remove()
}

/**
 * D4: a força do próximo tremor, em px, pelo tamanho do golpe (até 10% da vida
 * do alvo: 3; até 30%: 7; acima: 12). Os efeitos escrevem logo antes de chamar
 * o `onTremor`, e o `tremer` de quem monta lê daqui sem mudar de assinatura.
 */
const TREMOR_LEVE = 3
const TREMOR_MEDIO = 7
const TREMOR_FORTE = 12
let forcaDoTremor = TREMOR_MEDIO

/** D4: o tremor pelo dano, em fração da vida máxima do alvo (`null` = sem a vida à mão: o do meio). */
export function forcaDoTremorPeloDano(fracao: number | null): number {
  if (fracao === null) return TREMOR_MEDIO
  return fracao <= 0.1 ? TREMOR_LEVE : fracao <= 0.3 ? TREMOR_MEDIO : TREMOR_FORTE
}

/** O tremor de 220 ms no invólucro do mapa (quem monta chama no `onTremor`), do tamanho do golpe (D4). Movimento reduzido: nada. */
export function tremer(elemento: HTMLElement | null, px: number = forcaDoTremor) {
  if (elemento === null || movimentoReduzido()) return
  const k = px / TREMOR_MEDIO
  const passo = (x: number, y: number) => ({ transform: `translate(${(x * k).toFixed(1)}px, ${(y * k).toFixed(1)}px)` })
  elemento.animate([passo(0, 0), passo(7, -4), passo(-6, 4), passo(4, -2), passo(-2, 1), passo(0, 0)], {
    duration: 220,
    easing: 'linear',
  })
}
