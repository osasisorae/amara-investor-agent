import { MINIMUM_HOLD_YEARS, MINIMUM_TICKET_NGN } from '@/lib/agent/qualification';
import {
  getKycPaymentMethodLabel,
  getKycSourceOfFundsLabel,
  isKycPaymentMethod,
  isKycSourceOfFundsType,
} from '@/lib/kyc/requirements';

export const FUTUREX_LEGAL_NAME = 'FutureX Nexus Development Limited';
export const FUTUREX_SHORT_NAME = 'FutureX';
export const FUTUREX_RC_NUMBER = '9292629';
export const FUTUREX_TAX_ID = '2620309957226';
export const FUTUREX_REGISTERED_ADDRESS =
  'B.G Bassey Avenue Ewet Housing Estate, Close to Signature Hotel, G32, Uyo, Akwa Ibom State, Nigeria';

export const VEHICLE_NAME = 'Akwa Ibom Hospitality Vehicle';
export const SPV_NAME = 'Akwa Ibom Hospitality SPV';
export const SPV_CODE = 'AIHV';
export const TARGET_CORRIDOR = 'Ewet Housing Estate, Uyo, Akwa Ibom State';
export const TARGET_RETURN = '18% annual appreciation target';
export const EXIT_STRATEGY = 'Sale or refinance at the end of the hold period';
export const AGREEMENT_VERSION = 'FutureX-AIHV-Master-Investment-v2.0';

export const TARGET_RAISE_NGN = 380_000_000;
export const TARGET_UNIT_COUNT = TARGET_RAISE_NGN / MINIMUM_TICKET_NGN;
export const SPONSOR_FEE_PERCENT = 5;
export const INVESTOR_OPERATING_PROFIT_SHARE_PERCENT = 70;
export const FUTUREX_OPERATING_PROFIT_SHARE_PERCENT = 30;
export const LONG_STOP_DAYS = 180;

export const DEAL_ROOM_FACTS = [
  { label: 'Vehicle', value: VEHICLE_NAME },
  { label: 'SPV name', value: SPV_NAME },
  { label: 'Target return', value: TARGET_RETURN },
  { label: 'Hold period', value: `${MINIMUM_HOLD_YEARS} years` },
  {
    label: 'Minimum ticket',
    value: `₦${MINIMUM_TICKET_NGN.toLocaleString('en-NG')}`,
  },
  { label: 'Exit', value: EXIT_STRATEGY },
];

export interface AgreementInvestorParty {
  email: string;
  full_name?: string;
  phone?: string;
  country?: string;
  date_of_birth?: string;
  nationality?: string;
  employer_or_business_address?: string;
  tax_identification_number?: string;
  source_of_funds_type?: string;
  source_of_funds_summary?: string;
  expected_funding_method?: string;
}

export function buildAgreementInvestorParty(params: {
  lead: {
    email: string;
    full_name?: string;
    phone?: string;
    country?: string;
  };
  answers?: Record<string, { answer?: string | null }>;
  fullNameOverride?: string;
}): AgreementInvestorParty {
  const getAnswer = (key: string) => params.answers?.[key]?.answer?.trim() || '';

  return {
    email: params.lead.email,
    full_name:
      params.fullNameOverride?.trim() ||
      getAnswer('full_legal_name') ||
      params.lead.full_name,
    phone: getAnswer('phone_number') || params.lead.phone,
    country: getAnswer('country_of_residence') || params.lead.country,
    date_of_birth: getAnswer('date_of_birth'),
    nationality: getAnswer('nationality'),
    employer_or_business_address: getAnswer('employer_or_business_address'),
    tax_identification_number: getAnswer('tax_identification_number'),
    source_of_funds_type: getAnswer('source_of_funds_type'),
    source_of_funds_summary: getAnswer('source_of_funds_summary'),
    expected_funding_method: getAnswer('expected_funding_method'),
  };
}

