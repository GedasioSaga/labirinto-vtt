import type { CampanhaNoApp } from '../../stores/nuvemStore'

/**
 * O INDICADOR "Lobby: tudo salvo / 3 esperando rede" (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.6, fatia A6). Lê a situação que o sincronizador espelha no `nuvemStore`;
 * a frase diz o que falta e por quê, nunca só um ícone.
 */

export type TomDoIndicador = 'ok' | 'trabalhando' | 'atencao' | 'erro'

export interface LeituraDoIndicador {
  tom: TomDoIndicador
  texto: string
  /** O que a pessoa pode fazer, quando há o que fazer. */
  dica: string | null
}

function esperandoTexto(n: number): string {
  return n === 1 ? '1 mudança' : `${n} mudanças`
}

export function lerIndicador(campanha: CampanhaNoApp): LeituraDoIndicador {
  const { rede, esperando, paraDecidir, mensagem } = campanha
  if (paraDecidir.length > 0) {
    const n = paraDecidir.length
    return { tom: 'erro', texto: `Lobby: ${n} para decidir`, dica: 'Veja em Mudanças para decidir, logo abaixo.' }
  }
  switch (rede) {
    case 'conectando':
      return { tom: 'trabalhando', texto: esperando > 0 ? `Lobby: conectando, ${esperandoTexto(esperando)} na fila` : 'Lobby: conectando…', dica: null }
    case 'ok':
      return esperando > 0 ? { tom: 'trabalhando', texto: `Lobby: enviando ${esperandoTexto(esperando)}…`, dica: null } : { tom: 'ok', texto: 'Lobby: tudo salvo', dica: null }
    case 'sem-rede':
      return { tom: 'atencao', texto: esperando > 0 ? `Lobby: ${esperando} esperando rede` : 'Lobby: sem rede', dica: mensagem ?? 'As mudanças ficam guardadas no disco e sobem quando a internet voltar.' }
    case 'sem-credencial':
      return { tom: 'atencao', texto: esperando > 0 ? `Lobby: ${esperando} esperando o token` : 'Lobby: falta o token', dica: 'Cole o token em Conta na nuvem; as mudanças guardadas sobem em seguida.' }
    case 'versao':
      return { tom: 'erro', texto: 'Lobby: atualize o app', dica: mensagem ?? 'O servidor usa outro formato. As mudanças continuam guardadas no disco.' }
    case 'nao-existe':
      return { tom: 'erro', texto: 'Lobby: campanha não encontrada', dica: mensagem ?? 'O servidor não achou esta campanha para a sua conta.' }
    case 'erro':
      return { tom: 'erro', texto: 'Lobby: parado', dica: mensagem ?? 'O servidor respondeu fora do esperado. As mudanças continuam guardadas no disco.' }
  }
}

function Icone({ tom }: { tom: TomDoIndicador }) {
  if (tom === 'trabalhando') return <span className="lby-giro" aria-hidden="true" />
  return (
    <svg className="lby-ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {tom === 'ok' ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M8 2.5l6 11H2zM8 6.5v3.2M8 11.8v.1" />}
    </svg>
  )
}

/** A dica fica à vista, não num `title`: no teclado e no toque o `title` não aparece. */
export function IndicadorDoLobby({ campanha }: { campanha: CampanhaNoApp }) {
  const leitura = lerIndicador(campanha)
  return (
    <div className="lby-sinc-bloco" role="status">
      <p className="lby-sinc" data-tom={leitura.tom}>
        <Icone tom={leitura.tom} />
        <span>{leitura.texto}</span>
      </p>
      {leitura.dica !== null && <p className="lby-sinc__dica">{leitura.dica}</p>}
    </div>
  )
}
