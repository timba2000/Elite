// The 8 tradeable goods. volatility drives how far prices random-walk.
export const COMMODITIES = [
  { id: 'food', name: 'Food', base: 12, volatility: 0.010 },
  { id: 'water', name: 'Water', base: 8, volatility: 0.010 },
  { id: 'ore', name: 'Ore', base: 35, volatility: 0.018 },
  { id: 'fuel', name: 'Fuel', base: 25, volatility: 0.018 },
  { id: 'machinery', name: 'Machinery', base: 90, volatility: 0.020 },
  { id: 'electronics', name: 'Electronics', base: 140, volatility: 0.028 },
  { id: 'medicine', name: 'Medicine', base: 180, volatility: 0.028 },
  { id: 'luxuries', name: 'Luxuries', base: 250, volatility: 0.032 },
];
