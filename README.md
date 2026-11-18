# 🎄 Kerstquiz

Een pubquiz voor de kerstborrel van het werk. De vragen staan op het grote scherm, en collega's doen mee met hun telefoon door een QR-code te scannen of een code in te vullen. Er is niets te installeren.

- **Groot scherm / quizmaster:** `host.html`
- **Spelers (telefoon):** `index.html` (via de QR-code kom je hier vanzelf)

## Wat zit erin

- Meedoen met een 6-cijferige code of QR-code, iedereen met een eigen naam
- Vier soorten vragen: **meerkeuze**, **waar/niet waar**, **schatvragen** en vragen **met een foto** (de foto staat alleen op het grote scherm)
- Puntentelling zoals bij Kahoot: tot 1000 punten per vraag, meer voor snel antwoorden, tot +500 bonus voor meerdere goede antwoorden op rij, en per vraag in te stellen ⭐ dubbele punten
- Bij een schatvraag krijgt wie er het dichtst bij zit 1000 punten. De rest krijgt minder, naar hoe ver ze ernaast zitten
- Na elke vraag zie je de verdeling van de antwoorden en de tussenstand (met wie er stijgt ▲ of daalt ▼). De quiz gaat na 10 seconden vanzelf verder; je kunt pauzeren (knop Pauze of toets P), zelf doorklikken, of het automatisch doorgaan bij Instellingen aanpassen of uitzetten
- Stijl "kerstgala": fluweelgroen, champagnegoud en ivoor, een gouden uitnodigingskaart, een gastenlijst met monogrammen, een tussenstand als menukaart en een podium met spotlight
- Sfeer met goudglitter, muziek en geluidseffecten (in de browser gemaakt, geen bestanden nodig) en aan het eind een podium met tromgeroffel en confetti
- Bewerkscherm voor vragen, foto's, volgorde, bedrijfsnaam en logo
- Beveiligd: alleen jij kunt inloggen als quizmaster. Spelers kunnen de vragen en antwoorden niet vooraf inzien, ook niet met technische trucjes

---

## Eenmalig instellen (ongeveer 15 minuten)

### Stap 1 – Firebase-project aanmaken

Firebase (van Google) zorgt voor de live verbinding tussen de telefoons en het grote scherm. Het gratis "Spark"-abonnement is ruim genoeg voor 30 spelers. Je hoeft geen betaalgegevens in te vullen.

1. Ga naar <https://console.firebase.google.com> en log in met een Google-account.
2. Klik op **Project toevoegen** en kies een naam, bijvoorbeeld `kerstquiz`. Google Analytics mag uit.

### Stap 2 – Inloggen aanzetten

1. Ga in het menu links naar **Build → Authentication** en klik op **Aan de slag**.
2. Zet onder het tabblad **Sign-in method** deze twee aan:
   - **E-mail/wachtwoord** (voor jou als quizmaster)
   - **Anoniem** (zodat spelers zonder account mee kunnen doen)
3. Klik onder het tabblad **Users** op **Gebruiker toevoegen**. Vul je eigen e-mailadres en een wachtwoord in. Daarmee log je straks in als quizmaster.

### Stap 3 – Database aanmaken

1. Ga naar **Build → Realtime Database** en klik op **Database maken**.
2. Kies als locatie **België (europe-west1)** en start in de **vergrendelde modus**.
3. Open het tabblad **Regels** (Rules). Vervang alles door de inhoud van het bestand [`database.rules.json`](database.rules.json) uit deze repo en klik op **Publiceren**.

### Stap 4 – De quiz koppelen aan Firebase

