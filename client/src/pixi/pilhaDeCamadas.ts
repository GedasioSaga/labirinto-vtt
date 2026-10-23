/**
 * A PILHA DE CAMADAS do editor (fatia 3 de `docs/planos/camadas-fase3-2026-10-22.md`,
 * "Ordem e render"). `ordemDeRender` diz a altura de cada par (faixa, camada);
 * aqui isso vira a lista de filhos do `world`.
 *
 * - Cada faixa tem o container de HOJE (o nó-base): ele serve a primeira
 *   entrada da faixa com camadas nativas dela. Mover uma camada padrão só muda
 *   o lugar desse nó na lista de filhos: nada repinta.
 * - Par que não é o de hoje (item de outro tipo numa camada, camada livre,
 *   faixa dividida que se separou) ganha um nó CRIADO, só enquanto tem itens.
 * - Faixa dividida (Paredes e Portas nas linhas e nas paredes; Objetos e
 *   Decoração nos móveis) com opacidades diferentes se separa em um nó por
 *   camada, de baixo para cima na ordem da lista: a opacidade é a do nó.
 * - Opacidade: `alpha` do nó = opacidade própria da faixa (escada secreta,
 *   telhado transparente) x opacidade da camada. Faixa fixa não é tocada.
 *
 * Não sabe de Pixi: o pai é qualquer coisa com `children`, `addChildAt` e
 * `removeChild` (o `Container` serve; o teste passa um falso).
 */
import type { CamadaId, ModeloDeCamadas } from '../types/map'
import { ordemDeRender, type EntradaDaOrdem, type Faixa, type ParDeFaixa } from '../lib/camadas/ordem'
import { ALFA_DO_TELHADO_TRANSPARENTE } from '../stores/telhadosNoEditor'

/** O pedaço do `Container` do Pixi que a pilha usa. */
export interface PaiDaPilha<N> {
  readonly children: readonly N[]
  addChildAt(no: N, indice: number): N
  removeChild(no: N): N
}

/** Um nó da pilha: a faixa, as camadas cujos itens desenham nele e se é o container de hoje. */
export interface NoPlanejado {
  readonly chave: string
  readonly faixa: string
  readonly camadas: readonly CamadaId[]
  readonly base: boolean
}

/** O que decide a pilha: a lista de camadas, as opacidades e os pares que têm itens agora. */
export interface EntradaDaPilha {
  readonly modelo: ModeloDeCamadas
  readonly alfa: (camada: CamadaId) => number
  /** Os pares (faixa, camada) com itens. Os nativos só contam para criar o nó de uma faixa que se separou. */
  readonly pares: readonly ParDeFaixa[]
}

/** Um nó de uma faixa já montado, para distribuir os itens. */
export interface NoDaFaixa<N> {
  readonly no: N
  readonly camadas: readonly CamadaId[]
  readonly base: boolean
}

function chaveDoPar(faixa: string, camada: CamadaId): string {
  return `${faixa}|${camada}`
}

/** Faixa dividida com opacidades diferentes vira uma entrada por camada, na ordem da entrada. */
function separarPorAlfa(ordem: readonly EntradaDaOrdem[], alfa: (camada: CamadaId) => number): EntradaDaOrdem[] {
  return ordem.flatMap((entrada) => {
    if (entrada.camadas.length < 2) return [entrada]
    const primeira = alfa(entrada.camadas[0])
    if (entrada.camadas.every((c) => alfa(c) === primeira)) return [entrada]
    return entrada.camadas.map((camada) => ({ faixa: entrada.faixa, camadas: [camada] }))
  })
}

/**
 * Os nós da pilha, de baixo para cima. O nó-base de cada faixa sempre entra
 * (é o container de hoje); nó criado só entra se alguma camada dele tem itens
 * naquela faixa. Com o modelo padrão, sem pares de outro tipo e com as
 * opacidades iguais, é um nó-base por faixa, na ordem das faixas.
 */
export function planejarPilha(faixas: readonly Faixa[], entrada: EntradaDaPilha): NoPlanejado[] {
  const ordem = separarPorAlfa(ordemDeRender(entrada.modelo, faixas, entrada.pares), entrada.alfa)
  const nativas = new Map(faixas.map((f) => [f.id, new Set<CamadaId>(f.camadas)]))
  const comItens = new Set(entrada.pares.map((par) => chaveDoPar(par.faixa, par.camada)))
  const comBase = new Set<string>()
  const plano: NoPlanejado[] = []
  for (const { faixa, camadas } of ordem) {
    const daFaixa = nativas.get(faixa)
    // Faixa fixa (camadas vazias) é nativa por definição.
    const nativa = daFaixa !== undefined && camadas.every((c) => daFaixa.has(c))
    if (nativa && !comBase.has(faixa)) {
      comBase.add(faixa)
      plano.push({ chave: faixa, faixa, camadas, base: true })
      continue
    }
    if (!camadas.some((c) => comItens.has(chaveDoPar(faixa, c)))) continue
    plano.push({ chave: `${faixa}|${camadas.join('+')}`, faixa, camadas, base: false })
  }
  return plano
}

