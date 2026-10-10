/**
 * CARIMBOS no palco (`drawCarimbos.ts`), com a arte e a pintura dos pedaços
 * de sombra falsas (o jsdom não tem canvas). Prova: um sprite por objeto, de
 * trás para a frente, o do chão por baixo das sombras; a sombra numa camada
 * de pedaços, só o pedaço que mudou é pintado de novo; o mesmo conteúdo em
 * referências novas não redesenha; cena nova solta a anterior; a imagem
 * importada aparece quando abre; o modo leve tira só as sombras; a prévia do
 * spray e da borracha. Arte nova (imagem que abriu, pacote trocado) repinta
 * só os pedaços com objeto dela; e a memória de vídeo é solta (pedaço vazio,
 * textura aposentada pelo pacote, tudo no destruir).
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Texture } from 'pixi.js'
import type { Carimbo, CarimboImportado } from '../types/map'
import { QUADRO_DA_BIBLIOTECA, QUADRO_DO_IMPORTADO } from '../carimbos/arte'
import { esquecerCarimbosDeFora, registrarCarimboDoPacote } from '../carimbos/catalogo'
import { createCarimbosRenderer, ladoDoPedacoNoMundo, type ArteNoPalco, type EntradaDosCarimbos, type PedacoDeSombra } from './drawCarimbos'

/** Mapa de 1242 px de lado (unidade 1): o pedaço de sombra tem 256 px de mundo. */
const MAPA = { width: 54, height: 54, grid: 23 }
const objeto = (id: string, x: number, y: number, tipo = 'pinheiro', tamanho = 20): Carimbo => ({ id, tipo, x, y, tamanho, giro: 0 })
const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='

function entrada(cena: string, carimbos: Carimbo[], importados?: CarimboImportado[], sombras?: boolean): EntradaDosCarimbos {
  return { cena, mapa: MAPA, carimbos, importados, ...(sombras === undefined ? {} : { sombras }) }
}

/** Um carimbo do pacote (fora da biblioteca embutida): o registro dele troca o catálogo. */
const DO_PACOTE = 'cacto-teste'
const registrarCacto = () => registrarCarimboDoPacote({ id: DO_PACOTE, nome: 'Cacto', tamanho: 14, sombra: 'em-pe', desenhar: () => {} })

// A silhueta é uma tela de verdade quando o teste precisa da sombra da prévia
// (só a tela vira textura); o resto se contenta com um objeto qualquer.
function falsos(importadoPronto?: Promise<ArteNoPalco | null>, silhueta: CanvasImageSource = {} as CanvasImageSource) {
  const corpos = new Map<string, Texture>()
  const assar = vi.fn((tipo: string, variante: number, importado: CarimboImportado | undefined): ArteNoPalco | null | Promise<ArteNoPalco | null> => {
    if (importado !== undefined) return importadoPronto ?? Promise.resolve(null)
    if (tipo === 'sumido') return null
    const corpo = new Texture()
    corpos.set(`${tipo}#${variante}`, corpo)
    return { corpo, quadro: QUADRO_DA_BIBLIOTECA, sombra: tipo === 'poca' ? null : silhueta, chao: tipo === 'poca' }
  })
  const pintados: PedacoDeSombra[] = []
  const pintarPedaco = vi.fn((pedaco: PedacoDeSombra) => {
    pintados.push(pedaco)
    return pedaco.textura ?? new Texture()
  })
  return { assar, pintarPedaco, pintados, corpos }
}

function filhos(camada: Container, rotulo: string): Sprite[] {
  const alvo = camada.getChildByLabel(rotulo)
  if (alvo === null) throw new Error(`sem ${rotulo}`)
  return alvo.children as Sprite[]
}

