import { useEffect, useRef, useState } from 'react'
import type { EfeitoDaBatalha, SaidaDaReacao } from '../../lib/batalha/combate'
import { saidasPossiveis } from '../../lib/batalha/reacao'
import { anuncioDoEfeito, formatarNumero, movimentoReduzido, palavraDoDano, TEXTO_DA_SAIDA } from './dadosDoMenu'
import type { ConsultaDaFicha } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * OS EFEITOS DA BATALHA sobre o mapa (o `.efeitos` do protótipo aprovado),
 * nas duas telas: toca a fila de efeitos (`seq`) um depois do outro — a faixa
 * SUA VEZ (240/420/180 ms, quando a vez vira dele), o corte do golpe
 * (150/330/150 ms, retrato do atacante e o nome da técnica), o risco no alvo,
 * o d20 junto ao alvo (160 ms entra, 8 números em 380 ms, pousa em 200 ms), o
 * número do dano (bate em 260 ms até 116%, fica 520 ms, sobe e some em
 * 240 ms; "ESQUIVOU", "CONTRA-ATAQUE", "CRÍTICO") e o tremor de 220 ms
 * (`onTremor`: quem monta mexe no invólucro do mapa).
 *
 * Começa no `seq` de agora (sem reprise do que já passou). Clique, Enter,
 * Espaço ou Esc pulam o que está tocando. Movimento reduzido: só aparece e
 * some, sem tremor nem risco. Só transform, opacity e clip-path.
 *
 * A posição da ficha vem da consulta da S4 (px da janela), lida no começo de
 * cada efeito; ficha fora da tela não ganha d20 nem número.
 */

export interface EfeitosDaBatalhaProps {
  efeitos: readonly EfeitoDaBatalha[]
  consulta: ConsultaDaFicha | null
  nomeDe: (tokenId: string) => string
  /** A foto pequena da ficha (o retrato do corte); `null` = iniciais. */
  imagemDe: (tokenId: string) => string | null
  /** A faixa SUA VEZ: uma chave nova (carta e rodada) toca a faixa. `null` = não é a vez dele. */
  suaVez?: { chave: string; nome: string } | null
  onTremor?: () => void
  className?: string
}

type Tarefa = { tipo: 'efeito'; efeito: EfeitoDaBatalha } | { tipo: 'vez'; nome: string }

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'
const PUNCH = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const TECLAS_QUE_PULAM = new Set(['Enter', ' ', 'Escape'])

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

