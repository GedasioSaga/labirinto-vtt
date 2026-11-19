import { useLayoutEffect } from 'react'

/**
 * PAINEL DO JOGADOR (protótipo aprovado em 19/11/2026): onde a FAIXA DA ORDEM
 * (`.pp-batalha-faixa`) mora na tela do jogador. Na linha de cima, no vão entre a
 * barra (ou o painel aberto) e o canto da direita, se TODAS as cartas cabem nele na
 * largura mínima. Se não, numa linha só dela, logo abaixo da barra e do canto, com a
 * largura toda; se nem ali cabem, a fila rola (os contadores "‹ 2" / "3 ›" dizem
 * quantas ficaram fora), mas a carta não encolhe: o nome inteiro em até 3 linhas vale
 * mais. Nos dois casos nada fica por baixo de um botão: antes a faixa centrava na
 * tela e entrava por baixo de "Painel / Minha ficha / Inventário / Ficha".
 *
 * Só mede e escreve: `--pp-faixa-esq`, `--pp-faixa-dir`, `--pp-faixa-topo` e
 * `--pp-faixa-fundo` na raiz (o menu da vez e os lembretes começam abaixo do topo
 * dela; a caixa REAÇÃO não sobe além do fundo, para o dano riscado na carta ficar à
 * vista) e `data-lugar` na faixa; o desenho mora em player.css. As medidas valem no bloco
 * das peças `position: fixed` (a janela, ou a tela embaixo da barra da visão de teste).
 * Abaixo de 700 px (celular em pé, a barra vira a faixa de couro da largura toda)
 * vale a regra de sempre do CSS.
 */

const CLASSE_DA_FAIXA = 'pp-batalha-faixa'
/** Respiro entre a faixa e a barra (ou o painel) e entre ela e o canto, na linha de cima. */
const VAO_PX = 16
/** Da faixa até a borda da tela e até o que mora acima dela, na linha própria. */
const MARGEM_PX = 12
/** Abaixo desta largura de janela a faixa segue o CSS (o celular em pé). */
const LARGURA_MINIMA_PX = 700
/** A largura mínima da carta e o vão entre elas, se a faixa não disser (`--bt-carta-min`, `--bt-cartas-vao`). */
const CARTA_MIN_PADRAO_PX = 112
const VAO_DAS_CARTAS_PADRAO_PX = 8
const VARIAVEIS = ['--pp-faixa-esq', '--pp-faixa-dir', '--pp-faixa-topo', '--pp-faixa-fundo'] as const

interface Caixa {
  left: number
  top: number
  right: number
  bottom: number
}

function px(valor: string): number {
  const numero = Number.parseFloat(valor)
  return Number.isFinite(numero) ? numero : 0
}

/** As peças do canto que comem o alto da tela: as rolagens moram no pé e crescem para cima, então conta a lista, não a caixa. */
function pecasDoCanto(canto: HTMLElement): HTMLElement[] {
  return Array.from(canto.children).flatMap((peca) => (peca.classList.contains('pp-rolagens') ? Array.from(peca.querySelectorAll<HTMLElement>('.pp-dice-feed')) : [peca as HTMLElement]))
}

/** Quanto a faixa precisa para pôr todas as cartas na largura mínima, mais os respiros dela e da fila. */
function larguraNecessaria(faixa: HTMLElement): number {
  const estilo = getComputedStyle(faixa)
  const lista = faixa.querySelector<HTMLElement>('.bt-cartas')
  const cartas = lista === null ? [] : Array.from(lista.querySelectorAll<HTMLElement>(':scope > .bt-carta'))
  const respiroDaFaixa = px(estilo.paddingLeft) + px(estilo.paddingRight)
  if (lista === null || cartas.length === 0) return faixa.offsetWidth
  const daLista = getComputedStyle(lista)
  const minima = px(estilo.getPropertyValue('--bt-carta-min')) || px(getComputedStyle(cartas[0] as HTMLElement).minWidth) || CARTA_MIN_PADRAO_PX
  const vao = px(estilo.getPropertyValue('--bt-cartas-vao')) || px(daLista.columnGap) || VAO_DAS_CARTAS_PADRAO_PX
  // A faixa de sempre (o Dragon Ball) ainda tem o quadro da rodada ao lado das cartas.
  const quadro = faixa.querySelector<HTMLElement>(':scope > .bt-turno')
  const doQuadro = quadro === null ? 0 : quadro.offsetWidth + px(estilo.columnGap)
  return cartas.length * minima + (cartas.length - 1) * vao + px(daLista.paddingLeft) + px(daLista.paddingRight) + respiroDaFaixa + doQuadro
}

function escrever(raiz: HTMLElement, nome: (typeof VARIAVEIS)[number], valor: number): void {
  const texto = `${Math.round(valor)}px`
  if (raiz.style.getPropertyValue(nome) !== texto) raiz.style.setProperty(nome, texto)
}

function marcar(faixa: HTMLElement, nome: string, valor: string | null): void {
  if (valor === null) {
    if (faixa.hasAttribute(nome)) faixa.removeAttribute(nome)
  } else if (faixa.getAttribute(nome) !== valor) faixa.setAttribute(nome, valor)
}

