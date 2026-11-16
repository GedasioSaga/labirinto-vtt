import type { Canal } from '../../net/visaoDeTeste/canal'
import type { Personagem } from '../../lib/personagem'
import type { LigaCena, LigaFicha } from '../../lib/preparo/tipos'
import {
  lerRecadoDaMesa,
  motivoParaOFio,
  pedidoDoPreludio,
  type AbaDoVerbete,
  type AndamentoDoPor,
  type ComoVaiAoMapa,
  type CorpoDoPedido,
  type EstadoDaMesa,
  type ItemNaMesa,
  type MudancaNoPreparo,
  type SecaoParaOMapa,
  type TipoParaOMapa,
  type VerbeteParaOMapa,
} from './protocolo'

/**
 * O FIO, VISTO DA JANELA DO PRELÚDIO. Sem React e sem a loja: quem liga
 * (`JanelaDoPreludio.tsx`) entrega o que fazer com cada recado, e os testes
 * trocam o canal pelo par em memória.
 *
 * - Ao ligar, diz `ola`: a mesa responde com o estado e o foco que esperava.
 * - Um `ping` a cada `PING_MS`; sem `pong` por `VIVA_MS`, a faixa diz que a mesa
 *   não responde (a principal recarregou, ou travou).
 * - O link de cena e pino do roteiro vira `ir-a-mesa`; a mesa confere e responde.
 * - `salvar-agora` (a principal vai fechar): grava tudo e responde `gravou`.
 */

export const PING_MS = 2000
/** Quanto o "Virar NPC" espera a mesa gravar a ficha na pasta. */
const ESPERA_DA_FICHA_MS = 15000
export const MESA_NAO_GRAVOU_A_FICHA = 'A janela do mapa não respondeu a tempo. A ficha pode não ter sido gravada: confira na pasta.'
export const VIVA_MS = 6000

export interface DepsDoFio {
  sessao: string
  canal: Canal
  aoEstado: (estado: EstadoDaMesa) => void
  /** A mesa respondeu há pouco (`true`) ou sumiu (`false`). Só chama quando muda. */
  aoViva: (viva: boolean) => void
  /** O que a mesa recusou ou não conseguiu; `null` limpa. */
  aoAviso: (aviso: string | null) => void
  aoAbrirVerbete: (verbeteId: string, aba: AbaDoVerbete | null, secaoId: string | null) => void
  /** O andamento de um "Pôr no mapa" (P3). */
  aoPondo: (pedido: number, andamento: AndamentoDoPor, motivo: string | null) => void
  /** Os pinos ligados do mapa aberto (P3). */
  aoNaMesa: (itens: readonly ItemNaMesa[]) => void
  aoMudar: (mudanca: MudancaNoPreparo) => void
  /** Grava o que falta; `null` = tudo no disco. */
  salvarTudo: () => Promise<string | null>
  agora?: () => number
}

export interface FioDoPreludio {
  /** O link do roteiro: a mesa leva o mapa até a cena e o pino. */
  irAMesa(alvo: LigaCena): void
  /** Esta janela gravou algo em preparo/: a mesa relê. */
  avisarMudanca(mudanca: MudancaNoPreparo): void
  /** "Pôr no mapa" (P3): a mesa espera o clique do mestre. Devolve o número do pedido. */
  porNoMapa(fonte: SecaoParaOMapa, kind: TipoParaOMapa): number
  cancelarPor(pedido: number): void
  /** E3: o verbete inteiro vai ao mapa pelo tipo. Devolve o número do pedido (a resposta vem por `aoPondo`). */
  porVerbete(fonte: VerbeteParaOMapa, como: ComoVaiAoMapa, ficha: LigaFicha | null): number
  /** E3 "Virar NPC": a mesa grava a ficha na pasta. `null` = gravou; senão, o motivo. */
  gravarFicha(pastaId: string, personagem: Personagem): Promise<string | null>
  /** "Ler agora" (P4): a mesa lê o "!" para todos da cena dele e responde com `resposta` (o aviso, se não deu). */
  lerAgora(alvo: LigaCena): void
  desligar(): void
}

