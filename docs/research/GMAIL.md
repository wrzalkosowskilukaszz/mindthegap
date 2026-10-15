# Gmail API: sending and reply tracking (research)

- **Date of research:** 2026-10-15. Every source was accessed on 2026-10-15. The IDs in square brackets, for example [G7], point to the source list at the end.
- **Scope:** a private, single-user outreach app (Next.js/TypeScript + PostgreSQL) that sends individually written B2B emails through the owner's own Gmail account (Google OAuth), tracks replies, and runs a server-side job while the owner's computer is off.
- **How to read this document:**
  - **Official** means stated by Google (or an RFC). Text in quotation marks is copied verbatim.
  - **Inference** means my own conclusion from the official text. It needs testing or a second opinion before anyone relies on it.
  - **Unverified** means a widely repeated claim that I could not confirm from an official source.

---

## 0. Bottom line

1. **Scopes.** Ask for `openid email` at sign-in. Ask for `gmail.send` (sensitive) when the owner first enables sending. Ask for `gmail.metadata` (restricted) separately, when the owner enables reply tracking. That is the narrowest set that can send, see replies in threads, and reconcile an uncertain send.
   - `gmail.metadata` cannot search with `q` and cannot read message bodies. Showing reply text inside the app would need `gmail.readonly`, which is also restricted. Otherwise, link out to Gmail.
   - Do not use drafts. They need `gmail.compose`, which is restricted.
2. **Publishing status.** For an owner on a personal @gmail.com account, the practical path is: an External user type, publishing status **In production**, unverified, used only by the owner.
   - Google explicitly exempts "Personal Use apps" (fewer than 100 users) from verification. The owner clicks through the "unverified app" screen once [G21].
   - **Testing** status is not workable. Refresh tokens expire after 7 days for any scope beyond basic sign-in [G17][G19].
   - If the owner uses Google Workspace, an **Internal** app inside the owner's own organisation avoids both the warning screen and verification [G21][G26].
3. **Reply sync.** For one mailbox, polling `history.list` hourly is enough and costs 2 quota units per call [G16]. Push through `users.watch` + Pub/Sub is optional. Even with push, Google says to keep a polling fallback [G14].
4. **Scheduled send.** The Gmail API has no scheduled-send feature [G9]. The app has to schedule sends itself.

---

## 1. OAuth scopes and Google's classification

**Official, verbatim from the Gmail scopes page [G1] (page "Last updated 2026-09-10 UTC"):**

| Scope | Google's description | Classification |
|---|---|---|
| `https://www.googleapis.com/auth/gmail.send` | "Send email on your behalf." | **Sensitive** |
| `https://www.googleapis.com/auth/gmail.compose` | "Manage drafts and send emails." | **Restricted** |
| `https://www.googleapis.com/auth/gmail.metadata` | "View your email message metadata such as labels and headers, but not the email body." | **Restricted** |
| `https://www.googleapis.com/auth/gmail.readonly` | "View your email messages and settings." | **Restricted** |
| `https://www.googleapis.com/auth/gmail.modify` | "Read, compose, and send emails from your Gmail account. This scope does not allow immediate, permanent deletion of threads and messages, bypassing the trash." | **Restricted** |
| `https://mail.google.com/` | "Read, compose, send, and permanently delete all your email from Gmail." Google adds: "Request this scope only if your application needs to immediately and permanently delete threads and messages, bypassing the trash." | **Restricted** |

Google's restricted-scope list repeats the same Gmail scopes [G23]. It also adds that `https://mail.google.com/` "includes any usage of IMAP, SMTP, and POP3 protocols".

**What each class requires (official, [G1]):**
- **Sensitive:** "require additional OAuth App Verification".
- **Restricted:** "require restricted scope OAuth App Verification". Google adds: "If you store restricted scope data on servers (or transmit), then you must go through a security assessment."

The Workspace guide's table shows the same tiers: basic verification for all classes, additional verification for sensitive and restricted, and a security assessment for restricted only [G26].

**`openid` / `email`:**
- **Official [G19]:** these are the special case for basic sign-in. An app that requests only "a subset of the following: name, email address, and user profile (through the userinfo.email, userinfo.profile, openid scopes or their OpenID Connect equivalents)" does not need test users, shows no warning, and its "authorizations will not expire after 7 days". The OpenID Connect guide says a basic request uses `scope=openid email` [G39].
- **Inference:** these scopes are in the non-sensitive class. I did not find a Google table that labels `openid` and `email` explicitly. The Cloud console shows each scope's class when it is added [G26].