/**
 * Põe os nós de `desejados` na ordem pedida entre os filhos de `pai`, com o
 * mínimo de mexida: um nó que já está acima do anterior fica onde está.
 * Filho que não está na lista (a exportação de imagem põe um por instantes)
 * não é tocado. Devolve quantos nós mudaram de lugar ou entraram.
 */
export function ordenarFilhos<N>(pai: PaiDaPilha<N>, desejados: readonly N[]): number {
  let anterior = -1
  let mexidos = 0
  for (const no of desejados) {
    const atual = pai.children.indexOf(no)
    if (atual > anterior) {
      anterior = atual
      continue
    }
    mexidos += 1
    if (atual === -1) {
      anterior += 1
      pai.addChildAt(no, anterior)
      continue
    }
    // Sair de antes do anterior desce o anterior um índice: entrar em `anterior` cai logo acima dele.
    pai.addChildAt(no, anterior)
  }
  return mexidos
}

export interface OpcoesDaPilha<N> {
  readonly pai: PaiDaPilha<N>
  readonly faixas: readonly Faixa[]
  /** O container de hoje da faixa. */
  readonly base: (faixa: string) => N
  /** Cria o nó de um par que não é o de hoje (Graphics ou Container, como o da faixa). */
  readonly criar: (plano: NoPlanejado) => N
  /** Solta um nó criado que esvaziou (tira do pai antes de chamar). */
  readonly descartar: (no: N, plano: NoPlanejado) => void
  /** A opacidade da faixa antes da camada (escada secreta, telhado transparente); 1 no resto. */
  readonly alfaProprio: (faixa: string) => number
  readonly lerAlfa: (no: N) => number
  readonly definirAlfa: (no: N, alfa: number) => void
}

export interface Pilha<N> {
  /**
   * Replaneja e, se a ordem dos nós mudou, remonta (cria, move, descarta).
   * Opacidade é sempre conferida: mudar só ela não remonta nem repinta.
   * Devolve quantos nós mudaram de lugar ou entraram (0 = só conferiu).
   */
  atualizar(entrada: EntradaDaPilha): number
  /** Os nós da faixa, de baixo para cima. Antes do primeiro `atualizar`, só o de hoje. */
  nosDaFaixa(faixa: string): readonly NoDaFaixa<N>[]
  /**
   * Muda só quando muda que camadas desenham em que nó (nunca na troca de
   * ordem pura nem na de opacidade): entra no portão de repintura das
   * camadas que distribuem itens por nó.
   */
  assinatura(): string
  /** Quantos nós criados existem agora (fora os de hoje). */
  criados(): number
  /** Solta todos os nós criados (desmonte). */
  destruir(): void
}

export function criarPilha<N>(opcoes: OpcoesDaPilha<N>): Pilha<N> {
  const { pai, faixas, base } = opcoes
  const criados = new Map<string, { no: N; plano: NoPlanejado }>()
  let plano: NoPlanejado[] = faixas.map((f) => ({ chave: f.id, faixa: f.id, camadas: f.camadas, base: true }))
  let porFaixa = agrupar(plano)
  let ordemAtual = plano.map((p) => p.chave).join(',')
  let assinaturaAtual = assinar(plano)

  function noDe(p: NoPlanejado): N {
    if (p.base) return base(p.faixa)
    const pronto = criados.get(p.chave)
    if (pronto !== undefined) return pronto.no
    const novo = opcoes.criar(p)
    criados.set(p.chave, { no: novo, plano: p })
    return novo
  }

  function agrupar(nos: readonly NoPlanejado[]): Map<string, NoPlanejado[]> {
    const mapa = new Map<string, NoPlanejado[]>()
    for (const p of nos) {
      const lista = mapa.get(p.faixa)
      if (lista === undefined) mapa.set(p.faixa, [p])
      else lista.push(p)
    }
    return mapa
  }

  function assinar(nos: readonly NoPlanejado[]): string {
    return nos
      .filter((p) => p.camadas.length > 0)
      .map((p) => `${p.chave}:${p.camadas.join('+')}`)
      .sort()
      .join(',')
  }

  function aplicarAlfa(entrada: EntradaDaPilha): void {
    for (const p of plano) {
      if (p.camadas.length === 0) continue
      const no = noDe(p)
      const alfa = opcoes.alfaProprio(p.faixa) * entrada.alfa(p.camadas[0])
      if (opcoes.lerAlfa(no) !== alfa) opcoes.definirAlfa(no, alfa)
    }
  }

  return {
    atualizar(entrada) {
      const novo = planejarPilha(faixas, entrada)
      const ordemNova = novo.map((p) => p.chave).join(',')
      let mexidos = 0
      if (ordemNova !== ordemAtual) {
        plano = novo
        porFaixa = agrupar(plano)
        ordemAtual = ordemNova
        assinaturaAtual = assinar(plano)
        mexidos = ordenarFilhos(pai, plano.map(noDe))
        const vivas = new Set(plano.map((p) => p.chave))
        for (const [chave, { no, plano: dele }] of criados) {
          if (vivas.has(chave)) continue
          criados.delete(chave)
          pai.removeChild(no)
          opcoes.descartar(no, dele)
        }
      }
      aplicarAlfa(entrada)
      return mexidos
    },
    nosDaFaixa(faixa) {
      return (porFaixa.get(faixa) ?? []).map((p) => ({ no: noDe(p), camadas: p.camadas, base: p.base }))
    },
    assinatura: () => assinaturaAtual,
    criados: () => criados.size,
    destruir() {
      for (const { no, plano: dele } of criados.values()) {
        pai.removeChild(no)
        opcoes.descartar(no, dele)
      }
      criados.clear()
    },
  }
}

