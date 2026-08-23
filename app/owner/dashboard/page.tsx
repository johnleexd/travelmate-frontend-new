'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerDashboard() {
  const router = useRouter();

  // Active Sub-Tab: 'analytics' | 'listings'
  const [activeOwnerTab, setActiveOwnerTab] = useState<'analytics' | 'listings'>('analytics');

  // Simulated Escrow Holds based on PayMongo test mode integration
  const [escrows, setEscrows] = useState([
    { id: 'TXN-9018', traveler: 'Jane Doe', listing: 'Prague Castle View Apartment', amount: '₱12,500', status: 'PAID_HELD' },
    { id: 'TXN-9022', traveler: 'Alex Smith', listing: 'Authentic Czech Food Tour', amount: '₱8,200', status: 'Released' },
    { id: 'TXN-9029', traveler: 'Mike Johnson', listing: 'Old Town Photography Walk', amount: '₱15,000', status: 'FROZEN_HELD' }
  ]);

  const handleLogout = () => {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/');
  };

  const handleRelease = (id: string) => {
    setEscrows(prev => prev.map(item => item.id === id ? { ...item, status: 'Released' } : item));
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] text-slate-100 font-sans flex flex-col">
      {/* ── 1. Top Navigation Bar ── */}
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
            onClick={() => {
              document.cookie = 'user_role=traveler; path=/;';
              router.push('/dashboard');
            }}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🧭</span> Traveller
          </button>
          <button
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-100 shadow-sm flex items-center gap-1.5 cursor-pointer"
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

      {/* ── 2. Feature Sub-Tabs Bar ── */}
      <div className="border-b border-slate-800/80 bg-[#020617] px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <button
            onClick={() => setActiveOwnerTab('analytics')}
            className={`py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeOwnerTab === 'analytics'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📈</span> Analytics
          </button>
          <button
            onClick={() => setActiveOwnerTab('listings')}
            className={`py-3.5 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeOwnerTab === 'listings'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🏨</span> Listings
          </button>
        </div>
      </div>

      {/* ── 3. Main Dashboard Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8">
        {/* Tab 1: Analytics */}
        {activeOwnerTab === 'analytics' && (
          <div className="flex flex-col gap-6 w-full">
            {/* KPI Summary Cards Grid (4 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: TOTAL VIEWS */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    TOTAL VIEWS
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                    👁️
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl md:text-3xl font-black text-white font-serif block">14,580</span>
                  <span className="text-xs font-semibold text-emerald-400 mt-1 block">+18% this month</span>
                </div>
              </div>

              {/* Card 2: BOOKINGS */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    BOOKINGS
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                    📅
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl md:text-3xl font-black text-white font-serif block">1,171</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">All listings YTD</span>
                </div>
              </div>

              {/* Card 3: REVENUE */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    REVENUE
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-400/10 border border-purple-400/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                    $
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl md:text-3xl font-black text-white font-serif block">$58K</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">June YTD</span>
                </div>
              </div>

              {/* Card 4: AVG RATING */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    AVG RATING
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-400/10 border border-blue-400/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                    ⭐
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl md:text-3xl font-black text-white font-serif block">4.7 ★</span>
                  <span className="text-xs text-slate-400 font-medium mt-1 block">892 reviews</span>
                </div>
              </div>
            </div>

            {/* Primary Charts Grid (2 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Views Chart Card */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-4 shadow-xl min-h-[300px]">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white font-serif">Monthly Views</h3>
                  <span className="text-xs font-mono font-bold text-cyan-400">↑ 18% vs last month</span>
                </div>

                {/* SVG Curve Line Chart Container */}
                <div className="flex-1 flex flex-col justify-between pt-4 relative">
                  {/* Grid Lines & Y-Axis */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 text-[10px] font-mono text-slate-500">
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>6000</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>4500</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>3000</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>1500</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>0</span></div>
                  </div>

                  {/* Cyan Curve Path */}
                  <div className="h-44 w-full relative z-10 my-auto">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 120 C 80 100, 160 85, 250 60 C 330 40, 410 70, 500 30 L 500 150 L 0 150 Z"
                        fill="url(#cyanArea)"
                      />
                      <path
                        d="M 0 120 C 80 100, 160 85, 250 60 C 330 40, 410 70, 500 30"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* X-Axis Months */}
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-2 z-10">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>
              </div>

              {/* Revenue Trend Chart Card */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-4 shadow-xl min-h-[300px]">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white font-serif">Revenue Trend</h3>
                  <span className="text-xs font-mono font-bold text-amber-400">↑ 44% vs last month</span>
                </div>

                {/* SVG Curve Line Chart Container */}
                <div className="flex-1 flex flex-col justify-between pt-4 relative">
                  {/* Grid Lines & Y-Axis */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 text-[10px] font-mono text-slate-500">
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>16000</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>12000</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>8000</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>4000</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>0</span></div>
                  </div>

                  {/* Gold Curve Path */}
                  <div className="h-44 w-full relative z-10 my-auto">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 115 C 90 100, 180 75, 270 50 C 350 30, 420 60, 500 20 L 500 150 L 0 150 Z"
                        fill="url(#goldArea)"
                      />
                      <path
                        d="M 0 115 C 90 100, 180 75, 270 50 C 350 30, 420 60, 500 20"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* X-Axis Months */}
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-2 z-10">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Analytics Grid (2 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* This Week's Visitor Traffic */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[300px]">
                <h3 className="text-lg font-bold text-white font-serif mb-2">This Week&apos;s Visitor Traffic</h3>

                <div className="flex-1 flex flex-col justify-between pt-4 relative">
                  {/* Y-Axis Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 text-[10px] font-mono text-slate-500">
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>360</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>270</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>180</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>90</span></div>
                    <div className="border-b border-dashed border-slate-400 w-full flex justify-between"><span>0</span></div>
                  </div>

                  {/* Purple Bars */}
                  <div className="h-44 flex items-end justify-between gap-3 px-2 z-10">
                    {[
                      { day: 'Mon', val: 140 },
                      { day: 'Tue', val: 190 },
                      { day: 'Wed', val: 160 },
                      { day: 'Thu', val: 220 },
                      { day: 'Fri', val: 300 },
                      { day: 'Sat', val: 350 },
                      { day: 'Sun', val: 290 }
                    ].map((item, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-t-md transition-all cursor-pointer shadow-md shadow-purple-500/10"
                          style={{ height: `${(item.val / 360) * 100}%` }}
                          title={`${item.day}: ${item.val} visitors`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* X-Axis Days */}
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-2 z-10 px-2">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>
              </div>

              {/* Top Performing Listings */}
              <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl min-h-[300px]">
                <div>
                  <h3 className="text-lg font-bold text-white font-serif mb-4">Top Performing Listings</h3>

                  <div className="flex flex-col gap-4">
                    {/* Item 1 */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200 font-bold">Prague Castle View Apartment</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">2,341 views</span>
                          <span className="font-bold text-amber-400">47 bookings</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full w-[78%]" />
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200 font-bold">Authentic Czech Food Tour</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">1,892 views</span>
                          <span className="font-bold text-amber-400">38 bookings</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full w-[63%]" />
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200 font-bold">Old Town Photography Walk</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">3,102 views</span>
                          <span className="font-bold text-amber-400">61 bookings</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full w-[95%]" />
                      </div>
                    </div>

                    {/* Item 4 */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200 font-bold">Vltava Kayak Adventure</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">987 views</span>
                          <span className="font-bold text-amber-400">12 bookings</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-teal-400 h-full rounded-full w-[35%]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/40 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                  <span>↗ Engagement metrics refreshed every 15 minutes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Listings & Escrow */}
        {activeOwnerTab === 'listings' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Slot Capacity Card */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-4 shadow-xl">
              <h3 className="text-lg font-bold text-white font-serif">Slot Capacity & Inventory Management</h3>
              <div className="flex flex-col divide-y divide-slate-800/60">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">Ocean Beach Resort Slot A</span>
                  <span className="font-mono font-bold text-emerald-400">Available (Capacity: 4/5)</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">Villa Sunset View Slot B</span>
                  <span className="font-mono font-bold text-amber-400">Fully Booked (Capacity: 0/3)</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">Mountain Eco-Lodge Slot C</span>
                  <span className="font-mono font-bold text-emerald-400">Available (Capacity: 2/6)</span>
                </div>
              </div>
            </div>

            {/* PayMongo Escrow Holds Card */}
            <div className="bg-[#0b101d] border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col gap-4 shadow-xl">
              <h3 className="text-lg font-bold text-white font-serif">PayMongo Escrow Accounts (Test Mode)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Txn ID</th>
                      <th className="py-2.5 px-3">Traveler</th>
                      <th className="py-2.5 px-3">Listing</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Escrow Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {escrows.map((escrow) => (
                      <tr key={escrow.id}>
                        <td className="py-3 px-3 font-mono font-bold text-slate-300">{escrow.id}</td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{escrow.traveler}</td>
                        <td className="py-3 px-3 text-slate-400">{escrow.listing}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">{escrow.amount}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold ${
                              escrow.status === 'PAID_HELD'
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                                : escrow.status === 'Released'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                : 'bg-red-950/80 text-red-400 border border-red-800/50'
                            }`}
                          >
                            {escrow.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {escrow.status === 'PAID_HELD' ? (
                            <button
                              onClick={() => handleRelease(escrow.id)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1 rounded text-xs transition-all cursor-pointer"
                            >
                              Release
                            </button>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
