// src/boardData.js

export const TILES = [
  { id: 0, name: "GO", type: "go", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 1, name: "Mediterranean Ave", type: "property", group: "brown", price: 60, houseCost: 50, mortgage: 30, rent: [2, 10, 30, 90, 160, 250] },
  { id: 2, name: "Community Chest", type: "community_chest", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 3, name: "Baltic Ave", type: "property", group: "brown", price: 60, houseCost: 50, mortgage: 30, rent: [4, 20, 60, 180, 320, 450] },
  { id: 4, name: "Income Tax", type: "tax", group: null, price: 200, houseCost: null, mortgage: null, rent: null },
  { id: 5, name: "Reading Railroad", type: "railroad", group: "railroad", price: 200, houseCost: null, mortgage: 100, rent: null },
  { id: 6, name: "Oriental Ave", type: "property", group: "light_blue", price: 100, houseCost: 50, mortgage: 50, rent: [6, 30, 90, 270, 400, 550] },
  { id: 7, name: "Chance", type: "chance", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 8, name: "Vermont Ave", type: "property", group: "light_blue", price: 100, houseCost: 50, mortgage: 50, rent: [6, 30, 90, 270, 400, 550] },
  { id: 9, name: "Connecticut Ave", type: "property", group: "light_blue", price: 120, houseCost: 50, mortgage: 60, rent: [8, 40, 100, 300, 450, 600] },
  { id: 10, name: "Jail / Just Visiting", type: "jail", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 11, name: "St. Charles Place", type: "property", group: "pink", price: 140, houseCost: 100, mortgage: 70, rent: [10, 50, 150, 450, 625, 750] },
  { id: 12, name: "Electric Company", type: "utility", group: "utility", price: 150, houseCost: null, mortgage: 75, rent: null },
  { id: 13, name: "States Ave", type: "property", group: "pink", price: 140, houseCost: 100, mortgage: 70, rent: [10, 50, 150, 450, 625, 750] },
  { id: 14, name: "Virginia Ave", type: "property", group: "pink", price: 160, houseCost: 100, mortgage: 80, rent: [12, 60, 180, 500, 700, 900] },
  { id: 15, name: "Pennsylvania Railroad", type: "railroad", group: "railroad", price: 200, houseCost: null, mortgage: 100, rent: null },
  { id: 16, name: "St. James Place", type: "property", group: "orange", price: 180, houseCost: 100, mortgage: 90, rent: [14, 70, 200, 550, 750, 950] },
  { id: 17, name: "Community Chest", type: "community_chest", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 18, name: "Tennessee Ave", type: "property", group: "orange", price: 180, houseCost: 100, mortgage: 90, rent: [14, 70, 200, 550, 750, 950] },
  { id: 19, name: "New York Ave", type: "property", group: "orange", price: 200, houseCost: 100, mortgage: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { id: 20, name: "Free Parking", type: "free_parking", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 21, name: "Kentucky Ave", type: "property", group: "red", price: 220, houseCost: 150, mortgage: 110, rent: [18, 90, 250, 700, 875, 1050] },
  { id: 22, name: "Chance", type: "chance", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 23, name: "Indiana Ave", type: "property", group: "red", price: 220, houseCost: 150, mortgage: 110, rent: [18, 90, 250, 700, 875, 1050] },
  { id: 24, name: "Illinois Ave", type: "property", group: "red", price: 240, houseCost: 150, mortgage: 120, rent: [20, 100, 300, 750, 925, 1100] },
  { id: 25, name: "B&O Railroad", type: "railroad", group: "railroad", price: 200, houseCost: null, mortgage: 100, rent: null },
  { id: 26, name: "Atlantic Ave", type: "property", group: "yellow", price: 260, houseCost: 150, mortgage: 130, rent: [22, 110, 330, 800, 975, 1150] },
  { id: 27, name: "Ventnor Ave", type: "property", group: "yellow", price: 260, houseCost: 150, mortgage: 130, rent: [22, 110, 330, 800, 975, 1150] },
  { id: 28, name: "Water Works", type: "utility", group: "utility", price: 150, houseCost: null, mortgage: 75, rent: null },
  { id: 29, name: "Marvin Gardens", type: "property", group: "yellow", price: 280, houseCost: 150, mortgage: 140, rent: [24, 120, 360, 850, 1025, 1200] },
  { id: 30, name: "Go To Jail", type: "go_to_jail", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 31, name: "Pacific Ave", type: "property", group: "green", price: 300, houseCost: 200, mortgage: 150, rent: [26, 130, 390, 900, 1100, 1275] },
  { id: 32, name: "North Carolina Ave", type: "property", group: "green", price: 300, houseCost: 200, mortgage: 150, rent: [26, 130, 390, 900, 1100, 1275] },
  { id: 33, name: "Community Chest", type: "community_chest", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 34, name: "Pennsylvania Ave", type: "property", group: "green", price: 320, houseCost: 200, mortgage: 160, rent: [28, 150, 450, 1000, 1200, 1400] },
  { id: 35, name: "Short Line", type: "railroad", group: "railroad", price: 200, houseCost: null, mortgage: 100, rent: null },
  { id: 36, name: "Chance", type: "chance", group: null, price: null, houseCost: null, mortgage: null, rent: null },
  { id: 37, name: "Park Place", type: "property", group: "dark_blue", price: 350, houseCost: 200, mortgage: 175, rent: [35, 175, 500, 1100, 1300, 1500] },
  { id: 38, name: "Luxury Tax", type: "tax", group: null, price: 100, houseCost: null, mortgage: null, rent: null },
  { id: 39, name: "Boardwalk", type: "property", group: "dark_blue", price: 400, houseCost: 200, mortgage: 200, rent: [50, 200, 600, 1400, 1700, 2000] }
];

export const GROUPS = {
  brown: [1, 3],
  light_blue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  dark_blue: [37, 39]
};

export const GROUP_COLORS = {
  brown: "#78350F",       // Brick/Brown HSL-adapted
  light_blue: "#0EA5E9",  // Cyber Neon cyan
  pink: "#EC4899",        // Neon hot pink
  orange: "#F97316",      // Electric neon orange
  red: "#EF4444",         // Neon bold red
  yellow: "#EAB308",      // Warm neon gold yellow
  green: "#10B981",       // Radiant neon green
  dark_blue: "#3B82F6"    // Electric neon blue
};

// Keyed by token shape name (what p.token / p.token_shape stores)
export const TOKEN_COLORS = {
  car:         "#EF4444",
  hat:         "#3B82F6",
  dog:         "#F59E0B",
  ship:        "#06B6D4",
  iron:        "#8B5CF6",
  shoe:        "#10B981",
  cat:         "#F97316",
  ring:        "#EC4899",
  wheelbarrow: "#84CC16",
};