/** Os itens que vão para um nó da faixa. */
export interface Balde<N, T> {
  readonly no: N
  readonly itens: T[]
}

/**
 * Divide os itens de uma faixa pelos nós dela, sem mudar a ordem relativa.
 * CAMINHO RÁPIDO: faixa com um nó só devolve o PRÓPRIO array (mesma
 * referência para os portões `Object.is` de `shapesRedraw.ts`), sem olhar
 * item nenhum. Item de camada sem nó na faixa (não deveria acontecer: par com
 * item ganha nó) cai no nó de hoje. Todo nó sai na lista, vazio ou não: quem
 * pinta limpa o que esvaziou.
 */
export function distribuir<N, T>(itens: T[], nos: readonly NoDaFaixa<N>[], camadaDe: (item: T) => CamadaId): Balde<N, T>[] {
  if (nos.length === 1) return [{ no: nos[0].no, itens }]
  const indiceDaBase = Math.max(0, nos.findIndex((n) => n.base))
  const porCamada = new Map<CamadaId, number>()
  nos.forEach((n, i) => {
    for (const c of n.camadas) if (!porCamada.has(c)) porCamada.set(c, i)
  })
  const baldes: T[][] = nos.map(() => [])
  for (const item of itens) baldes[porCamada.get(camadaDe(item)) ?? indiceDaBase].push(item)
  return nos.map((n, i) => ({ no: n.no, itens: baldes[i] }))
}

/** Um renderer com estado (cache de sprite, relógio, gradiente) por nó da faixa. */
export interface PorNo<N, R> {
  /** O do nó: o de hoje no container de hoje; nos criados, nasce na primeira pintura. */
  de(no: N): R
  /** O nó criado foi descartado: o renderer dele sai junto (o de hoje nunca). */
  soltar(no: N): void
  todos(): R[]
}

export function criarPorNo<N, R>(base: N, deHoje: R, criar: () => R, soltarRenderer: (renderer: R) => void): PorNo<N, R> {
  const mapa = new Map<N, R>([[base, deHoje]])
  return {
    de(no) {
      const pronto = mapa.get(no)
      if (pronto !== undefined) return pronto
      const novo = criar()
      mapa.set(no, novo)
      return novo
    },
    soltar(no) {
      const renderer = mapa.get(no)
      if (renderer === undefined || no === base) return
      mapa.delete(no)
      soltarRenderer(renderer)
    },
    todos: () => [...mapa.values()],
  }
}

/** Um par por faixa e camada presente nos itens (sem repetir). */
export function paresDosItens<T>(faixa: string, itens: readonly T[], camadaDe: (item: T) => CamadaId): ParDeFaixa[] {
  const vistas = new Set<CamadaId>()
  for (const item of itens) vistas.add(camadaDe(item))
  return [...vistas].map((camada) => ({ faixa, camada }))
}

/** TELHADOS no editor: a opacidade da camada vezes o atalho "Transparente" do mestre. */
export function alfaDoTelhadoNoEditor(opacidade: number, transparente: boolean): number {
  return opacidade * (transparente ? ALFA_DO_TELHADO_TRANSPARENTE : 1)
}
