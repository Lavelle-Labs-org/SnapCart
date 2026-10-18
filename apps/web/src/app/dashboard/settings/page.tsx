import { Copy, ExternalLink, MessageSquare, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const shopSlug = "habesha-cafe";
  const storefrontUrl = `https://ord.et/s/${shopSlug}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shop Settings</h1>
        <p className="text-sm text-slate-500">Configure your storefront link and SMS notification parameters.</p>
      </div>

      {/* Shareable Storefront Link */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Storefront Link</h2>
        <p className="text-xs text-slate-500">
          Paste this link into your Telegram channel, Instagram bio, or TikTok profile.
        </p>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={storefrontUrl}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-700"
          />
          <button
            type="button"
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition"
          >
            <Copy className="w-4 h-4" />
            <span>Copy</span>
          </button>
          <a
            href={`/s/${shopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* SMS Sender Details */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">SMS Branding</h2>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            SMS Sender Name (Max 20 chars)
          </label>
          <input
            type="text"
            maxLength={20}
            defaultValue="Habesha Cafe"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-600 block">Preview of Outgoing Buyer SMS:</span>
          <p className="text-xs font-mono bg-white p-3 rounded border border-slate-200 text-slate-800">
            Habesha Cafe: order #1043 accepted. We will text when ready. Stop texts: https://ord.et/x/Z7y1...
          </p>
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <span>Encoding: GSM-7</span>
            <span>Length: 95 / 160 characters</span>
          </div>
        </div>

        <button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl transition text-sm shadow-sm"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
