/**
 * @file venues.js
 * Official Catalog of COEP Classroom and Campus Facilities.
 * Exactly 56 official venues:
 *  - Main Auditorium, Mini Auditorium
 *  - NC01 through NC32 (North Complex classrooms)
 *  - SC01 through SC20 (South Complex classrooms)
 *
 * NOTE: Capacity, equipment, and special instructions are marked "null"
 * (Details not available) until official room specifications are configured.
 */

// Generate North Complex classrooms (NC01 to NC32)
const ncClassrooms = Array.from({ length: 32 }, (_, index) => {
  const code = `NC${String(index + 1).padStart(2, '0')}`;
  return {
    id: `venue-${code.toLowerCase()}`,
    name: code,
    category: 'North Complex (Classrooms)',
    location: 'North Complex (NC Building)',
    capacity: null,
    amenities: [],
    description: null,
    rules: null,
  };
});

// Generate South Complex classrooms (SC01 to SC20)
const scClassrooms = Array.from({ length: 20 }, (_, index) => {
  const code = `SC${String(index + 1).padStart(2, '0')}`;
  return {
    id: `venue-${code.toLowerCase()}`,
    name: code,
    category: 'South Complex (Classrooms)',
    location: 'South Complex (SC Building)',
    capacity: null,
    amenities: [],
    description: null,
    rules: null,
  };
});

export const COEP_VENUES = [
  {
    id: 'venue-main-auditorium',
    name: 'Main Auditorium',
    category: 'Auditorium',
    location: 'Main Campus',
    capacity: null,
    amenities: [],
    description: null,
    rules: null,
  },
  {
    id: 'venue-mini-auditorium',
    name: 'Mini Auditorium',
    category: 'Auditorium',
    location: 'Main Campus',
    capacity: null,
    amenities: [],
    description: null,
    rules: null,
  },
  ...ncClassrooms,
  ...scClassrooms,
];

export const VENUE_CATEGORIES = [
  'All Categories',
  'Auditorium',
  'North Complex (Classrooms)',
  'South Complex (Classrooms)',
];
