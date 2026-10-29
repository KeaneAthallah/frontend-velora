import { redirect } from "next/navigation";

// Overview lives at "/" (the nav's Overview item and defaultRoute both use it).
// Keep /dashboard as a stable alias for deep links such as the landing demo.
export default function Page() {
  redirect("/");
}
