# Polish rules for B2B email outreach (research)

> **This is information, not legal advice.** It was compiled by an AI research assistant on 2026-10-15 from official sources, with a few secondary sources clearly labelled. It has not been reviewed by a Polish lawyer. Before sending outreach that depends on any conclusion below, confirm it with a qualified adviser (*radca prawny* or *adwokat*).

- **Date of research:** 2026-10-15. Every source was accessed on 2026-10-15. The IDs in square brackets, for example [L6], point to the source list at the end.
- **Context:** a one-person training business (Mind The Gap) sends individually written B2B emails from the owner's Gmail account to business contacts found on public sources.
- **How to read this document:**
  - **Official** means statute text, a court judgment, an authority's decision or press release, or an official government answer. Text in quotation marks is verbatim; Polish quotes are copied from the official text.
  - **Secondary** means a law-firm or legal-journal analysis.
  - **Inference** means my own reading. It needs confirmation.
  - English translations of Polish quotes are mine, not official.

---

## 0. Bottom line

1. **Since 10 November 2024, Art. 398 of the Electronic Communications Law (*Prawo komunikacji elektronicznej*, "PKE") governs commercial email in Poland. It requires the recipient's prior consent and has no B2B exception.**
   - It protects every *abonent* (subscriber) and *użytkownik końcowy* (end user), and these include companies and other legal persons.
   - The Ministry of Digital Affairs and the President of UODO (the Polish data protection authority) both said so in official answers to MPs in 2025 [L6][L7].
   - The President of UKE (the electronic communications regulator) can fine up to 3% of revenue or PLN 1,000,000, whichever is higher [L1].
2. **Art. 10 of the Act on providing services by electronic means (*ustawa o świadczeniu usług drogą elektroniczną*, "UŚUDE") is repealed** with effect from 10 November 2024 [L2][L3]. It used to protect only natural persons. The UŚUDE definition of *informacja handlowa* (commercial information) and the Art. 9 marking duty still apply [L3].
3. **An email whose only purpose is to ask for consent to send an offer is high-risk.**
   - A Warsaw Court of Appeal judgment treated a "contact consent" SMS as commercial information [L9].
   - The Ministry states that contact to obtain consent for presenting an offer is not allowed by phone, citing UKE and UOKiK (consumer protection authority) decisions [L6].
   - I found no published decision that clears a pure consent-request email.
4. **A cold first email is lawful only with a recorded legal hook:**
   - documented prior consent;
   - an inquiry from the recipient; or
   - arguably, a published invitation to send offers to a specific address. Art. 398(2) lets consent be expressed by making an address available *for the purpose* of receiving commercial information. That last case is my interpretation, not settled law.
5. **The GDPR applies on top of the PKE** for any named person.
   - Legitimate interest can cover researching and storing B2B prospects, after a documented balancing test. Where the PKE requires consent for the email itself, the EDPB says legitimate interest cannot be the basis for that sending [L14].
   - Art. 14 GDPR information must reach each named person at the latest at the first communication, and in any case within one month of collecting their data [L12][L15].
   - The UODO and the Supreme Administrative Court (NSA) apply the "disproportionate effort" exception restrictively [L10].

---

## 1. Art. 398 PKE: the text and its scope

**Act:** *Ustawa z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej*, Dz.U. 2024 poz. 1221.
- Status "obowiązujący" (in force). Entry into force: **2024-11-10**. Promulgated 2024-08-09 [L1-meta].
- The act states that it "wchodzi w życie w terminie określonym w ustawie z dnia 12 lipca 2024 r. - Przepisy wprowadzające ustawę - Prawo komunikacji elektronicznej (Dz. U. poz. 1222)" [L1]. That act enters into force "po upływie 3 miesięcy od dnia ogłoszenia", subject to exceptions that do not concern Art. 398 [L2].
- The Sejm ELI service lists five amending acts: Dz.U. 2025 poz. 637 and 820, and Dz.U. 2026 poz. 252, 815 and 1296 [L1-meta]. **Inference from reading their amending provisions:**
  - none of them changes Art. 398, 400, 446 or 448 PKE;
  - they amend Art. 337, 43, 40, 42 and 419 [L5][L4].
  - No consolidated text (*tekst jednolity*) of the PKE was listed.

### Verbatim text (official, from the Sejm ELI text of Dz.U. 2024 poz. 1221 [L1])

