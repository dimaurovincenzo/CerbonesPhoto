# CerbonesPhoto — Workflow fotografico professionale

Data: 13 agosto 2026  
Stato: design approvato in conversazione  
Target iniziale: macOS Apple Silicon (`arm64`)

## Obiettivo

Estendere CerbonesPhoto da organizzatore multimediale a catalogo fotografico affidabile per file provenienti da fotocamere professionali e semiprofessionali. L'applicazione deve indicizzare raccolte grandi, leggere EXIF/IPTC/XMP, generare anteprime dei RAW, gestire orientamento e colore, e mantenere il renderer reattivo.

Gli originali sono immutabili. Categorie, tag, preferiti, valutazioni e modifiche organizzative restano nel catalogo SQLite. CerbonesPhoto non crea né aggiorna sidecar XMP nella prima versione.

## Decisioni approvate

- Pipeline ibrida: ExifTool per i metadati, LibRaw per RAW e preview incorporate, Sharp/libvips per formati standard e derivati.
- Elaborazione asincrona, incrementale e a concorrenza limitata.
- Priorità ai file visibili nel renderer.
- Cache rigenerabile sotto `app.getPath('userData')`.
- Derivati visuali normalizzati in sRGB; il profilo ICC originale viene rilevato e registrato.
- Miniatura con lato lungo massimo di 480 px e preview con lato lungo massimo di 2.048 px.
- Decodifica RAW completa solo se non esiste una preview incorporata adeguata o se serve una vista ad alta risoluzione.
- Distribuzione iniziale solo Apple Silicon.
- Firma nel footer e nella finestra About: `Powered by VDM with love — Cerbone Antonio`.
- Tre easter egg ironici confinati alla finestra About.

## Alternative escluse

### Solo framework macOS

ImageIO e Quick Look hanno una buona integrazione nativa, ma la copertura dipende dalla versione di macOS e dall'elenco di fotocamere supportate da Apple. Rimangono utilizzabili come fallback di sistema, non come motore primario.

### Solo Node e Sharp

Riduce la complessità di packaging, ma non offre una copertura affidabile dei principali RAW proprietari. Non soddisfa l'obiettivo del prodotto.

## Copertura formati

### Formati standard

- JPEG, JPG, JPE
- PNG
- TIFF, TIF
- HEIF, HEIC
- WebP
- AVIF
- BMP
- GIF

### RAW principali

- Canon: CR2, CR3, CRW
- Nikon: NEF, NRW
- Sony: ARW, SR2, SRF
- Fujifilm: RAF
- Olympus e OM System: ORF, ORI
- Panasonic e Leica: RW2, RWL
- Adobe e universali: DNG
- Pentax: PEF, PTX
- Hasselblad: 3FR, FFF
- Phase One: IIQ
- Mamiya: MEF
- Minolta: MRW
- Sigma: X3F
- Epson: ERF
- Kodak: DCR, KDC
- Samsung: SRW

Un'estensione riconosciuta rende il file indicizzabile, ma non costituisce da sola una dichiarazione di compatibilità. La capacità di estrazione e visualizzazione dipende anche da fotocamera, firmware, compressione e variante del formato. La matrice di test usa quindi campioni reali identificati per produttore e modello.

## Architettura

### Scanner asincrono

Lo scanner enumera directory e file senza decodificare le immagini. Sostituisce le letture sincrone del percorso corrente con operazioni asincrone a blocchi. Gli upsert SQLite avvengono in transazioni brevi e ripetibili; una directory non leggibile non elimina automaticamente record già indicizzati.

Il primo risultato utile viene pubblicato appena è disponibile. L'interfaccia non attende il completamento dell'intero albero.

### Coda fotografica

Una coda nel main process gestisce job idempotenti:

- `metadata`: rilevamento formato e lettura EXIF/IPTC/XMP;
- `thumbnail`: generazione miniatura;
- `preview`: generazione preview intermedia;
- `high-resolution`: derivato richiesto dalla lightbox;
- `retry`: nuova elaborazione esplicita di un file fallito.

