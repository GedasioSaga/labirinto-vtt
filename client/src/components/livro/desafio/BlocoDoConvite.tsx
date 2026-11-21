import { useId, useState } from 'react'
import { comConvite, conviteDo, conviteTemExemplo, exemploDoJogo, FALA_DO_CONVITE_MAX_LENGTH, LUGAR_DO_CONVITE_MAX_LENGTH, QUEM_CHAMA_MAX_LENGTH, type ConviteDoDesafio } from '../../../lib/desafios'
import { falasSugeridasDo, REGISTRO_DE_MINIGAMES } from '../../../minigames/registro'
import { useMapStore } from '../../../stores/mapStore'
import { isTokenPhotoData } from '../../../lib/tokenPhoto'
import { personagensAtivos } from '../../../stores/donoDasFichas'
import { useAdventureStore } from '../../../stores/adventureStore'
import type { Desafio, QuemChamaODesafio, Token } from '../../../types/map'

/**
 * O CONVITE (editor de desafio aprovado em 21/11/2026, decisão 5): quem
 * chama, o que diz e o lugar no convite, num bloco só, com a forma da carta
 * que o jogador recebe. Antes eram quatro campos soltos ("Quem desafia",
 * "Quem pede ajuda", "Fala do desafio", "Nome do lago"...), com rótulo
 * diferente em cada jogo e sem dizer para que serviam. O verbo ("pede ajuda",
 * "desafia para uma dança") vem do registro do jogo.
 *
 * Gravar é por tecla, como o nome do pino: cada campo junta as teclas
 * seguidas num passo só do Ctrl+Z (a chave do `updateDesafio`), e a prévia do
 * jogador acompanha.
 */

/** As iniciais do retrato vazio ("Guarda Florêncio" → "GF"); sem nome, um traço. */
export function iniciaisDe(nome: string): string {
  const partes = nome
    .split(/[ ,]+/)
    .filter((parte) => parte.length > 2 || /^[A-ZÀ-Ý]/.test(parte))
    .slice(0, 2)
  const letras = partes.map((parte) => parte.charAt(0).toLocaleUpperCase('pt-BR')).join('')
  return letras === '' ? '—' : letras
}

/** O retrato de quem chama: a foto, quando há, ou as iniciais num disco. Ninguém = um quadro vazio. */
export function RetratoDeQuemChama({ nome, foto, pequeno = false }: { nome: string; foto?: string; pequeno?: boolean }) {
  const classe = `mg-retrato${pequeno ? ' mg-retrato--p' : ''}`
  if (nome.trim() === '') return <span className={`${classe} mg-retrato--vazio`} aria-hidden="true">—</span>
  if (foto !== undefined) return <img className={classe} src={foto} alt="" />
  return (
    <span className={classe} aria-hidden="true">
      {iniciaisDe(nome)}
    </span>
  )
}

