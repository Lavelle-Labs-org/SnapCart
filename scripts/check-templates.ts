/**
 * SMS Template Verification Script (BE-002)
 *
 * Verifies that all 5 English SMS templates:
 * 1. Strictly evaluate to GSM-7 encoding (no curly quotes, emojis, or UCS-2 triggers).
 * 2. Stay within 120 characters before sender signature even under worst-case parameters.
 * 3. Fit comfortably within the 160-character single-segment GSM-7 limit including default signature.
 *
 * Usage: npm run template:check
 * References: docs/04 (Sec 2, 3), docs/05.
 */

import {
  SMS_TEMPLATES,
  detectEncoding,
  RenderTemplateOptions,
} from "../apps/api/src/modules/smshub/templates";

const DEFAULT_SIGNATURE_LENGTH = 25; // per docs/04 Section 3 (~25 chars legal name)
const SEPARATOR_LENGTH = 2; // "\n\n" between text and signature
const MAX_RAW_TEMPLATE_LENGTH = 120; // 120-char limit before signature
const MAX_GSM7_SEGMENT_LENGTH = 160; // 160-char GSM-7 ceiling

const worstCaseParams: RenderTemplateOptions = {
  shopName: "12345678901234567890", // exactly 20 characters (maximum allowed)
  orderNumber: 9999, // 4-digit order number
  itemCount: 99,
  totalBirr: 99999,
  link: "https://ord.et/x/1234567890123456789012", // 39 characters
  code: "9999", // 4-digit code
};

const templates = [
  { name: "sellerNewOrder", fn: SMS_TEMPLATES.sellerNewOrder },
  { name: "buyerAccepted", fn: SMS_TEMPLATES.buyerAccepted },
  { name: "buyerRejected", fn: SMS_TEMPLATES.buyerRejected },
  { name: "buyerReady", fn: SMS_TEMPLATES.buyerReady },
  { name: "buyerNewPickupCode", fn: SMS_TEMPLATES.buyerNewPickupCode },
];

function main() {
  console.log("=== SMSHub Template Sizing & Encoding Check (BE-002) ===");
  console.log(
    `Worst-case constraints: Shop Name = 20 chars | Order Number = 4 digits | Link = 39 chars\n`
  );

  let allPassed = true;
  const results: any[] = [];

  for (const t of templates) {
    const text = t.fn(worstCaseParams);
    const encoding = detectEncoding(text);
    const rawLength = text.length;
    const totalLengthWithSig =
      rawLength + SEPARATOR_LENGTH + DEFAULT_SIGNATURE_LENGTH;

    const passesEncoding = encoding === "GSM-7";
    const passesRawLimit = rawLength <= MAX_RAW_TEMPLATE_LENGTH;
    const passesSegmentLimit = totalLengthWithSig <= MAX_GSM7_SEGMENT_LENGTH;
    const isSuccess = passesEncoding && passesRawLimit && passesSegmentLimit;

    if (!isSuccess) {
      allPassed = false;
    }

    results.push({
      Template: t.name,
      Encoding: encoding,
      "Raw Chars (<=120)": `${rawLength} / 120`,
      "With Signature (<=160)": `${totalLengthWithSig} / 160`,
      Status: isSuccess ? "✔ PASS" : "✖ FAIL",
    });

    console.log(`[${t.name}]`);
    console.log(`  Preview: "${text}"`);
    console.log(
      `  Length: ${rawLength} chars (with signature: ${totalLengthWithSig} chars) | Encoding: ${encoding}`
    );
    if (!isSuccess) {
      console.error(
        `  ✖ FAILED: encoding=${encoding}, rawLength=${rawLength}, total=${totalLengthWithSig}`
      );
    }
    console.log();
  }

  console.table(results);

  if (allPassed) {
    console.log("🎉 ALL TEMPLATES PASSED: 100% GSM-7 and single-segment compliant.");
    process.exit(0);
  } else {
    console.error("❌ Template check failed! Review errors above.");
    process.exit(1);
  }
}

main();