> **Art. 398.** 1. Zakazane jest używanie:
> 1) automatycznych systemów wywołujących,
> 2) telekomunikacyjnych urządzeń końcowych, w szczególności w ramach korzystania z usług komunikacji interpersonalnej
> – do celów przesyłania informacji handlowej w rozumieniu przepisów ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną (Dz. U. z 2020 r. poz. 344 oraz z 2024 r. poz. 1222), w tym marketingu bezpośredniego, do abonenta lub użytkownika końcowego, chyba że uprzednio wyraził on na to zgodę.
> 2. Zgoda, o której mowa w ust. 1, może być wyrażona przez udostępnienie przez abonenta lub użytkownika końcowego identyfikującego go adresu elektronicznego w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną, w celu przesyłania informacji handlowej na podany przez abonenta lub użytkownika końcowego adres elektroniczny.
> 3. Używanie środków, o których mowa w ust. 1, do przesyłania informacji handlowej, w tym marketingu bezpośredniego, nie może odbywać się na koszt użytkownika końcowego lub abonenta.
> 4. Działanie, o którym mowa w ust. 1, stanowi czyn nieuczciwej konkurencji w rozumieniu przepisów ustawy z dnia 16 kwietnia 1993 r. o zwalczaniu nieuczciwej konkurencji (Dz. U. z 2022 r. poz. 1233).

*My working translation:*
1. Using (1) automated calling systems, or (2) telecommunications terminal equipment, in particular when using interpersonal communication services, to send commercial information within the meaning of the e-services act, including direct marketing, to a subscriber or end user is prohibited unless that person has previously consented.
2. That consent may be expressed by the subscriber or end user making available an electronic address that identifies them, for the purpose of receiving commercial information at that address.
3. Such sending may not be at the cost of the recipient.
4. A breach is an act of unfair competition.

### Related provisions (official [L1])

- **Art. 400 (consent standard):** "Do uzyskania zgody abonenta lub użytkownika końcowego stosuje się odpowiednio przepisy o ochronie danych osobowych." (To obtaining consent, the data-protection rules apply accordingly.) **Inference:** this means GDPR-standard consent. Art. 4(11) GDPR defines it as "freely given, specific, informed and unambiguous", Art. 7(1) requires that the controller can demonstrate it, and Art. 7(3) makes it withdrawable [L12].
- **Definitions (Art. 2):**
  - pkt 1: "abonent - użytkownika, który jest stroną umowy o świadczenie usług komunikacji elektronicznej zawartej z dostawcą usług komunikacji elektronicznej";
  - pkt 86: "użytkownik końcowy - podmiot korzystający z publicznie dostępnej usługi komunikacji elektronicznej lub żądający świadczenia takiej usługi, dla zaspokojenia własnych potrzeb".
  - **Inference:** *podmiot* (an entity) is not limited to natural persons.
- **Art. 446 ust. 5 (UKE fine):** "W przypadku niewypełniania obowiązku uzyskania zgody użytkownika końcowego, o której mowa w art. 398, Prezes UKE, nakłada, w drodze decyzji, na podmiot, biorąc pod uwagę charakter i zakres naruszenia, karę pieniężną w wysokości do 3% przychodu ukaranego podmiotu, osiągniętego w poprzednim roku kalendarzowym lub do 1 000 000 zł, przy czym zastosowanie ma kwota wyższa."
- **Art. 448 (petty offence):** "Kto przesyła za pomocą środków komunikacji elektronicznej informacje handlowe bez uprzedniego uzyskania zgody abonenta lub użytkownika końcowego, podlega karze grzywny." It is prosecuted "na żądanie pokrzywdzonego" (at the request of the person affected).

### What Art. 398 covers (official statements)

- **Email is covered, and B2B is covered.** The Ministry of Digital Affairs' answer to interpellation no. 12162, dated 30 September 2025, says [L6]:
  > "Ochrona rozszerzona została także na wszystkie osoby fizyczne (w tym jednoosobowe działalności gospodarcze) oraz jednostki organizacyjne (osoby prawne, w tym np. spółki kapitałowe, fundacje czy uczelnie). Od tego czasu, niezależnie od statusu prawnego odbiorcy marketingu, takiemu odbiorcy przysługuje taki sam poziomy ochrony na podstawie przepisów Pke."
  >
  > "Trzeba wskazać, że co do obowiązku uzyskania uprzedniej zgody użytkownika na kontakt nie ma znaczenia, czy kontakt w celu przesłania informacji handlowej wykonywany byłby za pomocą wiadomości e-mail bądź telefonu."
  >
  > "Zgoda na przesyłanie informacji handlowej dzieli się na różne kanały komunikacji, tym samym można udzielić zgody np. na kontakt telefoniczny, ale już nie za pomocą skrzynki poczty elektronicznej."
- **UODO's position**, as reported in the Ministry's answer to interpellation no. 12182, dated 14 October 2025 [L7]:
  > "Według UODO zaznaczyć należy, że zgoda dotyczy wszystkich abonentów i użytkowników końcowych – nie tylko konsumentów, ale także przedsiębiorców."
  >
  > "Zdaniem UODO ustawodawca blokuje nowymi przepisami tzw. „zimne kontakty” (cold calling oraz cold mailing)…"
  >
  > The rule applies "w których komunikat jest przesyłany do adresata w oparciu o dane umożliwiające skierowanie informacji handlowej do konkretnej osoby, np. adres e-mail".
  >
  > "Powinna to być każdorazowo zgoda konkretna, czyli określać poza podmiotem, któremu zgoda została udzielona, również cel zgody i kanał (kanały) komunikacji."
