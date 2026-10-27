import PageClient from "./page.client";

// Route segment configs must live in Server Component modules.
export const instant = false;

export default function Page() {
  return <PageClient />;
}