function formatNairaAmount(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildBulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function buildNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function present(value?: string): string {
  return value?.trim() || 'Not provided';
}

function getSourceOfFundsLabel(value?: string): string {
  if (value && isKycSourceOfFundsType(value)) {
    return getKycSourceOfFundsLabel(value);
  }

  return present(value);
}

function getFundingMethodLabel(value?: string): string {
  if (value && isKycPaymentMethod(value)) {
    return getKycPaymentMethodLabel(value);
  }

  return present(value);
}

export function getAgreementMarkdown(params: {
  lead: AgreementInvestorParty;
  commitmentLabel: string;
  slotCount: number;
  generatedAt?: number;
}): string {
  const generatedAt = params.generatedAt ?? Math.floor(Date.now() / 1000);
  const generatedDate = formatDate(generatedAt);
  const investorName = params.lead.full_name?.trim() || 'Investor';
  const investorCountry = params.lead.country?.trim();
  const investorPhone = params.lead.phone?.trim();
  const investorDateOfBirth = params.lead.date_of_birth?.trim();
  const investorNationality = params.lead.nationality?.trim();
  const investorEmployerOrBusinessAddress =
    params.lead.employer_or_business_address?.trim();
  const investorTaxId = params.lead.tax_identification_number?.trim();
  const sourceOfFundsSummary = params.lead.source_of_funds_summary?.trim();
  const sourceOfFundsLabel = getSourceOfFundsLabel(
    params.lead.source_of_funds_type
  );
  const fundingMethodLabel = getFundingMethodLabel(
    params.lead.expected_funding_method
  );

  const investmentAmountNgn = params.slotCount * MINIMUM_TICKET_NGN;
  const investorResidenceLine = investorCountry
    ? `of **${investorCountry}**`
    : 'of **[Residence to be confirmed from KYC]**';
  const investorPhoneLine = investorPhone
    ? `and phone **${investorPhone}**`
    : 'and phone **[Phone to be confirmed from KYC]**';

  return `# ${FUTUREX_SHORT_NAME} ${VEHICLE_NAME} Master Investment Agreement

**Sponsor / Manager:** ${FUTUREX_LEGAL_NAME}  
**RC Number:** ${FUTUREX_RC_NUMBER}  
**Tax ID:** ${FUTUREX_TAX_ID}  
**Registered Office:** ${FUTUREX_REGISTERED_ADDRESS}  
**Vehicle:** ${VEHICLE_NAME}  
**Target corridor:** ${TARGET_CORRIDOR}  
**Structure:** Private, SPV-backed hospitality development and operating vehicle  
**Version:** ${AGREEMENT_VERSION}  
**Generated:** ${generatedDate}

---

## IMPORTANT NOTICE

This Master Investment Agreement is the principal investor-facing legal document for the ${VEHICLE_NAME}.

It is intended to:

${buildNumberedList([
  'state the commercial terms of the vehicle',
  "govern the Investor's subscription into the relevant SPV",
  'record the Investor acknowledgments, risks, and restrictions',
  'set out the governance, reporting, distribution, and exit rules that apply to the vehicle',
])}

This is a private investment agreement. It is not a public offer, a prospectus, a guaranteed-return product, or financial advice.

Investment in this vehicle is speculative, illiquid, execution-dependent, and exposed to acquisition, construction, operating, regulatory, market, and exit risk. An Investor may lose part or all of invested capital.

Each Investor is encouraged to review this Agreement with independent legal, tax, and financial advisers before signing or paying any subscription amount.

If there is any conflict between any brochure, pitch deck, sales call, chat message, or verbal statement on the one hand, and this Agreement on the other hand, this Agreement controls.

---

## 1. PARTIES

This Agreement is made between:

### 1.1 Sponsor / Manager

**${FUTUREX_LEGAL_NAME}**  
RC ${FUTUREX_RC_NUMBER}  
Registered office: ${FUTUREX_REGISTERED_ADDRESS}  
("${FUTUREX_SHORT_NAME}", the "Sponsor", or the "Manager")

and

### 1.2 Investor

**${investorName}**  
${investorResidenceLine}  
with email **${params.lead.email}**  
${investorPhoneLine}  
("Investor")

${FUTUREX_SHORT_NAME} and the Investor are together referred to as the "Parties".

---

## 2. BACKGROUND AND PURPOSE

### 2.1 The vehicle

${FUTUREX_SHORT_NAME} is structuring a ring-fenced special purpose vehicle, being the **${SPV_NAME}**, for the ${VEHICLE_NAME}.

The SPV is intended to:

${buildBulletList([
  `acquire legal control of qualifying land in ${TARGET_CORRIDOR}, or another substantially similar prime hospitality corridor within Uyo approved under this Agreement`,
  'fund the construction, fit-out, and launch of a boutique hospitality asset comprising approximately 6 guest rooms, an indoor pool, and a curated lounge and restaurant',
  'hold the land and completed property as a ring-fenced project asset',
  'receive property-level revenue',
  'pay properly incurred project and operating costs',
  'distribute Distributable Cash to Investors in accordance with this Agreement',
  'hold, refinance, extend, or dispose of the asset in accordance with the governance rules set out in this Agreement',
])}

### 2.2 Current stage of the vehicle

At the date an Investor may sign this Agreement:

${buildBulletList([
  'the exact land parcel may not yet have been finally acquired',
  'final land title documents may still be under diligence or completion',
  'construction has not yet been completed',
  'final permits and hospitality operating licences may still be in process',
  'no Investor should assume that revenue distributions begin immediately after subscription',
])}

This Agreement therefore governs both the pre-deployment phase, where funds are raised and closing conditions are satisfied, and the post-deployment phase, where land is acquired, the asset is built, operations begin, and revenue is distributed.

### 2.3 Nature of the Investor participation

The Investor is not buying:

${buildBulletList([
  'a hotel room',
  'direct day-to-day control of the business',
  'direct legal title to any specific room or operating business',
  'a guaranteed income product',
])}

The Investor is acquiring a contractual and beneficial economic participation interest in the SPV, proportionate to the number of Investment Units subscribed for under this Agreement.

---

## 3. DEFINITIONS

In this Agreement:

${buildBulletList([
  '"Acquisition Asset" means the land and later-improved property acquired or controlled by the SPV for this vehicle.',
  '"Closing" means the point at which FutureX confirms that the conditions for deployment under this Agreement have been satisfied or waived.',
  `"Hold Period" means ${MINIMUM_HOLD_YEARS * 12} months from the Closing Date unless earlier terminated or later extended in accordance with this Agreement.`,
  '"Investment Amount" means the total naira amount subscribed by the Investor under this Agreement.',
  `"Investment Unit" or "Unit" means one subscription unit with a face subscription amount of ${formatNairaAmount(
    MINIMUM_TICKET_NGN
  )}.`,
  `"Long-Stop Date" means the date falling ${LONG_STOP_DAYS} days after the date of the first accepted subscription under this vehicle, or any later date disclosed by FutureX in writing to all subscribed Investors.`,
  '"Majority Investor Approval" means approval by Investors holding more than 50% of the issued and paid Units in the vehicle.',
  '"Supermajority Investor Approval" means approval by Investors holding at least 66 2/3% of the issued and paid Units in the vehicle.',
  `"Sponsor Fee" means the one-time ${SPONSOR_FEE_PERCENT}% syndication fee included in the vehicle budget.`,
  `"SPV Register" means the register maintained by ${FUTUREX_SHORT_NAME} or the SPV recording each Investor's subscribed and paid Units.`,
])}

