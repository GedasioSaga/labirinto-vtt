import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { AcoesDaVez } from '../../lib/batalha/acoes'
import { BLOCOS_DO_INVOCADO_MAX, DANO_MAX, NOME_DO_INVOCADO_MAX, type NumerosDoInvocado, type PedidoDeAcao } from '../../lib/batalha/combate'
import { numerosValidos } from '../../lib/batalha/invocacao'
import { ehRefDeMidia } from '../../lib/midia'
import { urlDaMidiaNoMestre } from '../../lib/midiaNoDisco'
import { buildTokenPhotoData, isTokenPhotoData } from '../../lib/tokenPhoto'
import { ImagemOuIniciais } from '../FichaPecas'
import { useColocacaoDoMestre } from './colocacaoDoMestre'
import { economiaDoInvocado, pluralDoNome, textoDosNumeros } from './dadosDaInvocacao'
import { formatarNumero, lerInteiro, type AlvoNaMira, type GolpeNaTela } from './dadosDoMenu'
import { MarcasDaMira, MiraDoGolpe, pedidoDoGolpe, type ConsultaDaFicha } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * INVOCAÇÃO F3, o lado do MESTRE (docs/planos/batalha-invocacao-plano.md):
 *
 * - `InvocacoesPendentes`: "Ryoko invocou 1 Lobo · Colocar · Cancelar". O
 *   Colocar abre os números (editáveis; os sugeridos do Ultra vêm marcados)
 *   e arma o clique no mapa (`colocacaoDoMestre.ts`): a casa clicada é onde
 *   ele nasce. Cancelar é o Desfazer do pedido (o SP volta), com confirmação.
 * - `PainelDoBando`: a vez da carta do bando. Cada invocado com a vida e a
 *   economia dele ("Simples 0/1 · Mov 0/3"); o escolhido ataca pela mira de
 *   sempre (`agirComInvocado`); andar é arrastar o token no mapa.
 */

/** A pendência como a lista mostra. */
export interface PendenciaNaTela {
  id: string
  /** O nome do dono na mesa ("Ryoko"). */
  dono: string
  /** "Lobo", "Ultra Lobo". */
  nome: string
  rotulo: string
  ultra: boolean
  numeros: NumerosDoInvocado | null
  sugeridos: boolean
  imagem: string | null
  /** Ultra: quantos comuns do mesmo dono saem quando ele entra. */
  saem: number
  /** O nome dos comuns que saem ("Lobo"). */
  nomeDosQueSaem: string | null
}

/**
 * A foto do token a partir da imagem do cartão: a embutida vai como está; a
 * `midia:` passa pela ponte de arquivos do mestre e é reduzida como toda
 * foto de token (`buildTokenPhotoData`). Falhou = `null` (disco de iniciais).
 */
async function fotoDoCartao(imagem: string | null): Promise<string | null> {
  if (imagem === null) return null
  if (isTokenPhotoData(imagem)) return imagem
  if (!ehRefDeMidia(imagem)) return null
  try {
    const url = await urlDaMidiaNoMestre(imagem)
    if (url === null) return null
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    return await buildTokenPhotoData(await resposta.blob())
  } catch {
    return null
  }
}

type Foto = { estado: 'lendo' } | { estado: 'pronta'; imageData: string | null }

function useFotoDoCartao(imagem: string | null): Foto {
  const [foto, setFoto] = useState<Foto>(() => (imagem === null ? { estado: 'pronta', imageData: null } : isTokenPhotoData(imagem) ? { estado: 'pronta', imageData: imagem } : { estado: 'lendo' }))
  useEffect(() => {
    let vivo = true
    if (imagem === null || isTokenPhotoData(imagem)) return
    void fotoDoCartao(imagem).then((imageData) => {
      if (vivo) setFoto({ estado: 'pronta', imageData })
    })
    return () => {
      vivo = false
    }
  }, [imagem])
  return foto
}

export interface InvocacoesPendentesProps {
  sceneKey: string
  itens: readonly PendenciaNaTela[]
  onCancelar: (invocacaoId: string) => boolean
}