Le priorità sono: file aperto, file visibili, file della cartella selezionata, resto del catalogo. Il numero di job pesanti simultanei è limitato e configurato separatamente dalla scansione del filesystem. Chiudere o cambiare cartella riduce la priorità dei job non più visibili senza corrompere quelli già avviati.

### Motore metadati

ExifTool viene mantenuto disponibile in modalità persistente per evitare il costo di avvio per ogni file. L'output JSON usa nomi di gruppo per evitare collisioni fra EXIF, IPTC e XMP. Una funzione di normalizzazione produce un DTO stabile con almeno:

- produttore e modello fotocamera;
- obiettivo;
- data e ora di scatto;
- ISO, apertura, tempo, focale e compensazione;
- dimensioni e orientamento;
- copyright, autore, descrizione, titolo e parole chiave;
- coordinate GPS, quando presenti;
- spazio colore e descrizione del profilo ICC;
- rating e label letti dall'originale o da un sidecar esistente, senza scriverli.

I metadati completi non normalizzati possono essere conservati nel JSON tecnico, con dimensione limitata, mentre i campi usati per filtro e ordinamento diventano colonne indicizzabili.

### Motore RAW e derivati

Per un RAW la pipeline tenta prima l'estrazione della migliore preview incorporata. Se la preview è compatibile e sufficientemente grande, Sharp applica orientamento, conversione colore e ridimensionamento. Se manca o non è utilizzabile, LibRaw esegue una conversione controllata.

I derivati sono file WebP o JPEG sRGB con chiave composta da percorso normalizzato, dimensione, `mtime`, versione pipeline e livello richiesto. Una modifica all'originale o un aggiornamento della pipeline invalida automaticamente la cache.

La lightbox usa sempre un derivato per i RAW. Per le immagini standard può usare il file diretto solo quando formato, dimensione e profilo sono sicuri per Chromium; diversamente usa lo stesso percorso dei derivati.

## Persistenza SQLite

La migrazione aggiunge dati espliciti senza sovraccaricare `metadata_json`. Il modello prevede:

- stato analisi: `pending`, `processing`, `ready`, `partial`, `failed`;
- formato fotografico e indicatore RAW;
- produttore e modello fotocamera;
- data di scatto e parametri fotografici principali;
- dimensioni orientate;
- orientamento originale;
- descrizione profilo colore;
- versione della pipeline;
- codice errore stabile e messaggio diagnostico limitato;
- data dell'ultimo tentativo.

Una tabella derivati registra per file e livello:

- tipo `thumbnail`, `preview` o `high-resolution`;
- percorso nella cache;
- formato, dimensioni e byte;
- chiave cache e versione pipeline;
- stato e ultimo accesso.

Le migrazioni sono transazionali e precedute da una copia del catalogo. Categorie, tag e relazioni esistenti non cambiano contratto.

## Flusso applicativo

1. L'utente aggiunge o aggiorna una cartella.
2. Lo scanner indicizza rapidamente i file riconosciuti e pubblica risultati incrementali.
3. La griglia mostra placeholder e stati di elaborazione.
4. La coda legge prima i metadati dei file visibili.
5. Viene estratta o generata la miniatura.
6. SQLite registra risultato, stato e diagnostica.
7. Il renderer riceve un evento di aggiornamento e sostituisce il placeholder.
8. L'apertura della lightbox promuove il file e richiede la preview da 2.048 px.
9. Lo zoom oltre la preview richiede un derivato ad alta risoluzione, senza trattenere più RAW completi in memoria.

## Protocolli e confini Electron

I protocolli custom continuano a validare l'identificatore del file tramite SQLite. Il renderer non riceve percorsi assoluti e non accede direttamente al filesystem.

- `thumb://file/<id>` restituisce la miniatura pronta o uno stato coerente di attesa/errore.
- Il protocollo delle preview restituisce esclusivamente derivati cache validati.
- `media://file/<id>` resta per audio, video e immagini standard compatibili; non serve direttamente un RAW a Chromium.

