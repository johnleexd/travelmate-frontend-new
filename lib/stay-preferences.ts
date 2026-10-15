type StayReference = { name:string; type:string; amenities?:string[]; rating?:number; distanceKm?:number; price?:number; test?:boolean };
/** Ranking reference metadata is separate from availability, selection and booking. */
export function stayPreferenceScore(stay:StayReference,preference:string,style:string) {
  const text=[stay.name,stay.type,...(stay.amenities||[])].join(' ').toLowerCase();
  const central=stay.distanceKm!==undefined ? 1/(1+stay.distanceKm) : 0;
  const premium=(stay.rating??0)>=4 || /luxury|resort|spa/.test(text) ? 1 : 0;
  const family=/family|playground|kids|kitchen/.test(text) ? 1 : 0;
  const modest=/hostel|guest.?house|budget/.test(text) ? 1 : 0;
  const wanted=preference==='central location' ? central : preference==='luxury' ? premium : preference==='family-friendly' ? family : preference==='budget-friendly' ? modest : preference==='condo' ? Number(/condo|apartment/.test(text)) : ['hostel','resort'].includes(preference) ? Number(text.includes(preference)) : 0;
  // An explicit stay preference takes priority over the broader itinerary style.
  const secondary=style==='comfort' ? central : style==='luxury' ? premium : style==='family-friendly' ? family : style==='budget' ? modest : central/2;
  return wanted*10+secondary;
}
