import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "sub",
  "sup",
  "br",
  "hr",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "audio",
];
const ALLOWED_ATTR = ["src", "alt", "style", "class", "controls", "colspan", "rowspan"];
const FORBID_CONTENTS = ["script", "style", "iframe", "object", "embed", "noscript", "template"];

/** A local media reference is a bare file name: no scheme, no slashes. */
const LOCAL_MEDIA = /^[^\s/\\:?#]+\.[a-z0-9]{2,5}$/i;
const UNSAFE_STYLE = /url\s*\(|expression\s*\(|@import|javascript:/i;

const purifier = DOMPurify();

purifier.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName !== "img" && data.tagName !== "audio") return;
  const src = (node as Element).getAttribute?.("src") ?? "";
  if (!LOCAL_MEDIA.test(src)) node.parentNode?.removeChild(node);
});

purifier.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "style" && UNSAFE_STYLE.test(data.attrValue)) data.keepAttr = false;
});

/** Sanitizes field HTML before it is stored or rendered (docs/03-arquitetura.md › Segurança). */
export function sanitizeFieldHtml(html: string): string {
  return purifier.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_CONTENTS,
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  });
}