export function useLugarDaFaixa(ligada: boolean): void {
  useLayoutEffect(() => {
    if (!ligada) return
    const raiz = document.documentElement
    let faixaMarcada: HTMLElement | null = null
    const limpar = () => {
      for (const nome of VARIAVEIS) raiz.style.removeProperty(nome)
      if (faixaMarcada !== null) marcar(faixaMarcada, 'data-lugar', null)
    }

    const arrumar = () => {
      const faixa = document.querySelector<HTMLElement>(`.${CLASSE_DA_FAIXA}`)
      const barra = document.querySelector<HTMLElement>('.pp-bar')
      const canto = document.querySelector<HTMLElement>('.pp-canto')
      if (faixaMarcada !== null && faixaMarcada !== faixa) limpar()
      faixaMarcada = faixa
      if (faixa === null || barra === null || window.innerWidth < LARGURA_MINIMA_PX) {
        limpar()
        return
      }
      // O bloco das peças fixas: a barra está a `top`/`left` dele (na visão de teste ele começa embaixo da barra de cima).
      const daBarra = getComputedStyle(barra)
      const caixaDaBarra = barra.getBoundingClientRect()
      const baseX = caixaDaBarra.left - px(daBarra.left)
      const baseY = caixaDaBarra.top - px(daBarra.top)
      const local = (caixa: DOMRect): Caixa => ({ left: caixa.left - baseX, top: caixa.top - baseY, right: caixa.right - baseX, bottom: caixa.bottom - baseY })
      const largura = canto === null ? window.innerWidth - baseX : canto.getBoundingClientRect().right + px(getComputedStyle(canto).right) - baseX
      const alarme = px(daBarra.getPropertyValue('--pp-alarm-space'))
      const barraLocal = local(caixaDaBarra)
      const painel = document.querySelector<HTMLElement>('.pp-panel:not([hidden])')
      const painelLocal = painel === null ? null : local(painel.getBoundingClientRect())
      const pecas = canto === null ? [] : pecasDoCanto(canto).map((peca) => peca.getBoundingClientRect()).filter((caixa) => caixa.width > 0 && caixa.height > 0).map(local)
      const altura = faixa.offsetHeight
      const precisa = larguraNecessaria(faixa)
      // A borda de quem invade a faixa pela direita numa faixa horizontal da tela.
      const bordaDoCanto = (de: number, ate: number) => pecas.filter((peca) => peca.top < ate && peca.bottom > de).reduce((menor, peca) => Math.min(menor, peca.left - VAO_PX), largura - MARGEM_PX)

      const topo1 = MARGEM_PX + alarme
      const esquerda1 = (painelLocal === null ? barraLocal.right : Math.max(barraLocal.right, painelLocal.right)) + VAO_PX
      const direita1 = bordaDoCanto(topo1, topo1 + altura)
      if (precisa <= direita1 - esquerda1) {
        escrever(raiz, '--pp-faixa-topo', topo1)
        escrever(raiz, '--pp-faixa-fundo', topo1 + altura)
        escrever(raiz, '--pp-faixa-esq', esquerda1)
        escrever(raiz, '--pp-faixa-dir', largura - direita1)
        marcar(faixa, 'data-lugar', 'cima')
        return
      }
      // A linha própria: abaixo da barra e das peças do canto que moram na altura dela.
      const doAlto = pecas.filter((peca) => peca.top < barraLocal.bottom).reduce((fundo, peca) => Math.max(fundo, peca.bottom), barraLocal.bottom)
      const topo2 = doAlto + MARGEM_PX
      const esquerda2 = painelLocal === null ? MARGEM_PX : painelLocal.right + MARGEM_PX
      const direita2 = bordaDoCanto(topo2, topo2 + altura)
      escrever(raiz, '--pp-faixa-topo', topo2)
      escrever(raiz, '--pp-faixa-fundo', topo2 + altura)
      escrever(raiz, '--pp-faixa-esq', esquerda2)
      escrever(raiz, '--pp-faixa-dir', largura - direita2)
      marcar(faixa, 'data-lugar', 'propria')
    }

    // Um quadro só por rajada: o painel que abre, a carta que entra e a janela que muda mexem várias peças de uma vez.
    let quadro = 0
    const pedir = () => {
      if (quadro !== 0) return
      quadro = window.requestAnimationFrame(() => {
        quadro = 0
        arrumar()
      })
    }
    const tamanho = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pedir)
    const vigiar = () => {
      if (tamanho === null) return
      tamanho.disconnect()
      const alvos = [document.querySelector('.pp-bar'), document.querySelector('.pp-panel'), document.querySelector('.pp-canto'), document.querySelector(`.${CLASSE_DA_FAIXA}`)]
      const canto = document.querySelector<HTMLElement>('.pp-canto')
      for (const alvo of [...alvos, ...(canto === null ? [] : pecasDoCanto(canto))]) if (alvo !== null) tamanho.observe(alvo)
    }
    // Aba de andar que chega, a lista de rolagens que nasce, a carta que entra, o painel que abre: vigia de novo e arruma.
    const mudancas = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      vigiar()
      pedir()
    })
    const canto = document.querySelector('.pp-canto')
    const faixa = document.querySelector(`.${CLASSE_DA_FAIXA}`)
    const painel = document.querySelector('.pp-panel')
    if (canto !== null) mudancas?.observe(canto, { childList: true, subtree: true })
    if (faixa !== null) mudancas?.observe(faixa, { childList: true, subtree: true })
    if (painel !== null) mudancas?.observe(painel, { attributes: true, attributeFilter: ['hidden'] })
    window.addEventListener('resize', pedir)
    vigiar()
    arrumar()
    return () => {
      window.cancelAnimationFrame(quadro)
      tamanho?.disconnect()
      mudancas?.disconnect()
      window.removeEventListener('resize', pedir)
      limpar()
    }
  }, [ligada])
}
