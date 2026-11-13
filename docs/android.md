# Instalação móvel e pacotes futuros

## PWA atual

Publique a aplicação em HTTPS e abra a URL no celular. No Android, use o menu de um navegador compatível e escolha **Instalar app** ou **Adicionar à tela inicial**. No iPhone, abra no Safari, toque em **Compartilhar** e em **Adicionar à Tela de Início**; se oferecido, ative **Abrir como App Web**. O manifest usa `standalone`, há ícones 192×192 e 512×512 (este com área segura para máscara), e a interface considera safe areas. A instalação em aparelhos reais ainda precisa ser testada. [Instruções da Apple](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27).

O service worker mantém somente a página offline e os ícones públicos. Navegações autenticadas e chamadas `/api/*` dependem da rede. Na falha de um recebimento, o operador precisa consultar o servidor antes de qualquer repetição; somente a mesma chave e o mesmo payload podem ser reenviados. Ao alterar recursos precacheados, aumente a versão `orbe-static-v*` em `public/sw.js` e valide a atualização em instalação existente.

## Android: TWA e APK/AAB

Uma **Trusted Web Activity** é a opção inicial para uma embalagem Android que abre a PWA na origem HTTPS publicada. Para uma etapa futura: definir identificador do pacote, gerar e assinar o projeto Android, publicar `/.well-known/assetlinks.json` com o certificado correto, validar os Digital Asset Links, gerar APK para instalação de teste ou AAB assinado para Play Console e testar atualizações, links e sessão no dispositivo. Bubblewrap pode gerar o projeto TWA. [TWA e Digital Asset Links](https://developer.chrome.com/docs/android/trusted-web-activity), [assinatura e envio do AAB](https://developer.android.com/studio/publish/upload-bundle).

## iPhone: PWA ou app nativo

A PWA instalada pelo Safari não gera IPA nem exige App Store. Se for necessária distribuição pela loja ou integração nativa, avaliar **Capacitor** em um projeto separado. A etapa futura exigirá projeto iOS, identificador de bundle, equipe/certificados e assinatura, archive no Xcode, build para TestFlight/App Store Connect, metadados e revisão da App Store. Um IPA para distribuição fora da loja também requer método de assinatura e provisionamento apropriados. [Distribuição pelo Xcode](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases), [envio à App Review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app).

## Limites da arquitetura atual

O Next.js encaminha `/api/*` ao backend por uma rota de servidor e usa cookie HttpOnly de mesma origem; `output: 'export'` não executaria essa rota. Um Capacitor com arquivos locais mudaria a origem, exigindo rever URL da API, CORS com credenciais, política `Secure`/`SameSite` dos cookies e autenticação no WebView. Não armazenar JWT no JavaScript como atalho. Não há modo offline para dados privados nem criação de APK/IPA nesta fase.

## Testes em aparelhos reais

Validar Android Chrome e iPhone Safari com HTTPS: instalação, ícones e recorte, abertura standalone, safe areas, menu, botão Voltar, teclado e rolagem dos formulários financeiros, login após reabertura, atualização do service worker, bloqueio offline e recuperação após reconectar. Testar duas abas e um timeout de recebimento no ambiente de homologação com dados fictícios.
