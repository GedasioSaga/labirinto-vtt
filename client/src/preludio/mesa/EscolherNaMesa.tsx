import { useEffect, useMemo, useState } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { lerIndiceDasPastas } from '../../lib/pastasDeMapas'
import { compararTitulos } from '../../lib/preparo/enciclopedia'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'
import { usePreludio } from '../estado/preludio'
import { chaveDosPinos, useCatalogoDaMesa, type MapaNoCatalogo } from './catalogo'

/**
 * "LIGAR À MESA" (F4): o link do roteiro para uma cena, um pino ou uma ficha.
 * Abre nos mapas e na pasta da campanha do texto aberto; a escolha entra no
 * texto onde o cursor estava. Só lê o disco.
 */

interface EscolherNaMesaProps {
  aoFechar: () => void
  aoEscolher: (alvo: AlvoNaMesa, rotulo: string) => void
}

/** A pasta da campanha do verbete (ou sessão, ou página) aberto: os mapas dela vêm primeiro. */
function usePastaDoTexto(): string | null {
  const lugar = usePreludio((estado) => estado.lugar)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const id = lugar.secao === 'sessoes' ? lugar.sessaoId : lugar.secao === 'enciclopedia' ? lugar.verbeteId : lugar.secao === 'escrita' ? lugar.paginaId : null
  const verbete = id === null ? undefined : verbetes.get(id)
  return campanhas.find((campanha) => verbete?.campanhas.includes(campanha.id) === true && campanha.pastaId !== undefined)?.pastaId ?? null
}

type Modo = 'cena' | 'ficha'

export function EscolherNaMesa({ aoFechar, aoEscolher }: EscolherNaMesaProps) {
  const [modo, setModo] = useState<Modo>('cena')
  const pastaDoTexto = usePastaDoTexto()
  return (
    <Dialogo aberto titulo="Ligar à mesa" onFechar={aoFechar} descricao="O link guarda o endereço, não uma cópia: renomear a cena ou o pino não o quebra.">
      <div className="pr-mesa-escolha__modos" role="group" aria-label="O que ligar">
        <button type="button" className="pr-chip" aria-pressed={modo === 'cena'} onClick={() => setModo('cena')}>
          Cena ou pino
        </button>
        <button type="button" className="pr-chip" aria-pressed={modo === 'ficha'} onClick={() => setModo('ficha')}>
          Ficha do Livro
        </button>
      </div>
      {modo === 'cena' ? <EscolhaDeCena pastaDoTexto={pastaDoTexto} aoEscolher={aoEscolher} /> : <EscolhaDeFicha pastaDoTexto={pastaDoTexto} aoEscolher={aoEscolher} />}
    </Dialogo>
  )
}

// ─── Cena ou pino ────────────────────────────────────────────────────────────

/** Os mapas da pasta da campanha primeiro (pelo índice das pastas), depois o resto, cada grupo por nome. O que não abre fica fora da escolha. */
function mapasEmOrdem(mapas: ReadonlyMap<string, MapaNoCatalogo>, daPasta: ReadonlySet<string>): MapaNoCatalogo[] {
  return [...mapas.values()].filter((mapa) => mapa.abriu).sort((a, b) => Number(daPasta.has(b.chave)) - Number(daPasta.has(a.chave)) || compararTitulos(a.nome, b.nome))
}

function useMapasDaPasta(pastaId: string | null): ReadonlySet<string> {
  const [chaves, setChaves] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (pastaId === null) return
    let vivo = true
    void lerIndiceDasPastas().then(({ indice }) => {
      if (vivo) setChaves(new Set(indice.mapas.filter((lugar) => lugar.pastaId === pastaId).map((lugar) => lugar.chave)))
    })
    return () => {
      vivo = false
    }
  }, [pastaId])
  return chaves
}

