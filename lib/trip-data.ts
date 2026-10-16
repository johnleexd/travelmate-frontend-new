export async function fetchTripWithOptionalWeather<TItinerary, TWeather>(
  fetchItinerary: () => Promise<TItinerary>,
  fetchWeather: () => Promise<TWeather>,
): Promise<{ itinerary: TItinerary; weather: TWeather | null }> {
  // Advisory weather must never hold a ready itinerary (or its error) open.
  // Keep weather if it finishes first; otherwise it remains available via refresh.
  let weather: TWeather | null = null;
  void fetchWeather().then(value => { weather = value; }, () => {});
  const itinerary = await fetchItinerary();
  return { itinerary, weather };
}
