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