function EscolhaDeCena({ pastaDoTexto, aoEscolher }: { pastaDoTexto: string | null; aoEscolher: EscolherNaMesaProps['aoEscolher'] }) {
  const mapas = useCatalogoDaMesa((estado) => estado.mapas)
  const pinos = useCatalogoDaMesa((estado) => estado.pinos)
  const lerMapas = useCatalogoDaMesa((estado) => estado.lerMapas)
  const lerPinos = useCatalogoDaMesa((estado) => estado.lerPinos)
  const daPasta = useMapasDaPasta(pastaDoTexto)
  const [chave, setChave] = useState<string | null>(null)
  const [sceneId, setSceneId] = useState<string | null>(null)

  useEffect(() => lerMapas(), [lerMapas])

  const lista = useMemo(() => (mapas?.t === 'lido' ? mapasEmOrdem(mapas.valor, daPasta) : []), [mapas, daPasta])
  const mapa = lista.find((um) => um.chave === chave) ?? lista[0]
  const cena = mapa?.cenas === null || mapa === undefined ? undefined : (mapa.cenas.find((uma) => uma.id === sceneId) ?? mapa.cenas[0])
  const cenaId = mapa?.cenas === null ? '' : (cena?.id ?? null)

  useEffect(() => {
    if (mapa !== undefined && cenaId !== null) lerPinos(mapa.chave, cenaId)
  }, [mapa, cenaId, lerPinos])

  if (mapas === null || mapas.t === 'lendo') return <p className="pr-quieto">Lendo os mapas…</p>
  if (mapas.t === 'falhou') {
    return (
      <p className="pr-aviso" role="alert">
        Não deu para ler os mapas: {mapas.motivo}
      </p>
    )
  }
  if (mapa === undefined) return <p className="pr-quieto">Nenhum mapa salvo ainda. Os mapas moram na tela Carregar mapa.</p>

  const dosPinos = cenaId === null ? undefined : pinos.get(chaveDosPinos(mapa.chave, cenaId))
  return (
    <div className="pr-mesa-escolha">
      <label className="pr-campo">
        <span className="pr-campo__rotulo">Mapa</span>
        <select
          className="pr-campo__entrada"
          value={mapa.chave}
          onChange={(evento) => {
            setChave(evento.target.value)
            setSceneId(null)
          }}
        >
          {lista.map((um) => (
            <option key={um.chave} value={um.chave}>
              {um.nome}
            </option>
          ))}
        </select>
      </label>
      {mapa.cenas !== null && (
        <label className="pr-campo">
          <span className="pr-campo__rotulo">Cena</span>
          <select className="pr-campo__entrada" value={cena?.id ?? ''} onChange={(evento) => setSceneId(evento.target.value)}>
            {mapa.cenas.map((uma) => (
              <option key={uma.id} value={uma.id}>
                {uma.trilha}
              </option>
            ))}
          </select>
        </label>
      )}
      {cenaId !== null && (
        <ul className="pr-escolha" aria-label="Ligar a">
          <li>
            <button type="button" className="pr-escolha__item" onClick={() => aoEscolher({ tipo: 'cena', chave: mapa.chave, sceneId: cenaId }, cena?.nome ?? mapa.nome)}>
              <span>{cena === undefined ? 'O mapa inteiro' : 'A cena inteira'}</span>
              <span className="pr-escolha__detalhe">{cena?.nome ?? mapa.nome}</span>
            </button>
          </li>
          {dosPinos === undefined || dosPinos.t === 'lendo' ? (
            <li className="pr-quieto pr-mesa-escolha__nota">Lendo os pinos…</li>
          ) : dosPinos.t === 'falhou' ? (
            <li className="pr-aviso pr-mesa-escolha__nota" role="alert">
              Não deu para ler os pinos desta cena: {dosPinos.motivo}
            </li>
          ) : dosPinos.valor.length === 0 ? (
            <li className="pr-quieto pr-mesa-escolha__nota">Nenhum pino nesta cena.</li>
          ) : (
            dosPinos.valor.map((pino) => (
              <li key={pino.id}>
                <button type="button" className="pr-escolha__item" onClick={() => aoEscolher({ tipo: 'cena', chave: mapa.chave, sceneId: cenaId, pinoId: pino.id }, pino.nome)}>
                  <span>{pino.nome}</span>
                  <span className="pr-escolha__detalhe">Pino</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Ficha ───────────────────────────────────────────────────────────────────

function EscolhaDeFicha({ pastaDoTexto, aoEscolher }: { pastaDoTexto: string | null; aoEscolher: EscolherNaMesaProps['aoEscolher'] }) {
  const pastas = useCatalogoDaMesa((estado) => estado.pastas)
  const fichas = useCatalogoDaMesa((estado) => estado.fichas)
  const lerPastas = useCatalogoDaMesa((estado) => estado.lerPastas)
  const lerFichas = useCatalogoDaMesa((estado) => estado.lerFichas)
  const [escolhida, setEscolhida] = useState<string | null>(null)

  useEffect(() => lerPastas(), [lerPastas])

  const lista = useMemo(() => (pastas?.t === 'lido' ? [...pastas.valor].map(([id, nome]) => ({ id, nome })).sort((a, b) => compararTitulos(a.nome, b.nome)) : []), [pastas])
  const pastaId = [escolhida, pastaDoTexto].find((id) => id !== null && lista.some((pasta) => pasta.id === id)) ?? lista[0]?.id ?? null

  useEffect(() => {
    if (pastaId !== null) lerFichas(pastaId)
  }, [pastaId, lerFichas])

  if (pastas === null || pastas.t === 'lendo') return <p className="pr-quieto">Lendo as pastas…</p>
  if (pastas.t === 'falhou') {
    return (
      <p className="pr-aviso" role="alert">
        Não deu para ler as pastas: {pastas.motivo}
      </p>
    )
  }
  if (pastaId === null) return <p className="pr-quieto">Nenhuma pasta de mapas ainda. As fichas moram nas pastas da tela Carregar mapa.</p>

  const daPasta = fichas.get(pastaId)
  return (
    <div className="pr-mesa-escolha">
      <label className="pr-campo">
        <span className="pr-campo__rotulo">Pasta</span>
        <select className="pr-campo__entrada" value={pastaId} onChange={(evento) => setEscolhida(evento.target.value)}>
          {lista.map((pasta) => (
            <option key={pasta.id} value={pasta.id}>
              {pasta.nome}
            </option>
          ))}
        </select>
      </label>
      {daPasta === undefined || daPasta.t === 'lendo' ? (
        <p className="pr-quieto">Lendo as fichas…</p>
      ) : daPasta.t === 'falhou' ? (
        <p className="pr-aviso" role="alert">
          Não deu para ler as fichas desta pasta: {daPasta.motivo}
        </p>
      ) : daPasta.valor.length === 0 ? (
        <p className="pr-quieto">Esta pasta ainda não tem fichas.</p>
      ) : (
        <ul className="pr-escolha" aria-label="Fichas da pasta">
          {daPasta.valor.map((ficha) => (
            <li key={ficha.id}>
              <button type="button" className="pr-escolha__item" onClick={() => aoEscolher({ tipo: 'ficha', pastaId, personagemId: ficha.id }, ficha.nome)}>
                <span>{ficha.nome}</span>
                <span className="pr-escolha__detalhe">{ficha.detalhe}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
