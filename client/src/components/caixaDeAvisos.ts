import type { ToastMessage } from '../stores/toastStore'

/**
 * CAIXA DE PEDIDOS (PEDIDOS.md, G4 — "Fila grupo espalhado").
 *
 * Mesa de 4 a 7 jogadores: vários pedidos de passagem chegam juntos, e três
 * avisos soltos empilhados no canto viram uma coluna de "Deixar ir" que o
 * mestre precisa caçar um por um. Aqui mora a regra, pura, de quando os
 * avisos de um mesmo `grupo` se juntam numa caixa só e de como "Deixar todos"
 * responde cada um. `Toast.tsx` só desenha o que sai daqui.
 */

/** Um item da pilha de avisos: o aviso de sempre, ou a caixa de um grupo. */
export type ItemDaPilha =
  | { tipo: 'aviso'; toast: ToastMessage }
  | { tipo: 'caixa'; grupo: string; toasts: ToastMessage[] }

/**
 * A partir de quantos avisos do mesmo grupo eles viram uma caixa. Um só
 * continua o aviso de hoje — salvo se ele for `sempreEmCaixa` (ver `formaCaixa`).
 */
export const MINIMO_PARA_CAIXA = 2

/**
 * O grupo vira caixa com `MINIMO_PARA_CAIXA` avisos, ou com um só quando algum
 * deles pede a caixa sempre (o pedido da porta trancada: "Pedidos (1)"). Um
 * pedido de passagem sozinho continua o aviso de hoje, como G4 decidiu.
 */
function formaCaixa(membros: readonly ToastMessage[]): boolean {
  return membros.length >= MINIMO_PARA_CAIXA || membros.some((toast) => toast.sempreEmCaixa === true)
}

/**
 * Junta os avisos de mesmo `grupo` numa caixa quando `formaCaixa` diz que sim;
 * o resto passa como aviso solto, na ordem de chegada.
 *
 * As caixas vão para o TOPO da pilha: são perguntas que alguém espera, e os
 * avisos soltos só relatam. Também é o que impede o texto de um aviso antigo
 * ("Bruno entrou…") de vir antes das linhas da caixa e se misturar a elas
 * para quem lê a pilha em sequência — leitor de tela ou busca por texto.
 */
export function agruparAvisos(toasts: readonly ToastMessage[]): ItemDaPilha[] {
  const porGrupo = new Map<string, ToastMessage[]>()
  for (const toast of toasts) {
    if (toast.grupo === undefined) continue
    const membros = porGrupo.get(toast.grupo)
    if (membros === undefined) porGrupo.set(toast.grupo, [toast])
    else membros.push(toast)
  }
  const caixas: ItemDaPilha[] = []
  const soltos: ItemDaPilha[] = []
  const caixaJaPosta = new Set<string>()
  for (const toast of toasts) {
    const membros = toast.grupo === undefined ? undefined : porGrupo.get(toast.grupo)
    if (toast.grupo === undefined || membros === undefined || !formaCaixa(membros)) {
      soltos.push({ tipo: 'aviso', toast })
      continue
    }
    if (caixaJaPosta.has(toast.grupo)) continue
    caixaJaPosta.add(toast.grupo)
    caixas.push({ tipo: 'caixa', grupo: toast.grupo, toasts: urgentesPrimeiro(membros) })
  }
  return [...caixas, ...soltos]
}

/**
 * Dentro da caixa, o aviso `urgente` (o chamado "Urgente") sobe para o topo;
 * entre iguais vale a ordem de chegada (o `sort` é estável).
 */
function urgentesPrimeiro(membros: ToastMessage[]): ToastMessage[] {
  return [...membros].sort((a, b) => Number(b.urgente === true) - Number(a.urgente === true))
}

/** A caixa só oferece "Deixar todos" quando algum aviso dela tem resposta em lote. */
export function temRespostaEmLote(toasts: readonly ToastMessage[]): boolean {
  return toasts.some((toast) => toast.actions?.some((action) => action.emLote === true) === true)
}

/** O título da caixa, que é também o nome acessível dela: "Pedidos (3)". */
export function tituloDaCaixa(grupo: string, quantos: number): string {
  return `${grupo} (${quantos})`
}

/**
 * "Deixar todos": para cada aviso da caixa, o MESMO caminho do botão da linha
 * — tira o aviso da tela e roda a ação marcada `emLote` (o "Deixar ir"). Cada
 * pedido se revalida sozinho do lado de quem responde: o que falhar vira
 * recusa só para o jogador dele.
 *
 * Um aviso que lança não trava os outros: os seguintes ainda são respondidos,
 * e o primeiro erro é relançado no fim — calar a falha deixaria um jogador
 * olhando "Aguardando o mestre…" sem ninguém saber por quê. Aviso sem ação
 * `emLote` fica onde está: não há resposta em lote a dar a ele.
 */
export function deixarTodos(toasts: readonly ToastMessage[], dispensar: (id: string) => void): void {
  let primeiroErro: { erro: unknown } | null = null
  for (const toast of toasts) {
    const acao = toast.actions?.find((action) => action.emLote === true)
    if (acao === undefined) continue
    // Tira da tela ANTES de agir, igual ao botão da linha (`Toast.tsx`).
    dispensar(toast.id)
    try {
      acao.run()
    } catch (erro) {
      if (primeiroErro === null) primeiroErro = { erro }
    }
  }
  if (primeiroErro !== null) throw primeiroErro.erro
}