1. Klik linksboven op het tandwiel en dan op **Projectinstellingen**.
2. Klik onderaan bij **Jouw apps** op het web-icoon `</>`. Geef de app een naam en klik op **App registreren** (Firebase Hosting hoeft niet).
3. Je krijgt een stukje code met `firebaseConfig`. Neem de waarden over in [`js/config.js`](js/config.js): `apiKey`, `authDomain`, `databaseURL`, `projectId` en `appId`.
   - Staat `databaseURL` er niet bij? Dan vind je hem bovenaan de pagina **Realtime Database**. Hij begint met `https://` en eindigt op `firebasedatabase.app`.
   - De `apiKey` is bij Firebase niet geheim en mag in een openbare repo staan. De beveiliging zit in de regels uit stap 3.

### Stap 5 – Online zetten met GitHub Pages

1. Ga in de repo naar **Settings → Pages**.
2. Kies bij **Source** voor **Deploy from a branch**. Kies de branch waar deze bestanden op staan (bijvoorbeeld `main`) en map `/ (root)`. Klik op **Save**.
3. Na een minuut of twee staat de quiz online:
   - Quizmaster: `https://tobiasvaningen078.github.io/captured-by-tobias/host.html`
   - Spelers: `https://tobiasvaningen078.github.io/captured-by-tobias/`

> Met een gratis GitHub-account werkt GitHub Pages alleen als de repo **openbaar** is. Dat is geen probleem: de vragen staan niet in de repo maar beveiligd in Firebase.

---

## Vragen maken

1. Open `host.html` en log in.
2. Op het tabblad **Vragen** kun je beginnen met **Voorbeeldvragen toevoegen** (acht kerstvragen), of met **+ Nieuwe vraag**.
3. Per vraag stel je in: de soort, de tijd (10 tot 90 seconden), een foto (optioneel) en dubbele punten (optioneel).
4. Op het tabblad **Instellingen** vul je de naam van de quiz, de bedrijfsnaam en het logo in.

Tip: vragen over het werk maken het leukst. Denk aan "Welke collega is dit als baby?" met een foto, of "Hoeveel koppen koffie dronken we dit jaar?" als schatvraag.

## Op de avond zelf

1. Sluit de laptop aan op het grote scherm en op de speakers.
2. Open `host.html`, log in en klik op **▶ Start de quiz**. Klik op ⛶ voor volledig scherm.
3. Collega's scannen de QR-code. Je ziet de namen binnenkomen. Klik op een naam om iemand te verwijderen.
4. Klik op **Volgende** of druk op **spatie** om verder te gaan. Een vraag stopt vanzelf als de tijd om is of als iedereen heeft geantwoord. Daarna gaat de quiz na 10 seconden vanzelf naar de tussenstand en de volgende vraag. Wil je even iets vertellen? Druk op **P** of klik op **Pauze**.
5. Na de laatste vraag volgt het podium: eerst plek 3, dan 2, dan 1. 🏆

**Gaat er iets mis?** Herlaad de pagina gewoon. Klik daarna in het beheerscherm op **Verder gaan**, dan gaat de quiz verder waar hij was. Spelers die hun telefoon herladen, komen ook vanzelf terug in het spel met hun punten.

**Tips:**
- Doe een week van tevoren een proefronde met je eigen telefoon.
- Telefoons hoeven niet op de wifi van het bedrijf: 4G/5G werkt ook.
- Het geluid zet je aan en uit met 🔊 rechtsboven.

---

## Voor ontwikkelaars: lokaal testen

Met de Firebase-emulator kun je alles testen zonder echt Firebase-project:

```bash
npx firebase-tools emulators:start --only auth,database --project demo-kerstquiz
curl -X PUT "http://127.0.0.1:9000/.settings/rules.json?ns=demo-kerstquiz" -H "Authorization: Bearer owner" --data-binary @database.rules.json
python3 -m http.server 8080
```

Open daarna `http://localhost:8080/host.html?emu`. Met `?emu` in de URL gebruikt de pagina de emulator. Een quizmaster-account maak je aan via de REST-API van de auth-emulator (`accounts:signUp`).

`js/vendor/firebase.js` is de Firebase JS SDK (v10.14.1) gebundeld tot één bestand, en `js/vendor/qrcode.js` is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). Zo hangt de quiz niet af van externe CDN's.
