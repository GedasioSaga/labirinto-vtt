/**
 * As VERSÕES da peça de xadrez gigante (L03, 28/11/2026): a 1ª, o Peão, é o desenho de `MONTADORES`
 * (`../pecaDeXadrez.ts`); as outras são a mesma peça de pedra com outro alto, e a Tombada é o rei caído de lado.
 * O lado (claras ou escuras) não é versão: sai do material da pedra (mármore ou ardósia).
 */
import type { VersoesDesenhadas } from '.'
import { montadorDaPecaDeXadrez } from '../pecaDeXadrez'

export const versoesDoPecaDeXadrez: VersoesDesenhadas = {
  torre: montadorDaPecaDeXadrez('torre'),
  cavalo: montadorDaPecaDeXadrez('cavalo'),
  bispo: montadorDaPecaDeXadrez('bispo'),
  rainha: montadorDaPecaDeXadrez('rainha'),
  rei: montadorDaPecaDeXadrez('rei'),
  tombada: montadorDaPecaDeXadrez('tombada'),
}