export function ligarFioDoPreludio(deps: DepsDoFio): FioDoPreludio {
  const agora = deps.agora ?? (() => Date.now())
  let ligado = true
  let ultimoPong = Number.NEGATIVE_INFINITY
  let viva = false
  let n = 0
  let pedidos = 0
  /** Os "gravar-ficha" esperando a `resposta` da mesa, pelo número do pedido. */
  const esperandoFicha = new Map<number, (motivo: string | null) => void>()

  const enviar = (corpo: CorpoDoPedido) => {
    if (ligado) deps.canal.enviar(pedidoDoPreludio(deps.sessao, corpo))
  }
  const conferirVida = () => {
    const agoraViva = agora() - ultimoPong < VIVA_MS
    if (agoraViva === viva) return
    viva = agoraViva
    deps.aoViva(viva)
  }

  const pararDeOuvir = deps.canal.ouvir((dado) => {
    const recado = lerRecadoDaMesa(dado, deps.sessao)
    if (recado === null || !ligado) return
    switch (recado.tipo) {
      case 'estado':
        deps.aoEstado(recado.estado)
        return
      case 'pong':
        ultimoPong = agora()
        conferirVida()
        return
      case 'abrir-verbete':
        deps.aoAbrirVerbete(recado.verbeteId, recado.aba, recado.secaoId)
        return
      case 'pondo':
        deps.aoPondo(recado.pedido, recado.andamento, recado.motivo)
        return
      case 'na-mesa':
        deps.aoNaMesa(recado.itens)
        return
      case 'resposta': {
        const daFicha = esperandoFicha.get(recado.pedido)
        if (daFicha !== undefined) {
          esperandoFicha.delete(recado.pedido)
          daFicha(recado.ok ? null : (recado.motivo ?? 'A mesa não gravou a ficha.'))
          return
        }
        deps.aoAviso(recado.ok ? null : (recado.motivo ?? 'A mesa não abriu este link.'))
        return
      }
      case 'mudou':
        deps.aoMudar(recado.mudanca)
        return
      case 'salvar-agora': {
        const { pedido } = recado
        void deps.salvarTudo().then(
          (motivo) => enviar({ tipo: 'gravou', pedido, motivo: motivo === null ? null : motivoParaOFio(motivo) }),
          (erro: unknown) => enviar({ tipo: 'gravou', pedido, motivo: motivoParaOFio(erro instanceof Error ? erro.message : String(erro)) }),
        )
        return
      }
    }
  })

  enviar({ tipo: 'ola' })
  const relogio = setInterval(() => {
    n += 1
    enviar({ tipo: 'ping', n })
    conferirVida()
  }, PING_MS)

  return {
    irAMesa(alvo) {
      pedidos += 1
      enviar({ tipo: 'ir-a-mesa', pedido: pedidos, alvo })
    },
    avisarMudanca(mudanca) {
      enviar({ tipo: 'mudou', mudanca })
    },
    porNoMapa(fonte, kind) {
      pedidos += 1
      enviar({ tipo: 'por-no-mapa', pedido: pedidos, fonte, kind })
      return pedidos
    },
    cancelarPor(pedido) {
      enviar({ tipo: 'cancelar-por', pedido })
    },
    porVerbete(fonte, como, ficha) {
      pedidos += 1
      enviar({ tipo: 'por-verbete', pedido: pedidos, fonte, como, ficha })
      return pedidos
    },
    gravarFicha(pastaId, personagem) {
      pedidos += 1
      const pedido = pedidos
      return new Promise<string | null>((resolver) => {
        const prazo = setTimeout(() => {
          esperandoFicha.delete(pedido)
          resolver(MESA_NAO_GRAVOU_A_FICHA)
        }, ESPERA_DA_FICHA_MS)
        esperandoFicha.set(pedido, (motivo) => {
          clearTimeout(prazo)
          resolver(motivo)
        })
        enviar({ tipo: 'gravar-ficha', pedido, pastaId, personagem })
      })
    },
    lerAgora(alvo) {
      pedidos += 1
      enviar({ tipo: 'ler-agora', pedido: pedidos, alvo })
    },
    desligar() {
      ligado = false
      for (const responder of esperandoFicha.values()) responder(MESA_NAO_GRAVOU_A_FICHA)
      esperandoFicha.clear()
      clearInterval(relogio)
      pararDeOuvir()
    },
  }
}