### Which methods accept which scopes (official, from the API reference)

| Method | Accepted scopes |
|---|---|
| `users.messages.send` | `mail.google.com`, `gmail.modify`, `gmail.compose`, `gmail.send` [G7] (the discovery document also lists `gmail.addons.current.action.compose` [G9]) |
| `users.messages.list`, `users.threads.list` | `mail.google.com`, `gmail.modify`, `gmail.readonly`, `gmail.metadata` [G2][G3] |
| `users.messages.get`, `users.threads.get` | `mail.google.com`, `gmail.modify`, `gmail.readonly`, `gmail.metadata` [G5][G4] |
| `users.history.list` | `mail.google.com`, `gmail.modify`, `gmail.readonly`, `gmail.metadata` [G6] |
| `users.watch` | `mail.google.com`, `gmail.modify`, `gmail.readonly`, `gmail.metadata` [G8] |
| `users.getProfile` | `mail.google.com`, `gmail.modify`, `gmail.compose`, `gmail.readonly`, `gmail.metadata` (**not** `gmail.send`) [G9] |

### Limits of `gmail.metadata` (official)

- **No `q` search.** The `q` parameter of `messages.list` and `threads.list`: "Parameter cannot be used when accessing the api using the gmail.metadata scope." [G2][G3]
- **No full or raw format.** For `format=full` and `format=raw`: "Format cannot be used when accessing the api using the gmail.metadata scope." Only `metadata` ("Returns only email message IDs, labels, and email headers") and `minimal` are available [G4][G9].
- **Allowed:** `labelIds` filtering on `messages.list` [G9], `history.list`, `threads.get` with `format=metadata` and `metadataHeaders[]`, and `users.watch` [G4][G6][G8].

---

## 2. Narrowest scope set for each capability

### (a) Send only
- **Official:** `gmail.send` is the only sensitive (not restricted) scope that can call `messages.send` [G1][G7].
- **Inference:** `gmail.send` + `openid email` is enough to send.
  - `gmail.send` cannot read anything. It cannot even call `getProfile` [G9]. Take the account's address from the OpenID Connect `email` claim [G39].
  - The send response is a `Message` [G7]. Google's upload example shows that the response includes `id` and `threadId` [G12]. Store both. They are what the app later uses to find the thread.
  - Do **not** use `drafts.*`. Drafts need `gmail.compose`, which is restricted [G1][G9].

### (b) Detect replies in threads of messages we sent
- **Official:** every read method (`threads.get`, `history.list`, `messages.list`, `messages.get`, `watch`) needs at least `gmail.metadata` [G2–G8]. All read scopes are restricted [G1].
- **Inference:** the narrowest read scope is `gmail.metadata`. With it, the app can:
  - call `threads.get(id=<stored threadId>, format=metadata, metadataHeaders=[From, To, Date, Subject, Message-ID, In-Reply-To, References, Auto-Submitted, Precedence, X-Autoreply, Content-Type])` and count messages in the thread that are not from the owner;
  - call `history.list(startHistoryId=…, historyTypes=messageAdded)` to see which messages arrived since the last check, then match their `threadId` against the stored thread IDs.
- **Restrictions:** no `q` search, and no bodies [G2][G4].
  - **Unverified:** I could not confirm whether `snippet` is returned in `format=metadata`. Test it.
  - If the app must show the text of a reply, it needs `gmail.readonly`, which is also restricted. The alternative is to link to the thread in Gmail (section 7).
- **Inference:** `gmail.metadata` and `gmail.readonly` are in the same restricted tier. Choosing `gmail.metadata` does not make verification easier. Its value is data minimisation: the app never receives the content of unrelated emails. That also helps the GDPR minimisation principle (see LEGAL-PL.md).

### (c) Reconcile an uncertain send
**Official:** "The mail sending pipeline is complex: once the user exceeds their quota, there can be a delay of several minutes before the API begins returning 429 error responses. You can't assume that a 200 response means the email was successfully sent." [G15]

| Scopes held | What is possible |
|---|---|
| `gmail.send` only | **Inference:** no API call can check whether a timed-out send went out. The send must not be retried automatically. Mark it "uncertain" and let the owner check the Sent folder through a Gmail search link (section 7). |
| + `gmail.metadata` | **Inference:** before each send, store the mailbox `historyId` from `getProfile` [G9]. After a timeout, call `history.list(startHistoryId=<stored>, historyTypes=messageAdded, labelId=SENT)` [G6][G9]. Then fetch each new SENT message with `format=metadata&metadataHeaders=Message-ID` and compare the header with the Message-ID the app generated. Alternative: `messages.list(labelIds=SENT)` without `q`, newest first, then compare headers. The sync guide calls the first message in a list response "the most recent message" [G13]. |
| + `gmail.readonly` | **Official:** `messages.list` with `q` "Supports the same query format as the Gmail search box", for example `rfc822msgid:<somemsgid@example.com>` [G2]. Gmail's help documents `rfc822msgid` as "Find emails with a specific message-id header" [G31]. |

