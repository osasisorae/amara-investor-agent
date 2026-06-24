import fs from 'fs';
import path from 'path';
import type {
  DealBriefCardComponentData,
  ExitCardComponentData,
  GuidedQuestionsComponentData,
  OwnershipCardComponentData,
  ReturnsTableComponentData,
  RevenueChartComponentData,
  RiskTableComponentData,
  SpvStructureCardComponentData,
  TimelineCardComponentData,
} from '@/lib/chat/components';
import {
  EXIT_STRATEGY,
  SPV_NAME,
  TARGET_RETURN,
} from '@/lib/agreement/template';
import {
  MINIMUM_HOLD_YEARS,
  MINIMUM_TICKET_NGN,
} from '@/lib/agent/qualification';

const AKWA_IBOM_BRIEF_PATH = path.join(
  process.cwd(),
  'knowledge-base',
  'akwa-ibom-hospitality.md'
);

export type GuidedDealRoomQuestionId =
  | 'deal_brief'
  | 'spv_structure'
  | 'returns_breakdown'
  | 'ownership'
  | 'revenue_model'
  | 'risks'
  | 'year_five'
  | 'diaspora_transfer'
  | 'timeline'
  | 'fees';

export interface GuidedDealRoomAnswer {
  text: string;
  component?:
    | {
        type: 'deal_brief';
        data: DealBriefCardComponentData;
      }
    | {
        type: 'spv_structure';
        data: SpvStructureCardComponentData;
      }
    | {
        type: 'returns_table';
        data: ReturnsTableComponentData;
      }
    | {
        type: 'revenue_chart';
        data: RevenueChartComponentData;
      }
    | {
        type: 'ownership_card';
        data: OwnershipCardComponentData;
      }
    | {
        type: 'risk_table';
        data: RiskTableComponentData;
      }
    | {
        type: 'timeline_card';
        data: TimelineCardComponentData;
      }
    | {
        type: 'exit_card';
        data: ExitCardComponentData;
      };
}

const GUIDED_DEAL_ROOM_QUESTIONS: Array<{
  id: GuidedDealRoomQuestionId;
  label: string;
}> = [
  {
    id: 'returns_breakdown',
    label: 'Walk me through the full return breakdown',
  },
  {
    id: 'ownership',
    label: 'What does my ₦5M actually own in this SPV?',
  },
  {
    id: 'revenue_model',
    label: 'Show me the revenue model',
  },
  {
    id: 'risks',
    label: 'What are the risks and how are they mitigated?',
  },
  {
    id: 'year_five',
    label: 'What happens at Year 5?',
  },
  {
    id: 'diaspora_transfer',
    label: 'How do I move money in as a diaspora investor?',
  },
  {
    id: 'timeline',
    label: 'Show me the construction and operations timeline',
  },
  {
    id: 'fees',
    label: "What is FutureX's fee and how do they make money?",
  },
];

function loadAkwaIbomBrief(): string {
  if (!fs.existsSync(AKWA_IBOM_BRIEF_PATH)) {
    return '';
  }

  return fs.readFileSync(AKWA_IBOM_BRIEF_PATH, 'utf-8');
}

function buildSectionMap(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const headingMatches = [...content.matchAll(/^##\s+(.+)$/gm)];

  headingMatches.forEach((match, index) => {
    const title = match[1].trim();
    const start = (match.index || 0) + match[0].length;
    const end =
      index + 1 < headingMatches.length
        ? headingMatches[index + 1].index || content.length
        : content.length;

    sections.set(title, content.slice(start, end).trim());
  });

  return sections;
}

function getSection(title: string): string {
  const content = loadAkwaIbomBrief();
  if (!content) {
    return '';
  }

  return buildSectionMap(content).get(title) || '';
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseMarkdownTables(section: string): Array<{
  headers: string[];
  rows: string[][];
}> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const lines = section.split('\n');
  let currentBlock: string[] = [];

  const flushBlock = () => {
    if (currentBlock.length < 2) {
      currentBlock = [];
      return;
    }

    const headers = splitMarkdownRow(currentBlock[0]);
    const rows = currentBlock
      .slice(1)
      .filter((line) => !/^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim()))
      .map(splitMarkdownRow)
      .filter((row) => row.length === headers.length);

    if (headers.length && rows.length) {
      tables.push({ headers, rows });
    }

    currentBlock = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      currentBlock.push(line);
    } else {
      flushBlock();
    }
  }

  flushBlock();
  return tables;
}