---

## 4. CORE COMMERCIAL TERMS

### 4.1 Offer size

The target raise for this vehicle is **${formatNairaAmount(
    TARGET_RAISE_NGN
  )}**, represented by **${TARGET_UNIT_COUNT} Investment Units** of **${formatNairaAmount(
    MINIMUM_TICKET_NGN
  )}** each.

### 4.2 Minimum subscription

The minimum subscription is **one Investment Unit**, being **${formatNairaAmount(
    MINIMUM_TICKET_NGN
  )}**.

An Investor may subscribe for more than one Unit, subject to allocation availability and ${FUTUREX_SHORT_NAME} acceptance.

### 4.3 Use of funds

The current intended vehicle budget is:

${buildBulletList([
  `Land acquisition: ${formatNairaAmount(120_000_000)}`,
  `Construction of 6-room boutique hotel, pool, lounge, and restaurant: ${formatNairaAmount(
    200_000_000
  )}`,
  `Power infrastructure: ${formatNairaAmount(12_000_000)}`,
  `Legal, SPV setup, licensing, and compliance: ${formatNairaAmount(8_000_000)}`,
  `Stabilisation reserve: ${formatNairaAmount(15_000_000)}`,
  `Infrastructure and launch buffer: ${formatNairaAmount(6_000_000)}`,
  `${FUTUREX_SHORT_NAME} syndication fee (${SPONSOR_FEE_PERCENT}%): ${formatNairaAmount(
    19_000_000
  )}`,
  `Total target raise: ${formatNairaAmount(TARGET_RAISE_NGN)}`,
])}

### 4.4 Hold period

The intended Hold Period is **${MINIMUM_HOLD_YEARS} years (${MINIMUM_HOLD_YEARS * 12} months)** from the Closing Date.

### 4.5 Operating revenue model

The commercial model presented to Investors currently assumes three main revenue streams:

${buildBulletList(['room revenue', 'restaurant revenue', 'lounge revenue'])}

All model outputs, occupancy assumptions, room-rate assumptions, appreciation assumptions, and return projections are indicative only. They are not guarantees and do not form a debt obligation owed by ${FUTUREX_SHORT_NAME} or the SPV.

### 4.6 Profit split during operations

Subject to Section 11:

${buildBulletList([
  `${INVESTOR_OPERATING_PROFIT_SHARE_PERCENT}% of Distributable Operating Profit is allocated to Investors pro rata to their Units`,
  `${FUTUREX_OPERATING_PROFIT_SHARE_PERCENT}% of Distributable Operating Profit is allocated to ${FUTUREX_SHORT_NAME} as the management fee for execution and operations`,
])}

For clarity, the ${FUTUREX_OPERATING_PROFIT_SHARE_PERCENT}% management fee applies to distributable operating profit only. It does not automatically apply to sale proceeds unless expressly approved by Investors in writing.

### 4.7 Exit proceeds

Unless Investors approve a different structure in writing, net proceeds from a refinancing or sale of the Acquisition Asset after payment of liabilities, taxes, closing costs, and proper SPV obligations shall be distributed to Investors pro rata to their Units.

---

## 5. SUBSCRIPTION AND ACCEPTANCE

### 5.1 Subscription

By signing this Agreement, the Investor applies to subscribe for:

${buildBulletList([
  `**${params.slotCount} ${params.slotCount === 1 ? 'Unit' : 'Units'}**`,
  `at **${formatNairaAmount(MINIMUM_TICKET_NGN)} per Unit**`,
  `for a total Investment Amount of **${params.commitmentLabel}**`,
])}

### 5.2 Acceptance by ${FUTUREX_SHORT_NAME}

No subscription is binding on ${FUTUREX_SHORT_NAME} until ${FUTUREX_SHORT_NAME}:

${buildNumberedList([
  'completes or waives its KYC, AML, and source-of-funds review',
  'confirms the Investor allocation in writing',
  'receives cleared funds for the accepted Investment Amount',
  'records the accepted subscription in the SPV Register',
])}

${FUTUREX_SHORT_NAME} may reject or reduce a subscription if:

${buildBulletList([
  'the vehicle is oversubscribed',
  'KYC or source-of-funds checks are unsatisfactory',
  'the proposed payment route is non-compliant',
  'the Investor is in a restricted jurisdiction',
  `${FUTUREX_SHORT_NAME} reasonably believes acceptance would create a legal, regulatory, reputational, or operational risk`,
])}

### 5.3 Payment

The Investor shall pay the Investment Amount only to the payment route designated by ${FUTUREX_SHORT_NAME} in writing for this vehicle.

${FUTUREX_SHORT_NAME} may reject cash payments or payments made through undisclosed third parties.

### 5.4 Record of interest

The Investor's economic entitlement is determined by:

**Units held by the Investor / total issued and paid Units in the vehicle**

No brochure percentage, sales estimate, or verbal representation overrides this formula.

---

## 6. PRE-CLOSING, DEPLOYMENT, AND LONG-STOP PROTECTIONS

### 6.1 No deployment before Close

${FUTUREX_SHORT_NAME} shall not deploy Investor capital into land acquisition, construction, or operating expenditure until a Closing Notice has been issued.

### 6.2 Conditions to Close

${FUTUREX_SHORT_NAME} may issue a Closing Notice only when it is satisfied that:

${buildNumberedList([
  'the relevant SPV has been incorporated or otherwise validly structured for this vehicle',
  'the paid and accepted subscriptions are sufficient to support the approved project budget',
  'the proposed land or substitute site meets the project criteria under this Agreement',
  'title, land diligence, and transaction structure are sufficiently advanced to permit commercially reasonable deployment',
  'the project banking, reporting, and governance arrangements are in place',
  'there is no legal or regulatory issue making deployment unlawful or commercially reckless',
])}

### 6.3 Undersubscription

If the full target raise is not completed by the Long-Stop Date, ${FUTUREX_SHORT_NAME} may:

${buildNumberedList([
  'extend the fundraising period and notify Investors',
  'circulate a revised project budget and proceed only with Majority Investor Approval',
  'restructure the project in a way that does not materially prejudice Investors, again only with Majority Investor Approval',
  'terminate the vehicle and return uncommitted capital in accordance with Section 6.5',
])}

### 6.4 Material change before deployment

Before material deployment of Investor funds, ${FUTUREX_SHORT_NAME} shall notify Investors if there is a material change to:

${buildBulletList([
  'target corridor',
  'total vehicle budget',
  'property type',
  'construction scope',
  'fee structure',
  'hold period',
  'legal structure',
])}

Any change materially departing from Section 4 requires Majority Investor Approval before deployment.

### 6.5 Failure to close

If the vehicle does not close and no approved restructure is adopted, ${FUTUREX_SHORT_NAME} shall return all uncommitted Investor capital within 30 days after the termination decision, less only:

${buildBulletList([
  'actual bank reversal charges',
  'mandatory regulatory charges',
  "other third-party costs expressly disclosed to Investors in advance and actually incurred for that Investor's onboarding",
])}

${FUTUREX_SHORT_NAME} shall not retain a syndication fee from capital that is never deployed into a closed vehicle.

---

## 7. ACQUISITION AND PROJECT CRITERIA

### 7.1 Core property criteria

Unless Majority Investor Approval is obtained for a different approach, the Acquisition Asset must satisfy the following criteria:

${buildBulletList([
  `it must be located in ${TARGET_CORRIDOR}, or another substantially similar prime hospitality corridor within Uyo`,
  'it must be legally capable of supporting the intended hospitality use, whether immediately or after standard permitting steps',
  'the land acquisition price must fit within the approved budget or be capable of being covered from disclosed buffers without creating a material adverse change',
  'commercially reasonable title review must be obtained before completion',
  'the site must be commercially suitable for the intended 6-room boutique hotel, indoor pool, lounge, restaurant, and supporting infrastructure',
  'the final acquisition structure must allow the SPV to enjoy clear beneficial control over the asset and the project cash flows',
])}

### 7.2 Title and diligence

Before completion of a land acquisition, ${FUTUREX_SHORT_NAME} shall use commercially reasonable efforts to ensure that:

${buildBulletList([
  'title documents have been reviewed by counsel',
  'survey and land identity are reasonably verified',
  'known encumbrances and red flags have been identified and assessed',
  'the intended use is not obviously incompatible with the location',
  'the transaction documents are consistent with the SPV structure used for the vehicle',
])}

### 7.3 Substitute site

If the originally targeted parcel cannot be acquired on commercially reasonable terms, ${FUTUREX_SHORT_NAME} may present a substitute site within the criteria in Section 7.1.

A substitute site outside those criteria requires Majority Investor Approval.

### 7.4 Budget variance

${FUTUREX_SHORT_NAME} may move funds between budget lines where reasonably required for execution, provided that:

