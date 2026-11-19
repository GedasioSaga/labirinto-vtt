import type { AcoesDoModelo } from '../components/LayersPanel'
import { temRpgNoMapa, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'

/**
 * @deprecated MAPA JÁ É AVENTURA (leva 18/11): o app não pergunta mais. Fica só porque testes antigos
 * ainda importam o texto; sai quando a fase final reescrever esses testes.
 */
export const PERGUNTA_VIRAR_AVENTURA = 'Para guardar sistema e fichas, este mapa vira uma aventura e passa a ter lista de cenas (o mapa continua igual). Transformar?'

/** @deprecated Como `PERGUNTA_VIRAR_AVENTURA`: o app não pergunta mais. */
export const PERGUNTA_VIRAR_AVENTURA_CAMADAS = 'A lista de camadas fica guardada na aventura: este mapa vira uma aventura e passa a ter lista de cenas (o mapa continua igual). Transformar?'

export interface GarantirAventuraOpcoes {
  /** O arquivo do mapa no editor (`null` = nunca salvo): é ele que vira a primeira cena. */
  caminhoDoMapaSolto: () => string | null
  /** @deprecated Ignorado: o mapa vira aventura sem perguntar. Opcional só para quem ainda passa. */
  perguntar?: (texto: string) => Promise<boolean>
}

/**
 * MAPA JÁ É AVENTURA: o mapa novo e o solto que abre já são aventura de uma
 * cena (`abrirMapaNovo`, `open`). O que sobra — mapa posto no editor sem
 * passar por eles — vira aventura aqui, SEM pergunta, antes de escolher
 * sistema, criar ou importar personagem e mexer na lista de camadas. Já é
 * aventura, ou herda o RPG da pasta (`temRpgNoMapa`): segue. `true` = pode
 * continuar. Nunca rejeita.
 */
export async function garantirAventura({ caminhoDoMapaSolto }: GarantirAventuraOpcoes): Promise<boolean> {
  if (temRpgNoMapa(useAdventureStore.getState())) return true
  return virarSemPerguntar(caminhoDoMapaSolto)
}

/**
 * CAMADAS (fatia 7): a lista de camadas mora no `adventure.json` — mesmo o
 * mapa que herda o RPG da pasta precisa ser aventura para guardá-la. Como
 * `garantirAventura`, sem pergunta. Nunca rejeita.
 */
export async function garantirAventuraParaCamadas({ caminhoDoMapaSolto }: GarantirAventuraOpcoes): Promise<boolean> {
  if (temAventura()) return true
  return virarSemPerguntar(caminhoDoMapaSolto)
}

function virarSemPerguntar(caminhoDoMapaSolto: () => string | null): boolean {
  useAdventureStore.getState().virarAventura(caminhoDoMapaSolto())
  return temAventura()
}

function temAventura(): boolean {
  const { adventure, activeSceneId } = useAdventureStore.getState()
  return adventure !== null && activeSceneId !== null
}

/** Roda `acao` com a aventura garantida (na hora, se já há), e devolve o que ela devolveu; `null` se não deu. */
export async function comAventuraDasCamadas<T>(garantir: () => Promise<boolean>, acao: () => T): Promise<T | null> {
  if (temAventura()) return acao()
  return (await garantir()) ? acao() : null
}

/** As ações do painel de Camadas que mudam a lista: criar e ordenar garantem a aventura antes (renomear e apagar só existem em camada livre, que já nasceu nela). */
export function acoesDoModeloDeCamadasCom(garantir: () => Promise<boolean>): AcoesDoModelo {
  const store = () => useMapStore.getState()
  return {
    criar: async (acimaDe) => (await comAventuraDasCamadas(garantir, () => store().criarCamadaLivre(acimaDe))) ?? null,
    renomear: (id, nome) => store().renomearCamada(id, nome),
    mover: (id, destino) => {
      void comAventuraDasCamadas(garantir, () => store().moverCamada(id, destino))
    },
    apagar: (id) => store().apagarCamadaLivre(id),
  }
}

/**
 * Roda `acao` quando há onde guardar o RPG (aventura, ou a pasta do mapa): na
 * hora, se já há (o clique responde no mesmo quadro, sem esperar promessa);
 * senão, depois de `garantir`.
 */
export function comAventura(garantir: () => Promise<boolean>, acao: () => void): void {
  if (temRpgNoMapa(useAdventureStore.getState())) {
    acao()
    return
  }
  // `garantir` nunca rejeita (ver `garantirAventura`): não há erro para tratar aqui.
  void garantir().then((pode) => {
    if (pode) acao()
  })
}
