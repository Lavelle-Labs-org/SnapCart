import { Mail, RefreshCw, Copy, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function MessagesLogPage() {
  const mockMessages = [
    {
      id: "msg_1",
      time: "10:45 AM",
      recipient: "09•• ••• 344",
      event: "new_order",
      status: "sent",
      network: "ethio_telecom",
      credits: 1,
      messageId: "msg_8f7b6c5d4e3f2a1b0c9a",
      canResend: false,
    },
    {
      id: "msg_2",
      time: "10:32 AM",
      recipient: "07•• ••• 766",
      event: "order_accepted",
      status: "sent",
      network: "safaricom",
      credits: 2,
      messageId: "msg_1a2b3c4d5e6f7a8b9c0d",
      canResend: false,
    },
    {
      id: "msg_3",
      time: "09:15 AM",
      recipient: "09•• ••• 882",
      event: "order_ready",
      status: "failed",
      network: "ethio_telecom",
      credits: 0,
      messageId: "None (Error 502)",
      canResend: true,
    },
    {
      id: "msg_4",
      time: "08:50 AM",
      recipient: "09•• ••• 551",
      event: "order_accepted",
      status: "skipped",
      network: "-",
      credits: 0,
      messageId: "Skipped (Buyer Opted Out)",
      canResend: false,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sent (Carrier Accepted)</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <AlertCircle className="w-3 h-3" />
            <span>Skipped</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Message Audit Log</h1>
          <p className="text-sm text-slate-500">
            Real delivery statuses, credit deduction, and message IDs from SMSHub.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Network</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">SMSHub ID</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockMessages.map((msg) => (
                <tr key={msg.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3.5 text-xs text-slate-500">{msg.time}</td>
                  <td className="px-4 py-3.5 font-mono text-xs">{msg.recipient}</td>
                  <td className="px-4 py-3.5 text-xs font-medium text-slate-800">{msg.event}</td>
                  <td className="px-4 py-3.5">{getStatusBadge(msg.status)}</td>
                  <td className="px-4 py-3.5 text-xs capitalize">{msg.network.replace("_", " ")}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">{msg.credits}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <span className="truncate max-w-[120px]">{msg.messageId}</span>
                      {msg.messageId.startsWith("msg_") && (
                        <button
                          type="button"
                          title="Copy ID"
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {msg.canResend && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md transition"
                      >
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
