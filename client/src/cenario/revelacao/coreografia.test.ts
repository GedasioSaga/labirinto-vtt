import { describe, expect, it } from 'vitest'
import { medirEPosicionar, type PecasDaRevelacao } from './coreografia'

/**
 * A altura do postigo é medida pelo conteúdo. Medir de novo (fonte ou largura
 * nova: a escala da prévia chegou, a janela mudou) não pode devolver a altura
 * que a medida anterior pôs no próprio painel.
 */

const ALTURA_DO_CONTEUDO = 132

function pecas(): PecasDaRevelacao {
  const raiz = document.createElement('div')
  Object.defineProperty(raiz, 'clientWidth', { value: 317 })
  Object.defineProperty(raiz, 'clientHeight', { value: 476 })
  const painel = document.createElement('section')
  // Como no navegador: altura explícita vence o conteúdo.
  Object.defineProperty(painel, 'offsetHeight', {
    get(this: HTMLElement) {
      return this.style.height === '' ? ALTURA_DO_CONTEUDO : parseFloat(this.style.height)
    },
  })
  return {
    raiz,
    fundo: document.createElement('div'),
    grupo: document.createElement('div'),
    quadro: null,
    molduraImagem: null,
    vista: null,
    dobradicas: null,
    trilho: null,
    carro: null,
    painel,
    molduraPainel: null,
    folhas: null,
    nome: null,
    faceSombra: null,
    reflexo: null,
  }
}

describe('medirEPosicionar', () => {
  it('medir de novo solta a altura da medida anterior: o painel cresce com o conteúdo', () => {
    const p = pecas()
    // A medida anterior (fonte menor) deixou 101 px no painel.
    if (p.painel) p.painel.style.height = '101px'
    const L = medirEPosicionar(p, null, true, false)
    expect(L?.ph).toBe(ALTURA_DO_CONTEUDO)
    expect(p.painel?.style.height).toBe(`${ALTURA_DO_CONTEUDO}px`)
  })
})