/** A lista Invocações (aba Batalha do mestre), no alto: nada de invocado fica esquecido. */
export function InvocacoesPendentes({ sceneKey, itens, onCancelar }: InvocacoesPendentesProps) {
  const [aberta, setAberta] = useState<string | null>(null)
  const armada = useColocacaoDoMestre((state) => state.armada)
  // A pendência saiu (posta, cancelada, desfeita): a colocação armada para ela desarma.
  useEffect(() => {
    if (armada !== null && !itens.some((item) => item.id === armada.invocacaoId)) useColocacaoDoMestre.getState().desarmar()
  }, [armada, itens])
  useEffect(() => () => useColocacaoDoMestre.getState().desarmar(), [])
  if (itens.length === 0) return null
  return (
    <section className="bt-secao" aria-label="Invocações esperando o mestre">
      <h3 className="bt-secao__titulo">Invocações · ponha no mapa</h3>
      <ul className="bt-pendentes">
        {itens.map((item) => (
          <PendenciaDaInvocacao
            key={item.id}
            sceneKey={sceneKey}
            item={item}
            aberta={aberta === item.id}
            onAbrir={() => setAberta(aberta === item.id ? null : item.id)}
            onCancelar={() => {
              if (onCancelar(item.id) && aberta === item.id) setAberta(null)
            }}
          />
        ))}
      </ul>
    </section>
  )
}

