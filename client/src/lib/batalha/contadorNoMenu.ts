import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { travaDoContador } from './condicoes'
import { contadorDoPersonagem, motivoDoContador, nivelDoContador, temGolpeEsperando } from './contador'
import type { TurnosDaCena } from './turnos'

/**
 * O CONTADOR DA FICHA NO MENU DA CARTA do mestre (a Polaridade do Vagn; R5 do
 * lote de 01/11), lido num lugar só: carregar gasta a reação até a vez dela;
 * zerar é só do mestre. A faixa do mapa e a Arena tinham a mesma conta e os
 * mesmos textos, cada uma na sua cópia (unificação do combate, 10/11/2026).
 * Daqui sai o que o menu MOSTRA; o que fazer ao escolher é de quem monta (o
 * pedido `contador` com o `tipo` 'ganhar' ou 'zerar' sobre `pedido`).
 */
export interface ContadorNoMenu {
  /** A ficha e a técnica do contador: quem monta soma o `tipo` ('ganhar' ou 'zerar'). */
  pedido: { tokenId: string; cartaoId: string }
  ganhar: { rotulo: string; detalhe: string; desabilitado: boolean }
  /** Só com o nível acima de 0. */
  zerar: { rotulo: string; detalhe: string } | null
}

/** O contador de `personagem` na carta de `tokenId`; `null` = a ficha não tem contador. */
export function contadorNoMenu(tokenId: string, personagem: Personagem, sistema: SistemaDeRpg, turnos: TurnosDaCena): ContadorNoMenu | null {
  const contador = contadorDoPersonagem(personagem, sistema)
  if (contador === null) return null
  const { nome, danoPorNivel } = contador.leitura
  const nivel = nivelDoContador(turnos, tokenId, contador.cartao.id)
  const maximo = danoPorNivel.length
  const motivo = motivoDoContador('ganhar', nivel, maximo, turnos.combate?.[personagem.id]?.semReacao === true, temGolpeEsperando(turnos.golpes, tokenId))
  // S4: Atordoado ou Paralisado não reage, então não carrega (a store recusa igual).
  const travado = travaDoContador((turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId))
  const detalhe =
    travado ??
    (motivo === 'semReacao'
      ? 'Já gastou a reação: volta na vez dela'
      : motivo === 'golpeEsperando'
        ? 'Tem golpe esperando a reação: responda antes de carregar'
        : motivo === 'noMaximo'
          ? 'Já está no máximo'
          : `Perde a reação até a vez dela; nível ${nivel + 1} soma +${danoPorNivel[nivel] ?? 0} de dano`)
  return {
    pedido: { tokenId, cartaoId: contador.cartao.id },
    ganhar: { rotulo: `Carregar ${nome} (${nivel} de ${maximo})`, detalhe, desabilitado: travado !== null || motivo !== null },
    zerar: nivel > 0 ? { rotulo: `Zerar ${nome}`, detalhe: 'Volta a 0 e o dano a mais sai; entra no registro' } : null,
  }
}
