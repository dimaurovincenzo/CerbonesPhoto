# CerbonesPhoto — Distribuzione e aggiornamenti tramite GitHub Releases

Data: 13 agosto 2026  
Stato: design approvato in conversazione, in attesa di revisione della specifica  
Target iniziale: macOS Apple Silicon (`arm64`)

## Obiettivo

Pubblicare CerbonesPhoto nel repository pubblico `dimaurovincenzo/CerbonesPhoto` e usare le GitHub Releases come canale stabile per il download e gli aggiornamenti automatici dell'applicazione. Il catalogo SQLite, gli originali e la pipeline fotografica non cambiano formato né posizione.

La prima fase usa la firma `Apple Development` disponibile sul Mac di sviluppo. Queste build sono provvisorie, non notarizzate e non devono essere presentate come distribuzione macOS certificata. L'architettura deve permettere di aggiungere in seguito `Developer ID Application` e notarizzazione senza modificare il contratto dell'updater.

## Decisioni approvate

- Repository unico, pubblico, con sorgente e release: `dimaurovincenzo/CerbonesPhoto`.
- Provider aggiornamenti: GitHub Releases tramite `electron-updater`.
- Canale iniziale: solo release stabili SemVer con tag `v<versione>`.
- Piattaforma iniziale: macOS `arm64`, minimo macOS 12.
- Artefatti obbligatori: DMG, ZIP per Squirrel.Mac, `latest-mac.yml` e checksum SHA-256.
- Controllo automatico dopo l'avvio e periodico durante l'esecuzione.
- Download in background; installazione solo dopo conferma dell'utente.
- Controllo manuale dal menu applicazione e dalla finestra About.
- Test e build di verifica su GitHub Actions; firma e pubblicazione provvisoria eseguite localmente.
- Nessun token GitHub incluso nel pacchetto o nel repository.

## Alternative escluse

### Build macOS non firmata su GitHub Actions

`electron-updater` richiede un'app macOS firmata. Una pipeline che pubblicasse artefatti non firmati apparirebbe completa ma produrrebbe aggiornamenti non installabili in modo affidabile. GitHub Actions esegue quindi CI e build di verifica, ma non pubblica una release macOS finché non saranno disponibili credenziali di distribuzione appropriate.

### Esportazione del certificato di sviluppo nei secret GitHub

Caricare l'identità `Apple Development` in CI aumenterebbe l'esposizione della chiave privata senza risolvere il problema di Gatekeeper e della notarizzazione. La prima fase mantiene la chiave nel Keychain locale.

### Aggiornamenti da repository privato

Un repository privato richiederebbe un token sul computer dell'utente o un servizio autenticato intermedio. Entrambe le opzioni sono sproporzionate per il prodotto e renderebbero estraibile una credenziale dal pacchetto.

## Architettura runtime

### Servizio updater nel main process

Un modulo dedicato nel main process è l'unico componente autorizzato a usare `electron-updater`. Il renderer non accede alla rete, a GitHub o al filesystem degli aggiornamenti.

Il servizio:

- resta disabilitato in sviluppo, nei test e negli smoke test;
- si avvia soltanto quando `app.isPackaged` è vero;
- controlla gli aggiornamenti 10 secondi dopo `ready-to-show`;
- ripete il controllo ogni 6 ore mentre l'app resta aperta;
- impedisce controlli concorrenti;
- accetta solo versioni superiori sul canale stabile;
- non consente downgrade né prerelease;
- scarica automaticamente un aggiornamento valido;
- mantiene `autoInstallOnAppQuit` attivo;
- chiede conferma prima di chiamare `quitAndInstall`.

Il servizio espone un'istantanea serializzabile con stato e progresso. Gli stati stabili sono:

- `unsupported`: applicazione non pacchettizzata o build priva dei requisiti;
- `idle`: nessun controllo in corso;
- `checking`: verifica della release più recente;
- `available`: versione più recente trovata;
- `downloading`: download in corso;
- `downloaded`: aggiornamento pronto;
- `up-to-date`: versione installata corrente;
- `error`: errore non bloccante con messaggio utente limitato.

L'istantanea contiene versione corrente, eventuale nuova versione, percentuale intera da 0 a 100 e origine del controllo (`automatic` o `manual`). Non contiene token, URL firmati, stack trace o percorsi locali.

### IPC e preload

