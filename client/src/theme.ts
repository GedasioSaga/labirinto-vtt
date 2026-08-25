/**
 * Tokens de design do Labirinto — fonte única de verdade.
 *
 * Os valores brutos vivem SÓ aqui. `themeCss()` achata este objeto em custom
 * properties CSS (`--lb-color-brass`, `--lb-space-4`, ...) e `main.tsx` injeta
 * o resultado antes do primeiro render. `main.css` consome só `var(--lb-*)`,
 * então não existe segunda cópia dos valores para sair de sincronia.
 *
 * Direção visual: superfície de pedra fria (carvão levemente quente, nunca
 * azulado) com UM acento em latão — a luz de lampião sobre a mesa. O latão
 * herda o `#ffdd55` que já marcava a ferramenta ativa, e evita virar cópia do
 * roxo do Owlbear.
 *
 * Tipografia em três papéis:
 *  - `display` (serifa) só no wordmark e no título da tela inicial;
 *  - `sans` em toda a interface;
 *  - `utility` (condensada) nas legendas em caixa alta e nos valores numéricos,
 *    para dar leitura de legenda de mapa.
 * Todas as famílias já vêm com o Windows/macOS: o app é desktop e offline, então
 * nenhum @import de Google Fonts — zero request bloqueando o primeiro paint.
 */

export const theme = {
  color: {
    /** Fundo da aplicação, atrás do canvas. */
    ink: '#121214',
    /**
     * Base dos painéis flutuantes (usada com blur por cima do canvas).
     * Precisa ficar bem mais escura que o fundo do canvas — `PixiCanvas` inicia
     * com `backgroundColor: 0x2b2b2b`, e composta sobre ele esta cor resulta em
     * ~#141418. Com a opacidade anterior (0.86 sobre #1a1a1e) o resultado era
     * ~#1c1c20: perto demais do canvas, e o painel se dissolvia na grade.
     */
    stone: 'rgba(19, 19, 23, 0.94)',
    /** Painel opaco — cartão da tela inicial, onde não há canvas atrás. */
    stoneSolid: '#1a1a1e',
    /** Campo de entrada e botão secundário em repouso. */
    stoneRaised: '#232328',
    /** Hover de controle. */
    stoneHover: '#2c2c33',
    /** Estado pressionado/afundado. */
    stoneSunken: '#141417',

    line: 'rgba(255, 255, 255, 0.08)',
    lineStrong: 'rgba(255, 255, 255, 0.16)',
    /** Borda dos painéis flutuantes — precisa vencer o canvas atrás, não só o ink. */
    linePanel: 'rgba(255, 255, 255, 0.13)',
    /**
     * Divisor entre grupos de controles. Mais forte que `lineStrong` de
     * propósito: uma borda contorna uma forma inteira e é lida pelo conjunto,
     * mas um traço de 1px isolado entre ícones precisa se sustentar sozinho.
     */
    lineDivider: 'rgba(255, 255, 255, 0.26)',

    /** Texto principal — branco levemente quente, não puro. */
    parchment: '#eceae4',
    /** Rótulo, legenda, valor secundário. */
    parchmentDim: '#a2a09a',
    /** Placeholder, texto desabilitado. */
    parchmentFaint: '#6d6c68',

    brass: '#e0a44a',
    brassBright: '#f3ba66',
    /** Fundo do estado ativo/selecionado. */
    brassSoft: 'rgba(224, 164, 74, 0.14)',
    /** Texto sobre o botão primário de latão. */
    brassContrast: '#1c1608',

    ember: '#e2645a',
    emberSoft: 'rgba(226, 100, 90, 0.14)',
  },

  font: {
    display: "'Sitka Banner', 'Sitka Display', Sitka, Constantia, Georgia, 'Times New Roman', serif",
    sans: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    utility: "'Bahnschrift', 'DIN Alternate', 'Segoe UI Variable Small', 'Segoe UI', system-ui, sans-serif",
    size: {
      xs: '10.5px',
      sm: '11.5px',
      md: '13px',
      lg: '15px',
      xl: '20px',
      xxl: '34px',
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
    },
    tracking: {
      tight: '-0.01em',
      normal: '0',
      wide: '0.06em',
      wider: '0.14em',
    },
    leading: {
      tight: '1.2',
      normal: '1.45',
    },
  },

  /** Escala de 4pt. Os nomes são múltiplos de 4px. */
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },

  /**
   * Medidas do shell do editor. Ficam aqui porque o CSS e o TypeScript precisam
   * das duas: o CSS posiciona os painéis, e `placeHint` precisa saber onde o
   * painel lateral termina para não deixar o balão de dica passar por cima dele.
   */
  layout: {
    /** Largura da coluna esquerda (inspetor + barra de ações). */
    railWidth: '264px',
    /** Respiro entre painel flutuante e borda da janela. */
    edgeGap: '16px',
  },

  radius: {
    sm: '6px',
    md: '9px',
    lg: '14px',
    xl: '20px',
    full: '999px',
  },

  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 6px 16px rgba(0, 0, 0, 0.34), 0 1px 2px rgba(0, 0, 0, 0.4)',
    lg: '0 18px 44px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.34)',
    /**
     * Elevação dos painéis que flutuam sobre o canvas.
     *
     * A primeira camada é um contorno preto de 1px sem desfoque: é ele que
     * separa o painel do que estiver atrás, seja fundo claro ou escuro, e é
     * o que faltava para a barra de ferramentas parecer um componente em vez
     * de ícones soltos. Depois vêm três camadas de desfoque crescente — a
     * curta assenta a peça, a média dá a altura, a longa dá a profundidade.
     * `shadow.lg` sozinho não resolvia: com 18px de deslocamento e 44px de
     * desfoque, numa barra de 46px de altura a sombra caía quase toda fora e
     * difusa demais para desenhar contorno.
     */
    float:
      '0 0 0 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.5), 0 6px 14px rgba(0, 0, 0, 0.44), 0 20px 46px rgba(0, 0, 0, 0.55)',
    /** Anel de foco — mesmo em todo controle focável. */
    focus: '0 0 0 3px rgba(224, 164, 74, 0.34)',
    /** Brilho interno de 1px que dá relevo ao painel de vidro. */
    bevel: 'inset 0 1px 0 rgba(255, 255, 255, 0.07)',
  },

  motion: {
    fast: '110ms',
    base: '170ms',
    /** Desaceleração suave; nada de bounce em UI de ferramenta. */
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
} as const

type TokenTree = { [key: string]: string | TokenTree }

function flatten(tree: TokenTree, prefix: string, out: string[]): void {
  for (const [key, value] of Object.entries(tree)) {
    const name = prefix ? `${prefix}-${kebab(key)}` : kebab(key)
    if (typeof value === 'string') {
      out.push(`  --lb-${name}: ${value};`)
    } else {
      flatten(value, name, out)
    }
  }
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Achata `theme` no bloco `:root` que `main.tsx` injeta antes do render. */
export function themeCss(): string {
  const declarations: string[] = []
  flatten(theme as unknown as TokenTree, '', declarations)
  return `:root {\n${declarations.join('\n')}\n}`
}
