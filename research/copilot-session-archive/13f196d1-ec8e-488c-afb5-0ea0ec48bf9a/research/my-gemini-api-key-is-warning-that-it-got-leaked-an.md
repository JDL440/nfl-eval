## Executive Summary

Yes — the broad claim is directionally right, but it needs tightening.

Google now officially says it identified a vulnerability involving publicly exposed API keys and is proactively blocking known leaked keys from accessing the Gemini API. Google’s troubleshooting guide explicitly documents the exact error message (`Your API key was reported as leaked. Please use another API key.`), says leaked keys can no longer be used with Gemini, and says new keys created in Google AI Studio are moving toward Gemini-only scope by default.[^1] Google’s current Gemini key guidance also now says to treat Gemini API keys like passwords, never commit them to source control, and never expose them client-side in production web or mobile apps.[^2]

The important nuance is that Google does **not** publicly say “any key that was ever public will always be disabled forever.” What Google does say is that it identified a vulnerability involving publicly exposed keys and is proactively blocking **known leaked keys** used with Gemini.[^1] So the safer statement is: **if Google detects or classifies your key as leaked, that key may be blocked from Gemini and you should rotate it immediately.**[^1]

The reason this is hitting teams hard is that Google historically had products and docs where API keys were commonly embedded in frontend code or treated as non-secret project identifiers. Firebase’s security checklist still says Firebase service API keys are not secret **when restricted to Firebase-related APIs**, and it now explicitly tells developers to use a **separate API key** for the Gemini Developer API.[^3] Maps docs also show API keys embedded directly in browser HTML and warn that unrestricted keys can be abused and billed to you.[^4] That historical pattern helps explain why older public `AIza...` keys are now being caught by Gemini leak protections.[^3][^4][^5]

The “especially common if Gemini Image or Embeddings are used” part is **not something I found confirmed in official Google docs**. I found one public Google AI forum thread where a developer reported the leaked-key error specifically with `gemini-embedding-001`, which suggests model-specific reports do happen in the wild, but that is anecdotal, not formal policy.[^6] I did **not** find an official Google statement saying image or embedding usage is a distinct trigger for leak-disable behavior.[^1][^2]

## What is confirmed by Google

### 1) Google is actively blocking leaked Gemini keys

Google’s official troubleshooting page says it identified a vulnerability where some API keys may have been publicly exposed, and that it has “proactively blocked these known leaked keys from accessing the Gemini API.”[^1] It also shows the exact user-facing error:

> `Your API key was reported as leaked. Please use another API key.`[^1]

That is the strongest official confirmation that this is a real security-control path, not a random transient failure.[^1]

### 2) Google now treats Gemini keys as sensitive credentials

Google’s Gemini API key page says to treat a Gemini API key like a password, warns that compromise can consume quota, incur charges, and expose private data such as files, and lays down two critical rules:

- never commit API keys to source control; and
- never expose API keys on the client side in production web or mobile apps.[^2]

It also says the most secure pattern is server-side Gemini calls, and that direct client-side usage should use ephemeral tokens **only for the Live API**.[^2][^7]

### 3) Google is changing defaults for new AI Studio keys

Google says it is “moving towards issuing API keys when you request a new key using Google AI Studio that will by default be limited to only Google AI Studio and not accept keys from other services.”[^1] That is a direct response to the cross-service exposure problem and means newly issued keys are being tightened compared with older key behavior.[^1]

### 4) Google expects you to use restrictions

Google Cloud’s API key docs recommend adding both:

- client/application restrictions (browser referrers, server IPs, Android packages, iOS bundle IDs), and
- API restrictions (limit a key to only the APIs/services it needs).[^8][^9]

The Gemini API key page specifically notes that AI Studio shows keys that are unrestricted or restricted to the Generative Language API, and points users to Cloud Console to restrict a key to the Generative Language API.[^2]

## Why this suddenly feels worse than before

### Historical behavior made public Google API keys common

Google’s own ecosystem trained developers into patterns that made public `AIza...` keys normal in some contexts:

- Firebase documentation says Firebase service API keys are not secret, provided they are restricted to Firebase-related APIs, and explicitly distinguishes those from sensitive server keys or service account keys.[^3]
- Maps JavaScript documentation shows a browser `<script>` tag with `key=API_KEY` in the page source, while also warning developers to restrict the key before production use and reminding them that abuse of unrestricted keys is billable to them.[^4]

That historical split matters because many teams already had public API keys in frontend code, docs, demos, Git history, or public repos before Gemini became part of the picture.[^3][^4][^5]

### Research outside Google supports the “old public keys became dangerous” explanation

