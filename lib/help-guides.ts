export type HelpGuideId = 'create-trip' | 'saved-trips' | 'maps' | 'visited' | 'budget' | 'account';
export type HelpGuideDestination = 'planner' | 'bookings' | 'visited' | 'budget' | 'profile';

export type HelpGuide = {
  id: HelpGuideId;
  title: string;
  introduction: string;
  steps: readonly { title: string; description: string }[];
  action: { label: string; destination: HelpGuideDestination };
};

// These instructions describe the existing traveler workflows. Reading a guide
// only changes local selection; feature navigation belongs to its action button.
export const HELP_GUIDES: readonly HelpGuide[] = [
  {
    id: 'create-trip',
    title: 'Create a trip',
    introduction: 'Follow these steps to build your itinerary.',
    steps: [
      { title: 'Open Plan a trip', description: 'Choose Plan a trip from the sidebar to start a new plan.' },
      { title: 'Choose your destination', description: 'Search for and select a city or town, or use Browse by country to find one.' },
      { title: 'Set your currency, budget, and dates', description: 'Check the destination currency, enter the total trip budget, and choose your start and end dates (1–31 days).' },
      { title: 'Add travelers and Travel style', description: 'Under Traveling as, choose Solo, Couple, Family, or Friends / barkada. Check Travelers and choose the overall focus under Travel style.' },
      { title: 'Choose accommodation (optional)', description: 'Browse accommodation suggestions, use Enter manually for your own stay, or select Choose later.' },
      { title: 'Generate and review', description: 'Select Generate my trip. Review the day itineraries, suggested activities, and estimated expenses.' },
      { title: 'Check your saved plan', description: 'Successful generation saves the trip automatically in Saved trips. Use Update saved trip after edits. If automatic saving fails, a browser draft is kept; use Save manual changes to retry.' },
    ],
    action: { label: 'Go to Plan a trip', destination: 'planner' },
  },
  {
    id: 'saved-trips',
    title: 'Manage saved trips',
    introduction: 'Reopen your plans and keep each itinerary up to date.',
    steps: [
      { title: 'Open a saved itinerary', description: 'In Saved trips, choose Active, Completed, or Archived. Use View itinerary on an active or completed trip.' },
      { title: 'Edit a plan', description: 'Select Edit on an active trip. Change trip details opens its planning settings when dates, destination, travelers, or accommodation need to change.' },
      { title: 'Manage day activities', description: 'In the Edit dialog, select Day to edit. Use Add activity or the edit, remove, and move buttons beside an activity.' },
      { title: 'Save your edits', description: 'Confirm an activity with Add activity or Save activity, then select Save changes in the Edit dialog. When editing through View day itinerary, use Update saved trip.' },
      { title: 'Mark finished travel as done', description: 'Use Mark as done to move a trip to Completed. Mark as not done returns it to Active. These actions do not record visited places.' },
      { title: 'Archive or delete a trip', description: 'Open More options for the trip and choose Archive. In Archived, use Delete permanently and confirm the deletion. Restore trip is available if you want to keep an archived plan.' },
    ],
    action: { label: 'Go to Saved trips', destination: 'bookings' },
  },
  {
    id: 'maps',
    title: 'Maps & directions',
    introduction: 'Explore your saved stops and find a route to a place.',
    steps: [
      { title: 'Open a trip map', description: 'In Saved trips, select View map / Navigate on the trip you want to explore.' },
      { title: 'Choose a day and activity', description: 'Select a day and one of its stops. If an exact place is missing, use Choose an exact place and Find place before routing.' },
      { title: 'Preview a route', description: 'Choose a travel mode and Show day route for mapped stops. For one activity, select Navigate here, then use live GPS or Find start for a manual starting point and Show route here.' },
      { title: 'Use the available directions links', description: 'Visit map on an activity opens its place in Google Maps. Get directions on the itinerary’s destination map also opens Google Maps in a new tab. Location sharing is optional; straight-line previews are not travel directions.' },
    ],
    action: { label: 'Find maps in Saved trips', destination: 'bookings' },
  },
  {
    id: 'visited',
    title: 'Visited places',
    introduction: 'Keep a personal record of the places you actually visited.',
    steps: [
      { title: 'Choose places from a saved trip', description: 'In Saved trips, select Record visited places. Select individual named places or use Select all. You can also use Mark as visited on a saved itinerary activity.' },
      { title: 'Enter the actual visit date', description: 'Choose when you visited (today or earlier), then select Save visited places. Planned trip dates are not used as visit dates.' },
      { title: 'Avoid duplicate records', description: 'Record visited places marks existing visits Already recorded and disables them. Retrying this selection, even with another date, does not add the same place again.' },
      { title: 'Record another visit manually', description: 'In Visited places, choose Record a visit, enter the place, destination, and visit date, then Mark as visited. The same place and date are recorded once; another date can record a return visit.' },
      { title: 'Review your visit history', description: 'Search your records in Visited places. Recording or removing a visit does not complete a trip; Mark as done does not add visits.' },
    ],
    action: { label: 'Go to Visited places', destination: 'visited' },
  },
  {
    id: 'budget',
    title: 'Budget review',
    introduction: 'Compare your trip budget with the available expense estimates.',
    steps: [
      { title: 'Open the plan to review', description: 'Generate a plan or open View itinerary from Saved trips, then choose Budget review in the sidebar.' },
      { title: 'Read the estimated cost breakdown', description: 'Review accommodation, activities, food, transportation, and any recorded pre-trip expenses, miscellaneous costs, or contingency. These are planning estimates, not payments or actual spending.' },
      { title: 'Check allowances and assumptions', description: 'Food, local transport, accommodation, and contingency may use allowances. Review How these estimates are counted; adjust inputs in Trip planning settings → Budget details → Expense assumptions.' },
      { title: 'Look for incomplete estimates', description: 'Estimate unavailable, partial totals, and excluded accommodation mean some costs are missing. A provisional remaining amount does not confirm that the whole trip is affordable.' },
      { title: 'Compare the remaining amount', description: 'Remaining budget is your budget minus estimated costs; Amount over budget shows the excess. Use Edit trip budget to revise the limit, review Ways to spend less, and save your trip changes.' },
    ],
    action: { label: 'Go to Budget review', destination: 'budget' },
  },
  {
    id: 'account',
    title: 'Account settings',
    introduction: 'Keep your profile and contact details up to date.',
    steps: [
      { title: 'Open Account settings', description: 'Open your profile menu in the header and select Account settings, or use the button below.' },
      { title: 'Update your contact and travel profile', description: 'Edit Full name, Contact number, Profile photo URL, and Travel profile. Use an HTTPS image URL or leave it blank for the default avatar.' },
      { title: 'Save your profile', description: 'Select Save profile to keep your changes. Email address is read-only; email changes require account support.' },
      { title: 'Check status or get support', description: 'Review your email and account status. Use Report a problem for account help, or Sign out from the header’s profile menu when you are finished.' },
    ],
    action: { label: 'Open Account settings', destination: 'profile' },
  },
];
