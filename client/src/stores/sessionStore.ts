import { create } from 'zustand'
import type { MapData } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * FRENTE D (onda 2, plano de refinamento — item 11: NÃO PERDER TRABALHO).
 *
 * Flag "tem alteração não salva". `mapStore.ts` é proibido de editar aqui —
 * a flag é derivada de FORA, assinando `state.map` por `subscribeWithSelector`
 * (mesmo mecanismo de `gridSubscription.ts`/`propsSubscription.ts`/
 * `backgroundSubscription.ts`). `state.map` só troca de *referência* dentro
 * de `mapStore.ts` quando uma action passa por `withHistory` (toda mudança
 * de CONTEÚDO do mapa) ou por `loadMap` — ferramenta ativa, câmera e seleção
 * não tocam `map`, então esta flag nunca dispara por navegação/UI, só por
 * edição ou troca de mapa.
 *
 * `lastSyncedMap` guarda a referência de `map` no último ponto em que o
 * estado em memória é sabido igual ao do disco (`markSaved()` grava essa
 * referência — a do mapa que foi para o disco — e recalcula `isDirty`). Comparar por referência — não recalcular
 * "sujo" a cada tick — resolve de graça o caso de desfazer até voltar
 * exatamente à versão salva: `map` volta a ser a MESMA referência que
 * `lastSyncedMap`, logo `isDirty` volta a `false`, sem precisar de
 * comparação profunda de conteúdo.
 */

interface SessionState {
  /** `true` quando `map` já mudou desde o último `markSaved()`. */
  isDirty: boolean
  /**
   * Chamar depois de gravar com sucesso (`saveMapToPath`/`saveMapToAppData`)
   * OU depois de carregar um mapa do disco com sucesso (`loadMapFromDisk` +
   * `loadMap`) — as duas situações significam "o mapa em memória está em
   * sincronia com um arquivo", mesmo efeito sobre esta flag.
   *
   * `saved` é o mapa que de fato foi para o disco. Gravar é assíncrono e o
   * editor não trava: sem ele, o mapa de AGORA — que pode ter uma edição
   * feita durante a gravação — viraria a referência "salva" sem estar no
   * arquivo. Com ele, `isDirty` fica `true` se o mapa já mudou desde então.
   * Ausente = o mapa de agora (carregar do disco, mapa recém-criado).
   */
  markSaved: (saved?: MapData) => void
}

/**
 * Módulo-singleton de propósito: existe por toda a vida do processo (não há
 * "desmontar a sessão" enquanto o app roda), então não precisa ir dentro do
 * estado do Zustand — só o BOOLEANO derivado (`isDirty`) precisa ser
 * reativo para a UI/close-handler consumirem.
 */
let lastSyncedMap: MapData | null = null

export const useSessionStore = create<SessionState>()((set) => ({
  isDirty: false,
  markSaved: (saved) => {
    const current = useMapStore.getState().map
    lastSyncedMap = saved ?? current
    set({ isDirty: current !== lastSyncedMap })
  },
}))

/**
 * Grava o mapa aberto com `write` e marca como salvo SÓ o que foi gravado: o
 * mapa é lido antes do `await`, e o que o mestre mudar enquanto o disco grava
 * continua como não salvo. Se `write` falha, nada é marcado.
 */
export async function saveOpenMap<T>(write: (map: MapData) => Promise<T>): Promise<T> {
  const saved = useMapStore.getState().map
  const result = await write(saved)
  useSessionStore.getState().markSaved(saved)
  return result
}

/**
 * Liga a assinatura que alimenta `isDirty`. Chamar UMA VEZ, fora de
 * qualquer componente Pixi — o consumidor natural é `App.tsx` (raiz da
 * aplicação, vive por toda a sessão), não `PixiCanvas.tsx`. Devolve a
 * função de cancelamento, mesmo contrato de `subscribeToGridRedraw` etc.,
 * para caber num `useEffect(() => subscribeToDirtyFlag(), [])`.
 *
 * Guarda `lastSyncedMap` só na PRIMEIRA chamada (`=== null`): sob
 * StrictMode do React, o efeito de montagem roda→desmonta→monta de novo
 * antes de qualquer interação do usuário, e reancorar a baseline na segunda
 * montagem apagaria silenciosamente uma "sujeira" real que porventura já
 * existisse entre as duas — não existe na prática (as duas montagens
 * acontecem de volta, sem o usuário poder editar entre elas), mas o guard
 * custa uma comparação e deixa a garantia explícita em vez de "sabemos que
 * não acontece".
 */
export function subscribeToDirtyFlag(): () => void {
  if (lastSyncedMap === null) {
    lastSyncedMap = useMapStore.getState().map
  }
  return useMapStore.subscribe(
    (state) => state.map,
    (map) => {
      useSessionStore.setState({ isDirty: map !== lastSyncedMap })
    },
  )
}
