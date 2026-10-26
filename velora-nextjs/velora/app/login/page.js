import Image from "next/image";
import Link from "next/link";
export default function Login() {
  return (
    <div className="login">
      <div className="hero"><Image src="/brand/velora_brand_hero_banner.png" alt="Velora dashboard on laptop and phone" width={1010} height={483} priority /></div>
      <form className="card cb lf" action="/">
        <Image src="/brand/velora_primary_logo.png" alt="Velora" width={180} height={63} />
        <h1>Sign in</h1>
        <label className="field"><span>Email</span><input type="email" required autoComplete="email" /></label>
        <label className="field"><span>Password</span><input type="password" required autoComplete="current-password" /></label>
        <button className="btn primary block">Sign in</button>
        <Link href="/" className="link">Forgot your password?</Link>
      </form>
    </div>
  );
}
