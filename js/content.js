// User-facing explanatory copy. Every item carries a tier and a source.
// The words "regression" and "overtired" are banned — see the spec.

const AASM = 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866';
const GALLAND = 'https://www.sciencedirect.com/science/article/abs/pii/S1087079211000682';
const IGLOW = 'https://publications.aap.org/pediatrics/article/111/2/302/66745/';
const CDC = 'https://www.cdc.gov/act-early/milestones/9-months.html';
const MERCK = 'https://www.merckmanuals.com/professional/pediatrics/symptoms-in-infants-and-children/separation-anxiety-and-stranger-anxiety';
const MOTOR = 'https://pubmed.ncbi.nlm.nih.gov/26704990/';

const COMMON = [
  { text: 'Babies often wake more in the weeks after learning something new, like pulling '
      + 'to stand. It usually settles once the new skill stops being exciting.',
    tier: 'B', source: MOTOR },
];

const BY_BAND = {
  '4-5': [
    { text: 'Most babies this age are still on three or four naps a day.', tier: 'A2', source: GALLAND },
    { text: 'Swaddling needs to stop as soon as he tries to roll.', tier: 'A1', source: AASM },
  ],
  '6-7': [
    { text: 'Naps usually settle toward two or three a day over the next couple of months.',
      tier: 'A2', source: GALLAND },
    { text: 'Around six months, total sleep averages a little over fourteen hours, but the '
        + 'normal range is enormous — roughly ten to eighteen hours.', tier: 'A2', source: IGLOW },
  ],
  '8-9': [
    { text: 'Two naps a day is the average at this age, though anywhere from one to three '
        + 'is within the normal range.', tier: 'A2', source: GALLAND },
    { text: 'About one waking a night is average right now, and up to three is still normal. '
        + 'Roughly eight in ten babies this age still wake at night.', tier: 'A2', source: GALLAND },
    { text: 'Separation anxiety usually starts around eight months and builds toward a peak '
        + 'between ten and eighteen months. It is a normal part of development.',
      tier: 'A1', source: MERCK },
    { text: 'Pulling to stand and cruising often show up in the next month or two.',
      tier: 'A1', source: CDC },
    ...COMMON,
  ],
  '10-11': [
    { text: 'Total sleep drifts down slowly now — around five minutes less per month.',
      tier: 'A2', source: GALLAND },
    { text: 'Separation anxiety is usually near its peak between ten and eighteen months.',
      tier: 'A1', source: MERCK },
    ...COMMON,
  ],
  '12-14': [
    { text: 'The move from two naps to one usually happens somewhere between twelve and '
        + 'eighteen months. Two naps at fourteen months is completely normal.',
      tier: 'A2', source: IGLOW },
    ...COMMON,
  ],
  '15-17': [
    { text: 'Most children are on a single midday nap by now, though some keep two well '
        + 'past eighteen months.', tier: 'A2', source: IGLOW },
    ...COMMON,
  ],
  '18-24': [
    { text: 'A nap that ends late in the afternoon can push bedtime later and shorten the night.',
      tier: 'B', source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4899693/' },
    { text: 'Almost all children this age still nap — fewer than one in forty have stopped '
        + 'before their second birthday.', tier: 'A2', source: IGLOW },
  ],
};

export function expectationsFor(bandKey) {
  return BY_BAND[bandKey] ?? COMMON;
}