Le operazioni lunghe espongono IPC per stato, pausa, ripresa e retry. Gli eventi di progresso sono aggregati per evitare aggiornamenti eccessivi del renderer.

## UX

La scansione e l'elaborazione non bloccano la navigazione. Ogni card mostra uno stato distinguibile anche senza affidarsi solo al colore:

- in attesa;
- elaborazione;
- pronta;
- anteprima non disponibile.

Una barra compatta mostra file analizzati, totale noto, attività corrente e numero di problemi. L'utente può sospendere e riprendere i job. Gli errori del singolo file non aprono modali e non interrompono il resto della raccolta.

Per un RAW non visualizzabile, la card resta nel catalogo, espone i metadati disponibili e offre `Riprova anteprima` e `Apri nel sistema`. I dettagli tecnici restano in una vista diagnostica secondaria.

Lo zoom è progressivo e mantiene visibile l'immagine corrente mentre arriva il livello successivo. Le transizioni rispettano `prefers-reduced-motion`.

## Firma e About

Il footer mostra con contrasto accessibile e gerarchia secondaria:

> Powered by VDM with love — Cerbone Antonio

La voce macOS `CerbonesPhoto > Informazioni su CerbonesPhoto` apre una finestra coerente con Cupertino contenente icona, versione, firma e stato dei motori ExifTool, LibRaw e Sharp.

## Easter egg

Gli easter egg non producono suoni, non modificano dati e sono disponibili anche da tastiera:

1. Cinque attivazioni dell'obiettivo nell'About mostrano un effetto otturatore e: `Il fotografo sostiene che fosse tutto perfettamente a fuoco.`
2. `Opzione` più attivazione del numero di versione mostra: `Versione sviluppata con amore. I bug, invece, sono venuti senza invito.`
3. Digitando `CERBONE` nell'About compare una Polaroid animata con: `Foto approvata dal cognato. Nessun RAW è stato maltrattato.`

Con `Riduci movimento` attivo, gli effetti diventano semplici dissolvenze. Le sequenze sono gestite solo mentre l'About ha il focus e non interferiscono con ricerca o scorciatoie globali.

## Errori e osservabilità

Ogni errore di pipeline ha un codice stabile, una fase, un file ID e un messaggio limitato. I percorsi completi non vengono mostrati nell'interfaccia ordinaria. Gli errori previsti includono:

- file rimosso durante la lavorazione;
- permesso negato;
- metadata malformati;
- variante RAW non supportata;
- preview incorporata corrotta;
- timeout del motore esterno;
- cache non scrivibile;
- memoria insufficiente o limite pixel superato.

Un errore marca solo il job e il file interessato. La coda continua. I job transitori usano un numero limitato di retry con attesa crescente; gli errori deterministici richiedono un retry manuale o una nuova versione della pipeline.

## Sicurezza

- Gli originali vengono aperti in sola lettura.
- ExifTool e LibRaw sono avviati senza shell e con argomenti separati.
- Processi e output hanno timeout e limiti dimensionali.
- I path provengono esclusivamente da record validati nel catalogo.
- I derivati restano sotto la directory cache dell'applicazione.
- Sharp mantiene attivi i limiti di sicurezza su pixel e canali.
- Il renderer riceve DTO e URL custom, non path locali arbitrari.
- Il packaging include versioni fissate, hash e testi di licenza dei componenti nativi.

## Prestazioni e memoria

- Nessuna lettura sincrona ricorsiva nel main process durante una scansione ordinaria.
- Transazioni SQLite corte e batch limitati.
- Concorrenza separata per I/O leggero e decodifica pesante.
- Priorità alla viewport e cancellazione logica dei job non più necessari.
- Nessun buffer RAW inviato al renderer via IPC.
- Cache su disco con politica LRU e limite configurabile.
- Rilascio esplicito delle risorse dopo ogni derivato.
- Progresso IPC aggregato e non emesso per ogni singolo passaggio interno.

## Test

### Automatici