${buildBulletList([
  'the total vehicle budget is not exceeded without approval',
  'no single material change that fundamentally alters the economics, risk, or nature of the project is made without Majority Investor Approval',
])}

For this purpose, a change is presumed material if it:

${buildBulletList([
  'increases the total vehicle budget by more than 10%',
  'changes the location corridor outside Uyo prime hospitality corridors',
  'materially changes the size or nature of the property',
  'introduces undisclosed external debt at financial close',
  'changes the Investor distribution logic in Section 11',
])}

---

## 8. NATURE OF INTEREST AND TITLE POSITION

### 8.1 Beneficial economic interest

The Investor acquires a beneficial economic participation interest in the vehicle in proportion to the Investor's Units.

### 8.2 No direct room or operating ownership

The Investor does not acquire:

${buildBulletList([
  'ownership of any specific hotel room or operating department',
  'a franchise interest',
  'management control over staff',
  'a direct share of gross turnover',
])}

### 8.3 SPV asset holding

The intended legal structure is that the SPV, or a lawful nominee or holding arrangement acting solely for the SPV, holds or controls the land and completed property for the benefit of the vehicle.

${FUTUREX_SHORT_NAME} shall not knowingly structure the transaction in a way that causes Investor capital to fund an asset that sits outside the disclosed vehicle structure without clear disclosure and required approval.

### 8.4 Register

${FUTUREX_SHORT_NAME} shall maintain the SPV Register showing each Investor's name, number of subscribed and paid Units, Investment Amount, date of acceptance, and such other administrative details as are reasonably required.

The SPV Register is the primary internal record of participation for the vehicle.

---

## 9. ${FUTUREX_SHORT_NAME.toUpperCase()} ROLE, POWERS, AND LIMITS

### 9.1 Role

${FUTUREX_SHORT_NAME} acts as:

${buildBulletList([
  'sponsor of the vehicle',
  'manager of fundraising and close',
  'project execution lead during acquisition and construction',
  'property manager or management appointor during operations',
  'reporting and investor communication lead',
])}

### 9.2 Ordinary powers

Subject to this Agreement, ${FUTUREX_SHORT_NAME} may do all things reasonably necessary to execute the vehicle, including:

${buildBulletList([
  'form and administer the SPV',
  'negotiate and complete land acquisition documents',
  'appoint lawyers, surveyors, architects, engineers, contractors, and consultants',
  'obtain permits, licences, and registrations',
  'enter into construction, operations, insurance, banking, accounting, and service contracts',
  'set prudent working capital and maintenance reserves',
  'collect project income',
  'pay project costs and liabilities',
  'circulate reports',
  'administer a sale, refinance, or wind-down approved under this Agreement',
])}

### 9.3 Limits on ${FUTUREX_SHORT_NAME}

Without the approval level stated in this Agreement, ${FUTUREX_SHORT_NAME} may not:

${buildBulletList([
  'materially change the business model or use of the property',
  'materially change the fee structure',
  'call for additional capital from Investors',
  'dispose of the Acquisition Asset outside the normal exit process except where forced disposition is reasonably required to prevent greater loss',
  'create material external debt against the project without disclosure and approval',
  'enter into a related-party arrangement on terms that are not commercially reasonable and properly disclosed',
])}

### 9.4 Standard of conduct

${FUTUREX_SHORT_NAME} shall act in good faith and use commercially reasonable efforts to execute the vehicle in a manner consistent with this Agreement. ${FUTUREX_SHORT_NAME} is not a guarantor of returns, completion timing, occupancy, licensing outcome, or exit price.

### 9.5 Removal for cause

Investors holding Supermajority Investor Approval may remove ${FUTUREX_SHORT_NAME} as manager for cause if there is proven:

${buildBulletList([
  'fraud',
  'wilful misconduct',
  'material misappropriation of project funds',
  'persistent failure to provide required reporting after written notice and cure opportunity',
  'a material breach of this Agreement that remains uncured for 30 days after written notice',
])}

If ${FUTUREX_SHORT_NAME} is removed for cause, Investors may appoint a replacement manager or direct a wind-down of the vehicle.

---

## 10. REPORTING, COMMUNICATION, AND INVESTOR RIGHTS

### 10.1 Pre-operating updates

During land acquisition and construction, ${FUTUREX_SHORT_NAME} shall provide periodic updates covering, where reasonably available:

${buildBulletList([
  'acquisition progress',
  'title and legal milestones',
  'construction milestones',
  'budget posture',
  'major delays or risks',
  'photo or video progress records',
])}

### 10.2 Operating updates

After commercial launch, ${FUTUREX_SHORT_NAME} shall provide quarterly reports showing, so far as reasonably available:

${buildBulletList([
  'revenue',
  'operating costs',
  'reserve movements',
  'net operating profit',
  'distributions made or withheld',
  'material compliance or licensing issues',
  'any material event affecting the property',
])}

### 10.3 Accounts

Project funds are to be held separately from ${FUTUREX_SHORT_NAME}'s own operating funds, subject to normal banking, settlement, and transfer mechanics required to run the vehicle.

### 10.4 Inspection rights

