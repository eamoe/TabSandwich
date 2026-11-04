/**
 * The feedback form (Google Forms): one free-text box, for a better word in any language or an
 * idea, and one this link fills in with Chrome's language and Tab Sandwich's version, so a note
 * about a word says which dictionary it's about. Nothing goes anywhere until the person opens the
 * form and sends it themselves; what's filled in shows on the form and can be changed.
 */
const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdM7DP88IJXLBv0JBhm13oeMTt3_75SdDT6RBob6sVzLWV1UQ/viewform";
/** The form's "Language and version" box. */
const LANGUAGE_AND_VERSION = "entry.1844963166";

export function feedbackUrl(language: string, version: string): string {
    const url = new URL(FORM);
    url.searchParams.set("usp", "pp_url");
    url.searchParams.set(LANGUAGE_AND_VERSION, `${language} · ${version}`);
    return url.toString();
}
