import "@fontsource-variable/dancing-script";
import { requireSession } from "@/server/auth/session";
import { Hello } from "./hello";

export const metadata = { title: "Witaj" };
export const dynamic = "force-dynamic";

/** A short greeting right after logging in, then on to Kontakty. */
export default async function WelcomePage() {
  await requireSession();
  return <Hello />;
}
