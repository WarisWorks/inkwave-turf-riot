import { Coffee, Globe, Instagram, X, Youtube } from "lucide-react";

const LINKS = [
  { href: "https://www.instagram.com/uyghurai/", label: "Instagram · @uyghurai", Icon: Instagram },
  { href: "https://x.com/uyghurai", label: "X (Twitter) · @uyghurai", Icon: X },
  { href: "https://www.youtube.com/@UyghurAI", label: "YouTube · UyghurAI", Icon: Youtube },
  { href: "https://idirak.com", label: "Idirak", Icon: Globe },
  { href: "https://ko-fi.com/uyghurAI", label: "Ko-fi · UyghurAI", Icon: Coffee },
] as const;

export function BrandFooter() {
  return (
    <footer className="brand-footer" aria-label="Idirak · UyghurAI">
      <nav className="brand-links" aria-label="ئىدراك ئۇلانمىلىرى" dir="ltr">
        {LINKS.map(({ href, label, Icon }) => (
          <a key={href} href={href} aria-label={label} title={label} target="_blank" rel="noopener noreferrer">
            <Icon className="size-5" aria-hidden="true" focusable="false" />
          </a>
        ))}
      </nav>
    </footer>
  );
}
