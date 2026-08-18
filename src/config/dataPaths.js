export const DATA_PATHS = Object.freeze({
  stores: (quarter) => `/data/processed_by_dong.${quarter}.min.json`,
  marketContext: (quarter) => `/data/market_context.${quarter}.min.json`,
  geojson: '/data/seoul_dong.min.geojson',
})
