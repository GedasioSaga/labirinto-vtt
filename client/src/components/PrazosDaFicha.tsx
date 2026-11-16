import { chaveDaCondicao } from '../lib/condicaoPorNome'
import { PRAZO_POR_VEZ_MAX, PRAZO_TURNOS_MAX, porCondicaoNaFicha, tirarCondicaoDaFicha, type PrazoPedido } from '../lib/prazoDaCondicao'
import { TOKEN_CONDITION_LABELS } from '../lib/tokenConditions'
import { pastilhasAcesas, type PastilhaAcesa } from '../lib/turnoForaDaBatalha'
import { useCondicoesPropriasStore } from '../stores/condicoesPropriasStore'
import { useMapStore } from '../stores/mapStore'
import type { Token } from '../types/map'
import { Botao } from './grimorio/Botao'
import { CampoNum } from './grimorio/CampoNum'
import { PastilhaDeCondicao } from './PastilhaDeCondicao'
import './TurnoForaDaBatalha.css'

/** O veneno: a pastilha que mostra "Perde N PV" mesmo sem vida por turno ainda. */
const CHAVE_DO_VENENO = chaveDaCondicao(TOKEN_CONDITION_LABELS.envenenado)
const CHAVE_DO_LENTO = chaveDaCondicao(TOKEN_CONDITION_LABELS.lento)
/** As de fábrica que a armadilha usa: acesas, mostram o editor mesmo sem prazo (o "+" cria um). */
const EDITOR_SEM_PRAZO: ReadonlySet<string> = new Set([CHAVE_DO_VENENO, CHAVE_DO_LENTO])

export const SEM_PRAZO_NOTA = 'Sem prazo: fica até alguém tirar.'
export const LENTO_NOTA = 'Anda metade do passo da cena enquanto durar.'

/**
 * O pedido de prazo para `turnos` e `porVez` do editor. `null` = sem prazo
 * (a condição fica até alguém tirar). "Perde" sem turnos começa em 1 turno:
 * vida por turno só existe dentro de um prazo.
 */
export function prazoDoEditor(turnos: number, porVez: number): PrazoPedido | null {
  if (turnos <= 0 && porVez <= 0) return null
  const comTurnos = Math.max(1, turnos)
  return porVez > 0 ? { turnos: comTurnos, porVez } : { turnos: comTurnos }
}

function EditorDoPrazo({ tokenId, pastilha }: { tokenId: string; pastilha: PastilhaAcesa }) {
  const { nome, prazo, chave } = pastilha
  const turnos = prazo?.turnos ?? 0
  const porVez = prazo?.porVez ?? 0
  const mudar = (mudanca: (token: Token) => Token): void => useMapStore.getState().mudarCondicoesDaFicha(tokenId, mudanca)
  // A ficha de AGORA (o passe do turno pode ter descontado no meio): o prazo pedido vale por inteiro, e renova.
  const gravar = (novosTurnos: number, novaPorVez: number): void => {
    const pedido = prazoDoEditor(novosTurnos, novaPorVez)
    const catalogo = useCondicoesPropriasStore.getState().catalogo
    mudar((token) => (pedido === null ? porCondicaoNaFicha(token, nome, catalogo) : porCondicaoNaFicha(token, nome, catalogo, pedido)))
  }
  const mostraPerde = chave === CHAVE_DO_VENENO || porVez > 0
  return (
    <div className="gr-prazo" role="group" aria-label={`Prazo de ${nome}`}>
      <div className="gr-prazo__cab">
        <PastilhaDeCondicao symbol={pastilha.symbol} />
        <span className="gr-prazo__nome">{nome}</span>
        <Botao variante="fantasma" tamanho="p" aria-label={`Tirar ${nome}`} onClick={() => mudar((token) => tirarCondicaoDaFicha(token, nome))}>
          Tirar
        </Botao>
      </div>
      {/* Faltam 0 = sem prazo; com veneno, zerar os turnos também zera o "Perde" (vida por turno só vive no prazo). */}
      <CampoNum rotulo="Faltam" unidade="turnos" valor={turnos} min={0} max={PRAZO_TURNOS_MAX} nome={`os turnos de ${nome}`} onChange={(valor) => gravar(valor, valor <= 0 ? 0 : porVez)} />
      {mostraPerde && (
        <CampoNum rotulo="Perde" unidade="PV a cada turno" valor={porVez} min={0} max={PRAZO_POR_VEZ_MAX} nome={`a vida por turno de ${nome}`} onChange={(valor) => gravar(turnos, valor)} />
      )}
      {turnos === 0 && <p className="gr-nota">{SEM_PRAZO_NOTA}</p>}
      {chave === CHAVE_DO_LENTO && <p className="gr-nota">{LENTO_NOTA}</p>}
    </div>
  )
}

/**
 * O PRAZO DAS CONDIÇÕES na ficha "Condições" (Fase C, item 4; protótipo
 * aprovado em 15/11/2026): sob as pastilhas, um bloco por pastilha acesa com
 * prazo, com "Faltam N turnos", "Perde N PV a cada turno" e "Tirar". Envenenado
 * e Lento acesos à mão sem prazo também mostram o bloco, em "Faltam 0" (sem
 * prazo, o de sempre): só o "+" do mestre cria o prazo. Cada mudança é um
 * passo do Ctrl+Z (`mudarCondicoesDaFicha`).
 */
export function PrazosDaFicha({ tokenId }: { tokenId: string }) {
  const token = useMapStore((state) => state.map.tokens.find((candidato) => candidato.id === tokenId))
  if (token === undefined) return null
  const editaveis = pastilhasAcesas(token).filter((pastilha) => pastilha.prazo !== null || EDITOR_SEM_PRAZO.has(pastilha.chave))
  if (editaveis.length === 0) return null
  return (
    <div className="gr-prazos">
      {editaveis.map((pastilha) => (
        <EditorDoPrazo key={pastilha.chave} tokenId={tokenId} pastilha={pastilha} />
      ))}
    </div>
  )
}