Investors do not have day-to-day management rights, but Investors holding at least 15% of issued Units may request reasonable clarification or supporting information on a bona fide concern relating to project funds, material variance from the approved structure, related-party transactions, distributions, or significant compliance issues.

${FUTUREX_SHORT_NAME} may refuse a request that is abusive, duplicative, commercially sensitive beyond reason, or inconsistent with confidentiality obligations, but may not refuse in bad faith.

### 10.5 Voting

Each Unit carries one vote on investor matters. Ordinary investor matters are decided by Majority Investor Approval, while removal for cause, extension beyond the Hold Period, and other fundamental changes require Supermajority Investor Approval.

---

## 11. DISTRIBUTIONS, RESERVES, AND WATERFALL

### 11.1 Priority of cash application

Gross property revenue shall be applied in the following order:

${buildNumberedList([
  'taxes, statutory charges, and compliance costs',
  'direct operating expenses',
  'insurance, maintenance, and repairs',
  'debt service, if any approved debt exists',
  'prudent working capital, maintenance, and contingency reserves',
  'unpaid project liabilities properly due',
  'calculation of Distributable Operating Profit',
  `split of Distributable Operating Profit under the ${INVESTOR_OPERATING_PROFIT_SHARE_PERCENT}/${FUTUREX_OPERATING_PROFIT_SHARE_PERCENT} model`,
])}

### 11.2 Operating profit split

Once Distributable Operating Profit is established:

${buildBulletList([
  `${INVESTOR_OPERATING_PROFIT_SHARE_PERCENT}% shall be allocated to Investors pro rata to Units`,
  `${FUTUREX_OPERATING_PROFIT_SHARE_PERCENT}% shall be allocated to ${FUTUREX_SHORT_NAME} as management fee`,
])}

### 11.3 Distribution timing

${FUTUREX_SHORT_NAME} intends to make investor distributions quarterly once the property is operational and there is lawfully distributable cash. No distribution start date is guaranteed, distributions may be delayed during stabilisation, prudent reserves may be retained, and no Investor has a right to compel a distribution that would be commercially reckless or unlawful.

### 11.4 No immediate return expectation

The Investor expressly acknowledges that:

${buildBulletList([
  'Year 1 is expected to be acquisition, construction, and launch preparation',
  'distributions are not expected immediately after subscription',
  'distributions may begin only after operating stabilisation',
  'actual timing may be later than projected',
])}

### 11.5 Exit proceeds

Upon sale, approved refinance, or other asset realisation event:

${buildNumberedList([
  'liabilities, taxes, transaction costs, and winding-up costs are paid first',
  'any approved debt is discharged',
  'any proper unpaid project obligations are settled',
  'any remaining reserve requirement is addressed',
  'the net balance is distributed to Investors pro rata to Units, unless Investors have approved another lawful allocation',
])}

---

## 12. HOLD PERIOD, EXIT, REFINANCE, AND EXTENSION

### 12.1 Intended hold

The intended hold is ${MINIMUM_HOLD_YEARS * 12} months from the Closing Date.

### 12.2 Exit review

Not later than 90 days before the end of the Hold Period, ${FUTUREX_SHORT_NAME} shall circulate an exit memorandum to Investors setting out available options, which may include:

${buildBulletList([
  'sale of the Acquisition Asset',
  'refinance and partial liquidity',
  'extension of the hold',
  'another commercially reasonable realisation path',
])}

### 12.3 Investor decision

At the end of the Hold Period, Investors shall decide whether to sell, refinance, extend, or adopt another lawful exit route. An extension beyond the original Hold Period requires Supermajority Investor Approval.

### 12.4 Early sale

${FUTUREX_SHORT_NAME} may recommend an earlier sale only where:

${buildBulletList([
  'market conditions make early disposal commercially compelling',
  'there is a material risk to value if the asset is held',
  'there is a forced sale scenario or legal imperative',
  'Investors otherwise approve the sale',
])}

An early voluntary sale that is not forced by law or distress requires Majority Investor Approval.

---

## 13. TRANSFER RESTRICTIONS AND ILLIQUIDITY

### 13.1 No free transfer market

This is an illiquid private investment. No Investor should assume there will be an active resale market.

### 13.2 Restriction during Hold Period

The Investor may not transfer, assign, charge, or otherwise deal with the Investor's Units during the Hold Period without ${FUTUREX_SHORT_NAME}'s prior written consent, such consent not to be unreasonably withheld where:

${buildBulletList([
  'the proposed transferee passes KYC and AML review',
  'the transfer is lawful',
  'the transfer does not disrupt the vehicle administration',
  'the transfer documents required by FutureX are executed',
])}

### 13.3 Facilitated secondary transfer

${FUTUREX_SHORT_NAME} may, but is not obliged to, facilitate secondary transfers between eligible investors on a case-by-case basis.

### 13.4 No redemption right

The Investor has no automatic right to early redemption or capital withdrawal.

---

## 14. INVESTOR REPRESENTATIONS, WARRANTIES, AND ACKNOWLEDGMENTS

The Investor represents, warrants, and acknowledges that:

${buildNumberedList([
  'the Investor has legal capacity to enter into this Agreement',
  'the funds used for subscription are from lawful sources and are not proceeds of crime',
  'the Investor has provided truthful KYC and source-of-funds information',
  'the Investor understands this is a private, illiquid, high-risk investment',
  'the Investor understands that returns are not guaranteed',
  'the Investor understands that revenue depends on successful acquisition, construction, launch, operations, and exit',
  'the Investor understands that the final parcel and final transaction documents may not yet have been fully completed at the time of signing because this Agreement also governs the pre-closing stage',
  'the Investor understands that no capital should be invested if it may be needed on short notice',
  'the Investor has had the opportunity to ask questions and seek independent advice',
  'the Investor is not relying on any guaranteed-return statement, verbal promise, unofficial screenshot, or undocumented side promise',
  `${FUTUREX_SHORT_NAME} is an execution manager, not a bank and not an insurer of capital`,
  "the Investor's entitlement is governed by the Unit formula in this Agreement and the SPV Register, not by sales shorthand or rough projections",
])}

---

## 15. ${FUTUREX_SHORT_NAME.toUpperCase()} REPRESENTATIONS

${FUTUREX_SHORT_NAME} represents that, as at the date it accepts the Investor's subscription:

${buildNumberedList([
  'it is duly incorporated and in existence under Nigerian law',
  'it has authority to enter into this Agreement',
  'it intends to structure the vehicle substantially in the manner described in this Agreement',
  'it will not knowingly deploy project funds in a manner materially inconsistent with this Agreement without the required approval',
  'it will maintain project records reasonably sufficient to administer the vehicle',
])}

Except as expressly stated in this Agreement, ${FUTUREX_SHORT_NAME} gives no warranty as to:

${buildBulletList([
  'timing of acquisition or construction',
  'occupancy levels',
  'future market value',
  'regulatory outcome',
  'operating profit',
  'the amount or timing of distributions',
])}

---

## 16. RISK DISCLOSURE

The Investor acknowledges the following non-exhaustive risks:

### 16.1 Acquisition risk

The target land may not be available on expected terms, title issues may arise, or acquisition timing may slip.

### 16.2 Construction risk

Construction may be delayed by weather, labour, pricing, logistics, contractor performance, utilities, design issues, permit issues, or other execution challenges.

### 16.3 Cost overrun risk

Land cost, construction cost, infrastructure cost, and launch cost may exceed estimates.

### 16.4 Regulatory and licensing risk

Hospitality, building, environmental, tax, and local authority approvals may be delayed, restricted, or conditioned.

### 16.5 Operating risk

Room occupancy, restaurant demand, lounge demand, staffing quality, stock control, maintenance standards, and guest experience may all perform below expectation.

### 16.6 Power and infrastructure risk

Grid instability, generator issues, fuel costs, solar maintenance, and local infrastructure weakness may increase cost or disrupt operations.

### 16.7 Market and appreciation risk

Projected appreciation is only an assumption. Exit value may be lower than modeled or materially below cost.

### 16.8 Liquidity risk

The Investor may be unable to exit before the Hold Period ends.

### 16.9 Manager risk

Execution depends materially on ${FUTUREX_SHORT_NAME}'s operational competence, discipline, and controls.

### 16.10 Capital-at-risk risk

The Investor may lose part or all of the Investment Amount.

The Investor confirms that the Investor is proceeding on the basis of structure, diligence, fit, and risk tolerance, and not on hype or guaranteed-outcome assumptions.

---

## 17. DEFAULTS AND REMEDIES

### 17.1 Investor default

If an Investor fails to complete an agreed payment obligation after allocation and written notice, ${FUTUREX_SHORT_NAME} may:

${buildBulletList([
  'cancel the unpaid allocation',
  'admit a replacement investor',
  'return any refundable balance after deduction of actual third-party costs caused by that default',
  'take any other commercially reasonable step consistent with this Agreement',
])}

### 17.2 ${FUTUREX_SHORT_NAME} breach

If ${FUTUREX_SHORT_NAME} commits a material breach of this Agreement, Investors may give written notice specifying the breach and requiring cure within 30 days unless the breach is incapable of cure. If the breach is not cured, Investors may exercise any rights available under this Agreement, including removal for cause.

### 17.3 Limitation

${FUTUREX_SHORT_NAME} shall not be liable for ordinary commercial underperformance, delay, or market disappointment where it has acted in good faith and without fraud, wilful misconduct, or gross misappropriation. Nothing in this Agreement excludes liability for fraud, wilful misconduct, or unlawful misapplication of funds.

---

## 18. CONFIDENTIALITY

This Agreement and any diligence materials provided under it are confidential and may not be circulated publicly except:

${buildBulletList([
  "to the Investor's professional advisers",
  'as required by law',
  `with ${FUTUREX_SHORT_NAME}'s written consent`,
  'where the information has already lawfully entered the public domain without breach',
])}

---

## 19. NOTICES

Any notice under this Agreement may be sent by:

${buildBulletList([
  'email to the address last notified by the receiving Party',
  'courier',
  'physical delivery',
])}