**Unverified, test first:** whether Gmail keeps a `Message-ID` header that the app sets in the raw message when sending through the API. I found no Google statement either way. Some third-party sources say providers rewrite it.
- Step 1: send a test message to yourself, then read the header back with `format=metadata`.
- Step 2: if Gmail overwrites the header, compare a custom header instead (for example `X-MTG-Send-Id: <uuid>`) or the returned message `id`. Test whether Gmail keeps custom headers too.

---

## 3. Incremental authorization (granting send and read separately)

**Official [G18]:**
- Google's server "supports incremental authorization. This feature lets you request scopes as they are needed and, if the user grants permission for the new scope, returns an authorization code that may be exchanged for a token containing all scopes the user has granted the project."
- `include_granted_scopes=true`: "If you set this parameter's value to true and the authorization request is granted, then the new access token will also cover any scopes to which the user previously granted the application access."
- "The combined authorization includes all scopes that the user granted to the API project even if the grants were requested from different clients."
- "If you revoke a token that represents a combined authorization, access to all of that authorization's scopes on behalf of the associated user are revoked simultaneously."
- Caution: "choosing to include granted scopes will automatically add scopes previously granted by the user to your authorization request. A warning or error page may be displayed if your app is not currently approved to request all scopes that may be returned in the response."
- Granular consent: "users may not grant your app access to all of them. Your app must verify which scopes were actually granted and gracefully handle situations where some permissions are denied."
- `access_type=offline` is needed "if your application needs to refresh access tokens when the user is not present at the browser". The Node.js section notes: "The `refresh_token` is only returned on the first authorization."

**Inference, the recommended flow:**
1. **Sign-in:** `openid email`, with no Gmail scope.
2. **"Enable sending"** (on the settings screen): request `gmail.send` with `include_granted_scopes=true&access_type=offline`. If a refresh token is missing, add `prompt=consent`.
3. **"Enable reply tracking"** (a separate button): request `gmail.metadata` the same way.
4. After each grant, read the granted-scopes list from the token response and turn features on or off to match. Store the refresh token encrypted.

**Inference, limits of this separation:**
- The grants are separate in the consent UI, but they become one combined authorization per Cloud project. Revoking it revokes everything [G18].
- Full isolation would need two separate Cloud projects (one for sending, one for reading). That is probably not worth the complexity for one user.

---

## 4. Publishing status, verification and security assessment

### Official facts

- **User types [G19].** External: "available to any user with a Google Account". Internal: "Projects associated with a Google Cloud Organization can configure Internal users to limit authorization requests to members of the organization."
- **Testing [G19].**
  - "limited to up to 100 test users".
  - A warning screen is shown to test users.
  - "Authorizations by a test user will expire seven days from the time of consent. If your OAuth client requests an offline access type and receives a refresh token, that token will also expire."
  - This does not apply when the app requests only the basic profile scopes listed in section 1.
  - The OAuth overview says the same: a project with an "external user type and a publishing status of 'Testing' is issued a refresh token expiring in 7 days, unless the only OAuth scopes requested are a subset of name, email address, and user profile" [G17].
- **In production [G19].**
  - "Google will display an Unverified apps warning message if your project's OAuth clients request authorization of scopes considered sensitive or restricted before your project has completed verification for those scopes."
  - User cap: "100 new users in total, after the app presents the unverified app screen". "The user cap applies over the entire lifetime of the project, and it cannot be reset or changed." [G19][G20]
- **"When is verification not needed" [G21], verbatim:**
  - "Personal Use apps: If the app is for your personal use (fewer than 100 users), you and your limited number of users can continue using the app without going through verification(users will be allowed to click through "unverified app" warning screens during sign-in). Such apps will need to complete a verification, if they want to grow their user base beyond 100."
  - "Internal Use apps: The app is only used by people in your Google Workspace or Cloud Identity organization. The project must be owned by the organization, and its OAuth Consent Screen must be configured for internal use. In this case, your app might need approval from an organization administrator." And: "Your app will not be subject to the unverified app screen or the 100-user cap if it's designated as internal-only."
  - "All apps that integrate with Google APIs are required to comply with Google's API Services User Data Policy regardless of whether they have been verified."
