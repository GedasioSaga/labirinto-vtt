/**
 * Recursos escondidos da interface por decisão de produto (plano de
 * 15/09/2026, D1). Esconder não é apagar: componente, rota, dado e teste
 * continuam existindo e compilando, então religar um recurso é trocar a
 * flag aqui.
 *
 * Quem depende de uma flag recebe `flags = FEATURES` como parâmetro com
 * default (D2), para o teste provar os dois estados sem mock de módulo.
 */
export interface FeatureFlags {
  /** Cartão "Opções" no menu inicial. A rota `options` continua existindo. */
  optionsScreen: boolean
  /** Isometric e World Map: a escolha de tipo de mapa antes do formulário. */
  otherMapTypes: boolean
  /** Campo "Link de cenário" na janela Configurações do mapa. O dado continua lido e gravado. */
  scenarioLink: boolean
  /** Ferramenta Token e o atalho K. `TOOL_SHORTCUTS.token` continua na tabela. */
  tokenTool: boolean
}

export const FEATURES: Readonly<FeatureFlags> = {
  optionsScreen: false,
  otherMapTypes: false,
  scenarioLink: false,
  tokenTool: false,
}
