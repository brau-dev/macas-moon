"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { languageOptions, useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import { domes } from "@/data/domes";

function scrollToHash(hash: `#${string}`) {
  const target = document.getElementById(hash.slice(1));
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", hash);
  return true;
}

function HashLink({
  hash,
  className,
  children,
  onClick,
  ariaLabel,
  role,
}: {
  hash: `#${string}`;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  role?: string;
}) {
  return (
    <Link
      href={`/${hash}`}
      scroll={false}
      className={className}
      aria-label={ariaLabel}
      role={role}
      onClick={(event) => {
        if (scrollToHash(hash)) {
          event.preventDefault();
          onClick?.();
          return;
        }
        window.setTimeout(() => onClick?.(), 0);
      }}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [domesOpen, setDomesOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [activePath, setActivePath] = useState(pathname);
  const moreMenuId = useId();
  const domesMenuId = useId();
  const langMenuId = useId();
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const domesWrapRef = useRef<HTMLDivElement>(null);
  const langWrapRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";
  const domeMatch = pathname.match(/^\/domos\/([^/]+)/);
  const isDomePage = Boolean(domeMatch);
  const isReservarPage = pathname === "/reservar";
  const overlay = isHome || isDomePage;
  const solid = !overlay || scrolled || mobileOpen;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (activePath !== pathname) {
    setActivePath(pathname);
    setMobileOpen(false);
    setMoreOpen(false);
    setDomesOpen(false);
    setLangOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    document.body.classList.toggle("nav-mobile-open", mobileOpen);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("nav-mobile-open");
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (pathname !== "/") return;
    const hash = window.location.hash as `#${string}` | "";
    if (!hash) return;
    const timer = window.setTimeout(() => {
      scrollToHash(hash);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (!mobileOpen && moreWrapRef.current && !moreWrapRef.current.contains(target)) {
        setMoreOpen(false);
      }
      if (!mobileOpen && domesWrapRef.current && !domesWrapRef.current.contains(target)) {
        setDomesOpen(false);
      }
      if (langWrapRef.current && !langWrapRef.current.contains(target)) {
        setLangOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setDomesOpen(false);
        setLangOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const linkClass = cn(
    "nav-underline inline-flex min-h-11 items-center pb-0.5 text-[0.9rem] font-medium tracking-[0.04em] transition-colors duration-300",
    solid ? "text-ink" : "text-warm-white",
  );

  const dropdownClass = cn("nav-dropdown", solid && "nav-dropdown-solid");
  const dropdownItemClass = "nav-subitem";
  const accordionClass = "nav-accordion";

  const langButtonClass = cn(
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium tracking-[0.04em] transition-colors duration-200",
    solid
      ? "border-border bg-transparent text-ink hover:bg-sand-100"
      : "border-white/35 bg-white/10 text-warm-white hover:bg-white/18",
  );

  const cta = {
    href: domeMatch ? `/reservar?domo=${domeMatch[1]}` : "/reservar",
    label: isDomePage ? "Reservar este domo" : "Reserva ahora",
  };

  function closeMenus() {
    setMoreOpen(false);
    setDomesOpen(false);
    setLangOpen(false);
    setMobileOpen(false);
  }

  const domeItems = (
    <>
      <HashLink hash="#domos" role="menuitem" className={dropdownItemClass} onClick={closeMenus}>
        {t("Comparar domos")}
      </HashLink>
      {domes.map((dome) => (
        <Link
          key={dome.slug}
          href={`/domos/${dome.slug}`}
          role="menuitem"
          className={dropdownItemClass}
          onClick={() => window.setTimeout(closeMenus, 0)}
        >
          {t(dome.category === "ESCAPADA PARA DOS" ? "Domo 2 · Romántico" : "Domo 1 · Amplio")}
        </Link>
      ))}
    </>
  );

  const moreItems = (
    <>
      <HashLink hash="#experiencias" role="menuitem" className={dropdownItemClass} onClick={closeMenus}>
        {t("Experiencias")}
      </HashLink>
      <HashLink hash="#servicios" role="menuitem" className={dropdownItemClass} onClick={closeMenus}>
        {t("Servicios")}
      </HashLink>
      <HashLink hash="#resenas" role="menuitem" className={dropdownItemClass} onClick={closeMenus}>
        {t("Reseñas")}
      </HashLink>
      <HashLink hash="#ubicacion" role="menuitem" className={dropdownItemClass} onClick={closeMenus}>
        {t("Ubicación")}
      </HashLink>
      <HashLink hash="#faq" role="menuitem" className={dropdownItemClass} onClick={closeMenus}>
        {t("FAQ")}
      </HashLink>
    </>
  );

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300",
          solid
            ? "bg-sand-50/94 shadow-[0_8px_24px_rgba(36,39,32,0.04)] backdrop-blur-[6px]"
            : "bg-transparent",
        )}
      >
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-warm-white focus:px-4 focus:py-2"
        >
          {t("Saltar al contenido")}
        </a>
        <Container className="flex h-[var(--header-h)] items-center justify-between gap-3">
          <HashLink
            hash="#inicio"
            className="relative flex shrink-0 items-center"
            ariaLabel={`${site.name}, ${t("ir al inicio")}`}
            onClick={closeMenus}
          >
            <Image
              src={solid ? site.logo : site.logoLight}
              alt={site.name}
              width={148}
              height={48}
              className={cn(
                "h-9 w-auto object-contain sm:h-10 lg:h-11",
                !solid && "hero-logo-light",
              )}
            />
          </HashLink>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-6 lg:flex xl:gap-8"
            aria-label={t("Principal")}
          >
            <HashLink hash="#inicio" className={linkClass} onClick={closeMenus}>
              {t("Inicio")}
            </HashLink>
            <div className="relative" ref={domesWrapRef}>
              <button
                type="button"
                className={cn(linkClass, "nav-trigger gap-1")}
                aria-expanded={domesOpen}
                aria-controls={domesMenuId}
                aria-haspopup="menu"
                onClick={() => {
                  setDomesOpen((open) => !open);
                  setMoreOpen(false);
                  setLangOpen(false);
                }}
              >
                {t("Domos")}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", domesOpen && "rotate-180")} />
              </button>
              {domesOpen ? (
                <div id={domesMenuId} role="menu" className={dropdownClass}>
                  {domeItems}
                </div>
              ) : null}
            </div>
            <Link href="/nosotros" className={linkClass}>
              {t("Nosotros")}
            </Link>
            <Link href="/galeria" className={linkClass}>
              {t("Galería")}
            </Link>
            <div className="relative" ref={moreWrapRef}>
              <button
                type="button"
                className={cn(linkClass, "nav-trigger gap-1")}
                aria-expanded={moreOpen}
                aria-controls={moreMenuId}
                aria-haspopup="menu"
                onClick={() => {
                  setMoreOpen((open) => !open);
                  setDomesOpen(false);
                  setLangOpen(false);
                }}
              >
                {t("Más")}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", moreOpen && "rotate-180")} />
              </button>
              {moreOpen ? (
                <div id={moreMenuId} role="menu" className={dropdownClass}>
                  {moreItems}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="relative" ref={langWrapRef}>
              <button
                type="button"
                className={cn(langButtonClass, "nav-trigger")}
                aria-expanded={langOpen}
                aria-controls={langMenuId}
                aria-haspopup="menu"
                aria-label={t("Seleccionar idioma")}
                onClick={() => {
                  setLangOpen((open) => !open);
                  setMoreOpen(false);
                  setDomesOpen(false);
                }}
              >
                <Globe className="h-4 w-4" strokeWidth={1.75} />
                <span>{language.toUpperCase()}</span>
                <ChevronDown
                  className={cn(
                    "hidden h-3.5 w-3.5 transition-transform duration-200 sm:block",
                    langOpen && "rotate-180",
                  )}
                />
              </button>
              {langOpen ? (
                <div
                  id={langMenuId}
                  role="menu"
                  className={cn(dropdownClass, "nav-dropdown-end")}
                >
                  {languageOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      role="menuitem"
                      className="nav-subitem gap-2"
                      onClick={() => {
                        setLanguage(option.code);
                        setLangOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          language === option.code ? "opacity-100" : "opacity-0",
                        )}
                        strokeWidth={2.2}
                      />
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {!isReservarPage ? (
              <div className="hidden lg:block">
                <Button href={cta.href} size="md">
                  {cta.label}
                </Button>
              </div>
            ) : null}

            <button
              type="button"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full lg:hidden",
                solid ? "text-ink hover:bg-sand-100" : "bg-warm-white/88 text-ink",
              )}
              aria-label={t(mobileOpen ? "Cerrar menú" : "Abrir menú")}
              aria-expanded={mobileOpen}
              onClick={() => {
                setMobileOpen((open) => !open);
                setLangOpen(false);
                setMoreOpen(false);
                setDomesOpen(false);
              }}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </Container>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 top-[var(--header-h)] z-[45] overflow-y-auto bg-cream lg:hidden">
          <nav
            className="flex min-h-[calc(100svh-var(--header-h))] flex-col px-5 py-8 sm:px-6 sm:py-10"
            aria-label={t("Móvil")}
          >
            <div className="flex flex-col gap-1 text-[1.45rem] leading-tight font-semibold text-ink sm:text-2xl">
              <HashLink
                hash="#inicio"
                className="flex min-h-11 items-center py-1"
                onClick={closeMenus}
              >
                {t("Inicio")}
              </HashLink>
              <div>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between py-1 text-left"
                  aria-expanded={domesOpen}
                  aria-controls={`${domesMenuId}-mobile`}
                  onClick={() => {
                    setDomesOpen((open) => !open);
                    setMoreOpen(false);
                  }}
                >
                  {t("Domos")}
                  <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", domesOpen && "rotate-180")} />
                </button>
                {domesOpen ? (
                  <div
                    id={`${domesMenuId}-mobile`}
                    className={accordionClass}
                  >
                    {domeItems}
                  </div>
                ) : null}
              </div>
              <Link href="/nosotros" className="flex min-h-11 items-center py-1" onClick={closeMenus}>
                {t("Nosotros")}
              </Link>
              <Link href="/galeria" className="flex min-h-11 items-center py-1" onClick={closeMenus}>
                {t("Galería")}
              </Link>
              <div>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between py-1 text-left"
                  aria-expanded={moreOpen}
                  aria-controls={`${moreMenuId}-mobile`}
                  onClick={() => {
                    setMoreOpen((open) => !open);
                    setDomesOpen(false);
                  }}
                >
                  {t("Más")}
                  <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", moreOpen && "rotate-180")} />
                </button>
                {moreOpen ? (
                  <div
                    id={`${moreMenuId}-mobile`}
                    className={accordionClass}
                  >
                    {moreItems}
                  </div>
                ) : null}
              </div>
            </div>
            {!isReservarPage ? (
              <div className="mt-auto pt-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
                <Button href={cta.href} size="lg" className="w-full" onClick={closeMenus}>
                  {cta.label}
                </Button>
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}
