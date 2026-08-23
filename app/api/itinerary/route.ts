// app/api/itinerary/route.ts
// ─── Server-only Route Handler ────────────────────────────────────────────────
// Keeps the OpenAI API key strictly on the server; never bundled to the client.

import { NextRequest } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayActivity {
  time: string;       // e.g. "09:00 AM"
  title: string;
  description: string;
  estimatedCost: number;
  category: 'accommodation' | 'food' | 'activity' | 'transport' | 'misc';
  icon: string;       // emoji shorthand
}

export interface DayPlan {
  day: number;        // 1–7
  date: string;       // ISO date string "YYYY-MM-DD"
  theme: string;      // e.g. "Arrival & City Tour"
  totalCost: number;
  activities: DayActivity[];
  weatherAlert?: string;
}

export interface ItineraryResponse {
  destination: string;
  totalBudget: number;
  currency: string;
  days: DayPlan[];   // exactly 7 entries
  budgetSummary: {
    accommodation: number;
    food: number;
    activities: number;
    transport: number;
    misc: number;
  };
}

// ─── Fallback Mock Data ────────────────────────────────────────────────────────

function buildMockItinerary(destination: string, budget: number): ItineraryResponse {
  const startDate = new Date();
  const perDay = Math.round(budget / 7);

  const themes = [
    'Arrival & City Orientation',
    'Culture & Heritage',
    'Nature & Outdoors',
    'Food & Local Markets',
    'Day Trip & Excursion',
    'Leisure & Shopping',
    'Farewell & Departure',
  ];

  const days: DayPlan[] = themes.map((theme, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    return {
      day: i + 1,
      date: date.toISOString().split('T')[0],
      theme,
      totalCost: perDay,
      activities: [
        {
          time: '08:00 AM',
          title: 'Breakfast at local café',
          description: `Start day ${i + 1} with a hearty local breakfast in ${destination}.`,
          estimatedCost: Math.round(perDay * 0.1),
          category: 'food',
          icon: '☕',
        },
        {
          time: '10:00 AM',
          title: `${theme} experience`,
          description: `Explore the highlights of ${destination} focused on today's theme: ${theme}.`,
          estimatedCost: Math.round(perDay * 0.45),
          category: 'activity',
          icon: '🗺️',
        },
        {
          time: '01:00 PM',
          title: 'Lunch',
          description: 'Enjoy local cuisine at a recommended restaurant.',
          estimatedCost: Math.round(perDay * 0.15),
          category: 'food',
          icon: '🍽️',
        },
        {
          time: '07:00 PM',
          title: 'Dinner & Evening',
          description: 'Wind down with dinner and optional evening activity.',
          estimatedCost: Math.round(perDay * 0.3),
          category: 'food',
          icon: '🌆',
        },
      ],
    };
  });

  return {
    destination,
    totalBudget: budget,
    currency: 'USD',
    days,
    budgetSummary: {
      accommodation: Math.round(budget * 0.35),
      food: Math.round(budget * 0.25),
      activities: Math.round(budget * 0.2),
      transport: Math.round(budget * 0.12),
      misc: Math.round(budget * 0.08),
    },
  };
}

// ─── OpenAI System Prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are TravelMate's expert AI travel planner. 
Given a destination and total budget (in USD), produce a detailed 7-day travel itinerary as valid JSON.

The JSON must exactly match this TypeScript interface:

interface DayActivity {
  time: string;          // "HH:MM AM/PM"
  title: string;
  description: string;
  estimatedCost: number; // USD integer
  category: "accommodation" | "food" | "activity" | "transport" | "misc";
  icon: string;          // single emoji
}

interface DayPlan {
  day: number;           // 1–7
  date: string;          // "YYYY-MM-DD" starting from today
  theme: string;         // short day theme e.g. "Arrival & City Tour"
  totalCost: number;     // sum of activity costs for the day
  activities: DayActivity[];
  weatherAlert?: string; // optional weather tip relevant to the season
}

interface ItineraryResponse {
  destination: string;
  totalBudget: number;
  currency: "USD";
  days: DayPlan[];       // exactly 7
  budgetSummary: {
    accommodation: number;
    food: number;
    activities: number;
    transport: number;
    misc: number;
  };
}

Rules:
- The sum of budgetSummary values must equal totalBudget.
- Spread costs realistically across all 7 days.
- Include 3–5 activities per day.
- Respond with ONLY valid JSON, no markdown fences, no explanatory text.`;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { destination, budget } = body as { destination: string; budget: number };

    if (!destination || typeof budget !== 'number' || budget <= 0) {
      return Response.json(
        { error: 'destination (string) and budget (positive number) are required.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // ── No API key → return mock data immediately ──────────────────────────
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      console.warn('[TravelMate] OPENAI_API_KEY not set — returning mock itinerary.');
      return Response.json(buildMockItinerary(destination, budget));
    }

    // ── Call OpenAI ────────────────────────────────────────────────────────
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: `Plan a 7-day trip to ${destination} with a total budget of $${budget} USD.`,
          },
        ],
      }),
    });

    if (!openAIResponse.ok) {
      const errText = await openAIResponse.text();
      console.error('[TravelMate] OpenAI API error:', openAIResponse.status, errText);
      // Graceful fallback on API failure
      return Response.json(buildMockItinerary(destination, budget));
    }

    const openAIData = await openAIResponse.json();
    const rawContent: string = openAIData.choices?.[0]?.message?.content ?? '';

    let itinerary: ItineraryResponse;
    try {
      itinerary = JSON.parse(rawContent) as ItineraryResponse;
    } catch {
      console.error('[TravelMate] Failed to parse OpenAI JSON response — falling back to mock.');
      return Response.json(buildMockItinerary(destination, budget));
    }

    return Response.json(itinerary);
  } catch (error) {
    console.error('[TravelMate] /api/itinerary unexpected error:', error);
    return Response.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 },
    );
  }
}
