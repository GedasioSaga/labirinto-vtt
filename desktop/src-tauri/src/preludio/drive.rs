//! O GOOGLE DRIVE DA CÓPIA (API v3). Vem do `drive.rs` do Grimório (autorizado pelo
//! mestre em 08/11/2026), no reqwest 0.13 do Labirinto e com o desenho da cópia
//! (`plano.rs`): uma pasta raiz marcada, `objetos/` e `copias/` dentro dela.
//!
//! Escopo `drive.file`: o token só enxerga o que este cliente OAuth criou. O cliente é
//! o mesmo do Grimório, então o sync do Grimório também aparece para ele; por isso toda
//! listagem daqui é de UMA pasta (os filhos da raiz marcada `labirintoPreludio`), nunca
//! do Drive inteiro, e nada aqui apaga ou muda arquivo existente: só cria e lê.

use std::collections::HashMap;

use reqwest::header::{HeaderValue, CONTENT_TYPE, LOCATION};
use serde::{Deserialize, Serialize};
use sha2::{Digest as _, Sha256};

use super::google::{self, EstadoGoogle};
use super::plano;
use super::rede::{self, PAGINA_MAX, RESPOSTA_PEQUENA_MAX, TEMPO_CURTO};
use super::ErroPreludio;

const API: &str = "https://www.googleapis.com/drive/v3/files";
const API_DE_ENVIO: &str = "https://www.googleapis.com/upload/drive/v3/files";
/// O endereço da sessão de envio grande tem de ser deste host (leva o access token).
const HOST_DA_API: &str = "www.googleapis.com";
const TIPO_PASTA: &str = "application/vnd.google-apps.folder";
const TIPO_JSON: &str = "application/json; charset=UTF-8";
const TIPO_BINARIO: &str = "application/octet-stream";

/// Só rótulo: a identidade da raiz é a marca em `appProperties`, então o mestre pode
/// renomear ou mover a pasta no drive.google.com sem o app criar outra.
const NOME_DA_RAIZ: &str = "Labirinto - Prelúdio";
const MARCA_DA_RAIZ: &str = "labirintoPreludio";
const VALOR_DA_MARCA: &str = "1";
pub const PASTA_DOS_OBJETOS: &str = "objetos";
pub const PASTA_DAS_COPIAS: &str = "copias";

/// Acima disto o `uploadType=multipart` é recusado pelo Drive (limite da API).
const LIMITE_MULTIPART: usize = 5 * 1024 * 1024;
const POR_PAGINA: &str = "1000";
/// Teto de páginas numa listagem (500 mil arquivos): a lista do Drive sempre acaba.
const PAGINAS_MAX: usize = 500;
const CAMPOS_DA_LISTA: &str = "nextPageToken,files(id,name,size,sha256Checksum,appProperties)";
const CAMPOS_DO_ENVIO: &str = "id,name,size,sha256Checksum";
const ID_MAX: usize = 200;

/// Propriedades que a cópia leva no Drive (cabem nos 124 bytes por chave + valor).
const PROP_QUANDO: &str = "quando";
const PROP_ARQUIVOS: &str = "arquivos";
const PROP_BYTES: &str = "bytes";
const PROP_ASSINATURA: &str = "assinatura";

/// Um arquivo ou pasta como a API v3 descreve (o `size` vem como texto: é `int64`).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArquivoDoDrive {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub size: Option<String>,
    pub sha256_checksum: Option<String>,
    #[serde(default)]
    pub app_properties: HashMap<String, String>,
}

/// Um objeto (`objetos/<sha256>`) que está no Drive e serve ([`conferir`]).
pub struct ObjetoNoDrive {
    pub id: String,
    pub tamanho: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pagina {
    #[serde(default)]
    files: Vec<ArquivoDoDrive>,
    next_page_token: Option<String>,
}

/// Uma cópia no Drive, como a tela do Prelúdio mostra.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopiaNoDrive {
    pub id: String,
    pub nome: String,
    pub quando: u64,
    pub arquivos: u64,
    pub bytes: u64,
    #[serde(skip)]
    pub assinatura: String,
}