describe('carimbos no palco', () => {
  it('um sprite por objeto, com a base na âncora e o quadro na escala do tamanho, de trás para a frente', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    r.atualizar(entrada('c1', [objeto('frente', 100, 300), objeto('atras', 120, 100), objeto('meio', 90, 200)]))
    const corpos = filhos(r.camada, 'carimbos-corpos')
    expect(corpos.map((s) => s.y)).toEqual([100, 200, 300])
    const [atras] = corpos
    expect(atras.x).toBe(120)
    expect(atras.anchor.x).toBeCloseTo(-QUADRO_DA_BIBLIOTECA.esquerda / QUADRO_DA_BIBLIOTECA.lado)
    expect(atras.anchor.y).toBeCloseTo(-QUADRO_DA_BIBLIOTECA.topo / QUADRO_DA_BIBLIOTECA.lado)
    // Os do mesmo desenho dividem a textura (o Pixi junta num lote).
    expect(new Set(corpos.map((s) => s.texture)).size).toBe(1)
    expect(f.assar).toHaveBeenCalledTimes(1)
    r.destruir()
  })

  it('a poça (objeto do chão) vai por baixo das sombras; o resto, por cima', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    r.atualizar(entrada('c1', [objeto('p', 100, 100, 'poca'), objeto('a', 300, 100)]))
    const ordem = r.camada.children.map((c) => c.label)
    expect(ordem.indexOf('carimbos-chao')).toBeLessThan(ordem.indexOf('carimbos-sombras'))
    expect(ordem.indexOf('carimbos-sombras')).toBeLessThan(ordem.indexOf('carimbos-corpos'))
    expect(filhos(r.camada, 'carimbos-chao')).toHaveLength(1)
    expect(filhos(r.camada, 'carimbos-corpos')).toHaveLength(1)
    // A sombra da poça não existe: só o pinheiro entra no pedaço.
    expect(f.pintados.flatMap((p) => p.sombras)).toHaveLength(1)
    r.destruir()
  })

  it('a sombra é pintada em pedaços; mexer num objeto repinta só o pedaço dele', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    const lado = ladoDoPedacoNoMundo(MAPA)
    expect(lado).toBeCloseTo(256, 0)
    const aqui = objeto('aqui', 60, 60)
    const ali = objeto('ali', 700, 700)
    r.atualizar(entrada('c1', [aqui, ali]))
    expect(f.pintados).toHaveLength(2)
    expect(filhos(r.camada, 'carimbos-sombras')).toHaveLength(2)
    f.pintados.length = 0
    r.atualizar(entrada('c1', [aqui, { ...ali, x: 710 }]))
    expect(f.pintados).toHaveLength(1)
    expect(f.pintados[0].x).toBe(Math.floor(700 / lado) * lado)
    // O pedaço que ficou vazio sai do palco, e a textura dele é solta (memória de vídeo).
    const [deAqui, deAli] = filhos(r.camada, 'carimbos-sombras').map((s) => s.texture)
    r.atualizar(entrada('c1', [aqui]))
    expect(filhos(r.camada, 'carimbos-sombras')).toHaveLength(1)
    expect(deAli.destroyed).toBe(true)
    expect(deAqui.destroyed).toBe(false)
    r.destruir()
  })

  it('a imagem que abre repinta só o pedaço que tem objeto dela; os outros ficam', async () => {
    let abrir: (arte: ArteNoPalco | null) => void = () => {}
    const pronta = new Promise<ArteNoPalco | null>((ok) => {
      abrir = ok
    })
    const f = falsos(pronta)
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    const lado = ladoDoPedacoNoMundo(MAPA)
    const importados = [{ id: 'importado:farol', nome: 'Carimbo', imagem: IMAGEM }]
    r.atualizar(entrada('c1', [objeto('aqui', 60, 60), objeto('farol', 700, 700, 'importado:farol')], importados))
    expect(f.pintados).toHaveLength(1)
    f.pintados.length = 0
    // A pintura do pedaço é falsa: a silhueta nunca é lida, qualquer objeto serve.
    abrir({ corpo: new Texture(), quadro: QUADRO_DO_IMPORTADO, sombra: {} as CanvasImageSource, chao: false })
    await pronta
    await Promise.resolve()
    expect(filhos(r.camada, 'carimbos-corpos')).toHaveLength(2)
    expect(f.pintados).toHaveLength(1)
    expect(f.pintados[0].x).toBe(Math.floor(700 / lado) * lado)
    r.destruir()
  })

  it('pacote novo: só o pedaço com objeto do pacote é repintado, e a textura velha do desenho é solta', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    try {
      r.atualizar(entrada('c1', [objeto('aqui', 60, 60), objeto('cacto', 700, 700, DO_PACOTE)]))
      const velho = f.corpos.get(`${DO_PACOTE}#0`)
      const pinheiro = f.corpos.get('pinheiro#0')
      f.pintados.length = 0
      registrarCacto()
      const lado = ladoDoPedacoNoMundo(MAPA)
      expect(f.pintados).toHaveLength(1)
      expect(f.pintados[0].x).toBe(Math.floor(700 / lado) * lado)
      expect(velho?.destroyed).toBe(true)
      expect(pinheiro?.destroyed).toBe(false)
      // O sprite do cacto já usa o desenho novo.
      const novo = f.corpos.get(`${DO_PACOTE}#0`)
      expect(novo).not.toBe(velho)
      expect(filhos(r.camada, 'carimbos-corpos').some((s) => s.texture === novo)).toBe(true)
    } finally {
      r.destruir()
      esquecerCarimbosDeFora()
    }
  })

  it('destruir solta tudo: os desenhos, os pedaços e as sombras da prévia', () => {
    const f = falsos(undefined, document.createElement('canvas'))
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    r.atualizar(entrada('c1', [objeto('aqui', 60, 60), objeto('ali', 300, 300, 'arvore')]))
    const pedacos = filhos(r.camada, 'carimbos-sombras').map((s) => s.texture)
    expect(pedacos.length).toBeGreaterThan(0)
    r.mostrarPrevia([objeto('n1', 100, 100)], new Set(), undefined)
    const rascunho = r.camada.getChildByLabel('carimbos-rascunho')
    if (rascunho === null) throw new Error('sem rascunho')
    const [sombrasDaPrevia] = rascunho.children
    const primeira = sombrasDaPrevia.children[0]
    if (!(primeira instanceof Sprite)) throw new Error('a prévia não tem sombra')
    const sombraDaPrevia = primeira.texture
    const desenhos = [...f.corpos.values()]
    expect(desenhos).toHaveLength(2)

    r.destruir()
    expect(pedacos.every((t) => t.destroyed)).toBe(true)
    expect(sombraDaPrevia.destroyed).toBe(true)
    expect(desenhos.every((t) => t.destroyed)).toBe(true)
  })

  it('pacote novo: a sombra da prévia de uma arte aposentada é solta na hora (ou ao fim do traço que ainda a mostra)', () => {
    const f = falsos(undefined, document.createElement('canvas'))
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    const rascunho = r.camada.getChildByLabel('carimbos-rascunho')
    if (rascunho === null) throw new Error('sem rascunho')
    const sombraDoPrimeiro = (): Texture => {
      const sprite = rascunho.children[0].children[0]
      if (!(sprite instanceof Sprite)) throw new Error('a prévia não tem sombra')
      return sprite.texture
    }
    try {
      r.atualizar(entrada('c1', [objeto('cacto', 700, 700, DO_PACOTE)]))
      // Um traço que acabou: a sombra da prévia do cacto fica guardada para o próximo.
      r.mostrarPrevia([objeto('n1', 100, 100, DO_PACOTE)], new Set(), undefined)
      const livre = sombraDoPrimeiro()
      r.limparPrevia()
      expect(livre.destroyed).toBe(false)
      registrarCacto()
      expect(livre.destroyed).toBe(true)

      // Um traço em curso ainda mostra a sombra: ela sai quando a prévia acaba.
      r.mostrarPrevia([objeto('n2', 100, 100, DO_PACOTE)], new Set(), undefined)
      const presa = sombraDoPrimeiro()
      registrarCacto()
      expect(presa.destroyed).toBe(false)
      r.limparPrevia()
      expect(presa.destroyed).toBe(true)
    } finally {
      r.destruir()
      esquecerCarimbosDeFora()
    }
  })

  it('destruir solta a textura que o pacote aposentou quando nenhum desenho veio depois', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    try {
      // O cacto é desenhado e a cena esvazia: a troca do pacote o aposenta sem
      // um desenho seguinte para soltá-lo — só o destruir.
      r.atualizar(entrada('c1', [objeto('cacto', 700, 700, DO_PACOTE)]))
      const aposentado = f.corpos.get(`${DO_PACOTE}#0`)
      r.atualizar(null)
      registrarCacto()
      expect(aposentado?.destroyed).toBe(false)
      r.destruir()
      expect(aposentado?.destroyed).toBe(true)
    } finally {
      esquecerCarimbosDeFora()
    }
  })

  it('o mesmo conteúdo em referências novas (o mapa do jogador) não redesenha nada', () => {
    const f = falsos()
    const aoDesenhar = vi.fn()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco, aoDesenhar })
    r.atualizar(entrada('c1', [objeto('a', 10, 10)]))
    r.atualizar(entrada('c1', [objeto('a', 10, 10)]))
    expect(aoDesenhar).toHaveBeenCalledTimes(1)
    r.destruir()
  })

  it('cena nova solta os objetos da anterior; sem objeto, a camada se esconde', () => {
    const f = falsos()
    const visivel = vi.fn()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco, aoMudarVisibilidade: visivel })
    r.atualizar(entrada('c1', [objeto('a', 10, 10), objeto('b', 20, 20)]))
    expect(visivel).toHaveBeenLastCalledWith(true)
    const antigos = filhos(r.camada, 'carimbos-corpos').slice()
    r.atualizar(entrada('c2', [objeto('x', 30, 30)]))
    expect(antigos.every((s) => s.destroyed)).toBe(true)
    expect(filhos(r.camada, 'carimbos-corpos')).toHaveLength(1)
    r.atualizar(null)
    expect(filhos(r.camada, 'carimbos-corpos')).toHaveLength(0)
    expect(visivel).toHaveBeenLastCalledWith(false)
    r.destruir()
  })

  it('a imagem importada aparece quando abre; o tipo que não existe só fica de fora', async () => {
    let abrir: (arte: ArteNoPalco | null) => void = () => {}
    const pronta = new Promise<ArteNoPalco | null>((ok) => {
      abrir = ok
    })
    const f = falsos(pronta)
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    const importados = [{ id: 'importado:farol', nome: 'Carimbo', imagem: IMAGEM }]
    r.atualizar(entrada('c1', [objeto('f', 100, 100, 'importado:farol'), objeto('s', 50, 50, 'sumido'), objeto('a', 10, 10)], importados))
    expect(filhos(r.camada, 'carimbos-corpos')).toHaveLength(1)
    abrir({ corpo: new Texture(), quadro: QUADRO_DO_IMPORTADO, sombra: {} as CanvasImageSource, chao: false })
    await pronta
    await Promise.resolve()
    const corpos = filhos(r.camada, 'carimbos-corpos')
    expect(corpos).toHaveLength(2)
    // A imagem importada fica centrada no ponto do clique.
    expect(corpos.find((s) => s.y === 100)?.anchor.y).toBeCloseTo(0.5)
    r.destruir()
  })

  it('o modo leve tira só a camada de sombras; os objetos ficam', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    r.atualizar(entrada('c1', [objeto('a', 100, 100)]))
    expect(filhos(r.camada, 'carimbos-sombras')).toHaveLength(1)
    r.atualizar(entrada('c1', [objeto('a', 100, 100)], undefined, false))
    expect(filhos(r.camada, 'carimbos-sombras')).toHaveLength(0)
    expect(filhos(r.camada, 'carimbos-corpos')).toHaveLength(1)
    r.destruir()
  })

  it('prévia: o spray mostra os novos por cima; a borracha apaga os que vão sair, e limpar devolve tudo', () => {
    const f = falsos()
    const r = createCarimbosRenderer({ assar: f.assar, pintarPedaco: f.pintarPedaco })
    r.atualizar(entrada('c1', [objeto('a', 10, 10), objeto('b', 20, 20)]))
    const rascunho = r.camada.getChildByLabel('carimbos-rascunho')
    if (rascunho === null) throw new Error('sem rascunho')
    r.mostrarPrevia([objeto('n1', 100, 100), objeto('n2', 140, 90)], new Set(), undefined)
    const [, corposDaPrevia] = rascunho.children
    expect(corposDaPrevia.children).toHaveLength(2)
    // Passo seguinte do spray: os que já estavam não são refeitos.
    const primeiro = corposDaPrevia.children[0]
    r.mostrarPrevia([objeto('n1', 100, 100), objeto('n2', 140, 90), objeto('n3', 180, 100)], new Set(), undefined)
    expect(corposDaPrevia.children).toHaveLength(3)
    expect(corposDaPrevia.children).toContain(primeiro)
    r.mostrarPrevia([], new Set(['a']), undefined)
    expect(corposDaPrevia.children).toHaveLength(0)
    const corpos = filhos(r.camada, 'carimbos-corpos')
    expect(corpos.find((s) => s.x === 10)?.alpha).toBeLessThan(0.5)
    expect(corpos.find((s) => s.x === 20)?.alpha).toBe(1)
    r.limparPrevia()
    expect(corpos.every((s) => s.alpha === 1)).toBe(true)
    r.destruir()
  })
})
