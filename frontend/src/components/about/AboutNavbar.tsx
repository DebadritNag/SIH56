"use client";

/**
 * AboutNavbar — thin wrapper that renders the shared PublicNavbar with
 * active="about". Kept so existing imports from the About page still resolve,
 * but all navbar logic now lives in PublicNavbar.
 */
export { PublicNavbar as AboutNavbar } from "@/components/public/PublicNavbar";
