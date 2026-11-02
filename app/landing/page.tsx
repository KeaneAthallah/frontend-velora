import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, ChefHat, Globe2, ShoppingCart, Users } from "lucide-react";

const features = [
  {
    title: "Fast checkout",
    body: "Ring up sales, hold tabs, take cash, QRIS or card, and split payments across guests.",
    icon: <ShoppingCart aria-hidden="true" />,
  },
  {
    title: "Kitchen and orders",
    body: "Send tickets to stations, watch timers, and move orders from new to ready.",
    icon: <ChefHat aria-hidden="true" />,
  },
  {
    title: "Stock and recipes",
    body: "Track ingredients, deduct by recipe, and get reorder suggestions before you run out.",
    icon: <Boxes aria-hidden="true" />,
  },
  {
    title: "Delivery channels",
    body: "Bring partner orders into the same queue and keep menus in sync.",
    icon: <Globe2 aria-hidden="true" />,
  },
  {
    title: "Teams and outlets",
    body: "Invite staff with roles, switch between outlets, and keep every business separate.",
    icon: <Users aria-hidden="true" />,
  },
  {
    title: "Reports that answer",
    body: "Sales by day, by product and by payment method, plus low-stock and cash-drawer views.",
    icon: <BarChart3 aria-hidden="true" />,
  },
];

const steps = [
  {
    title: "Create your business",
    body: "Name it, add your first outlet, and you are the owner with every permission.",
  },
  {
    title: "Add your menu and team",
    body: "Import products, set prices and tax, and invite staff with the right roles.",
  },
  {
    title: "Open the register",
    body: "Start a shift, take the first order, and watch the Overview fill in.",
  },
];

export default function LandingPage() {
  const bars = [30, 55, 42, 75, 100, 80, 50, 38];

  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-wrap">
          <nav className="lp-nav" aria-label="Main">
            <Link href="/landing" className="lp-brand">
              <span className="lp-brand__mark" aria-hidden="true">
                V
              </span>
              Velora
            </Link>
            <span className="lp-nav__spacer" />
            <a href="#features">Features</a>
            <Link href="/pricing">Pricing</Link>
            <a href="#start">How it works</a>
            <Link href="/login" className="lp-nav__signin">
              Sign in
            </Link>
          </nav>

          <div className="lp-hero__grid">
            <div className="lp-hero__copy">
              <span className="lp-eyebrow">Point of sale &amp; retail operations</span>
              <h1>Run every outlet from one counter.</h1>
              <p>
                Sales, kitchen, stock and delivery channels in a single workspace, built for cafés,
                restaurants and retail shops.
              </p>
              <div className="lp-cta">
                <Link href="/register" className="lp-btn lp-btn--primary">
                  Get started
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link href="/login" className="lp-btn lp-btn--ghost">
                  View demo
                </Link>
              </div>
              <div className="lp-note">Multiple outlets · Role-based access · Split payments</div>
            </div>

            <div className="lp-preview" aria-hidden="true">
              <div className="lp-preview__head">
                <span>Today · Main outlet</span>
                <span className="badge badge--success">● Online</span>
              </div>
              <div className="lp-preview__stats">
                <div className="lp-preview__stat">
                  <span>Sales</span>
                  <b>Rp 4.820.000</b>
                </div>
                <div className="lp-preview__stat">
                  <span>Orders</span>
                  <b>86</b>
                </div>
              </div>
              <div className="lp-bars">
                {bars.map((height, index) => (
                  <i
                    key={index}
                    style={{ height: `${height}%` }}
                    data-peak={height === 100 ? "true" : undefined}
                  />
                ))}
              </div>
              <div className="lp-preview__line">
                <span>
                  <b>Flat white ×2</b> · Table 4
                </span>
                <span className="lp-pill-warn">Preparing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-wrap">
          <h2>Everything the counter needs</h2>
          <p className="lp-lede">One system for the floor, the kitchen and the back office.</p>
          <div className="lp-features">
            {features.map((feature) => (
              <article className="lp-card" key={feature.title}>
                <span className="lp-card__icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="lp-section lp-section--raised">
        <div className="lp-wrap">
          <h2>Up and selling in three steps</h2>
          <div className="lp-steps">
            {steps.map((step, index) => (
              <div className="lp-step" key={step.title}>
                <span className="lp-step__number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-band">
            <div>
              <div className="lp-band__title">Ready to open your first outlet?</div>
              <div className="lp-band__sub">Create a business and start selling today.</div>
            </div>
            <div className="lp-cta">
              <Link href="/register" className="lp-btn lp-btn--white">
                Get started
              </Link>
              <Link href="/login" className="lp-btn lp-btn--ghost">
                View demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <b>Velora</b>
          <span>
            <Link href="/login">Sign in</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/forgot-password">Forgot password</Link>
            <span aria-hidden="true"> · </span>© 2026 Velora
          </span>
        </div>
      </footer>
    </div>
  );
}
