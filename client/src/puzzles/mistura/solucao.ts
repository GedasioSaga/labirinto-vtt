/**
 * O CAMINHO MAIS CURTO DA MISTURA (28/11): uma busca em largura pelos estados
 * da bancada, do começo para a frente, com os mesmos gestos do jogador (encher
 * na torneira, esvaziar na pia, despejar de um no outro). Serve ao editor:
 * todo alvo que ela acha é alcançável de verdade, e o primeiro caminho que o
 * acha é o mais curto. Por isso o editor só deixa escolher alvos daqui, e o
 * puzzle sempre tem solução.
 *
 * Só água (volumes e receita): o estado é o número de litros de cada
 * recipiente, guardado num número só (base mista), sem criar listas por passo;
 * cabe inteiro (no máximo 11^5 estados). Nas cores o estado é a mistura de
 * cada recipiente, e a busca para em `ESTADOS_MAX`: o que ela achou até ali
 * continua certo e mais curto (é largura), só pode faltar alvo muito fundo.
 *
 * Puro: sem React, sem rede.
 */
import { LIQUIDOS_DA_MISTURA } from '../tipos'
import type { MisturaDoPuzzle } from '../tipos'
import { AGUA, comecoDaMistura, despejo, menorProporcao, NOME_DO_LIQUIDO, partesVazias, total } from './mistura'

/** Um gesto da bancada (o receptáculo fica de fora: é o último passo de todo caminho). */
export interface PassoDaMistura {
  de: number | 'fonte'
  para: number | 'ralo'
}

/** Um alvo que a bancada alcança: o caminho mais curto até um recipiente o ter, e qual. */
export interface AlvoAlcancavel {
  /** Volumes: `[litros, 0, …]`. Cores: a proporção, nos menores números. */
  partes: number[]
  recipiente: number
  caminho: PassoDaMistura[]
}

export interface BuscaDaMistura {
  /** Litros de água num recipiente -> o caminho mais curto. */
  litros: Map<number, AlvoAlcancavel>
  /** A proporção ("0:1:1:0:0") -> o caminho mais curto. */
  cores: Map<string, AlvoAlcancavel>
  /** `false` = a busca das cores parou no teto (alvos muito fundos podem faltar). */
  completa: boolean
}

/** O teto de estados da busca das cores. */
const ESTADOS_MAX = 40_000

export function chaveDaCor(partes: readonly number[]): string {
  return menorProporcao(partes).join(':')
}

// ------------------------------------------------------------------ só água: base mista, sem criar listas

function buscarAgua(mistura: Pick<MisturaDoPuzzle, 'recipientes' | 'fonte'>): BuscaDaMistura {
  const caps = mistura.recipientes.map((r) => r.capacidade)
  const n = caps.length
  const pesos: number[] = []
  let tamanho = 1
  for (const cap of caps) {
    pesos.push(tamanho)
    tamanho *= cap + 1
  }
  const comeco = comecoDaMistura(mistura).map((r) => total(r.partes))
  const chaveDoComeco = comeco.reduce((chave, litros, i) => chave + litros * (pesos[i] ?? 0), 0)
  const pai = new Int32Array(tamanho).fill(-1)
  // O passo que chegou aqui: de (0..n-1, n = torneira) e para (0..n-1, n = pia), num número só.
  const veio = new Int32Array(tamanho)
  const fila = new Int32Array(tamanho)
  pai[chaveDoComeco] = chaveDoComeco
  let inicio = 0
  let fim = 0
  fila[fim++] = chaveDoComeco
  const litros = new Map<number, AlvoAlcancavel>()
  const achados = new Map<number, { chave: number; recipiente: number }>()
  const agora = new Int32Array(n)

  const anotar = (chave: number) => {
    for (let i = 0; i < n; i++) {
      const l = Math.floor(chave / (pesos[i] ?? 1)) % ((caps[i] ?? 0) + 1)
      if (l > 0 && !achados.has(l)) achados.set(l, { chave, recipiente: i })
    }
  }
  const visitar = (chave: number, de: number, origem: number, para: number) => {
    if (pai[chave] !== -1) return
    pai[chave] = origem
    veio[chave] = de * (n + 1) + para
    fila[fim++] = chave
    anotar(chave)
  }

  anotar(chaveDoComeco)
  while (inicio < fim) {
    const chave = fila[inicio++] ?? 0
    for (let i = 0; i < n; i++) agora[i] = Math.floor(chave / (pesos[i] ?? 1)) % ((caps[i] ?? 0) + 1)
    for (let i = 0; i < n; i++) {
      const li = agora[i] ?? 0
      const ci = caps[i] ?? 0
      const pi = pesos[i] ?? 0
      if (mistura.fonte && li < ci) visitar(chave + (ci - li) * pi, n, chave, i)
      if (li > 0) visitar(chave - li * pi, i, chave, n)
      if (li === 0) continue
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const lj = agora[j] ?? 0
        const m = Math.min(li, (caps[j] ?? 0) - lj)
        if (m > 0) visitar(chave - m * pi + m * (pesos[j] ?? 0), i, chave, j)
      }
    }
  }

  const caminhoAte = (chave: number): PassoDaMistura[] => {
    const passos: PassoDaMistura[] = []
    let atual = chave
    while (atual !== chaveDoComeco) {
      const codigo = veio[atual] ?? 0
      const de = Math.floor(codigo / (n + 1))
      const para = codigo % (n + 1)
      passos.push({ de: de === n ? 'fonte' : de, para: para === n ? 'ralo' : para })
      atual = pai[atual] ?? chaveDoComeco
    }
    return passos.reverse()
  }
  for (const [l, { chave, recipiente }] of achados) {
    const partes = partesVazias()
    partes[AGUA] = l
    litros.set(l, { partes, recipiente, caminho: caminhoAte(chave) })
  }
  return { litros, cores: new Map(), completa: true }
}

