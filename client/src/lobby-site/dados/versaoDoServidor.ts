import { ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import { VERSAO_DO_FORMATO } from '../../lib/nuvem/tipos'
import type { Buscar } from './fonteReal'
import type { Site } from './lobbyStore'
import type { EstadoDaCampanha } from './sessaoDaCampanha'

/**
 * A CONFERÊNCIA DE VERSÃO NA ABERTURA DO SITE (docs/planos/lobby-jogadores-2026-11-05.md,
 * S4, §5.6 e Si10). Ao abrir, o site pergunta ao servidor (`GET /api/versao`,
 * respondido pelo Worker, `lobby/nuvem/src/encaminhar.ts`) que versão do
 * formato da operação ele fala, e compara com a deste site.
 *
 * O servidor aceita a versão dele e a anterior (N-1, `lobby/nuvem/src/pedidos.ts`):
 * o site velho que ficou aberto durante uma publicação ainda conversa. Então,
 * com versões diferentes, o site termina de mandar o que está na fila e só
 * depois pede para recarregar — recarregar antes deixaria a fila velha para um
 * site novo (Si10). Quando o servidor não aceita mais, o `ola` já volta
 * `versao` e a sessão para sozinha; esta conferência só adianta o aviso.
 */

export const ROTA_DA_VERSAO = '/api/versao'

/** O corpo do `/api/versao`; `null` = fora do formato. */
export function lerVersaoDoServidor(bruto: unknown): number | null {
  if (!ehRegistro(bruto)) return null
  const versao = proprio(bruto, 'versaoDoFormato')
  return typeof versao === 'number' && Number.isSafeInteger(versao) && versao >= 1 ? versao : null
}

/**
 * A versão do formato do servidor; `null` = não deu para saber (sem rede, sem
 * login, resposta torta). Sem ela fica valendo a conferência do `ola`.
 */
export async function buscarVersaoDoServidor(origem: string, buscar: Buscar): Promise<number | null> {
  let resposta: Response
  try {
    // `no-store`: depois de uma publicação, uma resposta guardada esconderia justamente a versão nova.
    resposta = await buscar(new URL(ROTA_DA_VERSAO, origem).toString(), {
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
  } catch (erro) {
    // O `fetch` rejeita com TypeError quando a rede falha; outro erro é defeito e sobe.
    if (erro instanceof TypeError) return null
    throw erro
  }
  if (!resposta.ok) return null
  try {
    return lerVersaoDoServidor(lerJsonSeguro(await resposta.text()))
  } catch (erro) {
    if (erro instanceof SyntaxError || erro instanceof TypeError) return null
    throw erro
  }
}

/** Ainda tem coisa a caminho ou esperando a pessoa: mudança, decisão, ou desfazer enviado ou pedindo confirmação. */
function temPendencia(campanha: EstadoDaCampanha): boolean {
  if (campanha.esperando > 0 || campanha.paraDecidir.length > 0) return true
  for (const situacao of campanha.desfazeres.values()) if (situacao.t === 'enviando' || situacao.t === 'confirmar') return true
  return false
}

/**
 * O estado da campanha como a tela deve ver: com versões diferentes, assim que
 * nada mais está pendente a faixa vira "O Lobby foi atualizado / Recarregar a
 * página" e a edição nova trava (a tela só edita `em-dia`). Antes disso, segue
 * igual, para a fila sair.
 */
export function comAVersaoDoServidor(campanha: EstadoDaCampanha, versaoDoServidor: number | null): EstadoDaCampanha {
  if (versaoDoServidor === null || versaoDoServidor === VERSAO_DO_FORMATO) return campanha
  if (campanha.conexao !== 'em-dia' || temPendencia(campanha)) return campanha
  return { ...campanha, conexao: 'versao' }
}

/**
 * Liga a conferência ao site (chamada uma vez, no `main.tsx`): pergunta a
 * versão na abertura e, daí em diante, passa cada estado da campanha que chega
 * ao store por `comAVersaoDoServidor`. O ouvinte entra antes do render, então
 * a tela já lê o estado conferido. A demo não tem servidor: fica de fora.
 */
export function conferirVersaoNaAbertura(site: Site, origem: string, buscar: Buscar = (url, pedido) => fetch(url, pedido)): void {
  if (site.store.getState().demo) return
  let versaoDoServidor: number | null = null
  const conferir = (): void => {
    const { campanha } = site.store.getState()
    if (campanha === null) return
    const vista = comAVersaoDoServidor(campanha, versaoDoServidor)
    // Só grava quando muda: o estado conferido volta igual daqui, e o ouvinte não entra em laço.
    if (vista !== campanha) site.store.setState({ campanha: vista })
  }
  site.store.subscribe(conferir)
  buscarVersaoDoServidor(origem, buscar)
    .then((versao) => {
      versaoDoServidor = versao
      conferir()
    })
    .catch((erro: unknown) => {
      // Só adianta o aviso: sem ela, o `ola` ainda recusa a versão que o servidor não aceita.
      console.warn('[lobby] a conferência de versão falhou', erro)
    })
}
