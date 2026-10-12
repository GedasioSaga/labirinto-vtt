import type { DancaAoVivo } from '../net/dancaNoHost'
import type { HostBridge } from '../net/hostBridge'
import type { EstadoDaVisao } from '../net/visaoDeTeste/visaoDeTeste'
import type { DancaAoVivoProps, JogadorDaDanca } from './DancaAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA A DANÇA: a ponte da sala de verdade ou a
 * ponte de TESTE da Visão de jogador. Com o teste aberto, o teste ganha, mesmo
 * com a sala aberta ao lado: o mestre está testando a dança sozinho, então o
 * painel lista só o jogador de teste (marcado "Teste ·", para ninguém o
 * confundir com um jogador da mesa), lê a dança do teste e manda tudo à ponte
 * de teste. Fechar o teste devolve o painel à sala.
 */

/** Os comandos da dança que o painel manda (os mesmos nas duas pontes). */
export type PonteDaDanca = Pick<HostBridge, 'convidarParaDanca' | 'comecarDanca' | 'pausarDanca' | 'retomarDanca' | 'encerrarDanca'>

/** A dança ao vivo como o painel do pino a recebe (`MinigameControls`). */
export type DancaNoPainel = Omit<DancaAoVivoProps, 'pinId'>

/** Como o jogador de teste aparece na lista do "Chamar para dançar". */
export const PREFIXO_DO_TESTE = 'Teste · '

interface FonteDaDanca {
  players: readonly JogadorDaDanca[]
  danca: DancaAoVivo | null
  /** Lida na hora de cada comando: a ponte de teste é outra a cada geração, e a da sala pode ter fechado. */
  ponte: () => PonteDaDanca | null
}

export interface SalaDaDanca extends FonteDaDanca {
  aberta: boolean
}

export interface TesteDaDanca {
  estado: EstadoDaVisao
  ponte: () => PonteDaDanca | null
}

/** Sem ponte agora (sala fechada, teste entre gerações), o convite volta `null` e o resto `false`: o painel diz que não deu. */
function dancaPela(pinId: string, fonte: FonteDaDanca): DancaNoPainel {
  return {
    players: fonte.players,
    danca: fonte.danca,
    onConvidar: (playerIds) => fonte.ponte()?.convidarParaDanca(pinId, playerIds) ?? null,
    onComecar: () => fonte.ponte()?.comecarDanca() ?? false,
    onPausar: () => fonte.ponte()?.pausarDanca() ?? false,
    onRetomar: () => fonte.ponte()?.retomarDanca() ?? false,
    onEncerrar: () => fonte.ponte()?.encerrarDanca() ?? false,
  }
}

/** A dança ao vivo do painel do pino `pinId`; `null` = nem teste nem sala abertos (o painel pede para abrir a sala). */
export function dancaNoPainel(pinId: string, teste: TesteDaDanca, sala: SalaDaDanca): DancaNoPainel | null {
  if (teste.estado.aberta) {
    const players = teste.estado.jogadores.map(({ playerId, name }) => ({ playerId, name: `${PREFIXO_DO_TESTE}${name}` }))
    return dancaPela(pinId, { players, danca: teste.estado.danca, ponte: teste.ponte })
  }
  return sala.aberta ? dancaPela(pinId, sala) : null
}