- **UKE enforcement on email (old law, but email was covered).** In the same answer, UKE reports a decision of 30 June 2024 fining Polkomtel PLN 2.85 million. Among other things, the decision covered "wysłanie 1 021 256 wiadomości poczty elektronicznej e-mail na adresy poczty elektronicznej należące do abonentów lub użytkowników końcowych" without prior consent in 2020–2021 [L7].
- **EU background.**
  - Art. 13(1) of the ePrivacy Directive: "electronic mail for the purposes of direct marketing may be allowed only in respect of subscribers or users who have given their prior consent".
  - Art. 13(5) leaves the protection of "subscribers other than natural persons" to Member States [L13].
  - **Inference:** Poland chose to protect legal persons as well (per [L6] and [L7]).
  - **Inference:** the Art. 13(2) "existing customer / similar products" exception has no counterpart in the text of Art. 398 PKE. Do not assume a Polish "soft opt-in".

---

## 2. Art. 10 UŚUDE after the PKE

**Official:**
- Art. 26 pkt 3 of the introductory act (*Przepisy wprowadzające ustawę – Prawo komunikacji elektronicznej*, Dz.U. 2024 poz. 1222) reads: "3) uchyla się art. 10;". Art. 26 pkt 5 reads: "5) uchyla się art. 24;" (Art. 24 was the old petty offence) [L2].
- The consolidated UŚUDE text (*Obwieszczenie Marszałka Sejmu* of 10 October 2024, Dz.U. 2024 poz. 1513) shows "Art. 10. (uchylony)". Its footnotes tie the changes to the introductory act, "która wejdzie w życie z dniem 10 listopada 2024 r." [L3].

**The repealed wording, kept in the consolidated text for the transition period [L3]:**
> "Art. 10. 1. Zakazane jest przesyłanie niezamówionej informacji handlowej skierowanej do oznaczonego odbiorcy będącego osobą fizyczną za pomocą środków komunikacji elektronicznej, w szczególności poczty elektronicznej.
> 2. Informację handlową uważa się za zamówioną, jeżeli odbiorca wyraził zgodę na otrzymywanie takiej informacji, w szczególności udostępnił w tym celu identyfikujący go adres elektroniczny.
> 3. Działanie, o którym mowa w ust. 1, stanowi czyn nieuczciwej konkurencji…"

**What remains in force in UŚUDE and matters here (official [L3]):**
- Art. 2 pkt 2, the definition that Art. 398 PKE borrows:
  > "informacja handlowa – każdą informację przeznaczoną bezpośrednio lub pośrednio do promowania towarów, usług lub wizerunku przedsiębiorcy lub osoby wykonującej zawód, której prawo do wykonywania zawodu jest uzależnione od spełnienia wymagań określonych w odrębnych ustawach, z wyłączeniem informacji umożliwiającej porozumiewanie się za pomocą środków komunikacji elektronicznej z określoną osobą oraz informacji o towarach i usługach niesłużącej osiągnięciu efektu handlowego pożądanego przez podmiot, który zleca jej rozpowszechnianie, w szczególności bez wynagrodzenia lub innych korzyści od producentów, sprzedawców i świadczących usługi;"
- Art. 2 pkt 1: "adres elektroniczny – oznaczenie systemu teleinformatycznego umożliwiające porozumiewanie się za pomocą środków komunikacji elektronicznej, w szczególności poczty elektronicznej".
- Art. 9 (marking duty):
  > "1. Informacja handlowa jest wyraźnie wyodrębniana i oznaczana w sposób niebudzący wątpliwości, że jest to informacja handlowa. 2. Informacja handlowa zawiera: 1) oznaczenie podmiotu, na którego zlecenie jest ona rozpowszechniana, oraz jego adresy elektroniczne; …"
- Art. 4: "Jeżeli ustawa wymaga uzyskania zgody usługobiorcy, stosuje się przepisy o ochronie danych osobowych."

**Change taking effect on 6 November 2026 (official [L4]):**
- The act of 4 September 2026 (Dz.U. 2026 poz. 1296) amends UŚUDE to implement the Digital Services Act. Entry into force: 2026-11-06.
- It repeals UŚUDE Chapter 3 (intermediary liability) and adds chapters on DSA authorities.
- **Inference from reading its amending provisions:** it does not change Art. 2 pkt 1–2, Art. 4 or Art. 9 UŚUDE, and Art. 10 stays repealed. Its only PKE change is a new Art. 419(1) pkt 24 (UKE as Digital Services Coordinator).

---

## 3. Positions of authorities and courts on the specific questions

### 3.1 Cold B2B emails to named employees' business addresses

- **PKE layer (official):** consent is required for every subscriber or end user, including businesses [L6][L7]. UODO states that the law blocks "cold mailing" [L7].
- **GDPR layer (official):**
  - A named business address is personal data. GDPR Art. 4(1) covers "any information relating to an identified or identifiable natural person" [L12].
  - UODO's employer guide says that addresses built from a name, or not built from a name but linked to a specific person, are "uznawany jest za dane osobowe związane z zatrudnieniem" [L11].
  - The same guide says an employer may publish employees' names and business emails, because they are "ściśle związane z życiem zawodowym pracownika" [L11]. **Inference:** a company publishing a contact does not, by itself, authorise third parties to use it for marketing.
