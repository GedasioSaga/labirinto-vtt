import { useSyncExternalStore } from 'react'
import { CENARIO_DURACAO_MAX_S, CENARIO_DURACAO_MIN_S, idDeEstiloDeCenarioValido, type CenarioDoPino } from './catalogo'

/**
 * ESTILOS DE CENÁRIO (Fase D, 09/10/2026) — o registro das animações da imagem
 * do pino "!" que chegam de FORA, no pacote baixado do GitHub (Fase B). A
 * panorâmica (`AnimacaoCenario.tsx`) é embutida e não passa por aqui: ela é
 * componente React, funciona sem internet e é o que toca quando o estilo
 * gravado no pino falta ou falha.
 *
 * `registrarEstiloDeCenario` recebe `unknown` de propósito: o módulo do pacote
 * é JavaScript carregado em tempo de execução, e o tipo declarado não garante
 * nada sobre ele. Mesma forma e mesmos cuidados de `portas/animacoesDePorta.ts`.
 */

export interface OpcoesDeEstilo {
  /** O sistema pede menos movimento: o estilo deve ficar parado ou quase. */
  reduzirMovimento: boolean
  /** 0 a 1; 0 = mudo. Vale só na criação (o contrato não tem ajuste no meio). */
  volume: number
}

export interface InstanciaDeEstilo {
  /** Desenha o quadro do instante `tS`, em segundos desde o começo. Cresce de 0 até a duração; nunca volta. */
  atualizar(tS: number): void
  /**
   * O quadro mudou de tamanho DEPOIS do `criar`. O app já trocou
   * `canvas.width`/`canvas.height`; os números são esses mesmos, em px físicos.
   */
  ajustarTela?(largura: number, altura: number): void
  /** Solta tudo (som, timers, texturas). Chamado uma vez, no fim ou ao fechar. */
  descartar(): void
}

export interface EstiloDeCenario {
  /** Vai no pino (`CenarioDoPino.estilo`) e no disco: `ID_DE_ESTILO_DE_CENARIO`. */
  id: string
  /** Nome no seletor "Estilo" do painel do pino. */
  nome: string
  /** Duração quando o mestre deixa o campo vazio. Dentro do teto do cenário. */
  duracaoNaturalS: number
  /** Instante bom para a miniatura da galeria. Ausente = quem desenha escolhe. */
  quadroDaMiniaturaS?: number
  /**
   * Monta o estilo no `canvas` (já com o tamanho do quadro, em px físicos) sobre
   * a imagem do pino. Quem anima é o app: chama `atualizar` a cada quadro.
   */
  criar(canvas: HTMLCanvasElement, imagem: HTMLImageElement | ImageBitmap, opcoes: OpcoesDeEstilo): InstanciaDeEstilo
}

/** Nome longo demais quebraria o seletor do painel (o mesmo teto das portas). */
export const NOME_DE_ESTILO_MAX = 60

/**
 * Ids que nenhum pacote pode tomar: "panoramica" é a embutida, e um estilo de
 * fora com esse id faria o seletor mostrar duas opções com o mesmo nome.
 */
export const IDS_DE_ESTILO_RESERVADOS: readonly string[] = ['panoramica']

/** Na ordem em que chegaram. A referência só muda quando o registro muda. */
let lista: readonly EstiloDeCenario[] = []
const SEM_ESTILOS: readonly EstiloDeCenario[] = lista
const ouvintes = new Set<() => void>()

/** Os estilos de fora, para o seletor. Serve de `getSnapshot` para `useSyncExternalStore`. */
export function listarEstilosDeCenario(): readonly EstiloDeCenario[] {
  return lista
}