Il contratto `contextBridge` aggiunge un namespace `updates` con tre operazioni:

- `snapshot()` legge lo stato corrente;
- `check()` avvia un controllo manuale e restituisce lo stato risultante;
- `install()` installa e riavvia solo quando lo stato è `downloaded`.

Un evento `onSnapshot()` aggiorna il renderer durante controllo e download. I listener vengono rimossi tramite una funzione di unsubscribe. Gli handler IPC validano lo stato nel main process; il renderer non può forzare percorsi o feed alternativi.

### UX

Il menu macOS aggiunge `Verifica aggiornamenti…` nel menu CerbonesPhoto. La voce è disabilitata durante un controllo o download già attivo.

La finestra About mostra una riga compatta sotto la versione:

- `CerbonesPhoto è aggiornato`;
- `Verifica aggiornamenti…`;
- `Download 42%`;
- `Versione 0.1.1 pronta` con azione `Installa e riavvia`;
- `Aggiornamenti non disponibili in questa build`;
- errore breve con azione `Riprova`.

Quando il download termina, una finestra nativa propone `Installa e riavvia` e `Più tardi`. Rifiutare non interrompe l'app: l'aggiornamento resta installabile dall'About e viene applicato alla chiusura solo secondo il comportamento sicuro previsto da `electron-updater`.

I controlli automatici non mostrano finestre quando l'app è aggiornata o la rete non è disponibile. Un controllo manuale fornisce sempre un esito visibile. Animazioni e progressi rispettano `prefers-reduced-motion` e non bloccano la navigazione fotografica.

## Configurazione electron-builder

`electron-builder.yml` dichiara esplicitamente:

- provider `github`;
- owner `dimaurovincenzo`;
- repo `CerbonesPhoto`;
- canale `latest`;
- `releaseType: draft`, così gli artefatti possono essere verificati prima della pubblicazione;
- target macOS `dmg` e `zip`, entrambi `arm64`;
- compatibilità updater `>= 2.16`;
- hardened runtime predisposto per il futuro Developer ID.

Il nome npm viene normalizzato a `cerbones-photo`, mentre `productName`, `appId` e il percorso storico del catalogo rimangono rispettivamente `CerbonesPhoto`, `com.cerbonesphoto.app` e la directory `Cartelli`. Questo evita di perdere il catalogo esistente durante il rebranding tecnico.

## CI GitHub Actions

Il workflow CI viene eseguito su push a `main` e pull request. Usa una versione Node fissata e `npm ci`, quindi esegue:

1. `npm test`;
2. `npm run typecheck`;
3. `npm run build`;
4. `npm run verify:photo-engines`;
5. build macOS `arm64` con pubblicazione disabilitata.

Le azioni di terze parti vengono fissate a commit SHA. Il workflow CI usa `permissions: contents: read`; non riceve secret e non esegue codice privilegiato proveniente da pull request con accesso a chiavi locali.

La build su runner GitHub dimostra riproducibilità e packaging, non firma né notarizzazione. Il suo artefatto resta diagnostico e non viene esposto come release installabile.

## Flusso di rilascio provvisorio

Uno script locale prepara una release in modo fail-closed:

1. verifica macOS `arm64`, branch `main` e worktree pulita;
2. verifica che `package.json` e `package-lock.json` abbiano la stessa versione SemVer;
3. verifica che il tag `v<versione>` non esista localmente o su GitHub;
4. esegue test, typecheck, build e verifica dei motori fotografici;
5. genera DMG, ZIP e metadati updater firmati con l'identità disponibile nel Keychain;
6. verifica firma, architettura, contenuto e hash degli artefatti;
7. crea e invia il tag corrispondente al commit corrente;
8. pubblica gli artefatti in una GitHub Release in stato bozza;
9. esegue uno smoke test del pacchetto scaricato dalla bozza;
10. richiede un'azione esplicita dell'operatore per rendere pubblica la release.

Lo script usa l'autenticazione già gestita da GitHub CLI o un token solo nell'ambiente del processo. Non stampa il token, non lo scrive su disco e non lo passa all'applicazione.

Una release bozza non è visibile all'updater. Questo garantisce che `latest-mac.yml`, ZIP e DMG siano presenti e coerenti prima che la release venga promossa a stabile.

## Sicurezza della supply chain

