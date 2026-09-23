import type { Token } from '../types/map'

/**
 * Cor do disco do token antes de existir escolha de cor — o mesmo
 * `0x5a8fd6` que `pixi/drawTokens.ts` pintava em código. Token sem `color`
 * (mapa salvo antes desta feature, token criado por spec e2e via
 * `page.evaluate`) continua saindo exatamente assim: `undefined` === "cor de
 * fábrica", sem linha de migração — mesmo padrão de `rotation`/`locked`.
 */
export const TOKEN_COLOR_DEFAULT = 0x5a8fd6

export interface TokenColorOption {
  /** O que vai gravado em `Token.color`, em `#rrggbb` minúsculo. */
  value: string
  /** O que a pessoa lê no botão — curto, para caber nas 3 colunas do rail. */
  label: string
  /** Papel de mesa que esta cor ocupa, ou `null` quando é só uma cor a mais.
   *  Entra no NOME ACESSÍVEL junto do rótulo: é por ele que o mestre acha
   *  "aliado" sem precisar saber que aliado virou verde. */
  role: string | null
}

/**
 * O punhado de cores do painel. Poucas e chapadas de propósito: o pedido é
 * separar aliado, inimigo e neutro em UM clique, não achar um tom entre
 * milhões. Todas legíveis sobre o chão claro padrão (`#a8776a`) e sobre o
 * fundo escuro do mapa, sem degradê, sem sombra e sem brilho — o token
 * continua sendo ficha chapada do minimapa.
 */
export const TOKEN_COLOR_OPTIONS: readonly TokenColorOption[] = [
  { value: '#5a8fd6', label: 'Azul', role: 'padrão' },
  { value: '#35b24a', label: 'Verde', role: 'aliado' },
  { value: '#d6452f', label: 'Vermelho', role: 'inimigo' },
  { value: '#d99a2b', label: 'Âmbar', role: 'neutro' },
  { value: '#9a5fd0', label: 'Roxo', role: null },
  { value: '#b8bec8', label: 'Cinza', role: null },
]

/** Nome acessível do botão: "Verde — aliado", ou só "Roxo" quando não há papel. */
export function tokenColorName(option: TokenColorOption): string {
  return option.role === null ? option.label : `${option.label} — ${option.role}`
}

const HEX_RGB = /^#[0-9a-f]{6}$/i

/**
 * `#rrggbb` → número do Pixi; qualquer outra coisa → `null`.
 *
 * Aceita `unknown` porque a entrada real não é só o que o type-checker vê:
 * mapa vindo do disco (`lib/mapFile.ts` espalha o JSON cru) e token montado
 * por `page.evaluate` num spec chegam com o que estiver lá. Cor inválida cai
 * no default em vez de virar `NaN` dentro do `fill()`, que pintaria preto.
 */
export function parseHexColor(value: unknown): number | null {
  if (typeof value !== 'string' || !HEX_RGB.test(value)) return null
  return Number.parseInt(value.slice(1), 16)
}

/** A cor com que o disco do token é pintado hoje, já com o default resolvido. */
export function tokenFillColor(token: Pick<Token, 'color'>): number {
  return parseHexColor(token.color) ?? TOKEN_COLOR_DEFAULT
}

/**
 * Qual opção do painel está marcada, em `#rrggbb` minúsculo, ou `null` quando
 * o token está na cor de fábrica. Normaliza pelo NÚMERO (e não comparando a
 * string crua) para `#35B24A` vindo de um mapa editado à mão marcar o mesmo
 * botão que `#35b24a`.
 */
export function selectedTokenColor(token: Pick<Token, 'color'>): string | null {
  const parsed = parseHexColor(token.color)
  return parsed === null ? null : `#${parsed.toString(16).padStart(6, '0')}`
}
