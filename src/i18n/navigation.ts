import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware navigation APIs (wrap next/link, next/navigation). */
export const { Link, redirect, usePathname, useRouter, getPathname, permanentRedirect } =
  createNavigation(routing);
