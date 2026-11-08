import { useEffect, useState } from 'react'
import { MenuShell } from '../screens/MenuShell'
import { lerIndiceDoPreparo, type DocumentoLido } from '../lib/preparo/disco'
import type { Campanha, IndiceDoPreparo } from '../lib/preparo/tipos'
import { SUBTITULO_DO_PRELUDIO, TITULO_DO_PRELUDIO } from './textos'
import { PainelDaCopia } from './copia/PainelDaCopia'
import '../screens/MainMenu.css'

interface TelaDoPreludioProps {
  onBack: () => void
}

type Leitura = { t: 'abrindo' } | { t: 'lida'; indice: DocumentoLido<IndiceDoPreparo> }

const NADA_AINDA =
  'Nada preparado ainda. Aqui vão morar as sessões, a escrita e a enciclopédia das campanhas; a importação do Grimório é a próxima etapa.'

/** "One Piece, Dragon Ball e Geonova": os nomes vêm do disco e entram como texto. */
function frasesDasCampanhas(campanhas: readonly Campanha[]): string {
  if (campanhas.length === 0) return NADA_AINDA
  const nomes = new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(campanhas.map((campanha) => campanha.nome))
  return campanhas.length === 1 ? `1 campanha no Prelúdio: ${nomes}.` : `${campanhas.length} campanhas no Prelúdio: ${nomes}.`
}

/** O que a tela diz e o aviso por cima (`null` = nenhum). */
function textoDaLeitura(indice: DocumentoLido<IndiceDoPreparo>): { texto: string; aviso: string | null } {
  switch (indice.estado) {
    case 'novo':
      return { texto: NADA_AINDA, aviso: null }
    case 'ok':
      return { texto: frasesDasCampanhas(indice.valor.campanhas), aviso: indice.aviso }
    case 'somenteLeitura':
      return { texto: indice.valor === null ? NADA_AINDA : frasesDasCampanhas(indice.valor.campanhas), aviso: indice.aviso }
    case 'falhou':
      return { texto: NADA_AINDA, aviso: indice.aviso }
  }
}

/**
 * O PRELÚDIO, a preparação de sessão (F0, fundação): por enquanto só diz o
 * que já existe em `<appData>/preparo/`. Abrir só lê; nada é gravado ali (a
 * cópia diária no Google Drive, `copia/PainelDaCopia.tsx`, também só lê preparo/).
 */
export function TelaDoPreludio({ onBack }: TelaDoPreludioProps) {
  const [leitura, setLeitura] = useState<Leitura>({ t: 'abrindo' })
  // Uma cópia restaurada do Google Drive troca preparo/ inteira: lê de novo.
  const [rodada, setRodada] = useState(0)

  useEffect(() => {
    let aberta = true
    // `lerIndiceDoPreparo` não lança (o erro vem no aviso); o catch é a rede para um defeito dele.
    void lerIndiceDoPreparo()
      .catch((erro: unknown): DocumentoLido<IndiceDoPreparo> => ({
        estado: 'falhou',
        aviso: `Não deu para ler o Prelúdio: ${erro instanceof Error ? erro.message : String(erro)}.`,
      }))
      .then((indice) => {
        if (aberta) setLeitura({ t: 'lida', indice })
      })
    return () => {
      aberta = false
    }
  }, [rodada])

  return (
    <MenuShell title={TITULO_DO_PRELUDIO} subtitle={SUBTITULO_DO_PRELUDIO} onBack={onBack} crumbs={['Labirinto']}>
      {leitura.t === 'abrindo' ? (
        <section className="lb-wip" aria-busy="true" aria-label="Abrindo o Prelúdio" />
      ) : (
        <ConteudoDoPreludio {...textoDaLeitura(leitura.indice)} />
      )}
      <PainelDaCopia onRestaurado={() => setRodada((anterior) => anterior + 1)} />
    </MenuShell>
  )
}

function ConteudoDoPreludio({ texto, aviso }: { texto: string; aviso: string | null }) {
  return (
    <section className="lb-wip" aria-label="Prelúdio">
      <svg className="lb-wip__scaffold" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <path d="M60 34c-12-8-28-10-44-8v66c16-2 32 0 44 8 12-8 28-10 44-8V26c-16-2-32 0-44 8z" />
        <path d="M60 34v66M28 48h20M28 60h20M28 72h14M72 48h20M72 60h20M72 72h14" />
      </svg>
      <span className="lb-home__badge">Em construção</span>
      <p className="lb-wip__text">{texto}</p>
      {aviso !== null && (
        <p className="lb-wip__text" role="status">
          {aviso}
        </p>
      )}
    </section>
  )
}