/// As duas pastas da cópia no Drive, dentro da raiz marcada.
pub struct Pastas {
    pub objetos: String,
    pub copias: String,
}

/// O resumo de uma cópia, guardado nas propriedades do manifesto no Drive.
pub struct ResumoNoDrive<'a> {
    pub quando: u64,
    pub arquivos: u64,
    pub bytes: u64,
    pub assinatura: &'a str,
}

/// Id de arquivo do Drive: letras, números, `-` e `_` (vai no caminho da URL).
pub fn id_valido(id: &str) -> bool {
    (1..=ID_MAX).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Escapa um valor para dentro do `q` do Drive, que delimita texto com aspas simples.
/// A barra invertida dobra ANTES da aspa, senão a barra recém-posta seria escapada de novo.
fn escapar(valor: &str) -> String {
    valor.replace('\\', "\\\\").replace('\'', "\\'")
}

/// Traduz a recusa da API sem ecoar o pedido (o token vai no cabeçalho).
fn falha_do_drive(status: u16, corpo: &[u8]) -> ErroPreludio {
    #[derive(Deserialize)]
    struct Envelope {
        error: Option<Detalhe>,
    }
    #[derive(Deserialize)]
    struct Detalhe {
        message: Option<String>,
    }
    let detalhe: String = serde_json::from_slice::<Envelope>(corpo)
        .ok()
        .and_then(|envelope| envelope.error)
        .and_then(|detalhe| detalhe.message)
        .map(|mensagem| mensagem.chars().filter(|c| !c.is_control()).take(200).collect())
        .unwrap_or_default();
    let (codigo, base) = match status {
        401 => ("sem_conta", "A conexão com o Google venceu. Entre com o Google de novo."),
        403 => ("google", "O Google recusou a operação no Drive (cota do dia, espaço cheio ou permissão)."),
        404 => ("google", "O arquivo não está mais no Google Drive."),
        429 | 500..=599 => ("rede", "O Google está instável ou pediu para desacelerar. Tente de novo em instantes."),
        _ => ("google", "O Google recusou a operação no Drive."),
    };
    let mensagem = if detalhe.is_empty() {
        format!("{base} (HTTP {status})")
    } else {
        format!("{base} (HTTP {status}: {detalhe})")
    };
    ErroPreludio::novo(codigo, mensagem)
}

fn resposta_estranha() -> ErroPreludio {
    ErroPreludio::novo("google", "O Google Drive respondeu num formato inesperado.")
}

/// Fronteira do `multipart/related` tirada do hash do conteúdo e alongada até não
/// aparecer nele: uma fronteira dentro do corpo faria o Drive cortar o arquivo sem erro.
fn fronteira(conteudo: &[u8]) -> String {
    let mut marca = format!("labirinto-{}", &plano::hex(&Sha256::digest(conteudo))[..32]);
    while conteudo.windows(marca.len()).any(|janela| janela == marca.as_bytes()) {
        marca.push('z');
    }
    marca
}

fn corpo_multipart(metadados: &str, conteudo: &[u8], fronteira: &str) -> Vec<u8> {
    let mut corpo = Vec::with_capacity(conteudo.len() + metadados.len() + 256);
    corpo.extend_from_slice(
        format!(
            "--{fronteira}\r\nContent-Type: {TIPO_JSON}\r\n\r\n{metadados}\r\n--{fronteira}\r\nContent-Type: {TIPO_BINARIO}\r\n\r\n"
        )
        .as_bytes(),
    );
    corpo.extend_from_slice(conteudo);
    corpo.extend_from_slice(format!("\r\n--{fronteira}--").as_bytes());
    corpo
}

fn numero(propriedades: &HashMap<String, String>, chave: &str) -> Option<u64> {
    propriedades.get(chave)?.parse().ok()
}

/// Como um objeto (`objetos/<sha256>`) confere com o nome, que é o sha256 do que o app
/// enviou. A ordem das variantes conta: entre dois objetos do mesmo hash (dois PCs
/// subindo ao mesmo tempo), fica o maior.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Conferencia {
    /// O Drive não mandou o `sha256Checksum` (a API diz "se disponível").
    SemChecksum,
    /// O `sha256Checksum` que o Google calculou é o próprio nome.
    Confere,
}

