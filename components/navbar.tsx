"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import ThemeSwitcher from "@/components/theme-switcher";
import { supabase } from "@/lib/supabaseClient";
import { HamburgerMenuIcon, Cross1Icon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";

export default function NavBar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onHome = pathname === "/";

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-background/50 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Mobile left */}
          <div className="flex sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen((s) => !s)}
              className="relative rounded-xl"
            >
              <motion.div
                animate={{ rotate: isMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {isMenuOpen ? <Cross1Icon /> : <HamburgerMenuIcon />}
              </motion.div>
            </Button>
          </div>

          {/* Brand */}
          <Link href="/" className="font-light tracking-tighter text-xl sm:text-2xl">
            FlashForge
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            {onHome && (
              <>
                <Button asChild variant="ghost" size="sm" className="rounded-xl">
                  <Link href="#pricing">Pricing</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="rounded-xl">
                  <Link href="#testimonials">Testimonials</Link>
                </Button>
              </>
            )}
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href={authed ? "/dashboard" : "/login"}>
                {authed ? "Dashboard" : "Sign in"}
              </Link>
            </Button>
            {!authed && (
              <Button asChild size="sm" className="rounded-xl">
                <Link href="/signup">Get started</Link>
              </Button>
            )}
            <ThemeSwitcher />
          </div>

          {/* Mobile right */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeSwitcher />
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="sm:hidden overflow-hidden"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                {onHome && (
                  <>
                    <Link
                      href="#pricing"
                      className="block px-3 py-2 text-base font-medium text-foreground hover:bg-muted rounded-xl"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Pricing
                    </Link>
                    <Link
                      href="#testimonials"
                      className="block px-3 py-2 text-base font-medium text-foreground hover:bg-muted rounded-xl"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Testimonials
                    </Link>
                  </>
                )}
                <Link
                  href={authed ? "/dashboard" : "/login"}
                  className="block px-3 py-2 text-base font-medium text-foreground hover:bg-muted rounded-xl"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {authed ? "Dashboard" : "Sign in"}
                </Link>
                {!authed && (
                  <Link
                    href="/signup"
                    className="block px-3 py-2 text-base font-medium text-foreground hover:bg-muted rounded-xl"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get started
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