Truffle Security documented a large-scale review finding thousands of publicly exposed Google API keys that could access Gemini once the Generative Language API was enabled in the same project, and reported that Google later expanded leaked-key blocking and planned default-scope changes in response.[^5] That research is not official policy, but it lines up closely with the language Google now uses in its own troubleshooting page.[^1][^5]

## What is likely true, but should be phrased carefully

### “Google aggressively disables Gemini keys if there is any sign they were public—ever”

**Too strong as written.**

What is supported:
- Google blocks **known leaked keys** from Gemini.[^1]
- Google is defaulting toward blocking leaked keys used with Gemini.[^1]
- Google plans to show key status in AI Studio and communicate proactively when it identifies leaked keys.[^1]

What is **not** supported by the docs I found:
- a guarantee that any key that was ever exposed, even briefly or historically, will always be disabled forever; or
- a formal statement that all public exposure is detected instantly or irreversibly.[^1][^2]

A better phrasing is:

> Google now appears to treat leaked or publicly exposed Gemini-capable keys much more aggressively than before. If Google identifies your key as leaked, it may block that key from Gemini and require you to generate a new one.[^1]

### “Especially common if the key touched frontend code”

**Plausible and strongly supported by current guidance, though not stated in exactly those words.**

Google now explicitly says not to use Gemini API keys directly in production web or mobile apps because client-side keys can be extracted.[^2] Since browser/mobile distribution is by definition easier to inspect or scrape, frontend exposure is a very credible cause of leak detection and blocking.[^2]

### “Especially common if the project had old public API keys”

**Strongly plausible and supported by the combination of historical docs plus current fixups.**

Firebase and Maps both normalized some public API key usage patterns in the past, and Google’s current troubleshooting page is clearly reacting to a vulnerability involving publicly exposed keys.[^1][^3][^4] Truffle’s research directly argues that older public keys became newly risky once Gemini access overlapped with them.[^5]

### “Especially common if Gemini Image or Embeddings are used”

**Weakly supported / mostly anecdotal.**

I found a Google AI forum thread where one user specifically reported the leaked-key error while using `gemini-embedding-001`, but that is a community report rather than official product documentation.[^6] I did not find an official Google statement that image generation or embeddings are separate triggers for leak detection.[^1][^2]

## What to do right now

### Immediate remediation

1. **Delete or revoke the blocked/leaked key.** Do not try to “recover” it; Google’s docs say leaked keys can no longer be used with Gemini.[^1]
2. **Create a fresh key in Google AI Studio.** Google explicitly recommends generating new keys there for Gemini integrations.[^1][^2]
3. **Move the key fully off the client side.** For normal Gemini API usage, call Gemini from your backend. Do not ship the long-lived key in browser or mobile code.[^2]
4. **Use a separate key just for Gemini.** Firebase explicitly says to use a separate key for Gemini Developer API instead of reusing broader Firebase-oriented keys.[^3]
5. **Restrict the new key.** Add both API restrictions and application restrictions wherever possible.[^8][^9]
6. **Purge old copies everywhere.** Remove the old key from `.env` files, CI/CD secrets, deployment systems, local shells, browser bundles, server logs, notebooks, examples, screenshots, and Git history if it ever landed there.[^2][^10]
7. **Restart anything that may still be sending the old key.** Google forum replies note that stale environment variables or background processes can keep re-triggering the problem even after rotation; this is anecdotal, but operationally sensible.[^6]
8. **Check AI Studio for key status and test only with the new key.** Google says AI Studio will show blocked-key status and is the management surface for Gemini keys.[^1][^2]
9. **Audit for unexpected spend or abuse.** Google says compromised Gemini keys can incur charges, and its troubleshooting page points users with unexpected charges to billing support.[^1][^2]

### If you need client-side access

For normal `generateContent`, embeddings, and similar calls, Google’s current guidance is effectively: **don’t put the long-lived Gemini key in the client**.[^2]

If you specifically need direct browser/device access for the **Live API**, use **ephemeral tokens** instead of a long-lived API key. Google says ephemeral tokens are designed for direct client connections, expire quickly, and reduce security risk, but they currently apply only to the Live API path.[^2][^7]

## Recommended architecture going forward

### Best-practice pattern

```text
Browser / Mobile App
        |
        |  Authenticated app request
        v
Your backend / API gateway
        |
        |  Uses Gemini key from secret manager / env var
        v
Gemini API
```

This is the pattern Google itself recommends for secure Gemini key use.[^2]

### Avoid this pattern in production

```text
Browser / Mobile App
        |
        |  Ships long-lived GEMINI_API_KEY in JS bundle / app binary
        v
Gemini API
```