/// A regra do objeto, a MESMA no envio ([`Drive::enviar_objeto`]) e na listagem
/// ([`mapa_de_objetos`]): um objeto que o envio desse como feito e a listagem ignorasse
/// subiria de novo a cada cópia, e o restaurar diria que ele falta. Sem checksum vale,
/// porque o restaurar recalcula o sha256 e o tamanho de todo download (`copia::montar`):
/// um objeto errado nunca volta ao PC calado. `None` = não serve: o nome não é um hash,
/// ou o checksum veio e diverge (a cópia seguinte sobe o conteúdo certo).
fn conferir(nome: &str, checksum: Option<&str>) -> Option<Conferencia> {
    if !plano::eh_hash(nome) {
        return None;
    }
    match checksum {
        None => Some(Conferencia::SemChecksum),
        Some(hash) if hash.eq_ignore_ascii_case(nome) => Some(Conferencia::Confere),
        Some(_) => None,
    }
}

/// Hash → objeto, a partir da listagem de `objetos/`.
fn mapa_de_objetos(arquivos: Vec<ArquivoDoDrive>) -> HashMap<String, ObjetoNoDrive> {
    let mut escolhidos: HashMap<String, (Conferencia, ObjetoNoDrive)> = HashMap::new();
    for arquivo in arquivos {
        let Some(conferencia) = conferir(&arquivo.name, arquivo.sha256_checksum.as_deref()) else {
            continue;
        };
        if escolhidos.get(&arquivo.name).is_some_and(|(atual, _)| *atual >= conferencia) {
            continue;
        }
        let tamanho = arquivo.size.as_deref().and_then(|texto| texto.parse().ok());
        escolhidos.insert(arquivo.name, (conferencia, ObjetoNoDrive { id: arquivo.id, tamanho }));
    }
    escolhidos.into_iter().map(|(hash, (_, objeto))| (hash, objeto)).collect()
}

/// O Drive visto por um login. Cada pedido busca o access token na hora (renova sozinho
/// quando vence no meio de uma cópia longa).
pub struct Drive<'a> {
    http: &'a reqwest::Client,
    google: &'a EstadoGoogle,
}

impl<'a> Drive<'a> {
    pub fn novo(http: &'a reqwest::Client, google: &'a EstadoGoogle) -> Self {
        Self { http, google }
    }

    async fn token(&self) -> Result<String, ErroPreludio> {
        google::access_token(self.google, self.http).await
    }

    /// Manda o pedido com o token e devolve o corpo de uma resposta 2xx (até `teto`).
    async fn pedir(&self, pedido: reqwest::RequestBuilder, teto: usize) -> Result<Vec<u8>, ErroPreludio> {
        let token = self.token().await?;
        let mut resposta = pedido.bearer_auth(token).send().await.map_err(|e| rede::erro_de_rede(&e))?;
        let status = resposta.status().as_u16();
        if (200..300).contains(&status) {
            return rede::ler_limitado(&mut resposta, teto).await;
        }
        if status == 401 {
            google::esquecer_token(self.google).await;
        }
        let corpo = rede::ler_limitado(&mut resposta, RESPOSTA_PEQUENA_MAX).await.unwrap_or_default();
        Err(falha_do_drive(status, &corpo))
    }

