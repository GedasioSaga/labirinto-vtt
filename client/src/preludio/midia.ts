import { useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { sep } from '@tauri-apps/api/path'
import { pastaDoPreparo } from '../lib/preparo/disco'

/**
 * AS IMAGENS DO PRELÚDIO: `midia/<sha256>.<ext>` dentro de `<appData>/preparo/`
 * (plano §2), mostradas pelo protocolo de arquivos do app, que só alcança o
 * AppData (`tauri.conf.json`, assetProtocol). Só passa o caminho no formato da
 * importação: um verbete mexido à mão não aponta a tela para outro arquivo.
 *
 * A pasta é lida uma vez, antes de a Enciclopédia aparecer (`prepararMidia`),
 * para o texto já nascer com as imagens no lugar.
 */

const CAMINHO_DE_MIDIA = /^midia\/[A-Za-z0-9]{8,128}\.[A-Za-z0-9]{1,8}$/

let pronta: string | null = null
let pedido: Promise<string | null> | null = null

/** Lê a pasta do Prelúdio para as imagens. Nunca lança: sem ela, a imagem diz que está sem arquivo. */
export function prepararMidia(): Promise<string | null> {
  pedido ??= pastaDoPreparo().then(
    (caminho) => {
      pronta = caminho
      return caminho
    },
    () => {
      pedido = null
      return null
    },
  )
  return pedido
}

/** O endereço da imagem para `<img src>`, ou `null` quando o caminho não é de mídia do Prelúdio. */
export function urlDaMidia(raiz: string, midia: string | null | undefined): string | null {
  if (typeof midia !== 'string' || !CAMINHO_DE_MIDIA.test(midia)) return null
  const separador = sep()
  return convertFileSrc(`${raiz}${separador}${midia.replace('/', separador)}`)
}

/** A pasta do Prelúdio, para montar o endereço das imagens; `null` enquanto não chega (ou se o Prelúdio está desligado). */
export function useRaizDaMidia(): string | null {
  const [raiz, setRaiz] = useState<string | null>(pronta)
  useEffect(() => {
    if (raiz !== null) return
    let vivo = true
    void prepararMidia().then((caminho) => {
      if (vivo && caminho !== null) setRaiz(caminho)
    })
    return () => {
      vivo = false
    }
  }, [raiz])
  return raiz
}
