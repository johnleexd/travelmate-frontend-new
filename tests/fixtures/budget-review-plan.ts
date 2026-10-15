import type { DayActivity, ItineraryResponse, PriceEvidence } from '../../lib/contracts.ts';
const price = (unitAmount: number, unit: PriceEvidence['unit'] = 'per-person', participants = 2): PriceEvidence => ({ status: 'estimate', source: 'user-entered', basis: 'Recorded test estimate', fetchedAt: '2040-01-01T00:00:00Z', currency: 'PHP', unitAmount, quantity: 1, unit, participants, needsConfirmation: true });
const activity = (category: DayActivity['category'], amount: number, evidence?: PriceEvidence): DayActivity => ({ title: `Recorded ${category}`, time: 'Flexible', description: 'Recorded group expense', estimatedCost: amount, category, icon: category, priceEvidence: evidence });
export function budgetFixture(): ItineraryResponse {
  return {
    destination: 'Dumaguete, Philippines', totalBudget: 6000, currency: 'PHP', travelers: 2, partyType: 'couple',
    accommodation: { listingId: 'stay', name: 'Selected guesthouse', address: 'Dumaguete', nightlyRate: 1200, nights: 2, total: 2400, quotedTotal: 2400, rooms: 2, currency: 'PHP' },
    days: Array.from({ length: 3 }, (_, index) => ({ day: index + 1, date: `2040-01-0${index + 1}`, theme: 'Saved day', imageUrl: '', totalCost: 350 + (index < 2 ? 1200 : 0), activities: [activity('food', 200, price(100, 'daily-per-person')), activity('transport', 50, price(50, 'shared-fare')), activity('activity', 100, price(50)), activity('activity', 0, { ...price(100), quantity: 0 })] })),
    selectedTravelCosts: { flight: { id: 'flight', name: 'Selected fare', total: 1000, currency: 'PHP', fetchedAt: '2040-01-01T00:00:00Z' }, activities: [{ id: 'selected', name: 'Selected tour', unitCost: 100, travelers: 2, total: 200, currency: 'PHP', fetchedAt: '2040-01-01T00:00:00Z' }], preTrip: { airportTransferOutbound: 50, airportTransferReturn: 50, passport: 0, visaOrAuthorization: 0, departureTaxes: 0, insurance: 0, other: 0, total: 100, currency: 'PHP', source: 'user-entered-estimate' }, total: 1300 },
    budgetSummary: { accommodation: 2040, food: 1320, activities: 1200, transport: 840, reserve: 600, dailyAverage: 2000, total: 6000, plannedSpend: 99999 },
  };
}