    /// Uma consulta `files.list`, paginada até o fim.
    async fn listar(&self, q: &str, ordem: Option<&str>) -> Result<Vec<ArquivoDoDrive>, ErroPreludio> {
        let mut todos = Vec::new();
        let mut proxima: Option<String> = None;
        for _ in 0..PAGINAS_MAX {
            let mut parametros = vec![
                ("q", q),
                ("fields", CAMPOS_DA_LISTA),
                ("pageSize", POR_PAGINA),
                ("spaces", "drive"),
            ];
            if let Some(ordem) = ordem {
                parametros.push(("orderBy", ordem));
            }
            if let Some(token) = proxima.as_deref() {
                parametros.push(("pageToken", token));
            }
            let url = rede::url_com(API, &parametros)?;
            let corpo = self.pedir(self.http.get(url).timeout(TEMPO_CURTO), PAGINA_MAX).await?;
            let pagina: Pagina = serde_json::from_slice(&corpo).map_err(|_| resposta_estranha())?;
            todos.extend(pagina.files);
            match pagina.next_page_token {
                Some(token) => proxima = Some(token),
                None => return Ok(todos),
            }
        }
        Err(ErroPreludio::novo("google", "A lista do Google Drive não acabou (mais de 500 páginas)."))
    }

    async fn criar_pasta(&self, nome: &str, mae: Option<&str>, marcada: bool) -> Result<String, ErroPreludio> {
        let mut corpo = serde_json::json!({ "name": nome, "mimeType": TIPO_PASTA });
        if let Some(mae) = mae {
            corpo["parents"] = serde_json::json!([mae]);
        }
        if marcada {
            corpo["appProperties"] = serde_json::json!({ MARCA_DA_RAIZ: VALOR_DA_MARCA });
        }
        let url = rede::url_com(API, &[("fields", "id")])?;
        let pedido = self
            .http
            .post(url)
            .header(CONTENT_TYPE, HeaderValue::from_static(TIPO_JSON))
            .body(corpo.to_string())
            .timeout(TEMPO_CURTO);
        let resposta = self.pedir(pedido, RESPOSTA_PEQUENA_MAX).await?;
        let criada: ArquivoDoDrive = serde_json::from_slice(&resposta).map_err(|_| resposta_estranha())?;
        Ok(criada.id)
    }

    /// A raiz da cópia, achada pela marca. Duas raízes só existem se dois PCs a criaram ao
    /// mesmo tempo; a mais antiga vence, que é a escolha para a qual os dois convergem.
    async fn raiz(&self) -> Result<Option<String>, ErroPreludio> {
        let q = format!(
            "appProperties has {{ key='{MARCA_DA_RAIZ}' and value='{VALOR_DA_MARCA}' }} \
             and mimeType = '{TIPO_PASTA}' and trashed = false"
        );
        Ok(self.listar(&q, Some("createdTime")).await?.into_iter().next().map(|pasta| pasta.id))
    }

    async fn filha(&self, mae: &str, nome: &str) -> Result<Option<String>, ErroPreludio> {
        let q = format!(
            "'{}' in parents and name = '{}' and mimeType = '{TIPO_PASTA}' and trashed = false",
            escapar(mae),
            escapar(nome)
        );
        Ok(self.listar(&q, Some("createdTime")).await?.into_iter().next().map(|pasta| pasta.id))
    }

    async fn filha_ou_nova(&self, mae: &str, nome: &str) -> Result<String, ErroPreludio> {
        match self.filha(mae, nome).await? {
            Some(id) => Ok(id),
            None => self.criar_pasta(nome, Some(mae), false).await,
        }
    }

    /// As pastas da cópia, criando o que faltar (para copiar).
    pub async fn garantir_pastas(&self) -> Result<Pastas, ErroPreludio> {
        let raiz = match self.raiz().await? {
            Some(raiz) => raiz,
            None => self.criar_pasta(NOME_DA_RAIZ, None, true).await?,
        };
        Ok(Pastas {
            objetos: self.filha_ou_nova(&raiz, PASTA_DOS_OBJETOS).await?,
            copias: self.filha_ou_nova(&raiz, PASTA_DAS_COPIAS).await?,
        })
    }

