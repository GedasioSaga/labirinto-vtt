import { personagemDoArquivo, type Personagem } from '../personagem'
import { lerSistemaDeRpg, type SistemaDeRpg } from '../sistemaDeRpg'
import { compararBuild, rodarSerie, type AvisoDeProgresso } from './cemLutas'
import type { TetosDaLuta } from './fimDaLuta'
import type { LutadoresDoTreino, VagaDoTreino } from './mesaEmMemoria'
import { ehLado, ehRegistro, type PedidoAoWorker, type RespostaDoWorker } from './protocoloDasLutas'

/**
 * O LADO DO WORKER DAS LUTAS (LOBBY v2, fatia T4 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): lê o pedido da página,
 * roda as 100 lutas (ou o comparar build) e responde com o progresso e o
 * resultado, pelo `enviar` que o worker dá (`lutas.worker.ts`). Separado do
 * worker para o vitest rodar o mesmo atendimento sem thread.
 *
 * O `data` da mensagem chega sem tipo: o pedido é relido pelas leituras de
 * sempre (`personagemDoArquivo`, `lerSistemaDeRpg`), e o que não lê vira
 * resposta de erro, nunca exceção solta no worker.
 */

/** O relógio do worker (`performance.now`); o teste dá o dele. */
export type Relogio = () => number

function vagaDoFio(valor: unknown): VagaDoTreino | null {
  if (!ehRegistro(valor) || !ehLado(valor.lado)) return null
  const { id, personagemId, tokenId, origem } = valor
  if (typeof id !== 'string' || typeof personagemId !== 'string' || typeof tokenId !== 'string' || typeof origem !== 'string') return null
  return { id, lado: valor.lado, personagemId, tokenId, origem }
}

/** Cada item pela leitura dele; um torto recusa a lista inteira (a luta não começa pela metade). */
function listaDoFio<T>(valor: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(valor)) return null
  const doFio: readonly unknown[] = valor
  const lidos: T[] = []
  for (const item of doFio) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

function lutadoresDoFio(valor: unknown): LutadoresDoTreino | null {
  if (!ehRegistro(valor)) return null
  const vagas = listaDoFio(valor.vagas, vagaDoFio)
  const personagens = listaDoFio<Personagem>(valor.personagens, personagemDoArquivo)
  return vagas === null || personagens === null ? null : { vagas, personagens }
}

/** `null` = o pedido vem sem sistema (vale: a luta lê sem livro); `undefined` = sistema torto. */
function sistemaDoFio(valor: unknown): SistemaDeRpg | null | undefined {
  if (valor === null) return null
  const lido = lerSistemaDeRpg(valor)
  return lido.ok ? lido.sistema : undefined
}

/** Tetos ausentes = os de sempre (`null` aqui); números tortos são recusados depois por `fimDaLuta`. */
function tetosDoFio(valor: unknown): TetosDaLuta | null | undefined {
  if (valor === undefined) return null
  if (!ehRegistro(valor) || typeof valor.rodadas !== 'number' || typeof valor.passos !== 'number') return undefined
  return { rodadas: valor.rodadas, passos: valor.passos }
}

/** O pedido relido; forma torta = `null` (a semente torta passa e é recusada pelo `rodarSerie`, com a razão). */
export function pedidoDoFio(valor: unknown): PedidoAoWorker | null {
  if (!ehRegistro(valor) || !ehRegistro(valor.pedido)) return null
  const { pedido } = valor
  const sistema = sistemaDoFio(pedido.sistema)
  const tetosLidos = tetosDoFio(pedido.tetos)
  if (sistema === undefined || tetosLidos === undefined || typeof pedido.semente !== 'number') return null
  const comum = { sistema, semente: pedido.semente, ...(tetosLidos === null ? {} : { tetos: tetosLidos }) }
  if (valor.tipo === 'serie') {
    const lutadores = lutadoresDoFio(pedido.lutadores)
    return lutadores === null ? null : { tipo: 'serie', pedido: { ...comum, lutadores } }
  }
  if (valor.tipo === 'comparar') {
    const atual = lutadoresDoFio(pedido.atual)
    const rascunho = lutadoresDoFio(pedido.rascunho)
    if (atual === null || rascunho === null || !ehLado(pedido.lado)) return null
    return { tipo: 'comparar', pedido: { ...comum, atual, rascunho, lado: pedido.lado } }
  }
  return null
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * Atende UM pedido: progresso a cada luta, depois o resultado com o tempo das
 * lutas, ou um erro (pedido torto, semente torta, ficha que a batalha recusa).
 * Síncrono: as lutas são um laço só, e quem quer parar fecha o worker.
 */
export function atenderPedido(valor: unknown, enviar: (resposta: RespostaDoWorker) => void, agora: Relogio): void {
  const lido = pedidoDoFio(valor)
  if (lido === null) {
    enviar({ tipo: 'erro', motivo: 'pedido das lutas com forma inválida' })
    return
  }
  const aviso: AvisoDeProgresso = (feitas, total) => enviar({ tipo: 'progresso', feitas, total })
  const inicio = agora()
  try {
    if (lido.tipo === 'serie') {
      const resultado = rodarSerie(lido.pedido, aviso)
      enviar({ tipo: 'serie', resultado, ms: agora() - inicio })
    } else {
      const comparacao = compararBuild(lido.pedido, aviso)
      enviar({ tipo: 'comparar', comparacao, ms: agora() - inicio })
    }
  } catch (erro) {
    enviar({ tipo: 'erro', motivo: textoDoErro(erro) })
  }
}