function PendenciaDaInvocacao({ sceneKey, item, aberta, onAbrir, onCancelar }: { sceneKey: string; item: PendenciaNaTela; aberta: boolean; onAbrir: () => void; onCancelar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const manter = useRef<HTMLButtonElement>(null)
  const erro = useColocacaoDoMestre((state) => (state.erro?.invocacaoId === item.id ? state.erro.texto : null))
  const armada = useColocacaoDoMestre((state) => state.armada?.invocacaoId === item.id)
  useEffect(() => {
    if (confirmando) manter.current?.focus()
  }, [confirmando])
  return (
    <li className="bt-pendente bt-invocacao" data-armada={armada ? 'sim' : undefined}>
      <div className="bt-invocacao__linha">
        <span className="bt-invocacao__rosto" aria-hidden="true">
          <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
        </span>
        <span className="bt-invocacao__texto">
          <span>
            <b>{item.dono}</b> invocou 1 <b>{item.nome}</b>
          </span>
          <small>{[item.rotulo, item.numeros === null ? 'números à mão' : textoDosNumeros(item.numeros), item.sugeridos ? 'sugeridos' : null].filter(Boolean).join(' · ')}</small>
        </span>
      </div>
      {confirmando ? (
        <div className="bt-pendente__acoes" role="group" aria-label={`Cancelar a invocação de ${item.dono}`}>
          <span className="bt-invocacao__pergunta">Tirar o pedido? O SP, a recarga e a carga voltam para {item.dono}.</span>
          <button type="button" className="bt-botao bt-botao--p" onClick={onCancelar}>
            Tirar o pedido
          </button>
          <button ref={manter} type="button" className="bt-botao bt-botao--p" onClick={() => setConfirmando(false)}>
            Manter
          </button>
        </div>
      ) : (
        <div className="bt-pendente__acoes">
          {/* Aberto, o Colocar vira o botão ligado de sempre (o latão claro do `aria-expanded`), não o primário. */}
          <button type="button" className={aberta ? 'bt-botao' : 'bt-botao bt-botao--primario'} aria-expanded={aberta} onClick={onAbrir}>
            Colocar
          </button>
          <button type="button" className="bt-botao" onClick={() => setConfirmando(true)}>
            Cancelar
          </button>
        </div>
      )}
      {erro !== null && (
        <p className="bt-npc__erro" role="alert">
          {erro}
        </p>
      )}
      {aberta && <EditorDaColocacao sceneKey={sceneKey} item={item} armada={armada} />}
    </li>
  )
}

/** Os números e o nome antes de nascer; "Escolher no mapa" arma o clique. */
function EditorDaColocacao({ sceneKey, item, armada }: { sceneKey: string; item: PendenciaNaTela; armada: boolean }) {
  const idBase = useId()
  const [nome, setNome] = useState(item.nome)
  const [hp, setHp] = useState(item.numeros === null ? '' : String(item.numeros.hp))
  const [dano, setDano] = useState(item.numeros === null ? '' : String(item.numeros.dano))
  const [blocos, setBlocos] = useState(item.numeros === null ? '' : String(item.numeros.blocos))
  const [erro, setErro] = useState<string | null>(null)
  const foto = useFotoDoCartao(item.imagem)
  const primeiro = useRef<HTMLInputElement>(null)
  useEffect(() => {
    primeiro.current?.focus()
  }, [])

  const numeros = (): NumerosDoInvocado | null => {
    const lidos = { hp: lerInteiro(hp, DANO_MAX), dano: lerInteiro(dano, DANO_MAX), blocos: lerInteiro(blocos, BLOCOS_DO_INVOCADO_MAX) }
    if (lidos.hp === null || lidos.dano === null || lidos.blocos === null) return null
    return numerosValidos({ hp: lidos.hp, dano: lidos.dano, blocos: lidos.blocos })
  }

  const armar = () => {
    if (armada) {
      useColocacaoDoMestre.getState().desarmar()
      return
    }
    const lidos = numeros()
    if (lidos === null) {
      setErro(`HP de 1 a ${formatarNumero(DANO_MAX)}, dano de 0 a ${formatarNumero(DANO_MAX)} e blocos de 0 a ${BLOCOS_DO_INVOCADO_MAX}.`)
      return
    }
    setErro(null)
    const nomeLimpo = nome.trim() || item.nome
    const imageData = foto.estado === 'pronta' ? foto.imageData : null
    useColocacaoDoMestre.getState().armar({ sceneKey, invocacaoId: item.id, nome: nomeLimpo, ajuste: { nome: nomeLimpo, numeros: lidos, imageData } })
  }

  const campo = (rotulo: string, valor: string, mudar: (texto: string) => void, ref?: typeof primeiro) => (
    <label className="bt-linha-campo">
      <span>{rotulo}</span>
      <input
        ref={ref}
        className="bt-num"
        inputMode="numeric"
        value={valor}
        data-sugerido={item.sugeridos ? 'sim' : undefined}
        aria-invalid={erro !== null && lerInteiro(valor, DANO_MAX) === null ? true : undefined}
        aria-describedby={item.sugeridos ? `${idBase}-sugeridos` : undefined}
        onChange={(evento) => {
          setErro(null)
          mudar(evento.target.value)
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') {
            evento.preventDefault()
            armar()
          }
        }}
      />
    </label>
  )

  return (
    <div className="bt-invocacao__editor">
      {item.sugeridos && (
        <p className="bt-invocacao__sugeridos" id={`${idBase}-sugeridos`}>
          Números sugeridos (os comuns juntos + 1). Ajuste antes de colocar.
        </p>
      )}
      {item.numeros === null && <p className="bt-invocacao__sugeridos">O texto da técnica não diz HP e dano: digite antes de colocar.</p>}
      <div className="bt-invocacao__campos">
        {campo('HP', hp, setHp, primeiro)}
        {campo('Dano', dano, setDano)}
        {campo('Blocos', blocos, setBlocos)}
        <label className="bt-linha-campo">
          <span>Nome</span>
          <input className="bt-num bt-num--texto" maxLength={NOME_DO_INVOCADO_MAX} value={nome} onChange={(evento) => setNome(evento.target.value)} />
        </label>
      </div>
      {item.saem > 0 && (
        <p className="bt-npc__perfil">
          Ao entrar, {item.saem === 1 ? `1 ${item.nomeDosQueSaem ?? 'comum'} sai` : `${item.saem} ${pluralDoNome(item.nomeDosQueSaem ?? 'comum')} saem`} do mapa.
        </p>
      )}
      <p className="bt-npc__perfil">
        {foto.estado === 'lendo' ? 'Lendo a imagem da técnica…' : foto.imageData === null ? 'Sem imagem na técnica: o token nasce com as iniciais.' : 'O token nasce com a imagem da técnica.'}
      </p>
      {erro !== null && (
        <p className="bt-npc__erro" role="alert">
          {erro}
        </p>
      )}
      <div className="bt-pendente__acoes">
        <button type="button" className="bt-botao bt-botao--batalha" aria-pressed={armada} disabled={foto.estado === 'lendo'} onClick={armar}>
          {armada ? 'Clique na casa no mapa…' : 'Escolher no mapa'}
        </button>
        {armada && <span className="bt-npc__perfil">Esc cancela</span>}
      </div>
    </div>
  )
}