    /// As pastas da cópia, sem criar nada (para listar e restaurar). `None` = ainda não
    /// houve cópia nesta conta.
    pub async fn pastas_existentes(&self) -> Result<Option<Pastas>, ErroPreludio> {
        let Some(raiz) = self.raiz().await? else {
            return Ok(None);
        };
        let objetos = self.filha(&raiz, PASTA_DOS_OBJETOS).await?;
        let copias = self.filha(&raiz, PASTA_DAS_COPIAS).await?;
        Ok(objetos.zip(copias).map(|(objetos, copias)| Pastas { objetos, copias }))
    }

    /// Os objetos que já estão no Drive e servem ([`conferir`]). Hash → objeto.
    pub async fn objetos(&self, pastas: &Pastas) -> Result<HashMap<String, ObjetoNoDrive>, ErroPreludio> {
        let q = format!("'{}' in parents and trashed = false", escapar(&pastas.objetos));
        Ok(mapa_de_objetos(self.listar(&q, None).await?))
    }

    /// As cópias no Drive, da mais nova para a mais velha. O que não tem a forma de uma
    /// cópia (nome, propriedades) fica de fora.
    pub async fn copias(&self, pastas: &Pastas) -> Result<Vec<CopiaNoDrive>, ErroPreludio> {
        let q = format!("'{}' in parents and trashed = false", escapar(&pastas.copias));
        let mut copias: Vec<CopiaNoDrive> = self
            .listar(&q, None)
            .await?
            .into_iter()
            .filter(|arquivo| plano::eh_nome_de_copia(&arquivo.name))
            .filter_map(|arquivo| {
                Some(CopiaNoDrive {
                    quando: numero(&arquivo.app_properties, PROP_QUANDO)?,
                    arquivos: numero(&arquivo.app_properties, PROP_ARQUIVOS)?,
                    bytes: numero(&arquivo.app_properties, PROP_BYTES)?,
                    assinatura: arquivo.app_properties.get(PROP_ASSINATURA).cloned().unwrap_or_default(),
                    id: arquivo.id,
                    nome: arquivo.name,
                })
            })
            .collect();
        copias.sort_by(|a, b| b.quando.cmp(&a.quando).then_with(|| b.nome.cmp(&a.nome)));
        Ok(copias)
    }

    /// Sobe um arquivo novo em `mae`. Devolve o `sha256Checksum` que o Google calculou.
    async fn enviar(
        &self,
        mae: &str,
        nome: &str,
        conteudo: Vec<u8>,
        propriedades: Option<serde_json::Value>,
    ) -> Result<Option<String>, ErroPreludio> {
        let mut metadados = serde_json::json!({ "name": nome, "parents": [mae], "mimeType": TIPO_BINARIO });
        if let Some(propriedades) = propriedades {
            metadados["appProperties"] = propriedades;
        }
        let metadados = metadados.to_string();
        let tempo = rede::tempo_para(conteudo.len());
        let resposta = if conteudo.len() < LIMITE_MULTIPART {
            let marca = fronteira(&conteudo);
            let tipo = HeaderValue::from_str(&format!("multipart/related; boundary={marca}")).map_err(|_| resposta_estranha())?;
            let corpo = corpo_multipart(&metadados, &conteudo, &marca);
            let url = rede::url_com(API_DE_ENVIO, &[("uploadType", "multipart"), ("fields", CAMPOS_DO_ENVIO)])?;
            self.pedir(self.http.post(url).header(CONTENT_TYPE, tipo).body(corpo).timeout(tempo), RESPOSTA_PEQUENA_MAX)
                .await?
        } else {
            let sessao = self.abrir_sessao_de_envio(&metadados, conteudo.len()).await?;
            let pedido = self
                .http
                .put(sessao)
                .header(CONTENT_TYPE, HeaderValue::from_static(TIPO_BINARIO))
                .body(conteudo)
                .timeout(tempo);
            self.pedir(pedido, RESPOSTA_PEQUENA_MAX).await?
        };
        let enviado: ArquivoDoDrive = serde_json::from_slice(&resposta).map_err(|_| resposta_estranha())?;
        Ok(enviado.sha256_checksum)
    }