- Nessun secret nel repository, nei log, negli artefatti o nel bundle ASAR.
- `GITHUB_TOKEN` limitato ai permessi minimi del singolo workflow.
- Nessuna pubblicazione da pull request o fork.
- Dipendenze installate con lockfile tramite `npm ci`.
- Azioni GitHub fissate a SHA e aggiornate intenzionalmente.
- Tag di release coerente con `app.getVersion()` e package lock.
- Checksum SHA-256 pubblicati nelle note della release.
- Firma del bundle e dell'aggiornamento verificata prima dell'upload.
- Release bozza fino al completamento delle verifiche.
- Nessun endpoint di aggiornamento configurabile dal renderer.

## Errori e osservabilità

Gli errori di aggiornamento vengono registrati con fase e codice stabile, senza token, query string o percorsi sensibili. Le fasi sono `check`, `download`, `verify`, `install` e `publish`.

Cause ed effetti restano separati:

- rete assente → controllo fallito → app utilizzabile e retry successivo;
- release incompleta → metadata o ZIP mancanti → release non proposta;
- firma differente → verifica installazione fallita → versione corrente preservata;
- disco pieno → download fallito → catalogo e originali invariati;
- updater occupato → secondo controllo ignorato → nessun download concorrente;
- bozza o prerelease → non visibile sul canale stabile → nessun aggiornamento;
- errore di pubblicazione → release resta bozza → nessun client impattato.

I log runtime usano il logger dell'app e una rotazione limitata nella directory utente. La UI mostra messaggi traducibili e non dettagli tecnici.

## Compatibilità e migrazione

L'updater non modifica SQLite e non esegue migrazioni fuori dal normale avvio applicativo. Un aggiornamento fallito lascia installata la versione precedente. Le migrazioni future devono continuare a essere transazionali e retrocompatibili con il rollback alla release precedente quando lo schema lo consente.

Il bundle ID non cambia. La directory `Cartelli` resta intenzionalmente invariata per conservare catalogo, cache e preferenze già presenti. Gli artefatti continuano a essere solo `arm64`; il supporto Intel richiederà una decisione e una matrice separata.

## Test e criteri di accettazione

### Automatici

- transizioni dello stato updater e prevenzione della concorrenza;
- sanitizzazione degli errori;
- controllo automatico disabilitato in sviluppo e smoke test;
- controllo manuale con esito `up-to-date`, `available` ed `error`;
- progresso download limitato a 0–100;
- installazione rifiutata se lo stato non è `downloaded`;
- API preload e unsubscribe degli eventi;
- voce menu e stato About accessibili da tastiera;
- configurazione builder con provider, DMG, ZIP e compatibilità attesa;
- script release bloccato su branch errato, worktree sporca, tag esistente o versione incoerente;
- assenza di token e secret nei file tracciati e nel pacchetto.

### Integrazione locale

1. Installare una release `0.1.x` in `/Applications`.
2. Pubblicare una release stabile `0.1.(x+1)` firmata con la stessa identità.
3. Avviare la versione precedente.
4. Verificare rilevamento, download, dialog, riavvio e versione aggiornata.
5. Verificare che catalogo SQLite, categorie, tag e riferimenti agli originali siano invariati.
6. Ripetere con rete assente, release bozza, ZIP mancante e rifiuto del riavvio.

### Pacchetto e release

- `codesign --verify --deep --strict` sul bundle;
- `spctl --assess` registrato come atteso per una build non notarizzata, senza dichiararlo superato se Gatekeeper la rifiuta;
- architettura `arm64` di app e helper nativi;
- presenza e coerenza di DMG, ZIP e `latest-mac.yml`;
- SHA-256 degli artefatti confrontati prima e dopo upload/download;
- GitHub Release pubblica visibile all'updater soltanto dopo la promozione dalla bozza.

## Passaggio futuro a Developer ID

Quando sarà disponibile l'iscrizione Apple Developer:

1. creare `Developer ID Application`;
2. configurare hardened runtime ed entitlement minimi;
3. configurare credenziali notarizzazione come secret GitHub;
4. spostare build, firma, notarizzazione e pubblicazione nella job release su tag;
5. verificare `codesign`, `spctl`, stapling e aggiornamento tra due release notarizzate;
6. rimuovere l'etichetta provvisoria dalle note di distribuzione solo dopo la prova end-to-end.

Il provider GitHub, il formato dei metadati e l'API runtime restano invariati.