// ------------------------------------------------------------------ as cores: a mistura de cada recipiente

function buscarCores(mistura: Pick<MisturaDoPuzzle, 'recipientes'>): BuscaDaMistura {
  const caps = mistura.recipientes.map((r) => r.capacidade)
  const n = caps.length
  const estados: number[][][] = [comecoDaMistura(mistura).map((r) => r.partes)]
  const pais: number[] = [-1]
  const passos: (PassoDaMistura | null)[] = [null]
  const vistos = new Map<string, number>([[JSON.stringify(estados[0]), 0]])
  const cores = new Map<string, { estado: number; recipiente: number; partes: number[] }>()

  const anotar = (id: number) => {
    const estado = estados[id] ?? []
    estado.forEach((partes, recipiente) => {
      if (total(partes) === 0) return
      const chave = chaveDaCor(partes)
      if (!cores.has(chave)) cores.set(chave, { estado: id, recipiente, partes: menorProporcao(partes) })
    })
  }
  anotar(0)
  let completa = true
  for (let atual = 0; atual < estados.length; atual++) {
    if (estados.length >= ESTADOS_MAX) {
      completa = false
      break
    }
    const estado = estados[atual] ?? []
    const novo = (proximo: number[][], passo: PassoDaMistura) => {
      const chave = JSON.stringify(proximo)
      if (vistos.has(chave)) return
      vistos.set(chave, estados.length)
      estados.push(proximo)
      pais.push(atual)
      passos.push(passo)
      anotar(estados.length - 1)
    }
    for (let i = 0; i < n; i++) {
      const de = estado[i] ?? partesVazias()
      if (total(de) === 0) continue
      novo(
        estado.map((partes, k) => (k === i ? partesVazias() : partes)),
        { de: i, para: 'ralo' },
      )
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const resultado = despejo(de, estado[j] ?? partesVazias(), caps[j] ?? 0)
        if (resultado.litros === 0) continue
        novo(
          estado.map((partes, k) => (k === i ? resultado.de : k === j ? resultado.para : partes)),
          { de: i, para: j },
        )
      }
    }
  }

  const caminhoAte = (id: number): PassoDaMistura[] => {
    const caminho: PassoDaMistura[] = []
    let atual = id
    while (atual > 0) {
      const passo = passos[atual]
      if (passo !== null && passo !== undefined) caminho.push(passo)
      atual = pais[atual] ?? 0
    }
    return caminho.reverse()
  }
  const achadas = new Map<string, AlvoAlcancavel>()
  for (const [chave, { estado, recipiente, partes }] of cores) achadas.set(chave, { partes, recipiente, caminho: caminhoAte(estado) })
  return { litros: new Map(), cores: achadas, completa }
}

// ------------------------------------------------------------------ o que o editor pergunta

const guardadas = new Map<string, BuscaDaMistura>()
const GUARDADAS_MAX = 16

/** A busca da bancada, guardada pela bancada (o editor pergunta a cada desenho). */
export function buscarNaBancada(mistura: Pick<MisturaDoPuzzle, 'modo' | 'recipientes' | 'fonte'>): BuscaDaMistura {
  const chave = JSON.stringify([mistura.modo === 'cores', mistura.recipientes, mistura.fonte])
  const pronta = guardadas.get(chave)
  if (pronta !== undefined) return pronta
  const busca = mistura.modo === 'cores' ? buscarCores(mistura) : buscarAgua(mistura)
  if (guardadas.size >= GUARDADAS_MAX) guardadas.delete(guardadas.keys().next().value ?? '')
  guardadas.set(chave, busca)
  return busca
}