    /// Envio em duas etapas (acima de 5 MiB): abre a sessão e devolve o endereço dela,
    /// conferido como da própria API (é para lá que o token vai em seguida).
    async fn abrir_sessao_de_envio(&self, metadados: &str, tamanho: usize) -> Result<reqwest::Url, ErroPreludio> {
        let url = rede::url_com(API_DE_ENVIO, &[("uploadType", "resumable"), ("fields", CAMPOS_DO_ENVIO)])?;
        let token = self.token().await?;
        let mut resposta = self
            .http
            .post(url)
            .bearer_auth(token)
            .header(CONTENT_TYPE, HeaderValue::from_static(TIPO_JSON))
            .header("X-Upload-Content-Type", HeaderValue::from_static(TIPO_BINARIO))
            .header("X-Upload-Content-Length", tamanho.to_string())
            .body(metadados.to_owned())
            .timeout(TEMPO_CURTO)
            .send()
            .await
            .map_err(|e| rede::erro_de_rede(&e))?;
        let status = resposta.status().as_u16();
        if !(200..300).contains(&status) {
            if status == 401 {
                google::esquecer_token(self.google).await;
            }
            let corpo = rede::ler_limitado(&mut resposta, RESPOSTA_PEQUENA_MAX).await.unwrap_or_default();
            return Err(falha_do_drive(status, &corpo));
        }
        resposta
            .headers()
            .get(LOCATION)
            .and_then(|valor| valor.to_str().ok())
            .and_then(|texto| reqwest::Url::parse(texto).ok())
            .filter(|sessao| sessao.scheme() == "https" && sessao.host_str() == Some(HOST_DA_API))
            .ok_or_else(|| ErroPreludio::novo("google", "O Google Drive não abriu o envio do arquivo."))
    }

    /// Sobe um objeto (o nome é o hash) e confere o hash que o Google calculou, pela
    /// mesma regra da listagem ([`conferir`]).
    pub async fn enviar_objeto(&self, pastas: &Pastas, hash: &str, conteudo: Vec<u8>) -> Result<(), ErroPreludio> {
        let calculado = self.enviar(&pastas.objetos, hash, conteudo, None).await?;
        if conferir(hash, calculado.as_deref()).is_none() {
            return Err(ErroPreludio::novo(
                "google",
                "Um arquivo chegou diferente no Google Drive (o hash não confere). Tente a cópia de novo.",
            ));
        }
        Ok(())
    }

    /// Sobe o manifesto de uma cópia, com o resumo nas propriedades (a lista de cópias
    /// sai delas, sem baixar cada manifesto).
    pub async fn enviar_copia(
        &self,
        pastas: &Pastas,
        nome: &str,
        manifesto: Vec<u8>,
        resumo: &ResumoNoDrive<'_>,
    ) -> Result<(), ErroPreludio> {
        let propriedades = serde_json::json!({
            PROP_QUANDO: resumo.quando.to_string(),
            PROP_ARQUIVOS: resumo.arquivos.to_string(),
            PROP_BYTES: resumo.bytes.to_string(),
            PROP_ASSINATURA: resumo.assinatura,
        });
        self.enviar(&pastas.copias, nome, manifesto, Some(propriedades)).await.map(drop)
    }