- **EDPB (official guidance, version 1.0 adopted for consultation; I found no later final version) [L14]:**
  - ¶114: "under the ePrivacy Directive, the sending of unsolicited communications for purposes of direct marketing by email … can only take place with the prior consent of the individual recipient … Therefore, in this context, the processing for direct marketing purposes may not be based on Article 6(1)(f) GDPR."
- **Court (secondary report of a non-final judgment) [L18]:**
  - Lege Artis reports that the Warsaw Voivodeship Administrative Court (WSA) dismissed a complaint against a UODO reprimand on 8 August 2025 (II SA/Wa 62/25, non-final).
  - In that case, a telecom operator relied on legitimate interest for a marketing message. The court held that sending commercial information requires the recipient's prior consent.
  - I could not open the judgment in the official CBOSA database, because the connection failed.
- **Unsettled (inference):** whose consent counts for an employee's work mailbox, the employing company (as subscriber) or the employee (as end user)? I found no authority on this. The safe reading is that the consent must come from the person or organisation that the address serves, and it must be specific to Mind The Gap and to email.

### 3.2 Is an email asking for consent to send an offer itself "commercial information"?

- **Court (official) [L9]:** Warsaw Court of Appeal (*Sąd Apelacyjny w Warszawie*), 12 December 2019, VII AGa 1567/18, an unfair-competition case about SMS messages and calls under the old Art. 172 of the Telecommunications Law and Art. 10 UŚUDE.
  - The court held that SMS messages proposing contact "przynajmniej pośrednio zawierały … promocję usług pozwanego", because they stated the purpose of the contact.
  - It endorsed the doctrinal view: "Wstępny list proszący adresata o wyrażenie zgody na przesyłanie mu w przyszłości informacji handlowej za pomocą środków komunikacji elektronicznej stanowi specyficzny rodzaj informacji handlowej, bowiem w sposób pośredni zmierza do promowania towarów, usług lub wizerunku przedsiębiorcy…"
- **Ministry (official) [L6]:** "Podobnie nie jest dozwolony kontakt w celu uzyskania zgody na przedstawienie oferty handlowej w trakcie rozmowy telefonicznej, co potwierdzone zostało decyzjami Prezesa Urzędu Komunikacji Elektronicznej … oraz Prezesa Urzędu Ochrony Konkurencji i Konsumentów".
- **UOKiK (official, consumer case, decision not final) [L8]:** press release of 9 September 2026 on Centrum Dotacji OZE.
  - "If a telephone call is intended to generate a consumer's interest in an offer, identify their needs and lead to a meeting with a salesperson, it constitutes direct marketing."
  - "an undertaking cannot first call a consumer for marketing purposes and only then, during the conversation, obtain the consumer's consent to such contact. Consent must open the door to marketing; it cannot come only after the marketing has already begun."
- **Gap:** I found no published UKE decision or court judgment under the PKE on a pure consent-request **email**. My web-search budget ran out before I could check further, so treat this as unconfirmed.
- **Inference: high risk.** A first email that names Mind The Gap, says it offers training, and asks "may I send you an offer?" is very likely to be treated as indirect promotion, and so as commercial information needing prior consent. The app should not offer a "consent request" template for cold contacts.

### 3.3 Generic company addresses (biuro@, kontakt@) versus named persons

- **PKE (official):** the protection covers legal persons and organisational units [L6]. **Inference:** a generic address of a company is still the address of an end user, so Art. 398 consent is still needed.
- **GDPR (official and inference):**
  - The EDPB notes that "direct marketing addressed to legal persons" without personal data is governed only by the ePrivacy rules [L14 ¶117].
  - **Inference:** a truly impersonal address (biuro@company) is often not personal data, so the GDPR duties (Art. 14 and so on) may not apply. They do apply if the mailbox identifies a person, for example a sole trader whose biuro@ address effectively means that person.
- **Secondary (labelled):** Grant Thornton (2 December 2024): "zakaz przesyłania niezamówionej informacji handlowej nie dotyczy tylko przesyłania informacji osobom fizycznym, ale także innym podmiotów … w tym podmiotów publicznych czy spółek prawa handlowego" [L19].
- **Inference:** a generic address lowers the GDPR burden but does not remove the PKE consent requirement.

### 3.4 Published invitations to submit offers (a "for suppliers" page, a procurement page)

