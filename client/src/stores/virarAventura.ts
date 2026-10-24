import type { AcoesDoModelo } from '../components/LayersPanel'
import { temRpgNoMapa, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'

/** A pergunta antes de o mapa solto virar aventura (sistema de RPG e fichas moram no `adventure.json`). */
export const PERGUNTA_VIRAR_AVENTURA = 'Para guardar sistema e fichas, este mapa vira uma aventura (o mapa continua igual). Transformar?'

export interface GarantirAventuraOpcoes {
  /** Sim/não ao mestre. No app instalado é a janela do sistema (`ask`); nos testes, uma resposta pronta. */
  perguntar: (texto: string) => Promise<boolean>
  /** O arquivo do mapa solto (`null` = nunca salvo), lido DEPOIS da resposta: é o de agora que vira a primeira cena. */
  caminhoDoMapaSolto: () => string | null
}

/**
 * Garante que há aventura antes de escolher sistema, criar ou importar
 * personagem. Já é aventura, ou o mapa (até solto) usa o RPG da PASTA de
 * mapas (`temRpgNoMapa`): segue sem perguntar — a pasta guarda por ele. Mapa
 * solto: pergunta e, no sim, promove só o mapa (`virarAventura`, sem cena
 * nova). `true` = pode continuar a ação. Nunca rejeita: pergunta que falha
 * conta como "não" — nada muda no arquivo sem o sim do mestre.
 */
export async function garantirAventura({ perguntar, caminhoDoMapaSolto }: GarantirAventuraOpcoes): Promise<boolean> {
  if (temRpgNoMapa(useAdventureStore.getState())) return true
  const mapaDaPergunta = useMapStore.getState().map.id
  const sim = await perguntar(PERGUNTA_VIRAR_AVENTURA).catch(() => false)
  if (!sim) return false
  // Enquanto a pergunta esperava, outro mapa pode ter entrado: o sim era para aquele, não para este.
  if (useMapStore.getState().map.id !== mapaDaPergunta) return false
  useAdventureStore.getState().virarAventura(caminhoDoMapaSolto())
  return useAdventureStore.getState().adventure !== null
}

/** A pergunta antes de o mapa solto virar aventura por causa da LISTA de camadas (fatia 7). */
export const PERGUNTA_VIRAR_AVENTURA_CAMADAS = 'A lista de camadas fica guardada na aventura: este mapa vira uma aventura (o mapa continua igual). Transformar?'

/**
 * CAMADAS (fatia 7): criar camada ou mudar a ordem num mapa SOLTO perderia a
 * lista ao salvar (ela mora no `adventure.json`, e o `map.json` não a leva).
 * Já é aventura: segue. Mapa solto: pergunta e, no sim, promove só o mapa.
 * Nunca rejeita; pergunta que falha conta como "não".
 */
export async function garantirAventuraParaCamadas({ perguntar, caminhoDoMapaSolto }: GarantirAventuraOpcoes): Promise<boolean> {
  if (temAventura()) return true
  const mapaDaPergunta = useMapStore.getState().map.id
  const sim = await perguntar(PERGUNTA_VIRAR_AVENTURA_CAMADAS).catch(() => false)
  if (!sim || useMapStore.getState().map.id !== mapaDaPergunta) return false
  useAdventureStore.getState().virarAventura(caminhoDoMapaSolto())
  return temAventura()
}

function temAventura(): boolean {
  const { adventure, activeSceneId } = useAdventureStore.getState()
  return adventure !== null && activeSceneId !== null
}

/** Roda `acao` com a aventura garantida (na hora, se já há), e devolve o que ela devolveu; `null` no "não". */
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
 * senão, depois do sim de `garantir`.
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
