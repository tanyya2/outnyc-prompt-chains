// A script the browser runs while reading the HTML, before React starts. On the
// client React would warn about rendering a <script>, so there it's inert text
// (from the Next.js guide "Preventing flash before hydration").
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