- **Statute (official) [L1]:** Art. 398 ust. 2: consent "może być wyrażona przez udostępnienie … identyfikującego go adresu elektronicznego … w celu przesyłania informacji handlowej na podany … adres elektroniczny."
- **UODO (official) [L7]:** quoting this provision, UODO adds "(ściśle określony cel)" (a strictly defined purpose). It also says consent should identify the entity it is given to, the purpose and the channel.
- **UOKiK (official, by analogy) [L8]:** "Having a consumer's telephone number does not amount to consent". Buying it in a database does not amount to consent either.
- **Inference:**
  - A page that publishes an address *specifically for receiving offers* is the strongest non-explicit evidence available under ust. 2, for example "Oferty dotyczące szkoleń prosimy kierować na zakupy@firma.pl" (please send training offers to zakupy@firma.pl).
  - Its limits:
    - (a) It covers only the address named and the subject matter named.
    - (b) It is not specific to Mind The Gap. Read with Art. 400 and UODO's "specific consent" view, it may be challenged.
    - (c) A general "Kontakt" page, KRS, CEIDG or a footer email is **not** an address made available for receiving commercial information.
    - (d) In formal public procurement under *Prawo zamówień publicznych*, offers are submitted in the procedure's own channel. An unsolicited email to a procurement officer outside the procedure is not covered by the tender notice.
  - Treat this basis as "arguable, medium risk" and keep proof of the exact page wording and date.

---

## 4. GDPR obligations for this use

### Legal basis
- **Official:**
  - Art. 6(1)(f) GDPR: "processing is necessary for the purposes of the legitimate interests pursued by the controller…, except where such interests are overridden by the interests or fundamental rights and freedoms of the data subject" [L12].
  - Recital 47: "The processing of personal data for direct marketing purposes may be regarded as carried out for a legitimate interest." It also says that the interests of the data subject "could in particular override the interest of the data controller where personal data are processed in circumstances where data subjects do not reasonably expect further processing." [L12]
- **CJEU (official) [L16]:** C-621/22 *KNLTB* (4 October 2024): "a commercial interest of the controller … could constitute a legitimate interest … provided that it is not contrary to the law." Processing must be "strictly necessary", and a balancing test must favour the controller.
- **EDPB (official) [L14]:**
  - Three cumulative conditions apply: a legitimate interest, necessity, and a balancing test (¶112).
  - Recital 47 "does not mean that direct marketing always constitutes a legitimate interest" (¶110).
  - Where ePrivacy requires consent for email marketing, legitimate interest cannot be used (¶114).
