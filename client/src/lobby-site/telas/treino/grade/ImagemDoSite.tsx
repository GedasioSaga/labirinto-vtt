import { useMemo, type ReactNode } from 'react'
import { ImagemDaMesa } from '../../../../components/ImagemDaMesa'
import { resolverDoSite } from './retratos'

/**
 * A MÍDIA DA MESA na tela do treino e do duelo (fatia G2): quem desenha um
 * retrato (a grade, a mira, as cartas da ordem) pede o `src` ao resolvedor
 * de `useImagemDaMesa`, como no app. Aqui ele aponta para a rota de mídia da
 * campanha (`GET /api/c/:id/midia/:midiaId`); na demo, para os rostos
 * inventados (`retratos.ts`). O resto do site continua com o do `Site.tsx`.
 */
export function ImagemDoSite({ campanhaId, demo, children }: { campanhaId: string; demo: boolean; children: ReactNode }) {
  const resolver = useMemo(() => resolverDoSite(campanhaId, demo), [campanhaId, demo])
  return <ImagemDaMesa.Provider value={resolver}>{children}</ImagemDaMesa.Provider>
}
