'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Activity {
  name: string;
  img: string;
}

interface DayPlan {
  day: number;
  title: string;
  date: string;
  budget: string;
  activities: Activity[];
}

interface TimelineActivity {
  time: string;
  name: string;
  desc: string;
  bullets: string[];
  img: string;
  cost: string;
}

interface DetailedDayPlan {
  day: number;
  title: string;
  date: string;
  timeRange: string;
  activities: TimelineActivity[];
  tips: string[];
  totalTime: string;
  totalCost: string;
}

interface FullDayActivity {
  time: string;
  name: string;
  duration: string;
  cost: string;
  desc: string;
  cardStyle: string;
}

interface FullDayPlan {
  day: number;
  title: string;
  location: string;
  coverImg: string;
  totalTime: string;
  totalCost: string;
  activitiesCount: number;
  activities: FullDayActivity[];
}

export default function Dashboard() {
  const router = useRouter();

  // Navigation & Feature Tab state
  const [activeTab, setActiveTab] = useState<'planner' | 'budget' | 'price' | 'weather'>('planner');
  const [destination, setDestination] = useState('Prague, Czech Republic');
  const [budget, setBudget] = useState('700');

  // Price Compare tab state & data
  const [priceSort, setPriceSort] = useState<'rating' | 'price' | 'visits'>('rating');
  const [priceCategory, setPriceCategory] = useState<string>('All');

  // Detailed Day Modal / View state
  const [activeDayView, setActiveDayView] = useState<number | null>(null);

  interface Venue {
    id: number;
    name: string;
    category: string;
    tag: string;
    subtitle: string;
    isTopPick?: boolean;
    rating: number;
    stars: string;
    avgMeal: number;
    visits: number;
    visitsFormatted: string;
  }

  const venuesData: Venue[] = [
    {
      id: 1,
      name: 'Hemingway Bar',
      category: 'Cocktails',
      tag: 'Bar',
      subtitle: 'Cocktails · Bar',
      isTopPick: true,
      rating: 4.9,
      stars: '★★★★★',
      avgMeal: 24,
      visits: 1892,
      visitsFormatted: '1,892'
    },
    {
      id: 2,
      name: 'Lokál Dlouhááá',
      category: 'Czech',
      tag: 'Restaurant',
      subtitle: 'Czech · Restaurant',
      rating: 4.8,
      stars: '★★★★☆',
      avgMeal: 16,
      visits: 3102,
      visitsFormatted: '3,102'
    },
    {
      id: 3,
      name: 'Old Town Square Café',
      category: 'Czech',
      tag: 'Restaurant',
      subtitle: 'Czech · Restaurant',
      rating: 4.7,
      stars: '★★★★☆',
      avgMeal: 18,
      visits: 2341,
      visitsFormatted: '2,341'
    },
    {
      id: 4,
      name: 'Café Imperial',
      category: 'European',
      tag: 'Restaurant',
      subtitle: 'European · Restaurant',
      rating: 4.7,
      stars: '★★★★☆',
      avgMeal: 28,
      visits: 1445,
      visitsFormatted: '1,445'
    },
    {
      id: 5,
      name: 'Prague Beer Museum',
      category: 'Beer Hall',
      tag: 'Bar',
      subtitle: 'Beer Hall · Bar',
      rating: 4.6,
      stars: '★★★★☆',
      avgMeal: 12,
      visits: 2567,
      visitsFormatted: '2,567'
    },
    {
      id: 6,
      name: 'SaSaZu',
      category: 'Asian Fusion',
      tag: 'Restaurant',
      subtitle: 'Asian Fusion · Restaurant',
      rating: 4.5,
      stars: '★★★★☆',
      avgMeal: 32,
      visits: 987,
      visitsFormatted: '987'
    }
  ];

  interface CardDayPlan {
    day: number;
    title: string;
    location: string;
    date: string;
    dailyBudget: string;
    bullets: string[];
    img: string;
  }

  // 7-Day Itinerary Cards Data
  const itineraryDaysCards: CardDayPlan[] = [
    {
      day: 1,
      title: 'Arrival & Old Town',
      location: '📍 Prague',
      date: 'June 10, 2026',
      dailyBudget: '$120',
      bullets: ['Charles Bridge sunrise', 'Prague Castle tour', 'Dinner at Lokál'],
      img: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=500&auto=format&fit=crop&q=60'
    },
    {
      day: 2,
      title: 'Art & Architecture',
      location: '📍 Prague',
      date: 'June 11, 2026',
      dailyBudget: '$90',
      bullets: ['Mucha Museum', 'Dancing House visit', 'Jazz club evening'],
      img: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=500&auto=format&fit=crop&q=60'
    },
    {
      day: 3,
      title: 'Day Trip',
      location: '📍 Kutná Hora',
      date: 'June 12, 2026',
      dailyBudget: '$75',
      bullets: ['Bone Church tour', 'St. Barbara Cathedral', 'Wine tasting'],
      img: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?w=500&auto=format&fit=crop&q=60'
    },
    {
      day: 4,
      title: 'River & Parks',
      location: '📍 Prague',
      date: 'June 13, 2026',
      dailyBudget: '$85',
      bullets: ['Vltava cruise', 'Stromovka picnic', 'Farmers market'],
      img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&auto=format&fit=crop&q=60'
    },
    {
      day: 5,
      title: 'Underground Prague',
      location: '📍 Prague',
      date: 'June 14, 2026',
      dailyBudget: '$110',
      bullets: ['Medieval tunnels', 'Old Town Hall tower', 'Beer hall tasting'],
      img: 'https://images.unsplash.com/photo-1592906209472-a36b1f3782ef?w=500&auto=format&fit=crop&q=60'
    },
    {
      day: 6,
      title: 'Culinary Deep Dive',
      location: '📍 Prague',
      date: 'June 15, 2026',
      dailyBudget: '$120',
      bullets: ['Cooking class', 'Havelska market', 'Fine dining dinner'],
      img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=60'
    },
    {
      day: 7,
      title: 'Departure Day',
      location: '📍 Prague',
      date: 'June 16, 2026',
      dailyBudget: '$100',
      bullets: ['Souvenir shopping', 'Petrin Hill outlook', 'Airport express transfer'],
      img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=500&auto=format&fit=crop&q=60'
    }
  ];

  const detailedDayPlans: Record<number, FullDayPlan> = {
    1: {
      day: 1,
      title: 'Arrival & Old Town',
      location: '📍 Prague',
      coverImg: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&auto=format&fit=crop&q=80',
      totalTime: '8 hrs',
      totalCost: '$75',
      activitiesCount: 4,
      activities: [
        {
          time: '7:00 AM',
          name: 'Charles Bridge Sunrise Walk',
          duration: '1.5 hrs',
          cost: 'FREE',
          desc: "Experience the golden hour at Prague's iconic 14th-century Gothic bridge flanked by 30 Baroque statues.",
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '9:30 AM',
          name: 'Prague Castle Complex',
          duration: '3 hrs',
          cost: '$15',
          desc: 'Explore the largest ancient castle complex in the world — St. Vitus Cathedral, Old Royal Palace, and Golden Lane.',
          cardStyle: 'bg-[#10222a] border-teal-900/40'
        },
        {
          time: '1:00 PM',
          name: 'Old Town Hall & Astronomical Clock',
          duration: '2 hrs',
          cost: '$20',
          desc: 'Watch the hourly procession of Apostles and ascend the medieval tower for panoramic views of Prague.',
          cardStyle: 'bg-[#161a29] border-slate-800'
        },
        {
          time: '5:30 PM',
          name: 'Traditional Dinner at Lokál',
          duration: '1.5 hrs',
          cost: '$40',
          desc: 'Enjoy authentic Czech goulash, bread dumplings, and freshly poured unpasteurized Pilsner Urquell.',
          cardStyle: 'bg-[#1c1815] border-amber-900/30'
        }
      ]
    },
    2: {
      day: 2,
      title: 'Art & Architecture',
      location: '📍 Prague',
      coverImg: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&auto=format&fit=crop&q=80',
      totalTime: '7.5 hrs',
      totalCost: '$90',
      activitiesCount: 3,
      activities: [
        {
          time: '10:00 AM',
          name: 'Mucha Museum',
          duration: '2 hrs',
          cost: '$18',
          desc: 'Discover the legendary Art Nouveau masterpieces of Alphonse Mucha in central Prague.',
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '1:00 PM',
          name: 'Dancing House Visit & View',
          duration: '1.5 hrs',
          cost: '$12',
          desc: "Admire Frank Gehry's deconstructivist landmark on the Vltava riverfront and enjoy rooftop drinks.",
          cardStyle: 'bg-[#10222a] border-teal-900/40'
        },
        {
          time: '7:00 PM',
          name: 'Reduta Jazz Club Evening',
          duration: '4 hrs',
          cost: '$60',
          desc: "Experience live vintage jazz in one of Europe's oldest continuous jazz venues.",
          cardStyle: 'bg-[#161a29] border-slate-800'
        }
      ]
    },
    3: {
      day: 3,
      title: 'Day Trip',
      location: '📍 Kutná Hora',
      coverImg: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?w=800&auto=format&fit=crop&q=80',
      totalTime: '9 hrs',
      totalCost: '$75',
      activitiesCount: 3,
      activities: [
        {
          time: '9:00 AM',
          name: 'Sedlec Ossuary (Bone Church)',
          duration: '2 hrs',
          cost: '$15',
          desc: 'Visit the famous chapel artistic arrangement of skeletons from over 40,000 human bones.',
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '12:00 PM',
          name: 'St. Barbara Cathedral',
          duration: '2.5 hrs',
          cost: '$15',
          desc: 'Tour the dramatic 5-gabled Gothic UNESCO masterpiece built by silver miners.',
          cardStyle: 'bg-[#10222a] border-teal-900/40'
        },
        {
          time: '3:30 PM',
          name: 'Bohemian Wine Tasting',
          duration: '2.5 hrs',
          cost: '$45',
          desc: 'Sample regional Czech wines paired with local goat cheese at a historic vineyard estate.',
          cardStyle: 'bg-[#1c1815] border-amber-900/30'
        }
      ]
    },
    4: {
      day: 4,
      title: 'River & Parks',
      location: '📍 Prague',
      coverImg: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80',
      totalTime: '6.5 hrs',
      totalCost: '$85',
      activitiesCount: 3,
      activities: [
        {
          time: '11:00 AM',
          name: 'Vltava River Cruise',
          duration: '1.5 hrs',
          cost: '$25',
          desc: "Glide past Prague's historic bridges and riverside chateaus on a solar-powered wooden boat.",
          cardStyle: 'bg-[#10222a] border-teal-900/40'
        },
        {
          time: '2:00 PM',
          name: 'Stromovka Park Picnic',
          duration: '2.5 hrs',
          cost: '$20',
          desc: 'Relax in the royal hunting grounds turned park with fresh artisanal deli products.',
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '5:30 PM',
          name: 'Naplavka Farmers Market',
          duration: '2.5 hrs',
          cost: '$40',
          desc: 'Sample local street food, draft beer, and live music on the lively riverbank promenade.',
          cardStyle: 'bg-[#161a29] border-slate-800'
        }
      ]
    },
    5: {
      day: 5,
      title: 'Underground Prague',
      location: '📍 Prague',
      coverImg: 'https://images.unsplash.com/photo-1592906209472-a36b1f3782ef?w=800&auto=format&fit=crop&q=80',
      totalTime: '8 hrs',
      totalCost: '$110',
      activitiesCount: 3,
      activities: [
        {
          time: '10:00 AM',
          name: 'Medieval Tunnels Exploration',
          duration: '2.5 hrs',
          cost: '$30',
          desc: 'Descend into 12th-century Romanesque cellars beneath Old Town Square.',
          cardStyle: 'bg-[#161a29] border-slate-800'
        },
        {
          time: '2:00 PM',
          name: 'Old Town Hall Tower Ascent',
          duration: '2 hrs',
          cost: '$20',
          desc: "Climb the iconic tower spiral ramp for breathtaking views across Prague's red-tiled roofs.",
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '6:00 PM',
          name: 'Historic Beer Hall Tasting',
          duration: '3.5 hrs',
          cost: '$60',
          desc: 'Tour a 500-year-old brewery cellar with unpasteurized tank beer and hearty Czech platters.',
          cardStyle: 'bg-[#1c1815] border-amber-900/30'
        }
      ]
    },
    6: {
      day: 6,
      title: 'Culinary Deep Dive',
      location: '📍 Prague',
      coverImg: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      totalTime: '8.5 hrs',
      totalCost: '$120',
      activitiesCount: 3,
      activities: [
        {
          time: '9:30 AM',
          name: 'Czech Cooking Masterclass',
          duration: '3 hrs',
          cost: '$55',
          desc: 'Hands-on workshop preparing svíčková cream sauce and traditional fruit dumplings from scratch.',
          cardStyle: 'bg-[#10222a] border-teal-900/40'
        },
        {
          time: '1:30 PM',
          name: 'Havelska Market Spice Tour',
          duration: '2 hrs',
          cost: '$15',
          desc: 'Browse open-air wooden stalls selling regional honey, marionettes, and gingerbread.',
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '7:00 PM',
          name: 'Fine Dining at Field Restaurant',
          duration: '3.5 hrs',
          cost: '$50',
          desc: 'Indulge in Michelin-starred modern Czech gastronomy with seasonal wine pairings.',
          cardStyle: 'bg-[#161a29] border-slate-800'
        }
      ]
    },
    7: {
      day: 7,
      title: 'Departure Day',
      location: '📍 Prague',
      coverImg: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=80',
      totalTime: '6 hrs',
      totalCost: '$100',
      activitiesCount: 3,
      activities: [
        {
          time: '9:00 AM',
          name: 'Manufaktura Souvenir Shopping',
          duration: '2 hrs',
          cost: '$45',
          desc: 'Purchase handcrafted beer cosmetics, wooden toys, and Bohemian crystal glassware.',
          cardStyle: 'bg-[#1a1c17] border-amber-900/40'
        },
        {
          time: '11:30 AM',
          name: 'Petrin Hill Funicular & Outlook',
          duration: '2 hrs',
          cost: '$25',
          desc: "Ride the funicular railway through rose gardens and climb Prague's miniature Eiffel Tower.",
          cardStyle: 'bg-[#10222a] border-teal-900/40'
        },
        {
          time: '2:30 PM',
          name: 'Airport Express Transfer',
          duration: '2 hrs',
          cost: '$30',
          desc: 'Direct executive shuttle to Prague Vaclav Havel Airport (PRG) for return flights.',
          cardStyle: 'bg-[#161a29] border-slate-800'
        }
      ]
    }
  };

  const getFullDayPlan = (dayNum: number): FullDayPlan => {
    return detailedDayPlans[dayNum] || detailedDayPlans[1];
  };

  // Close modal on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDayView(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/');
  };

  const activeModalPlan = activeDayView !== null ? getFullDayPlan(activeDayView) : null;

  return (
    <div className="min-h-screen w-full bg-[#020617] text-slate-100 font-sans flex flex-col">
      {/* ── 1. Top Navigation Bar (Authenticated State) ── */}
      <header className="border-b border-slate-800/80 bg-[#020617]/90 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 font-bold text-base shadow-md shadow-amber-400/20">
              🧭
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              Travel<span className="text-white">Mate</span>
            </span>
          </div>
        </div>

        {/* Center Role Switcher Pill */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-full p-1 flex items-center gap-1 shadow-inner">
          <button
            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-slate-800 text-slate-100 shadow-sm flex items-center gap-1.5"
          >
            <span>🧭</span> Traveller
          </button>
          <button
            onClick={() => {
              document.cookie = 'user_role=owner; path=/;';
              router.push('/owner/dashboard');
            }}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🏨</span> Owner
          </button>
          <button
            onClick={() => {
              document.cookie = 'user_role=admin; path=/;';
              router.push('/admin/dashboard');
            }}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🛡️</span> Admin
          </button>
        </div>

        {/* Right User Info & Logout Button */}
        <div className="flex items-center gap-4">
          <span className="hidden md:inline-block text-xs font-mono text-slate-400">
            demo@travelmate.io
          </span>
          <button
            onClick={handleLogout}
            className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>[→</span> Logout
          </button>
        </div>
      </header>

      {/* ── 2. Main Feature Tabs Navigation ── */}
      <div className="border-b border-slate-800/80 bg-[#020617] px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('planner')}
            className={`py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'planner'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⚡</span> AI Planner
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'budget'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>$</span> Budget
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'price'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📊</span> Price Compare
          </button>
          <button
            onClick={() => setActiveTab('weather')}
            className={`py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'weather'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>☁</span> Weather
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8">
        {/* Tab 1: AI Planner */}
        {activeTab === 'planner' && (
          <>
            {/* ── 3. Hero Generator Banner ── */}
            <div className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden p-6 md:p-8 flex flex-col justify-between shadow-2xl border border-slate-800/80">
              {/* Dark City/Mountain Background */}
              <div className="absolute inset-0 z-0">
                <Image
                  src="https://images.unsplash.com/photo-1541849546-216549ae216d?w=1400&auto=format&fit=crop&q=80"
                  alt="City Backdrop"
                  fill
                  className="object-cover object-center"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/95 via-[#020617]/85 to-[#020617]/60" />
              </div>

              {/* Banner Content */}
              <div className="relative z-10 flex flex-col items-start gap-1">
                <span className="text-amber-400 text-xs font-mono font-bold tracking-widest uppercase">
                  AI-POWERED ITINERARY GENERATOR
                </span>
                <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Plan Your Perfect 7 Days
                </h1>
              </div>

              {/* Input Controls Bar */}
              <div className="relative z-10 mt-6 flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full">
                {/* Destination Input */}
                <div className="flex-1 w-full bg-[#0a0f1d]/90 backdrop-blur-md border border-slate-700/60 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
                  <span className="text-amber-400 text-base">📍</span>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Where do you want to go?"
                    className="w-full bg-transparent border-none outline-none text-slate-100 text-sm font-semibold placeholder-slate-500"
                  />
                </div>

                {/* Budget Input */}
                <div className="w-full md:w-36 lg:w-40 bg-[#0a0f1d]/90 backdrop-blur-md border border-slate-700/60 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg shrink-0">
                  <span className="text-emerald-400 text-base font-bold">$</span>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="700"
                    className="w-full bg-transparent border-none outline-none text-slate-100 text-sm font-bold placeholder-slate-500"
                  />
                </div>

                {/* Action Button */}
                <button
                  onClick={() => alert(`Generating new 7-day plan for ${destination} with $${budget} budget...`)}
                  className="w-full md:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-400/20 cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>⚡</span> Generate
                </button>
              </div>
            </div>

            {/* ── 4. Generated 7-Day Itinerary Grid ── */}
            <div className="flex flex-col gap-6">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-800/60">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">
                    Your 7-Day Prague Itinerary
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    ${budget} total budget &middot; ${budget} allocated &middot; click any day for full details
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block">
                    BUDGET USED
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-amber-400 leading-none">
                    100%
                  </span>
                </div>
              </div>

              {/* 7-Day Photo Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {itineraryDaysCards.map((item) => (
                  <div
                    key={item.day}
                    className="bg-[#0b101d] border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col justify-between p-0 shadow-xl transition-all duration-300 hover:border-slate-700"
                  >
                    {/* Top Image Banner */}
                    <div className="relative w-full aspect-[16/9] bg-slate-950 overflow-hidden">
                      <Image
                        src={item.img}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 320px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0b101d] via-[#0b101d]/40 to-transparent" />

                      {/* Gold Day Badge Top Left */}
                      <div className="absolute top-3 left-3 bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider px-2 py-0.5 rounded-md shadow uppercase">
                        DAY {item.day}
                      </div>

                      {/* Title & Location Bottom Left of Image */}
                      <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-0.5">
                        <h3 className="text-base font-bold text-white leading-snug drop-shadow">
                          {item.title}
                        </h3>
                        <span className="text-xs text-slate-300 font-medium">
                          {item.location}
                        </span>
                      </div>
                    </div>

                    {/* Middle Activity Bullets Preview & Bottom Budget/CTA Bar */}
                    <div className="p-4 flex flex-col justify-between flex-1 gap-4 bg-[#0b101d]">
                      <div className="flex flex-col gap-2">
                        {item.bullets.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                            <span className="text-cyan-400/80 font-mono text-[11px] font-bold">&gt;</span>
                            <span className="truncate">{bullet}</span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Daily Budget Bar & CTA Button */}
                      <div className="pt-3 border-t border-slate-800/60 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                            DAILY BUDGET
                          </span>
                          <span className="text-sm font-extrabold text-amber-400">
                            {item.dailyBudget}
                          </span>
                        </div>

                        <button
                          onClick={() => setActiveDayView(item.day)}
                          className="w-full bg-[#172033] hover:bg-amber-400 hover:text-slate-950 text-amber-400 font-bold text-xs py-2.5 px-4 rounded-xl border border-amber-400/20 transition-all cursor-pointer text-center block shadow-sm"
                        >
                          View Itinerary &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Budget */}
        {activeTab === 'budget' && (
          <div className="flex flex-col gap-6 w-full">
            {/* 1. Section Header & Overall Status */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-800/60">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Budget Algorithm
                </h2>
                <p className="text-xs md:text-sm text-slate-400 font-medium mt-1">
                  Mathematical split of your ${budget} total across 7 days and spend categories
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block">
                  BUDGET USED
                </span>
                <span className="text-2xl md:text-3xl font-black text-amber-400 leading-none">
                  100%
                </span>
              </div>
            </div>

            {/* 2. 4-Column Financial Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Budget */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    TOTAL BUDGET
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                    $
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-extrabold text-white block">${budget}</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">7-day Prague trip</span>
                </div>
              </div>

              {/* Card 2: Daily Average */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    DAILY AVERAGE
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                    📅
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-extrabold text-white block">$100</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">Per day allocation</span>
                </div>
              </div>

              {/* Card 3: Allocated */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    ALLOCATED
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-400/10 border border-purple-400/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                    📈
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-extrabold text-white block">${budget}</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">Across 7 days</span>
                </div>
              </div>

              {/* Card 4: Buffer */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    BUFFER
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    ⚡
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-extrabold text-white block">$0</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">Emergency reserve</span>
                </div>
              </div>
            </div>

            {/* 3. Progress Bar & Spend Section */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-3 shadow-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">Overall budget utilisation</span>
                <span className="font-mono font-bold text-amber-400">100% of ${budget}</span>
              </div>
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div className="bg-amber-400 h-full rounded-full w-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Spend by Category Card */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">
                <h3 className="text-base font-bold text-white">Spend by Category</h3>
                
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Accommodation</span>
                      <span className="font-mono font-bold text-amber-400">$280 &middot; 40%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-amber-400 h-full rounded-full w-[40%]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Food & Dining</span>
                      <span className="font-mono font-bold text-cyan-400">$210 &middot; 30%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-cyan-400 h-full rounded-full w-[30%]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Activities & Tours</span>
                      <span className="font-mono font-bold text-purple-400">$140 &middot; 20%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-purple-400 h-full rounded-full w-[20%]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Transport</span>
                      <span className="font-mono font-bold text-emerald-400">$70 &middot; 10%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-emerald-400 h-full rounded-full w-[10%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Spend Distribution Card (Bar Chart) */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[260px]">
                <h3 className="text-base font-bold text-white">Daily Spend Distribution</h3>

                {/* Bar Chart Bars Container */}
                <div className="flex items-end justify-between gap-2 h-44 pt-4 px-2 relative border-b border-slate-800/80">
                  {/* Grid background lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 text-[10px] font-mono text-slate-500">
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>160</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>120</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>80</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>40</span></div>
                  </div>

                  {/* Day Bars */}
                  {[
                    { day: 1, val: 120, label: 'D1' },
                    { day: 2, val: 90, label: 'D2' },
                    { day: 3, val: 75, label: 'D3' },
                    { day: 4, val: 85, label: 'D4' },
                    { day: 5, val: 110, label: 'D5' },
                    { day: 6, val: 145, label: 'D6' },
                    { day: 7, val: 75, label: 'D7' }
                  ].map((bar) => (
                    <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 z-10">
                      <div
                        className="w-full max-w-[28px] bg-amber-400 hover:bg-amber-300 rounded-t-md transition-all cursor-pointer shadow-md shadow-amber-400/10"
                        style={{ height: `${(bar.val / 160) * 100}%` }}
                        title={`Day ${bar.day}: $${bar.val}`}
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-400">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Day-by-Day Budget Breakdown List (Bottom Card Container) */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-xl">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                <h3 className="text-lg md:text-xl font-bold text-white">Day-by-Day Breakdown</h3>
                <span className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase">
                  7 DAYS TOTAL
                </span>
              </div>

              <div className="flex flex-col divide-y divide-slate-800/60">
                {[
                  { day: 1, title: 'Arrival & Old Town', location: 'Prague', highlights: '> Charles > Prague > Dinner', budget: '$120', percent: '17%' },
                  { day: 2, title: 'Art & Architecture', location: 'Prague', highlights: '> Mucha > Dancing > Jazz', budget: '$90', percent: '13%' },
                  { day: 3, title: 'Day Trip', location: 'Kutná Hora', highlights: '> Bone > St. > Wine', budget: '$75', percent: '11%' },
                  { day: 4, title: 'River & Parks', location: 'Prague', highlights: '> Vltava > Stromovka > Farmers', budget: '$85', percent: '12%' },
                  { day: 5, title: 'Underground Prague', location: 'Prague', highlights: '> Medieval > Žižkov > Rooftop', budget: '$110', percent: '16%' },
                  { day: 6, title: 'Culinary Deep Dive', location: 'Prague', highlights: '> Cooking > Wine > Tasting', budget: '$145', percent: '21%' },
                  { day: 7, title: 'Departure Day', location: 'Prague', highlights: '> Souvenir > Final > Airport', budget: '$75', percent: '11%' }
                ].map((item) => (
                  <div key={item.day} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left Day Badge & Title */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1c2436] border border-amber-400/30 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                        {item.day}
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        <span className="text-xs text-slate-400 font-medium">{item.location}</span>
                      </div>
                    </div>

                    {/* Right Activity Highlights & Mini Progress Bar */}
                    <div className="flex items-center gap-4 md:gap-6 justify-between sm:justify-end flex-1">
                      <span className="text-xs text-slate-400 font-medium hidden md:inline-block font-mono">
                        {item.highlights}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-20 md:w-28 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div className="bg-amber-400 h-full rounded-full" style={{ width: item.percent }} />
                        </div>
                        <span className="text-sm font-extrabold text-amber-400 font-mono w-12 text-right">
                          {item.budget}
                        </span>
                        <span className="text-xs font-mono text-slate-500 w-8 text-right">
                          {item.percent}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Price Compare */}
        {activeTab === 'price' && (
          <div className="flex flex-col gap-6 w-full">
            {/* 1. Section Header & Sorting Controls */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-800/60">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Prague Local Price Index
                </h2>
                <p className="text-xs md:text-sm text-slate-400 font-medium mt-1">
                  Real-time comparison of restaurants, bars, and local venues
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase mr-1">
                  SORT
                </span>
                <button
                  onClick={() => setPriceSort('rating')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    priceSort === 'rating'
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Rating
                </button>
                <button
                  onClick={() => setPriceSort('price')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    priceSort === 'price'
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Price
                </button>
                <button
                  onClick={() => setPriceSort('visits')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    priceSort === 'visits'
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Visits
                </button>
              </div>
            </div>

            {/* 2. Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              {['All', 'Czech', 'Cocktails', 'Asian Fusion', 'Beer Hall', 'European'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPriceCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    priceCategory === cat
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                      : 'bg-[#0b101d] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 3. Quick Summary Metrics Row (3 Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center justify-center shadow-xl">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  AVG MEAL
                </span>
                <span className="text-2xl font-extrabold text-cyan-400 mt-2 font-mono">
                  $22
                </span>
              </div>
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center justify-center shadow-xl">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  TOP VENUE
                </span>
                <span className="text-xl font-bold text-white mt-2">
                  Hemingway Bar
                </span>
              </div>
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center justify-center shadow-xl">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  VENUES SHOWN
                </span>
                <span className="text-2xl font-black text-amber-400 mt-2 font-mono">
                  6
                </span>
              </div>
            </div>

            {/* 4. Venue Cards Grid (3 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {venuesData
                .filter(v => priceCategory === 'All' || v.category === priceCategory)
                .sort((a, b) => {
                  if (priceSort === 'price') return a.avgMeal - b.avgMeal;
                  if (priceSort === 'visits') return b.visits - a.visits;
                  return b.rating - a.rating;
                })
                .map((venue) => (
                  <div
                    key={venue.id}
                    className={`bg-[#0b101d] rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-slate-700 ${
                      venue.isTopPick ? 'border-2 border-amber-400/60' : 'border border-slate-800/80'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex justify-between items-start mb-2">
                        {venue.isTopPick ? (
                          <span className="text-amber-400 text-xs font-bold tracking-wider flex items-center gap-1 uppercase">
                            ⭐ TOP PICK
                          </span>
                        ) : (
                          <div />
                        )}
                        <span className="bg-slate-800/80 text-slate-400 text-[10px] font-semibold px-3 py-1 rounded-full border border-slate-700/60">
                          {venue.tag}
                        </span>
                      </div>

                      {/* Title & Category Subtitle */}
                      <h3 className="text-base font-bold text-white leading-snug">{venue.name}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{venue.subtitle}</p>

                      {/* Stars */}
                      <div className="text-amber-400 text-sm mt-3 tracking-widest">
                        {venue.stars}
                      </div>
                    </div>

                    {/* Footer Metrics Row */}
                    <div className="pt-4 mt-4 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-left">
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase block">Rating</span>
                        <span className="text-sm font-bold text-amber-400">{venue.rating}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase block">Avg Meal</span>
                        <span className="text-sm font-bold text-cyan-400 font-mono">${venue.avgMeal}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase block">Visits/mo</span>
                        <span className="text-sm font-bold text-white font-mono">{venue.visitsFormatted}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* 5. Full Comparison Table Container (Bottom Section) */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-xl">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                <h3 className="text-lg md:text-xl font-bold text-white">Full Comparison Table</h3>
                <span className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase">
                  6 VENUES
                </span>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[600px] flex flex-col">
                  {/* Table Header */}
                  <div className="grid grid-cols-5 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase pb-3 border-b border-slate-800/80 px-4">
                    <div>VENUE</div>
                    <div>CATEGORY</div>
                    <div className="text-right">RATING</div>
                    <div className="text-right">AVG MEAL</div>
                    <div className="text-right">VISITS/MO</div>
                  </div>

                  {/* Table Rows */}
                  <div className="flex flex-col divide-y divide-slate-800/60">
                    {venuesData.map((v) => (
                      <div key={v.id} className="grid grid-cols-5 py-4 px-4 items-center text-xs">
                        <div className="font-bold text-white">{v.name}</div>
                        <div className="text-slate-400 font-medium">{v.category}</div>
                        <div className="text-right font-extrabold text-amber-400">{v.rating}</div>
                        <div className="text-right font-bold text-cyan-400 font-mono">${v.avgMeal}</div>
                        <div className="text-right font-semibold text-slate-300 font-mono">{v.visitsFormatted}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Weather */}
        {activeTab === 'weather' && (
          <div className="flex flex-col gap-6 w-full">
            {/* 1. Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-800/60">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Live Weather — Prague
                </h2>
                <p className="text-xs md:text-sm text-slate-400 font-medium mt-1">
                  Real-time data via OpenWeatherMap API &middot; Updated 2 minutes ago
                </p>
              </div>

              <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold px-3.5 py-1.5 rounded-full flex items-center gap-2 self-start sm:self-auto shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                API LIVE
              </div>
            </div>

            {/* 2. Top Row (Current Conditions & Live Weather Alerts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Card: Current Conditions */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-xl relative min-h-[310px]">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                        CURRENT CONDITIONS
                      </span>
                      <h3 className="text-2xl font-bold text-white mt-1">Prague</h3>
                      <span className="text-xs text-slate-400 font-medium">Czech Republic &middot; Central Europe</span>
                    </div>

                    {/* Sun Icon */}
                    <div className="text-amber-400 text-4xl">
                      ☀️
                    </div>
                  </div>

                  <div className="mt-6">
                    <span className="text-5xl md:text-6xl font-black text-white leading-none font-serif block">
                      22°
                    </span>
                    <span className="text-xs text-slate-400 font-medium mt-2 block">
                      Clear Sky &middot; Feels like 24°C
                    </span>
                  </div>
                </div>

                {/* Bottom Metrics Divider Row */}
                <div className="pt-4 mt-6 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">💧 Humidity</span>
                    <span className="text-sm font-bold text-white font-mono mt-1 block">45%</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">💨 Wind</span>
                    <span className="text-sm font-bold text-white font-mono mt-1 block">12 km/h</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">🌡️ High / Low</span>
                    <span className="text-sm font-bold text-white font-mono mt-1 block">22 / 14°C</span>
                  </div>
                </div>
              </div>

              {/* Right Card: Live Weather Alerts Container */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-xl min-h-[310px]">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Live Weather Alerts</h3>

                  <div className="flex flex-col gap-3">
                    {/* Alert 1 (Amber Warning) */}
                    <div className="bg-[#191612] border border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
                      <span className="text-amber-400 text-sm mt-0.5">⚠️</span>
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-xs text-slate-300 font-normal leading-relaxed">
                          Light rain expected Wednesday afternoon. Pack a compact umbrella for Day 3.
                        </p>
                        <span className="text-xs font-mono font-bold text-amber-400">Active</span>
                      </div>
                    </div>

                    {/* Alert 2 (Blue Info) */}
                    <div className="bg-[#101b2a] border border-blue-900/40 rounded-2xl p-4 flex items-start gap-3">
                      <span className="text-blue-400 text-sm mt-0.5">ℹ️</span>
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-xs text-slate-300 font-normal leading-relaxed">
                          Weekend looks excellent — ideal for outdoor sightseeing on Days 5–6.
                        </p>
                        <span className="text-xs font-mono font-bold text-blue-400">Active</span>
                      </div>
                    </div>

                    {/* Alert 3 (Green Success) */}
                    <div className="bg-[#0d1d1a] border border-emerald-900/40 rounded-2xl p-4 flex items-start gap-3">
                      <span className="text-emerald-400 text-sm mt-0.5">✅</span>
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-xs text-slate-300 font-normal leading-relaxed">
                          No extreme weather warnings for your entire 7-day trip window.
                        </p>
                        <span className="text-xs font-mono font-bold text-emerald-400">Cleared</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/40 text-[10px] font-mono text-slate-500 flex items-center gap-2">
                  <span>📡 OpenWeatherMap &middot; API key: owm_****8f2a</span>
                </div>
              </div>
            </div>

            {/* 3. Middle Section: Today's Hourly Breakdown */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-4 shadow-xl">
              <h3 className="text-lg font-bold text-white">Today&apos;s Hourly Breakdown</h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { time: '9 AM', icon: '☁️', temp: '18°' },
                  { time: '12 PM', icon: '☀️', temp: '22°' },
                  { time: '3 PM', icon: '☀️', temp: '23°' },
                  { time: '6 PM', icon: '☁️', temp: '21°' },
                  { time: '9 PM', icon: '☁️', temp: '17°' },
                  { time: '12 AM', icon: '☁️', temp: '14°' }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#121929] border border-slate-800/80 rounded-xl p-4 flex flex-col items-center gap-2 text-center shadow-sm hover:border-slate-700 transition-all"
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-400">{item.time}</span>
                    <span className="text-2xl my-1">{item.icon}</span>
                    <span className="text-base font-extrabold text-white">{item.temp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Bottom Section: 7-Day Forecast Grid */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-4 shadow-xl">
              <h3 className="text-lg font-bold text-white">7-Day Forecast</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { day: 'Today', icon: '☀️', high: '22°', low: '14°', active: true, barColor: 'bg-amber-400' },
                  { day: 'Tue', icon: '☁️', high: '19°', low: '13°', barColor: 'bg-[#2b4c7e]' },
                  { day: 'Wed', icon: '🌧️', high: '16°', low: '11°', barColor: 'bg-[#1c5b6b]' },
                  { day: 'Thu', icon: '☁️', high: '18°', low: '12°', barColor: 'bg-[#2b4c7e]' },
                  { day: 'Fri', icon: '☀️', high: '23°', low: '15°', barColor: 'bg-amber-400' },
                  { day: 'Sat', icon: '☀️', high: '25°', low: '16°', barColor: 'bg-amber-400' },
                  { day: 'Sun', icon: '☁️', high: '21°', low: '14°', barColor: 'bg-[#2b4c7e]' }
                ].map((fc, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 flex flex-col items-center justify-between text-center min-h-[140px] shadow-sm transition-all ${
                      fc.active
                        ? 'border-2 border-amber-400/80 bg-[#151c2e]'
                        : 'border border-slate-800/80 bg-[#121929] hover:border-slate-700'
                    }`}
                  >
                    <span className={`text-xs font-bold ${fc.active ? 'text-amber-400' : 'text-slate-300'}`}>
                      {fc.day}
                    </span>
                    <span className="text-2xl my-1">{fc.icon}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-extrabold text-white">{fc.high}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{fc.low}</span>
                    </div>
                    <div className={`w-full h-1 rounded-full ${fc.barColor} mt-2`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Detailed Day View Modal Overhaul ── */}
      {activeModalPlan && (
        <div
          onClick={() => setActiveDayView(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 md:py-8 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d1424] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl relative max-h-[85vh] overflow-y-auto flex flex-col my-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Header Banner */}
            <div className="relative w-full aspect-[16/6] min-h-[140px] bg-slate-950 overflow-hidden shrink-0">
              <Image
                src={activeModalPlan.coverImg}
                alt={activeModalPlan.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1424] via-[#0d1424]/40 to-transparent" />

              {/* Close Button Top Right */}
              <button
                onClick={() => setActiveDayView(null)}
                className="absolute top-4 right-4 z-10 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer border border-slate-700/60 shadow transition-all"
              >
                ✕
              </button>

              {/* Day Badge Top Left */}
              <div className="absolute top-4 left-4 bg-amber-400 text-slate-950 font-extrabold text-xs px-3 py-1 rounded-md shadow uppercase tracking-wider">
                DAY {activeModalPlan.day}
              </div>

              {/* Title & Location Bottom Left */}
              <div className="absolute bottom-4 left-6 right-6 flex flex-col gap-0.5">
                <h2 className="text-2xl font-bold text-white leading-tight drop-shadow">
                  {activeModalPlan.title}
                </h2>
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  {activeModalPlan.location}
                </span>
              </div>
            </div>

            {/* Metrics Summary Grid (3-Column Row) */}
            <div className="grid grid-cols-3 gap-3 p-6 pb-4 shrink-0">
              <div className="bg-[#131b2e] border border-slate-800/80 rounded-2xl p-3.5 flex flex-col items-center justify-center">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 flex items-center gap-1 uppercase">
                  <span>🕒</span> TOTAL TIME
                </span>
                <span className="text-base md:text-lg font-extrabold text-white text-center mt-1">
                  {activeModalPlan.totalTime}
                </span>
              </div>
              <div className="bg-[#131b2e] border border-slate-800/80 rounded-2xl p-3.5 flex flex-col items-center justify-center">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 flex items-center gap-1 uppercase">
                  <span>💲</span> TOTAL COST
                </span>
                <span className="text-base md:text-lg font-extrabold text-amber-400 text-center mt-1">
                  {activeModalPlan.totalCost}
                </span>
              </div>
              <div className="bg-[#131b2e] border border-slate-800/80 rounded-2xl p-3.5 flex flex-col items-center justify-center">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 flex items-center gap-1 uppercase">
                  <span>&gt;</span> ACTIVITIES
                </span>
                <span className="text-base md:text-lg font-extrabold text-white text-center mt-1">
                  {activeModalPlan.activitiesCount}
                </span>
              </div>
            </div>

            {/* ACTIVITY TIMELINE Section */}
            <div className="px-6 md:px-8 mb-2 shrink-0">
              <span className="text-slate-400 text-xs tracking-widest font-mono uppercase font-bold block">
                ACTIVITY TIMELINE
              </span>
            </div>

            <div className="px-6 md:px-8 pb-8 flex flex-col gap-4">
              {activeModalPlan.activities.map((act: FullDayActivity, idx: number) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-16 pt-3 text-amber-400 text-xs font-mono font-bold shrink-0 text-right">
                    {act.time}
                  </div>
                  <div className={`flex-1 rounded-2xl p-4 border flex flex-col gap-1.5 ${act.cardStyle}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-white">{act.name}</h4>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400">{act.duration}</span>
                        <span className={act.cost === 'FREE' ? 'text-emerald-400 font-extrabold' : 'text-amber-400 font-extrabold'}>
                          {act.cost}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 font-normal leading-relaxed">
                      {act.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