export function EfeitosDaBatalha({ efeitos, consulta, nomeDe, imagemDe, suaVez, onTremor, className }: EfeitosDaBatalhaProps) {
  const camada = useRef<HTMLDivElement>(null)
  const palco = useRef<Palco | null>(null)
  const fila = useRef<Tarefa[]>([])
  const tocando = useRef(false)
  const ultimoSeq = useRef<number | null>(null)
  const ultimaVez = useRef<string | null | undefined>(undefined)
  const [anuncio, setAnuncio] = useState('')
  // As props mudam a cada render; o motor lê sempre as de agora.
  const atuais = useRef({ consulta, nomeDe, imagemDe, onTremor })
  atuais.current = { consulta, nomeDe, imagemDe, onTremor }

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
      if (TECLAS_QUE_PULAM.has(evento.key)) pular()
    }
    window.addEventListener('keydown', teclar, true)
    window.addEventListener('pointerdown', pular, { capture: true, passive: true })
    void (async () => {
      try {
        while (fila.current.length > 0 && palco.current === motor) {
          const tarefa = fila.current.shift() as Tarefa
          motor.pulando = false
          if (tarefa.tipo === 'efeito') setAnuncio(anuncioDoEfeito(tarefa.efeito, atuais.current.nomeDe))
          await tocar(motor, tarefa)
        }
      } finally {
        window.removeEventListener('keydown', teclar, true)
        window.removeEventListener('pointerdown', pular, true)
        tocando.current = false
      }
    })()
  }

  const tocar = async (motor: Palco, tarefa: Tarefa) => {
    const reduzido = movimentoReduzido()
    const { consulta: consultar, nomeDe: nome, imagemDe: imagem, onTremor: tremer } = atuais.current
    if (tarefa.tipo === 'vez') return tocarFaixa(motor, tarefa.nome, reduzido)
    const efeito = tarefa.efeito
    if (efeito.tipo === 'golpe') {
      await tocarCorte(motor, nome(efeito.atacanteTokenId), imagem(efeito.atacanteTokenId), efeito.nome, efeito.surpresa ? 'Surpresa' : efeito.overload ? 'Overload' : null, reduzido)
      if (!reduzido) await Promise.all(efeito.alvos.map((tokenId) => tocarRisco(motor, motor.posicao(consultar, tokenId))))
      return
    }
    const onde = motor.posicao(consultar, efeito.tokenId)
    if (onde === null) return
    if (efeito.tipo === 'reacao') return tocarDado(motor, onde, efeito.d20, efeito.modificador, efeito.total, reduzido)
    if (efeito.valor > 0 && !reduzido) tremer?.()
    return tocarNumero(motor, onde, efeito.valor, efeito.saida, reduzido)
  }

  // Os efeitos novos entram na fila; a lista vazia (batalha acabou) zera o seq.
  useEffect(() => {
    if (efeitos.length === 0) {
      ultimoSeq.current = -1
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

  // SUA VEZ: só quando a vez VIRA dele (a que já era ao montar não toca).
  const chaveDaVez = suaVez?.chave ?? null
  useEffect(() => {
    const antes = ultimaVez.current
    ultimaVez.current = chaveDaVez
    if (antes === undefined || chaveDaVez === null || chaveDaVez === antes) return
    fila.current.unshift({ tipo: 'vez', nome: suaVez?.nome ?? '' })
    tocarFila()
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

async function tocarFaixa(motor: Palco, nome: string, reduzido: boolean) {
  const el = motor.criar('bt-ef-faixa')
  const grande = texto(el, 'bt-ef-faixa__grande', 'SUA VEZ')
  if (nome !== '') texto(el, 'bt-ef-faixa__sub', nome)
  if (reduzido) {
    await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: EASE })
    await motor.esperar(650)
    await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE })
    el.remove()
    return
  }
  void motor.animar(grande, [{ transform: 'translateX(-14%) skewX(-12deg)', opacity: 0 }, { transform: 'translateX(0) skewX(0)', opacity: 1 }], { duration: 300, delay: 60, easing: EASE })
  await motor.animar(el, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 240, easing: EASE })
  await motor.esperar(420)
  await motor.animar(el, [{ transform: 'rotate(-6deg) translateX(0)', opacity: 1 }, { transform: 'rotate(-6deg) translateX(18%)', opacity: 0 }], { duration: 180, easing: EASE })
  el.remove()
}

async function tocarCorte(motor: Palco, quem: string, imagem: string | null, golpe: string, marca: string | null, reduzido: boolean) {
  const el = motor.criar('bt-ef-corte')
  const retrato = document.createElement('div')
  retrato.className = 'bt-ef-corte__retrato'
  if (imagem !== null) {
    const foto = document.createElement('img')
    foto.src = imagem
    foto.alt = ''
    foto.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'
    retrato.appendChild(foto)
  } else {
    retrato.style.cssText = 'display:grid;place-items:center;background:var(--bt-tinta);color:var(--bt-papel)'
    retrato.textContent = iniciais(quem)
  }
  el.appendChild(retrato)
  const caixa = document.createElement('div')
  caixa.className = 'bt-ef-corte__texto'
  el.appendChild(caixa)
  texto(caixa, 'bt-ef-corte__quem', marca === null ? quem : `${quem} · ${marca}`)
  const nome = texto(caixa, 'bt-ef-corte__nome', golpe)
  if (reduzido) {
    await motor.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: EASE })
    await motor.esperar(420)
    await motor.animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: EASE })
    el.remove()
    return
  }
  void motor.animar(retrato, [{ transform: 'translateX(-30%)' }, { transform: 'translateX(4%)' }], { duration: 620, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' })
  void motor.animar(nome, [{ transform: 'translateX(30%)', opacity: 0 }, { transform: 'translateX(-2%)', opacity: 1 }], { duration: 560, delay: 40, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' })
  await motor.animar(el, [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 150, easing: EASE })
  await motor.esperar(330)
  await motor.animar(el, [{ transform: 'rotate(-7deg) translateX(0)', opacity: 1 }, { transform: 'rotate(-7deg) translateX(-12%)', opacity: 0 }], { duration: 150, easing: EASE })
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

/** O tremor de 220 ms no invólucro do mapa (quem monta chama no `onTremor`). Movimento reduzido: nada. */
export function tremer(elemento: HTMLElement | null) {
  if (elemento === null || movimentoReduzido()) return
  elemento.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(7px, -4px)' }, { transform: 'translate(-6px, 4px)' }, { transform: 'translate(4px, -2px)' }, { transform: 'translate(-2px, 1px)' }, { transform: 'translate(0, 0)' }], {
    duration: 220,
    easing: 'linear',
  })
}
