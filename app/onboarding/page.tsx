"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Store } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui/primitives";
import { createBusiness, createOutlet } from "@/lib/api/business";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { defaultRoute } from "@/lib/navigation";

const CURRENCIES = ["IDR", "USD", "EUR", "GBP", "SGD", "MYR"];

/** Short outlet code derived from the name, e.g. "Main outlet" → "MAIN". */
function outletCodeFor(name: string) {
  const [first = ""] = name.trim().toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  return first.slice(0, 6) || "MAIN";
}

export default function OnboardingPage() {
  const { session, loading, refresh } = useAuth();
  const { has } = usePermissions();
  const { outlets, outletsChecked, outletsLoaded, refreshOutlets } = useBusiness();
  const router = useRouter();

  const [businessName, setBusinessName] = React.useState("");
  const [currency, setCurrency] = React.useState("IDR");
  const [timezone, setTimezone] = React.useState("Asia/Jakarta");
  const [outletName, setOutletName] = React.useState("Main outlet");
  const [outletCode, setOutletCode] = React.useState("MAIN");
  const [codeEdited, setCodeEdited] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Keep the business a failed attempt already created, so a retry does not
  // leave the account with two.
  const [createdBusinessId, setCreatedBusinessId] = React.useState<string | null>(null);

  const hasBusiness = Boolean(session?.business.id);
  // A business whose outlet list loaded empty needs its first outlet before the
  // app can render anything (every screen is outlet-scoped).
  const needsOutlet = hasBusiness && outletsLoaded && outlets.length === 0;
  const canManageOutlets = has("outlets.manage");

  React.useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login?next=%2Fonboarding");
      return;
    }
    if (!hasBusiness) return;
    // Nothing to decide until the outlet list settles.
    if (!outletsChecked) return;
    // Setup is done, or the list could not be read and we refuse to trap the
    // user here on a failed request.
    if (outlets.length > 0 || !outletsLoaded) router.replace(defaultRoute(has));
  }, [loading, session, hasBusiness, outletsChecked, outletsLoaded, outlets, has, router]);

  React.useEffect(() => {
    if (codeEdited) return;
    setOutletCode(outletCodeFor(outletName));
  }, [outletName, codeEdited]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    const business = businessName.trim();
    const outlet = outletName.trim();
    const code = outletCode.trim().toUpperCase();

    if (!hasBusiness && !business) {
      setError("Give your business a name.");
      return;
    }
    if (!outlet) {
      setError("Name your first outlet.");
      return;
    }
    if (!code) {
      setError("Give the outlet a short code, such as MAIN.");
      return;
    }

    setSubmitting(true);
    try {
      if (needsOutlet) {
        await createOutlet({ name: outlet, code });
        refreshOutlets();
        await refresh();
        router.replace("/");
        return;
      }

      let businessId = createdBusinessId;
      if (!businessId) {
        const created = await createBusiness({
          name: business,
          currency,
          timezone: timezone.trim() || "Asia/Jakarta",
        });
        businessId = created.id || null;
        setCreatedBusinessId(businessId);
      }
      // The tenant header comes from storage, so the outlet request needs the new id.
      if (businessId) window.localStorage.setItem("businessId", businessId);
      await createOutlet({ name: outlet, code });
      await refresh();
      router.replace("/");
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The setup could not be completed.");
    }
    setSubmitting(false);
  };

  const checking = loading || !session || (hasBusiness && !outletsChecked);

  if (checking) {
    return (
      <div className="setup" role="status" aria-label="Loading">
        <Loader2 className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const outletOnly = needsOutlet;
  const blocked = needsOutlet && !canManageOutlets;

  return (
    <div className="setup">
      <div className="setup__card">
        <Link href="/landing" className="setup__brand">
          <span className="setup__mark" aria-hidden="true">
            <Store />
          </span>
          Velora
        </Link>

        <div className="setup__head">
          <span className="eyebrow">One step left</span>
          <h1>{outletOnly ? "Add your first outlet" : "Set up your business"}</h1>
          <p>
            {outletOnly
              ? `${session.business.name} has no outlet yet. Outlets hold your floor, stock, and sales, so add one to open the workspace.`
              : "This creates your workspace and its first outlet. You will be the owner, with every permission."}
          </p>
        </div>

        {error ? (
          <Alert tone="danger" title="Could not finish setup">
            {error}
          </Alert>
        ) : null}

        {blocked ? (
          <Alert tone="info" title="An owner needs to add an outlet">
            You do not have permission to create outlets for {session.business.name}. Ask an owner
            or admin to add one, then reload this page.
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {outletOnly ? (
              <fieldset className="setup__group">
                <legend>Outlet</legend>
                <div className="grid-2">
                  <Field label="Outlet name" htmlFor="outlet-name" required>
                    <Input
                      id="outlet-name"
                      name="outlet"
                      placeholder="Main outlet"
                      value={outletName}
                      onChange={(event) => setOutletName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="Short code"
                    htmlFor="outlet-code"
                    required
                    aside={<span className="hint">Receipts</span>}
                  >
                    <Input
                      id="outlet-code"
                      name="code"
                      placeholder="MAIN"
                      value={outletCode}
                      onChange={(event) => {
                        setCodeEdited(true);
                        setOutletCode(event.target.value.toUpperCase());
                      }}
                      maxLength={12}
                      required
                    />
                  </Field>
                </div>
              </fieldset>
            ) : (
              <>
                <fieldset className="setup__group">
                  <legend>Business</legend>
                  <Field label="Business name" htmlFor="business-name" required>
                    <Input
                      id="business-name"
                      name="business"
                      autoComplete="organization"
                      placeholder="Kopi Senja"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      required
                    />
                  </Field>
                  <div className="grid-2">
                    <Field label="Currency" htmlFor="currency">
                      <Select
                        id="currency"
                        value={currency}
                        onChange={(event) => setCurrency(event.target.value)}
                      >
                        {CURRENCIES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Timezone"
                      htmlFor="timezone"
                      aside={<span className="hint">IANA name</span>}
                    >
                      <Input
                        id="timezone"
                        name="timezone"
                        placeholder="Asia/Jakarta"
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        spellCheck={false}
                      />
                    </Field>
                  </div>
                </fieldset>

                <fieldset className="setup__group">
                  <legend>First outlet</legend>
                  <div className="grid-2">
                    <Field label="Outlet name" htmlFor="outlet-name" required>
                      <Input
                        id="outlet-name"
                        name="outlet"
                        placeholder="Main outlet"
                        value={outletName}
                        onChange={(event) => setOutletName(event.target.value)}
                        required
                      />
                    </Field>
                    <Field
                      label="Short code"
                      htmlFor="outlet-code"
                      required
                      aside={<span className="hint">Receipts</span>}
                    >
                      <Input
                        id="outlet-code"
                        name="code"
                        placeholder="MAIN"
                        value={outletCode}
                        onChange={(event) => {
                          setCodeEdited(true);
                          setOutletCode(event.target.value.toUpperCase());
                        }}
                        maxLength={12}
                        required
                      />
                    </Field>
                  </div>
                </fieldset>
              </>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting
                ? "Finishing setup…"
                : outletOnly
                  ? "Add outlet"
                  : "Create workspace"}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
          </form>
        )}

        <p className="setup__foot">
          Signed in as {session.user.email}. <Link href="/login">Use another account</Link>
        </p>
      </div>
    </div>
  );
}
