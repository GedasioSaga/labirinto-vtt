import { useState, type KeyboardEvent } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import type { ImagemDaForma } from '../../lib/preparo/tipos'
import { urlDaMidia, useRaizDaMidia } from '../midia'

/** As iniciais do nome, para o retrato que não tem imagem ("Monkey D. Luffy" → "ML"). */
function iniciais(nome: string): string {
  const palavras = nome.split(/\s+/).filter((palavra) => /\p{L}/u.test(palavra))
  const primeira = palavras[0]?.[0] ?? '?'
  const ultima = palavras.length > 1 ? (palavras[palavras.length - 1]?.[0] ?? '') : ''
  return `${primeira}${ultima}`.toUpperCase()
}

interface RetratoProps {
  nome: string
  midia: string | undefined
  tamanho: 'p' | 'g'
}

/** O retrato da forma, ou as iniciais num medalhão quando não há imagem. */
export function Retrato({ nome, midia, tamanho }: RetratoProps) {
  const raiz = useRaizDaMidia()
  const [falhou, setFalhou] = useState(false)
  const url = raiz === null || falhou ? null : urlDaMidia(raiz, midia)
  return (
    <span className={`pr-retrato pr-retrato--${tamanho}`} aria-hidden="true">
      {url === null ? <span className="pr-retrato__iniciais">{iniciais(nome)}</span> : <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)} />}
    </span>
  )
}

interface GaleriaProps {
  imagens: readonly ImagemDaForma[]
  /** "Galeria de Fulano (Dia)". */
  titulo: string
}

/** As imagens da forma; clicar abre a imagem grande, e as setas passam para a vizinha. */
export function Galeria({ imagens, titulo }: GaleriaProps) {
  const raiz = useRaizDaMidia()
  const [aberta, setAberta] = useState<number | null>(null)
  if (imagens.length === 0) return null
  const atual = aberta === null ? undefined : imagens[aberta]
  const passar = (passo: number) => setAberta((indice) => (indice === null ? null : (indice + passo + imagens.length) % imagens.length))
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'ArrowRight') passar(1)
    else if (evento.key === 'ArrowLeft') passar(-1)
    else return
    evento.preventDefault()
  }
  return (
    <section className="pr-galeria" aria-label={titulo}>
      <h3 className="pr-secao__nome pr-galeria__titulo">Galeria</h3>
      <ul className="pr-galeria__grade">
        {imagens.map((imagem, indice) => {
          const url = raiz === null ? null : urlDaMidia(raiz, imagem.midia)
          return (
            <li key={`${imagem.midia}-${indice}`}>
              <button type="button" className="pr-galeria__item" onClick={() => setAberta(indice)} aria-label={imagem.legenda === '' ? `Abrir a imagem ${indice + 1}` : `Abrir: ${imagem.legenda}`}>
                {url === null ? <span className="pr-galeria__falta">Sem arquivo</span> : <img src={url} alt="" loading="lazy" decoding="async" />}
              </button>
              {imagem.legenda !== '' && <p className="pr-galeria__legenda">{imagem.legenda}</p>}
            </li>
          )
        })}
      </ul>
      <Dialogo aberto={atual !== undefined} titulo={atual?.legenda || `Imagem ${(aberta ?? 0) + 1} de ${imagens.length}`} onFechar={() => setAberta(null)} classe="pr-visor" aoTeclar={aoTeclar}>
        {atual !== undefined && (
          <figure className="pr-visor__figura">
            {raiz !== null && urlDaMidia(raiz, atual.midia) !== null ? <img src={urlDaMidia(raiz, atual.midia) ?? undefined} alt={atual.legenda} /> : <span className="pr-galeria__falta">Esta imagem não tem arquivo no Prelúdio.</span>}
            {imagens.length > 1 && (
              <figcaption className="pr-visor__passos">
                <button type="button" className="gr-bt gr-bt--p" onClick={() => passar(-1)}>
                  Anterior
                </button>
                <span className="pr-visor__conta">
                  {(aberta ?? 0) + 1} de {imagens.length}
                </span>
                <button type="button" className="gr-bt gr-bt--p" onClick={() => passar(1)}>
                  Próxima
                </button>
              </figcaption>
            )}
          </figure>
        )}
      </Dialogo>
    </section>
  )
}
