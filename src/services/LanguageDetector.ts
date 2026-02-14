export async function detectLanguage(
  textContent: string,
  htmlContent: string,
): Promise<string> {
  const franc = (await import("franc")).franc;
  const detected = franc(`${textContent} ${htmlContent}`, { minLength: 20 });
  if (detected === "fra") return "fr";
  if (detected === "eng") return "en";
  return "fr";
}
