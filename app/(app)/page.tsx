import OverviewPage from "./dashboard/page.client";

// Route segment configs must live in Server Component modules.
export const instant = false;

export default function Page() {
  return <OverviewPage />;
}
