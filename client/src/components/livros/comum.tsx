import { useEffect, useState } from 'react'
import { lerIndiceDasPastas } from '../../lib/pastasDeMapas'
import { FORCA_PADRAO, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { ESCOLHA_DAS_ARMAS } from '../../lib/batalha/leituraDaFicha'
import { useMundoDoLivroStore, type MudancaDoMundo } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { ImagemOuIniciais } from '../FichaPecas'

/**
 * Peças comuns das páginas do mundo do livro: o retrato redondo, a força
 * escrita como a tela a mostra ("×1,5"), o "visto hoje" e o gravar com aviso
 * e Desfazer. Sem regra de jogo aqui: as regras são de lib/livros/.
 */

/** "×1,5", "×0,75", "×1": a força como o protótipo e o deslizante a escrevem. */
export function formatarForca(forca: number): string {
  return `×${String(Math.round(forca * 100) / 100).replace('.', ',')}`
}

/** O número com o separador de milhar do português ("1.250"). */
export function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

/** A força mudou do padrão (a tela destaca em latão). */
export function forcaMexida(forca: number): boolean {
  return forca !== FORCA_PADRAO
}

const DIA_MS = 24 * 60 * 60 * 1000

/** "visto hoje", "visto ontem", "visto há 3 dias", "visto em 12/10": o quando da mesa, sem minuto. */
export function fraseDoVisto(vistoEm: number, agora: number): string {
  const hoje = new Date(agora)
  hoje.setHours(0, 0, 0, 0)
  const dia = new Date(vistoEm)
  dia.setHours(0, 0, 0, 0)
  const dias = Math.round((hoje.getTime() - dia.getTime()) / DIA_MS)
  if (dias <= 0) return 'visto hoje'
  if (dias === 1) return 'visto ontem'
  if (dias < 7) return `visto há ${dias} dias`
  return `visto em ${new Date(vistoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

/** "Humano · Navegador": as escolhas de texto da ficha, na ordem do sistema (sem o "Armas por batalha", que é número). */
export function escolhasDaFicha(personagem: Personagem, sistema: SistemaDeRpg | undefined): string {
  if (sistema === undefined) return ''
  return sistema.escolhas
    .filter((escolha) => escolha.id !== ESCOLHA_DAS_ARMAS)
    .map((escolha) => (personagem.escolhas[escolha.id] ?? '').trim())
    .filter((valor) => valor.length > 0)
    .slice(0, 2)
    .join(' · ')
}

/** O primeiro nome ("Recruta" de "Recruta da Marinha"), para "Recruta 3" e "hoje com Bruno". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}

/** Pede menos movimento: as saídas animadas viram instantâneas. */
export function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type TamanhoDoRetrato = 'p' | 'm' | 'g'

/** O retrato redondo com o aro de latão; sem foto, as iniciais (`ImagemOuIniciais`). */
export function Retrato({ imagem, nome, tamanho = 'm' }: { imagem: string | null; nome: string; tamanho?: TamanhoDoRetrato }) {
  return (
    <span className={`mu-retrato mu-retrato--${tamanho}`} aria-hidden="true">
      <ImagemOuIniciais imagem={imagem} nome={nome} />
    </span>
  )
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export interface AvisoDaMudanca {
  /** A frase do que aconteceu ("“beto” agora entra como Aira."). */
  texto: string
  /** A mudança que volta atrás; ausente = o aviso só informa. */
  desfazer?: MudancaDoMundo
}

/**
 * Grava pelo funil único do mundo (`useMundoDoLivroStore().mudar`) e conta o
 * que fez num aviso com Desfazer. Falha vira aviso de erro com a razão.
 * Devolve se gravou.
 */
export async function gravarNoMundo(mudanca: MudancaDoMundo, aviso?: AvisoDaMudanca): Promise<boolean> {
  const toasts = useToastStore.getState()
  try {
    await useMundoDoLivroStore.getState().mudar(mudanca)
  } catch (erro) {
    toasts.push('error', `Não deu para guardar: ${mensagemDoErro(erro)}`)
    return false
  }
  if (aviso === undefined) return true
  const desfazer = aviso.desfazer
  toasts.push(
    'info',
    aviso.texto,
    undefined,
    desfazer === undefined
      ? undefined
      : {
          actions: [
            {
              label: 'Desfazer',
              run: () => {
                useMundoDoLivroStore
                  .getState()
                  .mudar(desfazer)
                  .then(
                    () => useToastStore.getState().push('info', 'Desfeito.'),
                    (erro: unknown) => useToastStore.getState().push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`),
                  )
              },
            },
          ],
        },
  )
  return true
}

/** Sem a marca "Só no cenário": volta à ordem dos turnos. A chave sai do objeto (nada de `soCenario: undefined` gravado). */
export function semCenario(personagem: Personagem): Personagem {
  if (personagem.soCenario === undefined) return personagem
  const { soCenario: _soCenario, ...resto } = personagem
  return resto
}

/** Troca a ficha de mesmo id na lista (ficha que sumiu no meio: nada muda). */
export function trocarFicha(personagens: Personagem[], id: string, trocar: (personagem: Personagem) => Personagem): Personagem[] {
  return personagens.map((personagem) => (personagem.id === id ? trocar(personagem) : personagem))
}

export interface PastaDoMundo {
  nome: string
  /** Os mapas que usam os personagens da pasta (os que não estão em "Configurar só neste mapa"). */
  mapas: number
}

/** O nome da pasta aberta e quantos mapas a usam, do índice das pastas. `null` enquanto lê (ou sem índice). */
export function usePastaDoMundo(pastaId: string | undefined): PastaDoMundo | null {
  const [pasta, setPasta] = useState<PastaDoMundo | null>(null)
  useEffect(() => {
    if (pastaId === undefined) return
    let vivo = true
    void lerIndiceDasPastas().then(({ indice }) => {
      if (!vivo) return
      const achada = indice.pastas.find((candidata) => candidata.id === pastaId)
      const mapas = indice.mapas.filter((lugar) => lugar.pastaId === pastaId && lugar.proprio !== true).length
      setPasta(achada === undefined ? null : { nome: achada.nome, mapas })
    })
    return () => {
      vivo = false
    }
  }, [pastaId])
  return pasta
}
