import React from "react";
import Link from "next/link";
import { CheckCircle2, Home, MessageSquare, Store } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { isDemoStore } from "../../../../lib/demo-store";
import { LanguageToggle } from "../../../../components/language-toggle";
import { ThemeToggle } from "../../../../components/theme-toggle";

interface DonePageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    orderId?: string;
    orderNumber?: string;
    consent?: string;
    smsConsent?: string;
    demo?: string;
  }>;
}

export default async function DonePage({ params, searchParams }: DonePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const queryOrderId = resolvedSearchParams?.orderId;
  const queryOrderNumber = resolvedSearchParams?.orderNumber;
  const queryConsent = resolvedSearchParams?.consent ?? resolvedSearchParams?.smsConsent;

  // Pure demo store confirmation: zero database query needed
  let orderData: {
    number: number;
    smsConsent: boolean;
    shopName?: string;
  } | null = null;

  if (isDemoStore(slug) && (queryOrderId === "demo-ord-1001" || resolvedSearchParams?.demo === "true" || !queryOrderId)) {
    orderData = {
      number: queryOrderNumber ? parseInt(String(queryOrderNumber).replace(/^#/, ""), 10) || 1001 : 1001,
      smsConsent: queryConsent === "true" || queryConsent === "1",
      shopName: "Habesha Cafe & Bakery",
    };
  } else if (queryOrderId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: String(queryOrderId) },
        select: {
          number: true,
          sms_consent: true,
          seller: {
            select: {
              sms_name: true,
              business_name: true,
            },
          },
        },
      });

      if (order) {
        orderData = {
          number: order.number,
          smsConsent: order.sms_consent,
          shopName: order.seller?.sms_name || order.seller?.business_name,
        };
      }
    } catch {
      // Fallback gracefully on query error or mock-less environment
    }
  }

  // 2. Fetch seller details if shopName was not found via order
  let shopName = orderData?.shopName;
  if (!shopName && isDemoStore(slug)) {
    shopName = "Habesha Cafe & Bakery";
  } else if (!shopName && slug) {
    try {
      const seller = await prisma.seller.findUnique({
        where: { slug },
        select: {
          sms_name: true,
          business_name: true,
        },
      });
      if (seller) {
        shopName = seller.sms_name || seller.business_name;
      }
    } catch {
      // Fallback gracefully
    }
  }

  // 3. Determine assigned order number
  const rawOrderNumber =
    orderData?.number ??
    (queryOrderNumber ? String(queryOrderNumber).replace(/^#/, "") : 1001);
  const displayOrderNumber = String(rawOrderNumber);

  // 4. Determine buyer SMS consent state
  const hasConsented: boolean =
    orderData?.smsConsent !== undefined
      ? orderData.smsConsent
      : queryConsent !== undefined
      ? queryConsent === "true" || queryConsent === "1"
      : true;

  // 5. Determine locale from cookies if available
  let isAmharic = false;
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    isAmharic = cookieStore.get("obs_locale")?.value === "am";
  } catch {
    // Outside request context
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200 dark:border-slate-800 p-6 text-center transition-colors duration-200">
      <div className="w-full flex justify-end items-center gap-2 pb-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isAmharic ? "ትዕዛዝዎ በቅጽበት ተመዝግቧል!" : "Order Placed in a Snap!"}
          </h1>
          {shopName && (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{`at ${shopName}`}</p>
          )}
        </div>

        <div
          data-testid="order-number"
          className="inline-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs px-5 py-2 rounded-full text-base font-bold text-slate-900 dark:text-slate-100 tracking-wide tabular-nums"
        >
          {`Order #${displayOrderNumber}`}
        </div>

        {hasConsented ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
              {isAmharic
                ? "ሻጩ በኤስኤምኤስ ተነግሮታል። ትዕዛዝዎ ተቀባይነት ሲያገኝና ለመረከብ ዝግጁ ሲሆን የጽሑፍ መልዕክት ይደርስዎታል።"
                : "The seller has been notified via SMS. You will receive text updates when your order is accepted and ready for pickup."}
            </p>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-xs text-emerald-800 dark:text-emerald-200 text-left flex items-start space-x-3 w-full mt-4">
              <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">
                  {isAmharic ? "የመቀበያ ኮድ በኤስኤምኤስ:" : "Pickup Code via SMS:"}
                </span>
                {isAmharic
                  ? "ሻጩ ትዕዛዙ ዝግጁ መሆኑን ሲያመለክት፣ በርክክብ ወቅት የሚያሳዩት ባለ 4 ዲጂት ኮድ ይደርስዎታል።"
                  : "When the seller marks this order ready, you will receive a 4-digit code to present at handover."}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
              {isAmharic
                ? "ሻጩ ተነግሮታል። ከኤስኤምኤስ ማሳወቂያዎች ስለወጡ የጽሑፍ መልዕክቶች አይላኩም።"
                : "The seller has been notified. You opted out of SMS updates, so text notifications are turned off."}
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-200 text-left flex items-start space-x-3 w-full mt-4">
              <Store className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">
                  {isAmharic ? "ከሻጩ ጋር ያረጋግጡ:" : "Check with Seller:"}
                </span>
                {isAmharic
                  ? "ከኤስኤምኤስ ማሳወቂያ ስለወጡ፣ እባክዎ በቀጥታ ከሻጩ ጋር ያረጋግጡ ወይም የትዕዛዝ ቁጥርዎን በመደብሩ ያሳዩ።"
                  : "Since you opted out of SMS updates, please check with the seller directly or present your order number at the counter for status and pickup."}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pt-6 space-y-3">
        <Link
          href={`/s/${slug}`}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-3 rounded-xl transition shadow-xs min-h-[48px]"
        >
          <Home className="w-4 h-4" />
          <span>{isAmharic ? "ወደ መደብሩ ተመለስ" : "Back to Storefront"}</span>
        </Link>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          {isAmharic ? "በSnapcart የተጎላበተ • በቅጽበት ይዘዙ" : "Powered by Snapcart • Order in a snap."}
        </p>
      </div>
    </div>
  );
}