- **Internal apps and admin approval.**
  - Workspace guide: "For apps used only internally by your Google Workspace organization, scopes aren't listed on the consent screen and use of restricted or sensitive scopes doesn't require further review by Google." [G26]
  - Admin console setting: "Internal apps: This allows internal apps built by your organization to access restricted Google Workspace APIs. To allow API access for all internal apps, check the Trust internal apps box." [G27]
- **Security assessment (CASA).**
  - "applications requesting access to restricted scopes must undergo an annual security assessment".
  - The assessment is "the final step of the restricted scopes review process", and "the Google Trust and Safety team will contact you when it is time to initiate the security assessment process" [G24].
  - Google charges no fee, but assessments are done by "CASA authorized independent security assessors" [G25].
  - Restricted-scope verification takes about 6 weeks according to Google's FAQ table [G25].

### Refresh tokens can still stop working in production (official [G17])

- "The refresh token has not been used for six months."
- "The user changed passwords and the refresh token contains Gmail scopes."
- "The user account has exceeded a maximum number of granted (live) refresh tokens." Google adds: "There is currently a limit of 100 refresh tokens per Google Account per OAuth 2.0 client ID. If the limit is reached, creating a new refresh token automatically invalidates the oldest refresh token without warning."
- The user revoked access, or an admin restricted the service (`admin_policy_enforced`).
- Unused OAuth clients may be deleted automatically. Deleted clients "can be restored within 30 days" [G18].

### Personal @gmail.com versus Google Workspace

| | Personal @gmail.com | Google Workspace account |
|---|---|---|
| User type | External only. **Inference:** a personal account has no Cloud Organization, and Internal requires one [G19]. | Internal is possible if the Cloud project is owned by the owner's Workspace organization [G21]. |
| Testing | Works, but tokens expire after 7 days [G19]. That breaks a job running while the owner is away. | Same if the app is External. |
| Production, unverified | Allowed under "Personal Use apps (fewer than 100 users)" [G21]. The owner sees the unverified-app screen and clicks through [G20][G21]. 100-user lifetime cap [G19]. | Possible, but Internal is better. |
| Verification / CASA | **Inference:** not required while the app stays a personal-use app. That exemption [G21] covers sensitive and restricted scopes alike, and the security assessment is part of the restricted-scope verification process [G24]. The sentence "If you store restricted scope data on servers… you must go through a security assessment" [G1] sits in the verification context. **Treat this as a residual risk:** Google can change its policy, and I found no explicit statement that a personal-use app storing restricted-scope data on a server is exempt from CASA. | Internal apps: no Google review [G21][G26]. The admin may need to tick "Trust internal apps" [G27]. |

### Most practical path for a single owner

- **Personal @gmail.com (inference):**
  1. Create one Cloud project with user type External, then click **Publish app** to move it to "In production".
  2. Do not submit it for verification.
  3. The owner authorises once and clicks through the unverified-app warning.
  4. Keep the requested scopes identical to the ones configured on the consent screen. Google shows the unverified screen when the code requests scopes that differ from the configuration [G20].
  5. Handle `invalid_grant` by showing a "Reconnect Gmail" banner and pausing sends. Expect re-consent after a password change [G17].
- **Workspace (inference):** create the project under the Workspace organization, set the user type to Internal, and tick "Trust internal apps" if needed. There is no warning, no cap and no verification [G21][G26][G27]. It costs a Workspace subscription and raises the daily sending limit (section 5).

---

## 5. Sending