- **Inference, split by processing step:**
  - (i) Finding and storing business contacts, and assessing them: legitimate interest (Art. 6(1)(f)), with a written balancing test. Collect only role-relevant business data from sources where publication for business contact is expected, and keep it briefly.
  - (ii) Sending a commercial email: lawful only if the PKE hook exists. The GDPR basis for that sending should match it: consent (Art. 6(1)(a)) where consent is recorded. Where the person asked us for an offer, the basis is answering their request (Art. 6(1)(b) steps at the data subject's request, or (f)).

### Art. 14 information duty (data not obtained from the data subject)
- **Official [L12], Art. 14(3):** information must be provided
  - "(a) within a reasonable period after obtaining the personal data, but at the latest within one month";
  - "(b) if the personal data are to be used for communication with the data subject, at the latest at the time of the first communication to that data subject".
- **Official [L12], content required:** Art. 14(1)–(2), including identity and contact details of the controller, purposes and legal basis, categories of data, recipients, storage period, the legitimate interests pursued, rights (including to object), the right to complain, and "from which source the personal data originate, and if applicable, whether it came from publicly accessible sources".
- **Official (WP29 Transparency Guidelines, WP260 rev.01) [L15]:**
  - ¶27: "If the first communication with a data subject occurs more than one month after obtaining the personal data then Article 14.3(a) continues to apply".
  - ¶28: "in any case, the maximum time limit within which Article 14 information must be provided to a data subject is one month."
  - ¶35: layered notices are recommended in a digital context.
  - (WP29 guidelines were endorsed by the EDPB in 2018. I did not re-verify the endorsement document today.)
- **UODO and NSA (official) [L10]:** the Bisnode case.
  - UODO held that a company taking data from public registers (KRS, CEIDG, REGON) "must comply with the information obligation … set out in Article 14 of the GDPR … by directly providing information to the data subject".
  - On 19 September 2023, the NSA confirmed that view, as reported by UODO on 20.09.2023. It emphasised that "the exception concerning the exemption from the obligation to inform persons due to 'disproportionate effort', should be interpreted restrictively and, as a rule, should be applied to the processing of data for public purposes".
- **Inference, a design consequence for the discovery job:**
  - Storing a named person's data starts a one-month clock. Under the PKE, the app usually may *not* email that person without a consent hook. So the app should either:
    - store named-person data only when an eligibility basis is already documented and contact is planned within the month; or
    - store only organisation-level data and the source URL, and add the person later; or
    - delete unused named-person records before 30 days.
  - Do not rely on Art. 14(5)(b) "disproportionate effort" [L10].

### Right to object and erasure
- **Official [L12]:**
  - Art. 21(2): "the data subject shall have the right to object at any time to processing … for such marketing".
  - Art. 21(3): "the personal data shall no longer be processed for such purposes".
  - Art. 21(4): "At the latest at the time of the first communication with the data subject, the right … shall be explicitly brought to the attention of the data subject and shall be presented clearly and separately from any other information."
  - Art. 17(1)(c): erasure applies where "the data subject objects to the processing pursuant to Article 21(2)".
  - Art. 7(3): consent must be "as easy to withdraw as to give".
- **Inference:**
  - On any objection or "please don't write", set the contact to *do not contact* at once, delete the profile data, and keep only a minimal suppression entry (for example a normalised hash of the address plus a date), so the person is never re-imported.
  - This suppression practice is common, but I found no UODO statement on it. Document it in the processing records as a legitimate-interest or legal-obligation measure.

### Minimisation and retention
- **Official [L12]:**
  - Art. 5(1)(c): data must be "adequate, relevant and limited to what is necessary".
  - Art. 5(1)(e): data must be kept "for no longer than is necessary".
- **Inference, a suggested policy for the app (not from any authority):**
  - Store: name, role, business email, company, source URL and quote, date found, eligibility evidence.
  - Do not store: private emails or phone numbers, LinkedIn profile dumps, photos, or personal-life details.
  - Retention:
    - not contacted: delete within 30 days of collection;
    - contacted, no reply: 12 months, then delete;
    - replied: as long as the business conversation lasts, plus a short period;
    - suppression hash: indefinitely.
  - Gmail itself keeps copies of sent and received mail. That is a separate store the owner controls; mention it in the full notice.

---

## 5. Practical eligibility workflow for the app (not legal advice)

### Statuses
Default to **blocked**. A send button exists only for the statuses marked "can send" below.

| Status | Meaning | Can send a commercial email? | Risk (inference) |
|---|---|---|---|
| `not_assessed` | Default for every discovered contact. | **No** | – |
| `consent_recorded` | The person or organisation gave prior consent to receive commercial information **from Mind The Gap, by email**, on a stated topic (Art. 398(1), Art. 400 PKE + Art. 4(11) GDPR). | Yes, within the scope recorded. | Low |
| `inquiry_received` | The contact asked Mind The Gap for information or an offer (inbound email, form, call note). The address was given for that purpose (Art. 398(2)). | Yes: reply to that request, within its scope. | Low |
| `invitation_documented` | A published invitation to send offers on a topic to a specific address (Art. 398(2), arguable; see 3.4). | Yes, only that address and that topic, if the owner confirms after review. | Medium (unsettled) |
| `relationship_non_marketing` | An existing client or partner. | Only non-marketing correspondence (contract, logistics). **No** offers without consent. Poland has no soft opt-in in the Art. 398 text (inference). | – |
| `do_not_contact` | Objection, withdrawal, "unsubscribe", hard bounce, or the owner's decision. | **Never.** Re-import is blocked by the suppression hash. | – |

### Evidence to record for every status other than `not_assessed`
- `basis_type` (one of the statuses above).
- `recorded_at`: when the app recorded it. `evidence_date`: when the consent or invitation was given or published.
- `scope`: sender (Mind The Gap), channel (email), topic (for example "szkolenia z komunikacji"), and the exact address covered.
- `source_url` and a **verbatim quote** of the consent, inquiry or invitation wording.
- `snapshot`: an archived copy of the page or message, with a hash of it. For an email, store the Gmail message ID and Message-ID.
- `recorded_by` (the owner), and `review_by` (a re-check date for invitations, for example 6 months).
- For `do_not_contact`: the date, the channel of the objection, and what was deleted.

### Other rules the app should enforce (inference)
- One contact, one basis: the evidence must cover **the exact address** being emailed.
- Every commercial email carries the sender's full identity and addresses, and is clearly identifiable as an offer (Art. 9 UŚUDE [L3]). It carries the Art. 14 / Art. 21(4) footer below.
- No consent-request emails to cold contacts (3.2).
- An Art. 14 timer runs on named-person records (30 days).
- A Gmail-side opt-out: any reply containing "nie", "wypisz", "unsubscribe", "stop" or similar is flagged for the owner to mark `do_not_contact`.

### What the app must NOT claim or do
- It must not call a contact "consented", "opted in" or "permission granted" just because the address is public (KRS, CEIDG, a website or LinkedIn) [L8][L7].
- It must not state or imply that "B2B email doesn't need consent in Poland" [L6][L7].
- It must not show "GDPR-compliant", "legal" or "safe to send" badges. The status is the owner's documented assessment, not a legal opinion.
- It must not auto-assign `invitation_documented` or `consent_recorded` from a scraper or an AI classifier without the owner's confirmation and a stored quote.
- Footer text must not say "you receive this because you agreed" unless consent is recorded.
- It must not hide or disguise the sender (ePrivacy Art. 13(4) [L13]; UŚUDE Art. 9 [L3]).

### Footer template for the first email (fill the placeholders honestly; delete lines that do not apply)

The footer is short on purpose: a "layered" notice [L15 ¶35] that links to a full notice. The right to object is shown separately, as Art. 21(4) GDPR requires. Write the basis line to match the contact's real status.

**Polish**

> ---
> **Informacja o danych osobowych.** Administratorem Pani/Pana danych jest [imię i nazwisko], prowadzący działalność gospodarczą jako [Mind The Gap – pełna nazwa firmy], [adres], NIP [●], e-mail: [●].
> Pani/Pana służbowy adres e-mail i [imię, nazwisko, stanowisko] pozyskałem z: [źródło, np. strona https://… – sekcja „Dla dostawców”, stan na dd.mm.rrrr] / [Pani/Pana wiadomości z dnia dd.mm.rrrr].
> Piszę, ponieważ [Pani/Pan poprosiła/poprosił o ofertę] / [Państwa firma zaprasza do przesyłania ofert na ten adres] / [wyraziła/wyraził Pani/Pan zgodę na otrzymywanie ode mnie informacji handlowych e-mailem w dniu dd.mm.rrrr].
> Dane przetwarzam wyłącznie w celu tej korespondencji [podstawa: art. 6 ust. 1 lit. … RODO] i przechowuję je nie dłużej niż [●] miesięcy od ostatniego kontaktu. Pełna informacja (odbiorcy, w tym dostawca poczty, przekazywanie poza EOG, Pani/Pana prawa: dostępu, sprostowania, usunięcia, ograniczenia, skarga do Prezesa UODO): [link].
>
> **Prawo sprzeciwu:** w każdej chwili może Pani/Pan sprzeciwić się wykorzystywaniu swoich danych do kontaktu ze mną (lub wycofać zgodę). Wystarczy odpisać „nie kontaktuj się”. Usunę wtedy Pani/Pana dane i nie napiszę ponownie.

**English**

> ---
> **About your personal data.** The controller of your data is [full name], trading as [Mind The Gap – full business name], [address], tax ID [●], email: [●].
> I obtained your business email address and [name, role] from: [source, e.g. https://… – "For suppliers" page, as of dd.mm.yyyy] / [your message of dd.mm.yyyy].
> I am writing because [you asked for an offer] / [your company invites offers to this address] / [you agreed on dd.mm.yyyy to receive commercial information from me by email].
> I use your data only for this correspondence [basis: Art. 6(1)(…) GDPR] and keep it no longer than [●] months after our last contact. Full notice (recipients, including my email provider, transfers outside the EEA, your rights of access, rectification, erasure and restriction, and the right to complain to the Polish supervisory authority, UODO): [link].
>
> **Right to object:** you can object at any time to my use of your data to contact you (or withdraw your consent) by replying "do not contact". I will then delete your data and will not write again.

*Placeholders I could not fill from sources, and which must be checked:*
- the exact legal-basis letter;
- the retention period;
- whether Google (the Gmail provider) involves transfers outside the EEA, and under which mechanism;
- the full notice URL.

---

## 6. Open points and limits of this research

- I found no published decision of the President of UKE applying **Art. 398 PKE** to email specifically (2024–2026). Older UKE email cases rested on the old Art. 172 of the Telecommunications Law [L7].
- I found no authority on the exact reach of Art. 398(2) for supplier pages. I also found no authority on whose consent counts for an employee's mailbox.
- The WSA II SA/Wa 62/25 judgment was read only through a secondary report [L18].
- The GDPR is unchanged as of today. The "Digital Omnibus" proposal (2025/0360(COD)), which would amend the GDPR and the ePrivacy Directive, shows the status "Awaiting committee decision" in the European Parliament [L17]. Re-check before relying on this document after 2026.
- My web-search budget ran out near the end of this research. Some questions (for example later UKE decisions) may have more material than I found.

---

## Sources (all accessed 2026-10-15)

**Primary: Polish law and official documents**
- [L1] Ustawa z dnia 12 lipca 2024 r. – Prawo komunikacji elektronicznej (Dz.U. 2024 poz. 1221), text via the Sejm ELI service — https://api.sejm.gov.pl/eli/acts/DU/2024/1221/text.html — accessed 2026-10-15 (ISAP page: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20240001221)
- [L1-meta] Sejm ELI metadata for Dz.U. 2024 poz. 1221 (status, entry into force, amending acts) — https://api.sejm.gov.pl/eli/acts/DU/2024/1221 — accessed 2026-10-15
- [L2] Ustawa z dnia 12 lipca 2024 r. – Przepisy wprowadzające ustawę – Prawo komunikacji elektronicznej (Dz.U. 2024 poz. 1222), Art. 26 and Art. 124 — https://api.sejm.gov.pl/eli/acts/DU/2024/1222/text.pdf — accessed 2026-10-15
- [L3] Obwieszczenie Marszałka Sejmu z dnia 10 października 2024 r. – tekst jednolity ustawy o świadczeniu usług drogą elektroniczną (Dz.U. 2024 poz. 1513) — https://api.sejm.gov.pl/eli/acts/DU/2024/1513/text.pdf — accessed 2026-10-15
- [L4] Ustawa z dnia 4 września 2026 r. o zmianie ustawy o świadczeniu usług drogą elektroniczną oraz niektórych innych ustaw (Dz.U. 2026 poz. 1296; in force 2026-11-06) — https://api.sejm.gov.pl/eli/acts/DU/2026/1296/text.pdf (metadata: https://api.sejm.gov.pl/eli/acts/DU/2026/1296) — accessed 2026-10-15
- [L5] Other acts amending the PKE: Dz.U. 2025 poz. 637 — https://api.sejm.gov.pl/eli/acts/DU/2025/637/text.pdf ; Dz.U. 2025 poz. 820 — https://api.sejm.gov.pl/eli/acts/DU/2025/820/text.pdf ; Dz.U. 2026 poz. 252 — https://api.sejm.gov.pl/eli/acts/DU/2026/252/text.pdf ; Dz.U. 2026 poz. 815 — https://api.sejm.gov.pl/eli/acts/DU/2026/815/text.pdf — all accessed 2026-10-15
- [L6] Ministerstwo Cyfryzacji, answer to interpelacja nr 12162 (BM.WP.057.153.2025, 30.09.2025) — https://api.sejm.gov.pl/sejm/term10/interpellations/attachment/ATTDM3HHJ/i12162-o1.pdf (web: https://sejm.gov.pl/sejm10.nsf/interpelacjaTresc.xsp?key=DM3HHJ) — accessed 2026-10-15
- [L7] Ministerstwo Cyfryzacji, answer to interpelacja nr 12182 (BM.WP.057.151.2025, 14.10.2025), quoting UKE, UODO and UOKiK — https://api.sejm.gov.pl/sejm/term10/interpellations/attachment/ATTDMGHNG/i12182-o1.pdf (web: https://sejm.gov.pl/sejm10.nsf/interpelacjaTresc.xsp?key=DMGHNG) — accessed 2026-10-15
- [L8] UOKiK, "Pulling tricks like these doesn't pay off. President of UOKiK imposes fines for telemarketing without consumers' consent" (09.09.2026) — https://uokik.gov.pl/en/pulling-tricks-like-these-doesnt-pay-off-president-of-uokik-imposes-fines-for-telemarketing-without-consumers-consent — accessed 2026-10-15
- [L9] Sąd Apelacyjny w Warszawie, wyrok z 12.12.2019, VII AGa 1567/18 (via SAOS) — https://www.saos.org.pl/judgments/405828 (API text: https://www.saos.org.pl/api/judgments/405828) — accessed 2026-10-15
- [L10] UODO, "The Supreme Administrative Court upheld the decision of the Personal Data Protection Office (UODO)" (20.09.2023, Bisnode) — https://uodo.gov.pl/en/553/1572 — accessed 2026-10-15
- [L11] UODO, "Ochrona danych osobowych w miejscu pracy. Poradnik dla pracodawców" (październik 2018) — https://uodo.gov.pl/pl/file/4933 — accessed 2026-10-15

**Primary: EU law, EU bodies and courts**
- [L12] Regulation (EU) 2016/679 (GDPR), OJ L 119, 4.5.2016, via the Publications Office — https://publications.europa.eu/resource/celex/32016R0679 (EUR-Lex: https://eur-lex.europa.eu/eli/reg/2016/679/oj) — accessed 2026-10-15
- [L13] Directive 2002/58/EC (ePrivacy), consolidated 19.12.2009, Art. 13 — https://publications.europa.eu/resource/celex/02002L0058-20091219 — accessed 2026-10-15
- [L14] EDPB, Guidelines 1/2024 on processing of personal data based on Article 6(1)(f) GDPR, version 1.0 (adopted 8 October 2024, for public consultation) — https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf — accessed 2026-10-15
- [L15] Article 29 Working Party, Guidelines on transparency under Regulation 2016/679 (WP260 rev.01, revised 11 April 2018) — https://ec.europa.eu/newsroom/article29/redirection/document/51025 — accessed 2026-10-15
- [L16] CJEU, judgment of 4 October 2024, C-621/22, Koninklijke Nederlandse Lawn Tennisbond — https://publications.europa.eu/resource/celex/62022CJ0621 (EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62022CJ0621) — accessed 2026-10-15
- [L17] European Parliament Legislative Observatory, 2025/0360(COD) "Simplification of the digital legislative framework – Digital Omnibus" — https://oeil.secure.europarl.europa.eu/oeil/en/procedure-file?reference=2025/0360(COD) — accessed 2026-10-15

**Secondary (labelled as such in the text)**
- [L18] Lege Artis (czasopismo), "Marketing bezpośredni: uzasadniony interes czy zgoda? (wyrok)" (January 2026), on WSA Warszawa II SA/Wa 62/25 — https://czasopismo.legeartis.org/2026/01/marketing-bezposredni-uzasadniony-interes-zgoda-przesylanie-informacji-handlowych-wyrok/ — accessed 2026-10-15
- [L19] Grant Thornton (Łukasz Jarecki), "Prawo komunikacji elektronicznej a ochrona danych osobowych" (02.12.2024) — https://grantthornton.pl/publikacja/prawo-komunikacji-elektronicznej-a-ochrona-danych-osobowych/ — accessed 2026-10-15