- classificazione di tutte le estensioni previste;
- migrazioni, rollback e integrità delle relazioni SQLite;
- ordinamento, promozione, pausa, ripresa e retry della coda;
- invalidazione cache per modifica originale o versione pipeline;
- normalizzazione EXIF/IPTC/XMP;
- orientamento, dimensioni e conversione sRGB;
- isolamento degli errori;
- immutabilità degli originali tramite hash prima e dopo.

### Matrice reale

Almeno un campione autorizzato per JPEG, TIFF, HEIC, CR2, CR3, NEF, ARW, RAF, ORF, RW2, DNG e PEF. Ogni campione attraversa importazione, metadati, miniatura, preview, lightbox, zoom e fallback. La verifica registra fotocamera e variante, non solo estensione.

### Carico

- cataloghi sintetici da 1.000 e 10.000 file;
- immagini ad alta risoluzione;
- scroll rapido durante la generazione;
- cambio cartella e chiusura lightbox con job attivi;
- cache piena o non scrivibile;
- file rimossi durante la scansione.

Durante la scansione da 10.000 file, un heartbeat nel renderer deve mantenere un intervallo massimo di 500 ms. Dopo una seconda scansione identica e 60 secondi di inattività, la memoria RSS deve stabilizzarsi entro il 15% del valore rilevato dopo la prima scansione. Hardware, versione macOS e risultati vengono registrati come baseline ripetibile.

### Visuali e pacchetto

Nel DMG installato si verificano avvio, importazione, ricerca bilingue, categorie, tag, lightbox, zoom, ridimensionamento delle sezioni, About, firma ed easter egg. Le dimensioni minime, medie e grandi della finestra non devono produrre sovrapposizioni o contenuti troncati.

## Packaging e rilascio

La prima release produce un solo DMG `arm64`. ExifTool e il motore LibRaw sono risorse dell'app con percorso risolto tramite `process.resourcesPath` nel pacchetto e tramite percorso di sviluppo fuori dal pacchetto.

La build deve verificare architettura, presenza, eseguibilità, versione e hash dei binari. Il DMG viene firmato e controllato dopo il packaging. La notarizzazione è una fase distinta e richiede credenziali Apple Developer ID, non incluse nel progetto.

## Rollback

- Copia del catalogo prima della migrazione.
- Migrazione atomica con `foreign_key_check` finale.
- Nuova pipeline controllabile da una preferenza interna durante il rollout.
- Cache completamente eliminabile e rigenerabile.
- Possibilità di tornare al renderer standard per i formati già supportati.
- Nessuna perdita di categorie, tag o relazioni se la pipeline fotografica viene disattivata.

## Impatto

- **Breaking change:** nessuno per categorie e tag; vengono estesi schema file, IPC e protocolli preview.
- **Dipendenze:** vengono incorporati motori nativi e relative licenze.
- **Prestazioni:** scansione più reattiva; aumento controllato di CPU e spazio cache durante la generazione.
- **Sicurezza:** superficie aggiuntiva confinata a processi senza shell e file catalogati.
- **Operazioni:** il DMG cresce e la firma deve includere correttamente i binari annidati.
- **Distribuzione:** solo Apple Silicon nella prima versione.

## Non obiettivi della prima versione

- Sviluppo RAW non distruttivo con regolazioni fotografiche.
- Scrittura negli originali.
- Creazione o aggiornamento automatico di sidecar XMP.
- Sincronizzazione cloud del catalogo.
- Build Intel o Windows.
- Garanzia universale per ogni fotocamera basata esclusivamente sull'estensione.

## Criteri di accettazione

- Nessun originale o sidecar esistente viene modificato.
- Il renderer resta utilizzabile durante scansione e generazione delle preview.
- Un file difettoso non interrompe la coda.
- Gli stati sono comprensibili e accessibili.
- I principali campioni RAW completano la matrice prevista oppure producono il fallback esplicito documentato.
- Ricerca bilingue, categorie, tag, audio e video non regrediscono.
- Firma ed easter egg corrispondono ai testi approvati.
- Il DMG Apple Silicon si avvia e contiene motori verificati.
- Le dimensioni di finestra testate non presentano contenuti tagliati o sovrapposti.
