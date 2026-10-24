import Link from "next/link";
import { MessageSquare, ShoppingBag, ShieldCheck, ArrowRight, Smartphone, CheckCircle, Sparkles, Zap } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";

const features = [
  { icon: Smartphone, title: "Orders in the flow", text: "Share one storefront link anywhere. Customers browse and order from the phone they already use." },
  { icon: ShieldCheck, title: "Built-in trust", text: "OTP verification and pickup codes keep every handover clear, secure, and accountable." },
  { icon: CheckCircle, title: "A clear pulse", text: "See real delivery updates, order status, and message history without chasing a dashboard." },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f6f8f7] text-slate-900 dark:bg-[#07130f] dark:text-slate-100">
      <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-[#f6f8f7]/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#07130f]/80">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Order-by-SMS home">
            <span className="flex size-10 items-center justify-center rounded-[14px] bg-emerald-700 text-white shadow-[0_8px_20px_rgba(8,127,91,0.22)] dark:bg-emerald-500 dark:text-emerald-950"><MessageSquare className="size-5" /></span>
            <span className="text-[17px] font-bold tracking-[-0.03em]">Order-by-SMS</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 sm:flex dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">Seller login</Link>
            <Link href="/signup" className="flex min-h-touch items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(8,127,91,0.2)] transition hover:-translate-y-0.5 hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400">Start selling</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="pointer-events-none absolute -right-40 -top-32 size-[500px] rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10" />
          <div className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-sm dark:border-emerald-900 dark:bg-white/5 dark:text-emerald-300"><Sparkles className="size-3.5" />Commerce that starts with a text</div>
              <h1 className="max-w-2xl text-5xl font-bold leading-[1.02] tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">Your storefront, <span className="text-emerald-700 dark:text-emerald-400">in every phone.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">A simpler way for Ethiopian micro-merchants to turn conversations into orders. No app download. No account friction. Just a storefront link and SMS that keeps everyone moving.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className="flex min-h-touch items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(8,127,91,0.22)] transition hover:-translate-y-0.5 hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"><Zap className="size-4" />Launch your shop<ArrowRight className="size-4" /></Link>
                <Link href="/s/habesha-cafe" className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-emerald-700"><ShoppingBag className="size-4" />Explore a storefront</Link>
              </div>
              <p className="mt-6 text-xs font-medium text-slate-500 dark:text-slate-400">Works with SMSHub.et · Ethio Telecom · Safaricom</p>
            </div>

            <div className="relative mx-auto w-full max-w-[430px] lg:mr-0">
              <div className="absolute -inset-5 rounded-[38px] bg-emerald-500/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-emerald-900/10 bg-white p-3 shadow-[0_24px_70px_rgba(16,68,50,0.16)] dark:border-white/10 dark:bg-[#0d211a]">
                <div className="rounded-[22px] bg-[#f5faf7] p-6 dark:bg-[#102a20]">
                  <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Today</p><h2 className="mt-1 text-xl font-bold">Seller pulse</h2></div><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"><MessageSquare className="size-5" /></span></div>
                  <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-white/5"><p className="text-xs text-slate-500">Orders today</p><p className="mt-2 text-2xl font-bold">24</p><p className="mt-1 text-xs font-semibold text-emerald-600">+18.4%</p></div><div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-white/5"><p className="text-xs text-slate-500">SMS delivered</p><p className="mt-2 text-2xl font-bold">98.7%</p><p className="mt-1 text-xs font-semibold text-emerald-600">Healthy</p></div></div>
                  <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-white/5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"><ShoppingBag className="size-4" /></span><div><p className="text-sm font-bold">New order #1048</p><p className="text-xs text-slate-500">Mimi · 2 items</p></div></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">Action needed</span></div></div>
                  <div className="mt-3 rounded-2xl bg-emerald-700 p-4 text-white shadow-lg dark:bg-emerald-600"><p className="text-xs font-medium text-emerald-100">Your shop link</p><p className="mt-1 truncate text-sm font-bold">orderbysms.et/s/your-shop</p><div className="mt-4 flex items-center gap-2 text-xs text-emerald-100"><CheckCircle className="size-3.5" />Ready to share anywhere</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-emerald-950/10 bg-white/55 dark:border-white/10 dark:bg-white/[0.02]"><div className="mx-auto grid max-w-6xl gap-px px-5 py-5 sm:grid-cols-3 lg:px-8">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl px-5 py-5 sm:px-6"><Icon className="size-5 text-emerald-700 dark:text-emerald-400" /><h3 className="mt-4 text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p></article>)}</div></section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><span className="font-semibold text-slate-700 dark:text-slate-300">Order-by-SMS</span><span>Built for Ethiopian micro-merchants.</span></footer>
    </div>
  );
}