/** O aviso sobre o mapa enquanto o Colocar está armado; Esc desarma (sem mudar nada). */
export function AvisoDaColocacao() {
  const armada = useColocacaoDoMestre((state) => state.armada)
  useEffect(() => {
    if (armada === null) return
    const teclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      evento.preventDefault()
      useColocacaoDoMestre.getState().desarmar()
    }
    window.addEventListener('keydown', teclar, true)
    return () => window.removeEventListener('keydown', teclar, true)
  }, [armada])
  if (armada === null) return null
  return (
    <div className="bt-aviso-colocacao" role="status">
      <span className="bt-vez__espera-ponto" aria-hidden="true" />
      Clique na casa onde <b>{armada.nome}</b> nasce
      <button type="button" className="bt-botao bt-botao--p" onClick={() => useColocacaoDoMestre.getState().desarmar()}>
        Cancelar <kbd>Esc</kbd>
      </button>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// A vez do bando
// ───────────────────────────────────────────────────────────────────────────

export interface MembroNaVez {
  tokenId: string
  nome: string
  imagem: string | null
  vida: { atual: number; maximo: number } | null
  acoes: AcoesDaVez
  /** As técnicas e o Atacar da ficha temporária (o "Golpe" com o dano dele). */
  golpes: readonly GolpeNaTela[]
  alvos: readonly AlvoNaMira[]
}

export interface PainelDoBandoProps {
  nome: string
  cor: string | null
  membros: readonly MembroNaVez[]
  onAgir: (tokenId: string, pedido: PedidoDeAcao) => boolean
  onEncerrar: () => boolean
  onDarDano: () => void
  consulta?: ConsultaDaFicha | null
  alvoDoMapa?: { tokenId: string; seq: number } | null
  mapa?: { ligado: boolean; onTrocar: (ligado: boolean) => void }
}

/** A vez da carta do bando: escolher quem age e, dele, o golpe; mover é no mapa. */
export function PainelDoBando({ nome, cor, membros, onAgir, onEncerrar, onDarDano, consulta, alvoDoMapa, mapa }: PainelDoBandoProps) {
  const idBase = useId()
  const primeiroQueAge = membros.find((membro) => membro.acoes.simples.usadas < membro.acoes.simples.total) ?? membros[0]
  const [quemId, setQuemId] = useState<string | null>(primeiroQueAge?.tokenId ?? null)
  const quem = membros.find((membro) => membro.tokenId === quemId) ?? primeiroQueAge ?? null
  const valido = quem?.golpes.find((golpe) => golpe.motivo === null) ?? null
  const [golpeChave, setGolpeChave] = useState<string | null>(valido?.chave ?? null)
  const golpe = quem?.golpes.find((candidato) => candidato.chave === golpeChave && candidato.motivo === null) ?? valido
  const [aviso, setAviso] = useState<string | null>(null)
  const estilo = cor === null ? undefined : ({ '--lado': cor } as CSSProperties)
  // Invocação (pedido de 01/11): o lobo apontado em "Quem age" (o mouse ou o foco) acende no mapa; sem apontar, o escolhido.
  const [apontado, setApontado] = useState<string | null>(null)
  const destaque = apontado ?? quem?.tokenId ?? null
  const destaques = useMemo(() => (destaque === null ? [] : [destaque]), [destaque])
  const marcadosDoDestaque = useMemo(() => new Set(destaques), [destaques])

  return (
    <div className="bt-npc bt-bando" style={estilo}>
      {consulta !== undefined && consulta !== null && destaques.length > 0 && <MarcasDaMira consulta={consulta} tokenIds={destaques} marcados={marcadosDoDestaque} foco={destaque} variante="quem" />}
      <div className="bt-npc__quem">
        <span className="bt-npc__retrato bt-bando__rostos" aria-hidden="true">
          {membros.slice(0, 3).map((membro) => (
            <span key={membro.tokenId} className="bt-bando__rosto">
              <ImagemOuIniciais imagem={membro.imagem} nome={membro.nome} />
            </span>
          ))}
        </span>
        <div>
          <b className="bt-npc__nome">Vez de {nome}</b>
          <span className="bt-npc__perfil">
            {membros.length === 0 ? 'Nenhum invocado em campo' : `${membros.length === 1 ? '1 invocado' : `${membros.length} invocados`} · cada um ataca uma vez e anda o dele`}
          </span>
        </div>
      </div>
      {/* Invocação (lote de 01/11): o último que caiu na vez do bando deixa a carta com a vez até o mestre passar. */}
      {membros.length === 0 ? (
        <p className="bt-texto">Ninguém para agir: encerre a vez.</p>
      ) : (
        <fieldset className="bt-npc__lista">
          <legend>Quem age</legend>
          {membros.map((membro) => {
            const atacou = membro.acoes.simples.usadas >= membro.acoes.simples.total
            return (
              <label
                key={membro.tokenId}
                className="bt-opcao bt-opcao--membro"
                data-atacou={atacou ? 'sim' : undefined}
                onPointerEnter={() => setApontado(membro.tokenId)}
                onPointerLeave={() => setApontado((antes) => (antes === membro.tokenId ? null : antes))}
                onFocus={() => setApontado(membro.tokenId)}
                onBlur={() => setApontado((antes) => (antes === membro.tokenId ? null : antes))}
              >
                <input
                  type="radio"
                  name={`${idBase}-quem`}
                  checked={quem?.tokenId === membro.tokenId}
                  onChange={() => {
                    setAviso(null)
                    setQuemId(membro.tokenId)
                    setGolpeChave(null)
                  }}
                />
                <span className="bt-invocacao__rosto" aria-hidden="true">
                  <ImagemOuIniciais imagem={membro.imagem} nome={membro.nome} />
                </span>
                <span className="bt-opcao__nome">
                  {membro.nome}
                  <small>
                    {[membro.vida === null ? null : `HP ${formatarNumero(membro.vida.atual)}/${formatarNumero(membro.vida.maximo)}`, economiaDoInvocado(membro.acoes), atacou ? 'já atacou' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
              </label>
            )
          })}
        </fieldset>
      )}
      {quem !== null && (
        <>
          <p className="bt-npc__perfil">
            Para andar, arraste {quem.nome} no mapa (até {formatarNumero(quem.acoes.blocos.limite ?? 0)} {quem.acoes.blocos.limite === 1 ? 'bloco' : 'blocos'}).
          </p>
          {quem.golpes.length > 1 && (
            <fieldset className="bt-npc__lista">
              <legend>Golpe de {quem.nome}</legend>
              {quem.golpes.map((item) => (
                <label key={item.chave} className="bt-opcao" data-apagada={item.motivo === null ? 'nao' : 'sim'} title={item.motivo ?? undefined}>
                  <input type="radio" name={`${idBase}-golpe`} checked={golpe?.chave === item.chave} disabled={item.motivo !== null} onChange={() => setGolpeChave(item.chave)} />
                  <span className="bt-opcao__nome">
                    {item.nome}
                    <small>{item.motivo ?? [item.acaoTexto, item.dano.valor === null ? 'dano à mão' : `dano ${formatarNumero(item.dano.valor)}`].join(' · ')}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {golpe === null ? (
            <p className="bt-texto">{quem.nome} já atacou nesta vez. Escolha outro invocado ou encerre a vez.</p>
          ) : (
            <MiraDoGolpe
              key={`${quem.tokenId}:${golpe.chave}`}
              golpe={golpe}
              carga={0}
              alvos={quem.alvos}
              rotuloDoLancar="Atacar"
              semVoltar
              onVoltar={() => {}}
              consulta={consulta}
              alvoDoMapa={alvoDoMapa}
              mapa={mapa}
              onLancar={(escolha) => {
                const saiu = onAgir(quem.tokenId, pedidoDoGolpe(golpe, escolha))
                setAviso(saiu ? null : 'A regra recusou: confira se ele ainda tem a Simples e o alvo.')
                if (saiu) {
                  // O próximo que ainda não atacou já fica escolhido (a ordem é a do bando).
                  const proximo = membros.find((membro) => membro.tokenId !== quem.tokenId && membro.acoes.simples.usadas < membro.acoes.simples.total)
                  if (proximo !== undefined) setQuemId(proximo.tokenId)
                  setGolpeChave(null)
                }
                return saiu
              }}
            />
          )}
        </>
      )}
      {aviso !== null && (
        <p className="bt-npc__erro" role="alert">
          {aviso}
        </p>
      )}
      <div className="bt-pendente__acoes">
        <button type="button" className="bt-botao" onClick={onDarDano}>
          Dar dano
        </button>
        <button type="button" className="bt-botao bt-botao--primario" onClick={() => setAviso(onEncerrar() ? null : 'A vez não passou: confira a ordem.')}>
          Encerrar vez
        </button>
      </div>
    </div>
  )
}