/** Avisa quando um estilo entra ou sai do registro. Devolve o cancelamento. */
export function assinarEstilosDeCenario(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** O estilo do id, ou `null` = a panorâmica (ausente, ou de um pacote que este app ainda não tem). */
export function estiloDeCenario(id: string | undefined): EstiloDeCenario | null {
  if (id === undefined) return null
  return lista.find((estilo) => estilo.id === id) ?? null
}

/**
 * A lista viva para a tela: o painel aberto e a animação tocando passam a ver
 * o estilo que o pacote registrar depois, sem reabrir nada.
 */
export function useEstilosDeCenario(): readonly EstiloDeCenario[] {
  return useSyncExternalStore(assinarEstilosDeCenario, listarEstilosDeCenario)
}

/** Duração que toca: a do mestre, senão a natural do estilo. */
export function duracaoDoEstiloS(cenario: CenarioDoPino, estilo: EstiloDeCenario): number {
  return cenario.duracaoS ?? estilo.duracaoNaturalS
}

function trocarLista(nova: readonly EstiloDeCenario[]): void {
  lista = nova
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * Confere em tempo de execução o que o `criar` de fora devolveu e embrulha os
 * métodos. Forma errada LANÇA: quem toca (`AnimacaoDeEstilo.tsx`) pega o erro
 * e cai para a panorâmica. Os métodos são chamados com `this` = o objeto
 * devolvido, porque um estilo pode ser instância de classe.
 */
function instanciaConferida(valor: unknown, id: string): InstanciaDeEstilo {
  if (typeof valor !== 'object' || valor === null) throw new Error(`estilo de cenário ${id}: criar não devolveu um objeto`)
  if (!('atualizar' in valor) || typeof valor.atualizar !== 'function') throw new Error(`estilo de cenário ${id}: sem atualizar`)
  if (!('descartar' in valor) || typeof valor.descartar !== 'function') throw new Error(`estilo de cenário ${id}: sem descartar`)
  const atualizar = valor.atualizar
  const descartar = valor.descartar
  const instancia: InstanciaDeEstilo = {
    atualizar: (tS) => {
      Reflect.apply(atualizar, valor, [tS])
    },
    descartar: () => {
      Reflect.apply(descartar, valor, [])
    },
  }
  if ('ajustarTela' in valor && typeof valor.ajustarTela === 'function') {
    const ajustarTela = valor.ajustarTela
    instancia.ajustarTela = (largura, altura) => {
      Reflect.apply(ajustarTela, valor, [largura, altura])
    }
  }
  return instancia
}

/**
 * Registra um estilo vindo de FORA (pacote da Fase B). Confere tudo em tempo
 * de execução e recusa, devolvendo `false`, o que não tem a forma do contrato.
 * Id reservado ou já registrado também é recusado: o primeiro fica. O pacote
 * novo inteiro troca o anterior por `esquecerEstilosDeCenarioDeFora` antes.
 *
 * O `criar` de fora é chamado por `Reflect.apply`, sem `this`: o contrato é uma
 * função solta, e assim o tipo `Function` do `typeof` serve sem afirmar uma
 * assinatura que não dá para conferir.
 */
export function registrarEstiloDeCenario(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || !idDeEstiloDeCenarioValido(info.id)) return false
  const id = info.id
  if (IDS_DE_ESTILO_RESERVADOS.includes(id)) return false
  if (lista.some((estilo) => estilo.id === id)) return false
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_ESTILO_MAX) return false
  if (!('duracaoNaturalS' in info) || typeof info.duracaoNaturalS !== 'number') return false
  const duracaoNaturalS = info.duracaoNaturalS
  if (!Number.isFinite(duracaoNaturalS) || duracaoNaturalS < CENARIO_DURACAO_MIN_S || duracaoNaturalS > CENARIO_DURACAO_MAX_S) return false
  if (!('criar' in info) || typeof info.criar !== 'function') return false
  const criarDeFora = info.criar
  const estilo: EstiloDeCenario = {
    id,
    nome,
    duracaoNaturalS,
    criar: (canvas, imagem, opcoes) => instanciaConferida(Reflect.apply(criarDeFora, undefined, [canvas, imagem, opcoes]), id),
  }
  // A miniatura é só um palpite de enquadramento: fora da animação, some e o estilo entra assim mesmo.
  if ('quadroDaMiniaturaS' in info) {
    const quadro = info.quadroDaMiniaturaS
    if (typeof quadro === 'number' && Number.isFinite(quadro) && quadro >= 0 && quadro <= duracaoNaturalS) estilo.quadroDaMiniaturaS = quadro
  }
  trocarLista([...lista, estilo])
  return true
}

/** Tira todos os estilos de fora (o pacote novo substitui o anterior inteiro). */
export function esquecerEstilosDeCenarioDeFora(): void {
  if (lista === SEM_ESTILOS) return
  trocarLista(SEM_ESTILOS)
}
