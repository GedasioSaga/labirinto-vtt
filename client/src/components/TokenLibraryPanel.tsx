import { useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ItemDoAcervoNaTela } from '../lib/tokenLibrary'

export interface TokenLibraryPanelProps {
  itens: readonly ItemDoAcervoNaTela[]
  /** Frase de `listarAcervo` quando o acervo não pôde ser lido; `null` = tudo certo. */
  aviso: string | null
  /** Coloca uma cópia do item no mapa aberto, com o nome e a foto dele. */
  onPlace: (item: ItemDoAcervoNaTela) => void
  /** Apaga do disco. O componente só chama depois da confirmação. */
  onDelete: (item: ItemDoAcervoNaTela) => void
}

/** Texto do estado vazio — é o que a pessoa lê antes de salvar o primeiro NPC. */
export const ACERVO_VAZIO = 'Nenhum token no acervo ainda.'

/**
 * Caminho do disco → referência que o `<img>` carrega.
 *
 * `convertFileSrc` é a ponte de asset do Tauri e não existe no navegador: o
 * painel continua montado lá (com os itens vazios), e um `throw` aqui derrubaria
 * a tela inteira por causa de uma miniatura. Mesmo cuidado de
 * `pixi/tokensRenderer.ts` com `convertFileSrc(undefined)`.
 */
function fonteDaFoto(caminho: string): string | null {
  try {
    return convertFileSrc(caminho)
  } catch {
    return null
  }
}

/**
 * ACERVO DE TOKENS PRONTOS — a estante de NPCs do mestre.
 *
 * Nas palavras do usuário (18/09/2026): "eu queria que eu pudesse salvar Tokens
 * pre prontos, tipos tokens de npcs e afins para colocar para os jogadores".
 * Salvou o goblin uma vez, ele fica em QUALQUER mapa.
 *
 * Fica FORA do gate de `ToolPropertiesSection`: o acervo não é propriedade da
 * ferramenta nem da seleção, e esconder a estante quando nada está selecionado
 * é justamente esconder no momento em que a pessoa vai pegar o NPC.
 *
 * APAGAR PERGUNTA ANTES, e a pergunta mora aqui em vez de num `confirm()` do
 * navegador: diálogo nativo BLOQUEIA o webview do Tauri e já travou sessão de
 * automação neste projeto. O botão de confirmar repete o nome do item — "Apagar
 * Goblin para sempre" — porque é a última chance de ver que se clicou na linha
 * errada.
 */
export function TokenLibraryPanel({ itens, aviso, onPlace, onDelete }: TokenLibraryPanelProps) {
  /** `id` do item cuja pergunta "apagar mesmo?" está aberta; `null` = nenhuma. */
  const [confirmando, setConfirmando] = useState<string | null>(null)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Acervo de tokens</h2>
      {aviso !== null && (
        // `role="status"`: quem usa leitor de tela ouve o aviso sem ter de
        // caçá-lo, e ele não rouba o foco de onde a pessoa está.
        <p className="lb-acervo__aviso" role="status">
          {aviso}
        </p>
      )}
      {itens.length === 0 ? (
        <p className="lb-acervo__vazio">{ACERVO_VAZIO}</p>
      ) : (
        <ul className="lb-acervo">
          {itens.map((item) => (
            <li key={item.id} className="lb-acervo__item">
              {item.imagemNoDisco && fonteDaFoto(item.arquivo) !== null ? (
                <img className="lb-acervo__foto" src={fonteDaFoto(item.arquivo) ?? ''} alt={`Foto de ${item.nome}`} />
              ) : (
                // Imagem sumida do disco não apaga o item: o nome que a pessoa
                // deu vale mais que o arquivo, e ela ainda pode colocar o token
                // no mapa (sem foto) ou apagar a linha.
                <span className="lb-acervo__foto lb-acervo__foto--vazia" aria-hidden="true" />
              )}
              <button
                type="button"
                className="lb-acervo__nome"
                aria-label={`Colocar ${item.nome} no mapa`}
                onClick={() => onPlace(item)}
              >
                {item.nome}
              </button>
              {confirmando === item.id ? (
                <span className="lb-acervo__confirma">
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setConfirmando(null)}>
                    Manter no acervo
                  </button>
                  <button
                    type="button"
                    className="lb-btn lb-btn--danger"
                    onClick={() => {
                      setConfirmando(null)
                      onDelete(item)
                    }}
                  >
                    {`Apagar ${item.nome} para sempre`}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="lb-acervo__apagar"
                  aria-label={`Apagar ${item.nome} do acervo`}
                  onClick={() => setConfirmando(item.id)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