Google now explicitly warns against this for production web/mobile clients because the key can be extracted.[^2]

## Bottom line

Your statement is mostly right in spirit:

- Google **is** now more aggressive about leaked Gemini-capable API keys.[^1]
- Old assumptions that some Google API keys were harmless in public code are no longer safe enough for Gemini-related usage.[^1][^3][^4][^5]
- Frontend exposure is now directly contrary to Google’s current Gemini guidance.[^2]

But the precise, well-supported version is:

> Google has identified a vulnerability involving publicly exposed API keys and now proactively blocks known leaked keys from accessing Gemini. If your key was ever pushed into client-side code, a public repo, or any other publicly reachable surface and Google classifies it as leaked, that key may be disabled for Gemini and must be rotated.[^1][^2]

I would **not** present “images/embeddings specifically trigger it” as established fact. Treat that as anecdotal until Google documents it directly.[^1][^2][^6]

## Confidence Assessment

**High confidence**
- Google officially blocks known leaked keys from Gemini and documents the exact leaked-key error.[^1]
- Google officially says Gemini API keys must not be committed to source control or exposed client-side in production.[^2]
- Google officially recommends API restrictions, application restrictions, separate keys, and server-side usage for secure handling.[^2][^8][^9]
- Historical Google/Firebase/Maps guidance helps explain why older public keys exist.[^3][^4]

**Medium confidence**
- Older public keys in projects that later enabled Gemini are a major reason people are encountering this now; this is strongly supported by independent research and consistent with Google’s remediation language, but Google’s public docs do not narrate the full history in detail.[^1][^5]

**Low confidence / anecdotal only**
- The idea that image or embedding usage is a special trigger. I found anecdotal evidence for embeddings in the forum, but not an official Google statement that these models are uniquely targeted.[^6]

## Footnotes

[^1]: Google AI for Developers, “Troubleshooting guide | Gemini API,” section “Blocked or non-working API keys,” including “Understand why keys are blocked,” “Action for blocked API keys,” and “Google's security measures for leaked keys.” https://ai.google.dev/gemini-api/docs/troubleshooting (retrieved 2026-03-25).
[^2]: Google AI for Developers, “Using Gemini API keys,” especially “Keep your API key secure,” “Critical security rules,” and “Best practices.” https://ai.google.dev/gemini-api/docs/api-key (last updated 2026-03-23 UTC; retrieved 2026-03-25).
[^3]: Firebase, “Security checklist,” section “Understand API keys,” especially “API keys for Firebase services are not secret” and “use a separate API key” for Gemini Developer API. https://firebase.google.com/support/guides/security-checklist (retrieved 2026-03-25).
[^4]: Google Maps Platform, “Set up the Maps JavaScript API,” sections “Make an API request” and “Apply API key restrictions,” including the HTML example with `key=API_KEY` and the warning that abuse of unrestricted keys is billable. https://developers.google.com/maps/documentation/javascript/get-api-key?setupProd=configure (last updated 2026-03-24 UTC; retrieved 2026-03-25).
[^5]: Truffle Security, “Google API Keys Weren't Secrets. But then Gemini Changed the Rules,” documenting retroactive Gemini exposure risk, public-key discovery, and Google’s remediation timeline. https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules (retrieved 2026-03-25).
[^6]: Google AI Developers Forum, thread “API key is leaked,” including a user report of the leaked-key error for `gemini-embedding-001`. https://discuss.ai.google.dev/t/api-key-is-leaked/109110 (retrieved 2026-03-25).
[^7]: Google AI for Developers, “Ephemeral tokens,” describing short-lived tokens for direct client-side access to the Live API and explicitly positioning them as safer than long-lived client-side API keys. https://ai.google.dev/gemini-api/docs/ephemeral-tokens (last updated 2026-03-09 UTC; retrieved 2026-03-25).
[^8]: Google Cloud, “API keys,” overview and creation guidance, including recommendation to add API key restrictions and explanation that unrestricted standard keys can be used with any API that accepts them unless restricted. https://cloud.google.com/docs/authentication/api-keys (retrieved 2026-03-25).
[^9]: Google Cloud, “Adding restrictions to API keys,” including browser/server/mobile restrictions and recommendation to apply both client and API restrictions. https://cloud.google.com/api-keys/docs/add-restrictions-api-keys (last updated 2026-03-16 UTC; retrieved 2026-03-25).
[^10]: Google Help, “Best practices for securely using API keys,” including guidance not to embed keys in code, not to keep them in source trees, and to rotate/delete unused keys. https://support.google.com/googleapi/answer/6310037 (retrieved 2026-03-25).