/**
 * O caminho mais curto até o alvo de agora (sem o último passo, o receptáculo,
 * nem os ingredientes da receita). `null` = o alvo não tem solução com esta bancada.
 */
export function caminhoDoAlvo(mistura: MisturaDoPuzzle): AlvoAlcancavel | null {
  const busca = buscarNaBancada(mistura)
  if (mistura.modo === 'cores') return busca.cores.get(chaveDaCor(mistura.cor)) ?? null
  if (mistura.litros !== null) return busca.litros.get(mistura.litros) ?? null
  // A receita com qualquer quantidade: o caminho mais curto até ter água em algum recipiente.
  let melhor: AlvoAlcancavel | null = null
  for (const alvo of busca.litros.values()) if (melhor === null || alvo.caminho.length < melhor.caminho.length) melhor = alvo
  return melhor
}

/**
 * A bancada com um alvo que tem solução: se o mestre mudou os recipientes e o
 * alvo ficou fora de alcance, ele vira o alcançável mais perto (a quantidade
 * mais próxima, ou a cor de proporção mais parecida). Sem nada alcançável (sem
 * água nenhuma), volta igual: o editor avisa.
 */
export function comAlvoAlcancavel(mistura: MisturaDoPuzzle): MisturaDoPuzzle {
  if (caminhoDoAlvo(mistura) !== null) return mistura
  const busca = buscarNaBancada(mistura)
  if (mistura.modo === 'cores') {
    const fracao = (partes: readonly number[]) => partes.map((p) => p / Math.max(1, total(partes)))
    const pedida = fracao(mistura.cor)
    let melhor: number[] | null = null
    let distancia = Infinity
    for (const alvo of busca.cores.values()) {
      const d = fracao(alvo.partes).reduce((acc, f, i) => acc + (f - (pedida[i] ?? 0)) ** 2, 0)
      if (d < distancia) {
        distancia = d
        melhor = menorProporcao(alvo.partes)
      }
    }
    return melhor === null ? mistura : { ...mistura, cor: melhor }
  }
  const litros = [...busca.litros.keys()]
  if (litros.length === 0) return mistura
  const pedido = mistura.litros ?? 0
  const perto = litros.reduce((a, b) => (Math.abs(b - pedido) < Math.abs(a - pedido) || (Math.abs(b - pedido) === Math.abs(a - pedido) && b < a) ? b : a))
  return { ...mistura, litros: perto }
}

/** Quantos passos o jogador dá, no mínimo: os gestos, os ingredientes e o receptáculo. `null` = sem solução. */
export function passosMinimos(mistura: MisturaDoPuzzle): number | null {
  const caminho = caminhoDoAlvo(mistura)
  if (caminho === null) return null
  return caminho.caminho.length + (mistura.modo === 'receita' ? mistura.ingredientes.length : 0) + 1
}

function nomeDoRecipiente(i: number, mistura: Pick<MisturaDoPuzzle, 'recipientes' | 'modo'>): string {
  const capacidade = mistura.recipientes[i]?.capacidade ?? 0
  return `${mistura.modo === 'volumes' ? 'a jarra' : 'o frasco'} ${i + 1} (${capacidade} L)`
}

/** O passo em português, para o editor ("Encha a jarra 2 (5 L) na torneira."). */
export function textoDoPasso(passo: PassoDaMistura, mistura: Pick<MisturaDoPuzzle, 'recipientes' | 'modo'>): string {
  if (passo.de === 'fonte') return `Encha ${nomeDoRecipiente(typeof passo.para === 'number' ? passo.para : 0, mistura)} na torneira.`
  const de = nomeDoRecipiente(passo.de, mistura)
  if (passo.para === 'ralo') return `Esvazie ${de} na pia.`
  return `Despeje ${de} n${mistura.modo === 'volumes' ? 'a' : 'o'} ${passo.para + 1}.`
}

/** "2 de vermelho e 1 de amarelo": a proporção do alvo de cor, para o mestre. */
export function textoDaProporcao(partes: readonly number[]): string {
  const ditos = partes.flatMap((p, i) => (p > 0 ? [`${p} de ${NOME_DO_LIQUIDO[LIQUIDOS_DA_MISTURA[i] ?? 'agua'].toLocaleLowerCase('pt-BR')}`] : []))
  if (ditos.length <= 1) return ditos.join('')
  return `${ditos.slice(0, -1).join(', ')} e ${ditos[ditos.length - 1]}`
}
