// Entrada do pacote do protótipo: o MESMO código que vai para o app (client/src), empacotado
// pelo montar.cjs num IIFE que expõe a variável global TelhadoLab dentro do index.html.
export { aguaNoPonto, BEIRAL_PX, dentroDoPoligono, prepararAguas } from '../../../../client/src/lib/telhado/aguas'
export {
  COR_PADRAO_DO_TETO,
  corDaPaleta,
  corDoTetoOuPadrao,
  corDoTetoValida,
  corPadraoDoModelo,
  MODELO_PADRAO_DO_TETO,
  MODELOS_DO_TETO,
  NOME_DO_MODELO,
  PALETA_DO_TETO,
} from '../../../../client/src/lib/telhado/paletas'
export { escalaDoTelhado, pintarTelhado } from '../../../../client/src/texturas/telhado'
