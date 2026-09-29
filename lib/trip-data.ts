export async function fetchTripWithOptionalWeather<TItinerary, TWeather>(
  fetchItinerary: () => Promise<TItinerary>,
  fetchWeather: () => Promise<TWeather>,
): Promise<{ itinerary: TItinerary; weather: TWeather | null }> {
  const [itineraryResult, weatherResult] = await Promise.allSettled([
    fetchItinerary(),
    fetchWeather(),
  ]);

  if (itineraryResult.status === 'rejected') throw itineraryResult.reason;

  return {
    itinerary: itineraryResult.value,
    weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
  };
}