    /// Baixa o conteúdo de um arquivo (até `teto` bytes).
    pub async fn baixar(&self, id: &str, teto: usize) -> Result<Vec<u8>, ErroPreludio> {
        if !id_valido(id) {
            return Err(ErroPreludio::novo("pedido_invalido", "O id do arquivo no Drive não tem a forma esperada."));
        }
        let url = rede::url_com(&format!("{API}/{id}"), &[("alt", "media")])?;
        let tempo = rede::tempo_para(teto);
        let token = self.token().await?;
        let mut resposta = self
            .http
            .get(url)
            .bearer_auth(token)
            .timeout(tempo)
            .send()
            .await
            .map_err(|e| rede::erro_de_rede(&e))?;
        if resposta.status().is_redirection() {
            // O conteúdo pode vir de um host de download do Google, com a autorização já
            // na URL assinada: o token não vai junto.
            let destino = resposta
                .headers()
                .get(LOCATION)
                .and_then(|valor| valor.to_str().ok())
                .and_then(|texto| reqwest::Url::parse(texto).ok())
                .ok_or_else(resposta_estranha)?;
            resposta = self
                .http
                .get(destino)
                .timeout(tempo)
                .send()
                .await
                .map_err(|e| rede::erro_de_rede(&e))?;
        }
        let status = resposta.status().as_u16();
        if (200..300).contains(&status) {
            return rede::ler_limitado(&mut resposta, teto).await;
        }
        if status == 401 {
            google::esquecer_token(self.google).await;
        }
        let corpo = rede::ler_limitado(&mut resposta, RESPOSTA_PEQUENA_MAX).await.unwrap_or_default();
        Err(falha_do_drive(status, &corpo))
    }
}

// ---------------------------------------------------------------------------
// Testes (dados inventados; sem rede)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod testes {
    use super::*;

    /// O nome que o app dá ao objeto de um conteúdo: o sha256 dele.
    fn hash_de(conteudo: &str) -> String {
        plano::hex(&Sha256::digest(conteudo.as_bytes()))
    }

    /// A listagem de `objetos/` como a API v3 manda: campo ausente = o Drive não mandou.
    fn listagem(arquivos: Vec<serde_json::Value>) -> Vec<ArquivoDoDrive> {
        serde_json::from_value(serde_json::Value::Array(arquivos))
            .unwrap_or_else(|erro| panic!("listagem inventada inválida: {erro}"))
    }

    #[test]
    fn objeto_sem_checksum_conta_como_enviado_e_o_que_diverge_fica_de_fora() {
        let (sem, com, torto) = (hash_de("verbete inventado"), hash_de("quadro inventado"), hash_de("outro conteúdo"));
        let mapa = mapa_de_objetos(listagem(vec![
            serde_json::json!({ "id": "sem-checksum", "name": sem, "size": "17" }),
            serde_json::json!({ "id": "confere", "name": com, "size": "16", "sha256Checksum": com }),
            serde_json::json!({ "id": "diverge", "name": torto, "size": "14", "sha256Checksum": hash_de("estragado") }),
            serde_json::json!({ "id": "nome-torto", "name": "nao-e-hash.json", "size": "9" }),
        ]));
        // O envio dá como feito o objeto cujo checksum não veio. Se a listagem o ignorasse,
        // toda cópia seguinte subiria o mesmo conteúdo de novo e restaurar diria que ele falta.
        assert!(conferir(&sem, None).is_some(), "o envio aceita a resposta sem checksum");
        let objeto = mapa.get(&sem);
        assert_eq!(objeto.map(|objeto| objeto.id.as_str()), Some("sem-checksum"));
        assert_eq!(objeto.and_then(|objeto| objeto.tamanho), Some(17));
        assert!(mapa.contains_key(&com));
        // Checksum que veio e diverge: o conteúdo no Drive está errado; a cópia sobe o certo.
        assert!(conferir(&torto, Some(&hash_de("estragado"))).is_none());
        assert_eq!(mapa.len(), 2, "o que diverge e o nome que não é hash ficam de fora");
    }

    #[test]
    fn com_dois_objetos_do_mesmo_hash_fica_o_que_o_checksum_confere() {
        let hash = hash_de("mídia inventada");
        let sem = serde_json::json!({ "id": "sem-checksum", "name": hash });
        let com = serde_json::json!({ "id": "confere", "name": hash, "sha256Checksum": hash.to_uppercase() });
        for ordem in [vec![sem.clone(), com.clone()], vec![com, sem]] {
            let mapa = mapa_de_objetos(listagem(ordem));
            assert_eq!(mapa.get(&hash).map(|objeto| objeto.id.as_str()), Some("confere"));
        }
    }
}
