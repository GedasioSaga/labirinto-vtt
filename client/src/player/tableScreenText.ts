import type { PlayerState } from './playerConnection'

/**
 * O que a TELA DA MESA diz quando não está mostrando o mapa. Separado do
 * componente para ser testável sem o canvas: a TV fica longe de todo mundo e
 * quase nunca tem teclado, então cada estado precisa dizer o que acontece e,
 * quando der, resolver sozinho (a queda de rede tenta de novo).
 */
export interface TableScreenText {
  text: string
  tone: 'info' | 'error'
  /** Botão da tela: reconectar agora, ou voltar para digitar o código. */
  action: 'reconnect' | 'change_code' | null
  /** Tenta reconectar sozinha depois de um tempo. */
  retry: boolean
}

export function tableScreenText(state: Pick<PlayerState, 'status' | 'error'>, code: string): TableScreenText {
  switch (state.status) {
    case 'connecting':
      return { text: `Procurando a sala ${code} na rede…`, tone: 'info', action: null, retry: false }
    case 'waiting':
    case 'playing':
      // `playing` sem mapa é o instante antes do primeiro snapshot.
      return { text: 'Tela da mesa conectada. O mestre escolhe a cena que aparece aqui, na aba Jogo.', tone: 'info', action: null, retry: false }
    case 'kicked':
      return { text: 'O mestre desconectou esta tela.', tone: 'info', action: 'change_code', retry: false }
    case 'closed':
      return { text: 'O mestre encerrou a sala.', tone: 'info', action: 'change_code', retry: false }
    case 'error': {
      const reason = state.error ?? 'unknown'
      if (reason === 'connection_lost') return { text: 'A conexão com o mestre caiu. Tentando de novo…', tone: 'error', action: 'reconnect', retry: true }
      if (reason === 'bad_code') return { text: `Código de sala incorreto (${code}). Confira com o mestre.`, tone: 'error', action: 'change_code', retry: false }
      // Link sem a chave da tela (código digitado à mão, link de outra sala): trocar o código não resolve.
      if (reason === 'bad_table_key')
        return { text: 'Este link não abre a tela da mesa. Abra nesta tela o link que aparece na aba Jogo do mestre.', tone: 'error', action: null, retry: false }
      if (reason === 'table_full') return { text: 'A sala já tem telas da mesa demais. Feche uma delas e tente de novo.', tone: 'error', action: 'reconnect', retry: false }
      return { text: `Erro: ${reason}`, tone: 'error', action: 'change_code', retry: false }
    }
  }
}