function toRowMap(table?: {
  headers: string[];
  rows: string[][];
}): Array<Record<string, string>> {
  if (!table) {
    return [];
  }

  return table.rows.map((row) =>
    table.headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = row[index] || '';
      return accumulator;
    }, {})
  );
}

function findRow(
  rows: Array<Record<string, string>>,
  key: string,
  valueFragment: string
): Record<string, string> | undefined {
  const normalizedNeedle = valueFragment.toLowerCase();

  return rows.find((row) =>
    (row[key] || '').toLowerCase().includes(normalizedNeedle)
  );
}

function stripApproximation(value: string): string {
  return value.replace(/^~\s*/, '').trim();
}

function stripMarkdownFormatting(value: string): string {
  return value.replace(/\*\*/g, '').trim();
}

function getParagraphs(section: string): string[] {
  return section
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

function joinWithAnd(values: string[]): string {
  if (values.length <= 1) {
    return values[0] || '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function parseCurrencyAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function formatNaira(value: number): string {
  return `₦${value.toLocaleString('en-NG')}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(3)}%`;
}

function buildGuidedQuestionTitle(): string {
  return 'Here are the questions serious investors ask about this deal. Tap any to get a detailed answer:';
}

export function buildGuidedQuestionsData(): GuidedQuestionsComponentData {
  return {
    title: buildGuidedQuestionTitle(),
    questions: GUIDED_DEAL_ROOM_QUESTIONS.map((question) => question.label),
  };
}

export function buildReturnsTableData(): ReturnsTableComponentData {
  const returnsSection = getSection('Investor Returns Per ₦5M Ticket');
  const exitSection = getSection('Exit Value — Asset Appreciation');
  const [baseCaseTable, upsideCaseTable] = parseMarkdownTables(returnsSection);
  const [, summaryTable] = parseMarkdownTables(exitSection);
  const baseCaseRows = toRowMap(baseCaseTable);
  const upsideCaseRows = toRowMap(upsideCaseTable);
  const summaryRows = toRowMap(summaryTable);
  const baseSummary = findRow(summaryRows, 'Scenario', 'Base case');
  const upsideSummary = findRow(summaryRows, 'Scenario', 'Upside');

  const getYearValue = (
    rows: Array<Record<string, string>>,
    yearLabel: string
  ): string =>
    stripApproximation(findRow(rows, 'Year', yearLabel)?.[
      'Cash Distribution Per Ticket'
    ] || '');

  return {
    title: 'Return breakdown per ₦5M ticket',
    baseCaseLabel: 'Base Case (70% occupancy)',
    upsideCaseLabel: 'Upside (85% occupancy)',
    rows: [
      {
        label: 'Year 1',
        baseCase: getYearValue(baseCaseRows, 'Year 1'),
        upsideCase: getYearValue(upsideCaseRows, 'Year 1'),
      },
      {
        label: 'Year 2',
        baseCase: getYearValue(baseCaseRows, 'Year 2'),
        upsideCase: getYearValue(upsideCaseRows, 'Year 2'),
      },
      {
        label: 'Year 3',
        baseCase: getYearValue(baseCaseRows, 'Year 3'),
        upsideCase: getYearValue(upsideCaseRows, 'Year 3'),
      },
      {
        label: 'Year 4',
        baseCase: getYearValue(baseCaseRows, 'Year 4'),
        upsideCase: getYearValue(upsideCaseRows, 'Year 4'),
      },
      {
        label: 'Year 5',
        baseCase: getYearValue(baseCaseRows, 'Year 5'),
        upsideCase: getYearValue(upsideCaseRows, 'Year 5'),
      },
      {
        label: 'Total Cash',
        baseCase: stripApproximation(baseSummary?.['Cash Returns (Yrs 2–5)'] || ''),
        upsideCase: stripApproximation(
          upsideSummary?.['Cash Returns (Yrs 2–5)'] || ''
        ),
        highlight: true,
      },
      {
        label: 'Exit Value',
        baseCase: stripApproximation(baseSummary?.['Exit Value'] || ''),
        upsideCase: stripApproximation(upsideSummary?.['Exit Value'] || ''),
      },
      {
        label: 'Total Proceeds',
        baseCase: stripApproximation(baseSummary?.['Total Proceeds'] || ''),
        upsideCase: stripApproximation(upsideSummary?.['Total Proceeds'] || ''),
        highlight: true,
      },
      {
        label: 'Original Ticket',
        baseCase: stripApproximation(baseSummary?.['Original Ticket'] || ''),
        upsideCase: stripApproximation(upsideSummary?.['Original Ticket'] || ''),
      },
      {
        label: 'Multiple',
        baseCase: stripApproximation(baseSummary?.['Multiple'] || ''),
        upsideCase: stripApproximation(upsideSummary?.['Multiple'] || ''),
        highlight: true,
      },
    ],
  };
}

export function buildRevenueChartData(): RevenueChartComponentData {
  const section = getSection('Revenue Model — Three Streams');
  const [revenueTable, costTable] = parseMarkdownTables(section);
  const revenueRows = toRowMap(revenueTable);
  const costRows = toRowMap(costTable);

  const streams = revenueRows
    .filter((row) => !row['Revenue Stream']?.toLowerCase().includes('gross'))
    .map((row) => {
      const monthlyValue = parseCurrencyAmount(row.Monthly || '');
      return {
        name: row['Revenue Stream']?.split('(')[0].trim() || 'Revenue stream',
        monthly: monthlyValue,
        annual: monthlyValue * 12,
      };
    });

  const grossMonthly = parseCurrencyAmount(
    findRow(revenueRows, 'Revenue Stream', 'Gross monthly revenue')?.Monthly || ''
  );
  const operatingMonthly = parseCurrencyAmount(
    findRow(costRows, 'Cost Item', 'Total monthly operating costs')?.[
      'Monthly Estimate'
    ] || ''
  );
  const netMonthlyMatch = section.match(
    /Net monthly profit \(base case\):\s*₦([\d,]+)/
  );
  const netAnnualMatch = section.match(
    /Net annual profit \(base case\):\s*₦([\d,]+)/
  );
  const investorShareMatch = section.match(/70% to investors = ~₦([\d,]+)\/year/);
  const futurexShareMatch = section.match(
    /30% FutureX management fee = ~₦([\d,]+)\/year/
  );

  return {
    title: 'Revenue model',
    description:
      'This is the base-case operating model in the investment brief, broken into the three revenue streams and the 70/30 net-profit split.',
    streams,
    grossRevenue: {
      monthly: formatNaira(grossMonthly),
      annual: formatNaira(grossMonthly * 12),
    },
    operatingCosts: {
      monthly: formatNaira(operatingMonthly),
      annual: formatNaira(operatingMonthly * 12),
    },
    netProfit: {
      monthly: formatNaira(
        netMonthlyMatch ? Number(netMonthlyMatch[1].replace(/,/g, '')) : 0
      ),
      annual: formatNaira(
        netAnnualMatch ? Number(netAnnualMatch[1].replace(/,/g, '')) : 0
      ),
    },
    splitPercentages: {
      investors: '70%',
      futurex: '30%',
    },
    splitValues: {
      investors: formatNaira(
        investorShareMatch ? Number(investorShareMatch[1].replace(/,/g, '')) : 0
      ),
      futurex: formatNaira(
        futurexShareMatch ? Number(futurexShareMatch[1].replace(/,/g, '')) : 0
      ),
    },
  };
}

export function buildOwnershipCardData(): OwnershipCardComponentData {
  const keyNumbersSection = getSection('Key Numbers at a Glance');
  const ownershipSection = getSection('What You Actually Own');
  const timelineSection = getSection('Timeline');
  const [keyNumbersTable] = parseMarkdownTables(keyNumbersSection);
  const keyNumberRows = toRowMap(keyNumbersTable);
  const raiseValue = findRow(keyNumberRows, 'Item', 'Total raise')?.Value || '';
  const minimumTicket =
    findRow(keyNumberRows, 'Item', 'Minimum ticket')?.Value || '';
  const investorCount =
    findRow(keyNumberRows, 'Item', 'Number of investors')?.Value || '';
  const stakePerTicket =
    findRow(keyNumberRows, 'Item', 'SPV stake per ticket')?.Value || '';
  const holdings = ownershipSection
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.replace(/^- /, '').trim());
  const distributionLine =
    timelineSection
      .split('\n')
      .find((line) => line.toLowerCase().includes('distributed to investors quarterly')) ||
    '70% of net profit distributed to investors quarterly.';

  return {
    title: 'What a ₦5M ticket owns',
    ticketAmount: minimumTicket,
    spvStakePercentage: stakePerTicket,
    investorSlots: investorCount,
    totalRaise: raiseValue,
    ticketShareOfRaise: formatPercent(
      raiseValue && minimumTicket
        ? (parseCurrencyAmount(minimumTicket) / parseCurrencyAmount(raiseValue)) *
            100
        : 0
    ),
    legalHoldings: holdings,
    quarterlyDistributionCadence: distributionLine.trim(),
  };
}

export function buildRiskTableData(): RiskTableComponentData {
  const section = getSection('Risks & Honest Assessment');
  const [riskTable] = parseMarkdownTables(section);
  const riskRows = toRowMap(riskTable);

  return {
    title: 'Risks and mitigations',
    rows: riskRows.map((row) => ({
      risk: row.Risk || '',
      mitigation: row.Mitigation || '',
    })),
  };
}

export function buildTimelineCardData(): TimelineCardComponentData {
  const section = getSection('Timeline');
  const [timelineTable] = parseMarkdownTables(section);
  const timelineRows = toRowMap(timelineTable);

  return {
    title: 'Construction and operations timeline',
    milestones: timelineRows.map((row) => ({
      label: row.Phase || '',
      timing: row.Timing || '',
      description: row['What Happens'] || '',
    })),
  };
}

export function buildExitCardData(): ExitCardComponentData {
  const exitSection = getSection('Exit Value — Asset Appreciation');
  const governanceSection = getSection('Governance & Reporting');
  const [assetValueTable] = parseMarkdownTables(exitSection);
  const assetValueRows = toRowMap(assetValueTable);
  const yearFiveValue =
    findRow(assetValueRows, 'Year', 'Year 5')?.['Projected Asset Value'] || '';
  const decisionProcess =
    'At Month 60, investors collectively vote on whether to sell, refinance, or extend. The brief also says all material Year 5 decisions require investor consent and FutureX only facilitates the process.';

  return {
    title: 'Year 5 exit decision',
    projectedAssetValue: stripApproximation(yearFiveValue),
    decisionProcess,
    governanceNote:
      governanceSection
        .split('\n')
        .find((line) => line.toLowerCase().includes('material decisions at year 5'))?.replace(
          /^- /,
          ''
        )
        .trim() || 'All material decisions at Year 5 require investor consent.',
    options: [
      {
        label: 'Sell',
        description:
          'One of the three exit paths listed in the Month 60 investor vote.',
      },
      {
        label: 'Refinance',
        description:
          'One of the three exit paths listed in the Month 60 investor vote.',
      },
      {
        label: 'Extend',
        description:
          'One of the three exit paths listed in the Month 60 investor vote.',
      },
    ],
  };
}

export function buildDealBriefData(): DealBriefCardComponentData {
  const keyNumbersSection = getSection('Key Numbers at a Glance');
  const ownershipSection = getSection('What You Actually Own');
  const capitalSection = getSection('Capital Structure — Use of Funds');
  const revenueSection = getSection('Revenue Model — Three Streams');
  const exitSection = getSection('Exit Value — Asset Appreciation');
  const [keyNumbersTable] = parseMarkdownTables(keyNumbersSection);
  const [capitalTable] = parseMarkdownTables(capitalSection);
  const [revenueTable] = parseMarkdownTables(revenueSection);
  const [, exitSummaryTable] = parseMarkdownTables(exitSection);
  const keyNumberRows = toRowMap(keyNumbersTable);
  const capitalRows = toRowMap(capitalTable);
  const revenueRows = toRowMap(revenueTable);
  const exitSummaryRows = toRowMap(exitSummaryTable);
  const ownershipParagraphs = getParagraphs(ownershipSection);
  const ownershipHoldings = ownershipSection
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => stripMarkdownFormatting(line.replace(/^- /, '').trim()));
  const baseCaseSummary = findRow(exitSummaryRows, 'Scenario', 'Base case');
  const upsideCaseSummary = findRow(exitSummaryRows, 'Scenario', 'Upside');
  const grossMonthly = stripApproximation(
    findRow(revenueRows, 'Revenue Stream', 'Gross monthly revenue')?.Monthly ||
      ''
  );
  const reserveAmount = formatNaira(
    parseCurrencyAmount(
      findRow(capitalRows, 'Item', 'Stabilisation reserve')?.Amount || ''
    ) +
      parseCurrencyAmount(
        findRow(capitalRows, 'Item', 'Infrastructure & launch buffer')?.Amount ||
          ''
      )
  );

  return {
    title: 'Deal brief',
    snapshot: [
      {
        label: 'Vehicle',
        value: SPV_NAME,
      },
      {
        label: 'Minimum ticket',
        value:
          findRow(keyNumberRows, 'Item', 'Minimum ticket')?.Value ||
          `₦${MINIMUM_TICKET_NGN.toLocaleString('en-NG')}`,
      },
      {
        label: 'Hold period',
        value:
          findRow(keyNumberRows, 'Item', 'Hold period')?.Value ||
          `${MINIMUM_HOLD_YEARS} years`,
      },
      {
        label: 'Target return',
        value: TARGET_RETURN,
      },
      {
        label: 'Exit path',
        value: EXIT_STRATEGY,
      },
    ],
    whatSpvOwns: [
      stripMarkdownFormatting(ownershipParagraphs[0] || ''),
      ownershipHoldings.length
        ? `The SPV holds ${joinWithAnd(ownershipHoldings)}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    returnsSummary: {
      originalTicket:
        stripApproximation(baseCaseSummary?.['Original Ticket'] || '') ||
        `₦${MINIMUM_TICKET_NGN.toLocaleString('en-NG')}`,
      baseCaseTotalProceeds:
        stripApproximation(baseCaseSummary?.['Total Proceeds'] || '') || '—',
      baseCaseMultiple:
        stripApproximation(baseCaseSummary?.['Multiple'] || '') || '—',
      upsideCaseTotalProceeds:
        stripApproximation(upsideCaseSummary?.['Total Proceeds'] || '') || '—',
      upsideCaseMultiple:
        stripApproximation(upsideCaseSummary?.['Multiple'] || '') || '—',
    },
    revenueStreams: revenueRows
      .filter((row) => !row['Revenue Stream']?.toLowerCase().includes('gross'))
      .map((row) => ({
        label: row['Revenue Stream']?.split('(')[0].trim() || 'Revenue stream',
        monthly: row.Monthly || '—',
        note: row.Assumption || undefined,
      })),
    totalGrossMonthly: grossMonthly || '—',
    capitalUse: [
      {
        label: 'Land',
        amount:
          findRow(capitalRows, 'Item', 'Land acquisition')?.Amount || '—',
      },
      {
        label: 'Construction',
        amount: findRow(capitalRows, 'Item', 'Construction')?.Amount || '—',
      },
      {
        label: 'Power',
        amount:
          findRow(capitalRows, 'Item', 'Power infrastructure')?.Amount || '—',
      },
      {
        label: 'Legal',
        amount:
          findRow(capitalRows, 'Item', 'Legal, SPV setup')?.Amount || '—',
      },
      {
        label: 'Reserve',
        amount: reserveAmount,
      },
      {
        label: 'FutureX fee',
        amount:
          findRow(capitalRows, 'Item', 'FutureX syndication fee')?.Amount || '—',
      },
    ],
  };
}

export function buildSpvStructureData(): SpvStructureCardComponentData {
  const keyNumbersSection = getSection('Key Numbers at a Glance');
  const ownershipSection = getSection('What You Actually Own');
  const governanceSection = getSection('Governance & Reporting');
  const [keyNumbersTable] = parseMarkdownTables(keyNumbersSection);
  const keyNumberRows = toRowMap(keyNumbersTable);
  const ownershipParagraphs = getParagraphs(ownershipSection);
  const spvAccountsLine =
    governanceSection
      .split('\n')
      .find((line) => line.toLowerCase().includes('spv accounts')) || '';
  const investorCount =
    findRow(keyNumberRows, 'Item', 'Number of investors')?.Value || '76';

  return {
    title: 'SPV structure explainer',
    whySpv: [
      stripMarkdownFormatting(spvAccountsLine.replace(/^- /, '').trim()),
      stripMarkdownFormatting(
        ownershipParagraphs.find((paragraph) =>
          paragraph.toLowerCase().includes('futurex operates')
        ) || ''
      ),
    ]
      .filter(Boolean)
      .join(' '),
    investorGroupLabel: `${investorCount} investors`,
    spvLabel: SPV_NAME,
    assetSummary: 'Land + Hotel + Lounge + Infrastructure',
    revenueRecipientLabel: 'All project revenue',
    revenueSplit: {
      investors: '70% investors',
      futurex: '30% FutureX',
    },
    diligenceQuestions: [
      'What is the reporting cadence?',
      'How are distributions approved?',
      'What happens at exit?',
      'How are investor votes handled?',
    ],
  };
}

function buildDiasporaTransferAnswer(): string {
  const section = getSection('FX & Repatriation (Diaspora Investors)');
  const paragraphs = getParagraphs(section);

  return paragraphs
    .map((paragraph) =>
      paragraph.replace(/^\*\*Exchange rate context:\*\*\s*/, '').trim()
    )
    .filter(Boolean)
    .join(' ');
}

function buildFeesAnswer(): string {
  const section = getSection("FutureX's Fee Structure — Full Transparency");
  const feeLines = section
    .split('\n')
    .filter((line) => /^\d+\./.test(line.trim()))
    .map((line) => line.trim());
  const hiddenFeeLine =
    section
      .split('\n')
      .find((line) => line.toLowerCase().includes('there are no hidden charges')) ||
    '';

  return [...feeLines, hiddenFeeLine.trim()].filter(Boolean).join(' ');
}

export function matchGuidedDealRoomQuestion(
  query: string
): GuidedDealRoomQuestionId | null {
  const normalized = query.toLowerCase();

  if (
    normalized.includes('show me the deal brief') ||
    normalized.includes('see the deal brief') ||
    normalized.includes('deal brief document')
  ) {
    return 'deal_brief';
  }

  if (
    normalized.includes('show me the spv structure explainer') ||
    normalized.includes('spv structure explainer') ||
    normalized.includes('ask about spv structure') ||
    normalized.includes('how is the spv structured') ||
    normalized.includes('spv structure')
  ) {
    return 'spv_structure';
  }

  if (
    normalized.includes('return breakdown') ||
    normalized.includes('full return') ||
    normalized.includes('expected return') ||
    normalized.includes('total proceeds') ||
    normalized.includes('multiple')
  ) {
    return 'returns_breakdown';
  }

  if (
    normalized.includes('₦5m') ||
    normalized.includes('what does my 5m') ||
    normalized.includes('5m actually own') ||
    normalized.includes('what do i own') ||
    normalized.includes('what do i get') ||
    normalized.includes('own in this spv') ||
    normalized.includes('fractional economic interest')
  ) {
    return 'ownership';
  }

  if (
    normalized.includes('revenue model') ||
    normalized.includes('revenue stream') ||
    normalized.includes('rooms') ||
    normalized.includes('restaurant') ||
    normalized.includes('lounge')
  ) {
    return 'revenue_model';
  }

  if (
    normalized.includes('risks') ||
    normalized.includes('mitigated') ||
    normalized.includes('mitigation')
  ) {
    return 'risks';
  }

  if (
    normalized.includes('year 5') ||
    normalized.includes('year five') ||
    normalized.includes('what happens at the end') ||
    normalized.includes('end of the 5-year') ||
    normalized.includes('exit')
  ) {
    return 'year_five';
  }

  if (
    normalized.includes('diaspora investor') ||
    normalized.includes('move money') ||
    normalized.includes('send money') ||
    normalized.includes('wire') ||
    normalized.includes('repatriate')
  ) {
    return 'diaspora_transfer';
  }

  if (
    normalized.includes('timeline') ||
    normalized.includes('construction') ||
    normalized.includes('operations timeline') ||
    normalized.includes('month 60')
  ) {
    return 'timeline';
  }

  if (
    normalized.includes('futurex fee') ||
    normalized.includes('fees') ||
    normalized.includes('charging') ||
    normalized.includes('how do they make money') ||
    normalized.includes('management fee') ||
    normalized.includes('syndication fee')
  ) {
    return 'fees';
  }

  return null;
}

export function buildGuidedDealRoomAnswer(
  query: string
): GuidedDealRoomAnswer | null {
  const questionId = matchGuidedDealRoomQuestion(query);

  if (!questionId) {
    return null;
  }

  switch (questionId) {
    case 'deal_brief':
      return {
        text:
          'Here is the full deal brief in one structured view so you can assess the vehicle, economics, revenue model, and capital use without leaving the chat.',
        component: {
          type: 'deal_brief',
          data: buildDealBriefData(),
        },
      };
    case 'spv_structure':
      return {
        text:
          'Here is the SPV structure explained visually, including how capital flows in, what the SPV owns, and how revenue is split.',
        component: {
          type: 'spv_structure',
          data: buildSpvStructureData(),
        },
      };
    case 'returns_breakdown':
      return {
        text:
          'The investment brief shows no Year 1 cashflow during construction, then operating distributions from Year 2 through Year 5 plus a Year 5 exit value. Here is the base-case versus upside-case breakdown per ₦5M ticket.',
        component: {
          type: 'returns_table',
          data: buildReturnsTableData(),
        },
      };
    case 'ownership':
      return {
        text:
          'A ₦5M ticket is not a room purchase. It buys a fractional economic interest in the SPV, which in turn holds the land, the completed hospitality asset, the licences, and the project revenues.',
        component: {
          type: 'ownership_card',
          data: buildOwnershipCardData(),
        },
      };
    case 'revenue_model':
      return {
        text:
          'The model in the brief is built on three revenue streams: rooms, restaurant, and lounge. The summary below shows the monthly and annual revenue base, operating costs, and the 70/30 net-profit split.',
        component: {
          type: 'revenue_chart',
          data: buildRevenueChartData(),
        },
      };
    case 'risks':
      return {
        text:
          'Here is the full risk table from the diligence brief. I have kept every listed risk and mitigation intact rather than softening the downside.',
        component: {
          type: 'risk_table',
          data: buildRiskTableData(),
        },
      };
    case 'year_five':
      return {
        text:
          'At Month 60, investors vote on the exit path. The brief frames that decision around sell, refinance, or extend, with the projected Year 5 asset value shown below.',
        component: {
          type: 'exit_card',
          data: buildExitCardData(),
        },
      };
    case 'diaspora_transfer':
      return {
        text: buildDiasporaTransferAnswer(),
      };
    case 'timeline':
      return {
        text:
          'The diligence brief lays out the journey from raise close through construction, soft launch, operations, and the Month 60 exit vote. Here is that timeline in one view.',
        component: {
          type: 'timeline_card',
          data: buildTimelineCardData(),
        },
      };
    case 'fees':
      return {
        text: buildFeesAnswer(),
      };
  }
}