Email notice is deemed received on the same Business Day if sent before 4:00 p.m. Nigerian time, otherwise on the next Business Day.

---

## 20. GOVERNING LAW AND DISPUTE RESOLUTION

### 20.1 Governing law

This Agreement is governed by the laws of the Federal Republic of Nigeria.

### 20.2 Good-faith escalation

The Parties shall first attempt in good faith to resolve any dispute through written notice and a management-level discussion within 10 Business Days.

### 20.3 Arbitration

If the dispute is not resolved, it shall be referred to arbitration in Nigeria by a sole arbitrator agreed by the Parties, or failing agreement, appointed by the Chairman of the Chartered Institute of Arbitrators (UK), Nigeria Branch. The seat of arbitration shall be Lagos, Nigeria, and the language shall be English.

Nothing in this clause prevents a Party from seeking urgent injunctive relief from a court of competent jurisdiction in Nigeria.

---

## 21. GENERAL

### 21.1 Entire agreement

This Agreement constitutes the entire principal agreement between ${FUTUREX_SHORT_NAME} and the Investor in relation to this vehicle, except for:

${buildBulletList([
  'KYC and AML forms',
  'payment confirmations',
  'any SPV share or unit certificate issued after close',
  'any written amendment or Closing Notice issued under this Agreement',
])}

### 21.2 Amendments

Any amendment that materially affects Investor economics, fees, governance, rights, or risk must be approved at the approval level required under this Agreement.

### 21.3 Severability

If any provision is held invalid or unenforceable, the remaining provisions remain in effect to the fullest extent lawful.

### 21.4 Counterparts and electronic signature

This Agreement may be signed in counterparts and by electronic signature, each of which is effective as an original.

---

## SCHEDULE 1 — INVESTOR DETAILS

${buildBulletList([
  `Investor full legal name: ${present(investorName)}`,
  `Date of birth: ${present(investorDateOfBirth)}`,
  `Country of residence: ${present(investorCountry)}`,
  `Email: ${present(params.lead.email)}`,
  `Phone number: ${present(investorPhone)}`,
  `Nationality: ${present(investorNationality)}`,
  `Employer or business address: ${present(investorEmployerOrBusinessAddress)}`,
  'Primary ID document and supporting KYC documents: submitted separately in the FutureX KYC record',
  `Tax identification number (if provided): ${present(investorTaxId)}`,
  `Source of funds: ${sourceOfFundsSummary || sourceOfFundsLabel}`,
  `Expected funding method: ${fundingMethodLabel}`,
  `Subscription units: ${params.slotCount} ${params.slotCount === 1 ? 'Unit' : 'Units'}`,
  `Total investment amount: ${params.commitmentLabel}`,
])}

---

## SCHEDULE 2 — PROJECT SUMMARY

${buildBulletList([
  `Vehicle name: ${VEHICLE_NAME}`,
  `SPV name: ${SPV_NAME}`,
  `Target corridor: ${TARGET_CORRIDOR}, or an approved substitute within the agreed criteria`,
  'Property concept: 6-room boutique hotel with indoor pool, lounge, and restaurant',
  `Total target raise: ${formatNairaAmount(TARGET_RAISE_NGN)}`,
  `Unit size: ${formatNairaAmount(MINIMUM_TICKET_NGN)}`,
  `Target unit count: ${TARGET_UNIT_COUNT}`,
  `Intended hold: ${MINIMUM_HOLD_YEARS * 12} months from Closing Date`,
  `Investor share of Distributable Operating Profit: ${INVESTOR_OPERATING_PROFIT_SHARE_PERCENT}% pro rata`,
  `${FUTUREX_SHORT_NAME} operating management fee: ${FUTUREX_OPERATING_PROFIT_SHARE_PERCENT}% of Distributable Operating Profit`,
  `${FUTUREX_SHORT_NAME} sponsor fee at close: ${SPONSOR_FEE_PERCENT}% of total raise, included in budget`,
  'Reporting cadence: periodic build updates and quarterly operating reports after launch',
])}

---

## SCHEDULE 3 — INVESTOR ACKNOWLEDGMENT CHECKLIST

The Investor confirms that the Investor understands and accepts the following:

${buildBulletList([
  'this is a private, illiquid investment',
  'the Investor may not access capital freely during the Hold Period',
  'Year 1 is expected to be acquisition and construction, not immediate income',
  'distributions may begin only after the property is built, launched, and stabilised',
  'the final asset may still be in pre-acquisition or pre-deployment stage at signing',
  'all projections are estimates only',
  'the Investor may lose part or all of invested capital',
  "the Investor has had the opportunity to consult the Investor's own lawyer",
])}

---

## EXECUTION

### Investor

Name: **${investorName}**  
Signature: ___________________________  
Date: **${generatedDate}**

### For ${FUTUREX_LEGAL_NAME}

Name: ___________________________  
Title: ___________________________  
Signature: ___________________________  
Date: ___________________________
`;
}

export function buildAgreementHashInput(params: {
  leadId: string;
  agreementText: string;
  signedAt: number;
}): string {
  return `${params.leadId}\n${params.signedAt}\n${params.agreementText}`;
}