function SetaParaBaixo() {
  return (
    <svg className="mg-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

interface PropsDoBloco {
  desafio: Desafio
}

/** Quantas fichas a escolha mostra de cada lista (a da cena e a do acervo): o resto pelo "Só um nome". */
const FICHAS_NA_ESCOLHA_MAX = 8

/** A foto do boneco, só quando é imagem embutida (a que o editor já mostra sem buscar nada). */
function fotoDoBoneco(token: Pick<Token, 'imageData'> | undefined): string | undefined {
  return token !== undefined && isTokenPhotoData(token.imageData) ? token.imageData : undefined
}

interface FichaParaEscolher {
  chave: string
  quem: QuemChamaODesafio
  foto?: string
  onde: string
}

/** As fichas que podem chamar: os bonecos desta cena (com nome) e as fichas do acervo, sem repetir nome. */
function useFichasParaEscolher(): readonly FichaParaEscolher[] {
  const tokens = useMapStore((estado) => estado.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const vistos = new Set<string>()
  const fichas: FichaParaEscolher[] = []
  for (const token of tokens) {
    const nome = token.name.trim().slice(0, QUEM_CHAMA_MAX_LENGTH)
    if (nome === '' || vistos.has(nome) || fichas.length >= FICHAS_NA_ESCOLHA_MAX) continue
    vistos.add(nome)
    const foto = fotoDoBoneco(token)
    fichas.push({ chave: `t:${token.id}`, quem: { nome, tokenId: token.id }, ...(foto === undefined ? {} : { foto }), onde: 'nesta cena' })
  }
  let doAcervo = 0
  for (const personagem of personagens) {
    const nome = personagem.nome.trim().slice(0, QUEM_CHAMA_MAX_LENGTH)
    if (nome === '' || vistos.has(nome) || doAcervo >= FICHAS_NA_ESCOLHA_MAX) continue
    vistos.add(nome)
    doAcervo += 1
    fichas.push({ chave: `a:${personagem.id}`, quem: { nome, acervoId: personagem.id }, onde: 'do acervo' })
  }
  return fichas
}

export function BlocoDoConvite({ desafio }: PropsDoBloco) {
  const minigame = desafio.minigame
  const baseId = useId()
  const id = (nome: string) => `${baseId}-${nome}`
  const [escolhendo, setEscolhendo] = useState(false)
  const [nomeSolto, setNomeSolto] = useState('')
  const [semNome, setSemNome] = useState(false)
  const fichas = useFichasParaEscolher()
  const tokenDeQuem = useMapStore((estado) => (desafio.quem?.tokenId === undefined ? undefined : estado.map.tokens.find((token) => token.id === desafio.quem?.tokenId)))
  if (minigame.jogo === 'puzzle') {
    return (
      <section className="mg-bloco">
        <h3 className="mg-secao">Quem chama</h3>
        <p className="mg-nota">O puzzle não tem quem chama: o jogador encosta no selo e examina. O nome que ele vê e as peças ficam no editor do puzzle.</p>
      </section>
    )
  }
  const convite = conviteDo(minigame)
  const exemplo = exemploDoJogo(minigame)
  const temExemplo = conviteTemExemplo(minigame)
  const narra = convite.npc.trim() === ''
  const verbo = REGISTRO_DE_MINIGAMES[minigame.jogo].verbo
  const falas = falasSugeridasDo(minigame)
  const mudar = (mudanca: Partial<ConviteDoDesafio>, campo?: string) =>
    useMapStore.getState().updateDesafio(desafio.id, { minigame: comConvite(minigame, mudanca) }, campo === undefined ? undefined : `desafio-${campo}:${desafio.id}`)
  // Um passo só: o nome no convite e a ficha de onde ele veio (ou nenhuma, com o "só um nome" e o "Ninguém").
  const escolherQuem = (nome: string, quem?: QuemChamaODesafio) => {
    useMapStore.getState().updateDesafio(desafio.id, { minigame: comConvite(minigame, { npc: nome }), quem })
    setEscolhendo(false)
  }
  const fotoDeQuemChama = fotoDoBoneco(tokenDeQuem)
  const usarNomeSolto = () => {
    const nome = nomeSolto.trim()
    if (nome === '') {
      setSemNome(true)
      return
    }
    setNomeSolto('')
    setSemNome(false)
    escolherQuem(nome)
  }
  const tetoDoLugar = minigame.jogo === 'pesca' || minigame.jogo === 'tiro' || minigame.jogo === 'fogo' || minigame.jogo === 'alavanca' ? LUGAR_DO_CONVITE_MAX_LENGTH[minigame.jogo] : 0
  return (
    <section className="mg-bloco">
      <div className="mg-bloco__cab">
        <h3 className="mg-secao">O convite</h3>
        {temExemplo && <span className="mg-tag">exemplo do jogo</span>}
      </div>
      <div className="mg-convite mg-troca" key={minigame.jogo}>
        <button type="button" className="mg-quem" aria-expanded={escolhendo} aria-controls={id('quem')} onClick={() => setEscolhendo(!escolhendo)}>
          <RetratoDeQuemChama nome={convite.npc} foto={fotoDeQuemChama} />
          <span>
            <b>{narra ? 'Ninguém chama' : convite.npc}</b>
            <small>{narra ? 'O convite vira narração. Toque para escolher alguém.' : verbo}</small>
          </span>
          <SetaParaBaixo />
        </button>
        {escolhendo && (
          <div className="mg-escolha" id={id('quem')} role="group" aria-label="Escolher quem chama">
            {fichas.length > 0 && (
              <>
                <p className="mg-escolha__t">Uma ficha: o nome segue a ficha.</p>
                <ul>
                  {fichas.map((ficha) => {
                    const escolhida = desafio.quem !== undefined && (desafio.quem.tokenId ?? desafio.quem.acervoId) === (ficha.quem.tokenId ?? ficha.quem.acervoId)
                    return (
                      <li key={ficha.chave}>
                        <button type="button" className="mg-escolha__op" aria-pressed={escolhida} onClick={() => escolherQuem(ficha.quem.nome, ficha.quem)}>
                          <RetratoDeQuemChama nome={ficha.quem.nome} foto={ficha.foto} pequeno />
                          <span>
                            {ficha.quem.nome} <small className="mg-escolha__onde">{ficha.onde}</small>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            <div className="gr-campo">
              <label className="gr-campo__rot" htmlFor={id('nome-solto')}>
                Só um nome, sem ficha
              </label>
              <div className="mg-dupla">
                <input
                  id={id('nome-solto')}
                  className="gr-entrada"
                  type="text"
                  autoComplete="off"
                  maxLength={QUEM_CHAMA_MAX_LENGTH}
                  placeholder="Ex.: Olmo"
                  value={nomeSolto}
                  onChange={(evento) => setNomeSolto(evento.currentTarget.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') usarNomeSolto()
                  }}
                />
                <button type="button" className="lb-btn lb-btn--compact" onClick={usarNomeSolto}>
                  Usar
                </button>
              </div>
              {semNome && (
                <p className="mg-erro" role="alert">
                  Escreva um nome, ou escolha Ninguém.
                </p>
              )}
            </div>
            <button type="button" className="lb-btn mg-largo" aria-pressed={narra} onClick={() => escolherQuem('')}>
              Ninguém: o convite vira narração
            </button>
          </div>
        )}
        <div className="gr-campo">
          <label className="gr-campo__rot mg-rot" htmlFor={id('fala')}>
            {narra ? 'Narração' : 'O que diz'}
            <output>{`${convite.fala.length}/${FALA_DO_CONVITE_MAX_LENGTH}`}</output>
          </label>
          <textarea
            id={id('fala')}
            className={`gr-entrada mg-fala${narra ? ' mg-fala--narra' : ''}`}
            rows={4}
            maxLength={FALA_DO_CONVITE_MAX_LENGTH}
            placeholder="Vazio: o convite sai sem fala."
            value={convite.fala}
            onChange={(evento) => mudar({ fala: evento.currentTarget.value }, 'fala')}
          />
        </div>
        {falas.length > 0 && (
          <div className="mg-chips" role="group" aria-label="Sugestões de fala">
            <span>Sugestões</span>
            {falas.map((fala) => (
              <button key={fala.rotulo} type="button" className="mg-chip" aria-pressed={convite.fala === fala.texto} onClick={() => mudar({ fala: fala.texto })}>
                {fala.rotulo}
              </button>
            ))}
          </div>
        )}
        {convite.lugar !== null && (
          <div className="gr-campo">
            <label className="gr-campo__rot mg-rot" htmlFor={id('lugar')}>
              Lugar no convite <small>opcional</small>
            </label>
            <input
              id={id('lugar')}
              className="gr-entrada"
              type="text"
              autoComplete="off"
              maxLength={tetoDoLugar}
              placeholder={exemplo.lugar === null ? undefined : `Ex.: ${exemplo.lugar}`}
              value={convite.lugar}
              onChange={(evento) => mudar({ lugar: evento.currentTarget.value }, 'lugar')}
            />
          </div>
        )}
        <div className="mg-acoes-link">
          {temExemplo ? (
            <button type="button" className="mg-link" onClick={() => mudar({ npc: '', fala: '', ...(convite.lugar === null ? {} : { lugar: '' }) })}>
              Começar em branco
            </button>
          ) : (
            <button type="button" className="mg-link" onClick={() => mudar(exemplo)}>
              Usar o exemplo do jogo
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
