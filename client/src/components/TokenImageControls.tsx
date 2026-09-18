import { tokenPhotoLabel } from '../lib/tokenPhoto'

export interface TokenImageControlsProps {
  image: string | null
  onChangeImage: () => void
  onClearImage: () => void
  /** Guarda este token no acervo global do app (lib/tokenLibrary.ts). */
  onSaveToLibrary: () => void
}

/**
 * Troca a imagem do Token selecionado — mesmo pipeline visual de
 * PortalControls (peça): "Escolher imagem..." quando não há uma ainda,
 * "Trocar imagem..." + "Remover imagem" quando já há. `image: null` volta o
 * token ao círculo genérico de sempre (drawTokenCircle em pixi/drawTokens.ts).
 *
 * Checagem por veracidade (`!image`), não `=== null`: o tipo `Token.image` é
 * obrigatório (`string | null`), mas um token construído fora do
 * type-checker (spec e2e via `page.evaluate`, ou mapa legado antes da
 * migração) pode chegar com o campo `undefined` — `undefined === null` é
 * `false`, o que cairia no branch "tem imagem" e quebraria em
 * `image.split(...)`. Mesma classe de bug corrigida em tokensRenderer.ts.
 */
export function TokenImageControls({ image, onChangeImage, onClearImage, onSaveToLibrary }: TokenImageControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Imagem do token</h2>
      {!image ? (
        <button type="button" className="lb-btn lb-btn--block" onClick={onChangeImage}>
          Escolher imagem...
        </button>
      ) : (
        <>
          {/* Foto embutida (a que o jogador escolheu) não tem nome de arquivo: ver lib/tokenPhoto.ts. */}
          <span className="lb-label">{tokenPhotoLabel(image)}</span>
          <button type="button" className="lb-btn lb-btn--block" onClick={onChangeImage}>
            Trocar imagem...
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onClearImage}>
            Remover imagem (voltar ao círculo)
          </button>
        </>
      )}
      {/* Mora aqui, e não no painel do acervo, porque é a FOTO deste token que
          vai para a estante: o gesto é "guardar este, com esta cara". Aparece
          mesmo sem imagem — sem foto o app responde por que não dá
          (`SEM_FOTO_PARA_SALVAR`), que ensina; botão escondido não ensina. */}
      <button type="button" className="lb-btn lb-btn--block" onClick={onSaveToLibrary}>
        Salvar no acervo
      </button>
    </section>
  )
}