### Message format
- **Official:** "The Gmail API requires MIME email messages compliant with RFC 2822 and encoded as base64URL strings." [G10] The `raw` field is "The entire email message in an RFC 2822 formatted and base64url encoded string." [G9] (RFC 2822 has been superseded by RFC 5322 [G34].)
- **Inference:** build the MIME message with a library (for example `nodemailer`'s MailComposer or `mimetext`). Never let a user-supplied header value through without CR/LF stripping, because header injection is a risk.

### Attachments and size limits
- **Official.** `messages.send` has two endpoints:
  - an upload URI `POST https://gmail.googleapis.com/upload/gmail/v1/users/{userId}/messages/send`;
  - a metadata URI `POST https://gmail.googleapis.com/gmail/v1/users/{userId}/messages/send` [G7].
- **Official.** The discovery document gives `messages.send` media upload `maxSize: 36700160` bytes (35 MiB), accepts `message/*`, and supports `simple` and `resumable` upload protocols, both multipart [G9].
- **Official.** The upload guide describes the three options [G12]:
  - "Simple upload: uploadType=media. For quick transfer of smaller files, for example, 5 MB or less."
  - "Multipart upload: uploadType=multipart."
  - "Resumable upload: uploadType=resumable. For reliable transfer, especially important with larger files."
- **Official.** Gmail attachment limit for personal accounts: "For personal Gmail accounts, the limit is 25 MB." [G30] Workspace: 25 MB for Business editions [G28], and these values "are the limits on the total size of the message content and attachments before encoding" [G28].
- **Unverified:** a lower practical limit for the JSON `raw` body on the non-upload endpoint. I found no official figure.
- **Inference:** base64 adds about 33%. Keep attachments under about 18–20 MB in total. Send larger messages through the `/upload` endpoint with `uploadType=multipart`, or `resumable` for anything above a few MB. For a B2B outreach tool, prefer a link to a hosted PDF over large attachments.

### Keeping a message in the same thread
**Official [G9][G11]:** "To add a message or draft to a thread, the following criteria must be met:"
1. "The requested `threadId` must be specified on the `Message` or `Draft.Message` you supply with your request."
2. "The `References` and `In-Reply-To` headers must be set in compliance with the RFC 2822 standard."
3. "The `Subject` headers must match."

**RFC 5322 [G34]:**
- "The 'In-Reply-To:' field will contain the contents of the 'Message-ID:' field of the message to which this one is a reply."
- The References field is used "to identify a 'thread' of conversation".

**Inference, the follow-up recipe:**
- Body: `{ raw, threadId: <stored threadId> }`.
- `In-Reply-To: <Message-ID of the message being answered>`.
- `References: <all earlier Message-IDs in order>`.
- Subject: the same subject, optionally with a single `Re: ` prefix. Test whether Gmail threads `Re:` variants for your case. The documented rule is only "Subject headers must match".
- For a follow-up to the owner's own earlier message (no reply yet), use the app's own stored Message-ID. This depends on the Message-ID question in section 2(c).

### Setting our own Message-ID
- **Official (RFC 5322):** "every message SHOULD have a 'Message-ID:' field". "The uniqueness of the message identifier is guaranteed by the host that generates it". A domain on the right-hand side of "@" is RECOMMENDED [G34].
- **Unverified:** whether Gmail keeps a client-supplied Message-ID on API sends. See section 2(c). Generate `<uuid@your-domain>` and verify with a test send.

### Daily sending limits
- **Personal Gmail (official [G29]):** "You may see this message if you send an email to a total of more than 500 recipients in a single email and or more than 500 emails sent in a day." Also: "you should be able to send emails again within 1 to 24 hours." Many bounces from invalid addresses can also block sending for up to 24 hours [G29].
- **Workspace (official [G28], page "Last updated 2026-10-13 UTC"):**
  - "Maximum messages per day: 2,000".
  - "500 for trial accounts".
  - "Recipients per message sent with the Gmail API: 500".
  - "External recipients per day: 3,000".
  - "Unique recipients per day: 3,000; 2,000 external; 500 external for trial accounts".
  - Limits apply "over a rolling 24-hour period". Users "can't send new messages for up to 24 hours" after hitting a limit.
- **Official [G15]:** the API "enforces the standard daily mail sending limits", and these "are per-user and are shared by all of the user's clients".
- **API quota (official [G16]):**
  - `messages.send` costs 100 units.
  - The per-user limit is 6,000 units per minute.
  - Google notes that from May 1, 2026, new projects are on new API quotas, with charges above a daily billing threshold "planned … later in 2026".
  - **Inference:** a single user is far below these limits.
- **Bulk-sender rules (official [G38]):** one-click unsubscribe and DMARC are mandatory only for senders of more than 5,000 messages per day to Gmail accounts. All senders must keep spam rates "below 0.3%".

### Error codes to handle (official [G15], [G18])

| Situation | What you get | Handling (inference unless quoted) |
|---|---|---|
| Daily mail limit | HTTP 429 "Too many requests: User-rate limit exceeded (Mail sending)" with a retry time. "Exceeding daily limits might result in these errors for multiple hours." | Pause the send queue until the retry time. Do not hammer the API. |
| Per-user rate | 403 `userRateLimitExceeded` or `rateLimitExceeded`. | "use exponential backoff to retry the request" |
| Too many parallel calls | 429 "Too many concurrent requests for user". | Serialise calls per mailbox. |
| Expired or invalid access token | 401 `authError` ("Invalid Credentials"). Google: "refresh the access token using the long-lived refresh token… If this fails, direct the user through the OAuth flow." | Refresh once, then flag the account. |
| Refresh token dead | Token endpoint error `invalid_grant`: "the token may have expired or has been invalidated. Authenticate the user again and ask for user consent to obtain new tokens." [G18] | Stop the job and show "Reconnect Gmail". |
| Admin policy (Workspace) | `admin_policy_enforced` [G18], or 403 `domainPolicy` [G15]. | Show the cause to the owner. |
| Server errors | 500, 502, 503, 504 `backendError`: "use exponential backoff". | Do **not** auto-retry `messages.send` after a timeout. Reconcile first (section 2c), because a 200 is not proof of delivery and a timeout is not proof of failure. |

Google's backoff recipe [G16]: wait `min((2^n)+random_ms, maximum_backoff)`, where maximum_backoff is "typically 32 or 64 seconds". Google also says: "Start retry periods at least one second after the error." [G15]

---

## 6. Reply synchronisation

### Polling (`threads.get` / `history.list`)
- **Official [G13]:**
  - "Partial synchronization: … use the history.list method to return all history records newer than the startHistoryId."
  - "History records are typically available for at least one week and often longer. However, the time period … might be significantly shorter."
  - "If the startHistoryId supplied by your client is outside the available range of history records, the Gmail API returns an HTTP 404 error response. In this case, your client must perform a full sync."
  - In the reference, a `historyId` "is typically valid for at least a week, but in some rare circumstances may be valid for only a few hours" [G9].
- **Cost (official [G16]):** `history.list` costs 2 units, `threads.get` 40, `messages.get` 20, and `messages.list` 5.
- **Inference, the recommended algorithm for one user:**
  1. Run once per hour (driven by the server scheduler).
  2. Call `history.list(startHistoryId=last, historyTypes=messageAdded)` and page through all results.
  3. Collect the `threadId`s that match open outreach threads in the database.
  4. For each match, call `threads.get(format=metadata, metadataHeaders=[…])`, classify the new messages (reply, auto-reply or bounce, as below), and store the latest `historyId`.
  5. On a 404, fall back to `threads.get` for every open outreach thread younger than N days. This is cheap at small volume.

### Push (`users.watch` + Cloud Pub/Sub)
- **Official [G14]:**
  - Requires a Pub/Sub topic. Publish rights must be granted to `gmail-api-push@system.gserviceaccount.com`.
  - "You must call the watch method at least once every 7 days or you'll stop receiving updates for the user. We recommend calling watch once per day."
  - "Each Gmail user being watched has a maximum notification rate of one event per second."
  - "in rare situations, notifications might be delayed or dropped. … fall back to periodically calling the history.list method after a period with no notifications."
  - `watch` costs 100 units [G16].
- **Cost (official [G37]):** Pub/Sub's first 10 GiB per month of Message Delivery Basic throughput per billing account is free.
- **Inference:** push adds a Pub/Sub topic, a subscription, a push endpoint and daily `watch` renewal, and still needs polling as a fallback. For one mailbox and replies that matter on an hours scale, hourly polling is simpler and enough. Add push later only if near-real-time notification is wanted.

### Detecting auto-replies (out-of-office)
- **Official (RFC 3834 [G35]):**
  - `Auto-Submitted` is defined as `"no" / "auto-generated" / "auto-replied" / extension`.
  - "auto-replied" "SHOULD be used on messages sent in direct response to another message by an automatic process".
  - "The Auto-Submitted header field SHOULD NOT be supplied for messages that were manually submitted by a human."
- **Official (RFC 3834 §3.1.8 [G35]):** "Because the Precedence field is non-standard and its interpretation varies widely, the use of Precedence is not specifically recommended". RFC 2076 lists `Precedence:` as "Non-standard, controversial, discouraged" [G36b].
- **Inference:** `X-Autoreply` (and variants such as `X-Autorespond`) is a non-standard header. I found no specification, so treat it as a heuristic only.
- **Inference, classifier order:**
  1. `Auto-Submitted` present and not `no` → automatic.
  2. `X-Autoreply`/`X-Autorespond` present, or `Precedence: auto_reply|bulk|junk|list` → probably automatic.
  3. Otherwise treat it as a human reply. Optionally add a subject heuristic ("Out of office", "Nieobecność", "Automatyczna odpowiedź") flagged for owner review, not decided silently.

### Detecting bounces (non-delivery)
- **Official (RFC 3464 [G36]):**
  - "A DSN is a MIME message with a top-level content-type of multipart/report", where "The report-type parameter of the multipart/report content is 'delivery-status'".
  - The second part is `message/delivery-status`.
  - "Whenever an SMTP transaction is used to send a DSN, the MAIL FROM command MUST use a NULL return address".
  - Per-recipient fields include `Final-Recipient`, `Action` and `Status`.
  - RFC 3834 notes that some implementations wrongly label DSNs `Auto-Submitted: auto-generated` [G35].
- **Inference, the bounce rule:**
  - Classify as a bounce if `Content-Type` is `multipart/report; report-type=delivery-status`, or the sender is `mailer-daemon@…` or `postmaster@…`, or `Return-Path: <>`.
  - Reading `Status: 5.x.x` (permanent) versus `4.x.x` (transient) needs the body part, so it needs `gmail.readonly`. With `gmail.metadata`, use the headers above, mark "bounced – check in Gmail", and set the contact to *do not send* until the owner reviews it.
  - Gmail's own bounce notices come into the same thread in practice (unverified). Match by `threadId` first, then by `In-Reply-To`/`References`.

---

## 7. "Open in Gmail" deep links (unofficial)

- **Official [G32]:** Gmail's IMAP extension documentation says the IMAP `X-GM-MSGID` and `X-GM-THRID` are "the decimal equivalent for the ID hex string used in the web interface and the Gmail API". So the API's hex `id`/`threadId` are the same identifiers the web UI uses.
- **Unofficial (not documented by Google; inference from common practice):**
  - Thread or message: `https://mail.google.com/mail/u/0/#all/<threadId or messageId>`, or `#inbox/<id>`, or `#sent/<id>`.
  - Choose the account explicitly instead of `/u/0/`: `https://mail.google.com/mail/?authuser=<owner@gmail.com>#all/<id>`.
  - Search by Message-ID: `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A<url-encoded-message-id>`. The `rfc822msgid:` operator itself is official [G31].
- **Risk:** Google can change the web UI URL scheme at any time. Keep the link builder in one function, and fall back to the search link.

---

## 8. Scheduled send

- **Official:** the Gmail API reference lists no scheduling method or field.
  - The discovery document (revision 20261012) has `messages.send`, `drafts.send` and the rest, but no "schedule" method or parameter.
  - The `Message` resource has only `sizeEstimate, internalDate, classificationLabelValues, historyId, labelIds, snippet, raw, threadId, payload, id` [G9].
- **Official:** scheduled send exists only in the Gmail UI ("You can have up to 100 scheduled emails") [G33].
- **Inference: the Gmail API does not support scheduled send.** The app must queue messages and send them at the right time from its own scheduler: an hourly tick, or a precise-time task (see HOSTING.md).
  - Do not emulate scheduling with drafts, because that needs the restricted `gmail.compose` scope.

---

## 9. Things to test before relying on them

1. Does Gmail keep a client-set `Message-ID` and a custom `X-…` header on API sends? (Send to self, then read the headers back with `gmail.metadata`.)
2. Does `format=metadata` return `snippet`?
3. Does Gmail thread a follow-up whose subject has an added `Re: ` prefix, when `threadId` and the headers are set correctly?
4. Is the unverified-app screen shown to the project owner's own account? (I found no documentation on this.)
5. Watch for policy changes. The CASA/verification exemption for personal-use apps depends on Google's help pages [G21][G24].

---

## Sources (all accessed 2026-10-15)

- [G1] Google, "Choose Gmail API scopes" — https://developers.google.com/workspace/gmail/api/auth/scopes — accessed 2026-10-15
- [G2] Google, "Method: users.messages.list" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list — accessed 2026-10-15
- [G3] Google, "Method: users.threads.list" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/list — accessed 2026-10-15
- [G4] Google, "Method: users.threads.get" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get — accessed 2026-10-15
- [G5] Google, "Method: users.messages.get" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get — accessed 2026-10-15
- [G6] Google, "Method: users.history.list" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list — accessed 2026-10-15
- [G7] Google, "Method: users.messages.send" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send — accessed 2026-10-15
- [G8] Google, "Method: users.watch" — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch — accessed 2026-10-15
- [G9] Google, Gmail API v1 discovery document (revision 20261012) — https://gmail.googleapis.com/$discovery/rest?version=v1 — accessed 2026-10-15
- [G10] Google, "Create and send email messages" — https://developers.google.com/workspace/gmail/api/guides/sending — accessed 2026-10-15
- [G11] Google, "Manage threads" — https://developers.google.com/workspace/gmail/api/guides/threads — accessed 2026-10-15
- [G12] Google, "Upload attachments" — https://developers.google.com/workspace/gmail/api/guides/uploads — accessed 2026-10-15
- [G13] Google, "Synchronize clients with Gmail" — https://developers.google.com/workspace/gmail/api/guides/sync — accessed 2026-10-15
- [G14] Google, "Configure push notifications with the Gmail API" — https://developers.google.com/workspace/gmail/api/guides/push — accessed 2026-10-15
- [G15] Google, "Resolve errors" (Gmail API) — https://developers.google.com/workspace/gmail/api/guides/handle-errors — accessed 2026-10-15
- [G16] Google, "Usage limits" (Gmail API) — https://developers.google.com/workspace/gmail/api/reference/quota — accessed 2026-10-15
- [G17] Google, "Using OAuth 2.0 to Access Google APIs" (section "Refresh token expiration") — https://developers.google.com/identity/protocols/oauth2 — accessed 2026-10-15
- [G18] Google, "Using OAuth 2.0 for Web Server Applications" — https://developers.google.com/identity/protocols/oauth2/web-server — accessed 2026-10-15
- [G19] Google Cloud Help, "Manage App Audience" — https://support.google.com/cloud/answer/15549945?hl=en — accessed 2026-10-15
- [G20] Google Cloud Help, "Unverified apps" — https://support.google.com/cloud/answer/7454865?hl=en — accessed 2026-10-15
- [G21] Google Cloud Help, "When is verification not needed" — https://support.google.com/cloud/answer/13464323?hl=en — accessed 2026-10-15
- [G22] Google Cloud Help, "OAuth App Verification Help Center" — https://support.google.com/cloud/answer/13463073?hl=en — accessed 2026-10-15
- [G23] Google Cloud Help, "Restricted Scopes" — https://support.google.com/cloud/answer/13464325?hl=en — accessed 2026-10-15
- [G24] Google Cloud Help, "Security Assessment" — https://support.google.com/cloud/answer/13465431?hl=en — accessed 2026-10-15
- [G25] Google Cloud Help, "OAuth App Verification FAQ" — https://support.google.com/cloud/answer/13463817?hl=en — accessed 2026-10-15
- [G26] Google, "Configure the OAuth consent screen and choose scopes" — https://developers.google.com/workspace/guides/configure-oauth-consent — accessed 2026-10-15
- [G27] Google Workspace Admin Help, "Control which third-party & internal apps access Google Workspace data" — https://support.google.com/a/answer/7281227?hl=en — accessed 2026-10-15
- [G28] Google Workspace Admin Help, "Gmail sending limits in Google Workspace" — https://support.google.com/a/answer/166852?hl=en — accessed 2026-10-15
- [G29] Gmail Help, "Limits for sending & getting mail" — https://support.google.com/mail/answer/22839?hl=en — accessed 2026-10-15
- [G30] Gmail Help, "Add attachments in Gmail" — https://support.google.com/mail/answer/6584?hl=en — accessed 2026-10-15
- [G31] Gmail Help, "Search operators you can use with Gmail" — https://support.google.com/mail/answer/7190?hl=en — accessed 2026-10-15
- [G32] Google, "Gmail IMAP Extensions" — https://developers.google.com/workspace/gmail/imap/imap-extensions — accessed 2026-10-15
- [G33] Gmail Help, "Schedule emails to send" — https://support.google.com/mail/answer/9214606?hl=en — accessed 2026-10-15
- [G34] IETF, RFC 5322 "Internet Message Format" — https://www.rfc-editor.org/rfc/rfc5322.txt — accessed 2026-10-15
- [G35] IETF, RFC 3834 "Recommendations for Automatic Responses to Electronic Mail" — https://www.rfc-editor.org/rfc/rfc3834.txt — accessed 2026-10-15
- [G36] IETF, RFC 3464 "An Extensible Message Format for Delivery Status Notifications" — https://www.rfc-editor.org/rfc/rfc3464.txt — accessed 2026-10-15
- [G36b] IETF, RFC 2076 "Common Internet Message Headers" — https://www.rfc-editor.org/rfc/rfc2076.txt — accessed 2026-10-15
- [G37] Google Cloud, "Pub/Sub pricing" — https://cloud.google.com/pubsub/pricing — accessed 2026-10-15
- [G38] Google Workspace Admin Help, "Email sender guidelines" — https://support.google.com/a/answer/81126?hl=en — accessed 2026-10-15
- [G39] Google, "OpenID Connect" — https://developers.google.com/identity/openid-connect/openid-connect — accessed 2026-10-15
